// 대표 사진 보이는 부분 고르기(1017 대표 지시) — 4:5 틀 안에서 사진을 끌어 옮기고 두 손가락으로 확대한다.
// 완료하면 원본 픽셀 기준 자를 영역(CropRect)을 돌려준다. 실제 자르기·업로드는 부르는 쪽(photoUpload.cropPhoto).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, PanResponder, Image, Platform, useWindowDimensions, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CropRect } from '../lib/photoUpload';
import { colors, palette } from '../tokens';

const ASPECT = 4 / 5;   // 인연 카드 사진 칸(약 0.82)에 맞춘 세로형
const MAX_ZOOM = 5;
const LS = 0;

export function PhotoCropper({ uri, onCancel, onDone }: {
  uri: string | null;
  onCancel: () => void;
  onDone: (rect: CropRect) => void;
}) {
  const { width: winW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const FW = Math.min(winW - 48, 360);
  const FH = FW / ASPECT;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState({ z: 1, tx: 0, ty: 0 });

  useEffect(() => {
    setSize(null);
    if (!uri) return;
    Image.getSize(uri, (w, h) => setSize({ w, h }), () => setSize(null));
  }, [uri]);

  const base = size ? Math.max(FW / size.w, FH / size.h) : 1;
  // 틀을 벗어나 빈 곳이 보이지 않게 위치를 묶는다
  const clamp = (z: number, tx: number, ty: number) => {
    if (!size) return { z, tx, ty };
    const W = size.w * base * z, H = size.h * base * z;
    return { z, tx: Math.min(0, Math.max(FW - W, tx)), ty: Math.min(0, Math.max(FH - H, ty)) };
  };

  // 처음엔 가운데
  useEffect(() => {
    if (!size) return;
    setView(clamp(1, (FW - size.w * base) / 2, (FH - size.h * base) / 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, FW]);

  const viewRef = useRef(view);
  viewRef.current = view;
  const g = useRef({ z0: 1, tx0: 0, ty0: 0, d0: 0, n: 0, dx0: 0, dy0: 0 });
  const dist = (t: any[]) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
  // 손가락 수가 바뀌면 그 순간을 새 기준으로 삼는다
  const rebase = (touches: any[], dx: number, dy: number) => {
    const v = viewRef.current;
    g.current = { z0: v.z, tx0: v.tx, ty0: v.ty, d0: touches.length >= 2 ? dist(touches) : 0, n: touches.length, dx0: dx, dy0: dy };
  };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => rebase(e.nativeEvent.touches as any, 0, 0),
    onPanResponderMove: (e, gs) => {
      const t = e.nativeEvent.touches as any[];
      if (t.length !== g.current.n) { rebase(t, gs.dx, gs.dy); return; }
      const s = g.current;
      if (t.length >= 2 && s.d0 > 0) {
        const z = Math.min(MAX_ZOOM, Math.max(1, s.z0 * (dist(t) / s.d0)));
        // 틀 가운데를 기준으로 확대
        const k = z / s.z0;
        setView(clampRef.current(z, FW / 2 - (FW / 2 - s.tx0) * k, FH / 2 - (FH / 2 - s.ty0) * k));
      } else {
        setView(clampRef.current(s.z0, s.tx0 + gs.dx - s.dx0, s.ty0 + gs.dy - s.dy0));
      }
    },
  }), [FW, FH]);
  const clampRef = useRef(clamp);
  clampRef.current = clamp;

  function zoomBy(f: number) {
    const v = viewRef.current;
    const z = Math.min(MAX_ZOOM, Math.max(1, v.z * f));
    const k = z / v.z;
    setView(clamp(z, FW / 2 - (FW / 2 - v.tx) * k, FH / 2 - (FH / 2 - v.ty) * k));
  }

  function done() {
    if (!size) return;
    const s = base * view.z;
    onDone({ originX: -view.tx / s, originY: -view.ty / s, width: FW / s, height: FH / s });
  }

  return (
    <Modal visible={!!uri} animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.inverseDeep, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={onCancel} accessibilityRole="button" hitSlop={8} style={({ pressed }) => ({ padding: 12, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 16, lineHeight: 24, color: colors.inverse, letterSpacing: LS }}>취소</Text>
          </Pressable>
          <Text accessibilityRole="header" style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.inverse, letterSpacing: LS }}>대표 사진</Text>
          <Pressable onPress={done} disabled={!size} accessibilityRole="button" hitSlop={8} style={({ pressed }) => ({ padding: 12, opacity: !size ? 0.4 : pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.inverse, letterSpacing: LS }}>완료</Text>
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View {...pan.panHandlers} style={{ width: FW, height: FH, overflow: 'hidden', borderRadius: 14, backgroundColor: palette.black }}>
            {size ? (
              <Image
                source={{ uri: uri ?? undefined }}
                style={{ position: 'absolute', left: view.tx, top: view.ty, width: size.w * base * view.z, height: size.h * base * view.z }}
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.inverse} /></View>
            )}
            {/* 3분할 안내선 */}
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 14 }} />
            {[1, 2].map((i) => (
              <React.Fragment key={i}>
                <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: (FW * i) / 3, width: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: (FH * i) / 3, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
              </React.Fragment>
            ))}
          </View>
          <Text style={{ marginTop: 20, fontSize: 14, lineHeight: 23.1, color: 'rgba(255,255,255,0.75)', letterSpacing: LS, textAlign: 'center' }}>
            {Platform.OS === 'web' ? '사진을 끌어 옮기고 아래 버튼으로 크기를 맞춰주세요.' : '사진을 끌어 옮기고 두 손가락으로 크기를 맞춰주세요.'}
            {'\n'}인연 카드에는 이 부분이 보여요.
          </Text>
          {Platform.OS === 'web' && (
            <View style={{ marginTop: 16, flexDirection: 'row', gap: 12 }}>
              {[['축소', '－', 1 / 1.2], ['확대', '＋', 1.2]].map(([label, sym, f]) => (
                <Pressable key={label as string} onPress={() => zoomBy(f as number)} accessibilityRole="button" accessibilityLabel={label as string}
                  style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
                  <Text style={{ fontSize: 20, lineHeight: 26, color: colors.inverse }}>{sym as string}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
