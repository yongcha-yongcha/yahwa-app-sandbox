// 야화 시연판 — 커뮤니티(익명 이야기) · 알림 · 프로필 교환 서버 함수 목업.
// 실제 서버(supabase/migrations 0021 · 0100 · 0132~0134 · 0169 · 0171 · 0175 · 0186 · 0187 · 0188)와 같은 모양으로 돌려준다.
// 맨 위 '고칠 수 있는 내용'만 바꿔도 시연도구 '상황 만들기'의 문장이 바뀌어요.
import type { Scenario } from '../scenario';
import { PEOPLE, person } from '../people';
import {
  ME_ID, table, insertRows, updateRows, deleteRows, requireUid, uid as currentUid, userById,
  nowIso, now, minutesAgo, DemoError, onRowChange, type Row,
} from '../db';
import { anonNick, titleOf } from '../seed/community';

// ── 고칠 수 있는 내용 ─────────────────────────────────────────
const EXCHANGE_COST = 10;        // 프로필 교환 요청 리프(남녀 공통, 0187 leaf_price('exchange'))
const POPULAR_SCORE = 3;         // 좋아요+댓글이 이만큼이면 '공감순'에 뽑힌다(0100)
const DAILY_EXCHANGE_LIMIT = 10; // 하루에 보낼 수 있는 교환 요청 수

// '내 글에 댓글 받기'에서 차례로 쓰는 댓글
const COMMENTS_ON_MY_POST = [
  '저도 딱 같은 고민 했었어요! 글 보고 용기 얻고 가요',
  '이런 글 너무 좋아요. 공감 꾹 누르고 가요',
  '솔직한 이야기라 더 와닿아요. 잘 되길 바랄게요',
  '저는 그냥 마음 가는 대로 하는 편이에요. 결과는 생각보다 괜찮더라고요',
  '읽다가 저도 모르게 웃었어요 ㅎㅎ 다음 이야기도 들려주세요',
];
// '내 댓글에 답글 받기'에서 차례로 쓰는 답글
const REPLIES_TO_ME = [
  '와 이 댓글 보고 생각이 좀 바뀌었어요. 고마워요!',
  '맞아요, 저도 딱 그렇게 생각해요',
  '혹시 조금 더 자세히 이야기해 주실 수 있어요?',
];
// '새 글 올라오게 하기'에서 차례로 올라오는 글(첫 줄이 제목)
const NEW_POSTS: { by: string; cat: 'free' | 'love' | 'qna' | 'meet' | 'food'; text: string; photo?: string }[] = [
  { by: 'u-f05', cat: 'love', text: '좋아하는 사람이 생겼는데 티 내도 될까요?\n같은 스터디 사람인데 요즘 자꾸 눈이 가요. 먼저 밥 먹자고 하면 너무 티 날까요?' },
  { by: 'u-m04', cat: 'free', photo: '/demo/community/walk.jpg', text: '오늘 하늘 사진 찍다가 30분 서 있었어요\n사진작가라 직업병인데, 이런 날은 누구한테든 보여 주고 싶어요.' },
  { by: 'u-f03', cat: 'food', photo: '/demo/community/food.jpg', text: '해운대 근처 혼밥하기 좋은 곳 알려 드려요\n바 자리에 앉아서 먹는 덮밥집인데 사장님이 정말 친절하세요.' },
];

// ─────────────────────────────────────────────────────────────
// 서버가 자동으로 하는 일(기본값 · 트리거) 흉내
// 앱이 supabase.from(...).insert로 글·댓글·알림·신고를 직접 넣으면 여기서 빈 칸을 채우고,
// 실제 서버처럼 댓글 알림(0133 · 0188)과 공감순 선정(0100)을 한다.
// ─────────────────────────────────────────────────────────────
const fill = (row: Row, defaults: Row) => { for (const [k, v] of Object.entries(defaults)) if (row[k] === undefined) row[k] = v; };

function isBlockedBy(blocker: string, blocked: string): boolean {
  return table('blocks').some((b) => b.blocker_id === blocker && b.blocked_id === blocked);
}
function isBlockedEither(a: string, b: string): boolean { return isBlockedBy(a, b) || isBlockedBy(b, a); }

// 공감순 선정 — 점수(좋아요 + 댓글 수)가 기준 이상이고, 아직 안 뽑혔거나 뽑힌 지 7일이 지났으면
function markPopular(postId: string) {
  const p = table('lounge_posts').find((x) => x.id === postId);
  if (!p) return;
  const score = (p.likes ?? 0) + table('lounge_comments').filter((c) => c.post_id === postId).length;
  const since = p.popular_since ? new Date(p.popular_since).getTime() : null;
  if (score >= POPULAR_SCORE && (since == null || since < now() - 7 * 86_400_000)) {
    updateRows('lounge_posts', (x) => x.id === postId, { popular_since: nowIso() });
  }
}

// 댓글 알림(0133 · 0188) — 답글이면 원댓글 쓴 사람에게, 그리고 글쓴이에게(같은 사람이면 한 번만). 자기 자신·차단한 상대는 빼요
function notifyComment(c: Row) {
  const post = table('lounge_posts').find((p) => p.id === c.post_id);
  const parent = c.parent_id ? table('lounge_comments').find((x) => x.id === c.parent_id) : null;
  const preview = (c.body ?? '').trim().slice(0, 60) || (c.audio_url ? '음성 댓글' : '');
  const data = { postId: c.post_id, commentId: c.id };
  const parentAuthor: string | null = parent?.author_id ?? null;
  if (parentAuthor && parentAuthor !== c.author_id && !isBlockedBy(parentAuthor, c.author_id)) {
    insertRows('notifications', { user_id: parentAuthor, kind: 'lounge_reply', title: '내 댓글에 답글이 달렸어요', body: preview, data, read: false });
  }
  const postAuthor: string | null = post?.author_id ?? null;
  if (postAuthor && postAuthor !== c.author_id && (!parentAuthor || parentAuthor !== postAuthor) && !isBlockedBy(postAuthor, c.author_id)) {
    insertRows('notifications', { user_id: postAuthor, kind: 'lounge_comment', title: `${post?.title || '내 글'}에 댓글이 달렸어요`, body: preview, data, read: false });
  }
}

onRowChange((e) => {
  if (e.type === 'INSERT') {
    if (e.table === 'lounge_posts') {
      fill(e.row, { attachments: [], likes: 0, views: 0, popular_since: null, author_gender: null, audio_url: null, audio_duration: null });
    } else if (e.table === 'lounge_comments') {
      fill(e.row, { parent_id: null, likes: 0, edited_at: null, deleted_at: null, author_gender: null, audio_url: null, audio_duration: null });
      notifyComment(e.row);
      markPopular(e.row.post_id);
    } else if (e.table === 'notifications') {
      fill(e.row, { body: null, data: null, read: false });
    } else if (e.table === 'reports') {
      fill(e.row, { detail: null, resolved: false });
    }
  }
  // 글을 지우면 딸린 댓글 · 좋아요도 함께(on delete cascade), 교환 기록의 글 연결은 비운다(on delete set null)
  if (e.type === 'DELETE' && e.table === 'lounge_posts') {
    const id = e.row.id;
    const gone = new Set(table('lounge_comments').filter((c) => c.post_id === id).map((c) => c.id));
    deleteRows('lounge_comments', (c) => c.post_id === id);
    deleteRows('lounge_likes', (l) => l.post_id === id);
    deleteRows('lounge_comment_likes', (l) => gone.has(l.comment_id));
    updateRows('profile_exchanges', (x) => x.post_id === id || gone.has(x.comment_id), (x) => ({
      post_id: x.post_id === id ? null : x.post_id,
      comment_id: gone.has(x.comment_id) ? null : x.comment_id,
    }));
  }
});

// ─────────────────────────────────────────────────────────────
// 도움 함수
// ─────────────────────────────────────────────────────────────
// 인연 프로필 요약 — users 행이 없으면 people.ts 값으로
function profileOf(id: string) {
  const u = userById(id);
  const p = person(id);
  const photos: string[] = Array.isArray(u?.photos) ? u!.photos : p?.photos ?? [];
  const birth = p?.birthYear ?? (u?.birth_date ? Number(String(u.birth_date).slice(0, 4)) : null);
  return {
    nickname: (u?.nickname ?? p?.nickname ?? null) as string | null,
    photo: photos[0] ?? null,
    age: (u?.age ?? (birth ? new Date(now()).getFullYear() - birth : null)) as number | null,
    gender: (u?.gender ?? p?.gender ?? null) as string | null,
  };
}
// 인연 프로필이 살아 있는가(완성 · 정지 아님 · 시드 계정 아님). users 행이 아직 없으면 people.ts 인물은 있다고 본다
function profileAlive(id: string, allowSeed = true): boolean {
  const u = userById(id);
  if (!u) return !!person(id) || id === ME_ID;
  if (u.profile_completed === false || u.affinity_suspended) return false;
  if (!allowSeed && u.is_seed) return false;
  return true;
}
const kstDay = (iso: string | number) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
const samePair = (x: Row, a: string, b: string) => (x.requester_id === a && x.target_id === b) || (x.requester_id === b && x.target_id === a);

// 리프 차감(charge_leaf_flat) — 모자라면 앱이 충전 창을 띄우는 오류(53100)
function chargeLeaf(userId: string, amount: number, reason: string) {
  if (amount <= 0) return;
  const u = userById(userId);
  if (!u) return;
  const bal = Number(u.leaf_balance ?? 0);
  if (bal < amount) throw new DemoError('insufficient leaf', '53100');
  updateRows('users', (r) => r.id === userId, { leaf_balance: bal - amount, updated_at: nowIso() });
  insertRows('transactions', { user_id: userId, kind: 'unlock', amount: -amount, provider: 'system', meta: { reason, currency: 'leaf' } });
}

// 교환 목록 한 줄(get_my_profile_exchanges · v2)
function exchangeRow(e: Row, me: string, v2: boolean) {
  const sent = e.requester_id === me;
  const otherId = sent ? e.target_id : e.requester_id;
  const o = profileOf(otherId);
  const done = e.status === 'accepted';
  const post = e.post_id ? table('lounge_posts').find((p) => p.id === e.post_id) : null;
  const c = e.comment_id ? table('lounge_comments').find((x) => x.id === e.comment_id) : null;
  const row: Row = {
    id: e.id,
    direction: sent ? 'sent' : 'received',
    status: e.status,
    other_id: done ? otherId : null,
    nickname: done ? o.nickname : null,
    photo: done ? o.photo : null,
    age: done ? o.age : null,
    gender: v2 || done ? o.gender : null,   // v2는 교환 전에도 성별(익명 얼굴용)
    post_id: e.post_id ?? null,
    post_title: post?.title ?? null,
    comment_body: c ? String(c.body ?? '').slice(0, 80) : null,
    anon_nickname: c?.anon_nickname ?? null,
    created_at: e.created_at,
    responded_at: e.responded_at ?? null,
  };
  if (v2) { row.released_at = e.released_at ?? null; row.released_by_me = e.released_by ? e.released_by === me : null; }
  return row;
}
function myExchanges(v2: boolean) {
  const me = currentUid();
  if (!me) return [];
  return table('profile_exchanges')
    .filter((e) => (e.requester_id === me || e.target_id === me) && (v2 || e.status !== 'released'))
    .sort((a, b) => {
      const wa = a.status === 'pending' && a.target_id === me ? 1 : 0;
      const wb = b.status === 'pending' && b.target_id === me ? 1 : 0;
      return wb - wa || String(b.created_at).localeCompare(String(a.created_at));
    })
    .map((e) => exchangeRow(e, me, v2));
}

// ─────────────────────────────────────────────────────────────
// 서버 함수
// ─────────────────────────────────────────────────────────────
export const rpc: Record<string, (args: any) => any> = {
  // 글 좋아요 토글(0021) → [{ likes, liked }]
  toggle_lounge_like({ p_post_id }: { p_post_id: string }) {
    const me = requireUid();
    const post = table('lounge_posts').find((p) => p.id === p_post_id);
    if (!post) throw new DemoError('게시글을 찾을 수 없어요', 'P0002');
    const had = deleteRows('lounge_likes', (l) => l.post_id === p_post_id && l.user_id === me).length > 0;
    if (!had) insertRows('lounge_likes', { post_id: p_post_id, user_id: me });
    // 시드의 좋아요 수는 '다른 사람들' 몫까지 들어 있어 다시 세지 않고 하나만 더하고 뺀다
    const likes = Math.max(0, (post.likes ?? 0) + (had ? -1 : 1));
    updateRows('lounge_posts', (p) => p.id === p_post_id, { likes });
    markPopular(p_post_id);
    return [{ likes, liked: !had }];
  },

  my_liked_lounge_posts() {
    const me = currentUid();
    return me ? table('lounge_likes').filter((l) => l.user_id === me).map((l) => l.post_id) : [];
  },

  // 댓글 좋아요 토글(0169) → [{ likes, liked }]
  toggle_lounge_comment_like({ p_comment_id }: { p_comment_id: string }) {
    const me = requireUid();
    const c = table('lounge_comments').find((x) => x.id === p_comment_id);
    if (!c) throw new DemoError('댓글을 찾을 수 없어요', 'P0002');
    if (isBlockedEither(me, c.author_id)) throw new DemoError('좋아요할 수 없는 댓글이에요', 'P0001');
    const had = deleteRows('lounge_comment_likes', (l) => l.comment_id === p_comment_id && l.user_id === me).length > 0;
    if (!had) insertRows('lounge_comment_likes', { comment_id: p_comment_id, user_id: me });
    const likes = Math.max(0, (c.likes ?? 0) + (had ? -1 : 1));
    updateRows('lounge_comments', (x) => x.id === p_comment_id, { likes });
    return [{ likes, liked: !had }];
  },

  my_liked_lounge_comments({ p_post_id }: { p_post_id: string }) {
    const me = currentUid();
    if (!me) return [];
    const ids = new Set(table('lounge_comments').filter((c) => c.post_id === p_post_id).map((c) => c.id));
    return table('lounge_comment_likes').filter((l) => l.user_id === me && ids.has(l.comment_id)).map((l) => l.comment_id);
  },

  // 내 댓글 고치기 · 지우기(0171) — 지우면 흔적만 남긴다
  edit_lounge_comment({ p_id, p_body }: { p_id: string; p_body: string }) {
    const me = requireUid();
    const body = String(p_body ?? '').trim();
    if (body.length < 1 || body.length > 2000) throw new DemoError('댓글은 1~2,000자로 적어주세요', '22023');
    const hit = updateRows('lounge_comments', (c) => c.id === p_id && c.author_id === me && !c.deleted_at, { body, edited_at: nowIso() });
    if (!hit.length) throw new DemoError('수정할 수 없는 댓글이에요', 'P0001');
    return null;
  },
  delete_lounge_comment({ p_id }: { p_id: string }) {
    const me = requireUid();
    const hit = updateRows('lounge_comments', (c) => c.id === p_id && c.author_id === me && !c.deleted_at, { body: '', deleted_at: nowIso(), likes: 0 });
    if (!hit.length) throw new DemoError('삭제할 수 없는 댓글이에요', 'P0001');
    deleteRows('lounge_comment_likes', (l) => l.comment_id === p_id);
    return null;
  },

  // 조회수(0100) — 로그인 없이도
  bump_lounge_view({ p_post_id }: { p_post_id: string }) {
    updateRows('lounge_posts', (p) => p.id === p_post_id, (p) => ({ views: (p.views ?? 0) + 1 }));
    return null;
  },

  // 이용수칙 확인(0175) — 처음 확인한 시각을 남기고 돌려준다
  ack_community_guide() {
    const me = requireUid();
    const u = userById(me);
    const at = u?.community_guide_ack_at ?? nowIso();
    if (u && !u.community_guide_ack_at) updateRows('users', (r) => r.id === me, { community_guide_ack_at: at });
    return at;
  },

  // ── 프로필 교환 ──────────────────────────────────────────
  // 요청(0187) → { ok, id, charged }
  request_profile_exchange({ p_comment_id, p_post_id }: { p_comment_id?: string | null; p_post_id?: string | null }) {
    const me = requireUid();
    let target: string | undefined; let postId: string | undefined;
    if (p_comment_id) {
      const c = table('lounge_comments').find((x) => x.id === p_comment_id);
      if (!c) throw new DemoError('댓글을 찾을 수 없어요', 'P0002');
      target = c.author_id; postId = c.post_id;
    } else if (p_post_id) {
      const p = table('lounge_posts').find((x) => x.id === p_post_id);
      if (!p) throw new DemoError('게시글을 찾을 수 없어요', 'P0002');
      target = p.author_id; postId = p.id;
    } else {
      throw new DemoError('신청 대상이 없어요', '22023');
    }
    if (target === me) throw new DemoError('내 글에는 신청할 수 없어요', 'P0001');
    if (!profileAlive(me)) throw new DemoError('인연 프로필을 먼저 완성해 주세요', 'P0001');
    if (!profileAlive(target!, false)) throw new DemoError('상대가 아직 인연 프로필을 만들지 않았어요', 'P0001');
    if (isBlockedEither(me, target!)) throw new DemoError('신청할 수 없는 상대예요', 'P0001');
    const xs = table('profile_exchanges');
    if (xs.some((x) => samePair(x, me, target!) && (x.status === 'accepted' || x.status === 'released'))) {
      throw new DemoError('이전에 프로필 교환한 이력이 있는 상대방이에요.', 'P0001');
    }
    if (xs.some((x) => x.requester_id === me && x.target_id === target && x.status === 'pending')) throw new DemoError('이미 요청을 보냈어요.', 'P0001');
    if (xs.some((x) => x.requester_id === target && x.target_id === me && x.status === 'pending')) {
      throw new DemoError('상대가 먼저 교환을 신청했어요. 알림에서 확인해 주세요.', 'P0001');
    }
    const weekAgo = now() - 7 * 86_400_000;
    if (xs.some((x) => x.requester_id === me && x.target_id === target && x.status === 'declined' && x.responded_at && new Date(x.responded_at).getTime() > weekAgo)) {
      throw new DemoError('최근에 거절된 상대예요. 조금 뒤에 다시 시도해 주세요', 'P0001');
    }
    const today = kstDay(now());
    if (xs.filter((x) => x.requester_id === me && kstDay(x.created_at) === today).length >= DAILY_EXCHANGE_LIMIT) {
      throw new DemoError('오늘은 프로필 교환을 더 신청할 수 없어요', 'P0001');
    }
    chargeLeaf(me, EXCHANGE_COST, 'profile_exchange');
    const [x] = insertRows('profile_exchanges', {
      requester_id: me, target_id: target, post_id: postId, comment_id: p_comment_id ?? null, status: 'pending',
      responded_at: null, released_at: null, released_by: null, requester_viewed_at: null, target_viewed_at: null,
    });
    // 받는 사람에게 알림(닉네임 없이 — 수락 전까지 서로 누군지 몰라야 한다)
    insertRows('notifications', {
      user_id: target, kind: 'profile_exchange_request', title: '프로필 교환 신청',
      body: p_comment_id ? '내 댓글을 보고 프로필 교환을 신청했어요' : '내 글을 보고 프로필 교환을 신청했어요',
      data: { exchangeId: x.id, postId, commentId: p_comment_id ?? null }, read: false,
    });
    return { ok: true, id: x.id, charged: EXCHANGE_COST };
  },

  // 받은 요청 수락 · 거절(0132) → { ok, status }
  respond_profile_exchange({ p_id, p_accept }: { p_id: string; p_accept: boolean }) {
    const me = requireUid();
    const status = p_accept ? 'accepted' : 'declined';
    const [x] = updateRows('profile_exchanges', (e) => e.id === p_id && e.target_id === me && e.status === 'pending', { status, responded_at: nowIso() });
    if (!x) throw new DemoError('처리할 수 없는 신청이에요', 'P0002');
    if (p_accept) {
      insertRows('notifications', {
        user_id: x.requester_id, kind: 'profile_exchange_accepted', title: '프로필 교환 성사',
        body: '상대가 수락했어요. 이제 서로의 인연 프로필을 볼 수 있어요', data: { exchangeId: p_id, otherUserId: me }, read: false,
      });
    }
    return { ok: true, status };
  },

  // 교환 해제(0171) — 교환한 둘 중 누구나
  release_profile_exchange({ p_id }: { p_id: string }) {
    const me = requireUid();
    const x = table('profile_exchanges').find((e) => e.id === p_id && (e.requester_id === me || e.target_id === me));
    if (!x) throw new DemoError('교환 기록을 찾을 수 없어요', 'P0002');
    if (x.status !== 'accepted') throw new DemoError('교환이 완료된 상대만 해제할 수 있어요', 'P0001');
    updateRows('profile_exchanges', (e) => e.id === p_id, { status: 'released', released_at: nowIso(), released_by: me });
    return { ok: true, status: 'released' };
  },

  // 목록 — 예전 판(해제 빼고) · v2(해제 포함 + 교환 전에도 성별)
  get_my_profile_exchanges: () => myExchanges(false),
  get_my_profile_exchanges_v2: () => myExchanges(true),

  // 이 글에 댓글 단 사람과의 교환 상태(0132) → [{ comment_id, status, direction }]
  get_comment_exchange_states({ p_post_id }: { p_post_id: string }) {
    const me = currentUid();
    if (!me) return [];
    const out: Row[] = [];
    for (const c of table('lounge_comments')) {
      if (c.post_id !== p_post_id || c.author_id === me) continue;
      for (const e of table('profile_exchanges')) {
        if (!samePair(e, me, c.author_id) || (e.status !== 'pending' && e.status !== 'accepted')) continue;
        out.push({ comment_id: c.id, status: e.status, direction: e.requester_id === me ? 'sent' : 'received' });
      }
    }
    return out;
  },

  // 교환한(성사 · 해제) 사람 — 오늘의 인연 추천에서 뺀다(0171)
  exchanged_user_ids() {
    const me = currentUid();
    if (!me) return [];
    return table('profile_exchanges')
      .filter((e) => (e.requester_id === me || e.target_id === me) && (e.status === 'accepted' || e.status === 'released'))
      .map((e) => (e.requester_id === me ? e.target_id : e.requester_id));
  },

  // 교환한 프로필을 열 수 있는가(0171) — 상대가 나를 차단했으면 처음 한 번만. 열면 첫 열람을 남긴다
  can_view_exchanged_profile({ p_other }: { p_other: string }) {
    const me = currentUid();
    if (!me || isBlockedBy(me, p_other)) return false;
    const x = table('profile_exchanges').find((e) => e.status === 'accepted' && samePair(e, me, p_other));
    if (!x) return false;
    const col = x.requester_id === me ? 'requester_viewed_at' : 'target_viewed_at';
    if (isBlockedBy(p_other, me) && x[col]) return false;
    if (!x[col]) updateRows('profile_exchanges', (e) => e.id === x.id, { [col]: nowIso() });
    return true;
  },

  // 차단 관리 목록(0186) — 이름은 교환한 사이처럼 이미 아는 사람일 때만(익명 이야기에서 차단한 사람은 이름 없이)
  my_blocks() {
    const me = currentUid();
    if (!me) return [];
    const known = new Set<string>(rpc.exchanged_user_ids({}) as string[]);
    for (const l of table('letters')) {
      if (l.sender_id === me && l.receiver_id) known.add(l.receiver_id);
      if (l.receiver_id === me && l.sender_id) known.add(l.sender_id);
    }
    return table('blocks')
      .filter((b) => b.blocker_id === me)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((b) => {
        const k = known.has(b.blocked_id);
        const o = profileOf(b.blocked_id);
        return { blocked_id: b.blocked_id, nickname: k ? o.nickname : null, photo: k ? o.photo : null, created_at: b.created_at };
      });
  },
};

// ─────────────────────────────────────────────────────────────
// 시연도구 '상황 만들기'
// ─────────────────────────────────────────────────────────────
let turn = 0;
const pick = <T,>(list: T[]): T => list[turn++ % list.length];
const blockedByMe = () => new Set(table('blocks').filter((b) => b.blocker_id === ME_ID).map((b) => b.blocked_id));
const myPosts = () => table('lounge_posts').filter((p) => p.author_id === ME_ID).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

// 그 글에서 그 사람이 쓸 익명 닉네임(이미 썼으면 그대로)
function nickIn(postId: string, userId: string): string {
  const post = table('lounge_posts').find((p) => p.id === postId);
  if (post?.author_id === userId) return post.anon_nickname;
  const cs = table('lounge_comments').filter((c) => c.post_id === postId);
  const mine = cs.find((c) => c.author_id === userId);
  if (mine) return mine.anon_nickname;
  return anonNick(`${postId}:${userId}:${now()}`, new Set([post?.anon_nickname, ...cs.map((c) => c.anon_nickname)]));
}
// 새 댓글 넣기 — 알림 · 공감순은 위 트리거 흉내가 처리한다
function addComment(postId: string, by: string, body: string, parentId: string | null = null): Row {
  const [c] = insertRows('lounge_comments', {
    post_id: postId, parent_id: parentId, author_id: by, anon_nickname: nickIn(postId, by),
    author_gender: profileOf(by).gender, body,
  });
  return c;
}
// 아직 이 글에 댓글을 안 단(그리고 내가 차단하지 않은) 사람을 우선으로
function someoneFor(postId: string): string {
  const blocked = blockedByMe();
  const done = new Set(table('lounge_comments').filter((c) => c.post_id === postId).map((c) => c.author_id));
  const pool = PEOPLE.filter((p) => !blocked.has(p.id));
  const fresh = pool.filter((p) => !done.has(p.id));
  return pick(fresh.length ? fresh : pool).id;
}

let lastPostId: string | null = null;
const toPost = () => (lastPostId ? { overlay: 'loungeDetail', params: { loungePostId: lastPostId } } : { tab: 'lounge' as const });

export const scenarios: Scenario[] = [
  {
    id: 'community-comment-on-my-post',
    group: '커뮤니티',
    label: '내 글에 댓글 받기',
    hint: '가장 최근 내 글에 새 댓글 + 알림',
    run() {
      const post = myPosts()[0];
      if (!post) { lastPostId = null; return '내 글이 없어요. 커뮤니티에서 글을 먼저 써 주세요.'; }
      const c = addComment(post.id, someoneFor(post.id), pick(COMMENTS_ON_MY_POST));
      lastPostId = post.id;
      return `${c.anon_nickname}님이 '${post.title}'에 댓글을 남겼어요.`;
    },
    get go() { return toPost(); },
  },
  {
    id: 'community-reply-to-me',
    group: '커뮤니티',
    label: '내 댓글에 답글 받기',
    hint: '내가 남의 글에 쓴 최근 댓글에 답글 + 알림',
    run() {
      const mine = table('lounge_comments')
        .filter((c) => c.author_id === ME_ID && !c.parent_id && !c.deleted_at)
        .filter((c) => table('lounge_posts').find((p) => p.id === c.post_id)?.author_id !== ME_ID)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
      if (!mine) { lastPostId = null; return '남의 글에 단 내 댓글이 없어요. 아무 글에나 댓글을 먼저 남겨 주세요.'; }
      const r = addComment(mine.post_id, someoneFor(mine.post_id), pick(REPLIES_TO_ME), mine.id);
      lastPostId = mine.post_id;
      return `${r.anon_nickname}님이 내 댓글에 답글을 달았어요.`;
    },
    go: { overlay: 'notifications' },
  },
  {
    id: 'community-likes-on-my-post',
    group: '커뮤니티',
    label: '내 글에 공감 받기',
    hint: '가장 최근 내 글에 공감 3개(실제 서버도 공감 알림은 보내지 않아요)',
    run() {
      const post = myPosts()[0];
      if (!post) { lastPostId = null; return '내 글이 없어요. 커뮤니티에서 글을 먼저 써 주세요.'; }
      const liked = new Set(table('lounge_likes').filter((l) => l.post_id === post.id).map((l) => l.user_id));
      const fans = PEOPLE.filter((p) => !liked.has(p.id)).slice(0, 3);
      fans.forEach((p) => insertRows('lounge_likes', { post_id: post.id, user_id: p.id }));
      const add = fans.length || 3;
      updateRows('lounge_posts', (p) => p.id === post.id, (p) => ({ likes: (p.likes ?? 0) + add }));
      markPopular(post.id);
      lastPostId = post.id;
      return `'${post.title}'의 공감이 ${add}개 늘었어요(지금 ${(post.likes ?? 0)}개).`;
    },
    get go() { return toPost(); },
  },
  {
    id: 'community-new-post',
    group: '커뮤니티',
    label: '새 글 올라오게 하기',
    hint: '다른 사람이 지금 막 글을 올려요',
    run() {
      const s = pick(NEW_POSTS);
      const used = new Set(table('lounge_posts').map((p) => p.anon_nickname));
      const [p] = insertRows('lounge_posts', {
        author_id: s.by, anon_nickname: anonNick(`${s.by}:${now()}`, used), cat: s.cat,
        title: titleOf(s.text), body: s.text, author_gender: profileOf(s.by).gender,
        attachments: s.photo ? [s.photo] : [],
      });
      lastPostId = p.id;
      return `${p.anon_nickname}님이 새 글을 올렸어요: '${p.title}'`;
    },
    go: { tab: 'lounge' },
  },
  {
    id: 'community-exchange-request',
    group: '커뮤니티',
    label: '프로필 교환 요청 받기',
    hint: '내 글을 본 사람이 교환을 신청해요',
    run() {
      const post = myPosts()[0];
      if (!post) return '내 글이 없어요. 커뮤니티에서 글을 먼저 써 주세요.';
      const busy = new Set(table('profile_exchanges').filter((e) => e.requester_id === ME_ID || e.target_id === ME_ID).map((e) => (e.requester_id === ME_ID ? e.target_id : e.requester_id)));
      const blocked = blockedByMe();
      const from = PEOPLE.find((p) => !busy.has(p.id) && !blocked.has(p.id));
      if (!from) return '교환을 신청할 사람이 더 없어요. 시연도구에서 처음 상태로 돌려 주세요.';
      const [x] = insertRows('profile_exchanges', {
        requester_id: from.id, target_id: ME_ID, post_id: post.id, comment_id: null, status: 'pending',
        responded_at: null, released_at: null, released_by: null, requester_viewed_at: null, target_viewed_at: null,
      });
      insertRows('notifications', {
        user_id: ME_ID, kind: 'profile_exchange_request', title: '프로필 교환 신청', body: '내 글을 보고 프로필 교환을 신청했어요',
        data: { exchangeId: x.id, postId: post.id, commentId: null }, read: false,
      });
      return `누군가 내 글을 보고 프로필 교환을 신청했어요(실제로는 ${from.nickname}님).`;
    },
    go: { overlay: 'profileExchanges' },
  },
  {
    id: 'community-exchange-accepted',
    group: '커뮤니티',
    label: '보낸 교환 요청 수락받기',
    hint: '기다리던 내 요청 하나를 상대가 수락해요',
    run() {
      const x = table('profile_exchanges').filter((e) => e.requester_id === ME_ID && e.status === 'pending')
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0];
      if (!x) return '기다리는 보낸 요청이 없어요. 글 상세에서 다른 사람 얼굴을 눌러 먼저 요청해 주세요.';
      updateRows('profile_exchanges', (e) => e.id === x.id, { status: 'accepted', responded_at: nowIso() });
      insertRows('notifications', {
        user_id: ME_ID, kind: 'profile_exchange_accepted', title: '프로필 교환 성사',
        body: '상대가 수락했어요. 이제 서로의 인연 프로필을 볼 수 있어요', data: { exchangeId: x.id, otherUserId: x.target_id }, read: false,
      });
      return `${profileOf(x.target_id).nickname ?? '상대'}님이 프로필 교환을 수락했어요.`;
    },
    go: { overlay: 'notifications' },
  },
  {
    id: 'community-exchange-declined',
    group: '커뮤니티',
    label: '보낸 교환 요청 거절받기',
    hint: '기다리던 내 요청 하나를 상대가 정중히 거절해요(알림은 없어요)',
    run() {
      const x = table('profile_exchanges').filter((e) => e.requester_id === ME_ID && e.status === 'pending')
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0];
      if (!x) return '기다리는 보낸 요청이 없어요. 글 상세에서 다른 사람 얼굴을 눌러 먼저 요청해 주세요.';
      updateRows('profile_exchanges', (e) => e.id === x.id, { status: 'declined', responded_at: nowIso() });
      return '보낸 요청 하나가 거절됐어요. 교환 기록 탭에서 볼 수 있어요.';
    },
    go: { overlay: 'profileExchanges' },
  },
  {
    id: 'community-notifs-unread',
    group: '커뮤니티',
    label: '최근 알림 안 읽음으로',
    hint: '최근 하루 커뮤니티 알림을 다시 안 읽음으로',
    run() {
      const since = minutesAgo(1440);
      const hit = updateRows('notifications', (n) => n.user_id === ME_ID && n.read && String(n.created_at) >= since
        && (String(n.kind).startsWith('lounge_') || String(n.kind).startsWith('profile_exchange')), { read: false });
      return hit.length ? `알림 ${hit.length}개를 안 읽음으로 돌렸어요.` : '최근 하루 안에 읽은 커뮤니티 알림이 없어요.';
    },
    go: { overlay: 'notifications' },
  },
];
