// 야화 — 커뮤니티 '익명 이야기' 목록(리뉴얼 1120, 시안 community · spec-rest §3.1 · §9.1)
// 머리(스크롤과 함께 올라감): 명조 제목 "익명 이야기" + 부제 · 오른쪽 [책(이용수칙) · 종(새로운 소식)]
// 탭 줄 전체 · 공감순 · 내 글 — 스크롤해서 y=80에 닿으면 멈추고, 그 위 52에 작은 머리(명조 20 + 책 · 종)가 160ms로 나타난다.
// 글 카드(상자 없음, 글 사이 1px 선): 얼굴 32 + 닉네임/날짜 + ⋯ → 본문 15/25.5 → 사진(첫 장 + "1/n") · 음성 → 하트 · 말풍선.
// 처음 10개 + "더보기"(10개씩) · 끝 문구. 오른쪽 아래 떠 있는 알약 "＋ 글쓰기". 누구나(비회원 포함) 읽을 수 있다 — 잠금 없음(대표 결정).
import { useQuery } from '@tanstack/react-query';
import { fetchMe } from '../lib/api';
import { isCommunityGuideAckedLocal } from '../lib/communityApi';
import { TabTour } from '../components/tour/TabTour';
import { tourRef } from '../components/tour/tourTargets';
import { useOnScreenInactive } from '../components/KeepAlive';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, View, Text, Pressable, Platform, RefreshControl } from 'react-native';
import { SwipeTabs } from '../components/SwipeTabs';
import { thumbUrl } from '../lib/img';
import { FitImage } from '../components/community/FitImage';
import { colors, fontSerif, layout, palette, type as typo } from '../tokens';
import { BreathingDots, Dot, NATIVE, T, Tag, TopTabs, reduceMotion, usePress, useTabBarClearance, useToastAnchor } from '../ui';
import { CommunityAvatar } from '../components/CommunityAvatar';
import { useLoungePosts, useMyLikedLoungePosts, useToggleLoungeLikeMutation, useServerNotifs, useDeleteLoungePostMutation } from '../lib/hooks';
import type { LoungePost } from '../data/mock';
import { LoungeWrite } from './LoungeWrite';
import { previewActions, previewSelectors, usePreview, requireAuth, getCurrentUserId } from '../lib/previewStore';
import { listRestore, saveScroll } from '../lib/scrollMemory';
import { useNow } from '../lib/useNow';
import { CIcon, MoreDots } from '../components/community/cIcons';
import { isCommunityLocalKind, isCommunityServerKind } from '../components/community/notifKinds';
import { CommunityGuide } from '../components/community/CommunityGuide';
import { SiteAudio } from '../components/community/SiteAudio';
import { useMyLoungePosts } from '../components/community/postById';
import { LikeButton, TalkCount } from '../components/community/Reactions';
import { CommunityMoreSheet, type CommunityMoreTarget } from '../components/CommunityMoreSheet';
import { siteAgo } from '../components/community/time';
import { PHOTO_CHIP } from '../components/community/tone';

// 탭: 전체(최신순) · 공감순(서버 선정 인기글 0100) · 내 글(내가 쓴 글)
type LoungeFilter = 'all' | 'popular' | 'mine';
const FILTERS: { k: LoungeFilter; l: string }[] = [
  { k: 'all', l: '전체' },
  { k: 'popular', l: '공감순' },
  { k: 'mine', l: '내 글' },
];
// 게시글에서 돌아올 때 열어 둘 탭(내 글 삭제 → 내 글) — 커뮤니티 화면이 다시 마운트될 때 한 번만 읽는다
// 커뮤니티 화면이 숨겨진 채 살아 있으면(KeepAlive) 바로 그 탭으로 바꾼다
let returnTab: LoungeFilter | null = null;
let applyReturnTab: ((t: LoungeFilter) => void) | null = null;
export function setLoungeReturnTab(t: LoungeFilter) { if (applyReturnTab) applyReturnTab(t); else returnTab = t; }
function consumeReturnTab(): LoungeFilter { const t = returnTab ?? 'all'; returnTab = null; return t; }

// 글 본문 — 제목이 본문 첫머리와 같으면(새 글쓰기는 첫 줄을 제목으로 저장) 본문만 보여준다
export function postText(p: { title: string; body: string }): { head: string | null; body: string } {
  const title = (p.title ?? '').trim();
  const body = (p.body ?? '').trim();
  if (!title || body.startsWith(title)) return { head: null, body: body || title };
  return { head: title, body };
}
// 시안은 제목 없이 본문 하나 — 예전 글(제목·본문 따로)은 제목을 첫 줄로 합쳐 보여준다
export function postBody(p: { title: string; body: string }): string {
  const t = postText(p);
  return t.head ? `${t.head}\n${t.body}` : t.body;
}



// 머리 치수(화면 맨 위 y=0): 스크롤 영역은 y=10부터 · 큰 머리 105(y10~115) · 탭 줄 41(y115~156) · 탭이 멈추는 자리 y=62
// 11-22 탭 제목 위 여백 30 → 12(28 → 10, 제목 안쪽 2 포함). 멈춤 거리 STICK은 스크롤 영역 기준이라 그대로
const TOP = 10;
const HEAD_H = 105;
const TABS_H = 41;
const STICK = 53;      // 탭 줄이 멈출 때까지 올라가는 거리(133 − 80)
const PAGE = 10;       // 처음 10개 + 더보기 10개씩

export function Lounge({
  onOpenPost,
  onOpenNotif,
}: {
  onOpenPost?: (postId: string) => void;
  onOpenNotif?: () => void;
}) {
  const [writeOpen, setWriteOpen] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [filter, setFilter] = useState<LoungeFilter>(consumeReturnTab);
  useEffect(() => { applyReturnTab = setFilter; return () => { applyReturnTab = null; }; }, []);
  // 화면이 가려지면(다른 탭·글 열기) 떠 있던 창을 닫는다 — 예전엔 화면이 없어지며 같이 닫혔다
  useOnScreenInactive(() => { setWriteOpen(false); setGuideOpen(false); setMore(null); });
  // 커뮤니티 이용수칙(1020) — 머리의 책 아이콘을 눌러야만 연다(대표 1021: 자동으로 띄우지 않음). 확인 기록은 서버(0175)
  const [guideOpen, setGuideOpen] = useState(false);
  // 탭 첫 방문 안내(새 가입자 한 번, 25) — 이용수칙을 확인한 뒤에만 '글쓰기'를 가리킨다
  const uid = getCurrentUserId();
  const meQ = useQuery({ queryKey: ['me', uid ?? null], queryFn: fetchMe, enabled: !!uid, staleTime: 60_000 });
  const [ackLocal, setAckLocal] = useState(false);
  useEffect(() => { if (uid) void isCommunityGuideAckedLocal(uid).then(setAckLocal); }, [uid, guideOpen]);
  const guideAcked = ackLocal || !!(meQ.data as { community_guide_ack_at?: string | null } | null | undefined)?.community_guide_ack_at;
  const feedQ = useLoungePosts(filter === 'popular' ? 'popular' : undefined);
  const mineQ = useMyLoungePosts(uid, filter === 'mine');
  const postsQ = filter === 'mine' ? mineQ : feedQ;
  const all = postsQ.data ?? [];
  // 더보기 — 서버는 최근 글 묶음을 한 번에 준다. 화면에서 10개씩 끊어 보여 준다(탭마다 따로)
  const [shown, setShown] = useState<Record<LoungeFilter, number>>({ all: PAGE, popular: PAGE, mine: PAGE });
  const list = useMemo(() => all.slice(0, shown[filter]), [all, shown, filter]);
  const hasMore = all.length > list.length;
  // 알림 점 — 로컬 + 서버 안 읽은 알림. 커뮤니티 알림만 센다(대표 1022 — 인연 알림은 호감 탭에서)
  const unreadLocal = usePreview(previewSelectors.notifications).filter((n) => !n.read && isCommunityLocalKind(n.kind)).length;
  const serverNotifsQ = useServerNotifs({ live: false });  // 점만 — 실시간 구독은 알림 화면에서
  const unread = unreadLocal + (serverNotifsQ.data ?? []).filter((n) => !n.read && isCommunityServerKind(n.kind)).length;
  // 좋아요 — 상세와 같은 서버 상태·토글(낙관적 반영)
  const likedIds = useMyLikedLoungePosts().data ?? [];
  const likeMut = useToggleLoungeLikeMutation();
  const likeMutRef = useRef(likeMut);
  likeMutRef.current = likeMut;
  // 처리 중인 글만 막는다 — 한 글을 누르는 동안 다른 글의 하트가 무시되지 않게
  const pendingLikes = useRef(new Set<string>());
  const toggleLike = useCallback((id: string) => {
    if (pendingLikes.current.has(id)) return;
    if (!requireAuth('좋아요는 로그인 후 가능해요')) return;
    pendingLikes.current.add(id);
    likeMutRef.current.mutate(id, { onSettled: () => { pendingLikes.current.delete(id); } });
  }, []);
  // 부모가 매번 새 함수를 넘겨도 카드 memo가 깨지지 않게 — 최신 콜백은 ref로 읽는다
  const onOpenPostRef = useRef(onOpenPost);
  onOpenPostRef.current = onOpenPost;
  const openPost = useCallback((id: string) => onOpenPostRef.current?.(id), []);
  // 카드 ⋯ 시트 — 남의 글: 차단 · 신고 / 내 글: 글 지우기
  const [more, setMore] = useState<CommunityMoreTarget | null>(null);
  const openMore = useCallback((p: LoungePost) => {
    setMore({ kind: 'post', id: p.id, authorId: p.authorId, nick: p.nick, body: postBody(p), mine: !!p.authorId && p.authorId === getCurrentUserId() });
  }, []);
  const deleteMut = useDeleteLoungePostMutation();
  async function deletePost(t: CommunityMoreTarget) {
    try {
      await deleteMut.mutateAsync(t.id);
      previewActions.showToast('글을 삭제했어요.');
    } catch (e: any) {
      previewActions.showToast(e?.message ?? '삭제하지 못했어요', 2200);
    }
  }
  // 'N분 전'이 화면을 켜 둔 동안에도 흐르게 — 화면에서 한 번만 재고 카드에 내려준다
  const now = useNow(60_000);
  const extra = useMemo(() => ({ likedIds, now, uid }), [likedIds, now, uid]);
  // 스크롤 복원 — 탭마다 한 번만 만든다(매 렌더 새 ref 콜백이면 렌더마다 저장 위치로 다시 튀었다)
  const listKey = `lounge-list-${filter}`;
  const restore = useMemo(() => listRestore(listKey), [listKey]);

  // 고정 탭 + 작은 머리 — 머리 묶음(큰 머리 + 탭 줄)을 스크롤만큼 위로 밀다가 53에서 멈춘다(transform, 네이티브 드라이버).
  // 작은 머리는 그 지점을 넘을 때만 160ms로 켜고 끈다(스크롤마다 setState 하지 않는다).
  const scrollY = useRef(new Animated.Value(0)).current;
  const mini = useRef(new Animated.Value(0)).current;
  const stuck = useRef(false);
  const [miniOn, setMiniOn] = useState(false);  // 작은 머리의 버튼을 누를 수 있는지(넘는 순간에만 바뀐다)
  const setStuck = useCallback((on: boolean) => {
    if (stuck.current === on) return;
    stuck.current = on;
    setMiniOn(on);
    Animated.timing(mini, { toValue: on ? 1 : 0, duration: reduceMotion() ? 0 : 160, useNativeDriver: NATIVE }).start();
  }, [mini]);
  const onScroll = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: NATIVE, listener: (e: any) => { const y = e.nativeEvent.contentOffset.y; saveScroll(listKey, y); setStuck(y >= STICK); } },
  ), [scrollY, listKey, setStuck]);
  // 탭을 바꾸면 새 목록은 맨 위(또는 기억해 둔 자리)에서 시작한다 — 머리도 그 자리로
  useEffect(() => { scrollY.setValue(0); setStuck(false); }, [filter, scrollY, setStuck]);
  const headY = scrollY.interpolate({ inputRange: [0, STICK], outputRange: [0, -STICK], extrapolate: 'clamp' });

  const pad = useTabBarClearance();
  const fabBottom = useTabBarClearance(24);  // 하단 메뉴 윗선보다 24 위
  useToastAnchor(fabBottom + 44);
  const pick = (k: LoungeFilter) => { if (k !== 'mine' || requireAuth('내 글은 로그인 후 볼 수 있어요')) setFilter(k); };
  const tools = (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      <Pressable onPress={() => setGuideOpen(true)} accessibilityRole="button" accessibilityLabel="이용수칙" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <CIcon name="book" />
      </Pressable>
      <Pressable onPress={onOpenNotif} accessibilityRole="button" accessibilityLabel={`커뮤니티 알림 ${unread}개`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <CIcon name="bell" />
        {/* 안 읽은 소식 — 점 8 + 흰 링 1(버튼 안 x26 y10) */}
        {unread > 0 && <Dot ring={1} style={{ position: 'absolute', left: 25, top: 9 }} />}
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, marginTop: TOP, overflow: 'hidden' }}>
        {/* 탭 화면 좌우로 넘기기(공용 SwipeTabs, 1020 대표 지시) */}
        <SwipeTabs index={FILTERS.findIndex((f) => f.k === filter)} count={FILTERS.length} onIndexChange={(i) => pick(FILTERS[i].k)} style={{ flex: 1 }}>
          <Animated.FlatList
            data={postsQ.isLoading ? [] : list}
            keyExtractor={(p) => p.id}
            extraData={extra}
            ref={restore.ref}
            onContentSizeChange={restore.onContentSizeChange}
            onScrollBeginDrag={restore.stop}
            onScroll={onScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingTop: HEAD_H + TABS_H, paddingHorizontal: layout.gutter, paddingBottom: pad }}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={5}
            // 화면 밖 칸 떼어 내기는 끈다 — 안드로이드는 기본으로 켜져 있고, 사진을 불러온 뒤 칸 높이가 바뀌면
            // 목록 사진이 비어 보이고 글을 눌러 들어가야만 보였다(11-22 안드로이드 제보). 멀리 있는 칸은 windowSize가 내린다.
            removeClippedSubviews={false}
            ListEmptyComponent={postsQ.isLoading ? (
              <View style={{ paddingTop: 72 }}><BreathingDots /></View>
            ) : (
              <T v="body2" color={colors.mute} center style={{ marginTop: 56 }}>{filter === 'mine' ? '아직 남긴 글이 없어요.' : filter === 'popular' ? '아직 공감을 많이 받은 글이 없어요.' : '아직 글이 없어요.'}</T>
            )}
            ListFooterComponent={list.length === 0 ? null : hasMore ? (
              // 더보기 — 가운데 글자 버튼(14 500 글자-보조 · 높이 44 · 위 8)
              <Pressable onPress={() => setShown((s) => ({ ...s, [filter]: s[filter] + PAGE }))} accessibilityRole="button" style={{ marginTop: 8, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.textSecondary }}>더보기</Text>
              </Pressable>
            ) : (
              <Text style={{ marginTop: 12, marginBottom: 20, paddingVertical: 22, textAlign: 'center', fontFamily: fontSerif, fontSize: 14, lineHeight: 20, color: colors.subtle }}>a little closer, naturally.</Text>
            )}
            renderItem={({ item: p, index }) => <LoungeCard p={p} first={index === 0} now={now} mine={!!p.authorId && p.authorId === uid} liked={likedIds.includes(p.id)} onOpen={openPost} onLike={toggleLike} onMore={openMore} />}
            ListHeaderComponent={<PullNote refreshing={pulling} />}
            // 손으로 당겨서 새로고침할 때만 — 예전엔 화면으로 돌아와 뒤에서 다시 받을 때마다 돌림 표시가 뜨며 목록이 밀렸다(1110).
            // 기본 돌림표는 숨기고 그 자리에 PullNote(숨쉬는 점 + 명조 문구, 11-22 C2)를 보인다
            refreshControl={(
              <RefreshControl
                refreshing={pulling}
                onRefresh={() => { setPulling(true); void postsQ.refetch().finally(() => setPulling(false)); }}
                tintColor="transparent"
                colors={['transparent']}
                progressBackgroundColor="transparent"
                progressViewOffset={HEAD_H + TABS_H}
              />
            )}
          />
        </SwipeTabs>

        {/* 머리 묶음 — 목록 위에 겹쳐 두고 스크롤만큼 민다 */}
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, top: 0, backgroundColor: colors.bg, transform: [{ translateY: headY }] }}>
          <View style={{ height: HEAD_H, paddingHorizontal: layout.gutter, flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ paddingTop: 2 }}>
              <Text accessibilityRole="header" style={typo.tabTitle}>익명 이야기</Text>
              <Text style={[typo.subtitle, { marginTop: 10, letterSpacing: -0.15 }]}>편하게 나누는, 우리의 일상</Text>
            </View>
            {tools}
          </View>
          <TopTabs line height={TABS_H} items={FILTERS.map((f) => ({ key: f.k, label: f.l }))} value={filter} onChange={pick} />
        </Animated.View>
        {/* 작은 머리(.cm-mini) — 탭 줄이 멈춘 뒤 그 위 52: 명조 20 + 책 · 종(오른쪽 여백 10). 흐림 없이 불투명 흰색 */}
        <Animated.View pointerEvents={miniOn ? 'auto' : 'none'} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 52, paddingTop: 8, paddingLeft: layout.gutter, paddingRight: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.bg, opacity: mini }}>
          <Text style={{ fontFamily: fontSerif, fontSize: 20, lineHeight: 26, color: colors.text }}>익명 이야기</Text>
          {tools}
        </Animated.View>
      </View>

      {/* 글쓰기(.po-compose) — 주 버튼 알약 "＋ 글쓰기"(높이 44 · 모서리 24 · 좌우 18 · 14 600 흰색) · 오른쪽 20 · 하단 메뉴보다 24 위 */}
      <ComposeFab bottom={fabBottom} onPress={() => setWriteOpen(true)} />

      <CommunityMoreSheet target={more} onClose={() => setMore(null)} onDelete={deletePost} />
      <CommunityGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
      <LoungeWrite open={writeOpen} onClose={() => setWriteOpen(false)} onPosted={() => setFilter('all')} />
      <TabTour tab="community" active={guideAcked && !guideOpen && !writeOpen} />
    </View>
  );
}

function ComposeFab({ bottom, onPress }: { bottom: number; onPress: () => void }) {
  const press = usePress();
  return (
    <Pressable
      ref={tourRef('community.write')}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel="글쓰기"
      style={{ position: 'absolute', right: layout.gutter, bottom }}
    >
      <Animated.View style={[{ height: 44, paddingHorizontal: 18, borderRadius: 24, backgroundColor: colors.btnPrimaryBg, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 4px 14px rgba(57,68,77,0.125)' }, press.scaleStyle]}>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 24, backgroundColor: colors.btnPrimaryPress, opacity: press.p }} />
        <Text style={{ fontSize: 14, lineHeight: 20.3, fontWeight: '600', color: colors.btnPrimaryFg }}>＋ 글쓰기</Text>
      </Animated.View>
    </Pressable>
  );
}

// 글 한 개(.comm-entry) — 상자 없음 · 위아래 16 · 글 사이 1px 선(첫 글 위에는 없음 — 탭 줄 선과 겹치지 않게)
// 글쓴이 줄[얼굴 32 + 10 + 닉네임 14/18.2 600 (+ "나") / 날짜 12/15.6 · 오른쪽 끝 ⋯ 44] → 본문 15/25.5(위 10, 긴 글 3줄)
// → 사진(위 12, 원본 비율 · 세로는 정사각형까지만(1017) · 여러 장이면 첫 장 + "1/n") → 음성(높이 48) → 하트 · 말풍선(위 10, 왼쪽으로 10 넘김)
// memo + id 기반 콜백 — 좋아요 하나에 목록 전체가 다시 그려지지 않게(rerender-memo)
// 당겨서 새로고침 안내(11-22 시안 C2) — 숨쉬는 점(sky-200) + 명조 15/22 neutral-400 "오늘 올라온 이야기를 모으는 중".
// 아이폰 · 웹: 목록 맨 위 빈 자리(머리 뒤, 높이 92)에 숨겨 두었다가, 당겨서 목록이 내려오면 머리 아래로 드러난다.
// 안드로이드: 당겨도 목록이 내려오지 않으므로 새로고침하는 동안만 목록 위에 그 높이를 차지한다.
// 점은 새로고침하는 동안만 숨쉰다(그 전엔 멈춘 점 — 안 보이는 동안 애니메이션을 돌리지 않게).
const PULL_H = 92;
const PULL_DOT = palette.sky[200];
function PullNote({ refreshing }: { refreshing: boolean }) {
  const body = (
    <>
      {refreshing ? <BreathingDots color={PULL_DOT} /> : (
        <View style={{ flexDirection: 'row', gap: 8 }}>{[0, 1, 2].map((i) => <View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: PULL_DOT }} />)}</View>
      )}
      <Text style={{ marginTop: 8, fontFamily: fontSerif, fontSize: 15, lineHeight: 22, color: colors.subtle }}>오늘 올라온 이야기를 모으는 중</Text>
    </>
  );
  if (Platform.OS === 'android') {
    return refreshing ? <View style={{ height: PULL_H, alignItems: 'center', justifyContent: 'center' }}>{body}</View> : null;
  }
  return (
    <View style={{ height: 0 }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: -PULL_H, height: PULL_H, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 14 }}>{body}</View>
    </View>
  );
}

const LoungeCard = React.memo(function LoungeCard({ p, first, now, mine, liked, onOpen, onLike, onMore }: {
  p: LoungePost; first: boolean; now: number; mine: boolean; liked: boolean;
  onOpen: (id: string) => void; onLike: (id: string) => void; onMore: (p: LoungePost) => void;
}) {
  const imgs = (p.attachments ?? []).filter(Boolean);
  const body = postBody(p);
  const long = !imgs.length && (!!p.audioUrl || body.length > 100 || body.split('\n').length > 2);
  const open = () => onOpen(p.id);
  return (
    <Pressable onPress={open} accessibilityLabel="이야기 열기" style={{ paddingVertical: 16, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <CommunityAvatar gender={p.author_gender} size={32} seed={p.id + (p.authorId ?? '')} />
        <View style={{ flex: 1, minWidth: 0, marginLeft: 10, marginRight: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, lineHeight: 18.2, fontWeight: '600', color: colors.text }}>{p.nick}</Text>
            {mine && <Tag label="나" style={{ marginLeft: 6 }} />}
          </View>
          <Text style={{ marginTop: 2, fontSize: 12, lineHeight: 15.6, color: colors.mute }}>{p.createdAt ? siteAgo(p.createdAt, now) : p.time}</Text>
        </View>
        {/* ⋯ — 44×44, 점이 오른쪽 여백선에 닿게 12 넘김 */}
        <Pressable onPress={() => onMore(p)} accessibilityRole="button" accessibilityLabel="더보기" style={{ width: 44, height: 44, marginVertical: -8, marginRight: -12, alignItems: 'center', justifyContent: 'center' }}>
          <MoreDots />
        </Pressable>
      </View>

      {!!body && <Text numberOfLines={long ? 3 : undefined} style={[typo.body1Reading, { marginTop: 10 }]}>{body}</Text>}

      {imgs.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <FitImage uri={imgs[0]} src={thumbUrl(imgs[0], 720) ?? imgs[0]} minRatio={1} label="첨부 사진 1" />
          {imgs.length > 1 && (
            <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: 10, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, backgroundColor: PHOTO_CHIP }}>
              <Text style={{ fontSize: 11, lineHeight: 15.4, fontWeight: '600', color: colors.inverse, fontVariant: ['tabular-nums'] }}>1/{imgs.length}</Text>
            </View>
          )}
        </View>
      )}

      {/* 음성 — 목록에서 눌러도 글로 넘어가지 않는다 */}
      {!!p.audioUrl && (
        <Pressable onPress={() => {}} accessible={false} style={{ marginTop: 10, marginBottom: 4 }}>
          <SiteAudio url={p.audioUrl} durationSec={p.audioDuration} size="sm" />
        </Pressable>
      )}

      <View style={{ marginTop: 10, marginLeft: -10, marginBottom: -8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <LikeButton liked={liked} count={p.likes ?? 0} onPress={() => onLike(p.id)} />
        <TalkCount count={p.comments ?? 0} onPress={open} />
      </View>
    </Pressable>
  );
});
