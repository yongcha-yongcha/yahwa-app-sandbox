// 야화 — 음성 재생 줄(리뉴얼 1120, 시안 .vp · spec-rest §2.7)
// 높이 56 · 모서리 16 · 회색 카드 · 안쪽 0 16 0 8 · 사이 12: 흰 원 40(▶ / ❚❚ 18) + 소리 막대(폭 3 · 사이 2 · 높이 4~22) + 시간 13 500.
// 막대는 들은 만큼 진해진다. 시간은 멈춤 = 전체 길이, 재생 중 = 지난 시간. 원 누름 0.92배.
// size="sm": 목록 카드(높이 48 · 원 32) / tone="paper": 글쓰기 종이 안(흰 바탕 + 회색 원) + onRemove(빼기 ×).
// 한 번에 하나만 재생한다. 재생은 audioMessage.playAudio(네이티브·웹 공용).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../../tokens';
import { Icon, usePress } from '../../ui';
import { playAudio } from '../../lib/audioMessage';
import { useOnScreenInactive } from '../KeepAlive';
import { PlayGlyph } from './cIcons';

const mss = (s: number) => { const r = Math.max(0, Math.round(s)); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`; };
const BARS = 28;
// 시안 cpWave — 녹음마다 조금씩 다른 막대 모양(주소로 씨앗을 정한다)
export function waveHeights(key: string, n: number = BARS): number[] {
  const seed = [...key].reduce((a, c) => a + c.charCodeAt(0), 0) % 7 + 1;
  return Array.from({ length: n }, (_, i) => 4 + Math.round(Math.abs(Math.sin(i * 1.7 + seed) * 0.6 + Math.sin(i * 0.45 + seed * 2) * 0.4) * 18));
}

// 지금 소리가 나는 재생 줄의 멈춤 함수 — 다른 줄을 누르면 먼저 멈춘다
let stopCurrent: (() => void) | null = null;

export function SiteAudio({ url, durationSec, size = 'md', tone = 'gray', onRemove, style }: {
  url: string; durationSec?: number | null; size?: 'md' | 'sm'; tone?: 'gray' | 'paper'; onRemove?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const stopRef = useRef<(() => void) | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const press = usePress(0.92);
  const heights = useMemo(() => waveHeights(url), [url]);

  function reset() {
    if (tick.current) { clearInterval(tick.current); tick.current = null; }
    setPlaying(false);
    setElapsed(0);
  }
  function stop() {
    const s = stopRef.current;
    stopRef.current = null;
    if (stopCurrent === stop) stopCurrent = null;
    s?.();
    reset();
  }
  const stopLatest = useRef(stop);
  stopLatest.current = stop;
  useEffect(() => () => { const s = stopRef.current; stopRef.current = null; s?.(); if (tick.current) clearInterval(tick.current); }, []);
  // 화면이 가려지면(다른 탭·글 열기) 재생 정지 — 숨겨 둔 화면에서 소리가 계속 나지 않게
  useOnScreenInactive(() => { if (stopRef.current) stop(); });
  // 다른 녹음으로 바뀌면 재생 정지
  useEffect(() => { stop(); }, [url]);  // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() {
    if (stopRef.current) { stop(); return; }
    stopCurrent?.();
    const mine = () => stopLatest.current();
    stopCurrent = mine;
    setPlaying(true);
    setElapsed(0);
    const t0 = Date.now();
    tick.current = setInterval(() => setElapsed((Date.now() - t0) / 1000), 120);
    let ended = false;
    const s = playAudio(url, () => { ended = true; stopRef.current = null; if (stopCurrent === mine) stopCurrent = null; reset(); });
    if (!ended) stopRef.current = s;
  }

  const total = Math.max(0, durationSec ?? 0);
  const progress = playing && total > 0 ? Math.min(1, elapsed / total) : 0;
  const on = Math.round(progress * BARS);
  const sm = size === 'sm';
  const circle = sm ? 32 : 40;
  const paper = tone === 'paper';

  return (
    <View style={[{ height: sm ? 48 : 56, borderRadius: radius.card, backgroundColor: paper ? colors.surface : colors.bgSoft, flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 16, gap: 12 }, style]}>
      <Pressable onPress={toggle} onPressIn={press.onPressIn} onPressOut={press.onPressOut} hitSlop={4} accessibilityRole="button" accessibilityLabel={playing ? '음성 멈추기' : '음성 듣기'}>
        <Animated.View style={[{ width: circle, height: circle, borderRadius: circle / 2, backgroundColor: paper ? colors.bgSoft : colors.surface, alignItems: 'center', justifyContent: 'center' }, press.scaleStyle]}>
          <PlayGlyph playing={playing} />
        </Animated.View>
      </Pressable>
      <View pointerEvents="none" style={{ flex: 1, minWidth: 0, height: 24, flexDirection: 'row', alignItems: 'center', gap: 2, overflow: 'hidden' }}>
        {heights.map((h, i) => <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: i < on ? colors.text : colors.chevron }} />)}
      </View>
      <Text style={{ fontSize: 13, lineHeight: 13, fontWeight: '500', color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{mss(playing ? Math.min(elapsed, total || elapsed) : total)}</Text>
      {!!onRemove && (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel="음성 빼기" style={{ width: 32, height: 32, marginRight: -10, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.control, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={14} color={colors.textSecondary} />
          </View>
        </Pressable>
      )}
    </View>
  );
}
