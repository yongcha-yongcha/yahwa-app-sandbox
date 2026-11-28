// 야화 — 오늘의 인연 카드 줄 (리뉴얼 1120 · 시안 #discovery, spec-dating §3.1)
// 한 장씩 넘기는 가로 카드 줄: 카드 폭 = 화면 − 60, 카드 사이 10, 좌우 30 → 가운데 한 장 + 양옆 20씩 보인다.
// 카드 상태: 공개 전(시간이 안 됨 — 흐린 사진 + 빛 덩이 + '공개 예정') · 열기 전(흐린 사진 + 'HH:00에 도착한 인연' + 한 장면)
//   · 연 뒤(선명한 사진 + 이름 · 나이 · 인증 · 사는 곳 · 한 장면) · 마지막 '더 소개받기' 카드.
// 카드 아래 버튼 줄(52)은 한 벌만 두고 가운데 카드에 따라 바뀐다: 'HH:00에 열어볼 수 있어요' → '인연 열어보기'(진한 파랑) → '프로필 보기 ›' / 관계 알약.
// 열기 = 그 자리에서 흐림이 걷히는 모션(reveal.js). 잠긴 카드는 선명한 사진을 아예 올리지 않는다(흐린 사진만).
// 옆에 살짝 보이는 카드를 누르면 열리지 않고 그 카드로 넘어간다.
import React, { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Animated, Easing, FlatList, Platform, Pressable, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors, ease, palette } from '../../tokens';
import { Button, Icon, NATIVE, reduceMotion, usePress } from '../../ui';
import { thumbUrl } from '../../lib/img';
import { kstHour } from '../../lib/deck';
import { ProfilePhoto } from './ProfilePhoto';
import { CertBadge, EnvelopePill, RIcons, TwoHearts } from './icons';
import { FactIcon } from '../entry/art';
import { BalanceCard } from './balance/BalanceCard';
import type { BalanceSide } from './balance/content';
import { ScaleMark } from './balance/ScaleMark';
import { useBalanceFocusReq, type BalanceLook } from './balance/state';

const isWeb = Platform.OS === 'web';
const RADIUS = 22;
const GAP = 10;
const SIDE = 30;
const PHOTO_POS = { top: '40%', left: '50%' } as const;
// 사진 위 글자 · 막 — 시안 고정값(토큰에 없는 반투명 흰색 · 어둠)
const W88 = 'rgba(255,255,255,0.88)';
const W22 = 'rgba(255,255,255,0.22)';
const VEIL = 'rgba(39,48,55,0.27)';
const DEEP = (a: number) => `rgba(26,33,38,${a})`;
const TEXT_SHADOW = { textShadowColor: DEEP(0.22), textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 } as const;
const ARRIVE_SHADOW = { textShadowColor: DEEP(0.3), textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 } as const;
const keepAll = (isWeb ? { wordBreak: 'keep-all' } : null) as object | null;

// 하단 메뉴 '인연 홈' 칸의 점 — 공개됐는데 아직 안 연 카드가 있으면 켠다(lib/navDots가 읽는다)
let unseen = false;
const unseenSubs = new Set<() => void>();
function setDeckUnseen(v: boolean) { if (v === unseen) return; unseen = v; unseenSubs.forEach((f) => f()); }
export function useDeckUnseen(): boolean {
  return useSyncExternalStore((cb) => { unseenSubs.add(cb); return () => { unseenSubs.delete(cb); }; }, () => unseen, () => unseen);
}

// 가운데 카드 자리 기억 — 프로필에 다녀오거나 화면이 다시 그려져도 보던 카드에서 이어진다(배치가 바뀌면 처음부터)
const indexMemo: { key: string; index: number } = { key: '', index: 0 };

// 관계 알약(호감 칸 · 편지 칸)
export type Relation = {
  like: 'none' | 'sent' | 'received' | 'mutual';
  letter: 'none' | 'sent' | 'received' | 'connected';
  letterId?: string;
};
export type DiscoveryPerson = {
  id: string; name: string; age?: number | null; photo?: string | null;
  opened: boolean;                       // 홈에서 연 카드(선명한 사진)
  hour: number | null;                   // 공개 시각(12·15·18·21) — 없으면 추가 소개 · 보너스로 받은 사람
  extra?: 'paid' | 'bonus' | 'balance' | null;
  balanceChip?: string | null;           // 오늘의 밸런스로 소개받은 사람 — 카드에 '같이 {칩}'
  region?: string | null;
  scene?: string | null;                 // "이 사람의 한 장면" — 소개 한 토막
  verified?: boolean; hiCert?: boolean;  // 본인 인증 / 학력 · 직장 · 소득 인증 있음
  relation: Relation;
};
export type PendingCard = { hour: number; hoursLeft: number; photo?: string | null };
type Item =
  | { kind: 'person'; key: string; p: DiscoveryPerson }
  | { kind: 'pending'; key: string; c: PendingCard }
  | { kind: 'balance'; key: string }
  | { kind: 'more'; key: string };

// 오늘의 밸런스 카드(1번 인연 다음 칸) — 표지 → [열어보기] 뒤집기 → 카드를 눌러 고르기
export type BalanceProps = {
  look: BalanceLook;
  opened: boolean;
  pick: BalanceSide | '';
  date: string;
  busy: boolean;
  introId: string | null;      // 고른 답으로 소개받은 사람(없으면 null)
  onOpen: () => void;
  onPick: (side: BalanceSide) => void;
};

export type MoreCardProps = {
  count: number;            // 한 번에 더 소개받는 수(지금 2, 리프 정책 v2)
  done: boolean;            // 이번 배치에 이미 받음
  busy: boolean;
  onMore: () => void;
};

const COUNT_WORD = ['', '한', '두', '세', '네', '다섯'];

export function DiscoveryDeck({ people, pending, batchKey, width, cardHeight, more, balance, onReveal, onProfile, onLetter, onPending }: {
  people: DiscoveryPerson[];
  pending: PendingCard[];           // 아직 안 열린 시간대 카드(두 장씩)
  batchKey: string;
  width: number;                    // 화면 폭
  cardHeight: number;
  more: MoreCardProps;
  balance?: BalanceProps;           // 없으면(비회원 등) 밸런스 카드를 넣지 않는다
  onReveal: (id: string) => boolean;   // '인연 열어보기' — 열 수 있으면 true(기록은 부모가 남긴다)
  onProfile: (id: string) => void;
  onLetter: (letterId: string) => void;
  onPending: (hour: number) => void;
}) {
  const cardW = Math.max(240, width - SIDE * 2);
  const step = cardW + GAP;
  // 순서: 공개된 슬롯 → 아직 안 열린 시간대 → 추가 소개 · 보너스로 받은 사람(시안: 8장 뒤, 마지막 카드 앞) → 더 소개받기
  // 오늘의 밸런스는 맨 앞 칸(1번 인연보다 앞) — 첫 화면은 1번 칸에서 시작하고, 왼쪽으로 넘겨야 밸런스가 나온다.
  // 고르면 같은 쪽을 고른 사람이 1번 칸(밸런스 바로 다음)에 생기고, '같은 쪽 사람을 찾았어요'를 잠깐 보여 준 뒤 그 카드로 넘어간다.
  // 밸런스 카드는 참여한 뒤에도 결과 면 그대로 남는다(아래 줄에 '내일 또 만나요').
  const hasBalance = !!balance;
  const introP = balance?.introId ? people.find((p) => p.id === balance.introId && p.extra === 'balance') : undefined;
  const ordered = useMemo<Item[]>(() => {
    const person = (p: DiscoveryPerson): Item => ({ kind: 'person', key: `p:${p.id}`, p });
    const list: Item[] = [
      ...people.filter((p) => p.hour != null).map(person),
      ...pending.map((c, i): Item => ({ kind: 'pending', key: `t:${c.hour}:${i}`, c })),
      ...people.filter((p) => p.hour == null && p.extra !== 'balance').map(person),
      { kind: 'more', key: 'more' },
    ];
    if (hasBalance) list.unshift({ kind: 'balance', key: 'balance' }, ...(introP ? [person(introP)] : []));
    return list;
  }, [people, pending, hasBalance, introP]);
  // 처음 보여 줄 칸 — 1번 인연(밸런스 칸들 다음)
  const startIndex = hasBalance ? 1 : 0;
  const balanceIndex = ordered.findIndex((it) => it.kind === 'balance');

  useEffect(() => { setDeckUnseen(people.some((p) => !p.opened)); }, [people]);

  if (indexMemo.key !== batchKey) { indexMemo.key = batchKey; indexMemo.index = Math.min(startIndex, ordered.length - 1); }
  const [index, setIndexState] = useState(() => Math.min(indexMemo.index, ordered.length - 1));
  const setIndex = (i: number) => { indexMemo.index = i; setIndexState(i); };
  // 카드 수가 줄면(숨김 · 차단) 끝을 넘지 않게
  useEffect(() => { if (index > ordered.length - 1) setIndex(ordered.length - 1); }, [ordered.length]);  // eslint-disable-line react-hooks/exhaustive-deps

  const listRef = useRef<FlatList<Item>>(null);
  const goTo = (i: number) => { listRef.current?.scrollToOffset({ offset: i * step, animated: !reduceMotion() }); setIndex(i); };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(ordered.length - 1, Math.round(e.nativeEvent.contentOffset.x / step)));
    if (i !== indexMemo.index) setIndex(i);
  };

  // 카드 누름 — 옆 카드는 그 카드로 넘어가기만, 가운데 카드는 상태에 맞는 동작. 카드가 다시 그려지지 않게 콜백은 하나를 계속 쓴다
  const pressRef = useRef<(i: number) => void>(() => {});
  pressRef.current = (i) => {
    const it = ordered[i];
    if (!it) return;
    if (i !== indexMemo.index) { goTo(i); return; }
    if (it.kind === 'person') { if (it.p.opened) onProfile(it.p.id); else onReveal(it.p.id); }
    else if (it.kind === 'pending') onPending(it.c.hour);
    else if (it.kind === 'balance' && balance && !balance.opened) balance.onOpen();
  };
  // 방금 골랐으면 — 소개받은 사람이 1번 칸에 생기면 잠깐 뒤 그 카드로 넘어간다
  const prevPick = useRef(balance?.pick ?? '');
  const advanceWanted = useRef(false);
  useEffect(() => {
    const p = balance?.pick ?? '';
    if (p && !prevPick.current) advanceWanted.current = true;
    prevPick.current = p;
  }, [balance?.pick]);
  useEffect(() => {
    if (!advanceWanted.current || !introP || balanceIndex < 0) return;
    advanceWanted.current = false;
    const t = setTimeout(() => { if (indexMemo.index === balanceIndex) goTo(balanceIndex + 1); }, reduceMotion() ? 600 : 1400);
    return () => clearTimeout(t);
  }, [introP?.id]);  // eslint-disable-line react-hooks/exhaustive-deps
  // 시연도구 '밸런스 카드로 가기'
  const focusReq = useBalanceFocusReq();
  useEffect(() => { if (focusReq && balanceIndex >= 0) goTo(balanceIndex); }, [focusReq]);  // eslint-disable-line react-hooks/exhaustive-deps
  const onCardPress = useCallback((i: number) => pressRef.current(i), []);

  const active = ordered[Math.min(index, ordered.length - 1)];
  const compact = cardHeight < 460;

  return (
    <View>
      <FlatList
        ref={listRef}
        data={ordered}
        horizontal
        keyExtractor={(it) => it.key}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
        decelerationRate="fast"
        snapToInterval={step}
        snapToAlignment="start"
        disableIntervalMomentum
        scrollEventThrottle={32}
        onScroll={onScroll}
        initialScrollIndex={index}
        getItemLayout={(_d, i) => ({ length: step, offset: step * i, index: i })}
        initialNumToRender={3}
        windowSize={3}
        maxToRenderPerBatch={2}
        extraData={index}
        style={[{ height: cardHeight, flexGrow: 0 }, isWeb ? ({ scrollSnapType: 'x mandatory' } as object) : null]}
        contentContainerStyle={{ paddingLeft: SIDE, paddingRight: SIDE - GAP }}
        renderItem={({ item, index: i }) => (
          <View style={[{ width: cardW, height: cardHeight, marginRight: GAP }, isWeb ? ({ scrollSnapAlign: 'center', scrollSnapStop: 'always' } as object) : null]}>
            {item.kind === 'person' ? (
              <PersonCard p={item.p} i={i} w={cardW} h={cardHeight} compact={compact} live={Math.abs(i - index) <= 1} focused={i === index} onPress={onCardPress} />
            ) : item.kind === 'pending' ? (
              <PendingCardView c={item.c} i={i} w={cardW} h={cardHeight} live={Math.abs(i - index) <= 1} onPress={onCardPress} />
            ) : item.kind === 'balance' && balance ? (
              <BalanceCard w={cardW} h={cardHeight} look={balance.look} opened={balance.opened} pick={balance.pick} date={balance.date}
                onPress={() => onCardPress(i)} onPick={(k) => { if (i === indexMemo.index && !balance.busy) balance.onPick(k); else onCardPress(i); }} />
            ) : (
              <MoreCard {...more} onFocus={i !== index ? () => goTo(i) : undefined} />
            )}
          </View>
        )}
      />
      {/* 아래 버튼 줄 — 카드 아래 12, 좌우 30, 높이 52. 마지막 카드에서는 비어 있다 */}
      <View style={{ marginTop: 12, marginHorizontal: SIDE, height: 52 }}>
        <ActionRow
          item={active}
          onReveal={onReveal}
          onProfile={onProfile}
          onLetter={onLetter}
          balance={balance}
          introComing={!!balance?.introId}
        />
      </View>
    </View>
  );
}

// ── 빛 덩이(공개 전 · 열기 전) — 지름 = 카드 폭 82%의 방사형 원 4개가 천천히 오간다. 가운데 카드와 양옆만 움직인다 ──
const BLOBS = [
  { c: palette.sky[300], a: 0.85, x: -0.22, y: -0.12, from: [0, 0, 1], to: [0.34, 0.22, 1.18], ms: 11000, anchor: 'tl' },
  { c: palette.rose[300], a: 0.85, x: -0.26, y: 0.18, from: [0, 0, 1.1], to: [-0.3, 0.26, 0.92], ms: 14300, anchor: 'tr' },
  { c: palette.gold[200], a: 0.9, x: -0.1, y: -0.18, from: [0, 0, 0.95], to: [0.28, -0.3, 1.15], ms: 9350, anchor: 'bl' },
  { c: palette.sage[300], a: 0.85, x: -0.18, y: -0.08, from: [0, 0, 1.05], to: [-0.26, -0.24, 0.9], ms: 12650, anchor: 'br' },
] as const;
const Blobs = memo(function Blobs({ w, live, strength }: { w: number; live: boolean; strength: number }) {
  const d = Math.round(w * 0.82);
  const vs = useRef(BLOBS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (!live || reduceMotion()) return;
    const loops = vs.map((v, i) => Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: BLOBS[i].ms / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: NATIVE }),
      Animated.timing(v, { toValue: 0, duration: BLOBS[i].ms / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: NATIVE }),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [live, vs]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: strength }]}>
      {BLOBS.map((b, i) => {
        const pos = b.anchor === 'tl' ? { left: b.x * w, top: `${b.y * 100}%` } : b.anchor === 'tr' ? { right: b.x * w, top: `${b.y * 100}%` }
          : b.anchor === 'bl' ? { left: b.x * w, bottom: `${b.y * 100}%` } : { right: b.x * w, bottom: `${b.y * 100}%` };
        const v = vs[i];
        return (
          <Animated.View
            key={i}
            style={[{ position: 'absolute', width: d, height: d }, pos as object, {
              transform: [
                { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [b.from[0] * d, b.to[0] * d] }) },
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [b.from[1] * d, b.to[1] * d] }) },
                { scale: v.interpolate({ inputRange: [0, 1], outputRange: [b.from[2], b.to[2]] }) },
              ],
            }]}
          >
            <Svg width={d} height={d}>
              <Defs>
                <RadialGradient id={`rvb${i}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={b.c} stopOpacity={b.a} />
                  <Stop offset="0.66" stopColor={b.c} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle cx={d / 2} cy={d / 2} r={d / 2} fill={`url(#rvb${i})`} />
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
});

// 흐린 카드 공통 막 — 옅은 어둠 + 아래로 짙어지는 그라데이션
function LockVeil() {
  return (
    <>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: VEIL }]} />
      <LinearGradient pointerEvents="none" colors={[DEEP(0.02), DEEP(0), DEEP(0.48)]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
    </>
  );
}

// ── 공개 전 카드 ──
const PendingCardView = memo(function PendingCardView({ c, i, w, h, live, onPress }: { c: PendingCard; i: number; w: number; h: number; live: boolean; onPress: (i: number) => void }) {
  return (
    <Pressable onPress={() => onPress(i)} accessibilityRole="button" accessibilityLabel={`${c.hour}시에 공개되는 인연`} style={{ width: w, height: h, borderRadius: RADIUS, overflow: 'hidden', backgroundColor: colors.selected }}>
      {/* 가장자리 번짐이 카드 밖으로 나가게 조금 키운다 */}
      <ProfilePhoto src={c.photo} width={w} height={h} radius={0} blur={17} scale={1.15} position={PHOTO_POS} thumbWidth={240} />
      <Blobs w={w} live={live} strength={0.6} />
      <LockVeil />
      <Text style={{ position: 'absolute', left: 0, right: 0, top: 18, textAlign: 'center', fontSize: 20, lineHeight: 26, fontWeight: '700', color: W88, fontVariant: ['tabular-nums'] }}>{c.hour}:00</Text>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: 0.4, color: colors.inverse }}>공개 예정</Text>
        <View style={{ marginTop: 8, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, backgroundColor: W22 }}>
          <Text style={{ fontSize: 12, lineHeight: 20, color: colors.inverse }}>{c.hoursLeft}시간 뒤에 만나요</Text>
        </View>
      </View>
    </Pressable>
  );
}, (a, b) => a.i === b.i && a.w === b.w && a.h === b.h && a.live === b.live && a.c.hour === b.c.hour && a.c.hoursLeft === b.c.hoursLeft && a.c.photo === b.c.photo);

// ── 사람 카드(열기 전 → 연 뒤) ──
function arriveText(p: DiscoveryPerson) {
  // 배치는 낮 12시에 바뀐다 — 정오 전에 보이는 카드는 어제 그 시각에 도착한 사람(대표 11-21: 규칙 유지, 문구로 구분)
  if (p.hour != null) return `${kstHour() < 12 ? '어제 ' : ''}${p.hour}:00에 도착한 인연`;
  if (p.extra === 'balance') return '';
  return p.extra === 'bonus' ? '보너스로 도착한 인연' : '새로 도착한 인연';
}
const E = ease.out;
const CARD_FIELDS = ['id', 'name', 'age', 'photo', 'opened', 'hour', 'extra', 'balanceChip', 'region', 'scene', 'verified', 'hiCert'] as const;
const PersonCard = memo(function PersonCard({ p, i, w, h, compact, live, focused, onPress }: {
  p: DiscoveryPerson; i: number; w: number; h: number; compact: boolean; live: boolean; focused: boolean; onPress: (i: number) => void;
}) {
  // veil: 흐린 층이 올라가 있는지. 처음부터 연 카드는 흐린 층을 만들지 않는다
  const [veil, setVeil] = useState(!p.opened);
  const wasOpen = useRef(p.opened);
  const out = useRef(new Animated.Value(0)).current;      // 열기 전 글(도착 문구 · 한 장면) 사라짐
  const clear = useRef(new Animated.Value(p.opened ? 1 : 0)).current;   // 흐린 층 걷힘
  const zoom = useRef(new Animated.Value(p.opened ? 1 : 0)).current;    // 사진이 살짝 큰 데서 물러남
  const tint = useRef(new Animated.Value(p.opened ? 1 : 0)).current;    // 아래 어둠 층
  const lines = useRef([0, 1, 2, 3].map(() => new Animated.Value(p.opened ? 1 : 0))).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (p.opened === wasOpen.current) return;
    wasOpen.current = p.opened;
    if (!p.opened) { setVeil(true); [out, clear, zoom, tint, ...lines].forEach((v) => v.setValue(0)); return; }
    const t = (v: Animated.Value, duration: number, delay: number, easing = E) => Animated.timing(v, { toValue: 1, duration, delay, easing, useNativeDriver: NATIVE });
    if (reduceMotion()) {
      Animated.parallel([t(out, 200, 0), t(clear, 300, 0), t(tint, 300, 0), ...lines.map((v) => t(v, 200, 0))]).start(() => setVeil(false));
      zoom.setValue(1);
      return;
    }
    Animated.parallel([
      t(out, 200, 0, Easing.out(Easing.ease)),
      t(clear, 1200, 120),
      t(zoom, 1850, 120),
      t(tint, 1200, 540),
      ...lines.map((v, i) => t(v, 900, 650 + i * 70)),
    ]).start(() => setVeil(false));
  }, [p.opened]);  // eslint-disable-line react-hooks/exhaustive-deps

  // 열기 전 숨쉬기 — 더 흐린 같은 사진이 4초마다 떠올랐다 가라앉는다(가운데 카드만)
  const breathing = veil && !p.opened && focused;
  useEffect(() => {
    if (!breathing || reduceMotion()) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: NATIVE }),
      Animated.timing(breath, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: NATIVE }),
    ]));
    loop.start();
    return () => { loop.stop(); breath.setValue(0); };
  }, [breathing, breath]);

  const rise = (v: Animated.Value) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] });
  const src = p.photo ? { uri: thumbUrl(p.photo, 720) ?? p.photo } : null;
  const sceneLines = compact ? 1 : 2;
  return (
    <Pressable
      onPress={() => onPress(i)}
      accessibilityRole="button"
      accessibilityLabel={p.opened ? `${p.name}${p.age != null ? `, ${p.age}세` : ''}, 프로필 보기` : '인연 열어보기'}
      style={{ width: w, height: h, borderRadius: RADIUS, overflow: 'hidden', backgroundColor: colors.selected }}
    >
      {/* 선명한 사진 — 연 카드에만 올린다 */}
      {p.opened && !!src && (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1.038, 1] }) }] }]}>
          <Image source={src} style={{ width: '100%', height: '100%' }} contentFit="cover" contentPosition={PHOTO_POS} cachePolicy="memory-disk" />
        </Animated.View>
      )}
      {p.opened && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: tint }]}>
          <LinearGradient colors={[DEEP(0), DEEP(0), DEEP(0.2), DEEP(0.42)]} locations={[0, 0.45, 0.7, 1]} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
      {/* 흐린 층 — 열면 서서히 걷힌다 */}
      {veil && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: clear.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
          <ProfilePhoto src={p.photo} width={w} height={h} radius={0} blur={12} scale={1.25} position={PHOTO_POS} thumbWidth={240} />
          {breathing && (
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: breath }]}>
              <ProfilePhoto src={p.photo} width={w} height={h} radius={0} blur={18} scale={1.25} position={PHOTO_POS} thumbWidth={240} />
            </Animated.View>
          )}
          <Blobs w={w} live={live && !p.opened} strength={0.36} />
          <LockVeil />
        </Animated.View>
      )}
      {/* 열기 전 글 */}
      {veil && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
          <Text style={[{ position: 'absolute', left: 0, right: 0, top: 22, textAlign: 'center', fontSize: 12, lineHeight: 20, fontWeight: '500', color: colors.inverse, fontVariant: ['tabular-nums'] }, ARRIVE_SHADOW]}>{arriveText(p)}</Text>
          {!!p.scene && (
            <View style={{ position: 'absolute', left: 22, right: 22, bottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 18, opacity: 0.8 }}>
                <RIcons.sun size={14} color={colors.selected} />
                <Text style={{ fontSize: 12, lineHeight: 18, color: colors.selected }}>이 사람의 한 장면</Text>
              </View>
              <Text numberOfLines={sceneLines} lineBreakStrategyIOS="hangul-word" style={[{ marginTop: 6, fontSize: 15, lineHeight: 24, color: colors.inverse }, keepAll]}>{p.scene}</Text>
            </View>
          )}
        </Animated.View>
      )}
      {/* 오늘의 밸런스로 소개받은 사람 — 위 가운데 '같이 부먹파' 칩 */}
      {!!p.balanceChip && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 16, alignItems: 'center' }}>
          <View style={{ height: 30, paddingHorizontal: 12, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.92)' }}>
            <ScaleMark tilt={p.balanceChip} />
            <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '700', color: colors.text }}>같이 {p.balanceChip}</Text>
          </View>
        </View>
      )}
      {/* 연 뒤 글 — 이름 줄 · 사는 곳 · 한 장면 제목 · 한 장면 글이 차례로 떠오른다 */}
      {p.opened && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 64, paddingHorizontal: 20, paddingBottom: 20 }}>
          <LinearGradient colors={['rgba(39,48,55,0)', 'rgba(39,48,55,0.25)', 'rgba(39,48,55,0.38)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
          <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, rise(lines[0])]}>
            <Text numberOfLines={1} style={[{ flexShrink: 1, fontSize: 24, lineHeight: 32.4, fontWeight: '600', letterSpacing: -0.3, color: colors.inverse }, TEXT_SHADOW]}>
              {p.name}{p.age != null ? `, ${p.age}세` : ''}
            </Text>
            {p.verified && <CertBadge size={24} hi={p.hiCert} onPhoto />}
          </Animated.View>
          {!!p.region && (
            <Animated.View style={[{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }, rise(lines[1])]}>
              <FactIcon name="pin" size={16} color={W88} />
              <Text numberOfLines={1} style={[{ flexShrink: 1, fontSize: 14, lineHeight: 21, letterSpacing: -0.2, color: W88 }, TEXT_SHADOW]}>{p.region}</Text>
            </Animated.View>
          )}
          {!!p.scene && (
            <>
              <Animated.View style={[{ marginTop: 12 }, rise(lines[2])]}>
                <Text style={[{ fontSize: 12, lineHeight: 20, fontWeight: '500', color: W88 }, TEXT_SHADOW]}>✦ 이 사람의 한 장면</Text>
              </Animated.View>
              <Animated.View style={[{ marginTop: 6 }, rise(lines[3])]}>
                <Text numberOfLines={sceneLines} lineBreakStrategyIOS="hangul-word" style={[{ fontSize: 15, lineHeight: 24, fontWeight: '500', color: colors.inverse }, TEXT_SHADOW, keepAll]}>{p.scene}</Text>
              </Animated.View>
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}, (a, b) => a.i === b.i && a.w === b.w && a.h === b.h && a.compact === b.compact && a.live === b.live && a.focused === b.focused && CARD_FIELDS.every((k) => a.p[k] === b.p[k]));

// ── 마지막 카드: 더 소개받기(11-22 '8명 다 보면 보너스 1명'은 없앴다) ──
function MoreCard({ count, done, busy, onMore, onFocus }: MoreCardProps & { onFocus?: () => void }) {
  const word = COUNT_WORD[count] ?? String(count);
  const body = (
    <View style={{ flex: 1, borderRadius: RADIUS, backgroundColor: colors.bgSoft, paddingVertical: 28, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' }}>
      <Text accessibilityRole="header" style={{ fontSize: 28, lineHeight: 40.6, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{'아직 만나지 못한\n인연이 기다려요'}</Text>
      <Text style={{ marginTop: 12, fontSize: 14, lineHeight: 23.8, color: colors.text, textAlign: 'center' }}>새로운 {word} 사람을 소개해드릴게요.</Text>
      <Button
        size="dock" block={false} label={done ? '오늘은 모두 소개받았어요' : `${count}명 더 소개받기`} disabled={done} loading={busy && !done}
        onPress={onMore} style={{ marginTop: 32, width: '100%', maxWidth: 260, alignSelf: 'center' }}
      />
    </View>
  );
  // 옆에 살짝 보일 때는 누르면 이 카드로 넘어오기만 한다
  return onFocus ? <Pressable onPress={onFocus} accessibilityLabel="더 소개받기 카드로 이동" style={{ flex: 1 }}><View pointerEvents="none" style={{ flex: 1 }}>{body}</View></Pressable> : body;
}

// ── 아래 버튼 줄 ──
type PillDef = { key: string; label: string; tone: 'white' | 'rose'; icon?: (color: string) => React.ReactNode; right?: boolean; onPress: () => void; a11y: string };
function pillsFor(p: DiscoveryPerson, onProfile: (id: string) => void, onLetter: (id: string) => void): PillDef[] {
  const r = p.relation;
  const profile = () => onProfile(p.id);
  if (r.letter === 'connected') {
    return [{ key: 'conn', label: '서로 연결됨 · 편지함에서 이어가기', tone: 'rose', icon: (c) => <TwoHearts color={c} />, onPress: () => (r.letterId ? onLetter(r.letterId) : profile()), a11y: `${p.name} 님, 서로 연결됨, 편지함에서 이어가기` }];
  }
  const out: PillDef[] = [];
  if (r.like === 'mutual') out.push({ key: 'mutual', label: '서로 호감', tone: 'rose', icon: (c) => <TwoHearts color={c} />, onPress: profile, a11y: `${p.name} 님, 서로 호감, 프로필 보기` });
  else if (r.like === 'sent') out.push({ key: 'like-sent', label: '호감 보냄', tone: 'white', icon: () => <RIcons.heart24 size={18} color={colors.love} />, onPress: profile, a11y: `${p.name} 님, 호감 보냄, 프로필 보기` });
  else if (r.like === 'received') out.push({ key: 'like-in', label: '호감 받음', tone: 'white', icon: () => <RIcons.heart24 size={18} color={colors.love} />, onPress: profile, a11y: `${p.name} 님, 호감 받음, 프로필 보기` });
  if (r.letter === 'sent') out.push({ key: 'letter-sent', label: '편지 보냄', tone: 'white', icon: (c) => <RIcons.check size={18} color={c} />, onPress: profile, a11y: `${p.name} 님, 편지 보냄, 프로필 보기` });
  else if (r.letter === 'received') out.push({ key: 'letter-in', label: '편지 받음', tone: 'white', icon: (c) => <EnvelopePill color={c} />, onPress: () => (r.letterId ? onLetter(r.letterId) : profile()), a11y: `${p.name} 님, 편지 받음, 편지 열기` });
  if (!out.length) out.push({ key: 'profile', label: '프로필 보기', tone: 'white', icon: (c) => <Icon name="chevron-right" size={18} color={c} />, right: true, onPress: profile, a11y: `${p.name} 님 프로필 보기` });
  return out;
}

function Pill({ d }: { d: PillDef }) {
  const press = usePress(0.97);
  const rose = d.tone === 'rose';
  const fg = rose ? colors.inverse : colors.btnSecondaryFg;
  const icon = d.icon?.(fg);
  return (
    <Pressable onPress={d.onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={d.a11y} style={{ flex: 1 }}>
      <Animated.View style={[{ height: 52, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden', backgroundColor: rose ? colors.loveStrong : colors.surface }, press.scaleStyle]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: rose ? palette.rose[700] : colors.bgSoft, opacity: press.p }]} />
        {!rose && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 12, borderWidth: 1, borderColor: colors.lineControl }]} />}
        {!d.right && icon}
        <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, lineHeight: 21, fontWeight: '600', color: fg }}>{d.label}</Text>
        {d.right && icon}
      </Animated.View>
    </Pressable>
  );
}

function ActionRow({ item, onReveal, onProfile, onLetter, balance, introComing }: {
  item: Item; onReveal: (id: string) => boolean; onProfile: (id: string) => void; onLetter: (id: string) => void;
  balance?: BalanceProps; introComing: boolean;
}) {
  // 열어보기 → 프로필 보기/알약: 옛 줄이 살짝 가라앉으며 사라지고(150ms 뒤 180ms) 새 줄이 10 아래에서 떠오른다(300ms부터 320ms)
  const v = useRef(new Animated.Value(1)).current;
  const opened = item.kind === 'person' && item.p.opened;
  const [seen, setSeen] = useState({ key: item.key, opened });
  const [holdReady, setHoldReady] = useState(false);   // 열리는 동안 잠깐 '인연 열어보기'를 남겨 둔다
  if (seen.key !== item.key || seen.opened !== opened) {
    // 같은 카드가 방금 열렸을 때만 전환을 재생한다(다른 카드로 넘기면 바로 바뀐다)
    setHoldReady(seen.key === item.key && !seen.opened && opened && !reduceMotion());
    setSeen({ key: item.key, opened });
  }
  const rising = useRef(false);
  useEffect(() => {
    if (!holdReady) {
      if (!rising.current) { v.setValue(1); return; }
      rising.current = false;
      v.setValue(2);
      Animated.timing(v, { toValue: 1, duration: 320, easing: E, useNativeDriver: NATIVE }).start();
      return;
    }
    const a = Animated.timing(v, { toValue: 0, duration: 180, delay: 150, easing: Easing.in(Easing.ease), useNativeDriver: NATIVE });
    a.start(({ finished }) => { if (finished) { rising.current = true; setHoldReady(false); } });
    return () => a.stop();
  }, [holdReady, v]);

  let body: React.ReactNode = null;
  if (item.kind === 'balance' && balance) {
    // 표지: [열어보기] · 뒤집힌 뒤: 버튼 없이 카드를 눌러 고른다 · 고른 뒤: 다음 질문 안내 한 줄(정오에 새 질문)
    if (!balance.opened && !balance.pick) body = <Button block size="L" label="열어보기" onPress={balance.onOpen} />;
    else if (balance.pick) {
      const when = kstHour() < 12 ? '오늘 12시' : '내일 12시';
      body = (
        <View style={{ height: 52, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.textSecondary }}>{introComing ? `${when}, 새 질문으로 또 만나요` : `오늘은 같은 쪽 사람이 없어요 · ${when}에 또 만나요`}</Text>
        </View>
      );
    }
  } else if (item.kind === 'pending') {
    body = <Button block size="L" disabled label={`${item.c.hour}:00에 열어볼 수 있어요`} />;
  } else if (item.kind === 'person') {
    const p = item.p;
    if (!p.opened || holdReady) {
      body = <OpenButton onPress={() => { onReveal(p.id); }} />;
    } else {
      const pills = pillsFor(p, onProfile, onLetter);
      body = <View style={{ flexDirection: 'row', gap: 8 }}>{pills.map((d) => <Pill key={d.key} d={d} />)}</View>;
    }
  }
  return (
    <Animated.View style={{ opacity: v.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1, 2], outputRange: [4, 0, 10] }) }] }}>
      {body}
    </Animated.View>
  );
}

// '인연 열어보기' — 대표 결정(open=deep): 진한 파랑 바탕 + 흰 글씨, 높이 52 · 모서리 12 · 15/600
function OpenButton({ onPress }: { onPress: () => void }) {
  return <Button block size="L" label="인연 열어보기" onPress={onPress} />;
}
