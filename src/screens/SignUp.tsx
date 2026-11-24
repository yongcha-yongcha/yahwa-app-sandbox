// 야화 — 가입: 약관 동의 → 기본 프로필(리뉴얼 1120, spec-shell §4.6 · §4.7 · §5.5)
// 한 틀(머리 줄 · 진행 막대 · 아래 주 버튼) 안에서 내용만 바뀐다. 문자 인증이 없어 진행 막대는 2칸(약관 50% · 기본 프로필 100%).
// 저장은 예전 그대로: set_birth_date RPC(age_locked) + users(닉네임 · 성별 · 휴대폰 · 동의 시각 · 마케팅 동의) + 사는 곳.
// 실 모드(IS_DEMO=false): supabase RPC 호출 + 로컬 store 미러 / 데모 모드: 로컬 store만 갱신
import React, { useLayoutEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Linking, Platform, ScrollView, Text, View } from 'react-native';
import { colors, ease, layout, type as typo } from '../tokens';
import { KeyboardAware } from '../components/KeyboardAware';
import {
  Button, ChoiceCard, DockArea, FieldHelp, FieldLabel, ProgressBar, Rise, SelectField, T, TermsRow, TextField, TopBar, WheelSheet, reduceMotion,
} from '../ui';
import { GenderArt } from '../components/entry/art';
import { phoneFormatted, phoneTyping, regionText } from '../components/entry/profileOptions';
import { RegionWheel } from '../components/entry/RegionWheel';
import { previewActions } from '../lib/previewStore';
import { signupAgeError, setBirthDate, signOut, MAX_SIGNUP_AGE } from '../lib/auth';
import { updateUserProfileServer } from '../lib/api';
import { syncTaghirePoints } from '../lib/pointsSync';
import { IS_DEMO } from '../lib/flags';
import { sendAlimtalk } from '../lib/alimtalk';
import { nicknameError, NICKNAME_MAX } from '../lib/nickname';
import { useBackOverride } from '../lib/backHandler';

type Birth = { y: number; m: number; d: number };
const daysIn = (y: number, m: number) => new Date(y, m, 0).getDate();
function manAge(b: Birth): number {
  const now = new Date();
  let age = now.getFullYear() - b.y;
  if (now.getMonth() + 1 < b.m || (now.getMonth() + 1 === b.m && now.getDate() < b.d)) age -= 1;
  return age;
}

export function SignUp({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<'consent' | 'identity'>('consent');
  const [agreeAdult, setAgreeAdult] = useState(false);       // 만 19세 이상 확인 (필수)
  const [agreeTerms, setAgreeTerms] = useState(false);       // 이용약관 (필수)
  const [agreePrivacy, setAgreePrivacy] = useState(false);   // 개인정보 수집·이용 (필수)
  const [agreeMarketing, setAgreeMarketing] = useState(false);  // 소식 및 혜택 알림 (선택)
  const [phone, setPhone] = useState('');                    // 휴대폰 번호 (필수, 지인 차단 기준 — 한 번 저장되면 서버가 잠근다 0078)
  const [nickname, setNickname] = useState('');
  const [birth, setBirth] = useState<Birth | null>(null);
  const [gender, setGender] = useState<'F' | 'M' | null>(null);
  const [region, setRegion] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);   // 주 버튼을 한 번 눌렀으면 빠진 항목을 알려 준다
  const [failMsg, setFailMsg] = useState('');
  const [sheet, setSheet] = useState<null | 'birth' | 'region'>(null);
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<Record<string, number>>({});
  const at = (k: string) => (e: { nativeEvent: { layout: { y: number } } }) => { fieldY.current[k] = e.nativeEvent.layout.y; };

  // 단계가 바뀔 때: 이전 내용 100ms로 사라짐 → 새 내용이 하나씩 떠오름(§3-1 f). 머리 줄 · 막대 · 버튼은 그대로
  // 투명도는 새 단계가 그려진 뒤에 되돌린다(먼저 되돌리면 지운 이전 화면이 한 번 번쩍 다시 보인다).
  // 이 틀은 JS로 흐린다(네이티브 드라이버 금지) — 11-23 빈 화면: 네이티브 애니메이션은 끝 콜백이 돈 '뒤에' JS 값을
  // 끝값(0)으로 덮어써, 화면은 1인데 RN이 기억하는 값은 0으로 남았다. 키보드로 이 틀 크기가 바뀌면 iOS가
  // 기억값(0)을 다시 칠해 내용 전체가 사라졌다(RCTViewComponentView invalidateLayer). 생년월일 · 지역을 먼저 고르면
  // 화면이 한 번 다시 그려지며 기억값이 1로 맞춰져 증상이 안 났던 것.
  const fade = useRef(new Animated.Value(1)).current;
  function go(next: 'consent' | 'identity') {
    Keyboard.dismiss();
    if (reduceMotion()) { setStep(next); return; }
    Animated.timing(fade, { toValue: 0, duration: 100, easing: ease.out, useNativeDriver: false }).start(() => setStep(next));
  }
  useLayoutEffect(() => { fade.setValue(1); }, [step, fade]);
  // 약관 화면의 뒤로 = 가입 그만두기(로그아웃 후 시작 화면으로)
  function back() {
    if (step === 'identity') { go('consent'); return; }
    signOut().catch(() => {});
  }
  // 안드로이드 뒤로가기 — 기본 프로필 단계면 약관 단계로(첫 단계는 기본 동작)
  useBackOverride(() => {
    if (sheet) { setSheet(null); return true; }
    if (step !== 'identity') return false;
    go('consent');
    return true;
  });

  const requiredAgreed = agreeAdult && agreeTerms && agreePrivacy;
  const allAgreed = requiredAgreed && agreeMarketing;
  const someAgreed = agreeAdult || agreeTerms || agreePrivacy || agreeMarketing;
  const phoneOk = !!phoneFormatted(phone);
  const nickErr = nicknameError(nickname);
  const ageErr = birth ? signupAgeError(birth.y, birth.m, birth.d) : null;
  const err = {
    phone: !phoneOk ? '휴대폰 번호를 확인해 주세요.' : '',
    nickname: nickErr ?? '',
    birth: !birth ? '생년월일을 골라 주세요.' : ageErr ? `${ageErr}.` : '',
    gender: !gender ? '성별을 선택해 주세요.' : '',
    region: !region ? '생활 지역을 선택해 주세요.' : '',
  };
  const firstErr = (['phone', 'nickname', 'birth', 'gender', 'region'] as const).find((k) => err[k]);

  async function submit() {
    if (busy) return;
    if (firstErr || !birth || !gender) {
      setTried(true);
      if (firstErr) scrollRef.current?.scrollTo({ y: Math.max(0, (fieldY.current[firstErr] ?? 0) - 24), animated: true });
      return;
    }
    setBusy(true);
    setFailMsg('');
    try {
      const phoneValue = phoneFormatted(phone);
      // 실 모드: 서버에 DOB 기록 (age_locked=true). 실패 시 진입 차단.
      if (!IS_DEMO) {
        // 이미 저장된 계정(앞선 제출은 성공했는데 화면이 안 넘어간 뒤 다시 누름) — 오류 대신 저장된 것으로 보고 이어 간다
        let already = false;
        await setBirthDate(birth.y, birth.m, birth.d).catch((e) => { if (e?.message === 'age already set') already = true; else throw e; });
        // 닉네임·성별도 서버에 동시 저장 — 서버 트리거의 자동 닉네임을 유저 입력으로 교체.
        // 실패해도 가입은 진행 (다음 프로필 작성에서 재시도됨)
        await updateUserProfileServer({
          gender,
          nickname: nickname.trim(),
          phone: phoneValue,
          region,
          privacyAgreedAt: new Date().toISOString(),
          marketingOptIn: agreeMarketing,
        }).catch(() => { /* best-effort */ });
        // 이미 야화 매장에서 쌓은 포인트가 있으면 바로 가져온다(1013)
        void syncTaghirePoints({ force: true });
        // 가입 환영 알림톡 (솔라피 미설정 시 서버가 skip) — 다시 누른 경우엔 이미 보냈다
        if (!already) void sendAlimtalk('signup');
      }
      previewActions.completeOnboarding({ year: birth.y, month: birth.m, day: birth.d, gender, nickname: nickname.trim() });
      previewActions.updateMyProfile({ phone: phoneValue, region } as any);
      onDone();
    } catch (e: any) {
      setFailMsg(e?.message || '가입하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  // ── 생년월일 휠 — 가입할 수 있는 나이(만 19~39세)에 맞춘 년도, 처음 자리는 30년 전 1월 1일 ──
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: MAX_SIGNUP_AGE - 19 + 1 }, (_, i) => thisYear - MAX_SIGNUP_AGE + i);
  const cur = birth ?? { y: thisYear - 30, m: 1, d: 1 };

  const consent = step === 'consent';
  return (
    // 키보드는 바깥 틀(KeyboardAware)만 맞춘다 — 안쪽 ScrollView의 automaticallyAdjustKeyboardInsets까지 겹치면
    // 입력칸을 누를 때 내용이 화면 밖으로 밀려 빈 화면이 됐다(11-23). 프로필 수정과 같은 방식.
    <KeyboardAware style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar onBack={back} />
      <ProgressBar value={consent ? 0.5 : 1} />
      <Animated.View style={{ flex: 1, opacity: fade }}>
        {consent ? (
          <ScrollView key="consent" style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: 38, paddingBottom: 24 }}>
            <Rise index={0} trigger="consent"><T v="stepTitle">우리의 약속을{'\n'}확인해 주세요.</T></Rise>
            <Rise index={1} trigger="consent"><T v="intro" style={{ marginTop: 15 }}>편안한 만남을 위한 이용 안내예요.{'\n'}필수 항목만 선택해도 시작할 수 있어요.</T></Rise>
            <Rise index={2} trigger="consent" style={{ marginTop: 30 }}>
              <TermsRow
                all
                label="전체 동의"
                checked={allAgreed}
                mixed={someAgreed && !allAgreed}
                onToggle={() => { const next = !allAgreed; setAgreeAdult(next); setAgreeTerms(next); setAgreePrivacy(next); setAgreeMarketing(next); }}
              />
            </Rise>
            <Rise index={3} trigger="consent">
              <TermsRow style={{ minHeight: 57 }} label="[필수] 만 19세 이상입니다" checked={agreeAdult} onToggle={() => setAgreeAdult((v) => !v)} />
            </Rise>
            <Rise index={4} trigger="consent">
              <TermsRow style={{ minHeight: 57 }} label="[필수] 이용약관 동의" checked={agreeTerms} onToggle={() => setAgreeTerms((v) => !v)} onOpen={() => openPolicy('terms')} />
            </Rise>
            <Rise index={5} trigger="consent">
              <TermsRow style={{ minHeight: 57 }} label="[필수] 개인정보 수집·이용 동의" checked={agreePrivacy} onToggle={() => setAgreePrivacy((v) => !v)} onOpen={() => openPolicy('privacy')} />
            </Rise>
            <Rise index={6} trigger="consent">
              <TermsRow style={{ minHeight: 57 }} label="[선택] 소식 및 혜택 알림" checked={agreeMarketing} onToggle={() => setAgreeMarketing((v) => !v)} onOpen={() => openPolicy('terms')} />
            </Rise>
          </ScrollView>
        ) : (
          <ScrollView
            key="identity"
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingTop: 38, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
          >
            <Rise index={0} trigger="identity"><T v="stepTitle">당신의 이야기를{'\n'}조금 들려주세요.</T></Rise>
            <Rise index={1} trigger="identity"><T v="intro" style={{ marginTop: 15 }}>처음엔 간단한 소개면 충분해요.{'\n'}사진과 자세한 이야기는 다음에 더해요.</T></Rise>

            {/* 휴대폰 번호 — 문자 인증 없이 직접 입력(지인 차단 기준값) */}
            <Rise index={2} trigger="identity" style={{ marginTop: 30 }}>
              <View onLayout={at('phone')}>
                <TextField
                  label="휴대폰 번호"
                  value={phone}
                  onChangeText={(t) => setPhone(phoneTyping(t))}
                  keyboardType="number-pad"
                  placeholder="010-0000-0000"
                  maxLength={13}
                  clearable
                  help="다른 회원에게 공개되지 않고, 아는 사람 차단에만 쓰여요."
                  error={tried && err.phone ? err.phone : false}
                />
              </View>
            </Rise>

            <Rise index={3} trigger="identity" style={{ marginTop: 22 }}>
              <View onLayout={at('nickname')}>
                <TextField
                  label="닉네임"
                  value={nickname}
                  onChangeText={(t) => setNickname(t.slice(0, NICKNAME_MAX))}
                  maxLength={NICKNAME_MAX}
                  placeholder={`예: 윤슬 · 산책하는곰 (2~${NICKNAME_MAX}자)`}
                  clearable
                  error={tried && err.nickname ? err.nickname : false}
                />
              </View>
            </Rise>

            <Rise index={4} trigger="identity" style={{ marginTop: 22 }}>
              <View onLayout={at('birth')}>
                <SelectField
                  label="생년월일"
                  value={birth ? `${birth.y}년 ${birth.m}월 ${birth.d}일` : ''}
                  placeholder="생년월일을 골라 주세요"
                  open={sheet === 'birth'}
                  onPress={() => setSheet('birth')}
                  error={birth ? !!ageErr : tried}
                />
                {birth && !ageErr ? (
                  <Text style={[typo.help, { marginTop: 8, marginHorizontal: 2 }]}>
                    <Text style={{ fontWeight: '600', color: colors.inverseStrong }}>만 {manAge(birth)}세</Text>로 소개돼요.
                  </Text>
                ) : (
                  <FieldHelp error={birth ? !!ageErr : tried}>{birth || tried ? err.birth : '만 19세~39세만 가입할 수 있어요.'}</FieldHelp>
                )}
              </View>
            </Rise>

            <Rise index={5} trigger="identity">
              <View onLayout={at('gender')}>
                <FieldLabel>성별</FieldLabel>
                <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>
                  <ChoiceCard label="여성" selected={gender === 'F'} error={tried && !gender} art={<GenderArt gender="F" />} onPress={() => setGender('F')} />
                  <ChoiceCard label="남성" selected={gender === 'M'} error={tried && !gender} art={<GenderArt gender="M" />} onPress={() => setGender('M')} />
                </View>
                <FieldHelp error={tried && !gender}>{tried && !gender ? err.gender : '성별과 생년월일은 한 번 정하면 바꿀 수 없어요.'}</FieldHelp>
              </View>
            </Rise>

            <Rise index={6} trigger="identity" style={{ marginTop: 22 }}>
              <View onLayout={at('region')}>
                <SelectField
                  label="주로 생활하는 지역"
                  value={regionText(region)}
                  placeholder="지역을 골라 주세요"
                  open={sheet === 'region'}
                  onPress={() => setSheet('region')}
                  error={tried && err.region ? err.region : false}
                />
              </View>
            </Rise>
            {!!failMsg && <Text accessibilityRole="alert" style={[typo.error, { marginTop: 10 }]}>{failMsg}</Text>}
          </ScrollView>
        )}
      </Animated.View>

      <DockArea>
        {consent
          ? <Button label="동의하고 계속하기" size="dock" disabled={!requiredAgreed} onPress={() => go('identity')} />
          : <Button label="첫 소개 완성하기" size="dock" loading={busy} onPress={submit} />}
      </DockArea>

      <WheelSheet
        open={sheet === 'birth'}
        onClose={() => setSheet(null)}
        title="생년월일"
        caption="상대에게는 만 나이로만 보여요."
        columns={[
          { label: '년', flex: 1.3, current: cur.y, values: years.map((y) => ({ value: y, label: `${y}년` })) },
          { label: '월', current: cur.m, values: Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}월` })) },
          { label: '일', current: cur.d, values: Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: `${i + 1}일` })) },
        ]}
        // 없는 날(2월 30일)은 흐리게 — 고르면 그 달 마지막 날로 맞춘다
        isDisabled={(k, v, now) => k === 2 && Number(v) > daysIn(Number(now[0]), Number(now[1]))}
        onDone={([y, m, d]) => {
          const yy = Number(y), mm = Number(m);
          setBirth({ y: yy, m: mm, d: Math.min(Number(d), daysIn(yy, mm)) });
          setSheet(null);
        }}
      />
      <RegionWheel open={sheet === 'region'} value={region} onClose={() => setSheet(null)} onPick={(r) => { setRegion(r); setSheet(null); }} />
    </KeyboardAware>
  );
}

// 약관 원문 — 웹은 새 탭, 앱은 인앱 브라우저로 연다.
function openPolicy(kind: 'privacy' | 'terms') {
  const url = Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/${kind}`
    : `https://yahwa.vercel.app/${kind}`;
  if (Platform.OS === 'web') { try { window.open(url, '_blank'); } catch { /* 팝업 차단 — 무시 */ } return; }
  Linking.openURL(url).catch(() => { /* 브라우저 없음 — 무시 */ });
}
