// 야화 — 인연 홈의 오늘의 인연 (리뉴얼 1120 · 시안 #discovery, spec-dating §3.1)
// · useTodayDeck: 오늘의 인연은 서버가 고른다(get_my_deck). 정오(KST)마다 새 배치, 12·15·18·21시에 두 명씩 열린다.
// · AffinityDeckTab: 한 장씩 넘기는 카드 줄 + 아래 버튼 줄. 홈에서 카드를 열면(흐림 걷힘) deck_reveals에 남기고,
//   한 번 더 눌러 프로필에 들어가면 열람 기록(8명 모두 읽기 · 보너스 판정)이 남는다. 호감 · 편지는 프로필 안에서만 보낸다.
import React, { useEffect, useMemo, useState } from 'react';
import { View, AppState, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors } from '../tokens';
import { showReward } from '../components/RewardLayer';
import { ContactBlockAutoPrompt } from '../components/ContactBlockGate';
import { getCurrentUserId, requireAuth, previewActions, usePreview, previewSelectors } from '../lib/previewStore';
import { useSendInterestFlow, useBuyExtraFriendMutation } from '../lib/hooks';
import { useLeafPricing } from '../lib/leafPricing';
import { HIDE_IOS_CURRENCY } from '../lib/flags';
import { thumbUrl } from '../lib/img';
import { fetchMe, claimDeckReadReward, type MatchPrefs } from '../lib/api';
import { BATCH_SIZE, SLOT_HOURS, batchKey, kstHour, visibleCount, serverNow, syncServerClock, fetchMyDeck, fetchDeckNextAvailable, type DeckRow } from '../lib/deck';
import { appNav } from '../lib/appNav';
import { markViewed } from '../lib/viewed';
import { useMyLetters } from '../lib/letters';
import { usePairs } from '../lib/pairs';
import type { FriendProfile } from '../lib/api';
import { DiscoveryDeck, type BalanceProps, type DiscoveryPerson, type PendingCard, type Relation } from '../components/affinity/DiscoveryGrid';
import { useMyBalance, usePickBalance } from '../lib/balance';
import { setBalanceOpened, useBalanceLook, useBalanceOpened } from '../components/affinity/balance/state';
import { RestingCard } from '../components/affinity/HomeCards';
import { useHiddenIds } from '../components/affinity/hidden';
import { markDeckViewed, useDeckViewedIds } from '../components/affinity/deckViewed';
import { markRevealed, useRevealedIds } from '../components/affinity/revealed';
import { regionText } from '../components/FullProfile';
import { BottomSheet, BreathingDots, LeafCostCard, SheetButtons, SheetHeader, T, useTabBarClearance } from '../ui';

// ── 오늘의 인연 배치 — 덱 화면과 상세의 이전/다음이 같은 순서를 쓴다 ──────────
// 정오(KST)에 배치가 바뀌고 12·15·18·21시에 두 명씩 열린다. 순서·고정 규칙은 src/lib/deck.ts.
export function useTodayDeck() {
  const myUid = getCurrentUserId();
  // 나의 취향은 내 정보(get_me, users 전체 행)에 이미 들어 있다 — 따로 받지 않고 루트와 같은 ['me'] 캐시에서 읽는다
  const prefsQ = useQuery({ queryKey: ['me', myUid], queryFn: fetchMe, enabled: !!myUid, staleTime: 60_000, select: (m: any): MatchPrefs => (m?.match_prefs ?? {}) as MatchPrefs });
  const hidden = useHiddenIds();

  // 시각 갱신 — 15·18·21시(와 정오 배치 교체)가 되면 다음 두 명이 바로 열린다.
  // 휴대폰은 앱이 백그라운드에 있으면 타이머가 멈춘다. 다시 열릴 때(AppState active) 바로 갱신하지 않으면
  // 오래된 시각으로 열린 카드 수를 세서 21시가 지나도 6명만 보이는 문제가 있었다(1026) — 다시 열릴 때·다음 공개 정각에 갱신한다.
  // 30초마다 다시 그리던 것은 뺐다(덱 전체·카드 8장이 매번 다시 그려졌다). 시각은 서버 보정 시각(serverNow).
  const [now, setNow] = useState(() => new Date(serverNow()));
  useEffect(() => {
    let alive = true;
    const tick = () => setNow(new Date(serverNow()));
    syncServerClock().then(() => { if (alive) tick(); });
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') tick(); });
    return () => { alive = false; sub.remove(); };
  }, []);
  useEffect(() => {
    // 다음 공개 정각(12·15·18·21시 KST)에 맞춰 한 번 더 — 1초 여유
    const h = kstHour(now);
    const next = SLOT_HOURS.find((x) => x > h) ?? 24 + SLOT_HOURS[0];
    const kst = new Date(now.getTime() + 9 * 3600_000);
    const msToNext = ((next - h) * 3600 - kst.getUTCMinutes() * 60 - kst.getUTCSeconds()) * 1000 + 1000;
    const t = setTimeout(() => setNow(new Date(serverNow())), Math.max(1000, Math.min(msToNext, 6 * 3600_000)));
    return () => clearTimeout(t);
  }, [now]);
  const key = batchKey(now);

  // 오늘의 인연은 서버가 고른다(0183 get_my_deck) — 배치 8명(slot 0~7, 0182에 고정) + 이번 배치에 추가로 받은 사람(extra).
  // 앱은 후보 전체를 받지 않는다(회원 프로필 전체 노출·취향을 바꿔 새 사람을 보던 우회 차단, 1026). 취향은 다음 정오 배치부터 반영
  const deckQ = useQuery({ queryKey: ['my-deck', myUid ?? 'guest', key], queryFn: fetchMyDeck, staleTime: 60_000 });
  const nextQ = useQuery({ queryKey: ['deck-next', myUid ?? 'guest', key], queryFn: fetchDeckNextAvailable, enabled: !!myUid, staleTime: 60_000 });
  const batch = useMemo(
    () => (deckQ.data ?? []).filter((r) => r.slot != null).sort((x, y) => (x.slot ?? 0) - (y.slot ?? 0)) as FriendProfile[],
    [deckQ.data],
  );
  const visibleN = visibleCount(now);
  const visible = useMemo(() => {
    // 추가로 받은 사람(리프 1명·보너스 1명, 0174) — 받은 순서대로 뒤에 붙는다
    const extras = (deckQ.data ?? []).filter((r) => !!r.extra).sort((x, y) => (x.extra_at ?? '').localeCompare(y.extra_at ?? ''));
    // '이 인연 숨기기'로 뺀 사람은 오늘의 인연에서 보이지 않는다
    return [...batch.slice(0, visibleN), ...extras].filter((p) => !hidden.has(p.user_id)) as FriendProfile[];
  }, [batch, visibleN, deckQ.data, hidden]);
  // 다음 추가 소개가 있는지(비회원은 눌러서 로그인 안내)
  const hasNext = !myUid || !!nextQ.data;

  // 취향 조건이 하나라도 걸려 있는지 — 맞는 사람이 없을 때 안내 문구용
  const pf = prefsQ.data;
  const prefsActive = !!pf && (!pf.ageAny || !!pf.regions?.length || !!pf.mbtis?.length
    || (['religion', 'politics', 'drinking', 'smoking'] as const).some((k) => !!pf[k] && pf[k] !== '상관없음'));
  // 리프 추가 소개를 이미 받았는지(배치당 1명)
  const paidExtraIds = useMemo(() => new Set((deckQ.data ?? []).filter((r) => r.extra === 'paid').map((r) => r.user_id)), [deckQ.data]);
  return { now, batch, visible, visibleN, key, hasNext, paidExtraIds, prefsActive, isLoading: deckQ.isLoading };
}

// 화면 표기용 — 이용안내(AffinityGuide)가 같은 값을 쓴다.
export const DAILY_DECK_SIZE = BATCH_SIZE;

// 덱에서 연 상세(전체 화면) — 상세에서도 이전/다음이 뜨고, 아직 안 연 사람은 흐린 채로 보인다.
// 편지 쓰기 등에 다녀와도 유지되게 상세가 닫혀도 지우지 않는다(호감 그리드에서 열 때 지운다).
let deckDetailId: string | null = null;
export function setDeckDetail(userId: string | null) { deckDetailId = userId; }
export function isDeckDetail(userId: string) { return deckDetailId === userId; }
// 8명 모두 읽기 보상 — 같은 배치·같은 열람 상태로는 한 번만 청구한다.
// 상세를 새로 열 때마다(deckOpened가 늘면) 다시 청구해 본다 — 서버가 실제 열람 기록으로 판정.
const deckClaimTried = new Set<string>();
const deckClaimPending = new Set<string>();   // 요청 중 — 응답을 받은 뒤에만 Tried에 남긴다(통신 실패면 다시 청구)
let deckOpened = { key: '', ids: new Set<string>() };

export function AffinityDeckTab({ onOpenProfile, onOpenVisibility, onOpenCharge }: {
  onOpenProfile?: (userId: string) => void; onOpenVisibility?: () => void; onOpenCharge?: () => void;
}) {
  const me = usePreview(previewSelectors.myProfile);
  // 훅 순서가 바뀌지 않게 바깥에서 분기한다
  if (me?.affinityDeckPaused || me?.affinityHidden) return <RestingCard onOpenVisibility={onOpenVisibility} />;
  return <DeckInner onOpenProfile={onOpenProfile} onOpenCharge={onOpenCharge} />;
}

// 한 번에 더 소개받는 수 · 가격 — 문구("N명 더 소개받기")와 숫자가 한 곳에서 나오게 묶어 둔다(리프 정책이 바뀌면 여기만)
const EXTRA_COUNT = 2;   // 리프 정책 v2: 한 번에 두 명(0187)
const COUNT_WORD = ['', '한', '두', '세'];

// "이 사람의 한 장면" — 소개 글 한 토막(spec §5-a-1). 없으면 카드에서 이 블록을 숨긴다
function sceneOf(p: FriendProfile): string | null {
  const t = (p.intro_want || p.headline || p.extra_answers?.[0]?.a || '').replace(/\s+/g, ' ').trim();
  return t || null;
}

function DeckInner({ onOpenProfile, onOpenCharge }: { onOpenProfile?: (userId: string) => void; onOpenCharge?: () => void }) {
  const myUid = getCurrentUserId();
  const isGuest = !myUid;
  const leaf = usePreview(previewSelectors.leafBalance);
  const qc = useQueryClient();

  const { now: deckNow, batch, visible: deck, visibleN, key: batchK, hasNext, paidExtraIds, prefsActive, isLoading } = useTodayDeck();
  const flow = useSendInterestFlow();
  const lettersQ = useMyLetters();
  const pairs = usePairs();
  const { width: winW } = useWindowDimensions();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const gnbSpace = useTabBarClearance(0);

  // 홈에서 연 카드(deck_reveals) + 이번 배치에 프로필까지 본 사람(기기 기록 — 8명 모두 읽기 · 보너스 판정용)
  const revealedIds = useRevealedIds(myUid, batchK);
  const viewedIds = useDeckViewedIds(myUid, batchK);
  const hiddenIds = useHiddenIds();
  const buyExtraMut = useBuyExtraFriendMutation();
  const [extraOpen, setExtraOpen] = useState(false);

  // 8명 모두 읽기 → 3리프(0147). 서버가 이번 배치 기간의 실제 열람 기록으로 확인한다.
  useEffect(() => {
    if (!myUid || visibleN < BATCH_SIZE || batch.length < BATCH_SIZE) return;
    const ids = batch.map((p) => p.user_id);
    if (!ids.every((id) => viewedIds.has(id))) return;
    const opened = deckOpened.key === batchK ? deckOpened.ids.size : 0;
    const sig = `${myUid}:${batchK}:${viewedIds.size}:${opened}`;
    if (deckClaimTried.has(sig) || deckClaimPending.has(sig)) return;
    deckClaimPending.add(sig);
    claimDeckReadReward(ids)
      .then((r) => {
        deckClaimTried.add(sig);
        if (!r?.granted) return;
        showReward(r.amount ?? 3, '오늘의 인연 8명을 모두 만났어요');
        // 축하 기준값에 바로 반영 — 안 하면 다음 관심·글 때 '+3'이 한 번 더 축하된다
        qc.setQueryData(['missions-today'], (old: any) => ({ ...(old ?? {}), deck_read: r.amount ?? 3 }));
        qc.invalidateQueries({ queryKey: ['me'] });
      })
      .catch(() => {})
      .finally(() => { deckClaimPending.delete(sig); });
  }, [myUid, visibleN, batch, batchK, viewedIds, qc]);

  // 더 소개받기 — 다음 두 사람은 서버가 고르고(0183) 서버가 과금한다(20리프, 남녀 공통). 배치당 한 번(0174)
  const extraCost = useLeafPricing().prices.extra;
  const extraShort = leaf < extraCost;
  function doBuy() {
    buyExtraMut.mutate(undefined, {
      onSuccess: (r) => {
        setExtraOpen(false);
        if (r === 'limit') previewActions.showToast('오늘은 모두 소개받았어요.', 2200);
        else if (r === 'none') previewActions.showToast('새로운 인연을 준비하고 있어요. 리프는 차감되지 않아요.', 2200);
        else previewActions.showToast(`새로운 ${COUNT_WORD[EXTRA_COUNT]} 사람을 소개했어요.`, 2200);
      },
      onError: (e: any) => {
        setExtraOpen(false);
        if (e?.code === '53100' || String(e?.message ?? '').includes('insufficient')) {
          previewActions.openPaywall(extraCost, `리프가 부족해요.\n새로운 프로필 ${COUNT_WORD[EXTRA_COUNT]} 명은 리프 ${extraCost}으로 볼 수 있어요.`);
        } else {
          previewActions.showToast('잠시 후 다시 시도해주세요', 2200);
        }
      },
    });
  }
  function askExtra() {
    if (!requireAuth('추가 프로필은 로그인 후 볼 수 있어요')) return;
    if (!hasNext) { previewActions.showToast('새로운 인연을 준비하고 있어요.', 2200); return; }
    // iOS 통화 숨김 — 리프를 보여 주지 않고 바로 진행(서버가 처리)
    if (HIDE_IOS_CURRENCY) { doBuy(); return; }
    setExtraOpen(true);
  }

  // 이미지 프리페치 — 카드를 열 때 선명한 사진이 바로 보이게. 디스크에만 받아 둔다
  useEffect(() => {
    for (const p of deck) {
      const src = p.photos?.[0];
      if (src) ExpoImage.prefetch(thumbUrl(src, 720) ?? src, { cachePolicy: 'disk' }).catch(() => {});
    }
  }, [deck]);

  // 인연 열어보기 — 홈에서 흐림이 걷힌다. '열었다'는 기록만 남긴다(deck_reveals). 프로필 열람 기록은 프로필에 들어갈 때
  function reveal(id: string): boolean {
    if (!requireAuth('인연을 만나보려면 로그인해 주세요') || !myUid) return false;
    markRevealed(myUid, batchK, id);
    return true;
  }
  // 연 카드를 한 번 더 누름 → 본 프로필로 기록하고 프로필로
  function openProfile(id: string) {
    if (!requireAuth('인연을 만나보려면 로그인해 주세요')) return;
    if (deckOpened.key !== batchK) deckOpened = { key: batchK, ids: new Set() };
    deckOpened.ids.add(id);
    markViewed(id);
    if (myUid) markDeckViewed(myUid, batchK, id);
    setDeckDetail(id);
    onOpenProfile?.(id);
  }

  // 아직 안 열린 시간대 — 두 장씩. 정오 전은 전날 배치가 다 열린 상태. 그 시간에 올 사람(오늘 배치의 다음 순번)의 사진을 흐리게만 깐다
  const hourNow = kstHour(deckNow);
  const pending = useMemo<PendingCard[]>(() => {
    const hours = hourNow >= 12 ? SLOT_HOURS.filter((x) => x > hourNow).flatMap((x) => [x, x]) : [];
    const later = batch.slice(visibleN).filter((p) => !hiddenIds.has(p.user_id));
    return hours.map((hour, i) => ({ hour, hoursLeft: hour - hourNow, photo: later[i]?.photos?.[0] ?? null }));
  }, [hourNow, batch, visibleN, hiddenIds]);

  // 사람 카드 — 공개 시간이 지난 카드는 '열기 전'(흐린 사진), 홈에서 열면 '연 뒤'(선명한 사진). 비회원은 늘 열기 전
  const letters = lettersQ.data;
  const people = useMemo<DiscoveryPerson[]>(() => deck.map((p) => {
    const i = batch.findIndex((b) => b.user_id === p.user_id);
    const hour = i >= 0 && i < BATCH_SIZE ? SLOT_HOURS[Math.floor(i / 2)] : null;
    const pair = pairs.get(p.user_id);
    const sent = flow.alreadySent(p.user_id);
    const mine = (letters ?? []).filter((l) => l.other_id === p.user_id);
    const connected = mine.find((l) => !!l.replied_at);
    const incoming = mine.find((l) => l.direction === 'in' && !l.replied_at);
    const outgoing = mine.find((l) => l.direction === 'out' && !l.replied_at);
    const relation: Relation = {
      like: sent && pair?.receivedInterest ? 'mutual' : sent ? 'sent' : pair?.receivedInterest ? 'received' : 'none',
      letter: connected ? 'connected' : incoming ? 'received' : outgoing ? 'sent' : 'none',
      letterId: (connected ?? incoming ?? outgoing)?.id,
    };
    return {
      id: p.user_id,
      name: p.nickname,
      age: p.age,
      photo: p.photos?.[0],
      opened: !isGuest && (revealedIds.has(p.user_id) || viewedIds.has(p.user_id)),
      hour,
      extra: (p as DeckRow).extra ?? null,
      balanceChip: (p as DeckRow).extra === 'balance' ? (p as DeckRow).balance_chip ?? null : null,   // 홈 칩은 밸런스로 새로 소개된 사람에게만
      region: regionText(p.region),
      scene: sceneOf(p),
      verified: !!p.basic_verified,
      hiCert: !!p.credentials?.length,
      relation,
    };
  // flow.alreadySent는 관심 목록(pairs와 같은 쿼리)과 방금 보낸 낙관적 기록을 읽는다 — pairs가 바뀌면 함께 다시 계산된다
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [deck, batch, pairs, letters, revealedIds, viewedIds, isGuest]);

  // 오늘의 밸런스(1번 인연 앞 칸) — 표지를 열면 뒤집히고, 고르면 같은 쪽을 고른 한 사람이 바로 다음 칸에 온다
  const balanceLook = useBalanceLook();
  const balanceOpenedLocal = useBalanceOpened(batchK);
  const myBalance = useMyBalance(batchK);
  const pickMut = usePickBalance();
  const balancePick = myBalance.data?.choice ?? '';
  const [, bm, bd] = batchK.split('-');
  const balance: BalanceProps = {
    look: balanceLook,
    opened: balanceOpenedLocal,   // 앱을 새로 열면 늘 표지부터(이미 골랐으면 [열어보기]로 뒤집어 결과를 본다)
    introId: myBalance.data?.profile_id ?? null,
    pick: balancePick,
    date: `${Number(bm)}월 ${Number(bd)}일`,
    busy: pickMut.isPending,
    onOpen: () => { if (requireAuth('오늘의 밸런스는 로그인 후 할 수 있어요')) setBalanceOpened(batchK, true); },
    onPick: (k) => pickMut.mutate(k, {
      onSuccess: (r) => { if (!r?.profile_id) previewActions.showToast('오늘은 같은 쪽 사람을 찾지 못했어요.', 2200); },
      onError: () => previewActions.showToast('잠시 후 다시 시도해주세요', 2200),
    }),
  };

  // 카드 높이(Home Fit) — 버튼 줄(12 + 52 + 12 + 16)과 하단 메뉴를 뺀 높이 전부. 폭의 1.65배까지만(남으면 그 사이 가운데)
  const w = box.w || winW;
  const cardW = Math.max(240, w - 60);
  const avail = box.h - 92 - gnbSpace;
  const cardH = Math.round(Math.min(cardW * 1.65, Math.max(avail, 320)));
  const topGap = Math.max(0, Math.round((avail - cardH) / 2));

  return (
    <View style={{ flex: 1 }} onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (Math.abs(width - box.w) > 0.5 || Math.abs(height - box.h) > 0.5) setBox({ w: width, h: height }); }}>
      {/* 지인 차단 동의 — 최초 1회만 모달로 묻는다 */}
      <ContactBlockAutoPrompt />
      {isLoading || !box.h ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: gnbSpace }}><BreathingDots /></View>
      ) : deck.length === 0 && pending.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, paddingBottom: gnbSpace }}>
          <T v="body2Reading" color={colors.sub} center>{prefsActive
            ? '나의 취향에 맞는 인연이 아직 없어요.\n오른쪽 위 취향 설정에서 조건을 넓혀 보세요.'
            : '지금은 볼 수 있는 인연이 없어요.'}</T>
        </View>
      ) : (
        <View style={{ paddingTop: topGap }}>
          <DiscoveryDeck
            people={people}
            pending={pending}
            batchKey={batchK}
            width={w}
            cardHeight={cardH}
            onReveal={reveal}
            onProfile={openProfile}
            onLetter={(letterId) => appNav({ kind: 'letterDetail', letterId })}
            onPending={(h) => previewActions.showToast(`${h}시에 만날 수 있어요.`, 2200)}
            balance={balance}
            more={{
              count: EXTRA_COUNT,
              done: paidExtraIds.size > 0,
              busy: buyExtraMut.isPending,
              onMore: askExtra,
            }}
          />
        </View>
      )}

      {/* 더 소개받기 확인(시안 §3.2) — 리프가 모자라면 충전으로 */}
      <BottomSheet open={extraOpen} onClose={() => setExtraOpen(false)} dismissable={!buyExtraMut.isPending}>
        <SheetHeader title={`${EXTRA_COUNT}명 더 소개받을까요?`} desc={`오늘의 인연에 ${COUNT_WORD[EXTRA_COUNT]} 명이 더해져요.`} />
        <LeafCostCard cost={extraCost} balance={leaf} style={{ marginTop: -4, marginBottom: extraShort ? 8 : 20 }} />
        {extraShort && <T v="label4" color={colors.loveStrong} style={{ marginBottom: 16, textAlign: 'right', fontWeight: '600' }}>{extraCost - leaf}리프가 더 필요해요</T>}
        <SheetButtons
          onCancel={() => setExtraOpen(false)}
          confirmLabel={extraShort ? '리프 충전하기' : '소개받기'}
          loading={buyExtraMut.isPending}
          onConfirm={() => { if (extraShort) { setExtraOpen(false); onOpenCharge?.(); } else doBuy(); }}
        />
      </BottomSheet>
    </View>
  );
}
