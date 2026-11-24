// 야화 — 인연 프로필 등록 · 수정(리뉴얼 1120, spec-shell §4.8~4.14 · spec-rest §6.2)
// 첫 등록(가입 직후 mandatory 또는 미완성 회원): 소개 1/4 사진 → 2/4 상세 정보 → 3/4 자기소개 → 4/4 미리보기
//   → '살펴보고 있어요'(사진 검사 · 저장이 도는 동안 잠깐 — 승인 절차 없음) → 완료 → 인연 홈.
// 수정(MY에서 열기): '프로필 수정' 한 장(사진 · 기본 정보 · 나의 이야기 + 고치기) → 각 부분을 같은 단계 부품으로 고친다.
// 저장 경로는 기존 그대로: previewStore(로컬) + updateUserProfileServer(users 테이블), 완료 시 profile_completed.
// 학력·직장·소득 인증은 MY > 뱃지 관리에서 한다(1014 대표 지시).
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Image as RNImage, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { colors, ease, layout, type as typo } from '../tokens';
import { KeyboardAware } from '../components/KeyboardAware';
import { BreathingDots, Button, ConfirmSheet, DockArea, Icon, NATIVE, ProgressBar, Rise, T, TopBar, reduceMotion, usePress } from '../ui';
import { previewActions, previewSelectors, usePreview, getCurrentUserId } from '../lib/previewStore';
import { updateUserProfileServer, checkProfilePhoto } from '../lib/api';
import { apiOrigin } from '../lib/apiOrigin';
import { supabase } from '../lib/supabase';
import { thumbUrl } from '../lib/img';
import { MatchProfile, type FullProfileData } from '../components/FullProfile';
import { nicknameError } from '../lib/nickname';
import { useMyVerification } from '../components/credentials/useMyVerification';
import { useBackOverride } from '../lib/backHandler';
import { LABEL, objJosa, phoneFormatted } from '../components/entry/profileOptions';
import { MAX_PHOTOS, MIN_PHOTOS, PhotoEditor, PhotoIntro, photoRejectText, useMainFace } from '../components/entry/PhotoStep';
import { DetailFields, missingRequired, type Details } from '../components/entry/DetailStep';
import { MAX_PICKS, StoryStep, storiesDone, storyOk, type Extra } from '../components/entry/StoryStep';
import { Facts, MainPhoto, Stories, type BodyData } from '../components/entry/ProfileBody';
import { fillSlots } from '../lib/profileFill';

const LOGO_HEART = require('../../assets/renewal/logo-heart.png');
const COUPLE = require('../../assets/renewal/completion-couple.png');

// 연락처 저장 직후 태그히어 매장 포인트 초기 동기화(pull) — 실패해도 무해
async function linkTaghirePoints() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || typeof window === 'undefined') return;
    await fetch(`${apiOrigin()}/api/points-link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch { /* 무해 — 다음 웹훅에서 채워짐 */ }
}

type Draft = Details & { photos: string[]; ideal: string; extras: Extra[] };
type Step = 'photos' | 'details' | 'story' | 'preview';
const STEPS: Step[] = ['photos', 'details', 'story', 'preview'];

// onSubmitted: 첫 등록 저장이 끝난 순간(완료 화면이 떠 있는 동안 부모가 이 화면을 치우지 않게 알린다)
export function ProfileEdit({ onBack, mandatory, onDone, onExit, onSubmitted }: {
  onBack?: () => void; mandatory?: boolean; onDone?: () => void; onExit?: () => void; onSubmitted?: () => void;
}) {
  const queryClient = useQueryClient();
  const profile = usePreview(previewSelectors.myProfile);
  const { width: winW } = useWindowDimensions();
  const contentW = Math.min(winW, 560) - layout.gutter * 2;
  // 첫 등록 — 프로필을 아직 완성하지 않은 경우(가입 직후 포함). 화면이 떠 있는 동안에는 바뀌지 않는다
  const [first] = useState(() => !!mandatory || !profile.profileCompleted);
  const phoneLocked = !!profile.phone;  // 0078 서버 잠금
  // 학교(학교 메일 인증, users.univ_name) — 미리보기에서 다른 회원에게 보이는 그대로 보여 준다
  const univQ = useQuery({
    queryKey: ['my-univ'],
    queryFn: async () => {
      const uid = getCurrentUserId();
      if (!uid) return null;
      const { data } = await supabase.from('users').select('univ_name').eq('id', uid).maybeSingle();
      return (data as { univ_name: string | null } | null)?.univ_name ?? null;
    },
  });

  const draftFrom = (pf: typeof profile): Draft => ({
    photos: pf.photos?.length ? pf.photos : typeof pf.photo === 'string' ? [pf.photo] : [],
    nickname: pf.nickname ?? '',
    job: pf.job ?? '',
    region: pf.region ?? '',
    height: pf.height ?? null,
    mbti: pf.mbti ?? '',
    education: pf.education ?? '',
    religion: pf.religion ?? '',
    smoking: pf.smoking ?? '',
    drinking: pf.drinking ?? '',
    politics: pf.politics ?? '',
    politicsPublic: pf.politicsPublic ?? false,
    kakao: pf.kakaoId ?? '',
    phone: pf.phone ?? '',
    ideal: pf.introWant ?? '',
    extras: (pf.extraAnswers ?? []).filter((x) => !!x.q).slice(0, MAX_PICKS),
  });
  const [d, setD] = useState<Draft>(() => draftFrom(profile));
  // 서버 내 정보가 화면이 열린 뒤에 들어오면(새 기기 로그인 등) 아직 손대지 않은 초안을 그 값으로 채운다
  const touched = useRef(false);
  useEffect(() => { if (!touched.current) setD(draftFrom(profile)); }, [profile]);  // eslint-disable-line react-hooks/exhaustive-deps
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { touched.current = true; setD((p) => ({ ...p, [k]: v })); setErr(''); };
  // 가입 때 이미 받은 닉네임 · 사는 곳은 비어 있을 때(예전 회원)만 첫 등록에서 다시 묻는다
  const [askAgain] = useState(() => ({ nickname: !!nicknameError(profile.nickname ?? ''), region: !profile.region }));

  // view: 첫 등록은 단계, 수정은 main(프로필 수정 한 장) ↔ 고치는 부분 ↔ 미리보기
  const [view, setView] = useState<'main' | Step>(first ? 'photos' : 'main');
  const [phase, setPhase] = useState<'edit' | 'submitting' | 'done'>('edit');
  const [err, setErr] = useState('');
  const [showMissing, setShowMissing] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [standardTick, setStandardTick] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<Record<string, number>>({});
  const storyBack = useRef<(() => boolean) | null>(null);
  const mainFace = useMainFace(d.photos[0]);
  const verification = useMyVerification(view === 'preview' && !first);

  // 단계가 바뀔 때: 이전 내용 100ms로 사라짐 → 새 내용이 떠오름(§3-1 g). 머리 줄 · 막대는 그대로
  // 가입 화면과 같은 이유로 JS로 흐리고, 투명도는 새 단계가 그려진 뒤 되돌린다(SignUp go() 주석 참고 — 11-23 빈 화면)
  const fade = useRef(new Animated.Value(1)).current;
  function go(next: 'main' | Step) {
    setErr('');
    if (reduceMotion()) { setView(next); return; }
    Animated.timing(fade, { toValue: 0, duration: 100, easing: ease.out, useNativeDriver: false }).start(() => setView(next));
  }
  useLayoutEffect(() => { fade.setValue(1); }, [view, fade]);
  function focusField(k: string) {
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, (fieldY.current[k] ?? 0) - 24), animated: true }), 160);
  }

  // ── 저장 ────────────────────────────────────────────────────────────────
  function buildPatch() {
    return {
      nickname: d.nickname.trim(),
      region: d.region.trim(),
      job: d.job || undefined,
      phone: phoneLocked ? undefined : (phoneFormatted(d.phone) || undefined),
      kakaoId: d.kakao.trim(),
      photos: d.photos,
      photo: d.photos[0],
      mbti: d.mbti || undefined,
      education: d.education || undefined,
      height: d.height ?? undefined,
      religion: d.religion || undefined,
      smoking: d.smoking || undefined,
      drinking: d.drinking || undefined,
      politics: d.politics || undefined,
      politicsPublic: d.politicsPublic,
      introWant: d.ideal.trim() || undefined,
      // 20자를 못 채운 이야기는 담지 않는다
      extraAnswers: d.extras.map((x) => ({ q: x.q, a: x.a.trim() })).filter((x) => storyOk(x.a)),
      profileCompleted: true as const,
      // 운영 조치로 공개가 중지된 상태에서 저장하면 재검토 요청으로 남긴다(0139)
      ...(profile.affinitySuspended ? { affinityReviewRequestedAt: new Date().toISOString() } : {}),
    };
  }
  const nickErr = nicknameError(d.nickname);
  const phoneErr = !phoneLocked && !phoneFormatted(d.phone);
  function validatePhotos(): boolean {
    if (d.photos.length < MIN_PHOTOS) { go('photos'); setErr('대표 사진을 1장 올려 주세요.'); return false; }
    if (mainFace === 'no') { go('photos'); return false; }
    return true;
  }
  function validateDetails(): boolean {
    const missing = missingRequired(d);
    if (!nickErr && !missing.length && !phoneErr) return true;
    setShowMissing(true);
    if (view !== 'details') go('details');
    const k = nickErr ? 'nickname' : missing[0] ?? 'phone';
    setErr(nickErr ?? (missing.length ? `${LABEL[missing[0]]}${objJosa(LABEL[missing[0]])} 선택해 주세요.` : '휴대폰 번호를 정확히 입력해 주세요.'));
    focusField(k);
    return false;
  }

  async function submit() {
    if (saving) return;
    if (!validatePhotos() || !validateDetails()) return;
    // 첫 등록: 기본 소개 + 이야기 2장 필수 / 수정: 기본 소개만 필수(고른 질문은 쓴 것만 저장)
    if (first ? !storiesDone(d.ideal, d.extras) : !storyOk(d.ideal)) { go('story'); return; }
    setSaving(true);
    if (first) setPhase('submitting');
    const started = Date.now();
    // 사진 검사 — 첫 사진은 얼굴, 나머지는 사람이 나와야 한다(1014). 예전에 올린 사진도 저장할 때 확인한다.
    // 같은 사진은 다시 묻지 않는다(checkProfilePhoto 캐시).
    const checks = await Promise.all(d.photos.map((u, i) => checkProfilePhoto(u, i === 0 ? 'face' : 'person')));
    const bad = checks.findIndex((r) => r !== 'ok');
    if (bad >= 0) {
      setSaving(false);
      setPhase('edit');
      setView('photos');
      setErr(`${bad + 1}번째 사진을 바꿔 주세요. ${photoRejectText(checks[bad], bad === 0)}`);
      return;
    }
    const patch = buildPatch();
    try {
      await updateUserProfileServer(patch);
      previewActions.updateMyProfile(patch as any);
      if (!phoneLocked && phoneFormatted(d.phone)) linkTaghirePoints();
      queryClient.invalidateQueries({ queryKey: ['friend-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['friend-profile'] });
      if (first) {
        // '살펴보고 있어요'는 시안처럼 약 2.4초 머문 뒤 완료 화면으로
        onSubmitted?.();
        setTimeout(() => setPhase('done'), Math.max(0, 2400 - (Date.now() - started)));
      } else {
        queryClient.invalidateQueries({ queryKey: ['me'] });
        previewActions.showToast(profile.affinitySuspended ? '저장했어요. 운영팀이 확인 후 다시 공개해 드릴게요' : '프로필을 저장했어요', 2400);
        onBack?.();
      }
    } catch (e: any) {
      setPhase('edit');
      setErr(e?.message ? `저장하지 못했어요. ${e.message}` : '저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }
  function finish() {
    queryClient.invalidateQueries({ queryKey: ['me'] });
    if (mandatory) onDone?.(); else onBack?.();
  }

  // ── 뒤로 ────────────────────────────────────────────────────────────────
  function onTopBack() {
    if (phase !== 'edit') return;
    if (view === 'story' && storyBack.current?.()) return;
    if (first) {
      const i = STEPS.indexOf(view as Step);
      if (i > 0) { go(STEPS[i - 1]); return; }
      setExitOpen(true);
      return;
    }
    if (view !== 'main') { go('main'); return; }
    if (touched.current) setExitOpen(true); else onBack?.();
  }
  // 안드로이드 뒤로가기·웹 뒤로가기도 머리 줄의 뒤로와 같게 — 단계 되돌리기, 마지막엔 나가기 확인
  useBackOverride(() => { onTopBack(); return true; });

  const body: BodyData = {
    nickname: d.nickname, age: profile.age, job: d.job, region: d.region, height: d.height, mbti: d.mbti, smoking: d.smoking, drinking: d.drinking,
    religion: d.religion, education: d.education, politics: d.politicsPublic ? d.politics : null, photos: d.photos,
    stories: [...(storyOk(d.ideal) ? [{ q: '이런 사람에게 마음이 가요', a: d.ideal }] : []), ...d.extras.filter((x) => storyOk(x.a))],
  };

  // ── '살펴보고 있어요' · 완료(§4.13 · §4.14) ───────────────────────────────────
  if (phase === 'submitting') return <Submitting />;
  if (phase === 'done') return <Complete name={d.nickname} onStart={finish} onReview={() => { setPhase('edit'); setView('preview'); }} />;

  const stepIdx = STEPS.indexOf(view as Step);
  const missing = missingRequired(d).length + (nickErr ? 1 : 0) + (phoneErr ? 1 : 0);
  const detailFields = (
    <DetailFields
      d={d}
      set={set as any}
      show={{ nickname: first ? askAgain.nickname : true, region: first ? askAgain.region : true, phone: !phoneLocked, kakao: !first }}
      showMissing={showMissing}
      nickError={showMissing && nickErr ? nickErr : undefined}
      phoneError={showMissing && phoneErr ? '휴대폰 번호를 정확히 입력해 주세요.' : undefined}
      onLayoutField={(k, y) => { fieldY.current[k] = y + 110; }}
    />
  );
  const errLine = !!err && <Text accessibilityRole="alert" style={[typo.error, { marginTop: 10 }]}>{err}</Text>;

  // 고치는 화면(첫 등록의 단계 · 수정의 부분) 본문 + 아래 버튼
  let content: React.ReactNode = null;
  if (view === 'photos') {
    content = (
      <>
        <ScrollView ref={scrollRef} scrollEnabled={!dragging} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: 13, paddingBottom: 24 }}>
          <Rise index={0} cap={3} trigger="photos"><PhotoIntro onStandard={() => setStandardTick((n) => n + 1)} /></Rise>
          <Rise index={1} cap={3} trigger="photos" style={{ marginTop: 24 }}>
            <PhotoEditor photos={d.photos} onChange={(v) => set('photos', v)} width={contentW} mainFace={mainFace} error={err} onDragging={setDragging} standardTick={standardTick} />
          </Rise>
        </ScrollView>
        <DockArea>
          <Button
            label={!d.photos.length ? '대표 사진을 1장 올려 주세요' : first ? `사진 ${d.photos.length}장으로 계속하기` : '완료'}
            size="dock"
            disabled={!d.photos.length}
            onPress={() => { if (mainFace === 'no') return; go(first ? 'details' : 'main'); }}
          />
        </DockArea>
      </>
    );
  } else if (view === 'details') {
    content = (
      <KeyboardAware style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: 13, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <Rise index={0} cap={3} trigger="details"><T v="stepTitleM">일상의 모습을{'\n'}조금 더 알려주세요.</T></Rise>
          <Rise index={1} cap={3} trigger="details"><T v="intro" style={{ marginTop: 15 }}>작은 일상부터 천천히 알아가요.</T></Rise>
          <Rise index={2} cap={3} trigger="details" style={{ marginTop: 8 }}>{detailFields}{errLine}</Rise>
        </ScrollView>
        <DockArea>
          <Button
            label={missing ? `${missing}개 항목을 더 채워 주세요` : first ? '다음' : '완료'}
            size="dock"
            disabled={!!missing}
            onPress={() => { if (validateDetails()) go(first ? 'story' : 'main'); }}
          />
        </DockArea>
      </KeyboardAware>
    );
  } else if (view === 'story') {
    content = (
      <StoryStep
        ideal={d.ideal}
        extras={d.extras}
        edit={!first}
        backRef={storyBack}
        onChange={(ideal, extras) => { touched.current = true; setD((p) => ({ ...p, ideal, extras })); }}
        onNext={() => go(first ? 'preview' : 'main')}
      />
    );
  } else if (view === 'preview' && first) {
    content = (
      <>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: 13, paddingBottom: 72 }}>
          <Rise index={0} cap={3} trigger="preview"><T v="stepTitleM">당신의 첫 소개,{'\n'}이렇게 보여요.</T></Rise>
          <Rise index={1} cap={3} trigger="preview"><T v="intro" style={{ marginTop: 15 }}>상대방에게 보여줄 첫 소개예요.</T></Rise>
          <Rise index={2} cap={3} trigger="preview" style={{ marginTop: 30 }}><MainPhoto src={d.photos[0]} /></Rise>
          <Rise index={3} cap={3} trigger="preview" style={{ marginTop: 28 }}>
            <Facts p={body} />
            <Stories p={body} />
            {errLine}
          </Rise>
        </ScrollView>
        <DockArea fade><Button label="이 소개로 완성하기" size="dock" loading={saving} onPress={submit} /></DockArea>
      </>
    );
  } else if (view === 'preview') {
    // 수정 > 미리보기 = '내 프로필'(시안 profile-edit peViewing) — 다른 회원에게 보이는 상대 프로필 모양 그대로(MatchProfile, 호감 칩 없음 · 인증은 승인된 것만).
    // MY › 내 프로필 보기(PreviewScreen)와 같은 화면이고, 저장 전 고친 내용이 바로 보인다
    const previewData: FullProfileData = {
      nickname: d.nickname || '내 프로필', age: profile.age, region: d.region, mbti: d.mbti, height: d.height,
      job: d.job, school: univQ.data ?? null, education: d.education, drinking: d.drinking, smoking: d.smoking, religion: d.religion,
      politics: d.politicsPublic ? d.politics : null, ideal: d.ideal, extras: d.extras.filter((x) => storyOk(x.a)), photos: d.photos,
      basicVerified: verification.basicVerified,
      credentials: verification.credentials,
    };
    content = (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: 16, paddingBottom: 40 }}>
        <MatchProfile width={contentW} like={null} p={previewData} />
      </ScrollView>
    );
  } else {
    content = <EditMain d={d} body={body} err={err} saving={saving} suspended={!!profile.affinitySuspended} onGo={go} onSave={submit} />;
  }

  const title = first ? undefined : view === 'main' ? '프로필 수정' : view === 'photos' ? '사진' : view === 'details' ? '기본 정보' : view === 'story' ? '나의 이야기' : '내 프로필';
  const exitFirst = first && !!mandatory && !!onExit;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar
        title={title}
        onBack={onTopBack}
        right={first ? <Text style={{ minWidth: 44, textAlign: 'right', fontSize: 11, lineHeight: 16.5, color: colors.mute, fontVariant: ['tabular-nums'] }}>{stepIdx + 1} / 4</Text> : undefined}
        rightText={first ? undefined : view === 'main' ? '미리보기' : view === 'preview' ? '수정' : undefined}
        onRightPress={() => go(view === 'preview' ? 'main' : 'preview')}
      />
      {first && <ProgressBar rounded value={(stepIdx + 1) / 4} chapter="intro" />}
      <Animated.View style={{ flex: 1, opacity: fade }}>{content}</Animated.View>

      {/* 나가기 확인 */}
      <ConfirmSheet
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title={exitFirst ? '가입을 잠시 멈출까요?' : first ? '작성을 그만둘까요?' : '수정을 마칠까요?'}
        desc={exitFirst ? '로그아웃되며, 다시 로그인하면 여기서 이어서 작성해요.' : '저장하지 않은 내용은 사라져요.'}
        cancelLabel="계속 작성하기"
        confirmLabel={exitFirst ? '나가기' : '저장하지 않고 나가기'}
        onConfirm={() => { setExitOpen(false); (exitFirst ? onExit : onBack)?.(); }}
      />
    </View>
  );
}

// ── 프로필 수정 한 장(spec-rest §6.2) — 채움 카드 + 사진 · 기본 정보 · 나의 이야기(각각 '고치기') ──────────
function EditPill({ label, onPress }: { label: string; onPress: () => void }) {
  const press = usePress(0.96);
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={`${label} 고치기`} hitSlop={6}>
      <Animated.View style={[{ height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.bgSoft, flexDirection: 'row', alignItems: 'center', gap: 4 }, press.scaleStyle]}>
        <Icon name="pencil" size={14} color={colors.text} />
        <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.text }}>고치기</Text>
      </Animated.View>
    </Pressable>
  );
}
function SectionHead({ label, top = 24, onEdit }: { label: string; top?: number; onEdit: () => void }) {
  return (
    <View style={{ marginTop: top, marginBottom: 8, minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text accessibilityRole="header" style={{ fontSize: 13, lineHeight: 17, fontWeight: '600', color: colors.mute }}>{label}</Text>
      <EditPill label={label} onPress={onEdit} />
    </View>
  );
}

function EditMain({ d, body, err, saving, suspended, onGo, onSave }: {
  d: Draft; body: BodyData; err: string; saving: boolean; suspended: boolean; onGo: (v: 'main' | Step) => void; onSave: () => void;
}) {
  // 소개 채움 6칸(MY 링과 같은 기준, src/lib/profileFill.ts) — 채우지 않은 첫 칸을 안내하고 '추가'로 그 부분을 연다
  const slots: [boolean, string, Step][] = fillSlots({ photos: d.photos.length, details: d, drinking: d.drinking, ideal: d.ideal, extras: d.extras })
    .map((x) => [x.done, x.hint, x.step]);
  const done = slots.filter((s) => s[0]).length;
  const next = slots.find((s) => !s[0]);
  const R = 21, C = 2 * Math.PI * R;
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: 16, paddingBottom: 40 }}>
        {!!next && (
          <View style={{ marginBottom: 4, padding: 16, borderRadius: 16, backgroundColor: colors.bgSoft, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={48} height={48} viewBox="0 0 48 48" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={24} cy={24} r={R} fill="none" stroke={colors.control} strokeWidth={4} />
                <Circle cx={24} cy={24} r={R} fill="none" stroke={colors.text} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${C}`} strokeDashoffset={C * (1 - done / slots.length)} />
              </Svg>
              <Text style={{ fontSize: 12, lineHeight: 14, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] }}>{done}/{slots.length}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, lineHeight: 19.6, fontWeight: '600', color: colors.text }}>{done >= slots.length - 1 ? '소개를 거의 다 채웠어요' : '소개를 조금 더 채워 볼까요'}</Text>
              <T style={{ marginTop: 2, fontSize: 12, lineHeight: 18, color: colors.textSecondary }}>{next[1]}</T>
            </View>
            <Pressable onPress={() => onGo(next[2])} accessibilityRole="button" style={({ pressed }) => ({ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.accent, justifyContent: 'center', transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              <Text style={{ fontSize: 13, lineHeight: 17, fontWeight: '600', color: colors.inverse }}>추가</Text>
            </Pressable>
          </View>
        )}

        <SectionHead label="사진" top={next ? 16 : 0} onEdit={() => onGo('photos')} />
        <MainPhoto src={d.photos[0]} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
          {d.photos.map((u, i) => (
            <Pressable key={u} onPress={() => onGo('photos')} accessibilityRole="button" accessibilityLabel={i ? `사진 ${i + 1}` : '대표 사진'}>
              <Image source={{ uri: thumbUrl(u, 240) ?? u }} style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: colors.bgSoft }} contentFit="cover" cachePolicy="memory-disk" />
            </Pressable>
          ))}
          {d.photos.length < MAX_PHOTOS && (
            <Pressable onPress={() => onGo('photos')} accessibilityRole="button" accessibilityLabel="사진 추가" style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: colors.bgSoft, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.control, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={20} color={colors.mute} />
            </Pressable>
          )}
        </ScrollView>

        <SectionHead label="기본 정보" onEdit={() => onGo('details')} />
        <Facts p={body} />

        <SectionHead label="나의 이야기" onEdit={() => onGo('story')} />
        {body.stories.length ? <Stories p={body} first={0} /> : <Text style={{ fontSize: 13, lineHeight: 19.5, color: colors.sub }}>아직 담은 이야기가 없어요.</Text>}
        {!!err && <Text accessibilityRole="alert" style={[typo.error, { marginTop: 16 }]}>{err}</Text>}
      </ScrollView>
      <DockArea>
        <Button label={suspended ? '저장하고 재검토 요청하기' : '저장하기'} size="dock" loading={saving} onPress={onSave} />
      </DockArea>
    </>
  );
}

// ── '살펴보고 있어요'(§4.13) — 사진 검사 · 저장이 도는 동안 잠깐 보이는 화면. 뒤로 · 버튼 없음 ────────────
export function Submitting() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: layout.gutter }}>
      <RNImage source={LOGO_HEART} accessibilityLabel="야화" resizeMode="contain" style={{ width: 145, height: 70.3, marginBottom: 60 }} />
      <BreathingDots />
      <T style={{ marginTop: 24, fontFamily: typo.display2.fontFamily, fontSize: 26, lineHeight: 41.6, letterSpacing: -1, color: colors.text }} center accessibilityRole="header">당신의 첫 소개를{'\n'}살펴보고 있어요.</T>
      <T center style={{ marginTop: 14, fontSize: 14, lineHeight: 25.2, color: colors.sub }}>새로운 인연을 만나기 전, 잠시만 기다려주세요.</T>
    </View>
  );
}

// ── 완료(§4.14) — 도장: 원 페이드 + 0.8 → 1(550ms) → 체크 선이 그려짐(600ms, 지연 300) ───────────────────
export function Complete({ name, onStart, onReview }: { name: string; onStart: () => void; onReview: () => void }) {
  const still = reduceMotion();
  const seal = useRef(new Animated.Value(still ? 1 : 0)).current;
  const check = useRef(new Animated.Value(still ? 1 : 0)).current;
  const [dash, setDash] = useState(still ? 0 : 42);   // 체크 선 그리기(남은 길이)
  useEffect(() => {
    if (still) return;
    Animated.timing(seal, { toValue: 1, duration: 550, easing: ease.out, useNativeDriver: NATIVE }).start();
    const id = check.addListener(({ value }) => setDash(42 * (1 - value)));
    Animated.timing(check, { toValue: 1, duration: 600, delay: 300, easing: ease.out, useNativeDriver: false }).start();
    return () => check.removeListener(id);
  }, [seal, check, still]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, alignItems: 'center', paddingTop: 65, paddingHorizontal: layout.gutter, paddingBottom: 24 }}>
        <RNImage source={LOGO_HEART} accessibilityLabel="야화" resizeMode="contain" style={{ width: 145, height: 70.3 }} />
        <RNImage source={COUPLE} accessibilityLabel="손을 잡고 나란히 선 두 사람의 손그림" resizeMode="contain" style={{ width: 150, height: 205, marginTop: 19 }} />
        <Animated.View accessibilityElementsHidden style={{ marginTop: 8, opacity: seal, transform: [{ scale: seal.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }}>
          <Svg width={40} height={40} viewBox="0 0 68 68">
            <Circle cx={34} cy={34} r={32} fill={colors.accentSubtle} stroke={colors.control} strokeWidth={1} />
            {dash < 42 && <Path d="M20 34 L30 44 L49 24" fill="none" stroke={colors.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="42" strokeDashoffset={dash} />}
          </Svg>
        </Animated.View>
        <T center accessibilityRole="header" style={{ marginTop: 15, fontFamily: typo.display2.fontFamily, fontSize: 26, lineHeight: 39, letterSpacing: -1, color: colors.textSecondary }}>첫 장면을 위한{'\n'}준비가 되었어요.</T>
        <T v="intro" center style={{ marginTop: 15 }}>{name ? `${name}님, ` : ''}당신의 속도로 한 걸음씩 시작해요.</T>
      </ScrollView>
      <DockArea>
        <Button label="오늘의 인연 만나보기" size="dock" onPress={onStart} />
        <Pressable onPress={onReview} accessibilityRole="link" style={{ alignSelf: 'center', marginTop: 13, minHeight: 32, justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, lineHeight: 17, color: colors.accent, textDecorationLine: 'underline' }}>내 소개 다시 보기</Text>
        </Pressable>
      </DockArea>
    </View>
  );
}
