// 소개 1/4 — 사진 등록(spec-shell §4.8 · §3-10). 프로필 수정의 '사진 고치기'도 같은 부품을 쓴다.
// 칸 6개(3열 · 3:4 · 모서리 12) · 첫 칸이 대표 · 꾹 눌러 순서 바꾸기 · 더보기 → 사진 관리 시트 · 프로필 기준 보기 시트.
// 올리는 길은 예전 그대로: 대표 사진은 고른 뒤 보이는 부분을 맞추고(PhotoCropper), 올리자마자 자동 검사(face-check — 대표 = 얼굴, 나머지 = 사람).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, ease, radius, shadow, type as typo } from '../../tokens';
import { BottomSheet, BreathingDots, Button, Chip, Icon, SheetButtons, SheetDivider, SheetHeader, SheetRow, T, Tag, haptic, reduceMotion, usePress } from '../../ui';
import { FrameDoodle, MarkGlyph, ThinChevron } from './art';
import { PhotoCropper } from '../PhotoCropper';
import { previewActions, getCurrentUserId } from '../../lib/previewStore';
import { checkProfilePhoto, type PhotoCheck } from '../../lib/api';
import { pickAndUploadPhoto, pickPhoto as pickImageFile, uploadPhotoToStorage, cropPhoto, canCropPhoto, type CropRect, type PickResult } from '../../lib/photoUpload';
import { thumbUrl, CROP_MARK, originalPhoto } from '../../lib/img';

export const MAX_PHOTOS = 6;
export const MIN_PHOTOS = 1;   // 대표 결정(1120): 대표 사진 1장부터 통과
const GAP = 8;

// 사진 거절 안내(자동 검사 결과별)
export function photoRejectText(r: PhotoCheck, main: boolean): string {
  if (r === 'unsafe') return '선정적인 사진은 올릴 수 없어요.';
  if (main || r === 'no_face') return '대표 사진에는 얼굴이 잘 보여야 해요. 얼굴이 잘 보이는 사진으로 바꿔 주세요.';
  return '사람이 나온 사진만 올릴 수 있어요. 본인이 나온 사진을 올려 주세요.';
}

// 공개 URL → profile-photos 버킷 안 경로(uid/시각.jpg)
function storagePath(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/public\/profile-photos\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// 대표 사진 얼굴 확인 — 첫 사진이 바뀔 때마다 바로 검사해서 넘어가기 전에 알려 준다(대표 지시 1010)
export function useMainFace(mainPhoto?: string): 'checking' | 'ok' | 'no' | undefined {
  const [state, setState] = useState<Record<string, 'checking' | PhotoCheck>>({});
  useEffect(() => {
    if (!mainPhoto || state[mainPhoto]) return;
    setState((s) => ({ ...s, [mainPhoto]: 'checking' }));
    checkProfilePhoto(mainPhoto, 'face').then((r) => setState((s) => ({ ...s, [mainPhoto]: r })));
  }, [mainPhoto, state]);
  const raw = mainPhoto ? state[mainPhoto] : undefined;
  return raw === 'checking' || raw === undefined ? raw : raw === 'ok' ? 'ok' : 'no';
}

// ── 프로필 기준 보기 시트(높이 화면 86%) ────────────────────────────────────────
const GUIDE = {
  ok: require('../../../assets/renewal/photo-guide/ok.jpg'),
  mask: require('../../../assets/renewal/photo-guide/mask.jpg'),
  cap: require('../../../assets/renewal/photo-guide/cap.jpg'),
  side: require('../../../assets/renewal/photo-guide/side.jpg'),
  down: require('../../../assets/renewal/photo-guide/down.jpg'),
  far: require('../../../assets/renewal/photo-guide/far.jpg'),
  filter: require('../../../assets/renewal/photo-guide/filter.jpg'),
  anime: require('../../../assets/renewal/photo-guide/anime.jpg'),
} as const;
type GuideKey = keyof typeof GUIDE;
const STANDARDS: [string, [string, GuideKey, '' | 'dark' | 'rot'][]][] = [
  ['얼굴 가림', [['선글라스 · 마스크로 얼굴을 가리지 않게 해 주세요', 'mask', ''], ['모자를 깊게 눌러써서 눈이 가려지지 않게 해 주세요', 'cap', '']]],
  ['정면 미응시', [['옆모습이나 고개를 크게 돌린 사진은 피해 주세요', 'side', ''], ['카메라를 바라보는 사진으로 올려 주세요', 'down', '']]],
  ['얼굴이 너무 작음', [['얼굴이 크게 보이게 가까이서 찍은 사진으로', 'far', '']]],
  ['어둡거나 흐림', [['눈 · 코 · 입이 또렷하게 보이는 밝은 사진으로', 'ok', 'dark']]],
  ['회전된 사진', [['똑바로 세운 사진으로 올려 주세요', 'ok', 'rot']]],
  ['AI 사진 · 보정', [['내 얼굴을 AI로 바꾸거나 AI로 만든 사진은 올릴 수 없어요', 'anime', ''], ['과한 AI 보정 · 필터로 내 얼굴과 구분할 수 없는 사진도 안 돼요', 'filter', '']]],
];

function GuidePhoto({ img, ok, fx }: { img: GuideKey; ok: boolean; fx?: '' | 'dark' | 'rot' }) {
  return (
    <View accessibilityLabel={ok ? '좋은 예' : '피할 예'} style={{ flex: 1, aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.muted }}>
      <Image source={GUIDE[img]} blurRadius={fx === 'dark' ? 2 : 0} contentFit="cover" style={[{ width: '100%', height: '100%' }, fx === 'rot' ? { transform: [{ rotate: '90deg' }, { scale: 1.34 }] } : null]} />
      {fx === 'dark' && <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.62)' }} />}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 12, borderWidth: 2, borderColor: ok ? colors.accent : colors.errorLine }} />
      <View style={{ position: 'absolute', right: 8, bottom: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.inverse, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: ok ? colors.accent : colors.errorLine, alignItems: 'center', justifyContent: 'center' }}><MarkGlyph ok={ok} /></View>
      </View>
    </View>
  );
}

function StandardSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: () => void }) {
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [k, setK] = useState(0);
  const listRef = useRef<ScrollView>(null);
  // 시트 높이 86%에서 손잡이 · 제목 · 칩 · 아래 버튼 · 안쪽 여백을 뺀 만큼이 목록
  const listH = Math.max(160, winH * 0.86 - (24 + 56 + 54 + 8 + 64 + 32 + insets.bottom));
  return (
    <BottomSheet open={open} onClose={onClose} scroll={false}>
      <Text accessibilityRole="header" style={{ marginTop: 4, fontSize: 18, lineHeight: 26.1, fontWeight: '600', color: colors.text }}>얼굴이 잘 보이는 정면 사진으로{'\n'}올려 주세요</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16, marginHorizontal: -20, flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4, gap: 8 }}>
        {STANDARDS.map(([name], i) => (
          <Chip key={name} kind="case" label={name} selected={i === k} onPress={() => { setK(i); listRef.current?.scrollTo({ y: 0, animated: false }); }} />
        ))}
      </ScrollView>
      <ScrollView ref={listRef} style={{ height: listH, marginTop: 8 }} contentContainerStyle={{ paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
        {STANDARDS[k][1].map(([text, img, fx], i) => (
          <View key={text} style={{ paddingTop: 12, paddingBottom: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ width: 20, height: 20, marginTop: 1, borderRadius: 6, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: colors.textSecondary }}>{i + 1}</Text>
              </View>
              <T style={{ flex: 1, fontSize: 14, lineHeight: 21, fontWeight: '500', color: colors.text }}>{text}</T>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, paddingLeft: 28 }}>
              <GuidePhoto img="ok" ok />
              <GuidePhoto img={img} ok={false} fx={fx} />
            </View>
          </View>
        ))}
      </ScrollView>
      <Button label="사진 고르기" size="sheet" block onPress={onPick} style={{ marginTop: 12 }} />
    </BottomSheet>
  );
}

// ── 사진 한 장(끌 수 있는 칸) ───────────────────────────────────────────────────
function Tile({ src, index, w, h, pos, lifted, sorting, canDrag, onLift, onManage }: {
  src: string; index: number; w: number; h: number; pos: Animated.ValueXY; lifted: boolean; sorting: boolean; canDrag: boolean;
  onLift: () => void; onManage: () => void;
}) {
  const press = usePress(0.96, 160, 160);
  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(lift, { toValue: lifted ? 1 : 0, duration: reduceMotion() ? 0 : 160, easing: ease.out, useNativeDriver: false }).start();
  }, [lifted, lift]);
  const hide = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(hide, { toValue: sorting ? 0 : 1, duration: 120, easing: ease.out, useNativeDriver: false }).start();
  }, [sorting, hide]);
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: w, height: h, zIndex: lifted ? 5 : 1, transform: [...pos.getTranslateTransform(), { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, reduceMotion() ? 1 : 1.04] }) }] }, lifted ? shadow.drag : null, lifted ? { borderRadius: radius.field } : null]}>
      <Pressable
        onPressIn={canDrag ? press.onPressIn : undefined}
        onPressOut={press.onPressOut}
        onLongPress={canDrag ? () => { press.onPressOut(); onLift(); } : undefined}
        delayLongPress={400}
        accessibilityLabel={index === 0 ? '대표 사진' : `사진 ${index + 1}`}
        style={{ flex: 1 }}
      >
        {/* 웹에서 사진을 끌면 브라우저가 이미지 끌기를 시작해 누름이 끊긴다 — 사진은 터치를 받지 않게 */}
        <Animated.View pointerEvents="none" style={[{ flex: 1, borderRadius: radius.field, overflow: 'hidden', backgroundColor: colors.bgSoft }, press.scaleStyle]}>
          <Image source={{ uri: thumbUrl(src, 480) ?? src }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" />
        </Animated.View>
      </Pressable>
      <Animated.View pointerEvents={sorting ? 'none' : 'box-none'} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: hide }}>
        {index === 0 && <Tag label="대표" tone="dark" style={{ position: 'absolute', left: 8, top: 8 }} />}
        <Pressable onPress={onManage} accessibilityRole="button" accessibilityLabel={`사진 ${index + 1} 관리`} style={{ position: 'absolute', right: -2, top: -2, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.45)', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="more-horizontal" size={16} color={colors.text} />
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ── 사진 칸 6개 + 시트들 ────────────────────────────────────────────────────────
// error: 부모가 넘기는 안내(대표 사진 없음 등). onDragging: 끄는 동안 바깥 스크롤을 멈추게 알린다
export function PhotoEditor({ photos, onChange, width, mainFace, error, onDragging, standardTick = 0 }: {
  photos: string[]; onChange: (next: string[]) => void; width: number; mainFace?: 'checking' | 'ok' | 'no'; error?: string; onDragging?: (on: boolean) => void;
  standardTick?: number;   // 값이 늘면 '프로필 기준 보기' 시트를 연다(머리의 기준 보기 버튼)
}) {
  const w = (width - GAP * 2) / 3;
  const h = (w * 4) / 3;
  const at = (i: number) => ({ x: (i % 3) * (w + GAP), y: Math.floor(i / 3) * (h + GAP) });
  const [uploading, setUploading] = useState(false);
  const [reject, setReject] = useState('');
  const [menu, setMenu] = useState<number | null>(null);
  const [menuShown, setMenuShown] = useState(0);        // 시트가 닫히는 동안에도 내용을 그대로 둔다
  const [confirmDel, setConfirmDel] = useState(false);
  const [standard, setStandard] = useState(false);
  useEffect(() => { if (standardTick > 0) setStandard(true); }, [standardTick]);
  // 대표 사진 보이는 부분 고르기(1017) — 원본은 그대로 두고(프로필 페이지용) 잘라낸 사진을 따로 올린다(카드·목록 썸네일용)
  const [crop, setCrop] = useState<{ uri: string; mode: 'new' | 'main'; picked?: PickResult } | null>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const say = (m: string) => previewActions.showToast(m);
  const fail = (m: string) => { setReject(m); say(m); };

  // ── 올리기 ──
  async function pickPhoto(replaceAt?: number) {
    if (uploading) return;
    const cur = photosRef.current;
    const replacing = replaceAt != null;
    if (!replacing && cur.length >= MAX_PHOTOS) return;
    const uid = getCurrentUserId();
    if (!uid) { fail('사진은 로그인한 뒤에 올릴 수 있어요.'); return; }
    setReject('');
    const main = replacing ? replaceAt === 0 : cur.length === 0;
    // 대표 사진은 고른 뒤 보이는 부분을 직접 맞춘다
    if (main && canCropPhoto()) {
      try {
        const picked = await pickImageFile();
        if (picked) setCrop({ uri: picked.uri, mode: replacing ? 'main' : 'new', picked });
      } catch (e: any) {
        fail(e?.message ?? '사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
      return;
    }
    setUploading(true);
    try {
      const url = await pickAndUploadPhoto(uid);
      if (url) {
        // 올리자마자 검사 — 첫 사진은 얼굴, 나머지는 사람이 나와야 한다(1014). 통과 못 하면 넣지 않는다
        const r = await checkProfilePhoto(url, main ? 'face' : 'person');
        if (r !== 'ok') { fail(photoRejectText(r, main)); return; }
        const now = photosRef.current;
        if (replacing) onChange(now.map((p, i) => (i === replaceAt ? url : p)));
        else if (now.length < MAX_PHOTOS) onChange([...now, url]);
      }
    } catch (e: any) {
      fail(e?.message ?? '사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setUploading(false);
    }
  }
  // 자르기 완료 — 잘라낸 사진을 올리고 얼굴을 확인한 뒤 대표 사진 자리에 넣는다
  async function applyCrop(rect: CropRect) {
    const c = crop;
    const uid = getCurrentUserId();
    setCrop(null);
    if (!c || !uid) return;
    setUploading(true);
    try {
      // 원본 경로 — 새 사진은 먼저 원본을 올리고, 지금 대표 사진은 이미 올라가 있는 원본을 쓴다
      const origUrl = c.picked ? await uploadPhotoToStorage(c.picked, uid) : c.uri;
      const origPath = storagePath(origUrl);
      const cropPath = origPath?.startsWith(`${uid}/`) ? `${origPath}${CROP_MARK}${Date.now()}.jpg` : undefined;
      const url = await uploadPhotoToStorage(await cropPhoto(c.uri, rect), uid, cropPath);
      const r = await checkProfilePhoto(url, 'face');
      if (r !== 'ok') { fail(photoRejectText(r, true)); return; }
      const now = photosRef.current;
      if (c.mode === 'new') { if (now.length < MAX_PHOTOS) onChange([url, ...now]); }
      else onChange([url, ...now.slice(1)]);
    } catch (e: any) {
      fail(e?.message ?? '사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setUploading(false);
    }
  }
  // 시트가 닫힌 뒤에 자르기 화면을 연다(창을 닫으면서 바로 새 창을 띄우면 iOS에서 깜빡인다)
  function openMainCrop(uri: string) {
    if (!canCropPhoto()) return;
    setTimeout(() => setCrop({ uri: originalPhoto(uri), mode: 'main' }), 450);   // 이미 자른 사진이면 원본에서 다시 고른다
  }
  const closeMenu = () => { setMenu(null); setConfirmDel(false); };
  function move(from: number, to: number, toast: string) {
    const next = [...photos];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onChange(next);
    closeMenu();
    say(toast);
  }

  // ── 꾹 눌러 순서 바꾸기(§3-10) — 사진마다 자리 값(Animated.ValueXY)을 두고, 끄는 사진만 손가락을 따라간다 ──
  const posMap = useRef(new Map<string, Animated.ValueXY>()).current;
  const [order, setOrder] = useState<string[] | null>(null);   // 끄는 동안의 임시 순서
  const [dragKey, setDragKey] = useState<string | null>(null);
  const drag = useRef<{ key: string; order: string[]; from: { x: number; y: number } } | null>(null);
  const shown = order ?? photos;
  const posOf = (key: string, i: number) => {
    let v = posMap.get(key);
    if (!v) { v = new Animated.ValueXY(at(i)); posMap.set(key, v); }
    return v;
  };
  // 순서 · 폭이 바뀌면 제자리로(끄는 사진은 빼고) — 200ms EaseOut
  useEffect(() => {
    shown.forEach((key, i) => {
      if (key === drag.current?.key) return;
      const v = posOf(key, i);
      if (reduceMotion() || !order) v.setValue(at(i));
      else Animated.timing(v, { toValue: at(i), duration: 200, easing: ease.out, useNativeDriver: false }).start();
    });
    for (const key of [...posMap.keys()]) if (!shown.includes(key)) posMap.delete(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown.join('|'), w]);

  function lift(key: string) {
    const list = photosRef.current;
    const i = list.indexOf(key);
    if (i < 0 || list.length < 2) return;
    drag.current = { key, order: [...list], from: at(i) };
    setOrder([...list]);
    setDragKey(key);
    onDragging?.(true);
    haptic('impact');
  }
  function drop() {
    const g = drag.current;
    if (!g) return;
    const i = g.order.indexOf(g.key);
    const done = () => {
      drag.current = null;
      setDragKey(null);
      setOrder(null);
      onDragging?.(false);
      if (g.order.join('|') !== photosRef.current.join('|')) onChange(g.order);
    };
    const v = posOf(g.key, i);
    if (reduceMotion()) { v.setValue(at(i)); done(); return; }
    Animated.timing(v, { toValue: at(i), duration: 220, easing: ease.out, useNativeDriver: false }).start(done);
  }
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponderCapture: () => !!drag.current,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_e, gs) => {
      const g = drag.current;
      if (!g) return;
      const x = g.from.x + gs.dx, y = g.from.y + gs.dy;
      posOf(g.key, 0).setValue({ x, y });
      // 가장 가까운 사진 자리로 끼어든다
      let best = 0, bestD = Infinity;
      for (let i = 0; i < g.order.length; i++) {
        const p = at(i);
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      }
      const cur = g.order.indexOf(g.key);
      if (best !== cur) {
        const next = [...g.order];
        next.splice(cur, 1);
        next.splice(best, 0, g.key);
        g.order = next;
        setOrder(next);
      }
    },
    onPanResponderRelease: drop,
    onPanResponderTerminate: drop,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [w]);
  // 꾹 누른 뒤 움직이지 않고 떼면 그대로 내려놓는다
  const releaseIfIdle = () => { if (drag.current) setTimeout(() => { if (drag.current) drop(); }, 0); };

  const menuIdx = menu ?? menuShown;
  const menuSrc = photos[menuIdx];
  const last = photos.length - 1;
  const note = mainFace === 'no' ? '대표 사진에서 얼굴이 보이지 않아요. 얼굴이 잘 보이는 사진을 첫 번째로 올려 주세요.' : reject || error || '';
  return (
    <View>
      <View {...pan.panHandlers} onTouchEnd={releaseIfIdle} style={{ width, height: h * 2 + GAP }}>
        {/* 빈 칸 6개(사진 칸 아래에 깔린다) */}
        {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
          const p = at(i);
          const bad = i === 0 && (!!error || mainFace === 'no') && !photos.length;
          return (
            <Pressable
              key={i}
              onPress={() => pickPhoto()}
              disabled={uploading || i < photos.length}
              accessibilityRole="button"
              accessibilityLabel={`사진 ${i + 1} 추가`}
              style={{ position: 'absolute', left: p.x, top: p.y, width: w, height: h, borderRadius: radius.field, backgroundColor: colors.surface, borderWidth: bad ? 1.5 : 1, borderColor: bad ? colors.errorLine : colors.lineControl, alignItems: 'center', justifyContent: 'center' }}
            >
              {i === 0 && <Tag label="대표" tone="dark" style={{ position: 'absolute', left: 7, top: 7 }} />}
              {uploading && i === photos.length ? <BreathingDots size={5} gap={5} /> : <Icon name="plus" size={24} color={colors.subtle} />}
            </Pressable>
          );
        })}
        {shown.map((src, i) => (
          <Tile
            key={src}
            src={src}
            index={i}
            w={w}
            h={h}
            pos={posOf(src, i)}
            lifted={dragKey === src}
            sorting={!!dragKey}
            canDrag={photos.length >= 2}
            onLift={() => lift(src)}
            onManage={() => { setMenuShown(i); setConfirmDel(false); setMenu(i); }}
          />
        ))}
        {mainFace === 'no' && photos.length > 0 && !dragKey && (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: w, height: h, borderRadius: radius.field, borderWidth: 1.5, borderColor: colors.errorLine }} />
        )}
      </View>
      {photos.length >= 2 && <Text style={{ marginTop: 8, fontSize: 12, lineHeight: 19.2, color: colors.sub }}>사진을 꾹 누른 채 옮기면 순서를 바꿀 수 있어요.</Text>}
      {mainFace === 'checking' && !note && <Text style={[typo.help, { marginTop: 8 }]}>대표 사진을 확인하고 있어요…</Text>}
      {!!note && (
        <Text accessibilityRole="alert" style={[typo.error, { marginTop: 8, lineHeight: 19.2 }]}>
          {note}{(mainFace === 'no' || !!reject) && <Text onPress={() => setStandard(true)} style={{ color: colors.textSecondary, textDecorationLine: 'underline' }}>{'  '}프로필 기준 보기</Text>}
        </Text>
      )}

      {/* 사진 관리 시트 — 같은 시트 안에서 삭제를 확인한다 */}
      <BottomSheet open={menu !== null} onClose={closeMenu}>
        {confirmDel ? (
          <>
            <SheetHeader title="이 사진을 삭제할까요?" desc={menuIdx === 0 && photos.length > 1 ? '대표 사진을 지우면 다음 사진이 대표가 돼요.' : '삭제한 사진은 다시 올려야 해요.'} />
            <SheetButtons onCancel={() => setConfirmDel(false)} confirmLabel="삭제" confirmVariant="danger" onConfirm={() => { onChange(photos.filter((_, i) => i !== menuIdx)); closeMenu(); say('사진을 삭제했어요'); }} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              {!!menuSrc && <Image source={{ uri: thumbUrl(menuSrc, 240) ?? menuSrc }} style={{ width: 42, height: 56, borderRadius: 8, backgroundColor: colors.bgSoft }} contentFit="cover" />}
              <View style={{ flex: 1 }}>
                <Text style={typo.sheetTitle}>{menuIdx === 0 ? '대표 사진' : `${menuIdx + 1}번째 사진`}</Text>
                {photos.length >= 2 && <Text style={{ marginTop: 2, fontSize: 12, lineHeight: 18, color: colors.mute }}>사진을 꾹 눌러 옮길 수도 있어요</Text>}
              </View>
            </View>
            {menuIdx === 0 && canCropPhoto() && (
              <SheetRow label="보이는 부분 조정" icon={(c) => <Icon name="pencil" color={c} />} onPress={() => { closeMenu(); openMainCrop(photos[0]); }} />
            )}
            {menuIdx > 0 && (
              <SheetRow label="대표 사진으로 설정" icon={(c) => <Icon name="star" color={c} />} onPress={() => { const x = photos[menuIdx]; move(menuIdx, 0, '대표 사진으로 바꿨어요'); openMainCrop(x); }} />
            )}
            {menuIdx > 0 && <SheetRow label="앞으로 옮기기" icon={(c) => <Icon name="chevron-left" color={c} />} onPress={() => move(menuIdx, menuIdx - 1, '앞으로 옮겼어요')} />}
            {menuIdx < last && <SheetRow label="뒤로 옮기기" icon={(c) => <Icon name="chevron-right" color={c} />} onPress={() => move(menuIdx, menuIdx + 1, '뒤로 옮겼어요')} />}
            <SheetRow label="다른 사진으로 바꾸기" icon={(c) => <Icon name="image" color={c} />} onPress={() => { const i = menuIdx; closeMenu(); setTimeout(() => { void pickPhoto(i); }, 450); }} />
            <SheetDivider />
            <SheetRow danger label="사진 삭제" icon={(c) => <Icon name="trash" color={c} />} onPress={() => setConfirmDel(true)} />
          </>
        )}
      </BottomSheet>

      <StandardSheet open={standard} onClose={() => setStandard(false)} onPick={() => { setStandard(false); setTimeout(() => { void pickPhoto(); }, 450); }} />
      {/* 대표 사진 보이는 부분 고르기 */}
      <PhotoCropper uri={crop?.uri ?? null} onCancel={() => setCrop(null)} onDone={applyCrop} />
    </View>
  );
}

// 소개 1/4 본문 머리(손그림 · 제목 · 안내 · 기준 보기 버튼)는 화면마다 달라 PhotoIntro로 따로 둔다
export function PhotoIntro({ onStandard }: { onStandard: () => void }) {
  const press = usePress(0.97);
  return (
    <>
      <View style={{ height: 43, justifyContent: 'center' }}><FrameDoodle /></View>
      <T v="stepTitle" style={{ marginTop: 18 }}>당신다운{'\n'}첫 장면을 담아요.</T>
      <T v="intro" style={{ marginTop: 15 }}>얼굴이 잘 나온 대표 사진 1장은 꼭 필요해요.{'\n'}모든 사진에 본인이 나오게 올려 주세요.</T>
      <Pressable onPress={onStandard} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 16 }}>
        <Animated.View style={[{ height: 36, paddingLeft: 14, paddingRight: 12, borderRadius: 18, backgroundColor: colors.bgSoft, flexDirection: 'row', alignItems: 'center', gap: 4, overflow: 'hidden' }, press.scaleStyle]}>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.muted, opacity: press.p }} />
          <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.text }}>프로필 기준 보기</Text>
          <ThinChevron />
        </Animated.View>
      </Pressable>
    </>
  );
}
