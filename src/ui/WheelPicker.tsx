// 야화 UI 킷 — 휠 시트(spec-shell §2.12 · §3-6, 시안 wheel.js). 위아래로 넘겨 가운데 줄에 맞춰 고른다.
// 한 칸(지역 · 키)과 여러 칸(생년월일 년 · 월 · 일)을 같은 시트로 그린다.
// 시트: 손잡이 없음 · 안쪽 위 24 · 제목 600 18 · 설명 13 · (되돌아가기 줄) · 휠 5줄(한 줄 48) · 아래 주 버튼 54.
// 가운데 줄: 옅은 하늘 띠(모서리 12). 항목 투명도 가운데 1 · 옆 .55 · 그 밖 .25, 고를 수 없는 값 .2. 위아래는 흰 띠로 흐려진다.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../tokens';
import { BottomSheet } from './Sheet';
import { Button } from './Button';
import { Icon } from './icons';
import { haptic } from './motion';

const ROW = 48;
export type WheelValue = { value: string | number; label: string };
export type WheelColumn = { values: WheelValue[]; current?: string | number | null; flex?: number; label?: string };

// 굴리는 동안은 다시 그리지 않는다 — 흐림은 스크롤 위치에서 바로 계산(Animated)하고, 고른 값은 멈춘 뒤 한 번만 올린다.
// (11-23: 한 줄 지날 때마다 시트 전체를 다시 그려 뚝뚝 끊기던 것 · 'fast' 감속으로 툭툭 멈추던 것 고침)
function Column({ col, k, index, onIndex, off }: {
  col: WheelColumn; k: number; index: number; onIndex: (k: number, i: number) => void; off: (i: number) => boolean;
}) {
  const ref = useRef<ScrollView>(null);
  const settled = useRef(false);   // 처음 자리 잡는 동안은 진동을 내지 않는다
  const cur = useRef(index);
  const y = useRef(new Animated.Value(index * ROW)).current;
  const first = useRef({ x: 0, y: index * ROW }).current;   // 처음 자리만 준다(다시 그릴 때 굴러가던 휠을 잡아채지 않게)
  useEffect(() => {
    const t = setTimeout(() => { ref.current?.scrollTo({ y: index * ROW, animated: false }); setTimeout(() => { settled.current = true; }, 120); }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const at = (v: number) => Math.max(0, Math.min(col.values.length - 1, Math.round(v / ROW)));
  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y } } }], {
    useNativeDriver: Platform.OS !== 'web',
    listener: (e: any) => {
      const n = at(e.nativeEvent.contentOffset.y);
      if (n !== cur.current) { cur.current = n; onIndex(k, n); if (settled.current) haptic('selection'); }
    },
  });
  return (
    <Animated.ScrollView
      ref={ref as any}
      accessibilityRole="adjustable"
      accessibilityLabel={col.label}
      style={[{ flex: col.flex ?? 1, height: ROW * 5 }, Platform.OS === 'web' ? ({ scrollSnapType: 'y mandatory', scrollbarWidth: 'none' } as object) : null]}
      contentContainerStyle={{ paddingVertical: ROW * 2 }}
      contentOffset={first}
      showsVerticalScrollIndicator={false}
      snapToInterval={ROW}
      decelerationRate="normal"
      nestedScrollEnabled
      scrollEventThrottle={16}
      onScroll={onScroll}
    >
      {col.values.map((v, i) => {
        const dim = off(i);
        // 가운데 1 · 옆 .55 · 그 밖 .25 — 스크롤 위치에 따라 이어서 바뀐다
        const opacity = dim ? 0.2 : y.interpolate({ inputRange: [(i - 2) * ROW, (i - 1) * ROW, i * ROW, (i + 1) * ROW, (i + 2) * ROW], outputRange: [0.25, 0.55, 1, 0.55, 0.25], extrapolate: 'clamp' });
        return (
          <Pressable
            key={String(v.value)}
            onPress={() => ref.current?.scrollTo({ y: i * ROW, animated: true })}
            accessibilityRole="button"
            accessibilityState={{ selected: i === index }}
            style={[{ height: ROW }, Platform.OS === 'web' ? ({ scrollSnapAlign: 'center' } as object) : null]}
          >
            <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', opacity }}>
              <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: i === index ? '600' : '400', color: dim ? colors.subtle : i === index ? colors.text : colors.textSecondary, fontVariant: ['tabular-nums'] }}>{v.label}</Text>
            </Animated.View>
          </Pressable>
        );
      })}
    </Animated.ScrollView>
  );
}

// stepKey: 같은 시트 안에서 내용이 바뀔 때(지역 1단계 → 2단계) 바꿔 주면 휠을 새로 그린다
export function WheelSheet({ open, onClose, title, caption, columns, doneLabel = '선택 완료', back, secondary, onDone, isDisabled, stepKey }: {
  open: boolean;
  onClose: () => void;
  title: string;
  caption?: string;
  columns: WheelColumn[];
  doneLabel?: string;
  back?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };   // 주 버튼 아래 글자 버튼(예: 취향 지역 '이 지역 빼기')
  onDone: (values: (string | number)[]) => void;
  isDisabled?: (column: number, value: string | number, now: (string | number)[]) => boolean;   // 없는 날(2월 30일)처럼 흐리게 둘 값
  stepKey?: string | number;
}) {
  const start = () => columns.map((c) => Math.max(0, c.values.findIndex((v) => v.value === c.current)));
  // 열릴 때 · 단계가 바뀔 때 고른 값 자리로(휠을 새로 그리기 전에 맞춰 둔다)
  const key = `${open}-${stepKey ?? ''}`;
  const [st, setSt] = useState(() => ({ key, idx: start() }));
  const live = useRef<number[]>(st.idx.slice());   // 굴리는 중의 자리(다시 그리지 않고 여기만 고친다)
  const commit = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (commit.current) clearTimeout(commit.current); }, []);
  let idx = st.idx;
  if (st.key !== key) { idx = start(); live.current = idx.slice(); if (commit.current) clearTimeout(commit.current); setSt({ key, idx }); }
  const valuesOf = (ix: number[]) => columns.map((c, k) => c.values[ix[k] ?? 0]?.value);
  const now = valuesOf(idx);
  // 멈춘 뒤(마지막으로 줄이 바뀐 뒤 120ms) 한 번만 다시 그린다 — 굵은 글자 · 없는 날 흐림이 그때 바뀐다
  const onIndex = (k: number, i: number) => {
    live.current[k] = i;
    if (commit.current) clearTimeout(commit.current);
    commit.current = setTimeout(() => setSt((p) => ({ key: p.key, idx: live.current.slice() })), 120);
  };
  return (
    <BottomSheet open={open} onClose={onClose} grabber={false} scroll={false}>
      <Text accessibilityRole="header" style={{ fontSize: 18, lineHeight: 25.2, fontWeight: '600', color: colors.text }}>{title}</Text>
      {!!caption && <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 20.8, color: colors.sub }}>{caption}</Text>}
      {back ? (
        <Pressable onPress={back.onPress} accessibilityRole="button" style={{ alignSelf: 'flex-start', marginTop: 4, marginLeft: -6, minHeight: 44, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Icon name="chevron-left" size={20} color={colors.textSecondary} />
          <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.textSecondary }}>{back.label}</Text>
        </Pressable>
      ) : <View style={{ height: 12 }} />}
      <View style={{ height: ROW * 5, marginTop: back ? 4 : 0 }}>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: ROW * 2, height: ROW, borderRadius: radius.field, backgroundColor: colors.accentSubtle }} />
        <View key={key} style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
          {columns.map((c, k) => (
            <Column key={k} col={c} k={k} index={idx[k] ?? 0} onIndex={onIndex} off={(i) => !!isDisabled?.(k, c.values[i].value, now)} />
          ))}
        </View>
        {/* 위아래 30%는 흰색으로 흐려진다(시안 mask-image와 같은 결과) */}
        <LinearGradient pointerEvents="none" colors={['#FFFFFF', 'rgba(255,255,255,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: ROW * 1.5 }} />
        <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)', '#FFFFFF']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: ROW * 1.5 }} />
      </View>
      <Button label={doneLabel} size="dock" onPress={() => onDone(valuesOf(live.current))} style={{ marginTop: 12 }} />
      {!!secondary && (
        <Pressable onPress={secondary.onPress} accessibilityRole="button" style={{ marginTop: 6, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          {({ pressed }) => <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '500', color: pressed ? colors.text : colors.sub }}>{secondary.label}</Text>}
        </Pressable>
      )}
    </BottomSheet>
  );
}
