// 야화 UI 킷 — 범위 막대(시안 .yh-range: 취향 설정의 나이, spec-dating §3.10)
// 높이 36 · 선 4 #CFD5DA(모서리 2) · 고른 구간 강조 파랑 · 손잡이 26 흰 원(1px 선 + 그림자 0 2 6 · 18%) 두 개. 손잡이 가운데가 값의 자리다(양 끝에서 13 안쪽).
// 값은 정수 단계. 두 손잡이는 서로 지나치지 않는다(최소 간격 minGap). disabled면 35%로 흐려지고 움직이지 않는다.
import React, { useRef, useState } from 'react';
import { PanResponder, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../tokens';

const THUMB = 26;

export function RangeSlider({ min, max, low, high, onChange, minGap = 1, disabled, lowLabel = '최솟값', highLabel = '최댓값', style }: {
  min: number; max: number; low: number; high: number; onChange: (low: number, high: number) => void;
  minGap?: number; disabled?: boolean; lowLabel?: string; highLabel?: string; style?: StyleProp<ViewStyle>;
}) {
  const [w, setW] = useState(0);
  const span = Math.max(1, w - THUMB);
  const xOf = (v: number) => ((v - min) / (max - min)) * span;
  // 끌기 중에 최신 값을 읽게 ref로 둔다(PanResponder는 처음 만든 것을 계속 쓴다)
  const st = useRef({ low, high, span, min, max, minGap, disabled, onChange });
  st.current = { low, high, span, min, max, minGap, disabled, onChange };
  const start = useRef(0);
  const responder = (which: 'low' | 'high') => PanResponder.create({
    onStartShouldSetPanResponder: () => !st.current.disabled,
    onMoveShouldSetPanResponder: (_e, g) => !st.current.disabled && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { start.current = st.current[which]; },
    onPanResponderMove: (_e, g) => {
      const s = st.current;
      const v = Math.round(start.current + (g.dx / s.span) * (s.max - s.min));
      if (which === 'low') {
        const next = Math.max(s.min, Math.min(v, s.high - s.minGap));
        if (next !== s.low) s.onChange(next, s.high);
      } else {
        const next = Math.min(s.max, Math.max(v, s.low + s.minGap));
        if (next !== s.high) s.onChange(s.low, next);
      }
    },
  });
  const lowPan = useRef(responder('low')).current;
  const highPan = useRef(responder('high')).current;
  const thumb = (x: number, pan: typeof lowPan, label: string, value: number) => (
    <View
      {...pan.panHandlers}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      hitSlop={{ top: 9, bottom: 9, left: 6, right: 6 }}
      style={[{ position: 'absolute', left: x, top: (36 - THUMB) / 2, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, boxShadow: '0px 2px 6px rgba(30,50,70,0.18)' }]}
    />
  );
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[{ height: 36, opacity: disabled ? 0.35 : 1 }, style]}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 16, height: 4, borderRadius: 2, backgroundColor: colors.control }} />
      {w > 0 && (
        <>
          <View style={{ position: 'absolute', left: xOf(low) + THUMB / 2, width: Math.max(0, xOf(high) - xOf(low)), top: 16, height: 4, borderRadius: 2, backgroundColor: colors.accent }} />
          {thumb(xOf(low), lowPan, lowLabel, low)}
          {thumb(xOf(high), highPan, highLabel, high)}
        </>
      )}
    </View>
  );
}
