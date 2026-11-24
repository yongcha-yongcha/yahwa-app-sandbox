// 야화 — Mock feed (ported from project/야화/tokens.jsx FEED)
const U = (id: string, w = 700, h = 900) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export type FeedUser = {
  id: string;
  nick: string;
  age: number;
  gender: 'F' | 'M';
  region: string;
  headline: string;
  photos: (string | number)[];  // 로컬 require() 또는 원격 URL
  bio: string;
  leafs: number;
  locked: boolean;
  online: boolean;
  distance: string;
  tags: string[];
};

export type LoungeCat = 'all' | 'free' | 'love' | 'qna' | 'meet' | 'food';
export const LOUNGE_CATS: { k: LoungeCat; l: string }[] = [
  { k: 'all', l: '전체' },
  { k: 'free', l: '일상' },
  { k: 'love', l: '연애' },
  { k: 'qna', l: '질문' },
  { k: 'meet', l: '모임' },
  { k: 'food', l: '맛집' },
];

export type LoungePost = {
  id: string;
  cat: Exclude<LoungeCat, 'all'>;
  nick: string;
  tag: string;
  title: string;
  body: string;
  likes: number;
  comments: number;
  time: string;
  author_gender?: 'M' | 'F' | null;
  authorId?: string;  // 신고/차단 대상 지정용 (서버 데이터에만 존재)
  createdAt?: string; // 서버 작성 시각(ISO) — 커뮤니티 상대시간 표기용
  attachments?: string[];  // 게시물 이미지 URL — 첫 장이 목록 썸네일
  audioUrl?: string | null;      // 음성 메시지 URL (0101)
  audioDuration?: number | null; // 음성 길이(초)
};

export const LOUNGE_POSTS: LoungePost[] = [
  { id: 'p01', cat: 'love', nick: '몽글몽글토끼', tag: '익명', title: '소개팅 3번째인데 다음에 또 보자고 하는게 맞을까요?', body: '카톡은 매일 하는데 만나서는 좀 어색해요. 그래도 또 보자고 하더라고요…', likes: 24, comments: 18, time: '12분 전' },
  { id: 'p02', cat: 'meet', nick: '산뜻한고양이', tag: '익명', title: '성수동에서 일요일 브런치 같이 가실 분', body: '에그타르트 새로 생겼다는 곳 가보고 싶어요. 1-2명 더 모집!', likes: 8, comments: 6, time: '25분 전' },
  { id: 'p03', cat: 'qna', nick: '호기심많은펭귄', tag: '익명', title: '야화 잠금 해제하면 상대방이 알아요?', body: '얼굴 보려고 잠금 해제 누르면 상대방한테 알람 가는 건가요?', likes: 42, comments: 31, time: '1시간 전' },
  { id: 'p04', cat: 'free', nick: '느긋한코끼리', tag: '익명', title: '오늘 비 와서 그런가 감성 폭발', body: '창문 열어두고 LP 듣는 중. 다들 뭐하세요?', likes: 15, comments: 12, time: '2시간 전' },
  { id: 'p05', cat: 'food', nick: '먹스타그램', tag: '익명', title: '망원동 와인바 추천 받습니다', body: '가성비 좋고 분위기 있는 곳 알려주세요. 이번 주말에 가려고요.', likes: 31, comments: 22, time: '3시간 전' },
];

export type Store = {
  id: string;
  name: string;
  cat: string;
  region: string;
  distance: string;
  here: number;
  max: number;
  charge: number;
  dc: number;
  hot: boolean;
  address?: string | null;
  phone?: string | null;
  lat?: number;
  lng?: number;
  imageUrls?: string[];  // admin이 업로드한 매장 대표 이미지 (최대 5장)
  waitingCount?: number;     // 현재 웨이팅 팀 수 (CRM 캐시)
  waitingEtaMinutes?: number | null;  // 예상 대기시간(분, CRM 캐시)
  intro?: string | null;  // 사장님이 쓰는 매장 한줄 소개 (0038)
  waitingEnabled?: boolean;  // 웨이팅 등록 가능 매장
  waitingSlug?: string | null;  // 태그히어 원격 웨이팅 슬러그 (0063)
  seatCapacity?: number | null;  // 총 좌석수 = 태그히어 테이블 링크 개수 (0068)
};

// ── 게더링 ─────────────────────────────────────────────────────────────────
import { demo1, demo2, demo3, demo4, demo5 } from './assets';

export type GatherSlot = { filled: boolean; photo?: string | number; host?: boolean; name?: string; gender?: 'M' | 'F' | null };
export type GatherHost = { nick: string; photo: string | null; age: number; gender: 'F' | 'M'; userId?: string };
export type Gather = {
  id: string;
  cat: string;
  cover: string;
  title: string;
  host: GatherHost;
  when: string;
  whenTime: string;
  whenRel: string;
  place: string;
  placeDetail: string;
  ratio: string;  // 'N:M' 성비 (최대 16:16)
  slots: { M: GatherSlot[]; F: GatherSlot[] };
  leafs: number;
  hot: boolean;
  age: string;
  tags: string[];
  desc: string;
  // 성별 모드: 'any'(성별 무관, capacity 정원) / 'split'(성비). 미설정 시 split.
  genderMode?: 'any' | 'split';
  capacity?: number;  // genderMode='any'일 때 총 정원 (1:1=2)
  // 호스트가 설정한 실제 참가비(원) — 0(미설정)이면 앱 기본 리프/포인트 100 참여비 적용.
  fee?: number;
  feeDesc?: string;
  // 서버 타임스탬프 — 카드 뱃지(신규오픈/마감임박) 계산용. 서버 데이터에만 존재.
  createdAt?: string;
  startAt?: string | null;
  // 모임 상세 상단 갤러리용 업로드 이미지 (첫 장이 대표=cover)
  photos?: string[];
  // 서버 상태 — 'recruiting' | 'matched' 등. matched는 목록에 '매칭 완료'로 노출.
  status?: string;
  // 생성 시 선택한 "시도/구" — 모임 홈 지역 필터용.
  region?: string | null;
};

const Ug = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=70`;

// 미리보기 사용자(나)의 프로필 사진 — 게더링 슬롯에 채워질 때 사용
// 사용자 프로필 사진이 없을 때는 더 이상 unsplash 인물 사진으로 폴백하지 않음.
// SlotDot/Avatar 가 사진 없음 상태를 브랜드 플레이스홀더로 직접 처리.
export const ME_PHOTO: string | undefined = undefined;

// 카테고리별 커버 이미지 — 게더링 생성 시 자동 매칭
const CC = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=70`;
export const CAT_COVER: Record<string, string> = {
  '와인': CC('1510812431401-41d2bd2722f3'),
  '러닝': CC('1571008887538-b36bb32f4571'),
  '클럽': CC('1574391884720-bbc3740c59d1'),
  '보드게임': CC('1610890716171-6b1bb98ffd09'),
  '맛집': CC('1517248135467-4c7edcad34c4'),
  '재즈': CC('1415201364774-f6f0bb35f28f'),
  '카페': CC('1554118811-1e0d58224f24'),
  '테니스': CC('1622279457486-62dcc4a431d6'),
};
export const DEFAULT_COVER = CC('1517248135467-4c7edcad34c4');

export const GATHERS: Gather[] = [
  {
    id: 'g1', cat: '와인', cover: Ug('1510812431401-41d2bd2722f3'),
    title: '성수 와인바 가볍게 한 잔',
    host: { nick: '카리나무드', photo: null, age: 25, gender: 'F' },
    when: '금 5/9', whenTime: '저녁 7:30', whenRel: 'D-2',
    place: '성수동', placeDetail: '와인스트리트 일대 · 매칭 후 공개',
    ratio: '2:2',
    slots: { M: [{ filled: true }, { filled: false }], F: [{ filled: true, host: true, photo: demo1 }, { filled: false }] },
    leafs: 30, hot: true, age: '24~28', tags: ['#와인', '#성수', '#가볍게'],
    desc: '성수동 와인바 한 곳 정해서 가볍게 한 잔. 너무 진지하지 않게 편하게 얘기 나눠요.',
  },
  {
    id: 'g2', cat: '러닝', cover: Ug('1571008887538-b36bb32f4571'),
    title: '한강 러닝 + 브런치',
    host: { nick: '러닝메이트', photo: null, age: 30, gender: 'M' },
    when: '토 5/10', whenTime: '아침 7:00', whenRel: 'D-3',
    place: '반포 한강', placeDetail: '잠수교 북단 · 매칭 후 공개',
    ratio: '3:3',
    slots: { M: [{ filled: true, host: true }, { filled: true }, { filled: false }], F: [{ filled: true }, { filled: false }, { filled: false }] },
    leafs: 30, hot: false, age: '27~33', tags: ['#러닝', '#한강', '#브런치'],
    desc: "5km 가볍게 뛰고 카페에서 브런치. 페이스 5'30.",
  },
  {
    id: 'g3', cat: '클럽', cover: Ug('1574391884720-bbc3740c59d1'),
    title: '홍대 클럽 — 토요일 새벽',
    host: { nick: '위크엔드', photo: null, age: 27, gender: 'M' },
    when: '토 5/10', whenTime: '밤 11:00', whenRel: 'D-3',
    place: '홍대', placeDetail: '합정역 근처 · 매칭 후 공개',
    ratio: '4:4',
    slots: { M: [{ filled: true, host: true }, { filled: true }, { filled: true }, { filled: false }], F: [{ filled: true }, { filled: true }, { filled: false }, { filled: false }] },
    leafs: 30, hot: true, age: '25~30', tags: ['#클럽', '#홍대', '#불금'],
    desc: '홍대 클럽 한 군데 골라서 같이 입장. 술 한 잔씩 사주는 정도는 매너!',
  },
  {
    id: 'g4', cat: '보드게임', cover: Ug('1610890716171-6b1bb98ffd09'),
    title: '이태원 보드게임 카페',
    host: { nick: '젠가마스터', photo: null, age: 28, gender: 'M' },
    when: '일 5/11', whenTime: '오후 3:00', whenRel: 'D-4',
    place: '이태원', placeDetail: '경리단길 · 매칭 후 공개',
    ratio: '2:2',
    slots: { M: [{ filled: true, host: true }, { filled: false }], F: [{ filled: false }, { filled: false }] },
    leafs: 30, hot: false, age: '26~31', tags: ['#보드게임', '#이태원', '#가볍게'],
    desc: '카탄 / 코드네임 같이 할 분! 보드게임 처음이어도 환영.',
  },
  {
    id: 'g5', cat: '맛집', cover: Ug('1579871494447-9811cf80d66c'),
    title: '압구정 오마카세',
    host: { nick: '미식가지영', photo: null, age: 31, gender: 'F' },
    when: '토 5/17', whenTime: '저녁 6:30', whenRel: 'D-10',
    place: '압구정', placeDetail: '로데오 · 매칭 후 공개',
    ratio: '3:3',
    slots: { M: [{ filled: true }, { filled: false }, { filled: false }], F: [{ filled: true, host: true }, { filled: true }, { filled: false }] },
    leafs: 30, hot: true, age: '29~34', tags: ['#오마카세', '#압구정', '#맛집'],
    desc: '1인 12만원대 오마카세. 음식 좋아하시는 분, 진지하게 만남도 OK.',
  },
  {
    id: 'g6', cat: '재즈', cover: Ug('1415201364774-f6f0bb35f28f'),
    title: '을지로 LP바',
    host: { nick: '을지로무드', photo: null, age: 31, gender: 'F' },
    when: '금 5/16', whenTime: '밤 9:00', whenRel: 'D-9',
    place: '을지로', placeDetail: '노가리 골목 · 매칭 후 공개',
    ratio: '2:2',
    slots: { M: [{ filled: false }, { filled: false }], F: [{ filled: true, host: true }, { filled: false }] },
    leafs: 30, hot: false, age: '28~33', tags: ['#재즈', '#LP', '#을지로'],
    desc: 'LP바에서 재즈 듣고 가볍게 한 잔. 음악 좋아하시는 분 환영.',
  },
  {
    id: 'g7', cat: '카페', cover: Ug('1554118811-1e0d58224f24'),
    title: '연남 카페 투어 (낮)',
    host: { nick: '책방지기', photo: null, age: 28, gender: 'F' },
    when: '일 5/11', whenTime: '오후 1:00', whenRel: 'D-4',
    place: '연남', placeDetail: '연남동 일대 · 매칭 후 공개',
    ratio: '2:2',
    slots: { M: [{ filled: false }, { filled: false }], F: [{ filled: true, host: true }, { filled: true }] },
    leafs: 30, hot: false, age: '25~30', tags: ['#카페', '#연남', '#낮모임'],
    desc: '연남 카페 2-3곳 가볍게 도는 코스. 부담없이 만나요.',
  },
  {
    id: 'g8', cat: '테니스', cover: Ug('1622279457486-62dcc4a431d6'),
    title: '주말 테니스 복식',
    host: { nick: '백핸드장인', photo: null, age: 32, gender: 'M' },
    when: '토 5/24', whenTime: '아침 9:00', whenRel: 'D-17',
    place: '잠실', placeDetail: '올림픽공원 · 매칭 후 공개',
    ratio: '2:2',
    slots: { M: [{ filled: true, host: true }, { filled: false }], F: [{ filled: false }, { filled: false }] },
    leafs: 30, hot: false, age: '28~35', tags: ['#테니스', '#잠실', '#주말'],
    desc: '복식 게임 같이 칠 분. 초중급 환영. 코트비 분담.',
  },
];

export const CAT_BG: Record<string, [string, string]> = {
  '와인': ['#7A1F2E', '#3B0E18'],
  '러닝': ['#1F3B7A', '#0E1F3B'],
  '클럽': ['#3D1F7A', '#1A0E3B'],
  '보드게임': ['#D96A61', '#96261e'],
  '맛집': ['#1A1A1F', '#3F3F4A'],
  '재즈': ['#5C3A1E', '#1A0F08'],
  '카페': ['#F0D8A0', '#B89058'],
  '테니스': ['#2E5C1F', '#0F2A0E'],
};

export function fillCount(g: Gather) {
  const m = g.slots.M.filter((s) => s.filled).length;
  const f = g.slots.F.filter((s) => s.filled).length;
  return {
    m, f,
    mTot: g.slots.M.length,
    fTot: g.slots.F.length,
    cur: m + f,
    total: g.slots.M.length + g.slots.F.length,
  };
}

export const STORES: Store[] = [
  { id: 's01', name: '노들섬 와인바', cat: '와인바', region: '성수', distance: '320m', here: 8, max: 30, charge: 20000, dc: 15, hot: true },
  { id: 's02', name: '재즈클럽 미드나잇', cat: '재즈바', region: '한남', distance: '1.1km', here: 14, max: 40, charge: 30000, dc: 10, hot: true },
  { id: 's03', name: '연남 책방 키친', cat: '카페·책방', region: '연남', distance: '2.4km', here: 5, max: 20, charge: 10000, dc: 20, hot: false },
  { id: 's04', name: '을지로 노가리 골목', cat: '펍', region: '을지로', distance: '3.8km', here: 22, max: 50, charge: 15000, dc: 5, hot: true },
];

export const FEED: FeedUser[] = [
  {
    id: 'u01',
    nick: '카리나무드',
    age: 25,
    gender: 'F',
    region: '성수동',
    headline: '재즈바 같이 갈 분 찾아요',
    photos: [demo1, demo1, demo1],
    bio: '평일 저녁 성수동에서 재즈바 다녀요. 한 잔 같이 하면서 음악 얘기 해요. 너무 시끄러운 곳보다는 조용한 곳이 좋아요.',
    leafs: 30,
    locked: true,
    online: true,
    distance: '0.8km',
    tags: ['#재즈', '#성수', '#와인'],
  },
  {
    id: 'u02',
    nick: '러닝메이트',
    age: 30,
    gender: 'F',
    region: '한남동',
    headline: '주말 아침 한강 러닝 같이',
    photos: [demo5, demo5, demo5],
    bio: "주말 아침 한강 같이 뛰실 분! 페이스 5'30 정도. 끝나고 카페에서 브런치까지 자주 가요.",
    leafs: 30,
    locked: true,
    online: false,
    distance: '2.4km',
    tags: ['#러닝', '#한강', '#주말'],
  },
  {
    id: 'u03',
    nick: '책방지기',
    age: 28,
    gender: 'F',
    region: '연남동',
    headline: '독립서점 투어 같이 가요',
    photos: [demo2, demo2, demo2],
    bio: '서울 독립서점 다 가보는게 목표예요. 책 좋아하시는 분이면 좋고, 아니어도 환영! 카페 투어도 좋아해요.',
    leafs: 30,
    locked: true,
    online: true,
    distance: '3.1km',
    tags: ['#독서', '#연남', '#카페'],
  },
  {
    id: 'u04',
    nick: '홈쿠킹마스터',
    age: 29,
    gender: 'F',
    region: '망원동',
    headline: '집밥 만들어 같이 먹어요',
    photos: [demo4, demo4, demo4],
    bio: '요리하는 거 좋아해서 가끔 집에서 작은 디너 모임해요. 4-5명 정도가 딱 좋아요.',
    leafs: 30,
    locked: true,
    online: true,
    distance: '4.0km',
    tags: ['#홈쿠킹', '#망원', '#디너'],
  },
  {
    id: 'u05',
    nick: '영화광',
    age: 27,
    gender: 'F',
    region: '을지로',
    headline: '심야 영화 같이 보러',
    photos: [demo3, demo3, demo3],
    bio: '씨네큐브 자주 다녀요. 평일 심야 영화 같이 볼 분! 끝나고 가벼운 술 한 잔도 좋고요.',
    leafs: 30,
    locked: true,
    online: false,
    distance: '5.5km',
    tags: ['#영화', '#을지로', '#예술'],
  },
  {
    id: 'u06',
    nick: '을지로무드',
    age: 31,
    gender: 'F',
    region: '잠실',
    headline: '와인바 같이 갈 분',
    photos: [demo2, demo2, demo2],
    bio: '을지로/한남 와인바 자주 가요. 가벼운 모임 좋아하시는 분이면 환영. 너무 진지한 만남은 부담스러워요.',
    leafs: 30,
    locked: true,
    online: true,
    distance: '6.2km',
    tags: ['#와인', '#을지로', '#모임'],
  },
];
