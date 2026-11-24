// 야화 — 커뮤니티 댓글 묶음(리뉴얼 1120, 시안 .cx-cmt · spec-rest §3.2)
// 댓글: 위 12 · 아래 4 · [얼굴 28 | 10 | 이름 13/16.9 600 (+ "나" · "글쓴이" 꼬리표) · 오른쪽 끝 ⋯ 40 → 글 14/22.4(위 4) → 날짜 · 작은 하트 · 답글 달기(높이 32, 왼쪽으로 10 넘김)]
// 답글은 왼쪽으로 38 들이고 꺾인 선(14×22, 선 1.5)을 그린다. 2개까지 펼치고 나머지는 "답글 N개 더 보기"(§13-5 추천안).
// 답글의 [답글 달기]는 같은 스레드에 단다(최대 2depth) — 그 답글 작성자에게면 본문 앞에 "@닉네임 "을 붙여 저장하고, 저장된 멘션은 강조 파랑으로 보여 준다.
// 얼굴 · 닉네임을 누르면(내 것 · 지운 것 제외) 프로필 교환 신청 시트. 글쓴이의 댓글은 얼굴 고리 + "글쓴이".
// 지운 댓글(답글이 남은 것만 남긴다): 얼굴 45% · 이름 글자-연 · "삭제된 댓글이에요." · 아래 줄과 ⋯ 없음.
import React, { useEffect, useRef } from 'react';
import { Animated, View, Text, Pressable } from 'react-native';
import { colors } from '../tokens';
import { NATIVE, reduceMotion, Tag } from '../ui';
import { CommunityAvatar } from './CommunityAvatar';
import { SiteAudio } from './community/SiteAudio';
import type { LoungeCommentRow } from '../lib/hooks';
import { siteAgo } from './community/time';
import { MoreDots } from './community/cIcons';
import { LikeButton } from './community/Reactions';

export type CommentRow = LoungeCommentRow & { likes?: number | null; deleted_at?: string | null };
const SHOWN_REPLIES = 2;

export function CommentThread({
  c, replies, postAuthorId, myUid, open, onToggle, onReply, onMore, onPerson, likedIds = [], onLike, faceOf, focusId, onLayout, now,
}: {
  c: CommentRow;
  replies: CommentRow[];
  postAuthorId?: string;
  myUid: string | null;
  open: boolean;                       // 답글을 모두 펼쳤는가(기본은 2개까지)
  onToggle: () => void;
  // 답글은 항상 최상위 댓글에 단다(2depth) — 답글의 [답글 달기]도 같은 스레드로, 멘션 대상만 그 답글 작성자
  onReply: (target: { id: string; nick: string; threadNick: string }) => void;
  onMore: (row: CommentRow) => void;   // ⋯ — 남의 댓글: 차단 · 신고 / 내 댓글: 고치기 · 지우기
  onPerson: (row: CommentRow) => void; // 얼굴 · 닉네임 — 프로필 교환 신청 시트
  likedIds?: string[];
  onLike?: (commentId: string) => void;
  faceOf: (authorId: string) => number;  // 이 글 안에서 그 사람의 얼굴 번호
  focusId?: string | null;             // 알림에서 연 댓글 — 그 줄을 반짝
  onLayout?: (y: number) => void;
  now?: number;                        // 'N분 전' 기준 시각(화면의 useNow) — 켜 둔 동안에도 흐르게
}) {
  const replyTo = (nick: string) => onReply({ id: c.id, nick, threadNick: c.anon_nickname });
  // 저장된 "@닉네임 " 멘션을 찾을 후보 — 이 스레드에 등장한 닉네임(긴 것부터: 공백 포함 닉네임 대응)
  const nicks = [...new Set([c.anon_nickname, ...replies.map((r) => r.anon_nickname)])].sort((a, b) => b.length - a.length);
  const item = (r: CommentRow, nested: boolean) => (
    <CommentItem
      key={r.id}
      nested={nested}
      row={r}
      knownNicks={nested ? nicks : undefined}
      mine={!!myUid && r.author_id === myUid}
      byAuthor={!!postAuthorId && r.author_id === postAuthorId}
      face={faceOf(r.author_id)}
      liked={likedIds.includes(r.id)}
      onLike={() => onLike?.(r.id)}
      onReply={() => replyTo(r.anon_nickname)}
      onMore={onMore}
      onPerson={onPerson}
      focused={focusId === r.id}
      now={now}
    />
  );
  const shown = open ? replies : replies.slice(0, SHOWN_REPLIES);
  const hidden = replies.length - shown.length;
  return (
    <View onLayout={onLayout ? (e) => onLayout(e.nativeEvent.layout.y) : undefined}>
      {item(c, false)}
      {shown.map((r) => item(r, true))}
      {hidden > 0 && (
        <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: false }} style={{ marginLeft: 38, height: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
          <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.textSecondary }}>{`답글 ${hidden}개 더 보기`}</Text>
        </Pressable>
      )}
    </View>
  );
}

function CommentItem({
  row, nested, knownNicks, mine, byAuthor, face, liked, onLike, onReply, onMore, onPerson, focused, now,
}: {
  row: CommentRow;
  nested?: boolean;
  knownNicks?: string[];
  mine: boolean;
  byAuthor: boolean;
  face: number;
  liked: boolean;
  onLike: () => void;
  onReply: () => void;
  onMore: (row: CommentRow) => void;
  onPerson: (row: CommentRow) => void;
  focused?: boolean;
  now?: number;
}) {
  const deleted = !!row.deleted_at;
  // 본문에 저장된 멘션("@닉네임 ...")이 있으면 강조 파랑으로 앞에 붙인다
  const saved = knownNicks?.find((n) => row.body.startsWith(`@${n} `) || row.body === `@${n}`) ?? null;
  const shownBody = saved ? row.body.slice(saved.length + 2) : row.body;
  const audio = !deleted && !!row.audio_url;   // 음성 댓글(0188) — 글이 없으면 재생 줄만
  const canAsk = !deleted && !mine;
  // 알림에서 연 댓글 — sky-50 바탕이 1.6초 반짝(처음 30%는 그대로, 그 뒤 사라짐)
  const flash = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    if (!focused) return;
    flash.setValue(1);
    const a = Animated.timing(flash, { toValue: 0, duration: reduceMotion() ? 600 : 1120, delay: 480, useNativeDriver: NATIVE });
    a.start();
    return () => a.stop();
  }, [focused, flash]);
  const who = (
    <CommunityAvatar gender={row.author_gender ?? null} size={28} variant={face} ring={byAuthor && !deleted} dim={deleted} />
  );
  return (
    <View style={{ paddingTop: 12, paddingBottom: 4, paddingLeft: nested ? 38 : 0, flexDirection: 'row', gap: 10 }}>
      {focused && <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -8, right: -8, top: 4, bottom: 0, borderRadius: 12, backgroundColor: colors.accentSubtle, opacity: flash }} />}
      {/* 답글 꺾인 선 — 왼쪽 13 · 위 −4 · 14×22 · 선 1.5 · 왼아래 모서리 10 */}
      {nested && <View pointerEvents="none" style={{ position: 'absolute', left: 13, top: -4, width: 14, height: 22, borderLeftWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.line, borderBottomLeftRadius: 10 }} />}
      {canAsk ? (
        <Pressable onPress={() => onPerson(row)} accessibilityRole="button" accessibilityLabel={`${row.anon_nickname} 프로필 교환`} hitSlop={6}>{who}</Pressable>
      ) : who}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ height: 20, flexDirection: 'row', alignItems: 'center', paddingRight: 32 }}>
          <Text onPress={canAsk ? () => onPerson(row) : undefined} numberOfLines={1} style={{ flexShrink: 1, fontSize: 13, lineHeight: 16.9, fontWeight: '600', color: deleted ? colors.mute : colors.text }}>{row.anon_nickname}</Text>
          {!deleted && mine && <Tag label="나" style={{ marginLeft: 6 }} />}
          {!deleted && byAuthor && !mine && <Tag label="글쓴이" style={{ marginLeft: 6 }} />}
        </View>
        {(deleted || !!saved || !!shownBody.trim() || !audio) && (
          <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 22.4, color: deleted ? colors.subtle : colors.text }}>
            {deleted ? '삭제된 댓글이에요.' : <>{!!saved && <Text style={{ fontWeight: '600', color: colors.accent }}>@{saved} </Text>}{shownBody}</>}
          </Text>
        )}
        {audio && <SiteAudio url={row.audio_url!} durationSec={row.audio_duration} style={{ marginTop: saved || shownBody.trim() ? 0 : 4 }} />}
        {/* 날짜 · 작은 하트 · 답글 달기 — 높이 32 · 왼쪽으로 10 넘김(시안 그대로) */}
        {!deleted && (
          <View style={{ height: 32, marginTop: 2, marginLeft: -10, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            {/* 줄을 왼쪽으로 10 넘긴 건 하트 · 답글 버튼의 누름 여백 때문 — 날짜는 그만큼 되돌려 이름 · 글과 왼쪽을 맞춘다 */}
            <Text style={{ marginLeft: 10, marginRight: 12, fontSize: 12, lineHeight: 14, color: colors.mute }}>{siteAgo(row.created_at, now)}</Text>
            <LikeButton small liked={liked} count={row.likes ?? 0} onPress={onLike} label={`${row.anon_nickname}님의 이야기 공감 ${row.likes ?? 0}`} />
            <Pressable onPress={onReply} accessibilityRole="button" style={{ height: 32, paddingHorizontal: 10, justifyContent: 'center' }}>
              <Text style={{ fontSize: 12, lineHeight: 17.4, fontWeight: '500', color: colors.textSecondary }}>답글 달기</Text>
            </Pressable>
          </View>
        )}
      </View>
      {/* ⋯ — 40×40, 점이 오른쪽 여백선에 닿게 12 넘김. 지운 댓글엔 없다 */}
      {!deleted && (
        <Pressable
          onPress={() => onMore(row)}
          accessibilityRole="button"
          accessibilityLabel="댓글 더보기"
          style={{ position: 'absolute', top: 2, right: -12, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}
        >
          <MoreDots size={18} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  );
}
