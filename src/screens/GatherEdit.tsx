// 야화 — 모임 편집 (호스트 전용, 대표 지시 0903)
// 생성 위저드(GatherCreate)와 달리 '내용'만 한 화면에서 고친다.
// 정원·성비·참가비는 이미 신청한 사람의 전제를 뒤집으므로 편집 대상이 아니다
// (서버도 0125 트리거로 거부한다).
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../tokens';
import { Icons } from '../icons';
import { Btn, NavBar } from '../components/atoms';
import { KeyboardAware } from '../components/KeyboardAware';
import { bottomBarPad } from '../lib/layout';
import { RegionPicker } from '../components/RegionPicker';
import { DateTimePicker } from '../components/DateTimePicker';
import { useGatheringFull, useUpdateGatheringMutation } from '../lib/hooks';
import { getCurrentUserId, previewActions } from '../lib/previewStore';
import { pickPhoto as pickImageFile, uploadPhotoToStorage } from '../lib/photoUpload';
import { ALL_CATEGORIES } from '../data/categories';

const MAX_PHOTOS = 3;
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

function isoToDisplay(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEK[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function GatherEdit({ open, gatheringId, onClose, onSaved }: {
  open: boolean;
  gatheringId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const q = useGatheringFull(gatheringId);
  const raw = q.data as any;
  const insets = useSafeAreaInsets();
  const updateMut = useUpdateGatheringMutation();

  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState('');
  const [catOpen, setCatOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [region, setRegion] = useState<string | null>(null);
  const [regionOpen, setRegionOpen] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [startAt, setStartAt] = useState<string | null>(null);
  const [whenDisplay, setWhenDisplay] = useState('');
  const [timeOpen, setTimeOpen] = useState(false);

  // 서버 값으로 1회 초기화 (열릴 때마다 최신값)
  React.useEffect(() => {
    if (!open) { setReady(false); return; }
    if (ready || !raw) return;
    setTitle(raw.title ?? '');
    setCat(raw.cat ?? '');
    setDesc(raw.description ?? '');
    const ph: string[] = Array.isArray(raw.photos) && raw.photos.length
      ? raw.photos
      : (raw.cover ? [raw.cover] : []);
    setPhotos(ph);
    setRegion(raw.region ?? null);
    setPlaceName(raw.place_name ?? raw.place ?? '');
    setStartAt(raw.start_at ?? null);
    setWhenDisplay(raw.start_at ? isoToDisplay(raw.start_at) : (raw.when_text ?? ''));
    setReady(true);
  }, [open, raw, ready]);

  const isHost = !!raw && raw.host_id === getCurrentUserId();
  const busy = updateMut.isPending;
  const canSave = ready && isHost && !!title.trim() && !!region && !busy && uploadingCount === 0;

  async function addPhoto() {
    if (photos.length >= MAX_PHOTOS) { notify('사진 개수 초과', `사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요`); return; }
    const uid = getCurrentUserId();
    if (!uid) { notify('로그인 필요', '사진 업로드는 로그인 후 가능해요'); return; }
    setPhotoBusy(true);
    let picked;
    try { picked = await pickImageFile(); }
    catch (e: any) { setPhotoBusy(false); notify('사진 선택 실패', e?.message ?? '다시 시도해주세요'); return; }
    setPhotoBusy(false);
    if (!picked || photos.length >= MAX_PHOTOS) return;
    const localUri = picked.uri;
    setPhotos((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, localUri]));
    setUploadingCount((c) => c + 1);
    try {
      const url = await uploadPhotoToStorage(picked, uid);
      setPhotos((prev) => prev.map((u) => (u === localUri ? url : u)));
    } catch (e: any) {
      setPhotos((prev) => prev.filter((u) => u !== localUri));
      notify('업로드 실패', e?.message ?? '잠시 후 다시 시도해주세요');
    } finally {
      setUploadingCount((c) => Math.max(0, c - 1));
    }
  }

  function notify(t: string, m: string) {
    if (Platform.OS === 'web') { try { window.alert(`${t}: ${m}`); } catch { /* ignore */ } }
    else Alert.alert(t, m);
  }

  async function save() {
    if (!canSave) return;
    try {
      await updateMut.mutateAsync({
        id: gatheringId,
        title: title.trim(),
        cat: cat || undefined,
        cover: photos[0] ?? null,
        photos,
        description: desc.trim(),
        region,
        place: placeName.trim() || region || '',
        placeName: placeName.trim() || null,
        ...(startAt ? { startAt, whenText: whenDisplay } : {}),
      });
      previewActions.showToast('모임 정보를 수정했어요', 2000);
      onSaved?.();
      onClose();
    } catch (e: any) {
      notify('수정 실패', e?.message ?? '잠시 후 다시 시도해주세요');
    }
  }

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <KeyboardAware style={{ flex: 1, backgroundColor: colors.bgSoft }}>
        <View style={{ paddingTop: insets.top, backgroundColor: colors.surface }}>
          <NavBar
            title="모임 편집"
            left={
              <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={8} onPress={onClose} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
                <Icons.close size={20} color={colors.text} />
              </Pressable>
            }
          />
        </View>

        {!ready ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !isHost ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <Text style={{ fontSize: 12.5, color: colors.mute }}>호스트만 수정할 수 있어요</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120 }}>
            <Field label="모임 제목">
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="어떤 모임인가요?"
                placeholderTextColor={colors.mute}
                style={inputStyle}
              />
            </Field>

            <Field label="카테고리">
              <Pressable onPress={() => setCatOpen(true)} style={rowBtnStyle}>
                <Text style={{ fontSize: 13.5, color: cat ? colors.text : colors.mute }}>{cat || '카테고리 선택'}</Text>
                <Icons.chevDown size={16} color={colors.mute} />
              </Pressable>
            </Field>

            <Field label={`사진 (${photos.length}/${MAX_PHOTOS}) · 첫 장이 대표`}>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {photos.map((u, i) => (
                  <View key={`${u}_${i}`} style={{ width: 92, height: 92, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.bgSoft }}>
                    <Image source={{ uri: u }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                    <Pressable
                      onPress={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Icons.close size={13} color="#fff" />
                    </Pressable>
                    {i === 0 && (
                      <View style={{ position: 'absolute', left: 4, bottom: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                        <Text style={{ fontSize: 8.5, fontWeight: '800', color: '#fff' }}>대표</Text>
                      </View>
                    )}
                  </View>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <Pressable
                    onPress={addPhoto}
                    disabled={photoBusy}
                    style={{ width: 92, height: 92, borderRadius: 12, borderWidth: 1, borderColor: colors.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                  >
                    {photoBusy ? <ActivityIndicator color={colors.mute} /> : <Icons.plus size={20} color={colors.mute} />}
                    <Text style={{ fontSize: 10, color: colors.mute }}>사진 추가</Text>
                  </Pressable>
                )}
              </View>
            </Field>

            <Field label="날짜·시간">
              <Pressable onPress={() => setTimeOpen(true)} style={rowBtnStyle}>
                <Text style={{ fontSize: 13.5, color: whenDisplay ? colors.text : colors.mute }}>{whenDisplay || '날짜·시간 선택'}</Text>
                <Icons.calendar size={16} color={colors.mute} />
              </Pressable>
            </Field>

            <Field label="지역">
              <Pressable onPress={() => setRegionOpen(true)} style={rowBtnStyle}>
                <Text style={{ fontSize: 13.5, color: region ? colors.text : colors.mute }}>{region || '지역 선택'}</Text>
                <Icons.chevDown size={16} color={colors.mute} />
              </Pressable>
            </Field>

            <Field label="장소 (선택)">
              <TextInput
                value={placeName}
                onChangeText={setPlaceName}
                placeholder="상호명이나 만날 장소"
                placeholderTextColor={colors.mute}
                style={inputStyle}
              />
            </Field>

            <Field label="모임 소개">
              <TextInput
                value={desc}
                onChangeText={setDesc}
                placeholder="어떤 분들과 어떻게 놀고 싶은지 적어주세요"
                placeholderTextColor={colors.mute}
                multiline
                style={[inputStyle, { height: 130, textAlignVertical: 'top', paddingTop: 12 }]}
              />
            </Field>

            <Text style={{ fontSize: 11, color: colors.mute, marginTop: 18, lineHeight: 16 }}>
              정원·성비·참가비는 이미 신청한 분들의 조건이라 여기서 바꿀 수 없어요.
              바꾸려면 모임을 내리고 새로 만들어주세요.
            </Text>
          </ScrollView>
        )}

        {ready && isHost && (
          <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: bottomBarPad(insets.bottom, 12), backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft }}>
            <Btn kind="primary" full size="lg" disabled={!canSave} onPress={save}>
              {busy ? '저장 중…' : uploadingCount > 0 ? '사진 업로드 중…' : '저장'}
            </Btn>
          </View>
        )}

        <RegionPicker
          visible={regionOpen}
          value={region}
          onSelect={(r) => setRegion(r)}
          onClose={() => setRegionOpen(false)}
        />
        <DateTimePicker
          visible={timeOpen}
          value={startAt}
          onConfirm={(iso) => { setStartAt(iso); setWhenDisplay(isoToDisplay(iso)); }}
          onClose={() => setTimeOpen(false)}
        />
        <Modal visible={catOpen} animationType="slide" transparent onRequestClose={() => setCatOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={() => setCatOpen(false)} />
          <View style={{ maxHeight: '70%', backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingBottom: bottomBarPad(insets.bottom, 12) }}>
            <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.text, padding: 18 }}>카테고리</Text>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ALL_CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => { setCat(c); setCatOpen(false); }}
                  style={{ paddingHorizontal: 14, height: 38, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: cat === c ? colors.text : colors.line, backgroundColor: cat === c ? colors.text : colors.surface }}
                >
                  <Text style={{ fontSize: 12, fontWeight: cat === c ? '700' : '500', color: cat === c ? colors.bg : colors.sub }}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Modal>
      </KeyboardAware>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.sub, marginBottom: 8 }}>{label}</Text>
      {children}
    </View>
  );
}

const inputStyle = {
  height: 48,
  paddingHorizontal: 14,
  borderRadius: radius.md,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.line,
  fontSize: 13.5,
  color: colors.text,
} as any;

const rowBtnStyle = {
  height: 48,
  paddingHorizontal: 14,
  borderRadius: radius.md,
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.line,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
} as any;
