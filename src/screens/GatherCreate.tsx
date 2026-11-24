// 야화 — 모임 생성 모달
import React, { useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../tokens';
import { KeyboardAware } from '../components/KeyboardAware';
import { Icons } from '../icons';
import { Btn, Chip } from '../components/atoms';
import { RegionPicker } from '../components/RegionPicker';
import { DateTimePicker } from '../components/DateTimePicker';
import { previewSelectors, usePreview, getCurrentUserId } from '../lib/previewStore';
import { pickPhoto as pickImageFile, uploadPhotoToStorage } from '../lib/photoUpload';
import { useCreateGatheringMutation } from '../lib/hooks';
import { supabase } from '../lib/supabase';
import { CAT_COVER, DEFAULT_COVER } from '../data/mock';
import { friendlyError } from '../lib/errors';
import { promptEnablePush } from '../lib/push';
import { bottomBarPad } from '../lib/layout';
import { ALL_CATEGORIES } from '../data/categories';

const RATIO_MAX = 16;  // 성비 N:N 최대 (16:16)
// 카테고리 — 홈 필터와 동일한 단일 소스(../data/categories). '기타'는 직접 입력 유지.
const CATS = ALL_CATEGORIES;

// 위저드 카테고리 그룹 — 문토식 아코디언. 값은 전부 ALL_CATEGORIES에 포함되는
// 저장 호환 라벨 그대로(gatherings.cat text — 홈 필터 CAT_GROUPS와 정합).
const CAT_WIZARD_GROUPS: { emoji: string; label: string; desc: string; cats: string[] }[] = [
  { emoji: '😊', label: '자유만남', desc: '부담 없이 가볍게 만나요', cats: ['자유만남'] },
  { emoji: '🍶', label: '술·맛집', desc: '와인·낮술·맛집투어·카페', cats: ['와인', '낮술', '맛집투어', '카페', '술·맛집'] },
  { emoji: '🏃', label: '운동·액티비티', desc: '러닝·등산·테니스·골프·볼링', cats: ['러닝', '등산', '테니스', '골프', '볼링', '운동'] },
  { emoji: '🎨', label: '문화·취미', desc: '전시·영화·음악·사진·보드게임', cats: ['전시·공연', '영화', '음악', '사진', '보드게임', '게임', '요리·베이킹', '문화·취미'] },
  { emoji: '🚗', label: '여행·나들이', desc: '여행·드라이브·파티', cats: ['여행', '드라이브', '파티'] },
  { emoji: '📚', label: '자기계발', desc: '독서·스터디·재테크·외국어', cats: ['독서', '스터디', '자기계발', '재테크', '외국어'] },
  { emoji: '🐾', label: '라이프', desc: '반려동물·봉사', cats: ['반려동물', '봉사'] },
];
const WIZARD_STEPS = 5;  // 카테고리 → 소개 → 일시 → 장소 → 모집·참가비
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

type SocialKind = 'normal' | 'yahwa';
type GenderMode = 'any' | 'split';

// ISO datetime → "6/5 (목) 19:30"
function isoToDisplay(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEK[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function GatherCreate({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [step, setStep] = useState(0);                 // 위저드 페이지 (0~4)
  const [openGroup, setOpenGroup] = useState<string | null>(null);  // 카테고리 아코디언
  const [hasFee, setHasFee] = useState(false);          // 참가비 있음/없음
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState<string>('');
  const [customCat, setCustomCat] = useState('');  // '기타' 선택 시 직접 입력
  const [socialKind, setSocialKind] = useState<SocialKind>('normal');
  const [genderMode, setGenderMode] = useState<GenderMode>('any');
  const [ratioN, setRatioN] = useState(2);  // 성비 N:N의 N (2~16)
  const ratio = `${ratioN}:${ratioN}`;
  const [capacity, setCapacity] = useState(2);
  const [region, setRegion] = useState<string | null>(null);
  // 장소 — 상호명 검색(네이버 지역검색) → 결과 선택. 결과 없거나 모르면 하단 주소 직접 입력.
  const [placeQuery, setPlaceQuery] = useState('');          // 상호명 검색어
  const [placeResults, setPlaceResults] = useState<{ name: string; address: string | null; roadAddress: string | null }[]>([]);
  const [placeSearched, setPlaceSearched] = useState(false); // 검색을 한 번이라도 했는지
  const [placeInfo, setPlaceInfo] = useState<{ name: string; address: string | null } | null>(null);  // 선택된 장소
  const [manualAddr, setManualAddr] = useState('');          // 상호명 모를 때 직접 입력 주소
  const [placeBusy, setPlaceBusy] = useState(false);
  const [startAt, setStartAt] = useState<string | null>(null);
  const [whenDisplay, setWhenDisplay] = useState('');
  const [fee, setFee] = useState('0');
  const [feeDesc, setFeeDesc] = useState('');
  const [desc, setDesc] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);  // 최대 3장 — 첫 장이 대표(cover). 미리보기(로컬 uri)→업로드 후 실제 URL로 교체.
  const [photoBusy, setPhotoBusy] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);  // 백그라운드 업로드 진행 수(>0이면 제출 대기)
  const [regionOpen, setRegionOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const MAX_PHOTOS = 3;
  async function pickPhoto() {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('사진 개수 초과', `사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요`);
      return;
    }
    const uid = getCurrentUserId();
    if (!uid) { Alert.alert('로그인 필요', '사진 업로드는 로그인 후 가능해요'); return; }
    // 1) 선택(빠름) — 끝나면 곧장 미리보기 노출, 업로드는 백그라운드로.
    setPhotoBusy(true);
    let picked;
    try {
      picked = await pickImageFile();
    } catch (e: any) {
      setPhotoBusy(false);
      Alert.alert('사진 선택 실패', e?.message ?? '다시 시도해주세요');
      return;
    }
    setPhotoBusy(false);
    if (!picked || photos.length >= MAX_PHOTOS) return;
    const localUri = picked.uri;
    // 즉시 미리보기(로컬 uri) — 사용자가 바로 확인 가능.
    setPhotos((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, localUri]));
    // 2) 백그라운드 업로드 → 완료되면 로컬 uri를 실제 Storage URL로 교체.
    setUploadingCount((c) => c + 1);
    try {
      const url = await uploadPhotoToStorage(picked, uid);
      setPhotos((prev) => prev.map((u) => (u === localUri ? url : u)));
    } catch (e: any) {
      setPhotos((prev) => prev.filter((u) => u !== localUri));  // 실패 시 미리보기 제거
      Alert.alert('업로드 실패', e?.message ?? '잠시 후 다시 시도해주세요');
    } finally {
      setUploadingCount((c) => Math.max(0, c - 1));
    }
  }

  const insets = useSafeAreaInsets();
  const myProfile = usePreview(previewSelectors.myProfile);
  const createMut = useCreateGatheringMutation();
  const busy = createMut.isPending;

  const feeNum = Math.max(0, parseInt(fee, 10) || 0);
  const canSubmit = !!title.trim() && !!region && !!startAt && (feeNum <= 0 || !!feeDesc.trim()) && !busy && uploadingCount === 0;

  function reset() {
    setStep(0); setOpenGroup(null); setHasFee(false);
    setTitle(''); setCat(''); setCustomCat(''); setSocialKind('normal'); setGenderMode('any');
    setRatioN(2); setCapacity(2); setRegion(null); setStartAt(null); setWhenDisplay('');
    setFee('0'); setFeeDesc(''); setDesc(''); setPhotos([]);
    setPlaceQuery(''); setPlaceResults([]); setPlaceSearched(false); setPlaceInfo(null); setManualAddr('');
  }

  // 상호명 검색 → 네이버 지역검색 결과 목록
  async function searchPlace() {
    const query = placeQuery.trim();
    if (!query) {
      Alert.alert('입력 필요', '매장명 또는 상호명을 입력해주세요');
      return;
    }
    setPlaceBusy(true);
    setPlaceInfo(null);
    try {
      const { data, error } = await supabase.functions.invoke('place-search', { body: { query } });
      if (error) {
        let msg = '검색 중 문제가 생겼어요. 잠시 후 다시 시도해주세요';
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) msg = body.error;
        } catch { /* 기본 메시지 유지 */ }
        Alert.alert('검색에 실패했어요', msg);
        return;
      }
      const results = Array.isArray(data?.results) ? data.results : [];
      setPlaceResults(results);
      setPlaceSearched(true);
    } catch {
      Alert.alert('검색에 실패했어요', '네트워크 상태를 확인하고 다시 시도해주세요');
    } finally {
      setPlaceBusy(false);
    }
  }

  // 검색 결과 선택 → 장소 확정 (도로명 주소 우선)
  function selectPlace(r: { name: string; address: string | null; roadAddress: string | null }) {
    setPlaceInfo({ name: r.name, address: r.roadAddress || r.address || null });
    setPlaceResults([]);
    setPlaceSearched(false);
    setManualAddr('');
  }

  async function submit() {
    if (!title.trim()) {
      Alert.alert('입력 필요', '모임 제목을 입력해 주세요');
      return;
    }
    if (!region) {
      Alert.alert('입력 필요', '지역을 선택해 주세요');
      return;
    }
    if (!startAt) {
      Alert.alert('입력 필요', '날짜·시간을 선택해 주세요');
      return;
    }
    if (feeNum > 0 && !feeDesc.trim()) {
      Alert.alert('입력 필요', '참가비 사용처를 입력해 주세요');
      return;
    }
    if (!myProfile.nickname.trim()) {
      Alert.alert('프로필 설정이 필요해요', '모임을 만들려면 닉네임이 있어야 해요.\n마이 → 프로필 편집에서 닉네임을 저장한 뒤 다시 시도해주세요.');
      return;
    }
    if (!myProfile.gender) {
      Alert.alert('성별 설정이 필요해요', '모임 자리 배치를 위해 성별이 필요해요.\n마이 → 프로필 편집에서 성별을 설정해주세요.');
      return;
    }
    // 호스트 안내 — 생성 전 역할/책임을 명확히 고지하고 확인받는다.
    const guide =
      '모임을 만들기 전에 확인해주세요\n\n' +
      '• 앱 알림을 꼭 켜주세요. 참여 신청이 들어오면 알림으로 알려드려요.\n' +
      '• 호스트는 신청한 사람들을 직접 승인해야 모임이 채워져요.\n' +
      '• 인원이 모두 확정되면 호스트가 참여자들을 단톡방에 초대해 진행을 맡아주세요.';
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && !window.confirm(`${guide}\n\n모임을 만들까요?`)) return;
      await doCreate();
    } else {
      Alert.alert('호스트 안내', guide, [
        { text: '취소', style: 'cancel' },
        { text: '모임 만들기', onPress: () => { void doCreate(); } },
      ]);
    }
  }

  async function doCreate() {
    // submit()에서 검증했지만, 별도 함수라 타입 내로잉이 넘어오지 않아 방어적으로 재확인.
    if (!region || !startAt) return;
    try {
      await createMut.mutateAsync({
        title: title.trim(),
        cat: cat === '기타' && customCat.trim() ? customCat.trim() : cat,
        // 업로드한 첫 사진이 대표 이미지 — 없으면 카테고리 기본 커버
        cover: photos[0] ?? (CAT_COVER[cat] ?? DEFAULT_COVER),
        photos,
        ratio,
        place: region,
        whenText: whenDisplay,
        description: desc.trim() || '편하게 모여서 가볍게 이야기 나눠요.',
        hostNick: myProfile.nickname,
        hostPhoto: myProfile.groupPhoto ?? (typeof myProfile.photo === 'string' ? myProfile.photo : null),
        gender: (myProfile.gender as 'M' | 'F' | null) ?? 'M',
        fee: feeNum,
        feeDesc: feeNum > 0 ? feeDesc.trim() : undefined,
        genderMode,
        region,
        socialKind,
        capacity,
        startAt,
        // 선택된 장소가 있으면 상호명+주소, 없으면 직접 입력한 주소만 저장. 링크는 더 이상 사용 안 함.
        placeName: placeInfo?.name,
        placeAddress: (placeInfo?.address ?? manualAddr.trim()) || undefined,
      });
      reset();
      onClose();
      onCreated?.();
      // 호스트는 신청 알림을 받아야 하므로 생성 직후 알림 권한을 유도한다.
      void promptEnablePush('참여 신청이 들어오면 알림으로 알려드려요.');
    } catch (e: any) {
      const f = friendlyError(e, '모임 생성 실패');
      Alert.alert(f.title, f.message);
    }
  }

  // ── 단계별 진행 가능 여부 ────────────────────────────────────────────────
  const stepOk = (() => {
    switch (step) {
      case 0: return !!cat && (cat !== '기타' || !!customCat.trim());
      case 1: return !!title.trim();
      case 2: return !!startAt;
      case 3: return !!region;
      case 4: return (!hasFee || (feeNum > 0 && !!feeDesc.trim())) && uploadingCount === 0 && !busy;
      default: return false;
    }
  })();
  const stepHint = (() => {
    if (stepOk) return '';
    switch (step) {
      case 0: return cat === '기타' ? '카테고리를 직접 입력해주세요' : '카테고리를 선택해주세요';
      case 1: return '모임 제목을 입력해주세요';
      case 2: return '날짜와 시간을 선택해주세요';
      case 3: return '지역을 선택해주세요';
      case 4:
        if (uploadingCount > 0) return '사진 업로드가 끝나면 만들 수 있어요';
        if (hasFee && feeNum <= 0) return '참가비 금액을 입력해주세요';
        if (hasFee && !feeDesc.trim()) return '참가비 사용처를 입력해주세요';
        return '';
      default: return '';
    }
  })();

  function goNext() {
    if (!stepOk) return;
    if (step < WIZARD_STEPS - 1) setStep(step + 1);
    else void submit();
  }
  function goBack() {
    if (step > 0) setStep(step - 1);
    else onClose();
  }

  const STEP_TITLES = [
    '어떤 모임을 열까요?',
    '모임을 소개해주세요',
    '언제 만날까요?',
    '어디서 만날까요?',
    '어떻게 모일까요?',
  ];
  const STEP_DESCS = [
    '주제를 고르면 비슷한 취향의 멤버들에게 먼저 보여요.',
    '제목만 있어도 충분해요. 사진과 소개는 나중에 봐도 좋아요.',
    '모임 시간이 되면 목록에서 자동으로 내려가요.',
    '정원이 차기 전까지 장소는 멤버에게 공개되지 않아요.',
    '인원과 참가비를 정하면 바로 모집이 시작돼요.',
  ];

  return (
    <Modal visible={open} animationType="slide" onRequestClose={goBack}>
      <KeyboardAware style={{ flex: 1, backgroundColor: colors.surface }}>
        <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top }}>
          {/* 상단바 — ‹(이전/닫기) */}
          <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8} onPress={goBack} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Icons.chevLeft size={24} color={colors.text} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 13.5, fontWeight: '800', color: colors.text }}>새 모임</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={8} onPress={onClose} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
              <Icons.close size={20} color={colors.mute} />
            </Pressable>
          </View>
          {/* 진행 바 */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>
            <View style={{ height: 4, borderRadius: 99, backgroundColor: colors.lineSoft, overflow: 'hidden' }}>
              <View style={{ width: `${((step + 1) / WIZARD_STEPS) * 100}%`, height: '100%', borderRadius: 99, backgroundColor: colors.primary }} />
            </View>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontSize: 21.5, fontWeight: '800', color: colors.text, letterSpacing: -0.6 }}>{STEP_TITLES[step]}</Text>
            <Text style={{ fontSize: 11.5, color: colors.sub, marginTop: 8, marginBottom: 24, lineHeight: 17 }}>{STEP_DESCS[step]}</Text>

            {/* ── 0. 카테고리 — 아코디언 그룹 ─────────────────────────────── */}
            {step === 0 && (
              <View>
                {CAT_WIZARD_GROUPS.map((g) => {
                  const opened = openGroup === g.label;
                  const containsSel = !!cat && g.cats.includes(cat);
                  const single = g.cats.length === 1;
                  return (
                    <View
                      key={g.label}
                      style={{
                        borderWidth: 1, borderColor: containsSel ? colors.primary : colors.line,
                        backgroundColor: opened || containsSel ? colors.bgSoft : colors.surface,
                        borderRadius: 14, marginBottom: 10, overflow: 'hidden',
                      }}
                    >
                      <Pressable
                        onPress={() => {
                          if (single) { setCat(g.cats[0]); setOpenGroup(null); return; }
                          setOpenGroup(opened ? null : g.label);
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}
                      >
                        <Text style={{ fontSize: 20 }}>{g.emoji}</Text>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.text }}>{g.label}</Text>
                          <Text style={{ fontSize: 11, color: colors.sub, marginTop: 3 }}>{g.desc}</Text>
                        </View>
                        {single ? (
                          containsSel && <Icons.check size={18} color={colors.primary} />
                        ) : (
                          <View style={{ transform: [{ rotate: opened ? '-90deg' : '90deg' }] }}>
                            <Icons.chev size={16} color={colors.mute} />
                          </View>
                        )}
                      </Pressable>
                      {opened && !single && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 16 }}>
                          {g.cats.map((c) => (
                            <Chip key={c} active={cat === c} onPress={() => setCat(c)}>{c}</Chip>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
                {/* 기타 — 직접 입력 */}
                <View
                  style={{
                    borderWidth: 1, borderColor: cat === '기타' ? colors.primary : colors.line,
                    backgroundColor: cat === '기타' ? colors.bgSoft : colors.surface,
                    borderRadius: 14, marginBottom: 10, overflow: 'hidden',
                  }}
                >
                  <Pressable
                    onPress={() => { setCat(cat === '기타' ? '' : '기타'); setOpenGroup(null); }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}
                  >
                    <Icons.edit size={22} color={colors.sub} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.text }}>기타</Text>
                      <Text style={{ fontSize: 11, color: colors.sub, marginTop: 3 }}>원하는 주제를 직접 적어주세요</Text>
                    </View>
                    {cat === '기타' && <Icons.check size={18} color={colors.primary} />}
                  </Pressable>
                  {cat === '기타' && (
                    <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                      <TextInput
                        value={customCat}
                        onChangeText={(t) => setCustomCat(t.slice(0, 10))}
                        placeholder="카테고리 직접 입력 (예: 명상)"
                        placeholderTextColor={colors.mute}
                        style={{
                          height: 46, paddingHorizontal: 14,
                          borderWidth: 1.5, borderColor: customCat.trim() ? colors.primary : colors.line,
                          borderRadius: radius.md, fontSize: 12.5, fontWeight: '600', color: colors.text,
                          backgroundColor: colors.surface,
                        }}
                      />
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* ── 1. 소개 — 사진·제목·소개글 ──────────────────────────────── */}
            {step === 1 && (
              <View>
                {uploadingCount > 0 && (
                  <Text style={{ fontSize: 10, color: colors.sub, marginBottom: 6 }}>사진 업로드 중… 잠시만요</Text>
                )}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
                    const uri = photos[i];
                    const isCover = i === 0;
                    return (
                      <View key={i} style={{ position: 'relative', flex: 1, aspectRatio: 1 }}>
                        {uri ? (
                          <>
                            <View style={{ flex: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.bgSoft, borderWidth: isCover ? 2 : 0, borderColor: colors.primary }}>
                              <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                            </View>
                            <Pressable
                              onPress={() => setPhotos((p) => p.filter((_x, idx) => idx !== i))}
                              style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Icons.close size={13} color={colors.bg} />
                            </Pressable>
                            {isCover && (
                              <View style={{ position: 'absolute', bottom: 6, left: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.primary }}>
                                <Text style={{ fontSize: 8, fontWeight: '800', color: colors.bg }}>대표</Text>
                              </View>
                            )}
                          </>
                        ) : (
                          <Pressable
                            disabled={photoBusy}
                            onPress={pickPhoto}
                            style={{ flex: 1, borderRadius: radius.md, borderWidth: 1.5, borderColor: isCover ? colors.primary : colors.line, borderStyle: 'dashed', backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 3, opacity: photoBusy ? 0.5 : 1 }}
                          >
                            <Icons.plus size={18} color={isCover ? colors.primary : colors.sub} />
                            <Text style={{ fontSize: 9, fontWeight: '700', color: isCover ? colors.primary : colors.sub }}>사진</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
                <Text style={{ marginTop: 8, fontSize: 10, color: colors.mute }}>
                  사진은 선택이에요. 첫 번째 사진이 모임 카드의 대표 이미지가 돼요.
                </Text>

                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="모임 제목 (예: 성수 와인바 가볍게 한 잔)"
                  placeholderTextColor={colors.mute}
                  style={{
                    marginTop: 18, height: 52, paddingHorizontal: 16,
                    borderWidth: 1.5, borderColor: title.trim() ? colors.primary : colors.line,
                    borderRadius: radius.md, fontSize: 13.5, fontWeight: '700', color: colors.text,
                  }}
                />
                <Text style={{ marginTop: 6, fontSize: 10, color: colors.mute }}>제목은 간결할수록 눈에 잘 띄어요.</Text>

                <TextInput
                  value={desc}
                  onChangeText={setDesc}
                  placeholder={'소개글을 입력해 주세요 (선택)\n어떤 분위기의 모임인지, 무엇을 하는지 적으면 신청률이 올라가요.'}
                  placeholderTextColor={colors.mute}
                  multiline
                  style={{
                    marginTop: 14, minHeight: 160, padding: 16,
                    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bgSoft,
                    borderRadius: radius.md, fontSize: 12.5, color: colors.text,
                    textAlignVertical: 'top', lineHeight: 19,
                  }}
                />
              </View>
            )}

            {/* ── 2. 일시 ─────────────────────────────────────────────────── */}
            {step === 2 && (
              <View>
                <RowButton
                  icon={<Icons.calendar size={18} color={startAt ? colors.primary : colors.mute} />}
                  text={whenDisplay || '날짜·시간 선택'}
                  placeholder={!startAt}
                  onPress={() => setTimeOpen(true)}
                />
                <View style={{ marginTop: 16, padding: 14, borderRadius: radius.md, backgroundColor: colors.bgSoft }}>
                  <Text style={{ fontSize: 11, color: colors.sub, lineHeight: 16 }}>
                    참여 신청이 들어오면 알림으로 알려드려요. 호스트가 승인해야 자리가 채워집니다.
                  </Text>
                </View>
              </View>
            )}

            {/* ── 3. 장소 — 지역 + 상호 검색/직접 주소 ────────────────────── */}
            {step === 3 && (
              <View>
                <Section label="지역">
                  <RowButton
                    icon={<Icons.pin size={18} color={region ? colors.primary : colors.mute} />}
                    text={region ?? '지역 선택'}
                    placeholder={!region}
                    onPress={() => setRegionOpen(true)}
                  />
                </Section>

                <Section label="장소 (선택)">
                  {placeInfo ? (
                    <View
                      style={{
                        padding: 12, paddingHorizontal: 14,
                        backgroundColor: colors.primarySoft, borderRadius: radius.md,
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                      }}
                    >
                      <Icons.pin size={18} color={colors.primary} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.text }}>{placeInfo.name}</Text>
                        {!!placeInfo.address && (
                          <Text style={{ fontSize: 11, color: colors.sub, marginTop: 2 }}>{placeInfo.address}</Text>
                        )}
                      </View>
                      <Pressable
                        onPress={() => { setPlaceInfo(null); }}
                        style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Icons.close size={16} color={colors.mute} />
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TextInput
                          value={placeQuery}
                          onChangeText={setPlaceQuery}
                          placeholder="매장명·상호명 검색 (예: 성수 감성타코)"
                          placeholderTextColor={colors.mute}
                          returnKeyType="search"
                          onSubmitEditing={searchPlace}
                          style={{
                            flex: 1, fontSize: 12.5, color: colors.text,
                            paddingVertical: 10, paddingHorizontal: 14,
                            backgroundColor: colors.bgSoft, borderRadius: radius.md, minHeight: 44,
                          }}
                        />
                        <View style={{ minWidth: 72 }}>
                          <Btn kind="line" size="sm" full disabled={placeBusy || !placeQuery.trim()} onPress={searchPlace}>
                            {placeBusy ? '검색 중…' : '검색'}
                          </Btn>
                        </View>
                      </View>

                      {placeResults.length > 0 && (
                        <View style={{ marginTop: 8, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, overflow: 'hidden' }}>
                          {placeResults.map((r, i) => (
                            <Pressable
                              key={i}
                              onPress={() => selectPlace(r)}
                              style={{
                                padding: 12, paddingHorizontal: 14, backgroundColor: colors.surface,
                                borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft,
                              }}
                            >
                              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.text }} numberOfLines={1}>{r.name}</Text>
                              <Text style={{ fontSize: 11, color: colors.sub, marginTop: 2 }} numberOfLines={1}>
                                {r.roadAddress || r.address || '주소 정보 없음'}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                      {placeSearched && placeResults.length === 0 && (
                        <Text style={{ fontSize: 11, color: colors.mute, marginTop: 8 }}>
                          검색 결과가 없어요. 아래에 모임 주소를 직접 입력해주세요.
                        </Text>
                      )}

                      <Text style={{ fontSize: 11, color: colors.mute, marginTop: 14, marginBottom: 6 }}>
                        상호명을 모르시나요? 모임 주소를 직접 입력하세요.
                      </Text>
                      <TextInput
                        value={manualAddr}
                        onChangeText={setManualAddr}
                        placeholder="예: 서울 성동구 성수동2가 000-0"
                        placeholderTextColor={colors.mute}
                        style={{
                          fontSize: 12.5, color: colors.text,
                          paddingVertical: 10, paddingHorizontal: 14,
                          backgroundColor: colors.bgSoft, borderRadius: radius.md, minHeight: 44,
                        }}
                      />
                    </>
                  )}
                </Section>
                <View style={{ marginTop: 16, padding: 14, borderRadius: radius.md, backgroundColor: colors.bgSoft }}>
                  <Text style={{ fontSize: 11, color: colors.sub, lineHeight: 16 }}>
                    정원이 차면 시간·장소가 참여자에게 공개됩니다.
                  </Text>
                </View>
              </View>
            )}

            {/* ── 4. 모집 — 인원·성비 + 참가비 ────────────────────────────── */}
            {step === 4 && (
              <View>
                <Section label="성별 구성">
                  <Segmented
                    options={[
                      { key: 'any', label: '상관없음' },
                      { key: 'split', label: '성비 매칭' },
                    ]}
                    value={genderMode}
                    onChange={(k) => setGenderMode(k as GenderMode)}
                  />
                </Section>

                {genderMode === 'split' ? (
                  <Section label="성비">
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                        <Chip key={n} active={ratioN === n} onPress={() => setRatioN(n)}>
                          {n}:{n}
                        </Chip>
                      ))}
                    </View>
                    <Stepper value={ratioN} min={1} max={RATIO_MAX} onChange={setRatioN} />
                    <Text style={{ fontSize: 11, color: colors.sub, marginTop: 8 }}>
                      남 {ratioN} · 여 {ratioN} (최대 {RATIO_MAX}:{RATIO_MAX})
                    </Text>
                  </Section>
                ) : (
                  <Section label="모집 인원 (호스트 포함)">
                    <Stepper
                      value={capacity}
                      min={2}
                      max={32}
                      onChange={setCapacity}
                    />
                    <Text style={{ fontSize: 11, color: colors.sub, marginTop: 8 }}>2명이면 1:1 · 최대 32명</Text>
                  </Section>
                )}

                <Section label="참가비">
                  <Segmented
                    options={[
                      { key: 'no', label: '없음' },
                      { key: 'yes', label: '있음' },
                    ]}
                    value={hasFee ? 'yes' : 'no'}
                    onChange={(k) => {
                      const on = k === 'yes';
                      setHasFee(on);
                      if (!on) { setFee('0'); setFeeDesc(''); }
                      else if (feeNum <= 0) setFee('');
                    }}
                  />
                  {hasFee && (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                        <TextInput
                          value={fee}
                          onChangeText={setFee}
                          keyboardType="numeric"
                          placeholder="금액을 입력해 주세요"
                          placeholderTextColor={colors.mute}
                          style={{
                            flex: 1, fontSize: 12.5, color: colors.text,
                            paddingVertical: 10, paddingHorizontal: 14,
                            backgroundColor: colors.bgSoft, borderRadius: radius.md, minHeight: 44,
                          }}
                        />
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.sub }}>원</Text>
                      </View>
                      <TextInput
                        value={feeDesc}
                        onChangeText={setFeeDesc}
                        placeholder="참가비 사용처 (예: 공간 대여비, 노쇼 방지비, 재료비)"
                        placeholderTextColor={colors.mute}
                        multiline
                        style={{
                          marginTop: 10, fontSize: 12.5, color: colors.text,
                          paddingVertical: 10, paddingHorizontal: 14,
                          backgroundColor: colors.bgSoft, borderRadius: radius.md,
                          minHeight: 72, textAlignVertical: 'top',
                        }}
                      />
                    </>
                  )}
                </Section>

                <View
                  style={{
                    marginTop: 22, padding: 14,
                    backgroundColor: colors.primarySoft, borderRadius: radius.md,
                    flexDirection: 'row', gap: 10,
                  }}
                >
                  <Icons.shield size={18} color={colors.primary} />
                  <Text style={{ flex: 1, fontSize: 11, lineHeight: 16, color: colors.primaryDark, fontWeight: '600' }}>
                    모임이 만들어지면 본인이 호스트로 자동 등록돼요. 신청은 호스트 승인제로 진행됩니다.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {/* 하단 이전/다음 */}
          <View
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              paddingHorizontal: 16, paddingTop: 11, paddingBottom: bottomBarPad(insets.bottom),
              backgroundColor: colors.surface,
              borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft,
            }}
          >
            {!stepOk && !!stepHint && (
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary, textAlign: 'center', marginBottom: 9 }}>
                {stepHint}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 9 }}>
              {step > 0 && (
                <Pressable
                  onPress={goBack}
                  style={{
                    flex: 0.7, height: 50, borderRadius: 10, borderWidth: 1,
                    borderColor: colors.line, backgroundColor: colors.surface,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text }}>이전</Text>
                </Pressable>
              )}
              <Pressable
                onPress={goNext}
                disabled={!stepOk}
                style={{
                  flex: 1.5, height: 50, borderRadius: 10,
                  backgroundColor: colors.primary, opacity: stepOk ? 1 : 0.3,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#fff' }}>
                  {step === WIZARD_STEPS - 1 ? (busy ? '만드는 중…' : '모임 만들기') : '다음'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAware>

      <RegionPicker
        visible={regionOpen}
        value={region}
        onSelect={setRegion}
        onClose={() => setRegionOpen(false)}
      />
      <DateTimePicker
        visible={timeOpen}
        value={startAt}
        onConfirm={(iso) => {
          setStartAt(iso);
          setWhenDisplay(isoToDisplay(iso));
        }}
        onClose={() => setTimeOpen(false)}
      />
    </Modal>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.sub, marginBottom: 8 }}>{label}</Text>
      {children}
    </View>
  );
}

function Segmented({
  options, value, onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.bgSoft,
        borderRadius: radius.md,
        padding: 4,
        gap: 4,
      }}
    >
      {options.map((o) => {
        const active = value === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              height: 40,
              borderRadius: radius.sm + 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? colors.surface : 'transparent',
              borderWidth: active ? 1 : 0,
              borderColor: colors.line,
            }}
          >
            <Text style={{ fontSize: 12.5, fontWeight: active ? '800' : '600', color: active ? colors.text : colors.sub }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// −/+ 스테퍼 + 숫자 직접 입력. 입력 중 빈 문자열 허용, blur 시 [min,max]로 클램프.
function Stepper({
  value, min, max, onChange,
}: {
  value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);  // 편집 중 임시 문자열
  const btn = (label: string, disabled: boolean, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, lineHeight: 20 }}>{label}</Text>
    </Pressable>
  );
  function commit() {
    if (draft === null) return;
    const n = parseInt(draft, 10);
    onChange(isNaN(n) ? min : Math.max(min, Math.min(max, n)));
    setDraft(null);
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      {btn('−', value <= min, () => { setDraft(null); onChange(Math.max(min, value - 1)); })}
      <TextInput
        value={draft ?? String(value)}
        onChangeText={(t) => setDraft(t.replace(/[^0-9]/g, '').slice(0, 2))}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType="number-pad"
        selectTextOnFocus
        style={{
          fontSize: 16, fontWeight: '800', color: colors.text,
          minWidth: 44, textAlign: 'center', paddingVertical: 8,
          borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.md,
          backgroundColor: colors.bgSoft,
        }}
      />
      {btn('+', value >= max, () => { setDraft(null); onChange(Math.min(max, value + 1)); })}
    </View>
  );
}

function RowButton({
  icon, text, placeholder, onPress,
}: {
  icon: React.ReactNode; text: string; placeholder?: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        minHeight: 48,
        backgroundColor: colors.bgSoft,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.line,
      }}
    >
      {icon}
      <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: placeholder ? colors.mute : colors.text }}>
        {text}
      </Text>
      <Icons.chev size={18} color={colors.mute} />
    </Pressable>
  );
}

