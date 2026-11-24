// 야화 — 인연 프로필 사진 한 장 (시안 .gallery-track img / .story-photo / .mind-card .avatar)
// blur: 가림 정도. 시안 값 — 덱 미열람 사진 blur 16 · 확대 1.07, 호감 그리드 모자이크 blur 9 · 확대 1.15.
// 웹은 CSS blur 필터 그대로(시안과 같은 픽셀), iOS는 블러가 약하게 걸리는 기기가 있어 BlurView를 한 겹 더 얹는다.
// 안드로이드는 BlurView(Dimezis)가 인스턴스마다 매 프레임 화면 전체를 다시 그려 카드 여러 장·넘김·스크롤이 끊긴다(1026) —
// 작은 썸네일을 받아 디코딩할 때 한 번만 흐리게(blurRadius) 하고, BlurView가 깔던 옅은 흰 막만 그대로 둔다.
import React, { useMemo, useState } from 'react';
import { View, Platform, StyleSheet, PixelRatio } from 'react-native';
import { Image, type ImageContentPosition, type ImageLoadEventData } from 'expo-image';
import { BlurView } from 'expo-blur';
import { colors } from '../../tokens';
import { thumbUrl } from '../../lib/img';

// 안드로이드 흐림 계산 — 썸네일은 화면 폭(dp)의 3/4 픽셀. expo-image(Glide)는 1/4로 줄인 뒤 반지름 r로 흐리므로
// 디코딩 픽셀 기준 σ ≈ 1.6r + 2.4. 목표는 웹 CSS blur(N px)와 같은 σ = N dp. 썸네일이 안 되는 사진(로컬 등)은 화면 픽셀로 디코딩된다
export const ANDROID_BLUR = Platform.OS === 'android';
export const androidBlurThumbW = (w: number) => Math.max(48, Math.min(240, Math.round(w * 0.75)));
export function androidBlurRadius(blur: number, w: number, thumbed: boolean) {
  const pxPerDp = thumbed ? androidBlurThumbW(w) / w : PixelRatio.get();
  return Math.max(1, Math.min(25, Math.round((blur * pxPerDp - 2.4) / 1.6)));
}
// 예전 BlurView(tint default)가 깔던 흰 막 — 안드로이드 expo-blur: 흰색 · 불투명도 0.44 × intensity/100
export const androidBlurVeil = (intensity: number) => `rgba(255,255,255,${(0.44 * Math.min(100, intensity)) / 100})`;

export function ProfilePhoto({ src, width, height, radius, blur, scale = 1, position, thumbWidth = 720, onLoad, lite }: {
  src?: string | number | null;
  width: number | '100%';
  height: number | '100%';
  radius: number;
  blur?: number;                     // 0/undefined = 선명
  scale?: number;                    // 가릴 때 가장자리 번짐을 숨기는 확대
  position?: ImageContentPosition;   // 시안 갤러리는 'center 35%'
  thumbWidth?: number;
  onLoad?: (e: ImageLoadEventData) => void;
  // 아주 작은 사진(덱 아래 미니 카드 27×35)용 — iOS에서 흐림 막(BlurView)을 얹지 않고 작은 썸네일을 두 배 세게 흐린다.
  // 흐림 막은 장마다 매 프레임 다시 그려져, 카드를 넘길 때 미니 카드 열 장이 함께 움직이면 끊겼다(1110)
  lite?: boolean;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const blurred = !!blur;
  const aBlur = blurred && ANDROID_BLUR;
  const boxW = typeof width === 'number' ? width : 180;
  const tw = aBlur ? androidBlurThumbW(boxW) : thumbWidth;
  const source = useMemo(() => {
    if (src == null || src === '') return null;
    if (typeof src !== 'string') return src;
    return { uri: (!thumbFailed ? thumbUrl(src, tw) : null) ?? src };
  }, [src, tw, thumbFailed]);
  const thumbed = typeof src === 'string' && !!source && (source as { uri: string }).uri !== src;
  const iosLite = !!lite && Platform.OS === 'ios';
  const radiusPx = aBlur ? androidBlurRadius(blur!, boxW, thumbed) : blurred ? (iosLite ? blur! * 2 : blur!) : 0;
  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.bgSoft }}>
      {source != null && (
        <Image
          source={source}
          style={{ width: '100%', height: '100%', transform: blurred && scale !== 1 ? [{ scale }] : undefined }}
          contentFit="cover"
          contentPosition={position}
          cachePolicy="memory-disk"
          transition={120}
          blurRadius={radiusPx}
          onLoad={onLoad}
          onError={() => { if (!thumbFailed) setThumbFailed(true); }}
        />
      )}
      {aBlur && <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: androidBlurVeil(blur! * 5) }]} />}
      {blurred && Platform.OS === 'ios' && !iosLite && (
        <BlurView intensity={Math.min(100, blur! * 5)} tint="default" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFillObject} />
      )}
    </View>
  );
}
