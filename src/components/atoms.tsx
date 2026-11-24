// 야화 — Atoms (ported from project/야화/atoms.jsx — match HTML mockup pixel-for-pixel)
import React from 'react';
import {
  Animated,
  Pressable,
  Text,
  View,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ScrollView,
  PressableProps,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { colors, radius } from '../tokens';
import { Icons } from '../icons';

// ── Btn ─────────────────────────────────────────────────────────────────────
type BtnKind = 'primary' | 'soft' | 'night' | 'ghost' | 'line';
type BtnSize = 'sm' | 'md' | 'lg';

// ⚠️ 함수형 — 모듈 상수는 로드 시점 팔레트 고정(다크모드 미반영)
// 리디자인(1010) — 주 버튼은 시연본처럼 연한 파랑 바탕 + 파란 글씨(리프 충전·다음·보내기 등)
const btnPalette = (): Record<BtnKind, { bg: string; fg: string; pressed: string; bd?: string }> => ({
  primary: { bg: colors.actionSoft, fg: colors.action, pressed: colors.actionSoft },
  soft: { bg: colors.primarySoft, fg: colors.primary, pressed: colors.primaryLine },
  night: { bg: colors.night, fg: '#fff', pressed: '#2B2B31' },
  ghost: { bg: 'transparent', fg: colors.text, pressed: colors.bgSoft },
  line: { bg: colors.surface, fg: colors.text, pressed: colors.bgSoft, bd: colors.line },
});

const btnSizes: Record<BtnSize, { px: number; h: number; fs: number }> = {
  sm: { px: 14, h: 38, fs: 12.5 },
  md: { px: 18, h: 48, fs: 13.5 },
  lg: { px: 22, h: 56, fs: 15.5 },
};

export function Btn({
  children,
  kind = 'primary',
  size = 'md',
  full,
  leftIcon,
  rightIcon,
  disabled,
  onPress,
  style,
  textStyle,
}: {
  children: React.ReactNode;
  kind?: BtnKind;
  size?: BtnSize;
  full?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  disabled?: boolean;
  onPress?: PressableProps['onPress'];
  style?: ViewStyle;
  textStyle?: TextStyle;
}) {
  const p = btnPalette()[kind];
  const sz = btnSizes[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingHorizontal: sz.px,
          height: sz.h,
          backgroundColor: pressed ? p.pressed : p.bg,
          borderRadius: size === 'lg' ? 14 : 12,
          borderWidth: p.bd ? 1 : 0,
          borderColor: p.bd,
          alignSelf: full ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          // 눌림 피드백 — 인터페이스가 반응한다는 신호
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {leftIcon}
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text style={[{ color: p.fg, fontSize: sz.fs, fontWeight: '700', lineHeight: sz.fs * 1.3 }, textStyle]}>
          {children}
        </Text>
      ) : (
        children
      )}
      {rightIcon}
    </Pressable>
  );
}

// ── MosaicImg ───────────────────────────────────────────────────────────────
// Design intent: blur(N) + scale 1.12 + warm overlay. RN BlurView for blur.
// src accepts remote URL (string) or local require() asset (number / object).
// thumbWidth: 원격 URL일 때 Supabase Storage 렌더 엔드포인트로 리사이즈된 썸네일 요청.
//   리스트 그리드 셀(~190px 폭)은 thumbWidth=300 정도가 적정. 미지정 시 원본 URL 사용.
import { thumbUrl } from '../lib/img';
import { ANDROID_BLUR, androidBlurThumbW, androidBlurRadius, androidBlurVeil } from './affinity/ProfilePhoto';
import { pressFx } from '../lib/press';

export function MosaicImg({
  src,
  mosaic = true,
  blurStrength = 12,
  radiusVal = 0,
  tint = true,
  thumbWidth,
}: {
  src: string | number;
  mosaic?: boolean;
  blurStrength?: number;
  radiusVal?: number;
  tint?: boolean;
  thumbWidth?: number;
}) {
  const intensity = Math.min(100, Math.round(blurStrength * 5));
  const [thumbFailed, setThumbFailed] = React.useState(false);
  // 안드로이드 모자이크 — BlurView(Dimezis) 대신 칸 폭에 맞춘 작은 썸네일을 디코딩 때 한 번만 흐리게(ProfilePhoto와 같은 계산, 1026).
  // 칸 폭을 알아야 해서 처음 한 번 잰 뒤에 그린다(재기 전에 선명한 사진이 보이지 않게)
  const aBlur = mosaic && ANDROID_BLUR;
  const [boxW, setBoxW] = React.useState(0);
  const tw = aBlur ? (boxW ? androidBlurThumbW(boxW) : undefined) : thumbWidth;
  const source = React.useMemo(() => {
    if (typeof src === 'string') {
      const uri = (!thumbFailed && tw ? thumbUrl(src, tw) : null) ?? src;
      return { uri };
    }
    return src;
  }, [src, tw, thumbFailed]);
  const thumbed = typeof src === 'string' && (source as { uri: string }).uri !== src;
  return (
    <View
      onLayout={aBlur ? (e) => { const w = Math.round(e.nativeEvent.layout.width); if (w > 0 && w !== boxW) setBoxW(w); } : undefined}
      style={{ width: '100%', height: '100%', overflow: 'hidden', borderRadius: radiusVal, backgroundColor: '#1a1a1f' }}
    >
      {(!aBlur || boxW > 0) && <Image
        source={source}
        style={{
          width: '100%',
          height: '100%',
          transform: mosaic ? [{ scale: 1.12 }] : undefined,
        }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={120}
        // 네이티브 픽셀 블러 — BlurView가 플랫폼에 따라 안 먹는 케이스가 있어
        // 이미지 자체에도 blurRadius를 건다(이중 안전장치, 웹은 CSS filter로 동작).
        blurRadius={aBlur ? androidBlurRadius(Math.max(8, blurStrength), boxW, thumbed) : mosaic ? Math.max(8, blurStrength) : 0}
        onError={() => { if (tw && !thumbFailed) setThumbFailed(true); }}
      />}
      {aBlur && <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: androidBlurVeil(intensity) }]} />}
      {mosaic && !aBlur && (
        <BlurView
          intensity={intensity}
          tint="default"
          // Android는 이 옵션 없이는 블러가 렌더링되지 않음(반투명 오버레이만 됨)
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFillObject}
        />
      )}
      {mosaic && tint && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: 'rgba(255,150,80,0.05)' },
          ]}
        />
      )}
    </View>
  );
}

// ── Avatar ──────────────────────────────────────────────────────────────────
export function Avatar({
  size = 44,
  locked = true,
  online,
  photo,
  blurStrength = 6,
}: {
  size?: number;
  locked?: boolean;
  online?: boolean;
  photo?: string | number;
  blurStrength?: number;
}) {
  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: colors.primary,
        }}
      >
        {photo && (
          <MosaicImg
            src={photo}
            mosaic={locked}
            blurStrength={locked ? blurStrength : 0}
            tint={false}
            // 작은 아바타는 리사이즈된 썸네일만 — retina(2x) 마진 + 데이터URL은 thumbUrl이 자체 무시
            thumbWidth={typeof photo === 'string' ? Math.max(96, Math.round(size * 2.5)) : undefined}
          />
        )}
      </View>
      {locked && photo && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: size / 2,
            backgroundColor: 'rgba(0,0,0,0.10)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icons.lock size={size * 0.3} color="rgba(255,255,255,0.85)" />
        </View>
      )}
      {online && !locked && (
        <View
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: size * 0.28,
            height: size * 0.28,
            backgroundColor: colors.success,
            borderRadius: (size * 0.28) / 2,
            borderWidth: 2,
            borderColor: '#fff',
          }}
        />
      )}
    </View>
  );
}

// ── NavBar ──────────────────────────────────────────────────────────────────
export function NavBar({
  title,
  left,
  right,
  transparent,
}: {
  title?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  transparent?: boolean;
}) {
  return (
    <View
      style={{
        // 리디자인(1010) — 시연본 서브 헤더: 구분선 없이 가운데 제목
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        backgroundColor: transparent ? 'transparent' : colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 60 }}>{left}</View>
      {title ? <Text style={{ fontSize: 15.5, fontWeight: '700', color: colors.text }}>{title}</Text> : <View />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 60, justifyContent: 'flex-end' }}>
        {right}
      </View>
    </View>
  );
}

// ── TabBar ──────────────────────────────────────────────────────────────────
// 하단 메뉴는 떠 있는 알약(ui/Gnb)으로 바뀌었다(리뉴얼 1120). 탭 화면은 스크롤 영역 아래에
// useTabBarClearance()만큼(메뉴 64 + 바닥 여백 + 12) 비워 둔다 — 기존 호출부 호환용으로 여기서도 내보낸다.
export { useTabBarClearance } from '../ui/Gnb';
export const TAB_BAR_PILL_HEIGHT = 64;
export const TAB_BAR_SPACE = 16;

// ── Chip ────────────────────────────────────────────────────────────────────
export function Chip({
  active,
  children,
  onPress,
}: {
  active?: boolean;
  children: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: active ? colors.text : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.text : colors.line,
        borderRadius: radius.pill,
        opacity: pressed ? 0.75 : 1,
        ...pressFx(pressed),
      })}
    >
      <Text style={{ fontSize: 11.5, fontWeight: active ? '700' : '600', color: active ? colors.bg : colors.sub }}>
        {children}
      </Text>
    </Pressable>
  );
}

// ── LeafTag ─────────────────────────────────────────────────────────────────
export function LeafTag({ n, size = 'md' }: { n: number; size?: 'md' | 'lg' }) {
  const s = size === 'lg' ? { fs: 13.5, ph: 12, pv: 6, icon: 16 } : { fs: 11.5, ph: 9, pv: 4, icon: 13 };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: s.ph,
        paddingVertical: s.pv,
        backgroundColor: colors.primarySoft,
        borderRadius: radius.pill,
        alignSelf: 'flex-start',
      }}
    >
      <Icons.leaf size={s.icon} color={colors.primary} />
      <Text
        style={{
          fontSize: s.fs,
          fontWeight: '700',
          color: colors.primary,
          lineHeight: s.fs * 1.25,  // 텍스트 baseline 정렬 — 부모 paddingVertical과 일치
          // @ts-ignore Android-only style — RN-web/iOS는 무시
          includeFontPadding: false,
        }}
      >
        {n}
      </Text>
    </View>
  );
}

// ── ChipRow (horizontal scrolling chip row) ─────────────────────────────────
export function ChipRow({ chips, activeIndex = 0 }: { chips: string[]; activeIndex?: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingVertical: 10 }}
      style={{ backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft }}
    >
      {chips.map((c, i) => (
        <Chip key={c} active={i === activeIndex}>
          {c}
        </Chip>
      ))}
    </ScrollView>
  );
}

// iOS식 토글 — RN-web의 Switch가 thumb/track 색을 플랫폼마다 다르게 그려
// (쉬어가기 화면에서 적록 조합으로 깨짐) 직접 그린다. 51×31 알약 + 흰 원 썸,
// on 색은 프라이머리(iOS 형태, 색감은 우리 것 — 대표 지시 0821).
export function Toggle({ value, onChange, disabled }: {
  value: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  const anim = React.useRef(new Animated.Value(value ? 1 : 0)).current;
  React.useEffect(() => {
    Animated.timing(anim, { toValue: value ? 1 : 0, duration: 180, useNativeDriver: false }).start();
  }, [value, anim]);
  return (
    <Pressable onPress={() => !disabled && onChange(!value)} hitSlop={8} disabled={disabled}>
      <Animated.View
        style={{
          width: 51, height: 31, borderRadius: 16, padding: 2,
          backgroundColor: anim.interpolate({
            inputRange: [0, 1],
            outputRange: [colors.line, colors.action],
          }) as any,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Animated.View
          style={{
            width: 27, height: 27, borderRadius: 14, backgroundColor: '#fff',
            transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) as any }],
            shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
