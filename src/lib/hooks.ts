// 야화 — 화면용 데이터 훅. 실제 Supabase만 사용 (DEMO 모드 폐기됨).
import { celebrateNewMissions, predictMissionGain } from './missions';
import { showActionFeedback } from '../components/ActionFeedback';
import { showReward } from '../components/RewardLayer';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, getSessionUser } from './supabase';
import { serverNow } from './deck';
import { STORES } from '../data/mock';
import type { LoungePost } from '../data/mock';
import { censorText } from './profanity';
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HIDE_IOS_CURRENCY, SHOW_STORE_LIVE } from './flags';
import {
  fetchGatheringsFull, fetchGatheringFull, createGatheringFull, joinGatheringFull,
  fetchMyGatherings, type MyGatheringItem, cancelGathering, updateGatheringFull,
  fetchMyFollowedHostIds, fetchMyFollowedHosts, fetchHostFollowStats, setHostFollow, type FollowedHost,
  requestProfileExchange, respondProfileExchange, fetchMyProfileExchanges, fetchCommentExchangeStates,
  type ExchangeRow, type CommentExchangeState, type ExchangeTarget,
  fetchSocialPosts, fetchSocialPost, addSocialPostServer, addLoungePostServer,
  fetchChatRoomsFull, fetchChatMessages, sendChatMessage, subscribeChatMessages, leaveChatRoom,
 fetchBlockedIds, deleteLoungePost, deleteSocialPost,
  type ServerGather, type ServerSocialPost, type ServerChatRoom, type ServerChatMessage,
  fetchHomeBanners, hasConnectionContactUnlock, unlockConnectionContact } from './api';
import { apiOrigin } from './apiOrigin';

// 하위 호환 별칭
export const PREVIEW = false;

// ── Feed (Home 모임) ─────────────────────────────────────────────────────
export type FeedCard = {
  id: string;
  nick: string;
  age: number | null;
  gender: 'F' | 'M';
  region: string | null;
  headline: string | null;
  tags: string[];
  coverPhoto: string | number | null;  // 로컬 require() 또는 원격 URL
  photoCount: number;
  leafs: number;  // 잠금 해제 비용 (server-fixed)
};

const ROW_TO_FEED = (r: any): FeedCard => ({
  id: r.user_id,
  nick: r.nickname,
  age: r.age,
  gender: (r.gender as 'F' | 'M') ?? 'F',
  region: r.region,
  headline: r.headline,
  tags: r.tags ?? [],
  coverPhoto: r.cover_photo ?? null,
  photoCount: r.photo_count ?? 0,
  leafs: 30,
});

export function useFeed() {
  return useQuery<FeedCard[]>({
    queryKey: ['feed'],
    queryFn: async () => {
      // 발견 피드도 양방향 지인 차단이 서버에서 강제되는 RPC로 조회 (0033).
      const { data, error } = await supabase.rpc('get_profile_cards' as any);
      if (error) throw error;
      return (data as any[]).map(ROW_TO_FEED);
    },
    staleTime: 60_000,
  });
}

// ── Lounge ────────────────────────────────────────────────────────────────
export function useLoungePosts(cat?: 'popular' | 'free' | 'love' | 'qna' | 'meet' | 'food') {
  return useQuery<LoungePost[]>({
    queryKey: ['lounge', cat ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('lounge_posts')
        .select('*, lounge_comments(count)')
        .is('lounge_comments.deleted_at', null)   // 지운 댓글은 수에서 뺀다(1027)
        .order('created_at', { ascending: false }).limit(40);
      if (cat === 'popular') {
        // 인기 — 서버 트리거(0100)가 좋아요+댓글 3점에 마킹, 7일 유지.
        // 정렬은 점수(좋아요+댓글) 내림차순, 동점이면 조회수.
        q = supabase.from('lounge_posts')
          .select('*, lounge_comments(count)')
          .is('lounge_comments.deleted_at', null)
          .gte('popular_since', new Date(Date.now() - 7 * 24 * 3600_000).toISOString())
          .limit(40);
      } else if (cat) {
        q = q.eq('cat', cat);
      }
      // 차단 목록과 글을 동시에 받는다(예전엔 차단 목록을 받은 뒤에야 글을 요청했다)
      const [blockedIds, { data, error }] = await Promise.all([fetchBlockedIds(), q]);
      if (error) throw error;
      const blocked = new Set(blockedIds);
      const rows = (data ?? []);
      if (cat === 'popular') {
        const score = (r: any) => (r.likes ?? 0) + (r.lounge_comments?.[0]?.count ?? 0);
        rows.sort((a: any, b: any) => score(b) - score(a) || (b.views ?? 0) - (a.views ?? 0));
      }
      return rows
        .filter((r) => !blocked.has((r as any).author_id))
        .map((r): LoungePost => ({
          id: r.id, cat: r.cat as any, nick: r.anon_nickname, tag: '익명',
          title: censorText(r.title).text, body: censorText(r.body).text, likes: r.likes,
          comments: (r as any).lounge_comments?.[0]?.count ?? 0,
          author_gender: ((r as any).author_gender ?? null) as 'M' | 'F' | null,
          authorId: (r as any).author_id ?? undefined,
          attachments: Array.isArray((r as any).attachments) ? (r as any).attachments : [],
          audioUrl: (r as any).audio_url ?? null,
          audioDuration: (r as any).audio_duration ?? null,
          time: new Date(r.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric' }),
          createdAt: r.created_at,
        }));
    },
    staleTime: 15_000,
  });
}

export function useAddLoungePostMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addLoungePostServer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lounge'] });
    },
  });
}

export function useDeleteLoungePostMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteLoungePost,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lounge'] });
    },
  });
}

export function useDeleteSocialPostMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSocialPost,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });
}

// ── Gatherings ────────────────────────────────────────────────────────────
export function useGatheringsFull() {
  const qc = useQueryClient();
  // 슬롯(신청/승인/거절) 변경을 realtime 구독 → 홈 피드가 열려 있으면 새로고침 없이 즉시 갱신
  // (참여자 아바타·남은 자리·관심 뱃지). 호스트 승인 시 상대·목록에 바로 반영.
  useEffect(() => {
    const channel = supabase
      .channel(`gatherings-feed-slots-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gathering_slots' },
        () => { qc.invalidateQueries({ queryKey: ['gatherings-full'] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
  return useQuery<ServerGather[]>({
    queryKey: ['gatherings-full'],
    queryFn: fetchGatheringsFull,
    staleTime: 15_000,
    // 상세(승인 화면)에서 홈으로 돌아올 때 항상 최신을 다시 불러 뱃지/자리 반영.
    refetchOnMount: 'always',
  });
}

export function useGatheringFull(id: string | null | undefined) {
  const qc = useQueryClient();
  // 이 모임의 슬롯(신청/승인/거절) 변경을 realtime 구독 → 상세 화면을 열어둔 채로도
  // 호스트는 새 신청을, 참가자는 승인 결과를 즉시 본다. (0056 publication)
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`gathering-slots-${id}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gathering_slots', filter: `gathering_id=eq.${id}` },
        () => { qc.invalidateQueries({ queryKey: ['gathering', id] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, qc]);
  return useQuery<ServerGather | null>({
    queryKey: ['gathering', id],
    queryFn: () => (id ? fetchGatheringFull(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 10_000,
  });
}

// 내 모임 — 마이페이지 관리 화면. 진입/포커스 시 최신화.
export function useMyGatherings() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ['my-gatherings', uid],
    queryFn: fetchMyGatherings,
    enabled: !!uid,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}
export type { MyGatheringItem };

export function useCreateGatheringMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createGatheringFull,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gatherings-full'] });
      qc.invalidateQueries({ queryKey: ['gathering'] });
      // 첫 모임 개설 리프 보상(0090)이 서버 트리거로 즉시 적립된다 — 잔액을 바로 반영.
      // 'me'는 탭 전환 새로고침 대상에서 제외돼 있어(SKIP_ON_TAB_FOCUS) 여기서 명시적으로
      // 무효화하지 않으면 앱을 재실행할 때까지 0으로 보인다.
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['my-gatherings'] });
    },
  });
}

export function useJoinGatheringFullMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: joinGatheringFull,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['gatherings-full'] });
      qc.invalidateQueries({ queryKey: ['gathering', vars.id] });
    },
  });
}

// ── 모임 ──────────────────────────────────────────────────────────────────
export function useSocialPosts() {
  return useQuery<ServerSocialPost[]>({
    queryKey: ['social-posts'],
    queryFn: async () => {
      const [posts, blocked] = await Promise.all([fetchSocialPosts(), fetchBlockedIds()]);
      const set = new Set(blocked);
      return posts.filter((p) => !set.has(p.author_id));
    },
    staleTime: 15_000,
  });
}

export function useSocialPost(id: string | null | undefined) {
  return useQuery<ServerSocialPost | null>({
    queryKey: ['social-post', id],
    queryFn: () => (id ? fetchSocialPost(id) : Promise.resolve(null)),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useAddSocialPostMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addSocialPostServer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-posts'] });
    },
  });
}

// ── Stores ────────────────────────────────────────────────────────────────
// 매장 목록 — 지도 탭과 앱 시작 사진 미리받기(prefetchImages)가 같은 캐시(['stores'])를 쓴다
export const fetchStores = async () => {
  const { data, error } = await supabase.from('stores').select('*').eq('active', true);
  if (error) throw error;
  if (!data || data.length === 0) return [];
  // 시드된 store는 데이터 충분 — id/name/category/region/hot만 DB에서, 나머지(distance/here/max/charge/dc/bg)는 mock 폴백
  return data.map((s: any) => {
    const fallback = STORES.find((m) => m.cat === (s.category ?? '')) ?? STORES[0];
    return {
      ...fallback,
      id: s.id,
      name: s.name,
      cat: s.category ?? fallback.cat,
      region: s.region ?? fallback.region,
      hot: s.hot,
      address: s.address ?? null,
      phone: (s as any).phone ?? null,
      lat: s.lat,
      lng: s.lng,
      imageUrls: Array.isArray(s.image_urls) ? s.image_urls : [],
      waitingCount: typeof s.waiting_count === 'number' ? s.waiting_count : 0,
      waitingEtaMinutes: typeof s.waiting_eta_minutes === 'number' ? s.waiting_eta_minutes : null,
      waitingEnabled: s.waiting_enabled !== false,
      waitingSlug: (s as any).waiting_slug ?? null,
      seatCapacity: typeof (s as any).seat_capacity === 'number' ? (s as any).seat_capacity : null,
      intro: s.intro ?? null,
      // 실시간 현황(웨이팅·인원) 공개 요일 (KST dow 0=일..6=토) — 미설정(null)만 금·토 기본.
      // 빈 배열은 "점주가 전부 끔"이므로 그대로 존중 (0062).
      genderStatsOpenDays: Array.isArray(s.gender_stats_open_days)
        ? (s.gender_stats_open_days as number[])
        : [5, 6],
    };
  });
};

export function useStores() {
  const qc = useQueryClient();
  // TagHere 웹훅이 stores.waiting_count를 갱신하면 realtime으로 즉시 캐시 반영
  // (지도 마커/매장 목록/상세의 웨이팅 현황 실시간화). 채널명은 mount별 고유.
  // 실시간 현황(SHOW_STORE_LIVE)을 내보이지 않는 동안엔 구독하지 않는다 — 웨이팅 값을 화면에 안 쓴다.
  useEffect(() => {
    if (!SHOW_STORE_LIVE) return;
    const channel = supabase
      .channel(`stores-waiting-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'stores' },
        (payload) => {
          const row: any = payload.new;
          if (!row?.id) return;
          qc.setQueryData(['stores'], (prev: any[] | undefined) => {
            if (!prev) return prev;
            return prev.map((s) => s.id === row.id
              ? {
                  ...s,
                  waitingCount: typeof row.waiting_count === 'number' ? row.waiting_count : s.waitingCount,
                  waitingEtaMinutes: typeof row.waiting_eta_minutes === 'number' ? row.waiting_eta_minutes : s.waitingEtaMinutes,
                  waitingEnabled: row.waiting_enabled !== false,
                }
              : s);
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);
  return useQuery({
    queryKey: ['stores'],
    queryFn: fetchStores,
    staleTime: 60_000,
    // 웨이팅은 realtime 구독이 실시간 담당 — 포커스/마운트 재조회는
    // 백그라운드 사이 놓친 이벤트를 복귀 시점에 보정하는 백스톱.
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
}

// ── 매장 성별 통계 (유료 잠금해제 — 매장당 100리프/100포인트, 24h) ───────────
export type StoreGenderStat = {
  storeId: string;
  maleCount: number;
  femaleCount: number;
  totalCount: number;
  maleRatio: number | null;
  femaleRatio: number | null;
  updatedAt: string;
  expiresAt: string;
};

// 잠금해제한 매장들의 실시간 성별 통계 — 서버 프록시가 결제 여부를 강제.
// enabled=false면 받지 않는다(실시간 현황을 숨긴 동안 지도에서 30초마다 유료 호출하던 것 차단)
export function useGenderStats(enabled = true) {
  return useQuery<Record<string, StoreGenderStat>>({
    queryKey: ['gender-stats'],
    enabled,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return {};
      const origin = apiOrigin();
      const r = await fetch(`${origin}/api/gender-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      });
      const body = await r.json().catch(() => null);
      if (!body?.ok) return {};
      const map: Record<string, StoreGenderStat> = {};
      for (const st of body.stats ?? []) map[st.storeId] = st;
      return map;
    },
    refetchInterval: 30_000,  // 실시간성 — TagHere 폴링 권장 주기(30~60s)의 최소치
    staleTime: 15_000,
    refetchOnWindowFocus: true,  // 앱 포그라운드 복귀 시 즉시 최신화
    refetchOnMount: true,
  });
}

// iOS 전용 — 리프 게이트 액션 직전에 잔액을 정확히 100까지만 채운다(0066).
// iOS에서 리프/포인트 개념을 UI에 노출하지 않는 대신, 이 함수로 항상 충분한 잔액을 보장해
// 연결 신청·실시간 인원 보기·초과 열람이 항상 성공하게 한다.
export async function ensureMinLeaf100(): Promise<void> {
  const { error } = await supabase.rpc('ensure_min_leaf_100' as never);
  if (error) throw error;
}

// 태그히어 포인트로 유료 기능 선결제 — /api/points-spend가 태그히어에서 차감하고
// 크레딧을 발급하면, 이어지는 INSERT의 리프 차감 트리거(0048)가 그 크레딧을 소비한다.
// reason은 서버 트리거의 사유와 정확히 일치해야 함('friend_connect' | 'gather_join').
export async function prepayWithPoints(
  amount: number,
  reason: 'friend_connect' | 'gather_join' | 'friend_view',
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, reason: '로그인이 필요해요' };
  const origin = apiOrigin();
  const r = await fetch(`${origin}/api/points-spend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ amount, reason, credit: true }),
  }).catch(() => null);
  const body = await r?.json().catch(() => null);
  if (!body?.ok) return { ok: false, reason: body?.reason ?? '포인트 사용에 실패했어요' };
  return { ok: true };
}

// 포인트 → 리프 환전 (100포인트 = 1리프, 리프 정책 v2). 포인트의 유일한 사용처. 서버 api/points-exchange.ts와 같아야 한다.
// 서버(/api/points-exchange)가 태그히어 차감 → credit_leaf 순서로 처리한다.
export const POINTS_PER_LEAF = 100;
export async function exchangePointsToLeaf(
  leaf: number,
): Promise<{ ok: true; leaf: number; pointsSpent: number } | { ok: false; reason: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, reason: '로그인이 필요해요' };
  const origin = apiOrigin();
  const r = await fetch(`${origin}/api/points-exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ leaf }),
  }).catch(() => null);
  const body = await r?.json().catch(() => null);
  if (!body?.ok) return { ok: false, reason: body?.reason ?? '환전에 실패했어요' };
  return { ok: true, leaf: body.leaf, pointsSpent: body.pointsSpent };
}

export function useUnlockStoreGenderMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { storeId: string; currency: 'leaf' | 'point' }) => {
      // 포인트는 태그히어가 진실원천 — 서버 프록시로 먼저 태그히어에서 차감(동기화)한
      // 뒤, 성공했을 때만 잠금해제를 기록한다(로컬 재화인 리프는 기존 RPC 그대로).
      if (args.currency === 'point') {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('로그인이 필요해요');
        const origin = apiOrigin();
        const r = await fetch(`${origin}/api/points-spend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ amount: 100, reason: 'store_gender_stats' }),
        });
        const body = await r.json().catch(() => null);
        if (!body?.ok) throw Object.assign(new Error(body?.reason ?? '포인트 사용에 실패했어요'), { code: r.status === 422 ? '53100' : undefined });

        const { data, error } = await supabase.rpc('record_store_gender_unlock_after_point_spend' as never, {
          p_store_id: args.storeId,
        } as never);
        if (error) throw error;
        return data as string;
      }
      const { data, error } = await supabase.rpc('unlock_store_gender' as never, {
        p_store_id: args.storeId,
        p_currency: args.currency,
      } as never);
      if (error) throw error;
      return data as string;  // expires_at
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gender-stats'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

// 실시간 인원 잠금해제 플로우(인증 → 재화 선택/iOS 자동 → 잠금해제)를 상세·지도 목록에서
// 공통으로 쓰기 위한 훅. trigger()만 호출하면 전 과정을 처리한다.
export function useUnlockGenderFlow() {
  const unlock = useUnlockStoreGenderMutation();
  const isFemale = useIsFemale();
  const trigger = useCallback((storeId: string) => {
    if (!requireAuth('실시간 인원 보기')) return;
    if (isFemale) {
      // 여성 무료(0106) — 확인창 없이 바로 언락(서버가 0원 처리)
      unlock.mutateAsync({ storeId, currency: 'leaf' })
        .catch(() => previewActions.showToast('일시적으로 이용할 수 없어요. 잠시 후 다시 시도해주세요'));
      return;
    }
    if (HIDE_IOS_CURRENCY) {
      (async () => {
        try {
          await ensureMinLeaf100();
          await unlock.mutateAsync({ storeId, currency: 'leaf' });
        } catch {
          previewActions.showToast('일시적으로 이용할 수 없어요. 잠시 후 다시 시도해주세요');
        }
      })();
      return;
    }
    // 포인트 직접 사용 제거(리프 경제 개편) — 리프 확인 모달만 노출
    previewActions.requestSpend({
      amount: 100,
      title: '지금 이 매장에 몇 명 있는지 볼까요?',
      body: '6시간 동안 이 매장의 실시간 인원이 지도와 상세에 열려요.',
      onConfirm: () => {
        unlock.mutate(
          { storeId, currency: 'leaf' },
          {
            onError: (e: any) => {
              const msg = String(e?.message ?? '');
              if (e?.code === '53100' || msg.includes('insufficient')) {
                previewActions.openPaywall(100, '실시간 인원을 보려면 리프가 필요해요');
              } else {
                previewActions.showToast('잠금해제에 실패했어요. 잠시 후 다시 시도해주세요');
              }
            },
          },
        );
      },
    });
  }, [unlock]);
  return { trigger, isPending: unlock.isPending };
}

// ── 오늘의 친구 일일 열람 이벤트 (하루 5명 열람 → 100리프, 서버 강제) ─────────
function kstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

// 오늘 열람한 서로 다른 친구 수 — 이벤트 배너 진행도용 (RLS: 본인 기록만)
export function useFriendViewsToday() {
  return useQuery({
    queryKey: ['friend-views', kstToday()],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return 0;
      const { count, error } = await (supabase as any)
        .from('friend_views')
        .select('profile_id', { count: 'exact', head: true })
        .eq('viewed_on', kstToday());
      // 세션 하이드레이션 직후 일시 401이 "성공한 0"으로 캐시되지 않게 throw → 재시도
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
  });
}

// 첫 모임 개설 리프 보상액(0090) — 어드민이 쿠폰에서 바꿀 수 있는 값이라
// 이용안내에 숫자를 하드코딩하지 않고 서버에서 읽는다. 없으면 null → 안내에서 항목을 숨긴다.
export function useFirstGatheringReward() {
  return useQuery({
    queryKey: ['first-gathering-reward'],
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await (supabase as any)
        .from('coupons').select('reward_leaf')
        .eq('first_gathering_grant', true).gt('reward_leaf', 0)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) return null;          // 안내용이라 실패해도 화면을 막지 않는다
      return (data?.reward_leaf as number | undefined) ?? null;
    },
    staleTime: 10 * 60_000,
  });
}

// 리프 잔액 가드 — 부족하면 확인창 대신 즉시 충전(Paywall)으로 보낸다.
// 서버도 53100으로 막지만, 확인창까지 진행했다가 실패하는 흐름을 없애기 위한 사전 차단.
export function ensureLeafOrPaywall(cost: number, reason: string): boolean {
  if (cost <= 0) return true;
  const bal = getPreviewState().leafBalance;
  if (bal >= cost) return true;
  previewActions.openPaywall(cost, reason);
  return false;
}

// 여성 전 기능 무료(0106) — 서버가 최종 강제하고, 클라는 과금 확인창을 건너뛴다.
export function useIsFemale(): boolean {
  const myProfile = usePreview(previewSelectors.myProfile);
  return myProfile?.gender === 'F';
}

// ── 인연 덱 추가 프로필(0105·0174·0187) — 리프 추가 소개는 배치당 한 번 두 명(20리프), 보너스 1명(하루 최대 11명) ──

// 정오 기준 배치 날짜(KST) — 추가로 받은 사람도 8명과 같이 낮 12시에 초기화된다(0174)
// 기기 시계가 틀려도 서버와 같은 날짜가 되게 서버 시각 보정값(deck.serverNow)으로
export function kstBatchDay(): string {
  return new Date(serverNow() + 9 * 3600_000 - 12 * 3600_000).toISOString().slice(0, 10);
}

export type DeckExtra = { id: string; bonus: boolean };
// 이번 배치에 추가로 받은 사람(리프·보너스) — 재시작해도 덱에 복원된다
export function useDeckExtrasToday() {
  return useQuery<DeckExtra[]>({
    queryKey: ['deck-extras', kstBatchDay()],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data, error } = await (supabase as any)
        .from('friend_deck_extras')
        .select('profile_id, bonus, created_at')
        .eq('user_id', session.user.id)
        .eq('day', kstBatchDay())
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ id: r.profile_id as string, bonus: !!r.bonus }));
    },
    staleTime: 30_000,
  });
}

// 내가 본 사람·호감(편지) 보낸 사람(0174) — 새로 소개할 때 최대한 뒤로 미룬다
export type DeckHistory = Map<string, { liked: boolean; lastSeen: string | null }>;
export function useDeckHistory() {
  return useQuery<DeckHistory>({
    queryKey: ['deck-history'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return new Map();
      const { data, error } = await supabase.rpc('my_deck_history' as never);
      if (error) return new Map();
      return new Map(((data ?? []) as any[]).map((r) => [r.profile_id as string, { liked: !!r.liked, lastSeen: (r.last_seen as string) ?? null }]));
    },
    staleTime: 60_000,
  });
}

export function useBuyExtraFriendMutation() {
  const qc = useQueryClient();
  return useMutation({
    // 다음 사람은 서버가 고른다(0183) — p_profile_id는 구버전 호환용 인자라 비워 보낸다
    mutationFn: async (_?: void) => {
      const { data, error } = await supabase.rpc('buy_extra_friend' as never, { p_profile_id: null } as never);
      if (error) throw error;
      return data as unknown as 'ok' | 'already' | 'limit' | 'none';
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deck-extras'] });
      qc.invalidateQueries({ queryKey: ['my-deck'] });
      qc.invalidateQueries({ queryKey: ['deck-next'] });
      qc.invalidateQueries({ queryKey: ['me'] });   // 리프 잔액 즉시 반영
    },
  });
}

// 친구 상세 진입 시 열람 기록 (0064) — 하루 10명 무료, 초과 열람은 서버가 needs_payment를
// 반환하고 클라가 리프/포인트 선택 후 currency와 함께 재호출. 5명 보상(rewarded)도 서버가 처리.
export function useRecordFriendView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { profileUserId: string; currency?: 'leaf' | 'point' }) => {
      // 부팅 직후 세션 하이드레이션 전에 anon으로 발사돼 기록이 유실되는 레이스 방지
      await supabase.auth.getSession();
      const { data, error } = await supabase.rpc('record_friend_view' as never, {
        p_profile_id: args.profileUserId,
        p_currency: args.currency ?? null,
      } as never);
      if (error) throw error;
      return data as { views_today: number; rewarded: boolean; charged?: number; needs_payment?: boolean };
    },
    // 잔액 부족(53100)은 재시도 무의미 — 네트워크/일시 오류만 재시도
    retry: (failureCount, error: any) =>
      failureCount < 2 && error?.code !== '53100' && !String(error?.message ?? '').includes('insufficient'),
    onSuccess: (res) => {
      // 조회 쿼리가 실패해도 배너 진행도는 RPC 응답으로 즉시 갱신
      if (typeof res?.views_today === 'number') {
        qc.setQueryData(['friend-views', kstToday()], res.views_today);
      }
      if (res?.rewarded || (res?.charged ?? 0) > 0) qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

// ── 호스트 경험 — 해당 유저가 만든 모임 수 (모임 상세 호스트 카드용) ─────────
export function useHostedCount(hostUserId: string | null | undefined) {
  return useQuery({
    queryKey: ['hosted-count', hostUserId],
    enabled: !!hostUserId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('gatherings')
        .select('id', { count: 'exact', head: true })
        .eq('host_id', hostUserId!);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 5 * 60_000,
  });
}

// ── 프로필 교환(프교, 0132) ─────────────────────────────────────────────────
export function useMyProfileExchanges() {
  return useQuery({
    queryKey: ['profile-exchanges'],
    queryFn: fetchMyProfileExchanges,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
}

export function useCommentExchangeStates(postId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['comment-exchange-states', postId ?? ''],
    enabled: !!postId && enabled,
    queryFn: () => fetchCommentExchangeStates(postId!),
    staleTime: 30_000,
  });
}

export function useRequestProfileExchangeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (target: ExchangeTarget) => requestProfileExchange(target),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comment-exchange-states'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['profile-exchanges'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['leaf-balance'] });
    },
  });
}

export function useRespondProfileExchangeMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => respondProfileExchange(id, accept),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile-exchanges'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['comment-exchange-states'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['exchanged-ids'], refetchType: 'all' });  // 수락하면 인연 덱에서 빠진다
      qc.invalidateQueries({ queryKey: ['my-deck'], refetchType: 'all' });
    },
  });
}

// 받은 프교 신청 중 대기 상태 수 — 알림 뱃지
export function usePendingExchangeCount() {
  const q = useMyProfileExchanges();
  return (q.data ?? []).filter((e) => e.direction === 'received' && e.status === 'pending').length;
}

// ── 호스트 팔로우 (0131) ────────────────────────────────────────────────────
export function useMyFollowedHostIds(enabled = true) {
  return useQuery({
    queryKey: ['followed-host-ids'],
    enabled,
    queryFn: fetchMyFollowedHostIds,
    staleTime: 60_000,
  });
}

export function useMyFollowedHosts() {
  return useQuery({
    queryKey: ['followed-hosts'],
    queryFn: fetchMyFollowedHosts,
    staleTime: 60_000,
  });
}

export function useHostFollowStats(hostUserId: string | null | undefined) {
  return useQuery({
    queryKey: ['host-follow-stats', hostUserId],
    enabled: !!hostUserId,
    queryFn: () => fetchHostFollowStats(hostUserId!),
    staleTime: 60_000,
  });
}

export function useToggleHostFollowMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ hostId, follow }: { hostId: string; follow: boolean }) => setHostFollow(hostId, follow),
    onSuccess: (_d, { hostId }) => {
      qc.invalidateQueries({ queryKey: ['host-follow-stats', hostId] });
      qc.invalidateQueries({ queryKey: ['followed-host-ids'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['followed-hosts'], refetchType: 'all' });
    },
  });
}

// ── 잠금 해제 ───────────────────────────────────────────────────────────────
export function useUnlockMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const { data, error } = await supabase.rpc('unlock_profile', { target_profile_id: targetUserId });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['profile-full'] });
    },
  });
}

// ── 게더링 참여 ─────────────────────────────────────────────────────────────
export function useJoinGatheringMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gatheringId: string) => {
      const user = await getSessionUser();
      if (!user) throw new Error('로그인이 필요해요');
      const { error } = await supabase
        .from('gathering_slots')
        .insert({ gathering_id: gatheringId, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gatherings'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

// ── 채팅 ────────────────────────────────────────────────────────────────────
// ── 채팅 안읽음 (로컬 seen-at) ───────────────────────────────────────────────
// 서버 last_read_at 컬럼 대신 AsyncStorage로 센다 — fetchChatRoomsFull이 이미 최근
// 메시지를 가져오므로 추가 쿼리가 0이다. (한계: 기기 간 미동기, 재설치 시 리셋)
// 계정별 키 — 같은 기기에서 다른 계정으로 로그인해도 읽음 기록이 섞이지 않게(예전 공용 키는 처음 한 번만 이어받는다)
const CHAT_SEEN_KEY = 'yahwa_chat_seen';

// 읽음 기록은 앱 전체가 하나를 공유한다 — 화면마다 따로 들고 있으면 채팅방에서 읽어도
// 탭바 뱃지가 안 줄어 "읽었는데 1이 계속 뜬다"가 된다(대표 리포트 1003).
const chatSeenStore = {
  seen: {} as Record<string, string>,
  loaded: false,
  listeners: new Set<() => void>(),
  emit() { this.listeners.forEach((l) => l()); },
};
let chatSeenLoading: Promise<void> | null = null;
let chatSeenUid: string | null = null;
function loadChatSeen(uid: string | null) {
  if (uid !== chatSeenUid) {
    chatSeenUid = uid;
    chatSeenStore.seen = {};
    chatSeenStore.loaded = false;
    chatSeenLoading = null;
  }
  if (!uid) return Promise.resolve();
  if (chatSeenLoading) return chatSeenLoading;
  chatSeenLoading = AsyncStorage.getItem(`${CHAT_SEEN_KEY}:${uid}`)
    .then((v) => v ?? AsyncStorage.getItem(CHAT_SEEN_KEY))
    .then((v) => { if (v && chatSeenUid === uid) chatSeenStore.seen = { ...JSON.parse(v), ...chatSeenStore.seen }; })
    .catch(() => {})
    .finally(() => { if (chatSeenUid === uid) { chatSeenStore.loaded = true; chatSeenStore.emit(); } });
  return chatSeenLoading;
}
export function markChatRoomSeen(roomId: string) {
  // 읽음 기록을 아직 안 불러왔으면(채팅 목록을 안 거치고 푸시로 바로 연 방) 불러온 뒤 남긴다 — 덮어쓰지 않게
  const uid = getCurrentUserId();
  if (uid && (chatSeenUid !== uid || !chatSeenStore.loaded)) { void loadChatSeen(uid).then(() => applyChatSeen(roomId)); return; }
  applyChatSeen(roomId);
}
function applyChatSeen(roomId: string) {
  chatSeenStore.seen = { ...chatSeenStore.seen, [roomId]: new Date().toISOString() };
  if (chatSeenUid) AsyncStorage.setItem(`${CHAT_SEEN_KEY}:${chatSeenUid}`, JSON.stringify(chatSeenStore.seen)).catch(() => {});
  chatSeenStore.emit();
}

export function useChatSeen() {
  const myUid = getCurrentUserId();
  const roomsQ = useChatRoomsFull();
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    chatSeenStore.listeners.add(l);
    void loadChatSeen(myUid);
    return () => { chatSeenStore.listeners.delete(l); };
  }, [myUid]);

  const seen = chatSeenStore.seen;
  const unreadByRoom: Record<string, number> = {};
  if (chatSeenStore.loaded && myUid) {
    for (const r of roomsQ.data ?? []) {
      const since = seen[r.id] ?? r.created_at;
      unreadByRoom[r.id] = (r._recent ?? []).filter(
        (m) => m.sender_id !== myUid && m.created_at > since,
      ).length;
    }
  }
  const total = Object.values(unreadByRoom).reduce((a, b) => a + b, 0);
  return { unreadByRoom, total, markSeen: markChatRoomSeen };
}

export function useChatRoomsFull() {
  return useQuery<ServerChatRoom[]>({
    queryKey: ['chat-rooms-full'],
    queryFn: fetchChatRoomsFull,
    staleTime: 60_000,
    // 전역 refetchOnMount:false라 캐시가 비어 있던 채로 굳으면 "채팅방이 사라진 것처럼"
    // 보인다. 채팅 목록만은 진입할 때마다 다시 불러온다(방 개수가 적어 저렴).
    refetchOnMount: 'always',
    // 채팅 탭 재진입 시 캐시 즉시 표시 — realtime 구독이 새 메시지를 푸시함
    placeholderData: (prev) => prev,
  });
}

export function useChatMessages(roomId: string | null | undefined) {
  const qc = useQueryClient();
  const q = useQuery<ServerChatMessage[]>({
    queryKey: ['chat-messages', roomId],
    queryFn: async () => {
      if (!roomId) return [];
      const data = await fetchChatMessages(roomId);
      return (data ?? []) as unknown as ServerChatMessage[];
    },
    enabled: !!roomId,
    staleTime: 60_000,
    // 채팅방 재진입 시 직전 메시지 즉시 표시 (깜빡임 제거). realtime이 신규 메시지를 append.
    placeholderData: (prev) => prev,
  });
  // realtime — 새 메시지 INSERT 시 캐시에 직접 append
  useEffect(() => {
    if (!roomId) return;
    const unsub = subscribeChatMessages(roomId, (m) => {
      qc.setQueryData<ServerChatMessage[]>(['chat-messages', roomId], (prev) => {
        if (!prev) return [m];
        if (prev.some((x) => x.id === m.id)) return prev;  // 중복 방지
        return [...prev, m];
      });
      qc.invalidateQueries({ queryKey: ['chat-rooms-full'] });
    });
    return unsub;
  }, [roomId, qc]);
  return q;
}

export function useLeaveChatRoomMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roomId: string) => leaveChatRoom(roomId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-rooms-full'], refetchType: 'all' }),
  });
}
export function useSendChatMessageMutation(roomId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      await sendChatMessage({ roomId, body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat-messages', roomId] });
      qc.invalidateQueries({ queryKey: ['chat-rooms-full'] });
    },
  });
}

// DM 룸 생성/조회 — RPC create_or_get_dm_room.

// ── 라운지 댓글 ───────────────────────────────────────────────────────────────
export type LoungeCommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  anon_nickname: string;
  body: string;
  created_at: string;
  // 성별 아바타용 — 0093 마이그레이션 이전 댓글은 null
  author_gender?: 'M' | 'F' | null;
  // 대댓글(2depth) — 최상위 댓글이면 null
  parent_id?: string | null;
  // 음성 댓글(0188) — 공개 주소 · 길이(초). 음성만 단 댓글은 body가 ''
  audio_url?: string | null;
  audio_duration?: number | null;
};
// 조회수 — 상세 진입 시 1회 증가(fire-and-forget). 세션 내 같은 글 중복 방지.
const bumpedPosts = new Set<string>();
export function bumpLoungeView(postId: string | undefined) {
  if (!postId || bumpedPosts.has(postId)) return;
  bumpedPosts.add(postId);
  void supabase.rpc('bump_lounge_view' as never, { p_post_id: postId } as never)
    .then(undefined, () => { /* 조회수는 유실 무해 */ });
}

export function useLoungeComments(postId: string | undefined) {
  return useQuery<LoungeCommentRow[]>({
    queryKey: ['lounge-comments', postId ?? ''],
    enabled: !!postId,
    queryFn: async () => {
      if (!postId) return [];
      // 차단한 사용자의 댓글도 숨김 (Apple 1.2 — 게시물과 동일 정책)
      const blocked = new Set(await fetchBlockedIds());
      // select('*') — author_gender 컬럼(0093) 적용 전 서버에서도 동작하도록 명시 목록 대신 전체 선택
      const { data, error } = await supabase
        .from('lounge_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return ((data ?? []) as unknown as LoungeCommentRow[])
        .filter((c) => !blocked.has((c as any).author_id))
        .map((c) => ({ ...c, body: censorText(c.body).text }));
    },
    staleTime: 30_000,
  });
}

// ── 라운지 좋아요 ─────────────────────────────────────────────────────────────
export function useMyLikedLoungePosts() {
  return useQuery<string[]>({
    queryKey: ['my-liked-lounge-posts'],
    queryFn: async () => {
      const user = await getSessionUser();
      if (!user) return [];
      const { data, error } = await supabase.rpc('my_liked_lounge_posts' as any);
      if (error) throw error;
      return ((data as unknown as string[]) ?? []);
    },
    staleTime: 60_000,
  });
}

type ToggleLikeCtx = {
  prevLiked?: string[];
  prevLounge: [readonly unknown[], LoungePost[] | undefined][];
};
export function useToggleLoungeLikeMutation() {
  const qc = useQueryClient();
  return useMutation<{ likes: number; liked: boolean }, Error, string, ToggleLikeCtx>({
    mutationFn: async (postId: string) => {
      const { data, error } = await supabase.rpc('toggle_lounge_like' as any, { p_post_id: postId });
      if (error) throw error;
      const row = Array.isArray(data) ? (data[0] as any) : (data as any);
      return { likes: row?.likes ?? 0, liked: !!row?.liked };
    },
    // 낙관적 업데이트 — 하트/카운트를 서버 응답 전에 즉시 반영
    onMutate: async (postId): Promise<ToggleLikeCtx> => {
      await qc.cancelQueries({ queryKey: ['my-liked-lounge-posts'] });
      await qc.cancelQueries({ queryKey: ['lounge'] });
      const prevLiked = qc.getQueryData<string[]>(['my-liked-lounge-posts']);
      const prevLounge = qc.getQueriesData<LoungePost[]>({ queryKey: ['lounge'] });
      const wasLiked = (prevLiked ?? []).includes(postId);
      qc.setQueryData<string[]>(['my-liked-lounge-posts'], (old) => {
        const arr = old ?? [];
        return wasLiked ? arr.filter((id) => id !== postId) : [...arr, postId];
      });
      const delta = wasLiked ? -1 : 1;
      qc.setQueriesData<LoungePost[]>({ queryKey: ['lounge'] }, (old) =>
        old ? old.map((p) => (p.id === postId ? { ...p, likes: Math.max(0, (p.likes ?? 0) + delta) } : p)) : old,
      );
      return { prevLiked, prevLounge };
    },
    onError: (_e, _postId, ctx) => {
      if (ctx) {
        qc.setQueryData(['my-liked-lounge-posts'], ctx.prevLiked);
        ctx.prevLounge.forEach(([key, data]) => qc.setQueryData(key, data));
      }
    },
    // 서버가 돌려준 수·상태로 맞추기만 한다 — 예전엔 좋아요 한 번마다 탭별 글 목록(['lounge', *]) 전체를 다시 받았다(1109)
    onSuccess: ({ likes, liked }, postId) => {
      qc.setQueryData<string[]>(['my-liked-lounge-posts'], (old) => {
        const arr = (old ?? []).filter((id) => id !== postId);
        return liked ? [...arr, postId] : arr;
      });
      qc.setQueriesData<LoungePost[]>({ queryKey: ['lounge'] }, (old) =>
        old ? old.map((p) => (p.id === postId ? { ...p, likes } : p)) : old,
      );
    },
  });
}

export function useAddCommentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, body, anonNickname, authorGender, parentId, audioUrl, audioDuration }: {
      postId: string; body: string;
      // 게시글 단위 지속 익명 닉네임 — 호출부(LoungeDetail)가 글 작성자/기존 댓글 닉을 계산해 전달
      anonNickname?: string;
      authorGender?: 'M' | 'F' | null;
      // 대댓글(최대 2depth) — 최상위 댓글 id만 허용(호출부가 강제)
      parentId?: string | null;
      // 음성 댓글(0188) — 올린 파일의 공개 주소 · 길이(초)
      audioUrl?: string | null;
      audioDuration?: number | null;
    }) => {
      const user = await getSessionUser();
      if (!user) throw new Error('로그인이 필요해요');
      const row: Record<string, unknown> = {
        post_id: postId,
        author_id: user.id,
        anon_nickname: anonNickname || '익명',
        author_gender: authorGender ?? null,
        // 게시물 본문과 동일하게 비속어 자동 마스킹 (profanity 정책 일치)
        body: censorText(body.trim()).text,
        ...(parentId ? { parent_id: parentId } : {}),
        ...(audioUrl ? { audio_url: audioUrl, audio_duration: audioDuration ?? null } : {}),
      };
      let { error } = await supabase.from('lounge_comments').insert(row as any);
      // author_gender 컬럼(0093) 미적용 서버 — 컬럼 없이 재시도 (마이그레이션 전 안전망)
      if (error && /author_gender/.test(error.message ?? '')) {
        delete row.author_gender;
        ({ error } = await supabase.from('lounge_comments').insert(row as any));
      }
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['lounge-comments', vars.postId] });
      // 목록의 댓글 수는 그 글만 +1 — 예전엔 탭별 글 목록 전체를 다시 받았다(1109)
      qc.setQueriesData<LoungePost[]>({ queryKey: ['lounge'] }, (old) =>
        old ? old.map((p) => (p.id === vars.postId ? { ...p, comments: (p.comments ?? 0) + 1 } : p)) : old,
      );
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 0018 기능 개편 v2 — 쿠폰 / 서버 알림 / 호감도 / 연결 hooks
// ─────────────────────────────────────────────────────────────────────────────
import {
  fetchMyCoupons, useCouponServer, grantCouponByTitle,
  fetchServerNotifs, markServerNotifRead, subscribeServerNotifs, type ServerNotif,
  sendAffinity, fetchAffinityReceived,
  sendInterest, fetchMyInterests, sendInterestMessage, fetchMyInterestMessages,
  fetchInterestMessageMeta, unlockInterestMessages, fetchMyMessageUnlocks,
  type InterestRow, type InterestMessageRow, type InterestMessageMetaRow,
  requestConnection, decideConnection, fetchConnectionStatus,
  fetchMySpendHistory, type ServerTransaction,
  fetchMySettlementInfo, upsertMySettlementInfo, type HostSettlementInfo,
} from './api';
import { getCurrentUserId, getPreviewState, previewActions, requireAuth, usePreview, previewSelectors } from './previewStore';

// 쿠폰함
export function useMyCoupons() {
  return useQuery({ queryKey: ['my-coupons'], queryFn: fetchMyCoupons, staleTime: 15_000 });
}

// ── 지도 매장 쿠폰 (0103) ────────────────────────────────────────────────────
// 매장별 다운로드 가능한 쿠폰 + 내가 이미 받았는지. 지도 스트립·매장 뱃지에 사용.
// 쿠폰 날짜 — KST 05:00에 하루가 바뀐다(서버 coupon_day()와 동일 기준).
export function couponDayStr(d: Date = new Date()): string {
  const kst = new Date(d.getTime() + 9 * 3600_000);   // UTC → KST
  kst.setUTCHours(kst.getUTCHours() - 5);             // 05:00 리셋
  return kst.toISOString().slice(0, 10);
}

export type StoreCouponInfo = { couponId: string; title: string; description: string | null; validUntil: string | null; owned: boolean };
export function useStoreCoupons() {
  return useQuery<Record<string, StoreCouponInfo>>({
    queryKey: ['store-coupons'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('coupons')
        .select('id, title, description, store_id, valid_until, created_at')
        .eq('kind', 'store').not('store_id', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const today = new Date().toISOString().slice(0, 10);
      // 내가 보유한 쿠폰 id — 로그인 안 했으면 빈 목록(다운로드 시 로그인 유도)
      let mine = new Set<string>();
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // 매장 쿠폰은 매일 재발급(0126) — '오늘(쿠폰 날짜)' 받은 것만 보유로 친다
        const { data: uc } = await (supabase as any)
          .from('user_coupons').select('coupon_id, granted_day')
          .eq('user_id', session.user.id).eq('granted_day', couponDayStr());
        mine = new Set((uc ?? []).map((r: any) => r.coupon_id));
      }
      const map: Record<string, StoreCouponInfo> = {};
      for (const c of data ?? []) {
        if (c.valid_until && c.valid_until < today) continue;
        if (map[c.store_id]) continue;   // 매장당 최신 1개
        map[c.store_id] = { couponId: c.id, title: c.title, description: c.description ?? null, validUntil: c.valid_until ?? null, owned: mine.has(c.id) };
      }
      return map;
    },
    staleTime: 60_000,
  });
}

export function useDownloadStoreCouponMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (storeId: string) => {
      const { data, error } = await supabase.rpc('download_store_coupon' as never, { p_store_id: storeId } as never);
      if (error) throw error;
      return data as unknown as 'granted' | 'already' | 'none';
    },
    onSuccess: () => {
      // refetchType:'all' — 전역 refetchOnMount:false라서 마운트 안 된 쿠폰함은
      // 무효화만으로는 재조회되지 않는다(새로고침해야 보이던 원인).
      qc.invalidateQueries({ queryKey: ['my-coupons'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['store-coupons'], refetchType: 'all' });
    },
  });
}
export function useUseCouponMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { userCouponId: string; storeId: string; pin: string }) => useCouponServer(args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-coupons'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['store-coupons'], refetchType: 'all' });
    },
  });
}
export function useGrantCouponMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { title: string; description?: string; discountLabel?: string; kind?: string }) =>
      grantCouponByTitle(args.title, args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-coupons'], refetchType: 'all' }),
  });
}

// 서버 알림 (기기 간) — realtime 구독으로 새 알림 즉시 반영.
// 기기 배너는 서버 원격 푸시가 띄운다(알림 끄기 설정도 서버가 반영) — 여기서 따로 띄우면 두 번 뜬다.
// live=false — 실시간 구독 없이 목록만(커뮤니티 머리의 알림 점처럼 화면을 열 때·새로고침 때 받으면 되는 곳)
export function useServerNotifs(opts?: { live?: boolean }) {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  const live = opts?.live !== false;
  useEffect(() => {
    if (!uid || !live) return;
    const unsub = subscribeServerNotifs(uid, (n) => {
      qc.setQueryData<ServerNotif[]>(['server-notifs'], (prev) => {
        if (!prev) return [n];
        if (prev.some((x) => x.id === n.id)) return prev;
        return [n, ...prev];
      });
      // 채팅방이 새로 열리거나(승인·매칭) 새 메시지가 오면 목록을 즉시 갱신
      if (n.kind === 'chat' || n.kind.startsWith('gather')) {
        qc.invalidateQueries({ queryKey: ['chat-rooms-full'], refetchType: 'all' });
      }
    });
    return unsub;
  }, [uid, qc, live]);
  return useQuery({ queryKey: ['server-notifs'], queryFn: fetchServerNotifs, staleTime: 10_000, enabled: !!uid });
}
export function useMarkServerNotifReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markServerNotifRead(id),
    // 누르는 즉시 읽음 표시(점 사라짐) → 서버 반영 후 다시 받아 맞춘다
    onMutate: (id: string) => {
      qc.setQueryData<ServerNotif[]>(['server-notifs'], (prev) => prev?.map((x) => (x.id === id ? { ...x, read: true } : x)));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['server-notifs'], refetchType: 'all' }),
  });
}

// 호감도
export function useSendAffinityMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { rateeId: string; score: number }) => sendAffinity(args.rateeId, args.score),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['affinity-received'] }),
  });
}
export function useAffinityReceived() {
  return useQuery({ queryKey: ['affinity-received'], queryFn: fetchAffinityReceived, staleTime: 15_000 });
}

// ── 관심 · 호감 (인연 리뉴얼 0095) ────────────────────────────────────────────
// KST 날짜 문자열 — 서버 kst_date와 동일 기준(00시)
// (toLocaleDateString의 timeZone은 Hermes·안드로이드에서 믿을 수 없어 +9시간 계산으로)
export function kstDateStr(d: Date | string): string {
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(t + 9 * 3600_000).toISOString().slice(0, 10);
}
// 페어 신선도 — 마지막 활동일 D 기준 D+1까지 유효(D+2 00시 만료)
export function isInterestFresh(lastActivityAt: string): boolean {
  const last = kstDateStr(lastActivityAt);
  const yesterday = kstDateStr(new Date(Date.now() - 24 * 3600_000));
  return last >= yesterday;
}

export function useMyInterests() {
  return useQuery<InterestRow[]>({ queryKey: ['interests'], queryFn: fetchMyInterests, staleTime: 15_000 });
}
export function useMyInterestMessages() {
  return useQuery<InterestMessageRow[]>({ queryKey: ['interest-messages'], queryFn: fetchMyInterestMessages, staleTime: 15_000 });
}
// 메타(본문 제외) — 뱃지·신선도 계산용. 받은 메시지 본문은 언락(6리프) 전 RLS가 차단.
export function useInterestMessageMeta() {
  return useQuery<InterestMessageMetaRow[]>({ queryKey: ['interest-message-meta'], queryFn: fetchInterestMessageMeta, staleTime: 15_000 });
}
export function useMyMessageUnlocks() {
  return useQuery({ queryKey: ['interest-message-unlocks'], queryFn: fetchMyMessageUnlocks, staleTime: 15_000 });
}
export function useUnlockInterestMessagesMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (otherId: string) => unlockInterestMessages(otherId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interest-messages'] });      // 언락 후 본문이 보임
      qc.invalidateQueries({ queryKey: ['interest-message-unlocks'] });
      qc.invalidateQueries({ queryKey: ['me'] });                     // 리프 차감 반영
    },
  });
}
export function useSendInterestMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (receiverId: string) => sendInterest(receiverId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interests'] });
      qc.invalidateQueries({ queryKey: ['me'] });  // 리프 차감 반영
    },
  });
}
// 관심 보내기 공용 플로우 — 인연 덱·호감 탭·프로필 상세가 공유.
// 남성: 하루 1회 무료 → 6리프 / 여성: 무료(0137, 대표 지시 1010).
// iOS(통화 미노출)는 확인 모달 없이 전송. 과금·중복 차단은 서버 트리거가 최종 강제.
export const INTEREST_COST = 6;
// 보내는 즉시 채운 하트 — 계정이 바뀌면(로그아웃·다른 계정) 비운다
const optimisticSent = new Set<string>();
let optimisticUid: string | null = null;
export function useSendInterestFlow() {
  const myUid = getCurrentUserId();
  if (optimisticUid !== myUid) { optimisticSent.clear(); optimisticUid = myUid; }
  const interestsQ = useMyInterests();
  const sendMut = useSendInterestMutation();
  const today = kstDateStr(new Date());
  const mine = (interestsQ.data ?? []).filter((i) => i.sender_id === myUid);
  const sentToday = mine.filter((i) => kstDateStr(i.created_at) === today);
  // 관심은 모든 성별 무료(1013). 하루 첫·두 번째 관심은 무료 리프 미션(각 5리프)으로 적립된다.
  const freePerDay = Infinity;
  const cost = 0;
  const freeAvailable = true;
  const alreadySentToday = (receiverId: string) => sentToday.some((i) => i.receiver_id === receiverId);
  // 한 번이라도 마음을 보낸 상대 — 하트가 계속 채워져 있다(프로토타입).
  // 보내는 즉시 채운다(목록 재조회 전 연타 방지) — 실패하면 되돌린다.
  const alreadySent = (receiverId: string) => optimisticSent.has(receiverId) || mine.some((i) => i.receiver_id === receiverId);

  function trigger(
    receiverId: string,
    nickname: string,
    opts?: { title?: string; body?: string; successToast?: string; onSuccess?: () => void },
  ) {
    if (!requireAuth('관심 보내기는 로그인 후 가능해요')) return;
    // 프로필 미완성 — 열람은 자유, 관심 보내기 등 액션은 프로필 등록 후(대표 지시 0821)
    if (!previewActions.requireCompleteProfile()) return;
    if (sendMut.isPending) return;
    // 이미 마음을 보낸 상대 — 서버를 다시 부르지 않고 알려만 준다(대표 지시 1021)
    if (alreadySent(receiverId)) { previewActions.showToast('이미 관심을 보낸 대상이에요!', 2200); return; }
    optimisticSent.add(receiverId);
    sendMut.mutate(receiverId, {
      onSuccess: () => {
        opts?.onSuccess?.();
        // 시안 action-feedback — 큰 하트 + '마음을 보냈어요.' (+ 받은 리프). 미션 레이어는 띄우지 않는다
        const earned = predictMissionGain(['like1', 'like2']);
        showActionFeedback({ kind: 'heart', text: opts?.successToast ?? '마음을 보냈어요.', earned });
        void celebrateNewMissions({ quiet: true }).then((gained) => {
          // 예상하지 못한 보상(기준값 없음 등)은 피드백이 끝난 뒤 보상 레이어로 알린다
          if (gained > 0 && earned === 0) setTimeout(() => showReward(gained), 700);
        });
      },
      onError: (e: any) => {
        optimisticSent.delete(receiverId);
        const msg = String(e?.message ?? '');
        if (e?.code === '23505' || msg.includes('already sent')) {
          previewActions.showToast('오늘 이미 관심을 보낸 상대예요', 2400);
        } else if (e?.code === '54000') {
          previewActions.showToast(msg, 2400);  // 하루 상한(0151)
        } else if (e?.code === '53100' || msg.includes('insufficient')) {
          previewActions.openPaywall(INTEREST_COST, '관심을 보내려면 리프가 필요해요');
        } else {
          previewActions.showToast('관심 보내기에 실패했어요. 잠시 후 다시 시도해주세요', 2400);
        }
      },
    });
  }

  return { trigger, freeAvailable, freePerDay, cost, alreadySentToday, alreadySent, isPending: sendMut.isPending };
}

export function useSendInterestMessageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { receiverId: string; body: string }) => sendInterestMessage(args.receiverId, args.body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interest-messages'] });
      // 호감 그리드의 '전송 완료' 뱃지·신선도는 메타 쿼리 기준 — 안 갱신하면 뱃지가 늦게 뜬다
      qc.invalidateQueries({ queryKey: ['interest-message-meta'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

// 연결 (연락처 공유)
export function useConnectionStatus(otherId: string | null | undefined) {
  return useQuery({
    queryKey: ['connection-status', otherId],
    queryFn: () => (otherId ? fetchConnectionStatus(otherId) : Promise.resolve('none' as const)),
    enabled: !!otherId,
    staleTime: 5_000,
  });
}
export function useRequestConnectionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => requestConnection(targetId),
    onSuccess: (_d, targetId) => {
      qc.invalidateQueries({ queryKey: ['connection-status', targetId] });
      qc.invalidateQueries({ queryKey: ['me'] });  // 남성 100리프 서버 차감 반영
    },
  });
}
export function useDecideConnectionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { requesterId: string; approve: boolean }) => decideConnection(args.requesterId, args.approve),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['connection-status'] }); qc.invalidateQueries({ queryKey: ['server-notifs'] }); },
  });
}

// ── 0019 오늘의 친구 / 모임 결제·승인 hooks ────────────────────────────────
import {
  getConnectionContact,
  joinGatheringPaid, decideGatheringSlot,
} from './api';
// 0030 지인 차단 — friend_profiles 뷰 대신 양방향 차단이 강제되는 RPC 경유
import { fetchFriendProfilesRpc, fetchFriendProfileRpc, type FriendProfileRpc } from './contacts';

// 나와 관련된 사람 전체(덱 이력 포함)라 무겁다 — 60초 동안은 캐시를 쓴다.
// 새로 생긴 관심 상대가 목록에 없으면 마음함(LikesGrid)이 그때 다시 받는다.
export function useFriendProfiles(gender?: 'M' | 'F') {
  return useQuery({ queryKey: ['friend-profiles', gender ?? 'all'], queryFn: () => fetchFriendProfilesRpc(gender), staleTime: 60_000 });
}
// 오늘의 인연 덱(get_my_deck)에 이미 받은 사람이면 그 행(get_friend_profiles와 같은 열 — 둘 다 friend_profile_rows)을
// 먼저 보여 준다 — 상세가 무거운 RPC를 기다리지 않고 바로 뜬다. 덱을 받은 시각 기준으로 오래됐으면 뒤에서 새로 받는다.
function deckRowFor(qc: ReturnType<typeof useQueryClient>, userId: string): { row: FriendProfileRpc; at: number } | null {
  for (const q of qc.getQueryCache().findAll({ queryKey: ['my-deck'] })) {
    const rows = q.state.data as Array<FriendProfileRpc & { slot?: unknown; extra?: unknown; extra_at?: unknown }> | undefined;
    const hit = rows?.find((r) => r.user_id === userId);
    if (hit) {
      const { slot: _s, extra: _e, extra_at: _a, ...row } = hit;
      return { row: row as FriendProfileRpc, at: q.state.dataUpdatedAt };
    }
  }
  return null;
}
export function useFriendProfile(userId: string | null | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['friend-profile', userId],
    queryFn: () => (userId ? fetchFriendProfileRpc(userId) : Promise.resolve(null)),
    enabled: !!userId, staleTime: 10_000,
    initialData: () => (userId ? deckRowFor(qc, userId)?.row : undefined),
    initialDataUpdatedAt: () => (userId ? deckRowFor(qc, userId)?.at : undefined),
  });
}
export function useConnectionContact(otherId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['connection-contact', otherId],
    queryFn: () => (otherId ? getConnectionContact(otherId) : Promise.resolve(null)),
    enabled: !!otherId && enabled, staleTime: 5_000,
  });
}
export function useJoinGatheringPaidMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: joinGatheringPaid,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['gathering', vars.gatheringId] });
      qc.invalidateQueries({ queryKey: ['gatherings-full'] });
      qc.invalidateQueries({ queryKey: ['me'] });  // 남성 100리프 서버 차감 반영
    },
  });
}
export function useUpdateGatheringMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Parameters<typeof updateGatheringFull>[0]) => updateGatheringFull(args),
    onSuccess: (_d, args) => {
      qc.invalidateQueries({ queryKey: ['gathering', args.id] });
      qc.invalidateQueries({ queryKey: ['gatherings-full'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['my-gatherings'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['chat-rooms-full'], refetchType: 'all' });
    },
  });
}

// 호스트가 모임 내리기 — 취소 처리(0121). 홈 목록·내 모임·상세를 모두 갱신한다.
export function useCancelGatheringMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gatheringId: string) => cancelGathering(gatheringId),
    onSuccess: (_d, gatheringId) => {
      qc.invalidateQueries({ queryKey: ['gathering', gatheringId] });
      qc.invalidateQueries({ queryKey: ['gatherings-full'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['my-gatherings'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['chat-rooms-full'], refetchType: 'all' });
    },
  });
}

export function useDecideGatheringSlotMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: decideGatheringSlot,
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['gathering', vars.gatheringId] });
      qc.invalidateQueries({ queryKey: ['gatherings-full'] });
      // 마지막 승인이면 서버 트리거가 채팅방을 만든다 — 앱을 껐다 켜야 보이던 문제
      qc.invalidateQueries({ queryKey: ['chat-rooms-full'], refetchType: 'all' });
    },
  });
}

// ── 0020 공지사항 / 지도 모임 승인 hooks ───────────────────────────────────
import {
  fetchAnnouncements, createAnnouncement, deleteAnnouncement,
  fetchPendingGatherings, setGatheringApproved,
} from './api';

export function useAnnouncements(activeOnly = true) {
  return useQuery({ queryKey: ['announcements', activeOnly], queryFn: () => fetchAnnouncements(activeOnly), staleTime: 30_000 });
}
export function useCreateAnnouncementMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: createAnnouncement, onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }) });
}
export function useDeleteAnnouncementMutation() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: deleteAnnouncement, onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }) });
}
export function usePendingGatherings() {
  return useQuery({ queryKey: ['pending-gatherings'], queryFn: fetchPendingGatherings, staleTime: 10_000 });
}
export function useApproveGatheringMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; approve: boolean }) => setGatheringApproved(args.id, args.approve),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-gatherings'] });
      qc.invalidateQueries({ queryKey: ['gatherings-full'] });
    },
  });
}

import { fetchGatheringContacts } from './api';
import {
  fetchAdminSettlementPayments, fetchHostSettlementInfos, adminMarkPayoutStatus,
  type AdminSettlementPayment,
} from './api';

// ── admin 정산 탭 ─────────────────────────────────────────────────────────────
export function useAdminSettlements(range?: { from?: string | null; to?: string | null }) {
  const paymentsQ = useQuery({
    queryKey: ['admin-settlement-payments', range?.from ?? null, range?.to ?? null],
    queryFn: () => fetchAdminSettlementPayments(range),
    staleTime: 10_000,
  });
  const hostIds = (paymentsQ.data ?? []).map((p) => p.host_id).filter((x): x is string => !!x);
  const infosQ = useQuery({
    queryKey: ['admin-settlement-host-infos', hostIds.sort().join(',')],
    queryFn: () => fetchHostSettlementInfos(hostIds),
    enabled: paymentsQ.isSuccess,
  });
  return {
    payments: paymentsQ.data ?? [],
    hostInfos: infosQ.data ?? {},
    isLoading: paymentsQ.isLoading || infosQ.isLoading,
    error: paymentsQ.error ?? infosQ.error,
  };
}
export function useAdminMarkPayoutMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { paymentId: string; payoutStatus: 'pending' | 'paid' }) =>
      adminMarkPayoutStatus(args.paymentId, args.payoutStatus),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-settlement-payments'] }),
  });
}
export type { AdminSettlementPayment };
export function useGatheringContacts(gatheringId: string | null | undefined, _enabled: boolean = true) {
  // enabled 제거 — RPC가 권한 체크해 미승인은 빈 배열 반환. enabled 의존시 myUid setActiveUser timing race condition으로 fetch 누락.
  void _enabled;
  return useQuery({
    queryKey: ['gathering-contacts', gatheringId],
    queryFn: () => (gatheringId ? fetchGatheringContacts(gatheringId) : Promise.resolve([])),
    enabled: !!gatheringId,
    staleTime: 10_000,
  });
}

// 오늘의 친구 연락처 잠금해제 상태 + 해제 플로우(재화 선택 → 차감 → 연락처 재조회)
export function useConnectionContactUnlock(otherId: string | null | undefined, isFemale = false) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['connection-contact-unlock', otherId],
    queryFn: () => (otherId ? hasConnectionContactUnlock(otherId) : Promise.resolve(false)),
    enabled: !!otherId,
    staleTime: 10_000,
  });
  const mut = useMutation({
    mutationFn: ({ currency }: { currency: 'leaf' | 'point' }) =>
      unlockConnectionContact(otherId!, currency),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['connection-contact-unlock', otherId] });
      qc.invalidateQueries({ queryKey: ['connection-contact', otherId] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });

  // 인증 → 재화 선택(iOS는 리프 자동) → 차감. 매장 실시간 인원과 동일한 UX 언어.
  const trigger = useCallback(() => {
    if (!otherId) return;
    if (!requireAuth('연락처 보기')) return;
    // 여성은 오늘의 친구 전 기능 무료(0092) — 재화 선택 모달 없이 바로 해제.
    // 서버도 동일하게 무료 처리하므로 화면만 건너뛰는 게 아니라 실제로 차감되지 않는다.
    if (isFemale) {
      mut.mutate({ currency: 'leaf' }, {
        onError: (e: any) => previewActions.showToast(String(e?.message ?? '') || '잠금해제에 실패했어요'),
      });
      return;
    }
    if (HIDE_IOS_CURRENCY) {
      (async () => {
        try {
          await ensureMinLeaf100();
          await mut.mutateAsync({ currency: 'leaf' });
        } catch {
          previewActions.showToast('일시적으로 이용할 수 없어요. 잠시 후 다시 시도해주세요');
        }
      })();
      return;
    }
    // 포인트 직접 사용 제거(리프 경제 개편) — 리프 확인 모달만 노출
    previewActions.requestSpend({
      amount: 100,
      title: '연락처를 확인할까요?',
      body: '이 친구의 연락처가 공개돼요. 한 번 열면 계속 볼 수 있어요.',
      onConfirm: () => {
        mut.mutate({ currency: 'leaf' }, {
          onError: (e: any) => {
            const msg = String(e?.message ?? '');
            if (e?.code === '53100' || msg.includes('insufficient')) {
              previewActions.openPaywall(100, '연락처를 보려면 리프가 필요해요');
            } else {
              previewActions.showToast(msg || '잠금해제에 실패했어요. 잠시 후 다시 시도해주세요');
            }
          },
        });
      },
    });
  }, [otherId, mut, isFemale]);

  return { unlocked: q.data === true, isLoading: q.isLoading, trigger, isPending: mut.isPending };
}

// ── 재화 차감 (서버 RPC) ──────────────────────────────────────────────────────
// 리프/포인트를 서버에서 원자적으로 차감하고 새 잔액을 반환. 부족 시 에러(53100).
export type Currency = 'leaf' | 'point';
export function useSpendCurrency() {
  const qc = useQueryClient();
  return useMutation<number, Error, { currency: Currency; amount: number; reason?: string }>({
    mutationFn: async ({ currency, amount, reason }) => {
      const { data, error } = await supabase.rpc(
        (currency === 'leaf' ? 'spend_leaf' : 'spend_points') as never,
        { p_amount: amount, p_reason: reason ?? null } as never,
      );
      if (error) {
        if (error.message?.includes('insufficient')) throw new Error(currency === 'leaf' ? '리프가 부족해요' : '포인트가 부족해요');
        throw error;
      }
      return Number(data);  // 차감 후 새 잔액
    },
    onSuccess: (newBal, vars) => {
      previewActions.setBalances(vars.currency === 'leaf' ? { leaf: newBal } : { points: newBal });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

// ── 매장 방문 관리 — 매장별 태그히어 포인트 적립 내역 ────────────────────────
export type StoreVisitBalance = {
  storeId: string;
  storeName: string;
  balance: number;
  syncedAt: string;
};

async function fetchMyStoreBalances(): Promise<StoreVisitBalance[]> {
  const { data, error } = await supabase
    .from('taghere_point_balances')
    .select('store_id, balance, synced_at, stores(name)')
    .order('balance', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    storeId: r.store_id,
    storeName: r.stores?.name ?? '알 수 없는 매장',
    balance: r.balance,
    syncedAt: r.synced_at,
  }));
}

// taghere_point_balances는 RLS로 본인 행만 조회되므로 user_id 필터는 서버가 강제.
// 웹훅이 적립을 반영할 때마다(INSERT/UPDATE) realtime으로 즉시 목록에 반영.
export function useMyStoreBalances() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`taghere-balances-${uid}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'taghere_point_balances', filter: `user_id=eq.${uid}` },
        () => { qc.invalidateQueries({ queryKey: ['my-store-balances'] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid, qc]);

  return useQuery({
    queryKey: ['my-store-balances'],
    queryFn: fetchMyStoreBalances,
    enabled: !!uid,
    staleTime: 10_000,
  });
}

// ── 리프/포인트 사용내역 — 지금까지 어디에 얼마나 사용했는지 누적 목록 ────────
export function useMySpendHistory() {
  const qc = useQueryClient();
  const uid = getCurrentUserId();
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`transactions-${uid}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions', filter: `user_id=eq.${uid}` },
        () => { qc.invalidateQueries({ queryKey: ['my-spend-history'] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid, qc]);

  return useQuery({
    queryKey: ['my-spend-history'],
    queryFn: fetchMySpendHistory,
    enabled: !!uid,
    staleTime: 10_000,
  });
}
export type { ServerTransaction };

// ── 호스트 정산 정보 ─────────────────────────────────────────────────────────
export function useMySettlementInfo() {
  const uid = getCurrentUserId();
  return useQuery({
    queryKey: ['my-settlement-info', uid],
    queryFn: fetchMySettlementInfo,
    enabled: !!uid,
  });
}
export function useUpsertSettlementInfoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertMySettlementInfo,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-settlement-info'] }),
  });
}
export type { HostSettlementInfo };

// 홈 상단 배너 — admin이 등록한 활성 배너
export function useHomeBanners() {
  return useQuery({ queryKey: ['home-banners'], queryFn: fetchHomeBanners, staleTime: 60_000 });
}
