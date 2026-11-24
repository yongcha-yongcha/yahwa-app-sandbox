// 야화 — 커뮤니티 게시글(리뉴얼 1120, 시안 post · spec-rest §3.2 · §3.4 · §9.1)
// 머리 줄 "게시글" + 오른쪽 프로필 교환 아이콘(안 본 받은 요청이 있으면 점) → 글쓴이 줄(얼굴 36 + 닉네임/날짜 + ⋯) → 본문 16/28
// → 사진(원본 비율 · 모든 장을 세로로) · 음성 → 하트 · 말풍선 → 1px 선 → 댓글 묶음 → 아래 고정 댓글 입력 줄.
// 얼굴 · 닉네임을 누르면(내 것 · 지운 것 제외) 프로필 교환 신청 시트. ⋯는 바텀 시트(차단 · 신고 / 고치기 · 지우기).
// 댓글 고치기는 입력 줄에서 한다("이야기 고치는 중 · 취소"). 누구나 글을 읽을 수 있고, 댓글은 로그인 뒤에 보인다.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Keyboard } from 'react-native';
import { thumbUrl } from '../lib/img';
import { FitImage } from '../components/community/FitImage';
import { KeyboardAware } from '../components/KeyboardAware';
import { colors, layout } from '../tokens';
import { BreathingDots, Button, Dot, Icon, T, Tag, TopBar } from '../ui';
import { previewActions, previewSelectors, usePreview, getCurrentUserId, requireAuth } from '../lib/previewStore';
import { bumpLoungeView, useLoungePosts, useLoungeComments, useAddCommentMutation, useDeleteLoungePostMutation, useMyLikedLoungePosts, useToggleLoungeLikeMutation, useCommentExchangeStates, useMyProfileExchanges } from '../lib/hooks';
import { makeAnonNick } from '../lib/api';
import { CommunityAvatar, faceVariant } from '../components/CommunityAvatar';
import { CommentThread, type CommentRow } from '../components/CommentThread';
import { type Clip } from '../components/community/RecordSheet';
import { uploadAudio } from '../lib/audioMessage';
import { postBody, setLoungeReturnTab } from './Lounge';
import { CommunityMoreSheet, type CommunityMoreTarget } from '../components/CommunityMoreSheet';
import { ExchangeRequestSheet, type ExchangeAskTarget } from '../components/community/ExchangeRequestSheet';
import { celebrateNewMissions } from '../lib/missions';
import { CIcon, CLine } from '../components/community/cIcons';
import { SiteAudio } from '../components/community/SiteAudio';
import { CommentComposer } from '../components/community/CommentComposer';
import { LikeButton, TalkCount } from '../components/community/Reactions';
import { consumeFocusComment } from '../components/community/focus';
import { editLoungeComment, deleteLoungeComment } from '../lib/communityApi';
import { LoungeWrite } from './LoungeWrite';
import { useQueryClient } from '@tanstack/react-query';
import { useLikedComments, useToggleCommentLike } from '../components/community/commentLikes';
import { usePostById } from '../components/community/postById';
import { siteAgo } from '../components/community/time';
import { useNow } from '../lib/useNow';
import { getSeen } from '../components/community/seen';

export function LoungeDetail({ postId, onBack, onOpenExchanges }: { postId?: string; onBack?: () => void; onOpenPost?: (id: string) => void; onOpenExchanges?: () => void }) {
  const postsQ = useLoungePosts();
  const inFeed = postId ? (postsQ.data ?? []).find((x) => x.id === postId) : undefined;
  // 피드(최근 40개)에 없는 글은 따로 불러온다(내가 쓴 예전 글·알림으로 연 글)
  const singleQ = usePostById(postId, !!postId && !postsQ.isLoading && !inFeed);
  const p = inFeed ?? singleQ.data ?? undefined;
  const loading = postsQ.isLoading || (!inFeed && singleQ.isLoading);
  const now = useNow(60_000);  // 글·댓글의 'N분 전'이 켜 둔 동안에도 흐르게
  // 대댓글(최대 2depth) — 답글 대상 최상위 댓글. null이면 일반 댓글.
  // nick = 멘션 대상(답글의 답글이면 그 답글 작성자), threadNick = 원댓글 작성자
  const [replyTo, setReplyTo] = useState<{ id: string; nick: string; threadNick?: string } | null>(null);
  // [답글 달기]를 누르면 바로 입력할 수 있게 입력창에 포커스
  const commentInputRef = useRef<TextInput>(null);
  useEffect(() => { if (replyTo) commentInputRef.current?.focus(); }, [replyTo]);
  // 서버 댓글 — 모든 사용자가 같은 데이터 봄
  const commentsQ = useLoungeComments(p?.id);
  // 조회수 — 상세 진입 1회 카운트(인기글 보조 정렬용, 0100)
  useEffect(() => { bumpLoungeView(p?.id); }, [p?.id]);
  const serverComments = commentsQ.data ?? [];
  // 댓글·답글 좋아요(0169) — 내가 누른 댓글 id와 토글
  const likedComments = useLikedComments(p?.id).data ?? [];
  const commentLikeMut = useToggleCommentLike(p?.id);
  const addCommentMut = useAddCommentMutation();
  // 글 좋아요 — 목록(Lounge)과 같은 서버 상태·같은 토글(['my-liked-lounge-posts'] · ['lounge'] 낙관적 반영)
  const likedPosts = useMyLikedLoungePosts().data ?? [];
  const liked = !!p && likedPosts.includes(p.id);
  const likeMut = useToggleLoungeLikeMutation();
  function toggleLike() {
    if (!p || likeMut.isPending) return;
    if (!requireAuth('좋아요는 로그인 후 가능해요')) return;
    // 피드에 없는 글(따로 불러온 글)은 끝난 뒤 수를 다시 받는다
    likeMut.mutate(p.id, { onSettled: () => qc.invalidateQueries({ queryKey: ['lounge-post', p.id] }) });
  }
  const deleteMut = useDeleteLoungePostMutation();
  const myProfile = usePreview(previewSelectors.myProfile);
  const [moreTarget, setMoreTarget] = useState<CommunityMoreTarget | null>(null);
  // 글 수정 화면 · 고치는 중인 내 댓글(입력 줄에서 고친다) · 프로필 교환 신청 시트
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [commentBusy, setCommentBusy] = useState(false);
  const [ask, setAsk] = useState<ExchangeAskTarget | null>(null);
  const myUid = getCurrentUserId();
  // 프로필 교환 — 이 글에 댓글을 단 사람과의 상태(서버) · 머리 아이콘의 점(안 본 받은 요청)
  const exStates = useCommentExchangeStates(p?.id, !!myUid).data ?? [];
  const exchanges = useMyProfileExchanges().data ?? [];
  const [seenAt, setSeenAt] = useState(0);
  useEffect(() => { void getSeen('exchange-received').then(setSeenAt); }, []);
  const newRequest = !!myUid && exchanges.some((e) => e.direction === 'received' && e.status === 'pending' && new Date(e.created_at).getTime() > seenAt);
  // 알림에서 연 댓글 — 그 묶음을 펼치고 강조, 화면 가운데로
  const [focusId] = useState(consumeFocusComment);
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef(0);
  const scrolledToFocus = useRef(false);
  const qc = useQueryClient();
  // 답글을 모두 펼친 스레드(최상위 댓글 id) — 기본은 2개까지
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({});
  // 알림의 댓글이 답글이면 그 묶음을 펼쳐 둔다
  useEffect(() => {
    if (!focusId) return;
    const row: any = (commentsQ.data ?? []).find((c) => c.id === focusId);
    if (row?.parent_id) setOpenThreads((o) => ({ ...o, [row.parent_id]: true }));
  }, [focusId, commentsQ.data]);

  // 이 글 안에서의 얼굴 번호 — 글쓴이는 목록과 같은 얼굴(글 id + 작성자 id 해시), 댓글 단 사람은 같은 성별끼리 겹치지 않게 나눠 준다(6명까지)
  const faces = useMemo(() => {
    const m = new Map<string, number>();
    const used: Record<string, Set<number>> = { M: new Set(), F: new Set(), '': new Set() };
    const put = (uid: string | undefined, gender: string | null | undefined) => {
      if (!uid || m.has(uid)) return;
      const set = used[gender === 'M' || gender === 'F' ? gender : ''];
      let v = faceVariant((p?.id ?? '') + uid);
      for (let i = 0; i < 6 && set.has(v); i++) v = (v + 1) % 6;
      set.add(v);
      m.set(uid, v);
    };
    put(p?.authorId, p?.author_gender);
    (commentsQ.data ?? []).forEach((c) => put(c.author_id, c.author_gender));
    return m;
  }, [p?.id, p?.authorId, p?.author_gender, commentsQ.data]);
  const faceOf = (uid: string | undefined) => (uid ? faces.get(uid) ?? 0 : 0);

  const exchangeBtn = (
    <Pressable onPress={() => { if (requireAuth('프로필 교환은 로그인 후 볼 수 있어요')) onOpenExchanges?.(); }} accessibilityRole="button" accessibilityLabel={newRequest ? '프로필 교환 요청 보기, 새 요청 있음' : '프로필 교환 요청 보기'} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <CIcon name="id-card" color={colors.text} />
      {newRequest && <Dot ring={2} style={{ position: 'absolute', left: 26, top: 8 }} />}
    </Pressable>
  );

  if (!p) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar title="게시글" onBack={onBack} />
        {loading
          ? <View style={{ paddingTop: 88 }}><BreathingDots /></View>
          : <T v="body2" color={colors.mute} center style={{ marginTop: 72 }}>지금은 볼 수 없는 글이에요.</T>}
      </View>
    );
  }
  const post = p;

  // 라운지는 무료 — 댓글 작성 시 리프 사용 X. 단, 게스트는 로그인 필요.
  const isGuest = !myUid;
  const isMine = !!post.authorId && post.authorId === myUid;

  // 게시글 단위 지속 익명 닉네임 — 글 작성자는 글의 닉을, 기존 댓글러는 이전 댓글의 닉을 재사용.
  // 처음 댓글 다는 사람만 새 닉 생성(글/기존 댓글 닉과 충돌 시 재추첨).
  function myAnonNickForThisPost(uid: string): string {
    if (post.authorId && post.authorId === uid) return post.nick;
    const mine = serverComments.find((c) => c.author_id === uid && c.anon_nickname !== '익명');
    if (mine) return mine.anon_nickname;
    const taken = new Set([post.nick, ...serverComments.map((c) => c.anon_nickname)]);
    let nick = makeAnonNick();
    for (let i = 0; i < 10 && taken.has(nick); i++) nick = makeAnonNick();
    return nick;
  }

  // 입력 줄(CommentComposer)이 글자를 넘긴다 — 성공하면 true(그때 입력을 비운다)
  async function submitComment(raw: string, clip?: Clip | null): Promise<boolean> {
    if (!requireAuth('댓글 작성은 로그인 후 가능해요')) return false;
    if (editing) return saveComment(raw);
    // 중복 전송 방지 — 빠르게 두 번 누르면 두 개 달리던 오류 해결
    if (addCommentMut.isPending) return false;
    const text = raw.trim();
    if (!text && !clip) return false;   // 음성만 있어도 보낼 수 있다(0188)
    const uid = getCurrentUserId();
    if (!uid) return false;
    Keyboard.dismiss();  // 전송 시 키보드(입력창) 닫기
    let audioUrl: string | null = null;
    if (clip) {
      audioUrl = clip.remote ? clip.uri : await uploadAudio(uid, clip.uri);
      if (!audioUrl) { previewActions.showToast('음성을 올리지 못했어요. 다시 시도해 주세요.', 2200); return false; }
    }
    const thread = replyTo?.id ?? null;
    // 원댓글이 아닌 답글 작성자에게 답하면 "@닉네임 "을 본문 앞에 남겨 멘션 대상을 저장한다
    const body = replyTo && replyTo.threadNick && replyTo.nick !== replyTo.threadNick ? `@${replyTo.nick} ${text}` : text;
    try {
      await addCommentMut.mutateAsync({
        postId: post.id,
        body,
        anonNickname: myAnonNickForThisPost(uid),
        authorGender: (myProfile?.gender as 'M' | 'F' | null) ?? null,
        parentId: thread,
        audioUrl,
        audioDuration: clip ? Math.round(clip.duration) : null,
      });
      setReplyTo(null);
      // 방금 단 답글이 보이게 그 스레드를 펼친다
      if (thread) setOpenThreads((o) => ({ ...o, [thread]: true }));
      // 하루 첫 댓글 1리프(답글 포함, 서버 0167) — 받았으면 '미션 성공!', 아니면 "댓글을 남겼어요."
      void celebrateNewMissions().then((g) => { if (!g) previewActions.showToast('댓글을 남겼어요.'); });
      return true;
    } catch (e: any) {
      previewActions.showToast(e?.message ?? '댓글 등록 실패', 2200);
      return false;
    }
  }

  async function doDelete() {
    try {
      await deleteMut.mutateAsync(post.id);
      previewActions.showToast('글을 삭제했어요.');
      setLoungeReturnTab('mine');  // 시안: 삭제하면 커뮤니티 '내 글'로
      onBack?.();
    } catch (e: any) {
      previewActions.showToast(e?.message ?? '삭제하지 못했어요', 2200);
    }
  }

  // 내 댓글 고치기 — 입력 줄에서 보내면 그 자리 글만 바뀐다
  async function saveComment(raw: string): Promise<boolean> {
    const text = raw.trim();
    if (!editing || commentBusy || !text) return false;
    setCommentBusy(true);
    try {
      await editLoungeComment(editing.id, text);
      await qc.invalidateQueries({ queryKey: ['lounge-comments', post.id] });
      setEditing(null);
      Keyboard.dismiss();
      return true;
    } catch (e: any) {
      previewActions.showToast(e?.message ?? '댓글을 수정하지 못했어요', 2200);
      return false;
    } finally {
      setCommentBusy(false);
    }
  }

  async function removeComment(id: string) {
    if (editing?.id === id) setEditing(null);
    try {
      await deleteLoungeComment(id);
      await qc.invalidateQueries({ queryKey: ['lounge-comments', post.id] });
      void qc.invalidateQueries({ queryKey: ['lounge'] });
      previewActions.showToast('댓글을 삭제했어요.');
    } catch (e: any) {
      previewActions.showToast(e?.message ?? '댓글을 삭제하지 못했어요', 2200);
    }
  }

  // 얼굴 · 닉네임 누름 — 상대와의 교환 상태에 맞는 신청 시트(§3.5)
  function askExchange(t: { kind: 'post' | 'comment'; id: string; authorId?: string; nick: string; gender?: 'M' | 'F' | null }) {
    if (!requireAuth('프로필 교환은 로그인 후 가능해요')) return;
    // 서버 상태는 '그 사람이 이 글에 단 댓글'에 붙어 온다 — 그 사람의 댓글 아무거나로 찾는다
    const theirs = new Set(serverComments.filter((c) => c.author_id === t.authorId).map((c) => c.id));
    const st = exStates.find((x) => theirs.has(x.comment_id));
    const state = !st ? 'none' : st.status === 'accepted' ? 'accepted' : st.direction === 'sent' ? 'sent' : 'received';
    setAsk({ kind: t.kind, id: t.id, nick: t.nick, gender: t.gender, face: faceOf(t.authorId), state });
  }

  function likeComment(id: string) {
    if (!requireAuth('좋아요는 로그인 후 가능해요')) return;
    if (commentLikeMut.isPending && commentLikeMut.variables === id) return;
    commentLikeMut.mutate(id, { onError: (e: any) => previewActions.showToast(e?.message ?? '좋아요하지 못했어요', 2200) });
  }
  // [답글 달기] — 그 댓글 묶음을 펼치고 입력칸에 바로 쓸 수 있게
  function startReply(t: { id: string; nick: string; threadNick: string }) {
    setEditing(null);
    setOpenThreads((o) => ({ ...o, [t.id]: true }));
    setReplyTo(t);
    // 시안처럼 답글 달기를 누르면 바로 입력 칸으로(키보드가 올라온다)
    requestAnimationFrame(() => commentInputRef.current?.focus());
  }

  const imgs = (post.attachments ?? []).filter(Boolean);
  // 지운 댓글 — 답글이 남아 있는 댓글만 '삭제된 댓글입니다.'로 두고, 답글 없는 댓글·지운 답글은 목록에서 뺀다(대표 지시 1027)
  const isDel = (c: any) => !!c.deleted_at;
  const shownComments = serverComments.filter((c: any) => !isDel(c) || (!c.parent_id && serverComments.some((r: any) => r.parent_id === c.id && !isDel(r))));
  const liveCount = serverComments.filter((c: any) => !isDel(c)).length;
  const tops = shownComments.filter((c) => !c.parent_id);

  const askAuthor = () => askExchange({ kind: 'post', id: post.id, authorId: post.authorId, nick: post.nick, gender: post.author_gender });
  const authorFace = <CommunityAvatar gender={post.author_gender} size={36} variant={faceOf(post.authorId)} />;
  const canAskAuthor = !isMine && !!post.authorId;

  return (
    // 이 화면은 이미 위 안전 영역 아래(SafeAreaView top)에 놓여 있어 iOS 보정값은 0 — insets.top을 주면 키보드 위에 그만큼 빈 틈이 생겼다
    <KeyboardAware style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="게시글" onBack={onBack} right={exchangeBtn} />

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 16, paddingHorizontal: layout.gutter, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* 글쓴이 줄 — 얼굴 36 + 10 + [닉네임 14/18.2 600 (+ "나") / 6 / 날짜 12 글자-연] · 오른쪽 ⋯ 44(점이 여백선에 닿게 12 넘김) */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {canAskAuthor ? <Pressable onPress={askAuthor} accessibilityRole="button" accessibilityLabel={`${post.nick} 프로필 교환`} hitSlop={4}>{authorFace}</Pressable> : authorFace}
          <View style={{ flex: 1, minWidth: 0, marginLeft: 10, marginRight: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text onPress={canAskAuthor ? askAuthor : undefined} numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, lineHeight: 18.2, fontWeight: '600', color: colors.text }}>{post.nick}</Text>
              {isMine && <Tag label="나" style={{ marginLeft: 6 }} />}
            </View>
            <Text style={{ marginTop: 6, fontSize: 12, lineHeight: 12, color: colors.mute }}>{post.createdAt ? siteAgo(post.createdAt, now) : post.time}</Text>
          </View>
          {!!post.authorId && (
            <Pressable
              onPress={() => setMoreTarget({ kind: 'post', id: post.id, authorId: post.authorId, nick: post.nick, body: postBody(post), mine: isMine })}
              accessibilityRole="button"
              accessibilityLabel="글 더보기"
              style={{ width: 44, height: 44, marginVertical: -4, marginRight: -12, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="more-horizontal" color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* 본문 16/28 · 위 14 */}
        {!!postBody(post) && <Text style={{ marginTop: 14, fontSize: 16, lineHeight: 28, color: colors.text }}>{postBody(post)}</Text>}

        {/* 사진 — 원본 비율 그대로(자르지 않는다, 1017) · 모든 장을 세로로(위 14, 사진끼리 8) */}
        {imgs.map((uri, i) => (
          <FitImage key={uri + i} uri={uri} src={thumbUrl(uri, 900) ?? uri} label={`첨부 사진 ${i + 1}`} style={{ marginTop: i ? 8 : 14 }} />
        ))}

        {!!post.audioUrl && <SiteAudio url={post.audioUrl} durationSec={post.audioDuration} style={{ marginVertical: 12 }} />}

        {/* 하트 · 말풍선(위 12, 왼쪽으로 10 넘김) — 좋아요는 목록과 같은 서버 상태·토글(낙관적 반영)이라 어느 쪽에서 눌러도 같이 바뀐다. 말풍선은 입력칸으로 */}
        <View style={{ marginTop: 12, marginLeft: -10, marginBottom: -8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <LikeButton liked={liked} count={post.likes ?? 0} onPress={toggleLike} label={`게시글 공감 ${post.likes ?? 0}`} />
          <TalkCount count={liveCount} onPress={() => { setReplyTo(null); commentInputRef.current?.focus(); }} label={`이야기 ${liveCount}, 이야기 남기기`} />
        </View>

        {/* 댓글 구역 — 반응 줄 아래 24에 1px 선, 선 아래 4. 제목 없음(개수는 말풍선 옆 숫자) */}
        <View style={{ marginTop: 24, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.line }} onLayout={(e) => { sectionY.current = e.nativeEvent.layout.y; }}>
          {isGuest ? (
            // 게스트 — 댓글은 로그인 후 볼 수 있다
            <View style={{ paddingTop: 28, alignItems: 'center' }}>
              <T v="body2" color={colors.textSecondary} center>로그인하면 댓글을 보고 남길 수 있어요.</T>
              <Button label="로그인하기" block onPress={() => previewActions.requireLogin('댓글은 로그인 후 볼 수 있어요')} style={{ marginTop: 16, alignSelf: 'stretch' }} />
            </View>
          ) : (
            <>
              {tops.map((c) => (
                <CommentThread
                  key={c.id}
                  c={c}
                  replies={shownComments.filter((r) => r.parent_id === c.id)}
                  postAuthorId={post.authorId}
                  myUid={myUid}
                  open={!!openThreads[c.id]}
                  onToggle={() => setOpenThreads((o) => ({ ...o, [c.id]: true }))}
                  onReply={startReply}
                  onMore={(r: CommentRow) => setMoreTarget({ kind: 'comment', id: r.id, authorId: r.author_id, nick: r.anon_nickname, body: r.body, mine: r.author_id === myUid })}
                  onPerson={(r: CommentRow) => askExchange({ kind: 'comment', id: r.id, authorId: r.author_id, nick: r.anon_nickname, gender: r.author_gender ?? null })}
                  likedIds={likedComments}
                  onLike={likeComment}
                  faceOf={faceOf}
                  focusId={focusId}
                  now={now}
                  onLayout={focusId && (c.id === focusId || shownComments.some((r: any) => r.id === focusId && r.parent_id === c.id))
                    ? (y) => {
                      if (scrolledToFocus.current) return;
                      scrolledToFocus.current = true;
                      setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, sectionY.current + y - 200), animated: true }), 60);
                    }
                    : undefined}
                />
              ))}
              {/* 댓글이 없을 때 — 선 아래 28: 말풍선 손그림 40 + "아직 이야기가 없어요" + "첫 이야기를 남겨 보세요" */}
              {!commentsQ.isLoading && shownComments.length === 0 && (
                <View style={{ marginTop: 24, alignItems: 'center' }}>
                  <CLine name="talk" size={40} sw={2.2} color={colors.control} />
                  <Text style={{ marginTop: 6, fontSize: 14, lineHeight: 21, fontWeight: '500', color: colors.textSecondary }}>아직 이야기가 없어요</Text>
                  <Text style={{ marginTop: 2, fontSize: 13, lineHeight: 22.75, color: colors.sub }}>첫 이야기를 남겨 보세요</Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <CommentComposer
        inputRef={commentInputRef}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        pending={addCommentMut.isPending || commentBusy}
        onSubmit={submitComment}
      />

      <CommunityMoreSheet
        target={moreTarget}
        authorLabel
        onClose={() => setMoreTarget(null)}
        onBlocked={() => { if (moreTarget?.kind === 'post') onBack?.(); }}
        onEdit={(t) => { if (t.kind === 'post') setEditOpen(true); else { setReplyTo(null); setEditing({ id: t.id, body: t.body ?? '' }); } }}
        onDelete={(t) => { if (t.kind === 'post') void doDelete(); else void removeComment(t.id); }}
      />
      <ExchangeRequestSheet target={ask} onClose={() => setAsk(null)} onOpenExchanges={onOpenExchanges} />
      <LoungeWrite open={editOpen} edit={post} onClose={() => setEditOpen(false)} />
    </KeyboardAware>
  );
}
