// 야화 — 미니게임: 사다리타기 (네이버 사다리게임 방식 3단계 플로우).
// 1단계 인원 선택 → 2단계 이름/결과 직접 입력 → 3단계 사다리 실행/결과.
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Circle } from 'react-native-svg';
import { colors, radius } from '../tokens';
import { Icons } from '../icons';
import { LadderCharacter } from '../components/LadderCharacter';
import { NavBar, Btn } from '../components/atoms';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 24;
const ROWS = 8; // 사다리 세로 칸 수(가로 막대가 놓일 행)

// 칸별 경로 색 — 시작 칸 순서대로 순환 배정.
const PLAYER_COLORS = [
  '#bf3127', '#3B82F6', '#0EBE6F', '#9B59F5', '#F2A53E', '#E11D48',
  '#0EA5E9', '#F59E0B', '#8B5CF6', '#14B8A6', '#EC4899', '#22C55E',
];
const colorFor = (i: number) => PLAYER_COLORS[i % PLAYER_COLORS.length];

// 가로 막대(rung) 생성 — 같은 행에서 인접 막대는 붙지 않게. 모든 칸 사이에 최소 1개 보장.
function genRungs(cols: number): boolean[][] {
  const gaps = cols - 1;
  const rungs: boolean[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row = new Array(gaps).fill(false);
    for (let g = 0; g < gaps; g++) {
      if (g > 0 && row[g - 1]) continue; // 인접 막대 붙지 않게
      row[g] = Math.random() < 0.45;
    }
    rungs.push(row);
  }
  // 한 번도 안 놓인 칸 사이가 있으면 강제로 1개 배치 (양옆이 비어 있는 행을 찾아서)
  for (let g = 0; g < gaps; g++) {
    if (rungs.some((row) => row[g])) continue;
    const candidates: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      const leftOk = g === 0 || !rungs[r][g - 1];
      const rightOk = g === gaps - 1 || !rungs[r][g + 1];
      if (leftOk && rightOk) candidates.push(r);
    }
    if (candidates.length) rungs[candidates[Math.floor(Math.random() * candidates.length)]][g] = true;
  }
  return rungs;
}

// 시작 칸에서 사다리를 타고 내려간 경로(각 행 레벨의 열) + 도착 칸.
function trace(start: number, rungs: boolean[][], cols: number): { end: number; levels: number[] } {
  let pos = start;
  const levels = [pos];
  for (let r = 0; r < rungs.length; r++) {
    if (pos > 0 && rungs[r][pos - 1]) pos -= 1;
    else if (pos < cols - 1 && rungs[r][pos]) pos += 1;
    levels.push(pos);
  }
  return { end: pos, levels };
}

type Pt = { x: number; y: number };
type PlayedPath = { start: number; end: number; points: Pt[]; color: string };

// 행 레벨 경로 → 꺾이는 지점 폴리라인 좌표.
function toPolyline(levels: number[], x: (c: number) => number, y: (r: number) => number): Pt[] {
  const pts: Pt[] = [{ x: x(levels[0]), y: y(0) }];
  for (let r = 0; r < levels.length - 1; r++) {
    pts.push({ x: x(levels[r]), y: y(r + 1) }); // 세로 내려가기
    if (levels[r + 1] !== levels[r]) pts.push({ x: x(levels[r + 1]), y: y(r + 1) }); // 가로 이동
  }
  return pts;
}

type Phase = 'setup' | 'input' | 'play' | 'result';

// 결과 문구로 당첨/꽝 판별해 색상 강조 (직관적으로 승패가 보이도록).
function prizeColor(prize: string): string {
  if (/당첨|축하|성공|win/i.test(prize)) return colors.success;
  if (/꽝|탈락|실패|lose/i.test(prize)) return colors.mute;
  return colors.text;
}

export function LadderGame({ onBack }: { onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [phase, setPhase] = useState<Phase>('setup');
  const [count, setCount] = useState(6);
  // 이름/결과는 count 크기의 배열로 관리(빈 문자열 허용).
  const [names, setNames] = useState<string[]>(() => Array(6).fill(''));
  const [prizes, setPrizes] = useState<string[]>(() => Array(6).fill(''));

  // 3단계 사다리 상태
  const [rungs, setRungs] = useState<boolean[][]>([]);
  const [played, setPlayed] = useState<PlayedPath[]>([]);
  const [current, setCurrent] = useState<PlayedPath | null>(null);
  const [lastPlayed, setLastPlayed] = useState<PlayedPath | null>(null);
  const running = current != null;
  const anim = useRef(new Animated.Value(0)).current;

  // 빈 칸 기본값 대체.
  const nameOf = (i: number) => (names[i]?.trim() ? names[i].trim() : `참가자 ${i + 1}`);
  const prizeOf = (i: number) => (prizes[i]?.trim() ? prizes[i].trim() : `결과 ${i + 1}`);

  // ── 1단계: 인원 조절 ──────────────────────────────────────────────
  function changeCount(next: number) {
    const n = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, next));
    setCount(n);
    // 입력 배열 길이를 n에 맞춤(기존 입력 유지).
    setNames((prev) => resize(prev, n));
    setPrizes((prev) => resize(prev, n));
  }

  // ── 2→3단계: 사다리 생성 후 실행 화면으로 ─────────────────────────
  function startLadder() {
    setRungs(genRungs(count));
    setPlayed([]);
    setCurrent(null);
    setLastPlayed(null);
    anim.setValue(0);
    setPhase('play');
  }

  // 사다리만 새로 생성(입력값 유지).
  function regenerate() {
    setRungs(genRungs(count));
    setPlayed([]);
    setCurrent(null);
    setLastPlayed(null);
    anim.setValue(0);
  }

  // ── 3단계 레이아웃 — 항상 화면 폭에 맞춰 배치(가로 스크롤 제거) ────
  const PAD = 20;
  const cols = count;
  const boardW = Math.min(width, 480) - PAD * 2;
  const colGap = cols > 1 ? boardW / (cols - 1) : boardW;
  const rowH = 34;
  const boardH = rowH * ROWS + 16;
  const x = (c: number) => PAD + c * colGap;
  const y = (r: number) => 8 + r * rowH;
  const svgW = boardW + PAD * 2;
  const cellW = Math.max(22, Math.min(colGap - 4, 60)); // 칸(이름/결과) 폭 — 인원 많으면 자동 축소
  const colLeft = (c: number, w: number) => PAD + c * colGap - w / 2; // svg 좌표계 기준 칸 중심 정렬

  // 아직 안 탄 결과 칸으로 이어지는 시작 칸 찾기(결과 칸 클릭 시).
  const startForEnd = (endCol: number): number | null => {
    for (let s = 0; s < cols; s++) {
      if (played.some((p) => p.start === s)) continue;
      if (trace(s, rungs, cols).end === endCol) return s;
    }
    return null;
  };
  // 전체 결과(이름 → 도착 결과) 매핑.
  const allResults = () => Array.from({ length: cols }, (_, s) => ({ start: s, end: trace(s, rungs, cols).end }));

  function play(s: number) {
    if (running || played.some((p) => p.start === s)) return;
    const { end, levels } = trace(s, rungs, cols);
    const path: PlayedPath = { start: s, end, points: toPolyline(levels, x, y), color: colorFor(s) };
    setCurrent(path);
    setLastPlayed(null);
    anim.setValue(0);
    // 경로 길이에 비례한 등속 진행
    let len = 0;
    for (let i = 1; i < path.points.length; i++) {
      len += Math.abs(path.points[i].x - path.points[i - 1].x) + Math.abs(path.points[i].y - path.points[i - 1].y);
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 400 + len * 2.2,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      setPlayed((prev) => [...prev, path]);
      setCurrent(null);
      setLastPlayed(path);
    });
  }

  const allDone = played.length === cols;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgSoft }}>
      <NavBar
        title="사다리타기"
        left={
          <Pressable
            onPress={() => {
              // 단계별 뒤로: result→play→input→setup, setup에서는 화면 나가기.
              if (phase === 'result') setPhase('play');
              else if (phase === 'play') setPhase('input');
              else if (phase === 'input') setPhase('setup');
              else onBack?.();
            }}
            style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icons.chevLeft size={22} color={colors.text} />
          </Pressable>
        }
      />

      {phase === 'setup' && (
        <SetupStep
          count={count}
          onChange={changeCount}
          onStart={() => setPhase('input')}
          bottomInset={insets.bottom}
        />
      )}

      {phase === 'input' && (
        <InputStep
          count={count}
          names={names}
          prizes={prizes}
          setNames={setNames}
          setPrizes={setPrizes}
          onBack={() => setPhase('setup')}
          onStart={startLadder}
          bottomInset={insets.bottom}
        />
      )}

      {phase === 'play' && (
        <>
          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}
            showsVerticalScrollIndicator={false}
          >
            {/* 안내 말풍선 */}
            <View style={{ alignItems: 'center', marginTop: 14, paddingHorizontal: 20 }}>
              <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 }}>
                <Text style={{ fontSize: 11.5, color: colors.sub, fontWeight: '600' }}>
                  {allDone ? '모두 확인했어요 · 전체 결과를 눌러보세요' : running ? '사다리를 타는 중…' : '이름이나 결과를 클릭하세요'}
                </Text>
              </View>
            </View>

            <View style={{ width: svgW, alignSelf: 'center', marginTop: 10 }}>
              {/* 위: 캐릭터(탭해서 시작) — 이름 텍스트는 좁은 폭에서 못 읽으므로 캐릭터로 식별 */}
              <View style={{ height: 46 }}>
                {Array.from({ length: cols }).map((_, c) => {
                  const done = played.find((p) => p.start === c);
                  const active = current?.start === c;
                  const tint = done?.color ?? (active ? colorFor(c) : null);
                  return (
                    <Pressable
                      key={c}
                      onPress={() => play(c)}
                      disabled={running || !!done}
                      hitSlop={4}
                      style={{
                        position: 'absolute',
                        left: colLeft(c, cellW),
                        width: cellW,
                        height: 46,
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <View
                        style={{
                          borderRadius: 999,
                          padding: 2,
                          backgroundColor: tint ? tint + '33' : 'transparent',
                          borderWidth: active ? 2 : 0,
                          borderColor: tint ?? 'transparent',
                        }}
                      >
                        <LadderCharacter index={c} size={Math.min(34, cellW - 4)} dimmed={!!done} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* 사다리 SVG */}
              <View style={{ height: boardH }}>
                <Svg width={svgW} height={boardH}>
                  {/* 세로줄 */}
                  {Array.from({ length: cols }).map((_, c) => (
                    <Line
                      key={`v${c}`}
                      x1={x(c)} y1={y(0)} x2={x(c)} y2={y(ROWS)}
                      stroke={colors.line} strokeWidth={3} strokeLinecap="round"
                    />
                  ))}
                  {/* 가로 막대 */}
                  {rungs.map((row, r) =>
                    row.map((on, g) =>
                      on ? (
                        <Line
                          key={`h${r}-${g}`}
                          x1={x(g)} y1={y(r + 1)} x2={x(g + 1)} y2={y(r + 1)}
                          stroke={colors.line} strokeWidth={3} strokeLinecap="round"
                        />
                      ) : null,
                    ),
                  )}
                  {/* 완주 경로 — 각자 색으로 표시 */}
                  {played.map((p) =>
                    p.points.slice(1).map((pt, i) => (
                      <Line
                        key={`d${p.start}-${i}`}
                        x1={p.points[i].x} y1={p.points[i].y} x2={pt.x} y2={pt.y}
                        stroke={p.color} strokeWidth={4} strokeLinecap="round" opacity={0.55}
                      />
                    )),
                  )}
                  {/* 진행 중 경로 — 공을 따라 점진적으로 그려짐 */}
                  {current && <AnimatedTrail anim={anim} path={current} />}
                </Svg>
              </View>

              {/* 아래: 결과 — 좁은 폭에서도 읽히도록 번호 원형. 실제 결과 문구는 아래 범례에서 확인 */}
              <View style={{ height: 40 }}>
                {Array.from({ length: cols }).map((_, c) => {
                  const owner = played.find((p) => p.end === c);
                  return (
                    <Pressable
                      key={c}
                      onPress={() => {
                        if (running || owner) return;
                        const st = startForEnd(c);
                        if (st != null) play(st);
                      }}
                      disabled={running || !!owner}
                      hitSlop={4}
                      style={{
                        position: 'absolute',
                        left: colLeft(c, cellW),
                        width: cellW,
                        height: 40,
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        paddingTop: 4,
                      }}
                    >
                      <View
                        style={{
                          width: Math.min(30, cellW - 4),
                          height: Math.min(30, cellW - 4),
                          borderRadius: 999,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: owner ? owner.color : colors.surface,
                          borderWidth: 2,
                          borderColor: owner ? owner.color : colors.line,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '800', color: owner ? '#fff' : colors.sub }}>
                          {c + 1}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 결과 범례 — 번호가 어떤 결과인지. 확인된 참가자는 캐릭터로 함께 표시 */}
            <View style={{ marginTop: 16, paddingHorizontal: 20, gap: 6 }}>
              {Array.from({ length: cols }).map((_, c) => {
                const owner = played.find((p) => p.end === c);
                return (
                  <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: owner ? owner.color : colors.bgSoft,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '800', color: owner ? '#fff' : colors.mute }}>{c + 1}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 11.5, fontWeight: '700', color: prizeColor(prizeOf(c)) }} numberOfLines={1}>
                      {prizeOf(c)}
                    </Text>
                    {owner && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <LadderCharacter index={owner.start} size={20} />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }} numberOfLines={1}>
                          {nameOf(owner.start)}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* 마지막 결과 배너 */}
            {lastPlayed && (
              <View style={{ marginTop: 18, alignItems: 'center', paddingHorizontal: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: lastPlayed.color, textAlign: 'center' }}>
                  {nameOf(lastPlayed.start)} → {prizeOf(lastPlayed.end)}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* 하단 버튼 */}
          <View
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: insets.bottom + 16,
              flexDirection: 'row',
              gap: 10,
            }}
          >
            <Btn kind="line" size="lg" onPress={regenerate} disabled={running} style={{ flex: 1 }}>
              다시하기
            </Btn>
            <Btn kind="primary" size="lg" onPress={() => setPhase('result')} disabled={running} style={{ flex: 1 }}>
              전체 결과 보기
            </Btn>
          </View>
        </>
      )}

      {phase === 'result' && (
        <View style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingTop: 20, paddingBottom: insets.bottom + 120 }}>
            <Text style={{ fontSize: 15.5, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 18 }}>
              사다리 결과
            </Text>
            <View style={{ gap: 16 }}>
              {allResults().map(({ start, end }) => (
                <View key={start} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colorFor(start) }} />
                  <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.text, minWidth: 92 }} numberOfLines={1}>
                    {nameOf(start)}
                  </Text>
                  <Icons.chev size={16} color={colors.mute} />
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: prizeColor(prizeOf(end)), flexShrink: 1 }} numberOfLines={1}>
                    {prizeOf(end)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View
            style={{
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: insets.bottom + 16,
              flexDirection: 'row',
              gap: 10,
            }}
          >
            <Btn kind="line" size="lg" onPress={() => setPhase('play')} style={{ flex: 1 }}>
              사다리 보기
            </Btn>
            <Btn kind="primary" size="lg" onPress={() => { regenerate(); setPhase('play'); }} style={{ flex: 1 }}>
              다시하기
            </Btn>
          </View>
        </View>
      )}
    </View>
  );
}

// 배열 길이를 n에 맞추되 기존 값 유지.
function resize(arr: string[], n: number): string[] {
  if (arr.length === n) return arr;
  if (arr.length > n) return arr.slice(0, n);
  return [...arr, ...Array(n - arr.length).fill('')];
}

// ── 1단계: 인원 선택 ──────────────────────────────────────────────────
function SetupStep({
  count,
  onChange,
  onStart,
  bottomInset,
}: {
  count: number;
  onChange: (n: number) => void;
  onStart: () => void;
  bottomInset: number;
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 15.5, fontWeight: '800', color: colors.text, textAlign: 'center', lineHeight: 23 }}>
          참여 인원 수를 알려주세요.{'\n'}최대 24명까지 함께 할 수 있어요.
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 28, marginTop: 40 }}>
          <Stepper label="−" onPress={() => onChange(count - 1)} disabled={count <= MIN_PLAYERS} />
          <Text style={{ fontSize: 36, fontWeight: '800', color: colors.text, width: 96, textAlign: 'center' }}>
            {count}
          </Text>
          <Stepper label="+" onPress={() => onChange(count + 1)} disabled={count >= MAX_PLAYERS} />
        </View>
        <Text style={{ marginTop: 12, fontSize: 11.5, color: colors.sub }}>명</Text>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: bottomInset + 16 }}>
        <Btn kind="primary" full size="lg" onPress={onStart}>
          시작
        </Btn>
      </View>
    </View>
  );
}

function Stepper({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ fontSize: 23.5, fontWeight: '700', color: colors.text, marginTop: -2 }}>{label}</Text>
    </Pressable>
  );
}

// ── 2단계: 이름/결과 입력 ────────────────────────────────────────────
function InputStep({
  count,
  names,
  prizes,
  setNames,
  setPrizes,
  onBack,
  onStart,
  bottomInset,
}: {
  count: number;
  names: string[];
  prizes: string[];
  setNames: React.Dispatch<React.SetStateAction<string[]>>;
  setPrizes: React.Dispatch<React.SetStateAction<string[]>>;
  onBack: () => void;
  onStart: () => void;
  bottomInset: number;
}) {

  // 참가자 1명 = 가로 한 줄(캐릭터 · 이름 · 결과). 네이버 사다리처럼 세로로 쌓아
  // 인원이 12명이어도 가로 스크롤 없이 한 화면에서 입력한다.
  // 컴포넌트가 아닌 함수로 렌더 — 렌더마다 새 컴포넌트를 정의하면 input이 remount되어
  // 타이핑 중 포커스가 풀린다.
  const inputStyle = {
    flex: 1,
    height: 42,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    fontSize: 11.5,
    fontWeight: '700' as const,
    color: colors.text,
  };
  const renderRow = (i: number) => (
    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 34, alignItems: 'center' }}>
        <LadderCharacter index={i} size={32} />
      </View>
      <TextInput
        value={names[i] ?? ''}
        onChangeText={(t) => setNames((prev) => setAt(prev, i, t))}
        placeholder={`참가자 ${i + 1}`}
        placeholderTextColor={colors.mute}
        maxLength={12}
        style={inputStyle}
      />
      <Icons.chev size={14} color={colors.mute} />
      <TextInput
        value={prizes[i] ?? ''}
        onChangeText={(t) => setPrizes((prev) => setAt(prev, i, t))}
        placeholder={`결과 ${i + 1}`}
        placeholderTextColor={colors.mute}
        maxLength={12}
        style={inputStyle}
      />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          marginTop: 16,
          marginBottom: 4,
          textAlign: 'center',
          fontSize: 13.5,
          fontWeight: '700',
          color: colors.text,
        }}
      >
        이름과 당첨 항목을 적어주세요.
      </Text>

      <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2, marginBottom: 2 }}>
          <View style={{ width: 34 }} />
          <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.mute }}>참가자</Text>
          <View style={{ width: 14 }} />
          <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.mute }}>결과</Text>
        </View>
        {Array.from({ length: count }).map((_, i) => renderRow(i))}
      </View>

      <Text style={{ textAlign: 'center', fontSize: 11, color: colors.mute, paddingHorizontal: 24 }}>
        비워두면 자동으로 기본값이 들어가요.
      </Text>

      <View
        style={{
          marginTop: 'auto',
          paddingHorizontal: 16,
          paddingBottom: bottomInset + 16,
          flexDirection: 'row',
          gap: 10,
        }}
      >
        <Btn kind="line" size="lg" onPress={onBack} style={{ flex: 1 }}>
          돌아가기
        </Btn>
        <Btn kind="primary" size="lg" onPress={onStart} style={{ flex: 1 }}>
          사다리 시작
        </Btn>
      </View>
    </View>
  );
}

// 불변 업데이트 헬퍼.
function setAt(arr: string[], i: number, v: string): string[] {
  const next = [...arr];
  next[i] = v;
  return next;
}

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// 경로를 등속으로 따라가는 공 + 공 뒤로 그려지는 선.
function AnimatedTrail({ anim, path }: { anim: Animated.Value; path: PlayedPath }) {
  const pts = path.points;
  // 세그먼트 길이 누적 → anim(0~1)을 거리 기준 시각으로 매핑 (등속)
  const times: number[] = [0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
    times.push(total);
  }
  const ts = times.map((t) => (total > 0 ? t / total : 0));

  const cx = anim.interpolate({ inputRange: ts, outputRange: pts.map((p) => p.x) });
  const cy = anim.interpolate({ inputRange: ts, outputRange: pts.map((p) => p.y) });

  return (
    <>
      {pts.slice(1).map((pt, i) => {
        const t0 = ts[i];
        const t1 = ts[i + 1];
        const x2 = anim.interpolate({ inputRange: [t0, t1], outputRange: [pts[i].x, pt.x], extrapolate: 'clamp' });
        const y2 = anim.interpolate({ inputRange: [t0, t1], outputRange: [pts[i].y, pt.y], extrapolate: 'clamp' });
        const op = anim.interpolate({ inputRange: [t0, Math.min(t0 + 0.001, 1)], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
          <AnimatedLine
            key={i}
            x1={pts[i].x} y1={pts[i].y}
            x2={x2 as never} y2={y2 as never}
            stroke={path.color} strokeWidth={4} strokeLinecap="round"
            strokeOpacity={op as never}
          />
        );
      })}
      <AnimatedCircle cx={cx as never} cy={cy as never} r={7} fill={path.color} />
    </>
  );
}
