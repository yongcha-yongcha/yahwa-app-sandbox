// 야화 — 커뮤니티 이야기 쓰기 · 수정(리뉴얼 1120, 시안 compose-post · spec-rest §3.6 · §9.1)
// 쌓이는 화면(시안 compose-tools C3 · C, 11-22): 머리 줄 "이야기 쓰기"(고칠 때 "이야기 수정하기") + 오른쪽 [올리기] 글자 버튼
// → 종이(회색 카드 · 모서리 16 · 안쪽 16/20/10): 글 칸 최소 10줄(고운바탕 16/32 · 줄마다 1px 줄)에서 글만큼 늘어나고, 화면 끝에 닿으면 종이 안에서 넘겨 본다
//   종이 아래쪽: 사진 줄(72×72 · 빼기 ×) · 음성 재생 줄 · 오늘 날짜. 키보드가 올라와 있으면 썸네일 36 · 음성 알약으로 접어 날짜와 한 줄
// → 화면 맨 아래 아이콘 줄[사진 n/3 · 마이크](48). 키보드가 올라오면 키보드 바로 위에 붙는다(KeyboardAware).
// 음성은 '음성 남기기' 시트에서 녹음한다. 녹음 파일은 [올리기] 때만 올린다(뺀 녹음은 올리지 않음).
// 제목 칸 없이 본문 첫 줄을 제목으로 저장한다(목록·알림 호환). 욕설·비속어는 기존처럼 가린 뒤 등록.
// 사진 3장 · 음성 90초 제한은 지금 정책 그대로(§13-7). 닫아도 새 글 초안은 남고, 올리면 비운다.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, View, Text, Pressable, TextInput, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { colors, fontSerif, layout, radius } from '../tokens';
import { Icon, TopBar } from '../ui';
import { previewActions, previewSelectors, usePreview, getCurrentUserId } from '../lib/previewStore';
import { useAddLoungePostMutation } from '../lib/hooks';
import { pickAndUploadPhoto } from '../lib/photoUpload';
import { audioAvailable, uploadAudio } from '../lib/audioMessage';
import { celebrateNewMissions } from '../lib/missions';
import { censorText } from '../lib/profanity';
import { friendlyError } from '../lib/errors';
import { thumbUrl } from '../lib/img';
import { KeyboardAware, useKeyboardHeight } from '../components/KeyboardAware';
import { editLoungePost } from '../lib/communityApi';
import { rulePitch } from '../lib/appFont';
import type { LoungePost } from '../data/mock';
import { postBody } from './Lounge';
import { CIcon, PlayGlyph } from '../components/community/cIcons';
import { SiteAudio } from '../components/community/SiteAudio';
import { PageModal } from '../components/community/PageModal';
import { RecordSheet, type Clip } from '../components/community/RecordSheet';
import { PHOTO_CHIP } from '../components/community/tone';

const MAX_PHOTOS = 3;
const MAX_LEN = 3000;
const LINE = 32;
const PITCH = rulePitch(LINE, true);   // 밑줄 간격 — 글 줄 높이가 실제로 그려지는 px에 맞춘 값(안드로이드)
const MIN_LINES = 10;   // 글 칸 최소 10줄(320) — 원래 시안 값

export function LoungeWrite({ open, onClose, onPosted, edit }: { open: boolean; onClose: () => void; onPosted?: () => void; edit?: LoungePost | null }) {
  const myProfile = usePreview(previewSelectors.myProfile);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [audio, setAudio] = useState<Clip | null>(null);
  const [busy, setBusy] = useState(false);          // 사진 올리는 중 · 음성 올리는 중
  const [recOpen, setRecOpen] = useState(false);    // 음성 남기기 시트
  const [err, setErr] = useState('');
  const canAudio = audioAvailable();  // 모듈이 없는 구빌드에서는 음성 버튼을 숨긴다
  const addMut = useAddLoungePostMutation();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  // 열리면 바로 쓸 수 있게 — 화면이 다 밀려 들어온 뒤(300ms)에 본문 칸으로(키보드가 전환과 겹쳐 끊기지 않게)
  const editorRef = useRef<TextInput>(null);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => editorRef.current?.focus(), 320);
    return () => clearTimeout(t);
  }, [open]);
  // 글 수정 — 열 때 그 글로 채운다
  useEffect(() => {
    if (!open || !edit) return;
    setBody(postBody(edit)); setPhotos((edit.attachments ?? []).filter(Boolean));
    setAudio(edit.audioUrl ? { uri: edit.audioUrl, duration: edit.audioDuration ?? 0, remote: true } : null);
    setErr('');
  }, [open, edit?.id]);  // eslint-disable-line react-hooks/exhaustive-deps
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // 닫아도 새 글 초안은 남긴다
  function close() {
    setRecOpen(false);
    setErr('');
    if (edit) reset();  // 수정은 닫으면 버린다(새 글 초안에 섞이지 않게)
    onClose();
  }

  async function pickPhoto() {
    if (photos.length >= MAX_PHOTOS || busy) return;
    const uid = getCurrentUserId();
    if (!uid) { setErr('사진 첨부는 로그인 후 가능해요.'); return; }
    setErr(''); setBusy(true);
    try {
      const url = await pickAndUploadPhoto(uid);
      if (url && alive.current) setPhotos((prev) => (prev.length >= MAX_PHOTOS ? prev : [...prev, url]));
    } catch {
      if (alive.current) setErr('사진을 불러오지 못했어요.');
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  function reset() {
    setBody(''); setPhotos([]); setAudio(null); setErr('');
  }

  async function submit() {
    if (addMut.isPending || saving || busy) return;
    const text = body.trim();
    if (!text && !photos.length && !audio) return;
    const uid = getCurrentUserId();
    if (!uid) { setErr('글쓰기는 로그인 후 가능해요.'); return; }
    setErr('');
    let audioUrl: string | null = null;
    if (audio) {
      setBusy(true);
      audioUrl = audio.remote ? audio.uri : await uploadAudio(uid, audio.uri);
      if (!alive.current) return;
      setBusy(false);
      if (!audioUrl) { setErr('음성을 올리지 못했어요. 다시 시도해주세요.'); return; }
    }
    if (edit) {
      // 글 수정 — 본인 글 update(0002). 저장하면 게시글로 돌아간다
      setSaving(true);
      try {
        const r = await editLoungePost(edit.id, { body: text, attachments: photos, audioUrl, audioDuration: audio ? audio.duration : null });
        await Promise.all([qc.invalidateQueries({ queryKey: ['lounge'] }), qc.invalidateQueries({ queryKey: ['lounge-post', edit.id] })]);
        if (!alive.current) return;
        reset(); onClose();
        previewActions.showToast(r.censored ? '글을 수정했어요. 일부 표현은 가려졌어요.' : '글을 수정했어요.');
      } catch (e: any) {
        setErr(friendlyError(e, '글을 수정하지 못했어요').message);
      } finally {
        if (alive.current) setSaving(false);
      }
      return;
    }
    const clean = censorText(text);
    // 첫 줄을 제목으로(최대 40자) — 목록은 본문이 제목으로 시작하면 본문만 보여준다
    const title = Array.from(clean.text.split('\n')[0]).slice(0, 40).join('');  // 이모지가 반으로 잘리지 않게
    try {
      await addMut.mutateAsync({
        cat: 'free', title, body: clean.text,
        authorGender: (myProfile.gender as 'M' | 'F' | null) ?? null,
        attachments: photos,
        audioUrl,
        audioDuration: audio ? audio.duration : null,
      });
    } catch (e: any) {
      setErr(friendlyError(e, '글을 올리지 못했어요').message);
      return;
    }
    reset();
    onClose();
    onPosted?.();
    // 하루 첫 글 1리프(서버 0167) — 받았으면 '미션 성공!', 아니면 "글을 올렸어요."
    void celebrateNewMissions().then((g) => {
      if (!g) previewActions.showToast(clean.censored ? '글을 올렸어요. 일부 표현은 가려졌어요.' : '글을 올렸어요.');
    });
  }

  const canSubmit = !busy && !saving && !addMut.isPending && (!!body.trim() || photos.length > 0 || !!audio);
  const webNoOutline = Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none' } as any) : null;
  const kb = useKeyboardHeight(open) > 0;
  const insets = useSafeAreaInsets();
  const [inputH, setInputH] = useState(PITCH);    // 글 높이(줄 수만큼 줄을 긋는다)
  const scrollRef = useRef<ScrollView>(null);
  const atEnd = useRef(true);                    // 글 끝에서 쓰는 중이면 늘어날 때 끝을 따라간다
  const areaMin = PITCH * MIN_LINES;
  const lineCount = Math.max(MIN_LINES, Math.round(inputH / PITCH));
  const photoFull = photos.length >= MAX_PHOTOS;
  const today = new Date(Date.now() + 9 * 3600_000);
  const dateText = `${today.getUTCMonth() + 1}월 ${today.getUTCDate()}일`;
  const dateStyle = { fontSize: 12, lineHeight: 16, color: colors.mute } as const;

  return (
    <PageModal open={open} onRequestClose={close}>
      <KeyboardAware style={{ flex: 1 }}>
        <TopBar
          title={edit ? '이야기 수정하기' : '이야기 쓰기'}
          onBack={close}
          right={<SubmitText label={edit ? '고치기' : '올리기'} disabled={!canSubmit} loading={saving || addMut.isPending || busy} onPress={submit} />}
        />
        <View style={{ flex: 1, paddingTop: 16, paddingHorizontal: layout.gutter, paddingBottom: 16 }}>
          {/* 종이 — 글 칸 최소 10줄에서 시작해 글만큼 늘어난다. 화면(키보드가 올라와 있으면 키보드 위)에 닿으면 멈추고 종이 안에서 넘겨 본다.
              그래서 사진 · 음성 · 날짜(종이 아래쪽)는 키보드가 올라와도 보인다 */}
          <View style={{ flexShrink: 1, borderRadius: radius.card, backgroundColor: colors.bgSoft, paddingTop: 16, paddingHorizontal: 20, paddingBottom: 10 }}>
            <ScrollView
              ref={scrollRef}
              style={{ flexGrow: 0, flexShrink: 1 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={{ minHeight: areaMin }}>
                {/* 줄 — 32 간격 · 1px #CFD5DA(글과 함께 스크롤) · 최소 10줄, 글이 길면 그만큼 */}
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0 }}>
                  {Array.from({ length: lineCount }).map((_, i) => (
                    <View key={i} style={{ height: PITCH, borderBottomWidth: 1, borderBottomColor: colors.control }} />
                  ))}
                </View>
                <TextInput
                  ref={editorRef}
                  value={body}
                  onChangeText={setBody}
                  accessibilityLabel="이야기"
                  // 줄 노트(32 간격 고정) 위 글 — 휴대폰 글자 크기를 줄여도 줄 높이가 같이 줄지 않게(줄어들면 밑줄과 어긋난다)
                  allowFontScaling={false}
                  multiline
                  scrollEnabled={false}
                  maxLength={MAX_LEN}
                  placeholder={'오늘 나누고 싶은 이야기를 남겨 주세요.\n서로를 존중하는 이야기를 남겨 주세요.'}
                  placeholderTextColor={colors.mute}
                  cursorColor={colors.focus}
                  selectionColor={colors.focus}
                  onSelectionChange={(e) => { atEnd.current = e.nativeEvent.selection.end >= body.length; }}
                  onContentSizeChange={(e) => {
                    const h = Math.max(PITCH, Math.ceil(e.nativeEvent.contentSize.height / PITCH - 0.01) * PITCH);
                    if (h > inputH && atEnd.current) requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
                    setInputH(h);
                  }}
                  style={[{ minHeight: areaMin, padding: 0, paddingTop: 0, paddingBottom: 0, fontFamily: fontSerif, fontSize: 16, lineHeight: LINE, color: colors.text, textAlignVertical: 'top' }, Platform.OS === 'web' ? { height: Math.max(areaMin, inputH) } : null, webNoOutline]}
                />
              </View>
            </ScrollView>

            {kb ? (
              // 쓰는 동안(키보드 올림) — 사진 썸네일 36 · 음성 알약으로 접어 날짜와 한 줄. 누르면 키보드를 내려 펼친다
              <Pressable onPress={Keyboard.dismiss} accessibilityRole="button" accessibilityLabel="첨부 펼쳐 보기" style={{ marginTop: 8, height: 40, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {photos.map((uri, i) => (
                  <Image key={uri + i} source={{ uri: thumbUrl(uri, 120) ?? uri }} style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.muted }} contentFit="cover" accessibilityLabel={`첨부 사진 ${i + 1}`} />
                ))}
                {audio && (
                  <View style={{ marginLeft: photos.length ? 4 : 0, height: 30, paddingLeft: 8, paddingRight: 12, borderRadius: 15, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <PlayGlyph size={14} color={colors.text} />
                    <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{mss(audio.duration)}</Text>
                  </View>
                )}
                <Text style={[dateStyle, { marginLeft: 'auto' }]}>{dateText}</Text>
              </Pressable>
            ) : (
              <>
                {/* 사진 줄 — 72×72 · 모서리 12 · 사이 8 / 오른쪽 위 빼기(터치 32 · 검정 45% 원 20 + 흰 ×) */}
                {photos.length > 0 && (
                  <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
                    {photos.map((uri, i) => (
                      <View key={uri + i} style={{ width: 72, height: 72 }}>
                        <Image source={{ uri: thumbUrl(uri, 240) ?? uri }} style={{ width: 72, height: 72, borderRadius: radius.field, backgroundColor: colors.muted }} contentFit="cover" accessibilityLabel={`첨부 사진 ${i + 1}`} />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`첨부 사진 ${i + 1} 빼기`}
                          onPress={() => setPhotos((p) => p.filter((_, idx) => idx !== i))}
                          style={{ position: 'absolute', top: 0, right: 0, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}
                        >
                          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: PHOTO_CHIP, alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name="close" size={12} color={colors.inverse} />
                          </View>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
                {/* 음성 — 재생 줄(흰 바탕) + 빼기 */}
                {audio && <SiteAudio url={audio.uri} durationSec={audio.duration} tone="paper" onRemove={() => setAudio(null)} style={{ marginTop: 12 }} />}
                <Text style={[dateStyle, { marginTop: 6, textAlign: 'right' }]}>{dateText}</Text>
              </>
            )}
          </View>
          {!!err && <Text accessibilityRole="alert" style={{ marginTop: 8, fontSize: 12, lineHeight: 18, color: colors.danger }}>{err}</Text>}
        </View>

        {/* 아이콘 줄 — 화면 맨 아래(높이 48 · 위 1px 선). 키보드가 올라오면 키보드 바로 위에 붙는다. 못 누르면 #B5BDC4 */}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.bg, paddingLeft: 10, paddingRight: layout.gutter, paddingBottom: kb ? 0 : insets.bottom }}>
          <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Pressable onPress={pickPhoto} disabled={busy || photoFull} accessibilityRole="button" accessibilityLabel={`사진 넣기 · ${photos.length}/${MAX_PHOTOS}`} accessibilityState={{ disabled: busy || photoFull }} style={({ pressed }) => ({ height: 44, minWidth: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
              <Icon name="image" size={24} color={photoFull ? colors.chevron : colors.textSecondary} />
              <Text style={{ fontSize: 13, lineHeight: 16, fontWeight: '500', color: photoFull ? colors.chevron : colors.textSecondary, fontVariant: ['tabular-nums'] }}>{photos.length}/{MAX_PHOTOS}</Text>
            </Pressable>
            {canAudio && (
              <Pressable onPress={() => { setErr(''); setRecOpen(true); }} disabled={busy || !!audio} accessibilityRole="button" accessibilityLabel="음성 남기기" accessibilityState={{ disabled: busy || !!audio }} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
                <CIcon name="mic" size={24} color={audio ? colors.chevron : colors.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAware>
      <RecordSheet open={recOpen} onClose={() => setRecOpen(false)} onDone={setAudio} />
    </PageModal>
  );
}

// [올리기] — 머리 줄 오른쪽 글자 버튼(누르는 칸 44 · 16 600). 켜짐: 강조 파랑 / 꺼짐: #B5BDC4 / 올리는 중: 돌림
function SubmitText({ label, disabled, loading, onPress }: { label: string; disabled: boolean; loading: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, busy: loading }} hitSlop={8} style={({ pressed }) => ({ minWidth: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      {loading ? <ActivityIndicator size="small" color={colors.accent} /> : (
        <Text style={{ fontSize: 16, lineHeight: 20, fontWeight: '600', color: disabled ? colors.chevron : colors.accent }}>{label}</Text>
      )}
    </Pressable>
  );
}

const mss = (s: number) => { const r = Math.max(0, Math.round(s)); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`; };
