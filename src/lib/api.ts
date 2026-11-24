// 야화 — 데이터 액세스 레이어. UI는 이 함수들과 React Query로만 DB 접근.
import { supabase, getSessionUser } from './supabase';
import { sendAlimtalk } from './alimtalk';
import { CAT_COVER, DEFAULT_COVER } from '../data/mock';
import type { Gather, GatherSlot } from '../data/mock';
import type { Database } from './database.types';

type UserRow = Database['public']['Tables']['users']['Row'];

export async function fetchMe() {
  const user = await getSessionUser();
  if (!user) return null;
  // 본인 전체 행 — get_me RPC(SECURITY DEFINER). phone/birth_* 컬럼이 REVOKE된 뒤에도
  // 본인은 자기 PII를 조회할 수 있어야 하므로 RPC 경유.
  // RPC 부재(마이그레이션 0023 미적용) 환경에서는 기존 select로 폴백 — 배포 순서가 어긋나도 로그인이 깨지지 않게.
  const { data, error: rpcErr } = await supabase.rpc('get_me' as never);
  if (!rpcErr) {
    const rows = data as unknown as UserRow[] | UserRow | null;
    return (Array.isArray(rows) ? (rows[0] ?? null) : (rows ?? null)) as UserRow | null;
  }
  const { data: row, error: rowErr } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (rowErr) throw rowErr;
  return row;
}

// 피드: photos / intro / basic_info는 view에 포함되지 않음 (잠금 게이트는 RPC 경유).
export async function fetchProfileFeed({ limit = 20 }: { limit?: number } = {}) {
  const { data, error } = await supabase
    .from('profile_cards' as never)  // view (수동 타입은 후속 generate에서 보강)
    .select('*')
    .limit(limit);
  if (error) throw error;
  return data as Array<{
    user_id: string;
    tags: string[];
    photo_count: number;
    nickname: string;
    age: number | null;
    region: string | null;
    headline: string | null;
  }>;
}

// 잠금 해제 또는 본인일 때만 photos/intro 반환. RPC가 보안 강제.
export async function fetchProfileFull(targetId: string) {
  const { data, error } = await supabase.rpc('get_profile_full', { target_id: targetId });
  if (error) throw error;
  return (data as unknown as Array<{
    user_id: string;
    photos: string[];
    intro: string | null;
    basic_info: unknown;
    tags: string[];
    nickname: string;
    age: number | null;
    region: string | null;
    headline: string | null;
    unlocked: boolean;
  }>)[0];
}

export async function fetchGatherings() {
  const { data, error } = await supabase
    .from('gatherings')
    .select('*')
    .eq('status', 'recruiting')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchLoungePosts(cat?: 'free' | 'love' | 'qna' | 'meet' | 'food') {
  let q = supabase.from('lounge_posts').select('*').order('created_at', { ascending: false });
  if (cat) q = q.eq('cat', cat);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function fetchStores() {
  const { data, error } = await supabase.from('stores').select('*').eq('active', true);
  if (error) throw error;
  return data;
}

// 잠금 해제 — 가격은 서버에서 결정. 클라이언트는 target만 넘긴다.
export async function unlockProfile(targetId: string) {
  const { data, error } = await supabase.rpc('unlock_profile', { target_profile_id: targetId });
  if (error) throw error;
  return data as number;
}

export async function joinGathering(gatheringId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase
    .from('gathering_slots')
    .insert({ gathering_id: gatheringId, user_id: user.id });
  if (error) {
    // RLS WITH CHECK 실패 시 PGRST 에러 → 친화 메시지
    if (error.code === '42501' || error.message?.includes('row-level')) {
      throw new Error('이 게더링은 이미 마감되었거나 참여할 수 없어요');
    }
    throw error;
  }
}




// ── 채팅 — 크로스 브라우저 실시간 ────────────────────────────────────────────
export type ServerChatRoom = {
  id: string;
  kind: 'dm' | 'gather';
  gathering_id: string | null;
  locked: boolean;
  created_at: string;
  chat_members: Array<{ user_id: string; users: { nickname: string } | null }>;
  gatherings: { title: string; ratio: string; cover: string | null; host_nick: string | null; host_photo: string | null; gender_mode: string | null; capacity: number | null; slots: number | null } | null;
  // 클라이언트 가공: 마지막 메시지 + 표시명/사진
  _last?: { body: string; created_at: string };
  _peerName?: string;
  _peerPhoto?: string | null;
  _members?: string[];
  // 멤버 프로필 — 목록 썸네일(여러 명 겹쳐 보여주기)·말풍선 아바타에 쓴다
  _memberProfiles?: Array<{ id: string; nickname: string; photo: string | null }>;
  _ratio?: string | null;
  // 안읽음 계산용 — 내가 안 보낸 최근 메시지의 시각 (seen-at 이후 개수를 센다)
  _recent?: Array<{ created_at: string; sender_id: string }>;
};

// 채팅방 나가기 — chat_members에서 내 행만 삭제(0004 chat_members_delete_self).
// 방과 메시지는 남고, 남은 멤버끼리 대화는 이어진다.
export async function leaveChatRoom(roomId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase
    .from('chat_members')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', user.id);
  if (error) throw error;
}

export async function fetchChatRoomsFull(): Promise<ServerChatRoom[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const { data: rooms, error } = await supabase
    .from('chat_rooms')
    .select(`id, kind, gathering_id, locked, created_at,
             chat_members(user_id, users(nickname)),
             gatherings(title, ratio, cover, host_nick, host_photo, gender_mode, capacity, slots)`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const list = (rooms ?? []) as unknown as ServerChatRoom[];
  if (list.length === 0) return list;
  // 마지막 메시지 한 번에 fetch
  const ids = list.map((r) => r.id);
  // limit 없이 전체를 긁으면 채팅이 실사용되는 순간 부하가 된다 — 상한을 둔다.
  const { data: msgs } = await supabase
    .from('chat_messages')
    .select('room_id, body, created_at, sender_id')
    .in('room_id', ids)
    .order('created_at', { ascending: false })
    .limit(500);
  const lastByRoom = new Map<string, { body: string; created_at: string }>();
  const recentByRoom = new Map<string, Array<{ created_at: string; sender_id: string }>>();
  for (const m of (msgs ?? []) as any[]) {
    if (!lastByRoom.has(m.room_id)) lastByRoom.set(m.room_id, { body: m.body, created_at: m.created_at });
    const arr = recentByRoom.get(m.room_id) ?? [];
    if (arr.length < 50) { arr.push({ created_at: m.created_at, sender_id: m.sender_id }); recentByRoom.set(m.room_id, arr); }
  }
  // 멤버 프로필 — users RLS가 본인 행만 허용해 조인으로는 못 가져온다(0120 RPC).
  const profByRoom = new Map<string, Array<{ id: string; nickname: string; photo: string | null }>>();
  const { data: mems } = await supabase.rpc('get_chat_members' as never);
  for (const m of (mems ?? []) as any[]) {
    const arr = profByRoom.get(m.room_id) ?? [];
    arr.push({ id: m.user_id, nickname: m.nickname ?? '참여자', photo: m.photo ?? null });
    profByRoom.set(m.room_id, arr);
  }

  // 화면용 가공
  for (const r of list) {
    r._last = lastByRoom.get(r.id);
    if (r.kind === 'gather') {
      // 이름은 모임 제목만 — 성비(1:1)는 별도 뱃지로 낸다(제목에 붙이면 '2/2'와 겹쳐 헷갈림)
      r._peerName = r.gatherings?.title ?? '모임';
      r._peerPhoto = null;  // 썸네일은 호스트 사진이 아니라 멤버 프로필을 겹쳐서 보여준다
    } else {
      const peer = (profByRoom.get(r.id) ?? []).find((m) => m.id !== user.id);
      r._peerName = peer?.nickname ?? '상대방';
      r._peerPhoto = peer?.photo ?? null;
    }
    r._members = (r.chat_members ?? []).map((m) => m.user_id);
    // 나를 뒤로 — 목록 썸네일에서 상대 얼굴이 먼저 보이게
    r._memberProfiles = (profByRoom.get(r.id) ?? [])
      .sort((a, b) => (a.id === user.id ? 1 : 0) - (b.id === user.id ? 1 : 0));
    // 성비 무관 모임은 'N명'으로 — ratio(2:2)를 그대로 쓰면 실제 조건과 어긋난다(0903)
    if (r.gatherings) {
      const gm = r.gatherings.gender_mode;
      const cap = r.gatherings.capacity ?? r.gatherings.slots ?? null;
      r._ratio = gm === 'any'
        ? (cap === 2 ? '1:1' : cap ? `${cap}명` : null)
        : r.gatherings.ratio;
    } else {
      r._ratio = null;
    }
    r._recent = recentByRoom.get(r.id) ?? [];
  }
  return list;
}

export async function fetchChatMessages(roomId: string) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

// realtime 구독 — 새 메시지가 도착하면 콜백. 반환된 unsubscribe를 cleanup에서 호출.
export function subscribeChatMessages(roomId: string, onInsert: (m: ServerChatMessage) => void): () => void {
  const channel = supabase
    .channel(`room:${roomId}:${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
      (payload) => onInsert(payload.new as ServerChatMessage),
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export type ServerChatMessage = {
  id: string;
  room_id: string;
  sender_id: string;
  body: string;
  kind: string;
  created_at: string;
};

export async function sendChatMessage({ roomId, body }: { roomId: string; body: string }) {
  const trimmed = body.trim();
  if (trimmed.length === 0) throw new Error('메시지를 입력해 주세요');
  if (trimmed.length > 4000) throw new Error('메시지는 4000자 이내로 작성해 주세요');
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase
    .from('chat_messages')
    .insert({ room_id: roomId, sender_id: user.id, body: trimmed });
  if (error) throw error;
}

export async function blockUser(targetUserId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: user.id, blocked_id: targetUserId });
  blockedCache = null;
  if (error && !error.message?.includes('duplicate')) throw error;
}

// 내 게시물 즉시 삭제 (Apple 1.2 — 사용자가 자기 글을 즉시 내릴 수 있어야 함).
// RLS(author_id = auth.uid())가 서버에서 강제하지만, author_id 조건을 함께 걸어 이중 방어.
export async function deleteLoungePost(postId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase
    .from('lounge_posts')
    .delete()
    .eq('id', postId)
    .eq('author_id', user.id);
  if (error) throw error;
}

export async function deleteSocialPost(postId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase
    .from('social_posts' as any)
    .delete()
    .eq('id', postId)
    .eq('author_id', user.id);
  if (error) throw error;
}

// 내가 차단한 사용자 id 목록 — 피드/목록에서 이들의 콘텐츠를 숨기는 데 사용.
// 글 목록·댓글·글 하나를 열 때마다 매번 받던 것을 5분 동안 재사용(동시 요청은 하나로 합친다, 1109).
// 내가 새로 차단하면 blockUser 가 비운다.
let blockedCache: { uid: string; at: number; p: Promise<string[]> } | null = null;
export async function fetchBlockedIds(): Promise<string[]> {
  const user = await getSessionUser();
  if (!user) return [];
  if (blockedCache && blockedCache.uid === user.id && Date.now() - blockedCache.at < 5 * 60_000) return blockedCache.p;
  const p = (async () => {
    const { data, error } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id);
    if (error) { blockedCache = null; return []; }
    return (data ?? []).map((r) => r.blocked_id);
  })();
  blockedCache = { uid: user.id, at: Date.now(), p };
  return p;
}

export async function reportContent(params: {
  targetKind: 'user' | 'profile' | 'post' | 'comment' | 'message';
  targetId: string;
  reason: string;
  detail?: string;
}) {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    target_kind: params.targetKind,
    target_id: params.targetId,
    reason: params.reason,
    detail: params.detail ?? null,
  });
  if (error) throw error;
}

// 프로필 사진 검사 — Google Cloud Vision(face-check Edge Function) 경유.
// mode 'face' = 대표 사진(얼굴 필요), 'person' = 나머지 사진(사람이 나와야 함, 1014). 선정적인 사진은 둘 다 거부.
// 거부는 서버가 "확실히 아님"이라고 답할 때만. 키 미설정·API 오류·네트워크 실패는 모두 통과('ok')로
// 처리해, 검사 불가 상황이 정상 가입을 막지 않게 한다(서버도 동일한 fail-open). 같은 사진은 다시 묻지 않는다.
export type PhotoCheck = 'ok' | 'no_face' | 'no_person' | 'unsafe';
const photoCheckCache = new Map<string, PhotoCheck>();
export async function checkProfilePhoto(url: string, mode: 'face' | 'person'): Promise<PhotoCheck> {
  const key = `${mode}:${url}`;
  const hit = photoCheckCache.get(key);
  if (hit) return hit;
  try {
    const { data, error } = await supabase.functions.invoke('face-check', { body: { url, mode } });
    if (error) return 'ok';
    const reason = (data as any)?.ok === false ? ((data as any)?.reason as PhotoCheck | undefined) : undefined;
    const result: PhotoCheck = reason === 'no_face' || reason === 'no_person' || reason === 'unsafe' ? reason : 'ok';
    photoCheckCache.set(key, result);
    return result;
  } catch {
    return 'ok';
  }
}
export async function hasFaceInPhoto(url: string): Promise<boolean> {
  return (await checkProfilePhoto(url, 'face')) === 'ok';
}

// 프로필 편집 — users 테이블에 best-effort 반영 (gender/phone/birth는 0016 적용 후 동작)
export async function updateUserProfileServer(patch: {
  nickname?: string; region?: string; headline?: string; bio?: string;
  gender?: 'M' | 'F'; phone?: string; kakaoId?: string;
  birthYear?: number; birthMonth?: number; birthDay?: number; age?: number;
  // 0018 프로필 확장
  photos?: string[]; mbti?: string; height?: number;
  groupPhoto?: string | null;   // 0124 — 모임 전용 대표사진(인연 photos와 독립)
  smoking?: string; drinking?: string;
  introWant?: string; introInterest?: string; introHobby?: string;
  // 0107 프로필 위저드 확장
  job?: string; religion?: string; politics?: string | null;
  politicsPublic?: boolean; extraAnswers?: { q: string; a: string }[];
  education?: string;   // 0148 학력
  affinityMuteNotifs?: boolean; affinityHidden?: boolean; affinityDeckPaused?: boolean;
  affinityReviewRequestedAt?: string;  // 0139 — 중지된 프로필 수정 후 재검토 요청
  // 0127 가입 동의
  privacyAgreedAt?: string; marketingOptIn?: boolean;
  profileCompleted?: boolean;
}): Promise<void> {
  const user = await getSessionUser();
  if (!user) {
    // 세션 만료 — silent no-op 금지. 호출자가 catch해 "재로그인 필요" 안내해야 함.
    throw new Error('세션이 만료됐어요. 다시 로그인해주세요.');
  }
  // 2단계 업데이트 — 잠금 트리거(0032: gender/age 등) 때문에 UPDATE 전체가 거부되면
  // 사진·소개까지 조용히 유실되던 버그 방지. 안전 필드를 먼저 저장(실패 시 throw),
  // 잠금 대상 필드는 별도로 시도해 42501(이미 잠김)은 무시한다.
  const safe: Record<string, unknown> = {};
  if (patch.nickname !== undefined) safe.nickname = patch.nickname;
  if (patch.region !== undefined) safe.region = patch.region;
  if (patch.headline !== undefined) safe.headline = patch.headline;
  if (patch.bio !== undefined) safe.bio = patch.bio;
  if (patch.photos !== undefined) safe.photos = patch.photos;
  if (patch.groupPhoto !== undefined) safe.group_photo = patch.groupPhoto;
  if (patch.mbti !== undefined) safe.mbti = patch.mbti;
  if (patch.height !== undefined) safe.height = patch.height;
  if (patch.smoking !== undefined) safe.smoking = patch.smoking;
  if (patch.drinking !== undefined) safe.drinking = patch.drinking;
  if (patch.introWant !== undefined) safe.intro_want = patch.introWant;
  if (patch.introInterest !== undefined) safe.intro_interest = patch.introInterest;
  if (patch.introHobby !== undefined) safe.intro_hobby = patch.introHobby;
  if (patch.kakaoId !== undefined) safe.kakao_id = patch.kakaoId;
  if (patch.job !== undefined) safe.job = patch.job;
  if (patch.education !== undefined) safe.education = patch.education;
  if (patch.religion !== undefined) safe.religion = patch.religion;
  if (patch.politics !== undefined) safe.politics = patch.politics;
  if (patch.politicsPublic !== undefined) safe.politics_public = patch.politicsPublic;
  if (patch.extraAnswers !== undefined) safe.extra_answers = patch.extraAnswers;
  if (patch.affinityMuteNotifs !== undefined) safe.affinity_mute_notifs = patch.affinityMuteNotifs;
  if (patch.affinityHidden !== undefined) safe.affinity_hidden = patch.affinityHidden;
  if (patch.affinityReviewRequestedAt !== undefined) safe.affinity_review_requested_at = patch.affinityReviewRequestedAt;
  if (patch.affinityDeckPaused !== undefined) safe.affinity_deck_paused = patch.affinityDeckPaused;
  if (patch.profileCompleted !== undefined) safe.profile_completed = patch.profileCompleted;
  if (patch.privacyAgreedAt !== undefined) safe.privacy_agreed_at = patch.privacyAgreedAt;
  if (patch.marketingOptIn !== undefined) safe.marketing_opt_in = patch.marketingOptIn;

  const sensitive: Record<string, unknown> = {};
  if (patch.age !== undefined) sensitive.age = patch.age;
  if (patch.gender !== undefined) sensitive.gender = patch.gender;
  // phone도 잠금 대상(0078) — 이미 설정된 값 재전송이 42501로 저장 전체를 막지 않게 sensitive 그룹으로
  if (patch.phone !== undefined) sensitive.phone = patch.phone;
  if (patch.birthYear !== undefined) sensitive.birth_year = patch.birthYear;
  if (patch.birthMonth !== undefined) sensitive.birth_month = patch.birthMonth;
  if (patch.birthDay !== undefined) sensitive.birth_day = patch.birthDay;

  if (Object.keys(safe).length > 0) {
    const { error } = await supabase.from('users').update(safe as any).eq('id', user.id);
    if (error) throw error;  // 사진/소개 저장 실패를 더 이상 숨기지 않음
  }
  if (Object.keys(sensitive).length > 0) {
    const { error } = await supabase.from('users').update(sensitive as any).eq('id', user.id);
    // 42501 = 잠금 트리거(이미 설정된 성별/나이 재전송) — 정상 케이스라 무시
    if (error && error.code !== '42501') throw error;
  }
}

// 푸시 토큰 등록 — UNIQUE(token) 충돌 시 user_id 갱신 (단말 인계)
export async function registerPushToken(token: string, platform: 'ios' | 'android') {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: user.id, token, platform }, { onConflict: 'token' });
  if (error) throw error;
}

// 접속 기록(0138) — 어드민 MAU·리텐션 집계용. 서버가 KST 하루 1행으로 접으므로
// 같은 날 두 번째부터는 호출 자체를 건너뛴다(포그라운드 복귀마다 불린다).
let lastActiveKey = '';
export async function touchActiveDay(userId: string): Promise<void> {
  const kstDay = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const key = `${userId}:${kstDay}`;
  if (key === lastActiveKey) return;
  const { error } = await supabase.rpc('touch_active_day' as never);
  if (!error) lastActiveKey = key;
}

// ── 크로스 브라우저 동기화: 라운지/모임/게더링 server write/read ──────────
// 0010_cross_browser_sync.sql 마이그레이션 적용 후 사용 가능.

// 'N:M' → 총원 (예: '6:6' → 12). 최대 16:16까지 허용.
function ratioTotal(ratio: string): number {
  const parts = ratio.split(':').map((s) => parseInt(s, 10));
  const sum = parts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  return sum > 0 ? sum : 4;
}

export type ServerGather = {
  id: string;
  title: string;
  cat: string | null;
  cover: string | null;
  ratio: string;  // 'N:M' 성비 (최대 16:16)
  slots: number;
  when_text: string | null;
  place: string | null;
  description: string | null;
  host_id: string;
  host_nick: string | null;
  host_photo: string | null;
  status: string;
  created_at: string;
  // 0018 모임 확장
  fee?: number | null;
  fee_desc?: string | null;
  gender_mode?: 'any' | 'split' | null;
  region?: string | null;
  social_kind?: 'normal' | 'yahwa' | null;
  capacity?: number | null;
  start_at?: string | null;
  // 0029 네이버 플레이스 위치
  place_url?: string | null;
  place_name?: string | null;
  place_address?: string | null;
  // 호스트 정보 — users 테이블 join
  host?: { age: number | null; gender: 'M' | 'F' | null; univ_name?: string | null } | null;
  gathering_slots: Array<{
    user_id: string;
    gender: 'M' | 'F' | null;
    role: 'host' | 'guest';
    slot_index: number | null;
    photo: string | null;
    status?: 'pending' | 'approved' | 'rejected' | null;
    // 신청자 신원 — 호스트가 승인 전에 누가 신청했는지 볼 수 있도록 조인(공개 프로필 필드만).
    applicant?: { nickname: string | null; age: number | null } | null;
  }>;
};

export async function fetchGatheringsFull(): Promise<ServerGather[]> {
  const { data, error } = await supabase
    .from('gatherings')
    .select(`id, title, cat, cover, ratio, slots, when_text, place, description,
             host_id, host_nick, host_photo, status, created_at,
             fee, fee_desc, gender_mode, region, social_kind, capacity, start_at,
             store_id, approved, place_url, place_name, place_address, photos,
             gathering_slots(user_id, gender, role, slot_index, photo, status)`)
    .in('status', ['recruiting', 'matched'])  // 매칭 확정된 모임도 목록에 계속 노출
    .eq('approved' as any, true)   // 승인된 모임만 노출 (지도 신청 건은 admin 승인 전 숨김)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ServerGather[];
}

export async function fetchGatheringFull(id: string): Promise<ServerGather | null> {
  // host:users / applicant:users 임베드는 0070(H1)이 users SELECT를 잠근 뒤 42501로 실패한다.
  // 서버 RPC(SECURITY DEFINER)가 표시용 안전 필드만 담아 반환한다(0071). PII는 노출 안 함.
  const { data, error } = await supabase.rpc('get_gathering_detail' as any, { p_id: id });
  if (error) throw error;
  return (data ?? null) as unknown as ServerGather | null;
}

// ── 프로필 교환(프교, 0132) ─────────────────────────────────────────────────
export type ExchangeRow = {
  id: string; direction: 'sent' | 'received'; status: 'pending' | 'accepted' | 'declined' | 'released';
  released_at?: string | null; released_by_me?: boolean | null;
  other_id: string | null; nickname: string | null; photo: string | null;
  age: number | null; gender: string | null;
  post_id: string | null; post_title: string | null; comment_body: string | null;
  anon_nickname: string | null; created_at: string; responded_at: string | null;
};
export type CommentExchangeState = { comment_id: string; status: 'pending' | 'accepted'; direction: 'sent' | 'received' };

export type ExchangeTarget = { commentId: string } | { postId: string };
export async function requestProfileExchange(target: ExchangeTarget): Promise<{ charged: number }> {
  const args = 'commentId' in target ? { p_comment_id: target.commentId } : { p_post_id: target.postId };
  const { data, error } = await supabase.rpc('request_profile_exchange' as any, args);
  if (error) throw error;
  return { charged: Number((data as any)?.charged ?? 0) };
}

export async function respondProfileExchange(id: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_profile_exchange' as any, { p_id: id, p_accept: accept });
  if (error) throw error;
}

// v2(0186): 해제 기록 · 교환 전 상대 성별까지. 함수가 아직 없으면(마이그레이션 전) 예전 함수로
const missingFn = (e: any) => e?.code === 'PGRST202' || /Could not find the function/i.test(String(e?.message ?? ''));
export async function fetchMyProfileExchanges(): Promise<ExchangeRow[]> {
  const v2 = await supabase.rpc('get_my_profile_exchanges_v2' as any);
  if (!v2.error) return (v2.data ?? []) as ExchangeRow[];
  if (!missingFn(v2.error)) throw v2.error;
  const { data, error } = await supabase.rpc('get_my_profile_exchanges' as any);
  if (error) throw error;
  return (data ?? []) as ExchangeRow[];
}

// 차단 관리 목록(0186 my_blocks) — 닉네임은 인연에서 이미 아는 사람일 때만 온다(익명 이야기 차단은 이름 없이).
// 함수가 아직 없으면 내 차단 줄만(이름 없이)
export type BlockRow = { blocked_id: string; nickname: string | null; photo: string | null; created_at: string };
export async function fetchMyBlocks(): Promise<BlockRow[]> {
  const r = await supabase.rpc('my_blocks' as any);
  if (!r.error) return (r.data ?? []) as BlockRow[];
  if (!missingFn(r.error)) throw r.error;
  const user = await getSessionUser();
  if (!user) return [];
  const { data, error } = await supabase.from('blocks').select('blocked_id, created_at').eq('blocker_id', user.id).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((x: any) => ({ blocked_id: x.blocked_id, nickname: null, photo: null, created_at: x.created_at }));
}
// 차단 해제 — 내 차단 줄을 지운다(blocks_all_self 권한)
export async function unblockUser(targetUserId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', targetUserId);
  if (error) throw error;
  blockedCache = null;
}

export async function fetchCommentExchangeStates(postId: string): Promise<CommentExchangeState[]> {
  const { data, error } = await supabase.rpc('get_comment_exchange_states' as any, { p_post_id: postId });
  if (error) throw error;
  return (data ?? []) as CommentExchangeState[];
}

// ── 호스트 팔로우 (0131) ────────────────────────────────────────────────────
export type FollowedHost = {
  host_id: string; nickname: string | null; photo: string | null;
  age: number | null; gender: string | null;
  followed_at: string; hosted_count: number; open_count: number;
};

export async function fetchMyFollowedHostIds(): Promise<string[]> {
  const { data, error } = await supabase.from('host_follows' as never).select('host_id');
  if (error) throw error;
  return (data ?? []).map((r: any) => r.host_id as string);
}

export async function fetchMyFollowedHosts(): Promise<FollowedHost[]> {
  const { data, error } = await supabase.rpc('get_my_followed_hosts' as any);
  if (error) throw error;
  return (data ?? []) as FollowedHost[];
}

export async function fetchHostFollowStats(hostId: string): Promise<{ followerCount: number; following: boolean }> {
  const { data, error } = await supabase.rpc('get_host_follow_stats' as any, { p_host: hostId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as any;
  return { followerCount: Number(row?.follower_count ?? 0), following: !!row?.following };
}

export async function setHostFollow(hostId: string, follow: boolean): Promise<void> {
  const me = (await getSessionUser())?.id;
  if (!me) throw new Error('로그인이 필요해요');
  const tbl = () => supabase.from('host_follows' as never) as any;
  const { error } = follow
    ? await tbl().upsert({ follower_id: me, host_id: hostId })
    : await tbl().delete().eq('follower_id', me).eq('host_id', hostId);
  if (error) throw error;
}

// ── 내 모임 (마이페이지 관리) — 내가 만든/참여 신청한 모임 목록 ──────────────
export type MyGatheringItem = {
  id: string; title: string; cat: string | null; whenText: string | null;
  region: string | null; place: string | null; fee: number | null;
  status: string; approved: boolean;
  startAt: string | null;
  role: 'host' | 'guest';
  mySlotStatus: 'pending' | 'approved' | 'rejected' | null;  // guest 전용
  pendingCount: number;   // host 전용 — 대기 중 신청 수
  memberCount: number;    // host 전용 — 확정 인원(승인 + 호스트)
};

// 호스트가 자기 모임을 내린다 — 하드 삭제가 아니라 status='cancelled'(0121).
// 결제자가 있으면 서버가 거부한다.
export async function cancelGathering(gatheringId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_gathering' as never, { p_id: gatheringId } as never);
  if (error) throw error;
}

export async function fetchMyGatherings(): Promise<{ hosting: MyGatheringItem[]; joined: MyGatheringItem[] }> {
  const user = await getSessionUser();
  if (!user) return { hosting: [], joined: [] };

  // 내가 호스트인 모임 + 슬롯 상태(대기/확정 카운트)
  const { data: hostRows, error: he } = await supabase
    .from('gatherings')
    .select('id, title, cat, when_text, region, place, fee, status, approved, start_at, gathering_slots(status, role)')
    .eq('host_id' as any, user.id)
    .order('created_at', { ascending: false });
  if (he) throw he;
  const hosting: MyGatheringItem[] = (hostRows ?? []).map((g: any) => {
    const slots = g.gathering_slots ?? [];
    return {
      id: g.id, title: g.title, cat: g.cat, whenText: g.when_text, region: g.region, place: g.place,
      fee: g.fee, status: g.status, approved: g.approved, startAt: g.start_at ?? null, role: 'host', mySlotStatus: null,
      pendingCount: slots.filter((s: any) => s.status === 'pending').length,
      memberCount: slots.filter((s: any) => s.status === 'approved' || s.role === 'host').length,
    };
  });

  // 내가 게스트로 신청한 모임 + 내 승인 상태
  const { data: guestRows, error: ge } = await supabase
    .from('gathering_slots')
    .select('status, gathering:gatherings!gathering_slots_gathering_id_fkey(id, title, cat, when_text, region, place, fee, status, approved, start_at)')
    .eq('user_id', user.id)
    .eq('role' as any, 'guest')
    .order('joined_at', { ascending: false });
  if (ge) throw ge;
  const joined: MyGatheringItem[] = (guestRows ?? [])
    .filter((r: any) => r.gathering)
    .map((r: any) => ({
      id: r.gathering.id, title: r.gathering.title, cat: r.gathering.cat, whenText: r.gathering.when_text,
      region: r.gathering.region, place: r.gathering.place, fee: r.gathering.fee,
      status: r.gathering.status, approved: r.gathering.approved, startAt: r.gathering.start_at ?? null, role: 'guest',
      mySlotStatus: r.status ?? null, pendingCount: 0, memberCount: 0,
    }));

  return { hosting, joined };
}

// 호스트 모임 편집 — '내용' 필드만. 정원·성비·참가비는 서버 트리거(0125)가
// 참가자가 있으면 거부하므로 여기서 보내지 않는다.
export async function updateGatheringFull(args: {
  id: string;
  title?: string; cat?: string; cover?: string | null; photos?: string[];
  whenText?: string; startAt?: string | null;
  region?: string | null; place?: string; placeName?: string | null;
  placeAddress?: string | null; placeUrl?: string | null;
  description?: string;
}): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (args.title !== undefined) patch.title = args.title;
  if (args.cat !== undefined) patch.cat = args.cat;
  if (args.cover !== undefined) patch.cover = args.cover;
  if (args.photos !== undefined) patch.photos = args.photos;
  if (args.whenText !== undefined) patch.when_text = args.whenText;
  if (args.startAt !== undefined) patch.start_at = args.startAt;
  if (args.region !== undefined) patch.region = args.region;
  if (args.place !== undefined) patch.place = args.place;
  if (args.placeName !== undefined) patch.place_name = args.placeName;
  if (args.placeAddress !== undefined) patch.place_address = args.placeAddress;
  if (args.placeUrl !== undefined) patch.place_url = args.placeUrl;
  if (args.description !== undefined) patch.description = args.description;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from('gatherings').update(patch as any).eq('id', args.id);
  if (error) throw error;
}

export async function createGatheringFull(args: {
  title: string; cat: string; cover: string;
  ratio: string;  // 'N:M' 성비 (최대 16:16)
  whenText: string; place: string; description: string;
  hostNick: string; hostPhoto: string | null;
  gender: 'M' | 'F';
  // 0018 모임 확장 (모두 선택)
  fee?: number;            // 참가비(원)
  feeDesc?: string;        // 사용처 설명
  genderMode?: 'any' | 'split';  // 성별 상관없음 / 성비
  region?: string;         // '서울/강남'
  socialKind?: 'normal' | 'yahwa';  // 야화에서 모이자
  capacity?: number;       // genderMode='any'일 때 총 정원 (1:1=2)
  startAt?: string;        // 구조화된 일시 ISO
  storeId?: string;        // 야화에서 모이자 — 선택한 야화 매장
  approved?: boolean;      // 지도 신청(야화에서 모이자)은 false → admin 승인 시 노출
  // 0029 네이버 플레이스 위치 (place-lookup Edge Function 결과)
  placeUrl?: string;
  placeName?: string;
  placeAddress?: string;
  // 0059 호스트 업로드 이미지 (최대 3장, 첫 장이 대표=cover)
  photos?: string[];
}): Promise<{ id: string; chatRoomId: string }> {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const genderMode = args.genderMode ?? 'split';
  // 정원: 성별 상관없음이면 capacity, 성비면 ratio 기준
  const total = genderMode === 'any'
    ? (args.capacity ?? 2)
    : ratioTotal(args.ratio);
  // 1) gatherings insert
  const { data: g, error: ge } = await supabase
    .from('gatherings')
    .insert({
      host_id: user.id,
      title: args.title,
      cat: args.cat,
      cover: args.cover,
      ratio: args.ratio,
      slots: total,
      when_text: args.whenText,
      place: args.place,
      description: args.description,
      host_nick: args.hostNick,
      host_photo: args.hostPhoto,
      status: 'recruiting',
      fee: args.fee ?? 0,
      fee_desc: args.feeDesc ?? null,
      gender_mode: genderMode,
      region: args.region ?? null,
      social_kind: args.socialKind ?? 'normal',
      capacity: genderMode === 'any' ? total : null,
      start_at: args.startAt ?? null,
      store_id: args.storeId ?? null,
      approved: args.approved ?? true,
      place_url: args.placeUrl ?? null,
      place_name: args.placeName ?? null,
      place_address: args.placeAddress ?? null,
      photos: (args.photos ?? []).slice(0, 3),
    } as any)
    .select('id')
    .single();
  if (ge || !g) throw ge ?? new Error('게더링 생성 실패');
  // 2) 호스트 슬롯 (자기 자리 차지)
  const { error: se } = await supabase.from('gathering_slots').insert({
    gathering_id: g.id,
    user_id: user.id,
    gender: args.gender,
    role: 'host',
    slot_index: 0,
    photo: args.hostPhoto,
  } as any);
  if (se) throw se;
  // 채팅 기능 폐지 — 연락처 공유로 대체. chat_room 생성하지 않음.
  // (이전 버전에서는 create_gather_room RPC가 실패하면 트랜잭션 롤백 없이
  // gathering+host_slot이 남아 zombie 데이터가 생기는 문제가 있었음)
  return { id: g.id, chatRoomId: '' };
}

export async function joinGatheringFull(args: {
  id: string; gender: 'M' | 'F'; photo?: string | null;
}): Promise<{ chatRoomId: string | null }> {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  // 슬롯 insert (이미 가입했으면 PK 충돌 → 중복 차감 방지)
  const { error: se } = await supabase.from('gathering_slots').insert({
    gathering_id: args.id,
    user_id: user.id,
    gender: args.gender,
    role: 'guest',
    photo: args.photo ?? null,
  } as any);
  if (se) {
    if (se.code === '23505') throw new Error('이미 참여한 게더링이에요');
    throw se;
  }
  // 채팅 폐지 — 호스트 승인 후 연락처 공유로 대체. join_gather_room 호출 안 함.
  return { chatRoomId: null };
}

// ── 라운지 ──────────────────────────────────────────────────────────────────
// 커뮤니티 익명 닉네임 — 감성적인 꽃 이름(대표 지시 1007). 같은 글 안에서는 사람마다 다른 꽃.
// ⚠️ supabase/functions/community-seed, 0135 마이그레이션의 목록과 같이 유지
export const FLOWER_NICKS = [
  '데이지','라벤더','튤립','프리지아','안개꽃','수국','작약','라넌큘러스','은방울꽃','물망초',
  '카네이션','해바라기','코스모스','동백','목련','벚꽃','유채꽃','민들레','아네모네',
  '스타티스','카라','리시안셔스','거베라','백합','장미','매화','진달래','개나리','들국화',
  '수선화','히아신스','작은별꽃','금잔화','팬지','에델바이스','라일락','아카시아','능소화','달맞이꽃',
];
// 수식어 + 꽃 (예: 싱그러운 데이지) — 조합 수를 늘려 같은 글 안 겹침을 줄인다(1007)
export const NICK_ADJ = ['싱그러운','감성적인','수줍은','다정한','포근한','새침한','몽글몽글한','설레는','은은한','청초한','나른한','반짝이는','상냥한','말랑한','몽환적인','햇살 같은','달콤한','소담한','향기로운','어여쁜','사랑스러운','차분한','엉뚱한','수수한','발랄한','고요한','따스한','새벽의','봄날의','한여름의','가을빛','눈부신','순수한','늦잠 자는','산책하는','꿈꾸는','노래하는','잠 못 드는','비 오는 날의','별 보는'];
export function makeAnonNick(): string {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  return `${pick(NICK_ADJ)} ${pick(FLOWER_NICKS)}`;
}

export async function addLoungePostServer(args: {
  cat: 'free'|'love'|'qna'|'meet'|'food'; title: string; body: string;
  authorGender?: 'M' | 'F' | null;   // 커뮤니티 캐릭터 아바타(남=팽귄/여=햄스터)용
  attachments?: string[];            // 게시물 이미지 URL (최대 3장, 첫 장이 썸네일)
  audioUrl?: string | null;          // 음성 메시지 공개 URL (0101)
  audioDuration?: number | null;     // 음성 길이(초)
}): Promise<{ id: string }> {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { data, error } = await supabase.from('lounge_posts').insert({
    author_id: user.id,
    anon_nickname: makeAnonNick(),
    cat: args.cat,
    title: args.title,
    body: args.body,
    author_gender: args.authorGender ?? null,
    attachments: args.attachments ?? [],
    audio_url: args.audioUrl ?? null,
    audio_duration: args.audioDuration ?? null,
  } as any).select('id').single();
  if (error || !data) throw error ?? new Error('등록 실패');
  return { id: (data as any).id as string };
}

// ── 모임 ──────────────────────────────────────────────────────────────────
export type ServerSocialPost = {
  id: string;
  author_id: string;
  author_nick: string;
  author_photo: string | null;
  author_gender: 'M' | 'F' | null;
  author_age: number | null;
  title: string;
  about: string;
  looking: string;
  flex: string;
  photo: string | null;       // 하위호환 (photos[0])
  photos: string[] | null;    // 모임 1~3장
  likes: number;
  created_at: string;
};

export async function fetchSocialPosts(): Promise<ServerSocialPost[]> {
  const { data, error } = await supabase
    .from('social_posts' as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data ?? []) as unknown as ServerSocialPost[];
}

// 화면용 Gather 타입(`src/data/mock` 의 Gather)으로 변환.
export function adaptServerGather(g: ServerGather): Gather {
  const genderMode: 'any' | 'split' = g.gender_mode === 'any' ? 'any' : 'split';
  // 호스트를 먼저 배치(0번 자리), 그 다음 게스트 순서대로. 승인 대기(pending)는 빈자리로 취급.
  const sorted = [...(g.gathering_slots ?? [])]
    .filter((s) => s.status !== 'pending' && s.status !== 'rejected')
    .sort((a, b) => {
      if (a.role === b.role) return (a.slot_index ?? 0) - (b.slot_index ?? 0);
      return a.role === 'host' ? -1 : 1;
    });
  let M: GatherSlot[];
  let F: GatherSlot[];
  if (genderMode === 'any') {
    // 성별 무관 — 단일 정원 풀(M에 모두 배치, F는 비움). capacity 기준.
    const cap = g.capacity ?? g.slots ?? sorted.length;
    M = Array.from({ length: cap }, () => ({ filled: false }));
    F = [];
    let i = 0;
    for (const s of sorted) {
      if (i < cap) M[i++] = { filled: true, photo: s.photo ?? undefined, host: s.role === 'host', gender: s.gender ?? null };
    }
  } else {
    const [mTotal, fTotal] = g.ratio.split(':').map((s) => parseInt(s, 10));
    M = Array.from({ length: mTotal }, () => ({ filled: false }));
    F = Array.from({ length: fTotal }, () => ({ filled: false }));
    let mIdx = 0, fIdx = 0;
    for (const s of sorted) {
      const slot: GatherSlot = { filled: true, photo: s.photo ?? undefined, host: s.role === 'host', gender: s.gender ?? null };
      if (s.gender === 'M' && mIdx < mTotal) M[mIdx++] = slot;
      else if (s.gender === 'F' && fIdx < fTotal) F[fIdx++] = slot;
    }
  }
  // 호스트 성별 추정 (slot role='host' 의 gender)
  const hostSlot = sorted.find((s) => s.role === 'host');
  const hostGender: 'M' | 'F' = hostSlot?.gender ?? 'M';
  return {
    id: g.id,
    cat: g.cat ?? '',
    cover: g.cover || (g.cat ? (CAT_COVER[g.cat] ?? DEFAULT_COVER) : DEFAULT_COVER),
    title: g.title,
    host: {
      nick: g.host_nick ?? '',
      photo: g.host_photo,
      age: g.host?.age ?? 0,
      gender: g.host?.gender ?? hostGender,
      userId: g.host_id,
    } as any,
    when: g.when_text ?? '',
    whenTime: '',
    whenRel: '곧',
    place: g.place ?? '',
    placeDetail: `${g.place ?? ''} · 매칭 후 공개`,
    ratio: g.ratio,
    slots: { M, F },
    leafs: 30,
    hot: false,
    age: '',
    tags: [g.cat ? `#${g.cat}` : '', g.place ? `#${g.place}` : ''].filter(Boolean),
    desc: g.description ?? '',
    genderMode,
    capacity: genderMode === 'any' ? (g.capacity ?? g.slots ?? undefined) : undefined,
    fee: g.fee ?? 0,
    feeDesc: g.fee_desc ?? undefined,
    createdAt: (g as any).created_at ?? undefined,
    startAt: (g as any).start_at ?? null,
    status: (g as any).status ?? undefined,
    region: g.region ?? null,
    photos: Array.isArray((g as any).photos) ? (g as any).photos : undefined,
  };
}

export async function addSocialPostServer(args: {
  title: string; about: string; looking: string; flex: string;
  photo?: string | null;
  photos?: string[];
  authorNick: string;
  authorPhoto?: string | null;
  authorGender?: 'M' | 'F' | null;
  authorAge?: number | null;
}): Promise<{ id: string }> {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const photos = (args.photos ?? (args.photo ? [args.photo] : [])).slice(0, 3);
  const { data, error } = await supabase.from('social_posts' as any).insert({
    author_id: user.id,
    author_nick: args.authorNick,
    author_photo: args.authorPhoto ?? null,
    author_gender: args.authorGender ?? null,
    author_age: args.authorAge ?? null,
    title: args.title,
    about: args.about,
    looking: args.looking,
    flex: args.flex,
    photo: photos[0] ?? null,
    photos,
  } as any).select('id').single();
  if (error || !data) throw error ?? new Error('등록 실패');
  return { id: (data as any).id as string };
}

// 단일 모임 글 조회 (상세 페이지용)
export async function fetchSocialPost(id: string): Promise<ServerSocialPost | null> {
  const { data, error } = await supabase
    .from('social_posts' as any)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as ServerSocialPost | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 0018 기능 개편 v2 — 쿠폰 / 호감도 / 연결 / 서버 알림 / 결제
// ─────────────────────────────────────────────────────────────────────────────

// ── 호스트 정산 정보 — 모임 참가비 정산(계좌 이체)용. 계정당 1건, 모든 모임에 재사용 ──
export type HostSettlementInfo = {
  user_id: string;
  entity_type: 'individual' | 'business';
  account_holder: string;
  bank_name: string;
  account_number: string;
  resident_reg_front: string;
  resident_reg_back: string;
  business_reg_number: string | null;
  business_name: string | null;
  email: string;
  created_at: string;
  updated_at: string;
};

export async function fetchMySettlementInfo(): Promise<HostSettlementInfo | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('host_settlement_info' as any)
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as HostSettlementInfo | null;
}

export async function upsertMySettlementInfo(args: Omit<HostSettlementInfo, 'user_id' | 'created_at' | 'updated_at'>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase
    .from('host_settlement_info' as any)
    .upsert({ ...args, user_id: user.id, updated_at: new Date().toISOString() } as any, { onConflict: 'user_id' });
  if (error) throw error;
}

// ── 리프/포인트 사용내역 ─────────────────────────────────────────────────────
export type ServerTransaction = {
  id: string; kind: 'charge' | 'unlock' | 'refund' | 'gift'; amount: number;
  provider: string | null; meta: Record<string, unknown> | null; created_at: string;
};

// 사용(차감) 내역만 — amount<0. RLS로 본인 행만 조회됨.
export async function fetchMySpendHistory(): Promise<ServerTransaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, kind, amount, provider, meta, created_at')
    .lt('amount', 0)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ServerTransaction[];
}

// 무료 리프 적립 기록(미션 보상, 0147·0167) — MY 리프 내역에 사용 기록과 함께 보여 준다(1014)
export async function fetchMyLeafRewards(): Promise<ServerTransaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, kind, amount, provider, meta, created_at')
    .eq('provider', 'event')
    .eq('meta->>feature', 'mission')
    .gt('amount', 0)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as ServerTransaction[];
}

// ── 쿠폰 ─────────────────────────────────────────────────────────────────────
export type ServerCoupon = {
  id: string; title: string; description: string | null;
  store_id: string | null; kind: string; discount_label: string | null;
  valid_until: string | null; created_at: string;
};
export type ServerUserCoupon = {
  id: string; user_id: string; coupon_id: string; status: 'active' | 'used' | 'expired';
  granted_at: string; used_at: string | null;
  coupons: ServerCoupon | null;  // 조인
};

// 내 쿠폰함 (쿠폰 정보 조인)
export async function fetchMyCoupons(): Promise<ServerUserCoupon[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('user_coupons' as any)
    // coupons.pin은 SELECT 권한이 없어(0084 — 셀프 사용 방지) 명시적 컬럼 목록 필수. `*` 금지.
    .select('id, user_id, coupon_id, status, granted_at, used_at, coupons(id, title, description, discount_label, valid_until, kind, store_id)')
    .eq('user_id', user.id)
    .order('granted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ServerUserCoupon[];
}

// 쿠폰 사용 처리 — 직원 PIN 검증 RPC(0082). PIN 없이는 서버가 거부한다.
export async function useCouponServer(args: { userCouponId: string; storeId: string; pin: string }): Promise<void> {
  const { error } = await supabase.rpc('redeem_coupon' as never, {
    p_user_coupon_id: args.userCouponId,
    p_store_id: args.storeId,
    p_pin: args.pin,
  } as never);
  if (error) throw error;
}

// ── 어드민: 쿠폰 발행/사용 내역 ─────────────────────────────────────────────
export async function adminIssueCoupon(args: {
  title: string; description?: string; discountLabel?: string;
  validUntil?: string | null;  // 'YYYY-MM-DD'
  target: 'all' | 'M' | 'F' | 'signup' | 'first_gathering';
  pin: string;                        // 쿠폰 공통 직원확인 코드 (숫자 4자리) — 리프 보상 쿠폰은 불필요
  sendAt?: string | null;             // ISO — 예약 발송 시각 (null=즉시)
  signupCode?: string | null;         // 신규가입 URL 코드 (/download?c=코드)
  rewardLeaf?: number | null;         // 첫 모임 개설 시 지급할 리프 수량
}): Promise<number> {
  const { data, error } = await supabase.rpc('admin_issue_coupon' as never, {
    p_title: args.title,
    p_description: args.description ?? null,
    p_discount_label: args.discountLabel ?? null,
    p_valid_until: args.validUntil ?? null,
    p_target: args.target,
    p_pin: args.pin,
    p_send_at: args.sendAt ?? null,
    p_signup_code: args.signupCode ?? null,
    p_reward_leaf: args.rewardLeaf ?? null,
  } as never);
  if (error) throw error;
  return Number(data ?? 0);
}

// 쿠폰 발행 중단 — 앞으로의 자동/예약 발급만 멈춤(이미 지급된 건 유지)
export async function adminStopCoupon(couponId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_stop_coupon' as never, { p_coupon_id: couponId } as never);
  if (error) throw error;
}
// 쿠폰 완전 삭제 — 이미 지급된 사용자 쿠폰함에서도 사라짐(CASCADE)
export async function adminDeleteCoupon(couponId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_coupon' as never, { p_coupon_id: couponId } as never);
  if (error) throw error;
}

// 가입 시 자동 발급된 쿠폰 중 아직 사용하지 않은 것 — 가입 직후 안내 팝업용.
// (신규가입 자동 발급 쿠폰만 대상: coupons.signup_grant = true)
export async function fetchSignupGrantedCoupon(): Promise<{ id: string; title: string; discountLabel: string | null } | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('user_coupons' as any)
    .select('id, status, granted_at, coupons!inner(title, discount_label, signup_grant)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .eq('coupons.signup_grant', true)
    .order('granted_at', { ascending: false })
    .limit(1);
  if (error || !data?.length) return null;
  const row = data[0] as any;
  return { id: row.id, title: row.coupons?.title ?? '쿠폰', discountLabel: row.coupons?.discount_label ?? null };
}

// 어드민 Edge Function 호출용 Authorization 헤더 — 세션 토큰을 명시적으로 싣는다.
// supabase-js가 자동 주입하지만, 어드민 페이지에서 401이 관측돼 의존하지 않는다.
async function adminAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('세션이 만료됐어요. 다시 로그인해주세요.');
  return { Authorization: `Bearer ${session.access_token}` };
}

export type AdminGatheringRow = {
  id: string; title: string; status: string; approved: boolean;
  slots: number; capacity: number | null; ratio: string | null; fee: number | null;
  when_text: string | null; region: string | null; place: string | null;
  host_id: string; host_nick: string | null; created_at: string;
  store: { name: string } | null;
  members: { user_id: string; nickname: string | null; gender: string | null; role: string; status: string }[];
};
// 어드민 모임 현황 — 진행중(모집중/매칭완료) 우선, 참여 멤버까지 함께
export async function adminFetchGatherings(): Promise<AdminGatheringRow[]> {
  const { data, error } = await supabase
    .from('gatherings' as any)
    .select(`id, title, status, approved, slots, capacity, ratio, fee, when_text, region, place,
             host_id, host_nick, created_at,
             store:store_id(name),
             gathering_slots(user_id, role, status, gender, users:user_id(nickname))`)
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return ((data ?? []) as any[]).map((g) => ({
    ...g,
    store: g.store ?? null,
    members: (g.gathering_slots ?? []).map((s: any) => ({
      user_id: s.user_id,
      nickname: s.users?.nickname ?? null,
      gender: s.gender ?? null,
      role: s.role,
      status: s.status,
    })),
  })) as AdminGatheringRow[];
}
export async function adminDeleteGathering(id: string): Promise<void> {
  const { error } = await supabase.from('gatherings' as any).delete().eq('id', id);
  if (error) throw error;
}

export type AdminUserRow = {
  id: string; nickname: string | null; phone: string | null; age: number | null;
  gender: string | null; region: string | null; leaf_balance: number; points: number;
  verified: boolean; created_at: string;
};
// 어드민 사용자 목록 — phone은 컬럼 권한이 막혀 있어 RPC로만 조회 가능(0086)
// 고객 전부(0189) — 서버는 한 번에 최대 1,000행(PostgREST max_rows)이라 1,000명씩 나눠 받아 잇는다
export async function adminListUsers(): Promise<AdminUserRow[]> {
  const PAGE = 1000;
  const all: AdminUserRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.rpc('admin_list_users' as never).range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = (data ?? []) as unknown as AdminUserRow[];
    all.push(...rows);
    if (rows.length < PAGE) return all;
  }
}
// 어드민 계정 삭제 — service_role이 필요해 Edge Function 경유(스토리지·카카오 연결까지 정리)
export async function adminDeleteUser(userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', {
    body: { targetUserId: userId },
    headers: await adminAuthHeaders(),
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error(String((data as any).error));
}

export type AdminCoupon = {
  id: string; title: string; discount_label: string | null; valid_until: string | null;
  pin: string | null; target: string | null; send_at: string | null; sent_at: string | null;
  signup_grant: boolean; signup_code: string | null;
  first_gathering_grant: boolean; reward_leaf: number | null;
  created_at: string;
};
// 발행된 쿠폰 목록 (PIN 포함 — is_admin 전용 RPC)
export async function adminListCoupons(): Promise<AdminCoupon[]> {
  const { data, error } = await supabase.rpc('admin_list_coupons' as never);
  if (error) throw error;
  return (data ?? []) as unknown as AdminCoupon[];
}

// 가입 후 URL 쿠폰 코드 청구 (/download?c=코드 → localStorage → 로그인 후 호출)
export async function claimSignupCoupon(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_signup_coupon' as never, { p_code: code } as never);
  if (error) throw error;
  return data === true;
}

export type AdminCouponUsage = {
  id: string; status: string; granted_at: string; used_at: string | null;
  users: { nickname: string | null; gender: string | null } | null;
  coupons: { title: string; valid_until: string | null } | null;
  stores: { name: string } | null;
};
// ── 어드민: 결제 내역/환불/영수증 ────────────────────────────────────────────
export type AdminLeafCharge = {
  id: string; amount: number; provider_tx_id: string | null; created_at: string; refunded_at: string | null;
  meta?: { won?: number } | null;
  users: { nickname: string | null } | null;
};
// 조회 기간 — from(포함)~to(포함, 그날 끝까지). 'YYYY-MM-DD'
export type DateRange = { from?: string | null; to?: string | null };
function rangeFilter<T>(q: T & { gte: any; lte: any }, col: string, range?: DateRange): T {
  let out: any = q;
  if (range?.from) out = out.gte(col, `${range.from}T00:00:00+09:00`);
  if (range?.to) out = out.lte(col, `${range.to}T23:59:59.999+09:00`);
  return out;
}

// 리프 충전 내역 (transactions, 어드민 RLS 0083)
// 리프 충전 결제 금액(원) — 결제 때 남긴 meta.won, 없으면(1020 이전 기록) 리프 수로 패키지 가격을 찾는다.
// amount는 충전된 리프 수(첫 충전 보너스 포함: 16,900원 → 70+35)
const LEAF_PACKAGE_WON: Record<number, number> = { 35: 8900, 70: 16900, 105: 16900, 160: 34900, 350: 69900, 800: 139000 };
export function leafChargeWon(t: AdminLeafCharge): number | null {
  const w = Number(t.meta?.won);
  return Number.isFinite(w) && w > 0 ? w : LEAF_PACKAGE_WON[t.amount] ?? null;
}
export async function adminFetchLeafCharges(range?: DateRange): Promise<AdminLeafCharge[]> {
  const q = supabase
    .from('transactions' as any)
    .select('id, amount, meta, provider_tx_id, created_at, refunded_at, users:user_id(nickname)')
    .eq('kind', 'charge').eq('provider', 'tosspayments');
  const { data, error } = await rangeFilter(q as any, 'created_at', range)
    .order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as AdminLeafCharge[];
}
export type AdminGatherPayment = {
  id: string; order_id: string; amount: number; platform_fee: number; status: string;
  paid_at: string | null; created_at: string;
  users: { nickname: string | null } | null;
  gatherings: { title: string } | null;
};
// 모임 참가비 내역 (payments, 어드민 RLS 0054)
export async function adminFetchGatherPayments(range?: DateRange): Promise<AdminGatherPayment[]> {
  const q = supabase
    .from('payments' as any)
    .select('id, order_id, amount, platform_fee, status, paid_at, created_at, users:user_id(nickname), gatherings:gathering_id(title)');
  const { data, error } = await rangeFilter(q as any, 'created_at', range)
    .order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as AdminGatherPayment[];
}
export type TossPaymentDetail = {
  ok: boolean; paymentKey: string; orderId: string; orderName: string;
  status: string; method: string | null; totalAmount: number;
  approvedAt: string | null; receiptUrl: string | null; cancels: any[] | null;
};
// 토스 결제 상세(영수증 URL 포함) — 서버(tosspay-admin)가 시크릿 키로 대행 조회
export async function adminPaymentDetail(ref: { paymentKey?: string; orderId?: string }): Promise<TossPaymentDetail> {
  const { data, error } = await supabase.functions.invoke('tosspay-admin', {
    body: { action: 'detail', ...ref },
    headers: await adminAuthHeaders(),
  });
  if (error) throw error;
  return data as TossPaymentDetail;
}
// 전액 환불 — 토스 취소 + payments/transactions 상태 기록
export async function adminRefundPayment(ref: { paymentKey?: string; orderId?: string; reason?: string }): Promise<void> {
  const { data, error } = await supabase.functions.invoke('tosspay-admin', {
    body: { action: 'refund', ...ref },
    headers: await adminAuthHeaders(),
  });
  if (error) throw error;
  if (!(data as any)?.ok) throw new Error('환불 처리에 실패했어요');
}

// 발급/사용 내역 전체 (어드민 RLS) — 최근 발급순
export async function adminFetchCouponUsages(): Promise<AdminCouponUsage[]> {
  const { data, error } = await supabase
    .from('user_coupons' as any)
    .select('id, status, granted_at, used_at, users:user_id(nickname, gender), coupons:coupon_id(title, valid_until), stores:used_store_id(name)')
    .order('granted_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as AdminCouponUsage[];
}

// 특정 종류의 쿠폰(title 기준)을 1회만 지급 — 이미 보유 시 무시. (웰컴/매칭 보상 등)
export async function grantCouponByTitle(title: string, opts?: {
  description?: string; discountLabel?: string; kind?: string;
}): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  // 1) 쿠폰 마스터 찾기/생성
  let couponId: string | null = null;
  const { data: existing } = await supabase
    .from('coupons' as any).select('id').eq('title', title).limit(1).maybeSingle();
  if (existing) {
    couponId = (existing as any).id;
  } else {
    const { data: created, error: ce } = await supabase
      .from('coupons' as any)
      .insert({ title, description: opts?.description ?? null, discount_label: opts?.discountLabel ?? null, kind: opts?.kind ?? 'welcome' } as any)
      .select('id').single();
    if (ce) throw ce;
    couponId = (created as any).id;
  }
  if (!couponId) return;
  // 2) 이미 보유했는지 확인 → 없으면 발급
  const { data: owned } = await supabase
    .from('user_coupons' as any).select('id').eq('user_id', user.id).eq('coupon_id', couponId).limit(1).maybeSingle();
  if (owned) return;
  await supabase.from('user_coupons' as any).insert({ user_id: user.id, coupon_id: couponId } as any);
}

// ── 서버 알림 (기기 간) ──────────────────────────────────────────────────────
export type ServerNotif = {
  id: string; user_id: string; kind: string; title: string; body: string | null;
  data: any; read: boolean; created_at: string;
};
export async function fetchServerNotifs(): Promise<ServerNotif[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('notifications' as any)
    .select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(60);
  if (error) throw error;
  return (data ?? []) as unknown as ServerNotif[];
}
export async function pushServerNotif(args: {
  toUserId: string; kind: string; title: string; body?: string; data?: any;
}): Promise<void> {
  const { error } = await supabase.from('notifications' as any).insert({
    user_id: args.toUserId, kind: args.kind, title: args.title,
    body: args.body ?? null, data: args.data ?? null,
  } as any);
  if (error) throw error;
}
export async function markServerNotifRead(id: string): Promise<void> {
  await supabase.from('notifications' as any).update({ read: true } as any).eq('id', id);
}

// ── 호감도 (1~5) ─────────────────────────────────────────────────────────────
// 보내기(upsert) + 3점 이상이면 상대에게 알림
export async function sendAffinity(rateeId: string, score: number): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase
    .from('affinity_ratings' as any)
    .upsert({ rater_id: user.id, ratee_id: rateeId, score } as any, { onConflict: 'rater_id,ratee_id' } as any);
  if (error) throw error;
  // 알림은 DB 트리거(notify_affinity, 0075)가 3점 이상일 때 서버에서 발송한다.
}
// 나에게 온 호감도 3점 이상 — "호감 친구"
export async function fetchAffinityReceived(): Promise<{ rater_id: string; score: number; created_at: string }[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('affinity_ratings' as any)
    .select('rater_id, score, created_at')
    .eq('ratee_id', user.id).gte('score', 3)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as any;
}

// ── 관심 · 호감 메시지 (인연 리뉴얼 0095) ─────────────────────────────────────
// 관심 보내기 = 구 연결신청 대체. 과금(1일 1회 무료 → 6리프)·중복 차단은 전부 서버 트리거 강제.
export type InterestRow = { id: string; sender_id: string; receiver_id: string; created_at: string };
export type InterestMessageRow = { id: string; sender_id: string; receiver_id: string; body: string; created_at: string };

export async function sendInterest(receiverId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase
    .from('interests' as any)
    .insert({ sender_id: user.id, receiver_id: receiverId } as any);
  if (error) throw error;
}

// 내가 주고받은 관심 전부 — RLS가 본인 관련 행만 반환
export async function fetchMyInterests(): Promise<InterestRow[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('interests' as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as any;
}

export async function sendInterestMessage(receiverId: string, body: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase
    .from('interest_messages' as any)
    .insert({ sender_id: user.id, receiver_id: receiverId, body } as any);
  if (error) throw error;
}

// 메시지 메타(본문 제외) — 뱃지·신선도 계산용. 받은 메시지 본문은 RLS(0098)가 언락 전 차단.
export type InterestMessageMetaRow = { id: string; sender_id: string; receiver_id: string; created_at: string };
export async function fetchInterestMessageMeta(): Promise<InterestMessageMetaRow[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('interest_message_meta' as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as any;
}

// 받은 메시지 열람 잠금해제 — 서버 트리거가 6리프 차감(0098). 페어당 1회 영구.
export async function unlockInterestMessages(otherId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase
    .from('interest_message_unlocks' as any)
    .insert({ user_id: user.id, other_id: otherId } as any);
  if (error) throw error;
}

export async function fetchMyMessageUnlocks(): Promise<{ other_id: string }[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('interest_message_unlocks' as any)
    .select('other_id');
  if (error) throw error;
  return (data ?? []) as any;
}

export async function fetchMyInterestMessages(): Promise<InterestMessageRow[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('interest_messages' as any)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as any;
}

// ── 연결 (연락처 공유) ───────────────────────────────────────────────────────
// 신청 → 상대 알림. (리프 차감은 클라이언트에서 선처리)
export async function requestConnection(targetId: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase
    .from('connections' as any)
    .upsert({ requester_id: user.id, target_id: targetId, status: 'pending' } as any, { onConflict: 'requester_id,target_id' } as any);
  if (error) throw error;
  // 알림은 DB 트리거(notify_connection_insert, 0075)가 서버에서 발송한다.
}
// 승인/거절 (대상자만). 승인 시 신청자에게 알림.
export async function decideConnection(requesterId: string, approve: boolean): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase
    .from('connections' as any)
    .update({ status: approve ? 'approved' : 'rejected', decided_at: new Date().toISOString() } as any)
    .eq('requester_id', requesterId).eq('target_id', user.id);
  if (error) throw error;
  if (approve) {
    // 수락 알림은 DB 트리거(notify_connection_approved, 0075)가 서버에서 발송한다.
    // 매칭 보상 — 승인한 사람에게 야화 칵테일 1잔 무료 쿠폰 (멱등)
    try {
      await grantCouponByTitle('야화 칵테일 1잔 무료', { discountLabel: '칵테일 1잔 무료', kind: 'event', description: '오늘의 친구 매칭 축하 쿠폰' });
    } catch { /* ignore */ }
    // 오늘의 친구 매칭 알림톡 — 양쪽 모두에게 (솔라피 미설정 시 서버 skip)
    void sendAlimtalk('friend_matched', { otherUserId: requesterId });
  }
}
// 나와 상대의 연결 상태
export async function fetchConnectionStatus(otherId: string): Promise<'none' | 'pending' | 'approved' | 'rejected' | 'incoming'> {
  const user = await getSessionUser();
  if (!user) return 'none';
  const { data } = await supabase
    .from('connections' as any)
    .select('requester_id, target_id, status')
    .or(`and(requester_id.eq.${user.id},target_id.eq.${otherId}),and(requester_id.eq.${otherId},target_id.eq.${user.id})`)
    .limit(1).maybeSingle();
  if (!data) return 'none';
  const c = data as any;
  if (c.status === 'pending' && c.target_id === user.id) return 'incoming';
  return c.status as any;
}

// ─────────────────────────────────────────────────────────────────────────────
// 0019 오늘의 친구 — 전체 유저 프로필 + 연락처 공유
// ─────────────────────────────────────────────────────────────────────────────
export type FriendProfile = {
  user_id: string; nickname: string; age: number | null; gender: 'M' | 'F' | null;
  region: string | null; headline: string | null; photos: string[] | null;
  mbti: string | null; height: number | null; smoking: string | null; drinking: string | null;
  intro_want: string | null; intro_interest: string | null; intro_hobby: string | null;
  created_at: string;
  univ_name?: string | null;
  // 0116 — 상세 정보 행(직업·종교·정치)·선택 질문
  job?: string | null; religion?: string | null; politics?: string | null;
  extra_answers?: { q: string; a: string }[] | null;
  // 0148 — 학력·추천 프로필(관리자 지정)
  education?: string | null;
  featured?: boolean;
  // 1013-B 인증(시안 사이트) — 기본 인증(성별·나이·전화번호 확인)과 승인된 선택 인증만 내려온다
  basic_verified?: boolean;
  credentials?: { kind: 'school' | 'company' | 'income'; label: string }[] | null;
};

// 전체 프로필 목록 (성별 필터 옵션). 본인 제외는 호출부에서 처리.
export async function fetchFriendProfiles(gender?: 'M' | 'F'): Promise<FriendProfile[]> {
  let q = supabase.from('friend_profiles' as any).select('*').order('created_at', { ascending: false }).limit(100);
  if (gender) q = q.eq('gender', gender);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as FriendProfile[];
}

export async function fetchFriendProfile(userId: string): Promise<FriendProfile | null> {
  const { data, error } = await supabase
    .from('friend_profiles' as any).select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as FriendProfile | null;
}

// 연결 승인된 상대의 연락처 — RPC가 승인 여부 강제. 미승인이면 null.
export async function getConnectionContact(otherId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_connection_contact' as any, { other_id: otherId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

// ── 모임 결제 참여 ──────────────────────────────────────────────────────────
// 참가비 결제 기록 + 슬롯(승인 대기) 생성. fee=0이면 결제 없이 바로 대기 슬롯.
// 토스 결제는 web 리다이렉트(pay-success)에서 호출되거나, fee=0일 때 직접 호출.
export async function joinGatheringPaid(args: {
  gatheringId: string; gender: 'M' | 'F'; photo?: string | null;
  fee: number; orderId?: string;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요해요');
  // 슬롯 사진은 서버(users.photos[0])가 단일 진실원천 — args.photo는 클라이언트 캐시라
  // 비어있거나(결제 리다이렉트 경로는 아예 안 넘김) 낡을 수 있어 항상 서버 값을 우선한다.
  let photo: string | null = args.photo ?? null;
  const { data: meRow } = await supabase
    .from('users').select('photos').eq('id', user.id).maybeSingle();
  const serverPhotos = (meRow as any)?.photos;
  if (Array.isArray(serverPhotos) && serverPhotos.length > 0) photo = serverPhotos[0];
  // 보안 — URL params로 fee가 위변조될 수 있어 서버 진짜 값과 대조.
  // gatherings.fee를 다시 조회해서 비교. 다르면 즉시 throw → 슬롯 생성 차단.
  const { data: gRow, error: gErr } = await supabase
    .from('gatherings').select('fee').eq('id', args.gatheringId).maybeSingle();
  if (gErr) throw gErr;
  const realFee = (gRow as any)?.fee ?? 0;
  if (realFee !== args.fee) {
    throw new Error('결제 금액이 일치하지 않아요 — 다시 시도해주세요');
  }
  const platformFee = Math.round(args.fee * 0.2);  // 플랫폼 20% 수수료(기록용)
  // 1) 결제 기록 (fee>0일 때) — order_id 중복 시 idempotent (UNIQUE 제약 또는 onConflict 의존)
  if (args.fee > 0 && args.orderId) {
    const { error: pe } = await supabase.from('payments' as any).upsert({
      user_id: user.id, gathering_id: args.gatheringId, order_id: args.orderId,
      amount: args.fee, platform_fee: platformFee, status: 'paid', paid_at: new Date().toISOString(),
    } as any, { onConflict: 'order_id' });
    // upsert 실패해도 슬롯 생성은 계속 — payments는 fallback insert가 실패해도 슬롯 멱등성으로 보호됨
    if (pe && pe.code !== '23505') {
      // 23505 외 에러는 로깅용으로 throw 안 함
      // (UNIQUE 제약이 없는 환경에서는 인덱스 추가 권장)
    }
  }
  // 2) 슬롯 — 승인 대기(pending). 호스트 승인 시 approved.
  // 이전에 거절(rejected)된 내 슬롯이 있으면 지우고 재신청 (unique 충돌 + 정원 점유 방지)
  await (supabase.from('gathering_slots') as any).delete()
    .eq('gathering_id', args.gatheringId).eq('user_id', user.id).eq('status', 'rejected');
  const { error: se } = await supabase.from('gathering_slots').insert({
    gathering_id: args.gatheringId, user_id: user.id, gender: args.gender,
    role: 'guest', photo, status: 'pending',
    order_id: args.orderId ?? null, paid_amount: args.fee > 0 ? args.fee : null,
    platform_fee: args.fee > 0 ? platformFee : null,
    paid_at: args.fee > 0 ? new Date().toISOString() : null,
  } as any);
  if (se) {
    if (se.code === '23505') throw new Error('이미 참여 신청한 모임이에요');
    throw se;
  }
  // 3) 호스트 알림은 DB 트리거(notify_gather_host_on_request, 0074)가 서버에서 처리한다.
  //    (클라 insert는 H2 정책으로 막혀 조용히 실패했었음 — 트리거가 RLS 우회 + 푸시까지 발송)
}

// 호스트: 참여 신청 승인/거절 — SECURITY DEFINER RPC로 호스트 권한 강제
export async function decideGatheringSlot(args: {
  gatheringId: string; userId: string; approve: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('decide_gathering_slot' as any, {
    p_gathering_id: args.gatheringId,
    p_user_id: args.userId,
    p_approve: args.approve,
  });
  if (error) throw error;
  // 승인/거절 알림은 DB 트리거(notify_slot_decision, 0075)가 status 변경 시 서버에서 발송한다.
  // 모임 매칭 알림톡 — 호스트(현재 사용자)가 승인한 시점에 멤버 전원에게 (솔라피 미설정 시 서버 skip)
  if (args.approve) void sendAlimtalk('gather_matched', { gatheringId: args.gatheringId });
}

// ─────────────────────────────────────────────────────────────────────────────
// 0020 본사 공지사항 / 지도 모임 승인 (admin)
// ─────────────────────────────────────────────────────────────────────────────
export type Announcement = { id: string; title: string; body: string; active: boolean; created_at: string };

export async function fetchAnnouncements(activeOnly = true): Promise<Announcement[]> {
  let q = supabase.from('announcements' as any).select('*').order('created_at', { ascending: false });
  if (activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Announcement[];
}
export async function createAnnouncement(args: { title: string; body: string }): Promise<void> {
  const { error } = await supabase.from('announcements' as any).insert({ title: args.title, body: args.body } as any);
  if (error) throw error;
}
export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from('announcements' as any).delete().eq('id', id);
  if (error) throw error;
}

// ── 홈 상단 배너 (admin 관리, 홈에서 노출) ─────────────────────────────────
export type HomeBanner = { id: string; image_url: string; link_url: string | null; sort_order: number; active: boolean };
// 홈용 — 활성 배너만, 정렬순
export async function fetchHomeBanners(): Promise<HomeBanner[]> {
  const { data, error } = await supabase
    .from('home_banners' as any)
    .select('id, image_url, link_url, sort_order, active')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as HomeBanner[];
}
// admin용 — 전체(비활성 포함)
export async function adminFetchHomeBanners(): Promise<HomeBanner[]> {
  const { data, error } = await supabase
    .from('home_banners' as any)
    .select('id, image_url, link_url, sort_order, active')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as HomeBanner[];
}
export async function adminAddHomeBanner(imageUrl: string, sortOrder = 0): Promise<void> {
  const { error } = await supabase.from('home_banners' as any).insert({ image_url: imageUrl, sort_order: sortOrder } as any);
  if (error) throw error;
}
export async function adminSetHomeBannerActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('home_banners' as any).update({ active } as any).eq('id', id);
  if (error) throw error;
}
export async function adminDeleteHomeBanner(id: string): Promise<void> {
  const { error } = await supabase.from('home_banners' as any).delete().eq('id', id);
  if (error) throw error;
}

// 지도(야화에서 모이자) 승인 대기 모임 — admin
export async function fetchPendingGatherings(): Promise<ServerGather[]> {
  const { data, error } = await supabase
    .from('gatherings')
    .select(`id, title, cat, cover, ratio, slots, when_text, place, description,
             host_id, host_nick, host_photo, status, created_at,
             fee, fee_desc, gender_mode, region, social_kind, capacity, start_at,
             store_id, approved,
             gathering_slots(user_id, gender, role, slot_index, photo, status)`)
    .eq('approved' as any, false)
    .eq('status', 'recruiting')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ServerGather[];
}
// admin 승인/거절. 거절 시 status='cancelled'.
export async function setGatheringApproved(id: string, approve: boolean): Promise<void> {
  const patch = approve ? { approved: true } : { approved: false, status: 'cancelled' };
  const { error } = await supabase.from('gatherings').update(patch as any).eq('id', id);
  if (error) throw error;
}

// ── admin 정산 탭 — 모임 참가비(토스 결제) 호스트 정산 현황 ──────────────────
export type AdminSettlementPayment = {
  id: string;
  amount: number;
  platform_fee: number;
  status: string;
  payout_status: 'pending' | 'paid';
  paid_at: string | null;
  gathering_id: string | null;
  gathering_title: string | null;
  host_id: string | null;
  host_nick: string | null;
};

// payments(status='paid', fee>0인 모임) — admin RLS(is_admin())로 전체 조회.
export async function fetchAdminSettlementPayments(range?: DateRange): Promise<AdminSettlementPayment[]> {
  const q = supabase
    .from('payments' as any)
    .select('id, amount, platform_fee, status, payout_status, paid_at, gathering_id, gatherings(title, host_id, host_nick)')
    .eq('status', 'paid');
  const { data, error } = await rangeFilter(q as any, 'paid_at', range)
    .order('paid_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id, amount: r.amount, platform_fee: r.platform_fee, status: r.status,
    payout_status: r.payout_status, paid_at: r.paid_at, gathering_id: r.gathering_id,
    gathering_title: r.gatherings?.title ?? null,
    host_id: r.gatherings?.host_id ?? null,
    host_nick: r.gatherings?.host_nick ?? null,
  }));
}

// 정산 대상 호스트들의 정산 정보 일괄 조회 (admin RLS).
export async function fetchHostSettlementInfos(userIds: string[]): Promise<Record<string, HostSettlementInfo>> {
  if (userIds.length === 0) return {};
  const { data, error } = await supabase
    .from('host_settlement_info' as any)
    .select('*')
    .in('user_id', Array.from(new Set(userIds)));
  if (error) throw error;
  const out: Record<string, HostSettlementInfo> = {};
  for (const r of (data ?? []) as unknown as HostSettlementInfo[]) out[r.user_id] = r;
  return out;
}

export async function adminMarkPayoutStatus(paymentId: string, payoutStatus: 'pending' | 'paid'): Promise<void> {
  const { error } = await supabase
    .from('payments' as any)
    .update({ payout_status: payoutStatus, payout_at: payoutStatus === 'paid' ? new Date().toISOString() : null } as any)
    .eq('id', paymentId);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// 0038 가맹점 사장님(매장 소유자) — /owner 전용
// ─────────────────────────────────────────────────────────────────────────────
export type OwnerStore = {
  id: string; name: string; category: string | null; region: string | null;
  address: string | null; lat: number; lng: number;
  image_urls: string[]; intro: string | null; active: boolean; hot: boolean;
  gender_stats_open_days: number[] | null;  // 실시간 현황(웨이팅·인원) 공개 요일 (0=일..6=토), 기본 금·토
  waiting_slug: string | null;  // 태그히어 원격 웨이팅 슬러그 (0063)
};

// 내가 소유한 매장 목록 (stores_owner_select RLS로 자기 매장만 반환).
export async function fetchMyStores(): Promise<OwnerStore[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('stores')
    .select('id, name, category, region, address, lat, lng, image_urls, intro, active, hot, gender_stats_open_days, waiting_slug')
    .eq('owner_id' as any, user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OwnerStore[];
}

// 점주: 실시간 현황(웨이팅·인원) 공개 요일 설정 (0062 — 자유 토글, 빈 배열 = 항상 비공개)
export async function ownerSetGenderDays(storeId: string, days: number[]): Promise<void> {
  const { error } = await supabase.rpc('owner_set_gender_days' as any, {
    p_store_id: storeId, p_days: days,
  } as any);
  if (error) throw error;
}

// 점주: 태그히어 원격 웨이팅 슬러그 설정 (0063). 빈 문자열이면 해제.
export async function ownerSetWaitingSlug(storeId: string, slug: string): Promise<void> {
  const { error } = await supabase.rpc('owner_set_waiting_slug' as any, {
    p_store_id: storeId, p_slug: slug,
  } as any);
  if (error) throw error;
}

// 사장님이 자기 매장 정보 수정 (허용 컬럼만 서버 RPC로 반영).
export async function ownerUpdateStore(args: {
  storeId: string; name: string; category: string | null; region: string | null;
  address: string | null;
  // 좌표는 점주가 직접 입력하지 않음 — 주소 geocoding 결과만 전달, null이면 기존 좌표 유지(RPC coalesce)
  lat: number | null; lng: number | null;
  imageUrls: string[]; intro: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('owner_update_store' as any, {
    p_store_id: args.storeId, p_name: args.name, p_category: args.category, p_region: args.region,
    p_address: args.address, p_lat: args.lat, p_lng: args.lng, p_image_urls: args.imageUrls, p_intro: args.intro,
  } as any);
  if (error) throw error;
}

// 내 매장의 지도 모임 개설 신청 목록 (승인 대기). gatherings select는 public이라 직접 조회.
export async function fetchStorePendingGatherings(storeId: string): Promise<ServerGather[]> {
  const { data, error } = await supabase
    .from('gatherings')
    .select(`id, title, cat, cover, ratio, slots, when_text, place, description,
             host_id, host_nick, host_photo, status, created_at,
             fee, fee_desc, gender_mode, region, social_kind, capacity, start_at,
             store_id, approved`)
    .eq('store_id' as any, storeId)
    .eq('approved' as any, false)
    .eq('status', 'recruiting')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ServerGather[];
}

// 사장님 승인/거절 — 내 매장 건만 서버가 허용(owner_decide_gathering).
export async function ownerDecideGathering(gatheringId: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc('owner_decide_gathering' as any, {
    p_gathering_id: gatheringId, p_approve: approve,
  } as any);
  if (error) throw error;
}

// 본사 admin: 매장에 사장님 이메일 지정(빈 문자열이면 지정 해제).
export async function adminSetStoreOwner(storeId: string, email: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_store_owner' as any, {
    p_store_id: storeId, p_email: email,
  } as any);
  if (error) throw error;
}

// 모임 연락처 공유 (채팅 대체) — 승인 멤버/호스트만.
// 0021: user_id + is_host 함께 반환 — 동명 닉네임 시 호스트 오판 차단
export async function fetchGatheringContacts(
  gatheringId: string,
): Promise<Array<{ user_id: string; nickname: string; phone: string | null; is_host: boolean }>> {
  const { data, error } = await supabase.rpc('get_gathering_contacts' as any, { gid: gatheringId });
  if (error) throw error;
  return (data ?? []) as unknown as Array<{ user_id: string; nickname: string; phone: string | null; is_host: boolean }>;
}

// 오늘의 친구 연락처 잠금해제 여부 (0089)
export async function hasConnectionContactUnlock(otherId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_connection_contact_unlock' as any, { other_id: otherId });
  if (error) return false;
  return data === true;
}
// 오늘의 친구 연락처 잠금해제 — 100리프 또는 100포인트 차감(서버 원자적 처리)
export async function unlockConnectionContact(otherId: string, currency: 'leaf' | 'point'): Promise<void> {
  const { error } = await supabase.rpc('unlock_connection_contact' as any, {
    p_other_id: otherId,
    p_currency: currency,
  });
  if (error) throw error;
}

// 서버 알림 realtime 구독 — 새 알림 도착 시 콜백 (연결 신청/수락, 호감도 등)
export function subscribeServerNotifs(userId: string, onInsert: (n: ServerNotif) => void): () => void {
  const channel = supabase
    .channel(`notifs:${userId}:${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => onInsert(payload.new as ServerNotif),
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ── 0139 인연 프로필 중지(운영) — 관리자 전용 RPC(is_admin 게이트) ───────────────
export type AdminAffinityProfile = {
  id: string; nickname: string | null; gender: 'M' | 'F' | null; age: number | null; region: string | null;
  photos: string[] | null; job: string | null; intro_want: string | null; created_at: string; updated_at: string;
  affinity_suspended: boolean; affinity_suspended_reason: string | null; affinity_suspended_at: string | null;
  affinity_review_requested_at: string | null; affinity_hidden: boolean; report_count: number;
};
export async function adminListAffinityProfiles(): Promise<AdminAffinityProfile[]> {
  const { data, error } = await supabase.rpc('admin_list_affinity_profiles' as never);
  if (error) throw error;
  return (data ?? []) as unknown as AdminAffinityProfile[];
}
// 기존 사진 일괄 검사(0168)에서 통과 못 한 사진 — 지금 프로필에 남아 있는 것만
export type AdminPhotoFlag = { user_id: string; photo_url: string; photo_index: number | null; result: 'no_face' | 'no_person' | 'unsafe'; checked_at: string };
export async function adminListPhotoFlags(): Promise<AdminPhotoFlag[]> {
  const { data, error } = await supabase.rpc('admin_list_photo_flags' as never);
  if (error) throw error;
  return (data ?? []) as unknown as AdminPhotoFlag[];
}
export async function adminSetAffinitySuspension(args: { userId: string; suspend: boolean; reason?: string; message?: string }): Promise<void> {
  const { error } = await supabase.rpc('admin_set_affinity_suspension' as never, {
    p_user: args.userId, p_suspend: args.suspend, p_reason: args.reason ?? null, p_message: args.message ?? null,
  } as never);
  if (error) throw error;
}

// ── 0141 프로필 미완성 회원 등록 유도 푸시 — 관리자 전용 ───────────────────────
export type ProfileNudgeResult = { targets: number; with_push_token: number; sent: number; title: string; body: string; dry_run: boolean };
export async function adminSendProfileNudge(args: { gender: 'F' | 'M' | null; title?: string; body?: string; dryRun: boolean; cooldownDays?: number }): Promise<ProfileNudgeResult> {
  const { data, error } = await supabase.rpc('admin_send_profile_nudge' as never, {
    p_gender: args.gender, p_title: args.title ?? null, p_body: args.body ?? null,
    p_dry_run: args.dryRun, p_cooldown_days: args.cooldownDays ?? 7,
  } as never);
  if (error) throw error;
  const r = data as any;
  return { ...r, targets: Number(r.targets), with_push_token: Number(r.with_push_token), sent: Number(r.sent) };
}

// ── 0146 편지·초대장 (프로토타입 v2) — 테이블 직접 접근 없이 RPC로만 ─────────────
// 비용은 서버 leaf_price()가 기준(0187). 화면은 src/lib/leafPricing.ts(get_leaf_pricing)로 같은 값을 읽는다.
export type LetterKind = 'letter' | 'invite';
export type LetterRow = {
  id: string; direction: 'in' | 'out';
  other_id: string; other_nickname: string | null; other_photo: string | null; other_age: number | null;
  kind: LetterKind; body: string; reply_body: string | null;
  my_kakao: string | null; my_phone: string | null;
  their_kakao: string | null; their_phone: string | null;  // 연결 전에는 null
  their_has_kakao: boolean; their_has_phone: boolean;
  cost: number; reply_cost: number | null;
  created_at: string; read_at: string | null; replied_at: string | null; declined_at: string | null;
  expires_at: string;
};
export async function listMyLetters(): Promise<LetterRow[]> {
  const { data, error } = await supabase.rpc('list_my_letters' as never);
  if (error) throw error;
  return (data ?? []) as unknown as LetterRow[];
}
export async function sendLetter(args: { receiverId: string; body: string; kakao?: string | null; phone?: string | null; kind: LetterKind }): Promise<string> {
  const { data, error } = await supabase.rpc('send_letter' as never, {
    p_receiver: args.receiverId, p_body: args.body, p_kakao: args.kakao ?? null, p_phone: args.phone ?? null, p_kind: args.kind,
  } as never);
  if (error) throw error;
  return data as unknown as string;
}
// 0190 편지 '마음이 간 곳' — 받는 사람 프로필에서 고른 문장 · 사진(최대 2곳). 서버가 실제 프로필에 있는 것만 받는다.
export type LetterMark = { t: 'line'; q: string; text: string } | { t: 'photo'; url: string; n: number };
export async function setLetterMarks(letterId: string, items: LetterMark[]): Promise<void> {
  const { error } = await supabase.rpc('set_letter_marks' as never, { p_letter: letterId, p_items: items } as never);
  if (error) throw error;
}
export async function getLetterMarks(ids: string[]): Promise<Record<string, LetterMark[]>> {
  const { data, error } = await supabase.rpc('get_letter_marks' as never, { p_ids: ids } as never);
  if (error) throw error;
  const out: Record<string, LetterMark[]> = {};
  for (const r of (data ?? []) as unknown as { letter_id: string; items: LetterMark[] }[]) out[r.letter_id] = Array.isArray(r.items) ? r.items : [];
  return out;
}
export async function readLetter(id: string): Promise<void> {
  const { error } = await supabase.rpc('read_letter' as never, { p_id: id } as never);
  if (error) throw error;
}
export async function replyLetter(args: { id: string; body: string; kakao?: string | null; phone?: string | null }): Promise<void> {
  const { error } = await supabase.rpc('reply_letter' as never, {
    p_id: args.id, p_body: args.body, p_kakao: args.kakao ?? null, p_phone: args.phone ?? null,
  } as never);
  if (error) throw error;
}
export async function declineLetter(id: string): Promise<void> {
  const { error } = await supabase.rpc('decline_letter' as never, { p_id: id } as never);
  if (error) throw error;
}
export async function upgradeLetter(id: string): Promise<void> {
  const { error } = await supabase.rpc('upgrade_letter' as never, { p_id: id } as never);
  if (error) throw error;
}

// ── 0147 무료 리프 하루 미션 ───────────────────────────────────────────────
export type MissionKey = 'like1' | 'like2' | 'deck_read' | 'post' | 'comment';
export const MISSIONS: { key: MissionKey; title: string; sub: string; amount: number }[] = [
  { key: 'like1', title: '관심 보내기', sub: '하루 첫 번째 관심', amount: 5 },
  { key: 'like2', title: '관심 한 번 더', sub: '하루 두 번째 관심', amount: 5 },
  { key: 'deck_read', title: '오늘의 인연 모두 읽기', sub: '저녁 6시 이후 8명을 모두 읽으면', amount: 3 },
  { key: 'post', title: '커뮤니티 글쓰기', sub: '하루 글 1개', amount: 1 },
  { key: 'comment', title: '댓글 남기기', sub: '하루 댓글 1개', amount: 1 },
];
export async function fetchMyMissionsToday(): Promise<Partial<Record<MissionKey, number>>> {
  const user = await getSessionUser();
  if (!user) return {};
  const { data, error } = await supabase.rpc('my_missions_today' as never);
  if (error) throw error;
  return (data ?? {}) as Partial<Record<MissionKey, number>>;
}
// 덱에서 연 프로필 기록(0152) — 과금 판정과 별개로 '8명 모두 읽기' 판정에만 쓴다
export async function recordDeckView(profileId: string): Promise<void> {
  const { error } = await supabase.rpc('record_deck_view' as never, { p_profile_id: profileId } as never);
  if (error) throw error;
}
export async function claimDeckReadReward(ids: string[]): Promise<{ granted: boolean; amount?: number; reason?: string }> {
  const { data, error } = await supabase.rpc('claim_deck_read_reward' as never, { p_ids: ids } as never);
  if (error) throw error;
  return data as any;
}

// ── 0148 나의 취향 ────────────────────────────────────────────────────────
export type MatchPrefs = {
  regions?: string[];            // 비었으면 상관없음
  mbtis?: string[];              // 비었으면 상관없음
  ageAny?: boolean; minAge?: number; maxAge?: number;
  religion?: string; politics?: string; drinking?: string; smoking?: string;  // '상관없음' 또는 값
};
export async function fetchMyMatchPrefs(): Promise<MatchPrefs> {
  const user = await getSessionUser();
  if (!user) return {};
  const { data, error } = await supabase.from('users').select('match_prefs' as any).eq('id', user.id).maybeSingle();
  if (error) throw error;
  return ((data as any)?.match_prefs ?? {}) as MatchPrefs;
}
export async function saveMyMatchPrefs(prefs: MatchPrefs): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { error } = await supabase.from('users').update({ match_prefs: prefs } as any).eq('id', user.id);
  if (error) throw error;
}

// ── 0148 추천 프로필(관리자) ──────────────────────────────────────────────
export async function adminListFeatured(): Promise<string[]> {
  const { data, error } = await supabase.rpc('admin_list_featured' as never);
  if (error) throw error;
  return ((data ?? []) as unknown as string[]);
}
export async function adminSetFeatured(userId: string, on: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_featured' as never, { p_user: userId, p_on: on } as never);
  if (error) throw error;
}

// ── 0150 매칭 완료 지표(관리자) ────────────────────────────────────────────
export type AdminMatchingDay = {
  day: string;                    // KST yyyy-mm-dd
  letters_sent: number; invites_sent: number;
  letters_connected: number;      // 그날 수락(=연결)된 편지·초대장
  mutual_interest_pairs: number;  // 그날 두 번째 호감이 생겨 '서로 호감'이 된 쌍
};
export type AdminMatchingMetrics = {
  from: string; to: string;
  daily: AdminMatchingDay[];
  totals: {
    connected_total: number; connected_7d: number; connected_30d: number;
    accept_rate: number | null;   // 연결 / 판정된 편지(3일 경과 또는 수락·거절)
    accept_base: number;
    avg_hours_to_connect: number | null;
  };
};
// 함수가 아직 없으면 PostgREST 에러(code PGRST202)를 그대로 던진다 — 화면에서 안내 문구로 처리
export async function adminMatchingMetrics(days: number): Promise<AdminMatchingMetrics> {
  const { data, error } = await supabase.rpc('admin_matching_metrics' as never, { p_days: days } as never);
  if (error) throw error;
  return data as unknown as AdminMatchingMetrics;
}

// ── 0157 프로필 인증(학력·직장·소득) — 시안 사이트 '인증 관리' (1013-B) ─────────
// 확인 자료는 프라이빗 버킷 credential-proofs/{uid}/... 에 올리고, 검토가 끝나면 지운다(0157 주석 참고).
export type CredentialKind = 'school' | 'company' | 'income';
export type MyCredential = {
  id: string; kind: CredentialKind; label: string; ref_year: number | null;
  status: 'pending' | 'approved' | 'rejected'; reject_reason: string | null;
  created_at: string; reviewed_at: string | null;
};
const CREDENTIAL_BUCKET = 'credential-proofs';
// 0157 적용 전(테이블·함수 없음)엔 빈 목록 — 화면이 깨지지 않게
const missingObject = (e: any) => ['PGRST205', 'PGRST202', '42P01', '42883'].includes(String(e?.code ?? ''));

export async function fetchMyCredentials(): Promise<MyCredential[]> {
  const { data, error } = await supabase
    .from('profile_credentials' as any)
    .select('id, kind, label, ref_year, status, reject_reason, created_at, reviewed_at')
    .order('created_at', { ascending: true });
  if (error) { if (missingObject(error)) return []; throw error; }
  return (data ?? []) as unknown as MyCredential[];
}

function proofExt(mime: string, name?: string): string {
  if (mime === 'application/pdf') return 'pdf';
  const sub = mime.split('/')[1]?.split('+')[0];
  if (sub) return sub === 'jpeg' ? 'jpg' : sub;
  return name?.split('.').pop()?.toLowerCase() || 'jpg';
}

// 자료 업로드 → 검토 신청. 신청이 실패하면 올린 파일을 지우고, 교체된 이전 자료도 지운다.
export async function submitCredential(kind: CredentialKind, label: string, file: { bytes: ArrayBuffer | Blob; mime: string; name?: string }): Promise<void> {
  const user = await getSessionUser();
  if (!user) throw new Error('로그인이 필요해요');
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `${user.id}/${kind}-${Date.now()}-${rand}.${proofExt(file.mime, file.name)}`;
  const up = await supabase.storage.from(CREDENTIAL_BUCKET).upload(path, file.bytes as any, { contentType: file.mime, upsert: false });
  if (up.error) throw up.error;
  const { data, error } = await supabase.rpc('submit_credential' as never, { p_kind: kind, p_label: label, p_proof_path: path } as never);
  if (error) {
    await supabase.storage.from(CREDENTIAL_BUCKET).remove([path]);
    throw error;
  }
  const replaced = (data as any)?.replaced_proof as string | null | undefined;
  if (replaced) await supabase.storage.from(CREDENTIAL_BUCKET).remove([replaced]);
}

// 인증 내리기(승인 건) · 신청 취소(검토 대기 건) — 남은 자료가 있으면 바로 지운다
export async function withdrawCredential(kind: CredentialKind): Promise<void> {
  const { data, error } = await supabase.rpc('withdraw_credential' as never, { p_kind: kind } as never);
  if (error) throw error;
  const path = data as unknown as string | null;
  if (path) await supabase.storage.from(CREDENTIAL_BUCKET).remove([path]);
}

// ── 관리자: 인증 검토 ──
export type AdminCredentialRow = {
  id: string; user_id: string; nickname: string | null; gender: 'M' | 'F' | null; age: number | null; photo: string | null;
  kind: CredentialKind; label: string; ref_year: number | null; proof_path: string | null;
  verified_email?: string | null;  // 0170 — 학교·회사 메일로 소속을 확인한 신청(자료 파일 없음)
  status: 'pending' | 'approved' | 'rejected'; reject_reason: string | null; created_at: string; reviewed_at: string | null;
};
export async function adminListCredentials(status?: 'pending' | 'approved' | 'rejected'): Promise<AdminCredentialRow[]> {
  const { data, error } = await supabase.rpc('admin_list_credentials' as never, { p_status: status ?? null } as never);
  if (error) throw error;
  return (data ?? []) as unknown as AdminCredentialRow[];
}
// 자료 열람용 서명 URL(5분)
export async function adminCredentialProofUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(CREDENTIAL_BUCKET).createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}
// 승인·반려 → 자료 삭제. 파일을 못 지웠으면 removed=false(남은 자료 정리에서 다시 지운다)
export async function adminReviewCredential(args: { id: string; approve: boolean; reason?: string; label?: string }): Promise<{ removed: boolean }> {
  const { data, error } = await supabase.rpc('admin_review_credential' as never, {
    p_id: args.id, p_approve: args.approve, p_reason: args.reason ?? null, p_label: args.label ?? null,
  } as never);
  if (error) throw error;
  const path = data as unknown as string | null;
  if (!path) return { removed: true };
  const rm = await supabase.storage.from(CREDENTIAL_BUCKET).remove([path]);
  return { removed: !rm.error };
}
// 어떤 검토 대기 건도 가리키지 않는 남은 자료(1시간 지난 것)
export async function adminOrphanCredentialProofs(): Promise<string[]> {
  const { data, error } = await supabase.rpc('admin_orphan_credential_proofs' as never);
  if (error) throw error;
  return ((data ?? []) as unknown as { name: string }[]).map((r) => r.name);
}
export async function adminRemoveCredentialProofs(paths: string[]): Promise<number> {
  if (!paths.length) return 0;
  const { data, error } = await supabase.storage.from(CREDENTIAL_BUCKET).remove(paths);
  if (error) throw error;
  return data?.length ?? 0;
}
