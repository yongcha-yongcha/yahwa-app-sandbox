// 야화 — 마음함 탭 화면 (리뉴얼 1120 · spec-dating §3.5 · §3.12)
// 제목 + 밑줄 탭(보낸 · 받은 · 서로, 기본 받은) + 두 칸 사진 카드(3:4).
// 카드: 오른쪽 위 D-n 칩, 왼쪽 아래 이름(새로 온 마음이면 장미 점) · 나이 · 인증 배지.
// 7일이 지나면(서버 mind_photo_state 판정) 사진이 흐려지고 가운데 '다시 보기' → 다시 보기 시트(10리프, 남녀 공통) → 흐림이 걷힌 뒤 프로필.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import { colors, dur, ease, layout, radius } from '../tokens';
import { getCurrentUserId, previewActions, usePreview, previewSelectors } from '../lib/previewStore';
import { useFriendProfiles, useMyInterests } from '../lib/hooks';
import { HIDE_IOS_CURRENCY } from '../lib/flags';
import { markViewed } from '../lib/viewed';
import { appNav } from '../lib/appNav';
import type { FriendProfile } from '../lib/api';
import { usePairs, type Pair } from '../lib/pairs';
import { useNewInterests } from '../lib/navDots';
import { useNow } from '../lib/useNow';
import { restoreRef, saveScrollHandler } from '../lib/scrollMemory';
import { SwipeTabs } from '../components/SwipeTabs';
import { useScreenActive, useOnScreenInactive } from '../components/KeepAlive';
import { ProfilePhoto } from '../components/affinity/ProfilePhoto';
import { useMindPhotoState, useUnlockMindPhoto, isMindMasked, type MindMode } from '../components/affinity/mindPhoto';
import { useLeafPricing } from '../lib/leafPricing';
import { CertBadge } from '../components/affinity/icons';
import { keepAll } from '../components/affinity/ui';
import { LockIcon } from '../components/letters/ui';
import {
  BottomSheet, BreathingDots, Dot, Icon, LeafCostCard, NATIVE, SheetButtons, SheetHeader, TabTitle, TopTabs,
  reduceMotion, usePress, useTabBarClearance,
} from '../ui';
import { setDeckDetail } from './AffinityDeck';

// 마음함 탭(시안: 보낸 · 받은 · 서로, 기본 = 받은)
export type HeartTabKey = MindMode;
const HEART_TABS: HeartTabKey[] = ['sent', 'received', 'mutual'];
const HEART_LABEL: Record<HeartTabKey, string> = { sent: '보낸', received: '받은', mutual: '서로' };
const PAGE = 12;   // 한 번에 12명, 넘으면 '더보기'
const GAP = 12;
const DAY = 86_400_000;

export function HeartBox({ onOpenFriend, gate }: { onOpenFriend?: (userId: string) => void; gate?: React.ReactNode }) {
  const [tab, setTab] = useState<HeartTabKey>('received');
  // 숨겨 둔 화면(KeepAlive)에서는 '봤다'고 기록하지 않는다 — 보고 있을 때만 점을 지운다
  const screenActive = useScreenActive();
  const newLikes = useNewInterests(screenActive && tab === 'received');
  // 새로 온 마음 — 받은 탭을 여는 순간 '봤다'고 기록되므로, 이 화면을 보는 동안에는 카드·탭의 점을 남겨 둔다(화면을 떠나면 지움)
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!newLikes.ids.length) return;
    setFreshIds((prev) => {
      const add = newLikes.ids.filter((id) => !prev.has(id));
      return add.length ? new Set([...prev, ...add]) : prev;
    });
  }, [newLikes.ids]);
  useOnScreenInactive(() => setFreshIds(new Set()));
  const myUid = getCurrentUserId();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TabTitle title="마음함" subtitle="서로에게 조금 더 가까워지는 마음" />
      {gate ?? (!myUid ? (
        // 비회원 — 빈 화면 틀로 로그인 안내
        <EmptyState
          icon={<HandIcon kind="heart" />}
          title="로그인하면 볼 수 있어요"
          desc="주고받은 마음이 이곳에 모여요."
          cta="로그인하기"
          onCta={() => previewActions.requireLogin('마음함은 로그인 후 볼 수 있어요')}
        />
      ) : (
        <>
          <TopTabs
            items={HEART_TABS.map((k) => ({ key: k, label: HEART_LABEL[k], dot: k === 'received' && (newLikes.count > 0 || freshIds.size > 0) }))}
            value={tab}
            onChange={setTab}
          />
          <SwipeTabs index={HEART_TABS.indexOf(tab)} count={HEART_TABS.length} onIndexChange={(i) => setTab(HEART_TABS[i])} style={{ flex: 1 }}>
            <HeartGrid key={tab} mode={tab} freshIds={freshIds} onOpenProfile={onOpenFriend} onGoTab={setTab} />
          </SwipeTabs>
        </>
      ))}
    </View>
  );
}

type Item = { pair: Pair; prof: FriendProfile };

function HeartGrid({ mode, freshIds, onOpenProfile, onGoTab }: {
  mode: HeartTabKey; freshIds: Set<string>; onOpenProfile?: (userId: string) => void; onGoTab: (t: HeartTabKey) => void;
}) {
  const pairs = usePairs();
  const friendsQ = useFriendProfiles();
  const interestsQ = useMyInterests();
  const { width: winW } = useWindowDimensions();
  const bottomSpace = useTabBarClearance();
  const cellW = (winW - layout.gutter * 2 - GAP) / 2;
  const [limit, setLimit] = useState(PAGE);
  // 7일 가림 · 다시 보기(10리프, 남녀 공통 — 리프 정책 v2)
  const mindQ = useMindPhotoState();
  const unlockMut = useUnlockMindPhoto();
  const nowMs = useNow(60_000);   // 화면을 켜 둔 동안 7일이 지나도 바로 가리게
  const unlockCost = useLeafPricing().prices.mind_photo;
  const balance = usePreview(previewSelectors.leafBalance);
  const [unlockFor, setUnlockFor] = useState<FriendProfile | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [revealing, setRevealing] = useState<string | null>(null);   // 방금 다시 연 사람 — 흐림이 걷히는 동안
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useOnScreenInactive(() => setSheetOpen(false));
  useEffect(() => () => { if (revealTimer.current) clearTimeout(revealTimer.current); }, []);

  const openProfile = (uid: string) => { markViewed(uid); setDeckDetail(null); onOpenProfile?.(uid); };
  const pay = unlockCost;
  const short = !HIDE_IOS_CURRENCY && balance < pay;
  function unlock() {
    const uid = unlockFor?.user_id;
    if (!uid || unlockMut.isPending) return;
    if (short) { setSheetOpen(false); previewActions.openPaywall(unlockCost, `다시 보기에는 ${unlockCost}리프가 필요해요.`); return; }
    unlockMut.mutate(uid, {
      onSuccess: () => {
        // 시트가 내려간 뒤(240ms) 그 카드의 흐림이 420ms 동안 걷히고 → 프로필
        setSheetOpen(false);
        setRevealing(uid);
        revealTimer.current = setTimeout(() => {
          setRevealing(null);
          openProfile(uid);
          previewActions.showToast('7일 동안 다시 볼 수 있어요.');
        }, reduceMotion() ? dur.reduced : dur.sheetOut + 420);
      },
      onError: (e: any) => {
        setSheetOpen(false);
        if (e?.code === '53100' || String(e?.message ?? '').includes('insufficient')) {
          previewActions.openPaywall(unlockCost, `다시 보기에는 ${unlockCost}리프가 필요해요.`);
        } else {
          previewActions.showToast('잠시 후 다시 시도해주세요', 2200);
        }
      },
    });
  }

  const items = useMemo<Item[]>(() => {
    const byId = new Map((friendsQ.data ?? []).map((f) => [f.user_id, f]));
    return [...pairs.values()]
      .filter((p) => (mode === 'received' ? p.receivedInterest : mode === 'sent' ? p.sentInterest : p.sentInterest && p.receivedInterest))
      .sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1))
      .flatMap((p) => {
        const prof = byId.get(p.otherId) as FriendProfile | undefined;
        return prof ? [{ pair: p, prof }] : [];
      });
  }, [pairs, friendsQ.data, mode]);
  // 관심 목록이 프로필 목록보다 새로운데 프로필이 없는 상대가 있으면(방금 받은 관심 등) 프로필을 다시 받는다
  const missingProfile = useMemo(() => {
    if (!friendsQ.data) return false;
    const have = new Set(friendsQ.data.map((f) => f.user_id));
    return [...pairs.values()].some((p) => !have.has(p.otherId));
  }, [pairs, friendsQ.data]);
  const lettersAt = useQueryClient().getQueryState(['letters'])?.dataUpdatedAt ?? 0;
  const pairsAt = Math.max(interestsQ.dataUpdatedAt, lettersAt);
  useEffect(() => {
    if (missingProfile && !friendsQ.isFetching && pairsAt > friendsQ.dataUpdatedAt) void friendsQ.refetch();
  }, [missingProfile, friendsQ.isFetching, friendsQ.dataUpdatedAt, pairsAt]);  // eslint-disable-line react-hooks/exhaustive-deps

  const hasReceived = useMemo(() => [...pairs.values()].some((p) => p.receivedInterest && !p.sentInterest), [pairs]);
  const loading = interestsQ.isLoading || friendsQ.isLoading;
  const shown = useMemo(() => items.slice(0, limit), [items, limit]);
  const scrollKey = `heart:${mode}`;

  const onCardPress = (prof: FriendProfile) => {
    // 가려진 사람은 '다시 보기' 시트부터(다른 경로 — 편지 등 — 로 열 때는 가리지 않는다)
    if (isMindMasked(mindQ.data?.get(prof.user_id), mode, Date.now())) { setUnlockFor(prof); setSheetOpen(true); return; }
    openProfile(prof.user_id);
  };

  if (loading) {
    return <View style={{ flex: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', paddingBottom: bottomSpace }}><BreathingDots /></View>;
  }
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ref={restoreRef(scrollKey)}
        data={shown}
        keyExtractor={(it) => it.pair.otherId}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        onScroll={saveScrollHandler(scrollKey)}
        scrollEventThrottle={32}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ flexGrow: 1, paddingTop: 20, paddingHorizontal: layout.gutter, paddingBottom: bottomSpace, gap: GAP }}
        renderItem={({ item }) => {
          const row = mindQ.data?.get(item.prof.user_id);
          const uid = item.prof.user_id;
          return (
            <HeartCard
              prof={item.prof}
              width={cellW}
              masked={isMindMasked(row, mode, nowMs)}
              revealing={revealing === uid}
              days={mindDaysLeft(row, mode, item.pair.lastActivityAt, nowMs)}
              fresh={mode === 'received' && freshIds.has(uid)}
              onPress={onCardPress}
            />
          );
        }}
        ListEmptyComponent={<HeartEmpty mode={mode} hasReceived={hasReceived} onGoTab={onGoTab} />}
        ListFooterComponent={items.length > shown.length ? (
          <Pressable onPress={() => setLimit(items.length)} accessibilityRole="button" style={({ pressed }) => ({ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.textSecondary }}>더보기</Text>
            <Icon name="chevron-down" size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      />

      {/* 다시 보기 시트(§3.12) */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} dismissable={!unlockMut.isPending}>
        <View style={{ paddingBottom: 16, marginBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <ProfilePhoto src={unlockFor?.photos?.[0]} width={42} height={56} radius={8} blur={6} scale={1.15} thumbWidth={160} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text }}>{unlockFor?.nickname}</Text>
            <View style={{ marginTop: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <LockIcon />
              <Text style={{ fontSize: 12, lineHeight: 18, color: colors.mute }}>7일이 지나 가려졌어요</Text>
            </View>
          </View>
        </View>
        <SheetHeader title="다시 볼까요?" desc="다시 열면 7일 동안 프로필과 사진을 볼 수 있어요. 쓴 리프는 돌려받지 않아요." />
        {!HIDE_IOS_CURRENCY && <LeafCostCard cost={unlockCost} balance={balance} style={short ? { marginBottom: 8 } : undefined} />}
        {short && <Text style={{ marginBottom: 20, fontSize: 12, lineHeight: 18, fontWeight: '600', color: colors.loveStrong, textAlign: 'right' }}>{pay - balance}리프가 더 필요해요</Text>}
        <SheetButtons onCancel={() => setSheetOpen(false)} confirmLabel={short ? '리프 충전하기' : '다시 보기'} onConfirm={unlock} loading={unlockMut.isPending} />
      </BottomSheet>
    </View>
  );
}

// 남은 날짜 — 다시 보기로 연 뒤에는 연 기한까지, 아니면 기준(받은 때 · 보낸 때 · 둘 중 늦은 때)에서 7일까지(올림)
function mindDaysLeft(
  row: { received_at: string | null; sent_at: string | null; unlocked_until?: string | null } | undefined,
  mode: HeartTabKey, fallback: string, now: number,
): number {
  const t = (v?: string | null) => (v ? new Date(v).getTime() : 0);
  const until = t(row?.unlocked_until);
  if (until > now) return Math.ceil((until - now) / DAY);
  const base = row ? (mode === 'received' ? t(row.received_at) : mode === 'sent' ? t(row.sent_at) : Math.max(t(row.received_at), t(row.sent_at))) : 0;
  const b = base || t(fallback) || now;
  return Math.max(0, Math.ceil((b + 7 * DAY - now) / DAY));
}

// 사진 카드(.hb-card) — 3:4 · 모서리 16 · 누르면 97%(120ms)
const HeartCard = React.memo(function HeartCard({ prof, width, masked, revealing, days, fresh, onPress }: {
  prof: FriendProfile; width: number; masked: boolean; revealing: boolean; days: number; fresh: boolean; onPress: (p: FriendProfile) => void;
}) {
  const press = usePress(0.97, dur.press, dur.press);
  const height = (width * 4) / 3;
  const off = masked && !revealing;
  // 흐림 걷힘 — 흐린 사진(위) 투명도 1 → 0, 420ms. 흐림 값 자체는 움직이지 않는다(안드로이드)
  const veil = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!revealing) { veil.setValue(1); return; }
    Animated.timing(veil, { toValue: 0, duration: reduceMotion() ? 0 : 420, delay: reduceMotion() ? 0 : dur.sheetOut, easing: ease.out, useNativeDriver: NATIVE }).start();
  }, [revealing, veil]);
  const blurLayer = masked || revealing;
  const hasCert = !!prof.basic_verified || !!prof.credentials?.length;
  return (
    <Pressable
      onPress={() => onPress(prof)}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={off ? `${prof.nickname}, 가려진 프로필 다시 보기` : `${prof.nickname} 프로필 보기${fresh ? ', 새로 온 마음' : ''}`}
    >
      <Animated.View style={[{ width, height, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.muted }, press.scaleStyle]}>
        {(!masked || revealing) && (
          <View style={StyleSheet.absoluteFill}>
            <ProfilePhoto src={prof.photos?.[0]} width={width} height={height} radius={0} position={{ left: '50%', top: '40%' }} thumbWidth={480} />
          </View>
        )}
        {blurLayer && (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: veil }, GRAY]}>
            <ProfilePhoto src={prof.photos?.[0]} width={width} height={height} radius={0} blur={10} scale={1.15} position={{ left: '50%', top: '40%' }} thumbWidth={240} />
          </Animated.View>
        )}
        <LinearGradient pointerEvents="none" colors={SHADE} locations={[0.45, 0.7, 1]} style={StyleSheet.absoluteFill} />
        {!off && (
          <View style={{ position: 'absolute', top: 8, right: 8, height: 22, paddingHorizontal: 8, borderRadius: 11, backgroundColor: CHIP_BG, justifyContent: 'center' }}>
            <Text style={{ fontSize: 11, lineHeight: 22, fontWeight: '600', color: colors.inverse }}>D-{days}</Text>
          </View>
        )}
        {off && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <View style={{ height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.92)', justifyContent: 'center' }}>
              <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.text }}>다시 보기</Text>
            </View>
          </View>
        )}
        <View pointerEvents="none" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text numberOfLines={1} style={[{ flexShrink: 1, fontSize: 16, lineHeight: 20.8, fontWeight: '600', color: colors.inverse }, TEXT_SHADOW]}>{prof.nickname}</Text>
            {fresh && !off && <Dot size={6} color={colors.love} ring={2} label="새로 온 마음" />}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {!!prof.age && <Text style={[{ fontSize: 13, lineHeight: 16.9, fontWeight: '600', color: 'rgba(255,255,255,0.92)' }, TEXT_SHADOW]}>{prof.age}세</Text>}
            {hasCert && <CertBadge size={16} hi={!!prof.credentials?.length} onPhoto />}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});
// 사진 위 어둠(#1A2126 — 45% 0 → 70% .2 → 100% .48) · D-n 칩 바탕
const SHADE = ['rgba(26,33,38,0)', 'rgba(26,33,38,0.2)', 'rgba(26,33,38,0.48)'] as const;
const CHIP_BG = 'rgba(26,33,38,0.5)';
const TEXT_SHADOW = { textShadowColor: 'rgba(0,0,0,0.22)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 };
// 가린 사진은 회색 30%(웹만 — 앱은 흐림만)
const GRAY = Platform.OS === 'web' ? ({ filter: 'grayscale(0.3)' } as object) : null;

// ── 빈 화면(.he-a) — 목록 자리 가운데 · 최소 360: 손그림 44 → 제목 15/500 → 설명 12(최대 250) → 글자 링크 13/600 + 꺾쇠 16 ──
function HeartEmpty({ mode, hasReceived, onGoTab }: { mode: HeartTabKey; hasReceived: boolean; onGoTab: (t: HeartTabKey) => void }) {
  const goHome = () => appNav({ kind: 'tab', tab: 'affinity' });
  if (mode === 'sent') {
    return <EmptyState icon={<HandIcon kind="heart" />} title="아직 보낸 마음이 없어요" desc="마음이 가는 인연에게 하트를 보내 보세요. 보낸 마음은 이곳에 모여요." cta="오늘의 인연 보러 가기" onCta={goHome} />;
  }
  if (mode === 'received') {
    return <EmptyState icon={<HandIcon kind="letter" />} title="아직 도착한 마음이 없어요" desc="누군가 하트를 보내면 바로 알려 드릴게요. 소개를 조금 더 채우면 마음이 더 잘 닿아요." cta="내 소개 다듬기" onCta={() => appNav({ kind: 'profileEdit' })} />;
  }
  return (
    <EmptyState
      icon={<HandIcon kind="two" />}
      title="아직 서로 닿은 마음이 없어요"
      desc="서로 하트를 보내면 이곳에 모이고, 편지로 먼저 인사할 수 있어요."
      cta={hasReceived ? '받은 마음 확인하기' : '오늘의 인연 보러 가기'}
      onCta={hasReceived ? () => onGoTab('received') : goHome}
    />
  );
}

function EmptyState({ icon, title, desc, cta, onCta }: { icon: React.ReactNode; title: string; desc: string; cta: string; onCta: () => void }) {
  // 탭을 바꾸면 6px 아래에서 260ms로 떠오른다(움직임 줄이기면 나타나기만)
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.timing(v, { toValue: 1, duration: 260, easing: ease.out, useNativeDriver: NATIVE });
    a.start();
    return () => a.stop();
  }, [v]);
  const rise = reduceMotion() ? null : { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] };
  return (
    <Animated.View style={[{ minHeight: 360, alignItems: 'center', justifyContent: 'center', paddingHorizontal: layout.gutter, opacity: v }, rise]}>
      {icon}
      <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 22.5, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' }}>{title}</Text>
      <Text style={[keepAll, { marginTop: 4, maxWidth: 250, fontSize: 12, lineHeight: 19.2, color: colors.mute, textAlign: 'center' }]}>{desc}</Text>
      <Pressable onPress={onCta} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 8, height: 44, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 2, opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ fontSize: 13, lineHeight: 18.9, fontWeight: '600', color: colors.accent }}>{cta}</Text>
        <Icon name="chevron-right" size={16} color={colors.accent} />
      </Pressable>
    </Animated.View>
  );
}

// 손그림 아이콘(시안 he-ic, viewBox 48 · 선 1.6 #CFD5DA) — 하트 · 편지 · 두 하트
const HAND_HEART = 'M8.00003 24C1.00003 10 17 5.00001 23 19C30 1.33514e-05 46 8.00001 37 23C31.6667 29.6667 23.3334 35.3333 12 40C20 32.6667 30.3334 29.3333 43 30';
const HAND_LETTER = 'M8 33C18 35 28.3333 35.3334 39 34L40 15C28.6667 13 17.6667 13 7 15L8 33ZM39 34L29 25M8 33L19 24M8 16L24 27L39 16M20 9.00003C17.3333 5.00003 17.6667 3.33337 21 4.00003C23 4.00003 24 5.33337 24 8.00003C26.6667 4.00003 29 3.00003 31 5.00003C33 7.6667 30.6667 10.3334 24 13';
function HandIcon({ kind }: { kind: 'heart' | 'letter' | 'two' }) {
  const common = { fill: 'none', stroke: colors.control, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (kind === 'two') {
    return (
      <Svg width={64} height={44} viewBox="0 0 96 60" {...common}>
        <G transform="translate(6,8) scale(.95)"><Path d={HAND_HEART} /></G>
        <G transform="translate(44,4) scale(.95) rotate(8 24 24)"><Path d={HAND_HEART} /></G>
      </Svg>
    );
  }
  return (
    <Svg width={44} height={44} viewBox="0 0 48 48" {...common}>
      <Path d={kind === 'heart' ? HAND_HEART : HAND_LETTER} />
    </Svg>
  );
}
