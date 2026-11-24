// 야화 — Preview 모드 전용 클라이언트 상태. 실 Supabase 연결 없이 모든 인터랙션 시뮬.
// useSyncExternalStore 기반 — 컴포넌트가 subscribe해서 변경 알림 수신.
import { useSyncExternalStore } from 'react';
import { FEED, FeedUser, GATHERS, Gather, LOUNGE_POSTS, LoungePost, LoungeCat, CAT_COVER, DEFAULT_COVER } from '../data/mock';
import { demo1, demo2 } from '../data/assets';
import { IS_DEMO } from './flags';
import { censorText } from './profanity';
import { tierOf } from './tier';

type ChatBubble = { id: string; me: boolean; body: string; time: string; read?: boolean };
type CommentRow = { id: string; nick: string; body: string; time: string; likes: number; mine?: boolean };

// 모임 — "친구 찾기" 게시글 (3가지 프롬프트 + 사진)
export type SocialPost = {
  id: string;
  authorNick: string;
  authorPhoto?: string | number;
  title: string;
  about: string;
  looking: string;
  flex: string;
  photo?: string;  // dataURL or remote
  time: string;
  likes: number;
};

export type ChatRoom = {
  id: string;
  kind: 'gather' | 'dm';
  peerName: string;          // 표시할 상대방 이름 (gather는 모임 이름)
  peerPhoto?: string | number; // 1:1은 상대방 사진, gather는 호스트 사진
  members?: (string | number)[]; // gather 멤버 사진 (최대 4개)
  count?: string;             // gather "4/4"
  request?: boolean;          // 연결 요청 상태
  locked?: boolean;           // gather 매칭 미완료
  online?: boolean;
  lastBody: string;
  lastTime: string;
  unread: number;
};

// 내 프로필 사진 — 편집에서 업로드한 게 있으면 그걸, 없으면 데모 fallback
// 내 프로필 사진 — 미설정이면 undefined를 반환해 SlotDot/Avatar가 깨끗한 플레이스홀더를 그림.
// (예전 ME_PHOTO 폴백은 사용자가 올린 적 없는 unsplash 인물 사진을 강제로 노출시키는 버그였음)
function myPhoto(s: { myProfile: MyProfile }): string | number | undefined {
  return s.myProfile.photo;
}

function countFilled(g: Gather): number {
  return g.slots.M.filter((s) => s.filled).length + g.slots.F.filter((s) => s.filled).length;
}

function gatherHostPhoto(g: Gather): string | number {
  const all = [...g.slots.M, ...g.slots.F];
  const host = all.find((s) => s.host && s.photo);
  return host?.photo ?? demo1;
}

function collectGatherMemberPhotos(g: Gather): (string | number)[] {
  const all = [...g.slots.M, ...g.slots.F];
  return all.filter((s) => s.filled && s.photo && !s.host).map((s) => s.photo!) as (string | number)[];
}

function nowTime(): string {
  const d = new Date();
  const h = d.getHours();
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${ampm} ${h12}:${d.getMinutes().toString().padStart(2, '0')}`;
}

type State = {
  leafBalance: number;
  points: number;               // 야화 매장 결제 시 적립되는 포인트 (리프와 별개)
  storeSpendTotal: number;      // 야화 매장 누적 결제액(원) — 티어 산정
  fortuneRevealed: Record<string, boolean>;  // `${날짜}|${카테고리}` → 오늘 이미 깐 카드
  unlocked: Record<string, boolean>;  // user_id → true
  bookmarked: Record<string, boolean>;
  liked: Record<string, boolean>;  // post_id or user_id → true
  joinedGather: Record<string, boolean>;  // gather id → true (참여 신청 완료)
  followed: Record<string, boolean>;  // nick → true
  feedMessages: Record<string, ChatBubble[]>;  // roomKey → msgs
  comments: Record<string, CommentRow[]>;  // postId → 추가 댓글
  loungeLikes: Record<string, number>;  // postId → +N
  reportSheetTarget: { kind: 'user' | 'profile' | 'post' | 'comment' | 'message'; id: string; userId?: string } | null;
  toast: string | null;
  paywall: { open: boolean; needed: number; reason: string } | null;
  pendingCharge: boolean;  // 전역 Paywall→충전 화면 이동 인텐트 (app/index.tsx가 소비)
  confirmSpend: {
    open: boolean;
    amount: number;
    title: string;
    body: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null;
  currencyChoice: {
    open: boolean;
    amount: number;
    title: string;
    body: string;
    onPick: (currency: 'leaf' | 'point') => void;
  } | null;
  notifications: Notif[];
  unreadCount: number;
  searchQuery: string;
  chatRooms: ChatRoom[];
  userPosts: LoungePost[];  // 사용자가 작성한 라운지 글
  userSocialPosts: SocialPost[];  // 사용자가 모임에 올린 친구 찾기 글
  userGathers: Gather[];     // 사용자가 만든 게더링
  replyLikes: Record<string, boolean>;  // "postId_commentIdx_replyIdx" → liked
  // 채팅방별 마지막 읽음 시각 (ISO). 채팅방 진입 시 갱신 → unread badge 계산용
  roomLastRead: Record<string, string>;
  signedOut: boolean;
  // 게스트(미로그인)가 보호 기능을 사용하려 할 때 띄우는 로그인 유도 모달
  authPrompt: { reason?: string } | null;
  // 프로필 미완성 사용자가 인연 액션(관심·메시지) 시도 시 완성 유도 프롬프트
  profileGate: { reason?: string } | null;
  myProfile: MyProfile;
};

export type MyProfile = {
  nickname: string;
  age: number;
  gender: 'F' | 'M';
  birthYear?: number;
  birthMonth?: number;
  birthDay?: number;
  region: string;
  headline: string;
  bio: string;
  tags: string[];
  onboarded: boolean;  // 가입 후 생년월일+성별 등록 완료
  photo?: string | number;  // 대표 프로필 사진 (web: dataURL, native: require/url)
  anonNickname?: string;  // 라운지 댓글 영속 익명 닉 (첫 댓글 시 생성)
  phone?: string;  // 연락처 (프로필 편집에서 입력)
  kakaoId?: string;  // 카카오톡 ID (선택) — 호감 메시지 프리필용
  // 0018 프로필 확장
  photos?: string[];        // 인연 프로필 사진 (photos[0]이 대표)
  groupPhoto?: string;      // 모임 전용 대표사진 — 인연 photos와 독립(0124)
  mbti?: string;
  height?: number;
  smoking?: string;         // '비흡연' | '흡연' | '가끔'
  drinking?: string;        // '안 함' | '가끔' | '자주'
  introWant?: string;       // 어떤 친구를 만나고 싶나요 (위저드: "어떤 사람에게 자연스럽게 마음이 가나요?")
  introInterest?: string;   // 요즘 관심사
  introHobby?: string;      // 취미
  // 0107 프로필 위저드 확장
  job?: string;             // 직업
  religion?: string;        // 종교
  politics?: string;        // 정치 성향
  politicsPublic?: boolean; // 정치 성향 프로필 공개 여부
  extraAnswers?: { q: string; a: string }[];  // 선택 질문 답변 (최대 2)
  education?: string;       // 학력 (0148, 필수)
  // 0108 인연 쉬어가기
  affinityMuteNotifs?: boolean;  // 인연 알림 전부 끄기
  affinityHidden?: boolean;      // 내 프로필 인연 덱 비노출
  affinityDeckPaused?: boolean;  // 내 덱에 이성 카드 미노출
  // 0139 운영 조치 — 관리자가 인연 공개를 중지한 상태(해제는 관리자만)
  affinitySuspended?: boolean;
  affinitySuspendedReason?: string | null;
  affinityReviewRequestedAt?: string | null;
  profileCompleted?: boolean; // 첫 로그인 필수 프로필 작성 완료
  // 서버(users.gender)에 성별이 확정 저장됐는지. 로컬 gender는 기본값이 'M'이라
  // "값이 있는지"로는 확정 여부를 알 수 없어 별도 플래그가 필요하다.
  genderLocked?: boolean;
};

export type Notif = {
  id: string;
  kind: 'match' | 'message' | 'like' | 'comment' | 'gather' | 'system';
  title: string;
  body: string;
  time: string;
  read: boolean;
  // 클릭 시 이동 target
  targetChatRoomId?: string;
  targetPostId?: string;
  targetGatherId?: string;
  targetUserId?: string;
};

const INIT_CHAT_ROOMS: ChatRoom[] = [
  {
    id: 'g1',
    kind: 'gather',
    peerName: '성수 와인바 2:2',
    peerPhoto: demo1,
    members: [demo1, FEED[1].photos[0], FEED[2].photos[0], FEED[3].photos[0]],
    count: '4/4',
    lastBody: '카리나무드: 금 저녁 7시 너무 좋아요!',
    lastTime: '3시간 전',
    unread: 0,
  },
  {
    id: 'g2',
    kind: 'gather',
    peerName: '홍대 재즈바 3:3',
    peerPhoto: FEED[2].photos[0],
    members: [FEED[2].photos[0], FEED[4].photos[0], FEED[0].photos[0], FEED[1].photos[0], FEED[3].photos[0]],
    count: '5/6',
    locked: true,
    lastBody: '마지막 1명 기다리는 중',
    lastTime: '2시간 전',
    unread: 0,
  },
  {
    id: 'c1',
    kind: 'dm',
    peerName: '카리나무드',
    peerPhoto: demo1,
    online: true,
    lastBody: '오늘 저녁 7시 어떠세요?',
    lastTime: '30분 전',
    unread: 0,
  },
  {
    id: 'c2',
    kind: 'dm',
    peerName: '러닝메이트',
    peerPhoto: FEED[1].photos[0],
    request: true,
    lastBody: '(연결 요청을 보냈어요)',
    lastTime: '1시간 전',
    unread: 0,
  },
  {
    id: 'c3',
    kind: 'dm',
    peerName: '책방지기',
    peerPhoto: FEED[2].photos[0],
    lastBody: '책 추천 감사해요!',
    lastTime: '4시간 전',
    unread: 0,
  },
  {
    id: 'c4',
    kind: 'dm',
    peerName: '홈쿠킹마스터',
    peerPhoto: FEED[3].photos[0],
    lastBody: '사진 공개되어 있어요',
    lastTime: '어제',
    unread: 0,
  },
  {
    id: 'c5',
    kind: 'dm',
    peerName: '영화광',
    peerPhoto: FEED[4].photos[0],
    lastBody: '심야 영화 OK',
    lastTime: '어제',
    unread: 0,
  },
];

const INIT_NOTIFS: Notif[] = [
  { id: 'n1', kind: 'match', title: '꽃이 피었어요', body: '카리나무드 님과 매칭됐어요', time: '30분 전', read: false, targetChatRoomId: 'c1' },
  { id: 'n2', kind: 'like', title: '좋아요를 받았어요', body: '러닝메이트 님이 회원님 프로필에 좋아요', time: '5분 전', read: false, targetUserId: 'u02' },
  { id: 'n3', kind: 'gather', title: '게더링 모집 임박', body: '성수 와인바 2:2 — 1자리 남음', time: '1시간 전', read: true, targetGatherId: 'g1' },
  { id: 'n4', kind: 'comment', title: '댓글이 달렸어요', body: '"소개팅 3번째인데…"에 새 답글', time: '2시간 전', read: true, targetPostId: 'p01' },
  { id: 'n5', kind: 'system', title: '환영해요', body: '야화에 오신 걸 환영해요. 프로필을 채워보세요', time: '어제', read: true },
];

// 모든 리프 사용 액션의 고정 비용 (사용자 지시)
export const LEAF_COST = 30;

// 데모 모드일 때만 시드 알림/채팅방 노출
const seededNotifs: Notif[] = IS_DEMO ? INIT_NOTIFS : [];
const seededChatRooms: ChatRoom[] = IS_DEMO ? INIT_CHAT_ROOMS : [];

const initial: State = {
  leafBalance: IS_DEMO ? 248 : 0,
  points: 0,
  storeSpendTotal: 0,
  fortuneRevealed: {},
  unlocked: {},
  bookmarked: {},
  liked: {},
  joinedGather: {},
  followed: {},
  feedMessages: {},
  comments: {},
  loungeLikes: {},
  reportSheetTarget: null,
  toast: null,
  paywall: null,
  pendingCharge: false,
  confirmSpend: null,
  currencyChoice: null,
  notifications: seededNotifs,
  unreadCount: seededNotifs.filter((n) => !n.read).length,
  searchQuery: '',
  chatRooms: seededChatRooms,
  userPosts: [],
  userSocialPosts: [],
  userGathers: [],
  replyLikes: {},
  roomLastRead: {},
  signedOut: false,
  authPrompt: null,
  profileGate: null,
  myProfile: IS_DEMO
    ? {
        nickname: '들꽃 같은 28',
        age: 28,
        gender: 'M',
        region: '성수동',
        headline: '재즈바 같이 갈 분 찾아요',
        bio: '평일 저녁 음악 좋아하시는 분과 가볍게 한 잔.',
        tags: ['#재즈', '#성수', '#와인'],
        onboarded: true,
      }
    : {
        nickname: '',
        age: 0,
        gender: 'M',
        region: '',
        headline: '',
        bio: '',
        tags: [],
        onboarded: false,
      },
};

// ── localStorage 영속화 (web) — 새로고침해도 사용자 작성 데이터 유지 ────────
// v4: 사용자 ID별 키 (`yahwa.previewStore.v4.<userId>`). 같은 브라우저에서 여러 계정을
//      써도 데이터가 섞이지 않고, 로그아웃 후 같은 계정 재로그인 시 본인 데이터가 복원됨.
const STORAGE_PREFIX = 'yahwa.previewStore.v4';
const ANON_KEY = `${STORAGE_PREFIX}.anon`;
const PERSIST_KEYS: (keyof State)[] = [
  'leafBalance', 'points', 'storeSpendTotal', 'fortuneRevealed',
  'unlocked', 'bookmarked', 'liked', 'joinedGather',
  'followed', 'feedMessages', 'comments', 'loungeLikes',
  'notifications', 'unreadCount', 'chatRooms', 'userPosts', 'userSocialPosts', 'userGathers', 'replyLikes',
  'roomLastRead', 'myProfile',
  // 주의: signedOut은 사용자별로 저장하지 않음 — 세션 상태이지 사용자 데이터가 아님
];

// 현재 활성 사용자 — setActiveUser로 갱신
let currentUserId: string | null = null;
export function getCurrentUserId(): string | null { return currentUserId; }
// 보호 기능 가드 — 로그인 상태면 true, 아니면 로그인 유도 모달을 띄우고 false.
// 사용처: 핸들러 첫 줄에 `if (!requireAuth('연결 신청')) return;`
export function requireAuth(reason?: string): boolean {
  if (currentUserId) return true;
  previewActions.requireLogin(reason);
  return false;
}
function storageKeyFor(userId: string | null): string {
  return userId ? `${STORAGE_PREFIX}.${userId}` : ANON_KEY;
}

// 예전 빌드에서 사용자가 사진 미설정 상태로 만든 게더링/채팅방의 host/slot/peer 사진에
// 강제로 박혔던 unsplash URL. 영속된 데이터에서 발견 시 제거(undefined로 치환)해
// SlotDot/Avatar가 깨끗한 플레이스홀더로 렌더되도록 한다.
const LEGACY_ME_PHOTO = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&h=200&q=70';

function scrubLegacyMePhoto(d: any): any {
  if (!d || typeof d !== 'object') return d;
  if (d.myProfile && d.myProfile.photo === LEGACY_ME_PHOTO) {
    d.myProfile = { ...d.myProfile, photo: undefined };
  }
  if (Array.isArray(d.userGathers)) {
    d.userGathers = d.userGathers.map((g: any) => {
      if (!g) return g;
      const stripSlot = (s: any) =>
        s && s.photo === LEGACY_ME_PHOTO ? { ...s, photo: undefined } : s;
      const nextHost = g.host && g.host.photo === LEGACY_ME_PHOTO
        ? { ...g.host, photo: null }
        : g.host;
      const nextSlots = g.slots
        ? { M: (g.slots.M || []).map(stripSlot), F: (g.slots.F || []).map(stripSlot) }
        : g.slots;
      return { ...g, host: nextHost, slots: nextSlots };
    });
  }
  if (Array.isArray(d.chatRooms)) {
    d.chatRooms = d.chatRooms.map((r: any) => {
      if (!r) return r;
      return {
        ...r,
        peerPhoto: r.peerPhoto === LEGACY_ME_PHOTO ? undefined : r.peerPhoto,
        members: Array.isArray(r.members)
          ? r.members.filter((m: any) => m !== LEGACY_ME_PHOTO)
          : r.members,
      };
    });
  }
  return d;
}

function loadPersistedFor(userId: string | null): Partial<State> | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(storageKeyFor(userId));
    if (!raw) return null;
    return scrubLegacyMePhoto(JSON.parse(raw)) as Partial<State>;
  } catch { return null; }
}

let quotaWarned = false;
function persistFor(userId: string | null, s: State) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const subset: any = {};
    PERSIST_KEYS.forEach((k) => { subset[k] = s[k]; });
    window.localStorage.setItem(storageKeyFor(userId), JSON.stringify(subset));
  } catch (e) {
    // quota 초과 등 영속 실패 — 사용자에게 1회 경고 (인메모리는 유지되나 새로고침 시 손실)
    if (!quotaWarned && typeof window !== 'undefined') {
      quotaWarned = true;
      try {
        state = { ...state, toast: '저장 공간이 부족해요 — 일부 데이터가 새로고침 시 사라질 수 있어요' };
        listeners.forEach((l) => l());
        setTimeout(() => {
          state = { ...state, toast: null };
          listeners.forEach((l) => l());
        }, 3500);
      } catch { /* ignore */ }
    }
  }
}

// persist debounce — 매 setState마다 17키 JSON 직렬화는 메인스레드 차단 5~30ms.
// 200ms trailing으로 모아 처리. 탭 닫힘/visibility hidden 시 즉시 flush.
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPersistState: State | null = null;

function flushPersist() {
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  if (pendingPersistState) {
    persistFor(currentUserId, pendingPersistState);
    pendingPersistState = null;
  }
}

function persist(s: State) {
  pendingPersistState = s;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    if (pendingPersistState) {
      persistFor(currentUserId, pendingPersistState);
      pendingPersistState = null;
    }
  }, 200);
}

// 탭 종료/숨김 시 미저장 데이터 즉시 flush — 새로고침 직전 setState 손실 방지 (웹 전용)
// RN(Hermes)에선 window는 있어도 addEventListener가 없음 — RN 0.81부터 스텁이 제거돼
// 이 가드 없이는 앱이 부팅 즉시 크래시한다 (App Store 심사 반려 2.1(a) 원인이었음).
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', flushPersist);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPersist();
  });
}

// 부트 시점에는 세션 정보가 아직 없어 anon 슬롯에서 1차 로드.
// useSession에서 세션이 확정되면 previewActions.setActiveUser(userId)로 본인 슬롯으로 교체.
const persisted = loadPersistedFor(null);
let state: State = persisted ? { ...initial, ...persisted } : initial;

const listeners = new Set<() => void>();

// 다중 탭 동기화 — 다른 탭이 같은 슬롯에 쓰면 이 탭의 메모리 state도 갱신.
// 이게 없으면 두 탭이 stale write로 서로 덮어쓸 위험.
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('storage', (ev) => {
    if (!ev.key) return;
    const expected = storageKeyFor(currentUserId);
    if (ev.key !== expected) return;
    const loaded = loadPersistedFor(currentUserId);
    if (!loaded) return;
    // transient state(toast/paywall/confirmSpend)는 유지, 영속 키만 머지
    state = { ...state, ...loaded };
    listeners.forEach((l) => l());
  });
}

function set(updater: (s: State) => State) {
  state = updater(state);
  persist(state);
  listeners.forEach((l) => l());
}

// 훅 밖(이벤트 핸들러·가드)에서 현재 상태를 읽어야 할 때. 렌더에는 usePreview를 쓸 것.
export function getPreviewState(): State {
  return state;
}

export function usePreview<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
    () => selector(state),
    () => selector(initial),
  );
}

// ── Actions ─────────────────────────────────────────────────────────────────
export const previewActions = {
  // 연결 신청 idempotency를 위한 마킹 — 토스트 없이 unlocked 집합만 갱신
  markConnected(userId: string) {
    if (state.unlocked[userId]) return;
    set((s) => ({ ...s, unlocked: { ...s.unlocked, [userId]: true } }));
  },
  toggleBookmark(id: string) {
    set((s) => ({ ...s, bookmarked: { ...s.bookmarked, [id]: !s.bookmarked[id] } }));
  },
  toggleLike(id: string) {
    set((s) => ({ ...s, liked: { ...s.liked, [id]: !s.liked[id] } }));
  },
  joinGather(gatherId: string, cost: number = LEAF_COST) {
    if (state.joinedGather[gatherId]) return { ok: true, alreadyJoined: true };
    // 호스트(=내가 만든 게더링)는 참여 신청 불가 — 슬롯에 이미 포함됨
    const allGathers = [...state.userGathers, ...GATHERS];
    const g = allGathers.find((x) => x.id === gatherId);
    // 호스트 본인 차단 — userId가 있으면 안정된 식별자로 비교 (닉네임 변경에도 견고)
    const isHost = g && (
      (g.host.userId && currentUserId && g.host.userId === currentUserId) ||
      (!g.host.userId && g.host.nick === state.myProfile.nickname)
    );
    if (isHost) {
      return { ok: true, alreadyJoined: true };
    }
    if (state.leafBalance < cost) {
      previewActions.openPaywall(cost, '게더링 참여에는 리프가 필요해요');
      return { ok: false, reason: '리프가 부족해요' };
    }
    set((s) => {
      const me = myPhoto(s);  // undefined일 수 있음 — SlotDot/Avatar가 플레이스홀더 처리
      // 본인 성별 슬롯 첫 빈자리에 사진 채움 — 다른 사람도 매칭 현황에서 보이도록 영속.
      // (userGathers의 경우만 가능. 시드 GATHERS는 import 불변 객체.)
      let nextUserGathers = s.userGathers;
      if (g) {
        const isUserGather = s.userGathers.some((x) => x.id === gatherId);
        if (isUserGather) {
          nextUserGathers = s.userGathers.map((ug) => {
            if (ug.id !== gatherId) return ug;
            const M = [...ug.slots.M];
            const F = [...ug.slots.F];
            const slot = me ? { filled: true as const, photo: me } : { filled: true as const };
            if (s.myProfile.gender === 'M') {
              const mi = M.findIndex((x) => !x.filled);
              if (mi >= 0) M[mi] = slot;
            } else {
              const fi = F.findIndex((x) => !x.filled);
              if (fi >= 0) F[fi] = slot;
            }
            return { ...ug, slots: { M, F } };
          });
        }
      }
      const next: State = {
        ...s,
        leafBalance: s.leafBalance - cost,
        joinedGather: { ...s.joinedGather, [gatherId]: true },
        userGathers: nextUserGathers,
        toast: '게더링 참여 신청 완료 · 채팅방이 열렸어요',
      };
      if (g) {
        const existing = s.chatRooms.find((r) => r.id === gatherId);
        if (existing) {
          // 멤버 목록에 내 사진 추가 (사진 없으면 멤버 스트립에 추가하지 않음 — 슬롯에선 플레이스홀더 표시)
          const mems = [...(existing.members ?? [])];
          if (me && !mems.includes(me)) mems.push(me);
          const filled = countFilled(g) + 1;  // 본인 추가
          const total = g.slots.M.length + g.slots.F.length;
          next.chatRooms = s.chatRooms.map((r) =>
            r.id === gatherId
              ? { ...r, members: mems, count: `${filled}/${total}`, locked: filled < total, lastBody: '회원님이 입장했어요', lastTime: '방금' }
              : r,
          );
        } else {
          // 게더링 채팅방 신규 생성
          const hostPhoto = g.host.photo ?? gatherHostPhoto(g);
          const otherMembers = collectGatherMemberPhotos(g);
          const allMembers = [hostPhoto, ...otherMembers, me].filter(Boolean) as (string | number)[];
          const filled = countFilled(g) + 1;
          const total = g.slots.M.length + g.slots.F.length;
          const newRoom: ChatRoom = {
            id: gatherId,
            kind: 'gather',
            peerName: `${g.title} ${g.ratio}`,
            peerPhoto: hostPhoto,
            members: allMembers,
            count: `${filled}/${total}`,
            locked: filled < total,
            lastBody: '회원님이 입장했어요',
            lastTime: '방금',
            unread: 0,
          };
          next.chatRooms = [newRoom, ...s.chatRooms];
        }
      }
      return next;
    });
    setTimeout(() => set((s) => ({ ...s, toast: null })), 2200);
    return { ok: true };
  },
  toggleFollow(nick: string) {
    set((s) => ({ ...s, followed: { ...s.followed, [nick]: !s.followed[nick] } }));
  },
  sendChat(roomKey: string, body: string) {
    const text = body.trim();
    if (!text) return;
    const t = nowTime();
    const msg: ChatBubble = {
      id: `m_${Date.now()}`,
      me: true,
      body: text,
      time: t,
      read: false,
    };
    set((s) => ({
      ...s,
      feedMessages: {
        ...s.feedMessages,
        [roomKey]: [...(s.feedMessages[roomKey] ?? []), msg],
      },
      // 채팅방 리스트의 last message + time 갱신
      chatRooms: s.chatRooms.map((r) =>
        r.id === roomKey ? { ...r, lastBody: text, lastTime: '방금', unread: 0 } : r,
      ),
    }));
  },
  // 연결 신청 시 호출 — 해당 user의 DM 방이 있으면 그대로, 없으면 생성
  ensureDmRoom(u: FeedUser): string {
    const existing = state.chatRooms.find((r) => r.kind === 'dm' && r.peerName === u.nick);
    if (existing) {
      // 매칭 완료 마킹 + lastBody 갱신
      set((s) => ({
        ...s,
        chatRooms: s.chatRooms.map((r) =>
          r.id === existing.id ? { ...r, request: false, online: u.online, lastBody: '매칭됐어요 — 먼저 인사를 건네보세요', lastTime: '방금' } : r,
        ),
      }));
      return existing.id;
    }
    const newRoom: ChatRoom = {
      id: `c_${Date.now()}`,
      kind: 'dm',
      peerName: u.nick,
      peerPhoto: u.photos[0],
      online: u.online,
      lastBody: '매칭됐어요 — 먼저 인사를 건네보세요',
      lastTime: '방금',
      unread: 0,
    };
    set((s) => ({ ...s, chatRooms: [newRoom, ...s.chatRooms] }));
    return newRoom.id;
  },
  openChatRoom(roomId: string) {
    // 진입 시 unread 0으로 마킹 + 마지막 읽음 시각 기록 (tab badge 계산용)
    const now = new Date().toISOString();
    set((s) => ({
      ...s,
      chatRooms: s.chatRooms.map((r) => (r.id === roomId ? { ...r, unread: 0 } : r)),
      roomLastRead: { ...s.roomLastRead, [roomId]: now },
    }));
  },
  createGather(args: {
    title: string;
    cat: string;
    ratio: string;
    place: string;
    whenText: string;
    desc: string;
  }) {
    // 'N:M' 성비 파싱 (최대 16:16)
    const [mN, fN] = args.ratio.split(':').map((v) => Math.max(1, parseInt(v, 10) || 2));
    const slotCfg = { M: mN, F: fN ?? mN };
    const me = state.myProfile;
    const meP = myPhoto(state);  // undefined 가능
    // 호스트(=본인) 자리. 사진이 있으면 같이 채움, 없으면 SlotDot이 플레이스홀더 표시
    const M: { filled: boolean; host?: boolean; photo?: string | number }[] =
      Array.from({ length: slotCfg.M }, () => ({ filled: false }));
    const F: { filled: boolean; host?: boolean; photo?: string | number }[] =
      Array.from({ length: slotCfg.F }, () => ({ filled: false }));
    const hostSlot = meP
      ? { filled: true, host: true, photo: meP }
      : { filled: true, host: true };
    if (me.gender === 'M') M[0] = hostSlot;
    else F[0] = hostSlot;
    const id = `g_${Date.now()}`;
    const cover = CAT_COVER[args.cat] ?? DEFAULT_COVER;
    const newGather: Gather = {
      id,
      cat: args.cat,
      cover,
      title: args.title,
      host: { nick: me.nickname, photo: meP as any, age: me.age, gender: me.gender, userId: currentUserId ?? undefined },
      when: args.whenText,
      whenTime: '',
      whenRel: '곧',
      place: args.place,
      placeDetail: `${args.place} · 매칭 후 공개`,
      ratio: args.ratio,
      slots: { M, F },
      leafs: 30,
      hot: false,
      age: `${Math.max(19, me.age - 3)}~${me.age + 3}`,
      tags: [`#${args.cat}`, `#${args.place}`],
      desc: args.desc,
    };
    // 호스트는 별도 joinedGather 마킹 없이 슬롯에 이미 자리잡음.
    // 그룹 채팅방을 동시 생성 — 호스트(나) 단일 멤버로 시작.
    const total = slotCfg.M + slotCfg.F;
    const newRoom: ChatRoom = {
      id,
      kind: 'gather',
      peerName: `${args.title} ${args.ratio}`,
      peerPhoto: meP,  // undefined면 Avatar가 빈 원으로 렌더
      members: meP ? [meP] : [],
      count: `1/${total}`,
      locked: true,
      lastBody: '회원님이 호스트로 모집을 시작했어요',
      lastTime: '방금',
      unread: 0,
    };
    set((s) => ({
      ...s,
      userGathers: [newGather, ...s.userGathers],
      chatRooms: [newRoom, ...s.chatRooms],
      toast: '게더링이 만들어졌어요 · 채팅방이 열렸어요',
    }));
    setTimeout(() => set((s) => ({ ...s, toast: null })), 2000);
    return newGather;
  },
  addLoungePost(args: { cat: Exclude<LoungeCat, 'all'>; title: string; body: string }) {
    // 익명 게시 — UI 표시도 "익명". 짧은 식별자로 같은 사용자 글 구분
    const anonId = Math.random().toString(36).slice(2, 6).toUpperCase();
    const p: LoungePost = {
      id: `p_${Date.now()}`,
      cat: args.cat,
      nick: `익명#${anonId}`,
      tag: '익명',
      title: args.title,
      body: args.body,
      likes: 0,
      comments: 0,
      time: '방금',
    };
    set((s) => ({ ...s, userPosts: [p, ...s.userPosts] }));
    return p;
  },
  // 모임 — 친구 찾기 글 (실명/닉네임 공개, 사진 포함, 라운지와 분리)
  addSocialPost(args: { title: string; about: string; looking: string; flex: string; photo?: string }) {
    const me = state.myProfile;
    const sp: SocialPost = {
      id: `sp_${Date.now()}`,
      authorNick: me.nickname,
      authorPhoto: me.photo,
      title: args.title,
      about: args.about,
      looking: args.looking,
      flex: args.flex,
      photo: args.photo,
      time: '방금',
      likes: 0,
    };
    set((s) => ({ ...s, userSocialPosts: [sp, ...s.userSocialPosts] }));
    return sp;
  },
  // 라운지 댓글은 무료. 욕설/비속어는 *** 마스킹. 본인 익명 닉 영속 + mine 플래그.
  addComment(postId: string, body: string) {
    const text = censorText(body.trim()).text;
    if (!text) return { ok: false, reason: '내용을 입력해 주세요' };
    const ADJ = ['산뜻한','느긋한','호기심많은','용감한','조용한','싱그러운','반짝이는','다정한','당찬','신난'];
    const ANIM = ['고양이','펭귄','수달','토끼','여우','늑대','코끼리','부엉이','너구리','다람쥐','곰','사슴'];
    const existingNick = state.myProfile.anonNickname?.trim();
    const nick = existingNick || (
      ADJ[Math.floor(Math.random()*ADJ.length)] + ANIM[Math.floor(Math.random()*ANIM.length)]
    );
    const c: CommentRow = {
      id: `c_${Date.now()}`,
      nick,
      body: text,
      time: '방금',
      likes: 0,
      mine: true,
    };
    set((s) => ({
      ...s,
      myProfile: existingNick ? s.myProfile : { ...s.myProfile, anonNickname: nick },
      comments: { ...s.comments, [postId]: [c, ...(s.comments[postId] ?? [])] },
      toast: '댓글 등록 완료',
    }));
    setTimeout(() => set((s) => ({ ...s, toast: null })), 1500);
    return { ok: true };
  },
  // 본인 댓글 수정 (욕설 마스킹 동일 적용)
  editComment(postId: string, commentId: string, body: string) {
    const text = censorText(body.trim()).text;
    if (!text) return { ok: false, reason: '내용을 입력해 주세요' };
    set((s) => ({
      ...s,
      comments: {
        ...s.comments,
        // comments[postId]는 본인이 작성한 댓글만 보관 → id 일치 시 수정 허용
        [postId]: (s.comments[postId] ?? []).map((c) =>
          c.id === commentId ? { ...c, body: text, time: '방금 (수정됨)' } : c,
        ),
      },
      toast: '댓글이 수정됐어요',
    }));
    setTimeout(() => set((s) => ({ ...s, toast: null })), 1500);
    return { ok: true };
  },
  // 본인 댓글 삭제
  deleteComment(postId: string, commentId: string) {
    set((s) => ({
      ...s,
      comments: {
        ...s.comments,
        [postId]: (s.comments[postId] ?? []).filter((c) => c.id !== commentId),
      },
      toast: '댓글이 삭제됐어요',
    }));
    setTimeout(() => set((s) => ({ ...s, toast: null })), 1500);
  },
  toggleReplyLike(postId: string, commentIdx: number, replyIdx: number) {
    const key = `${postId}_${commentIdx}_${replyIdx}`;
    set((s) => ({
      ...s,
      replyLikes: { ...(s.replyLikes ?? {}), [key]: !((s.replyLikes ?? {})[key]) },
    }));
  },
  toggleLoungeLike(postId: string) {
    const liked = !!state.liked[postId];
    set((s) => ({
      ...s,
      liked: { ...s.liked, [postId]: !liked },
      loungeLikes: { ...s.loungeLikes, [postId]: (s.loungeLikes[postId] ?? 0) + (liked ? -1 : 1) },
    }));
  },
  chargeLeaf(amount: number) {
    if (amount <= 0) return;
    set((s) => ({ ...s, leafBalance: s.leafBalance + amount, toast: `리프 ${amount} 충전 완료` }));
    setTimeout(() => set((s) => ({ ...s, toast: null })), 2000);
  },
  // 포인트 환급(로컬) — 서버 실패 시 spendPoints 로컬 차감 롤백용
  chargePoints(amount: number) {
    if (amount <= 0) return;
    set((s) => ({ ...s, points: s.points + amount, toast: `포인트 ${amount} 환급` }));
    setTimeout(() => set((s) => ({ ...s, toast: null })), 2000);
  },
  // 리프 차감 + paywall 체크. 성공 시 true, 부족 시 paywall 열고 false.
  spendLeaf(amount: number, reason: string, toastLabel?: string): boolean {
    if (amount <= 0) return true;
    if (state.leafBalance < amount) {
      previewActions.openPaywall(amount, reason);
      return false;
    }
    set((s) => ({
      ...s,
      leafBalance: s.leafBalance - amount,
      toast: toastLabel ?? `리프 ${amount} 사용`,
    }));
    setTimeout(() => set((s) => ({ ...s, toast: null })), 1800);
    return true;
  },
  // 포인트 차감(클라이언트 반영) — 서버 RPC 성공 후 호출하거나 PREVIEW에서 단독 사용.
  spendPoints(amount: number, toastLabel?: string): boolean {
    if (amount <= 0) return true;
    if (state.points < amount) return false;
    set((s) => ({ ...s, points: s.points - amount, toast: toastLabel ?? `포인트 ${amount} 사용` }));
    setTimeout(() => set((s) => ({ ...s, toast: null })), 1800);
    return true;
  },
  // 서버 차감(RPC) 결과로 잔액 동기화 — useSpendCurrency 성공 시 호출.
  setBalances(b: { leaf?: number; points?: number }) {
    set((s) => ({ ...s, leafBalance: b.leaf ?? s.leafBalance, points: b.points ?? s.points }));
  },
  // 오늘 운세 카드를 깠음을 기록(당일 유지). key = `${날짜}|${카테고리}`
  markFortuneRevealed(key: string) {
    set((s) => ({ ...s, fortuneRevealed: { ...s.fortuneRevealed, [key]: true } }));
  },
  // 일반 토스트 표시 — 짧은 액션 피드백 (1.6초 후 자동 제거)
  showToast(message: string, durationMs: number = 1600) {
    set((s) => ({ ...s, toast: message }));
    setTimeout(() => set((s) => (s.toast === message ? { ...s, toast: null } : s)), durationMs);
  },
  openReport(target: State['reportSheetTarget']) {
    set((s) => ({ ...s, reportSheetTarget: target }));
  },
  openPaywall(needed: number, reason: string) {
    set((s) => ({ ...s, paywall: { open: true, needed, reason } }));
  },
  closePaywall() {
    set((s) => ({ ...s, paywall: null }));
  },
  // 전역 Paywall에서 "충전하러 가기" → 충전 화면 이동 인텐트 (app/index.tsx useEffect가 소비)
  requestCharge() {
    set((s) => ({ ...s, paywall: null, pendingCharge: true }));
  },
  clearPendingCharge() {
    set((s) => ({ ...s, pendingCharge: false }));
  },
  markAllNotifsRead() {
    set((s) => ({
      ...s,
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },
  markNotifRead(id: string) {
    set((s) => {
      const next = s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
      return { ...s, notifications: next, unreadCount: next.filter((n) => !n.read).length };
    });
  },
  pushNotif(n: Omit<Notif, 'id' | 'read' | 'time'>) {
    const item: Notif = { ...n, id: `n_${Date.now()}`, read: false, time: '방금' };
    set((s) => ({
      ...s,
      notifications: [item, ...s.notifications],
      unreadCount: s.unreadCount + 1,
    }));
  },
  setSearch(q: string) {
    set((s) => ({ ...s, searchQuery: q }));
  },
  // 세션 변경(로그인/로그아웃/계정 전환) 시 호출 — 사용자별 스토리지 슬롯을 swap
  setActiveUser(userId: string | null) {
    if (currentUserId === userId) return;
    const wasAnon = currentUserId === null;
    // 이전 사용자의 미저장 변경분을 디스크에 기록
    persistFor(currentUserId, state);
    if (userId == null) {
      // 로그아웃 — 활성 사용자 해제 + 메모리 state 초기화.
      // (직전 사용자 데이터는 위 persistFor로 이미 본인 슬롯에 저장됨 → 동일 계정 재로그인 시 디스크에서 복원)
      // 메모리를 비우지 않으면 다음 계정 로그인이 wasAnon 분기로 오인되어
      // 이전 사용자의 프로필이 새 계정 슬롯으로 유출된다 (cross-user PII leak).
      currentUserId = null;
      state = { ...initial };
      return;
    }
    currentUserId = userId;
    const loaded = loadPersistedFor(userId);
    if (loaded) {
      state = { ...initial, ...loaded, signedOut: false };
    } else if (wasAnon) {
      // 첫 로그인 — 익명 상태에서 만든 데이터(글/사진/잔액 등)를 본인 슬롯으로 이관
      state = { ...state, signedOut: false };
      persistFor(userId, state);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(ANON_KEY);
        }
      } catch { /* ignore */ }
    } else {
      state = { ...initial, signedOut: false };
    }
    listeners.forEach((l) => l());
  },
  // 로그아웃 — 본인 데이터는 보존, 세션만 종료. 동일 계정 재로그인 시 setActiveUser가 복원.
  signOutPreview() {
    persistFor(currentUserId, state);
    set((s) => ({ ...s, signedOut: true, toast: '로그아웃됐어요' }));
    setTimeout(() => set((s) => ({ ...s, toast: null })), 1500);
  },
  // 계정 삭제 — 본인 스토리지 슬롯을 영구 제거 + 초기 상태로 reset
  deleteAccountPreview() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(storageKeyFor(currentUserId));
      }
    } catch { /* ignore */ }
    state = {
      ...initial,
      myProfile: { ...initial.myProfile, onboarded: false },
      signedOut: true,
      toast: '계정이 삭제됐어요',
    };
    listeners.forEach((l) => l());
    setTimeout(() => set((s) => ({ ...s, toast: null })), 1500);
  },
  resetSession() {
    set((s) => ({ ...s, signedOut: false }));
  },
  updateMyProfile(patch: Partial<MyProfile>) {
    set((s) => ({ ...s, myProfile: { ...s.myProfile, ...patch }, toast: '프로필이 저장됐어요' }));
    setTimeout(() => set((s) => ({ ...s, toast: null })), 1500);
  },
  // 가입 직후 생년월일 + 성별 등록 (onboarded=true)
  // 로그인 직후 서버 users 행을 로컬 myProfile로 hydrate.
  // 로컬이 비어있을 때만 채운다(로컬 편집을 덮어쓰지 않음). leaf_balance는 서버가 진실.
  hydrateFromServer(row: {
    nickname?: string | null; age?: number | null; region?: string | null;
    headline?: string | null; bio?: string | null; gender?: string | null; phone?: string | null;
    kakao_id?: string | null;
    birth_year?: number | null; birth_month?: number | null; birth_day?: number | null;
    leaf_balance?: number | null; points?: number | null; store_spend_total?: number | null;
    age_locked?: boolean | null;
    photos?: string[] | null; group_photo?: string | null; mbti?: string | null; height?: number | null;
    smoking?: string | null; drinking?: string | null;
    intro_want?: string | null; intro_interest?: string | null; intro_hobby?: string | null;
    job?: string | null; religion?: string | null; politics?: string | null;
    politics_public?: boolean | null; extra_answers?: { q: string; a: string }[] | null;
    education?: string | null;
    affinity_mute_notifs?: boolean | null; affinity_hidden?: boolean | null;
    affinity_deck_paused?: boolean | null;
    affinity_suspended?: boolean | null; affinity_suspended_reason?: string | null; affinity_review_requested_at?: string | null;
    profile_completed?: boolean | null;
  } | null) {
    if (!row) return;
    set((s) => {
      const mp = s.myProfile;
      const next = { ...mp };
      // 프로필 값은 서버(users)가 단일 진실원천 — 서버에 값이 있으면 항상 그것을 쓴다.
      // 예전엔 "로컬이 비어있을 때만" 채웠는데, 그러면 다른 기기/웹에서 수정한 내용이
      // 이 기기에 영원히 반영되지 않는다(성별 버그와 같은 계열). 화면 입력값은 각 화면이
      // 자체 useState로 들고 있어 타이핑 도중 덮어써질 위험은 없다.
      if (row.nickname?.trim()) next.nickname = row.nickname;
      if (row.region?.trim()) next.region = row.region;
      if (row.headline?.trim()) next.headline = row.headline;
      if (row.bio?.trim()) next.bio = row.bio;
      // ⚠️ 성별·나이·생년월일·연락처는 서버가 잠근 불변값(0006/0032/0078)이라 서버가 항상 이긴다.
      //    예전엔 `!mp.gender` 가드를 뒀는데 로컬 기본값이 'M'(truthy)이라 이 조건이 영원히
      //    거짓 → 여성 사용자도 로컬이 초기화되면 계속 '남성'으로 보이던 버그의 원인이었다.
      if (row.gender === 'M' || row.gender === 'F') {
        next.gender = row.gender;
        next.genderLocked = true;
      } else {
        next.genderLocked = false;   // 서버 미확정 — 프로필에서 아직 지정할 수 있다
      }
      if (row.age) next.age = row.age;
      if (row.phone) next.phone = row.phone;
      if (row.kakao_id) next.kakaoId = row.kakao_id;
      if (row.birth_year) next.birthYear = row.birth_year ?? undefined;
      if (row.birth_month) next.birthMonth = row.birth_month ?? undefined;
      if (row.birth_day) next.birthDay = row.birth_day ?? undefined;
      // 0018 프로필 확장 — 로컬이 비어있을 때만 서버값으로 채움
      // 단, 사진은 서버(users.photos)가 단일 진실원천 — 어디서나 동일하게 보이도록 항상 덮어씀
      if (row.photos && row.photos.length) {
        next.photos = row.photos;
        next.photo = row.photos[0];
      }
      // 모임 대표사진(0124) — 인연 photos와 독립. 서버가 진실원천.
      if (row.group_photo !== undefined) next.groupPhoto = row.group_photo ?? undefined;
      if (row.mbti) next.mbti = row.mbti;
      if (row.height) next.height = row.height ?? undefined;
      if (row.smoking) next.smoking = row.smoking;
      if (row.drinking) next.drinking = row.drinking;
      if (row.intro_want) next.introWant = row.intro_want;
      if (row.intro_interest) next.introInterest = row.intro_interest;
      if (row.intro_hobby) next.introHobby = row.intro_hobby;
      // 0107 위저드 필드 — 서버가 진실원천
      if (row.job) next.job = row.job;
      if (row.religion) next.religion = row.religion;
      if (row.politics) next.politics = row.politics;
      if (row.politics_public != null) next.politicsPublic = row.politics_public;
      if (row.extra_answers && Array.isArray(row.extra_answers)) next.extraAnswers = row.extra_answers;
      if (row.education) next.education = row.education;  // 0148 학력
      // 0108 쉬어가기 토글 — 서버가 진실원천(false도 반영해야 하므로 != null 체크)
      if (row.affinity_mute_notifs != null) next.affinityMuteNotifs = row.affinity_mute_notifs;
      if (row.affinity_hidden != null) next.affinityHidden = row.affinity_hidden;
      if (row.affinity_deck_paused != null) next.affinityDeckPaused = row.affinity_deck_paused;
      if (row.affinity_suspended != null) next.affinitySuspended = row.affinity_suspended;
      next.affinitySuspendedReason = row.affinity_suspended_reason ?? null;
      next.affinityReviewRequestedAt = row.affinity_review_requested_at ?? null;
      if (row.profile_completed) next.profileCompleted = true;
      // 서버에서 age_locked=true면 온보딩 완료로 간주 (다른 기기/캐시 초기화 대응)
      if (row.age_locked) next.onboarded = true;
      const leaf = typeof row.leaf_balance === 'number' ? row.leaf_balance : s.leafBalance;
      const pts = typeof row.points === 'number' ? row.points : s.points;
      const spend = typeof row.store_spend_total === 'number' ? row.store_spend_total : s.storeSpendTotal;
      return { ...s, myProfile: next, leafBalance: leaf, points: pts, storeSpendTotal: spend };
    });
  },
  completeOnboarding(args: { year: number; month: number; day: number; gender: 'F' | 'M'; nickname?: string }) {
    const today = new Date();
    let age = today.getFullYear() - args.year;
    const m = today.getMonth() + 1 - args.month;
    if (m < 0 || (m === 0 && today.getDate() < args.day)) age--;
    set((s) => ({
      ...s,
      myProfile: {
        ...s.myProfile,
        ...(args.nickname ? { nickname: args.nickname } : {}),
        age,
        gender: args.gender,
        genderLocked: true,
        birthYear: args.year,
        birthMonth: args.month,
        birthDay: args.day,
        onboarded: true,
      },
    }));
  },
  // 리프 사용 확인 모달 — 사용자에게 한 번 더 묻고 진행.
  // 잔액 부족이면 confirm 안 띄우고 바로 paywall.
  requestSpend(args: {
    amount: number;
    title: string;
    body: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }) {
    if (state.leafBalance < args.amount) {
      previewActions.openPaywall(args.amount, args.body);
      return;
    }
    set((s) => ({ ...s, confirmSpend: { open: true, ...args } }));
  },
  closeConfirmSpend() {
    set((s) => ({ ...s, confirmSpend: null }));
  },
  // 리프/포인트 중 선택해서 사용 — 모임 참여·오늘의 친구 연결 등.
  requestCurrencyChoice(args: {
    amount: number;
    title: string;
    body: string;
    onPick: (currency: 'leaf' | 'point') => void;
  }) {
    set((s) => ({ ...s, currencyChoice: { open: true, ...args } }));
  },
  closeCurrencyChoice() {
    set((s) => ({ ...s, currencyChoice: null }));
  },
  // 로그인 유도 모달 열기/닫기 (게스트가 보호 기능 사용 시)
  requireLogin(reason?: string) {
    set((s) => ({ ...s, authPrompt: { reason } }));
  },
  closeAuthPrompt() {
    set((s) => ({ ...s, authPrompt: null }));
  },
  // 인연 액션 게이트 — 프로필(사진·소개) 완성 전엔 관심 보내기 등 액션 불가.
  // 완성됐으면 true, 아니면 완성 유도 프롬프트를 띄우고 false.
  requireCompleteProfile(reason?: string): boolean {
    if (state.myProfile.profileCompleted) return true;
    set((s) => ({ ...s, profileGate: { reason } }));
    return false;
  },
  closeProfileGate() {
    set((s) => ({ ...s, profileGate: null }));
  },
  // (submitReport 제거됨 — ReportSheet가 실제 백엔드 reportContent를 직접 호출)
};

// 무한 렌더링 방지 — 빈 배열을 상수로 캐시 (useSyncExternalStore의 Object.is 비교 통과)
const EMPTY_MSGS: ChatBubble[] = [];
const EMPTY_COMMENTS: CommentRow[] = [];

export const previewSelectors = {
  isUnlocked: (id: string) => (s: State) => !!s.unlocked[id],
  leafBalance: (s: State) => s.leafBalance,
  points: (s: State) => s.points,
  storeSpendTotal: (s: State) => s.storeSpendTotal,
  tier: (s: State) => tierOf(s.storeSpendTotal),
  isFortuneRevealed: (key: string) => (s: State) => !!s.fortuneRevealed[key],
  isBookmarked: (id: string) => (s: State) => !!s.bookmarked[id],
  isLiked: (id: string) => (s: State) => !!s.liked[id],
  isJoined: (id: string) => (s: State) => !!s.joinedGather[id],
  isFollowed: (nick: string) => (s: State) => !!s.followed[nick],
  messages: (key: string) => (s: State) => s.feedMessages[key] ?? EMPTY_MSGS,
  comments: (postId: string) => (s: State) => s.comments[postId] ?? EMPTY_COMMENTS,
  loungeLikeDelta: (postId: string) => (s: State) => s.loungeLikes[postId] ?? 0,
  reportTarget: (s: State) => s.reportSheetTarget,
  toast: (s: State) => s.toast,
  paywall: (s: State) => s.paywall,
  pendingCharge: (s: State) => s.pendingCharge,
  confirmSpend: (s: State) => s.confirmSpend,
  currencyChoice: (s: State) => s.currencyChoice,
  notifications: (s: State) => s.notifications,
  unreadCount: (s: State) => s.unreadCount,
  searchQuery: (s: State) => s.searchQuery,
  chatRooms: (s: State) => s.chatRooms,
  chatRoomById: (id: string) => (s: State) => s.chatRooms.find((r) => r.id === id),
  userPosts: (s: State) => s.userPosts,
  userSocialPosts: (s: State) => s.userSocialPosts,
  userGathers: (s: State) => s.userGathers,
  signedOut: (s: State) => s.signedOut,
  authPrompt: (s: State) => s.authPrompt,
  profileGate: (s: State) => s.profileGate,
  myProfile: (s: State) => s.myProfile,
  // 전체 replyLikes map을 반환 — useSyncExternalStore가 ref equality로 비교하므로
  // 새 객체 만들지 않고 그대로 반환. 컴포넌트에서 키 lookup.
  replyLikes: (s: State) => s.replyLikes,
  roomLastRead: (s: State) => s.roomLastRead,
};

// Re-export for convenience
export type { State as PreviewState };
export { FEED, GATHERS, LOUNGE_POSTS };
export type { FeedUser, Gather, LoungePost, LoungeCat };
