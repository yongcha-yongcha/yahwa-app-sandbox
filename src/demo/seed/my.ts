// 야화 시연판 — MY · 지갑(리프/포인트) · 쿠폰함 · 플레이스(매장) · 모임/채팅 시드.
// 위쪽 '고치기 쉬운 내용'만 바꿔도 지도·매장 상세·쿠폰함·사용 내역에 그대로 보여요.
// 시드를 고친 뒤에는 시연도구의 '처음 상태로'를 눌러야 브라우저에 반영돼요.
//
// ⚠️ 시각은 db.ts의 daysAgo 등을 쓰지 않고 아래 ago()/later()로 만들어요.
//    시드는 db.ts가 처음 읽힐 때(시연 메타 meta보다 먼저) 만들어져서, 그 순간엔 db.ts의 now()를 부를 수 없어요.
import { ME_ID, type Row } from '../db';
import { person } from '../people';

// ── 고치기 쉬운 내용 ───────────────────────────────────────────

// 매장 id — 시나리오(rpc/my.ts)에서도 이 이름으로 불러요
export const STORE = {
  seongsu: 'store-seongsu',     // 야화 성수뚝섬점(혼술바)
  hapjeong: 'store-hapjeong',   // 야화 합정점(혼술바)
  gangnam: 'store-gangnam',     // 야화 강남역점(혼술바)
  konkuk: 'store-konkuk',       // 야화 건대입구점(혼술바)
  yeonnam: 'store-yeonnam',     // 연남 골목 이자카야(술집)
  euljiro: 'store-euljiro',     // 을지로 밤산책(술집)
  kitchen: 'store-kitchen',     // 성수 화덕 키친(음식점)
  cafe: 'store-cafe',           // 서울숲 오후의볕(카페)
  nail: 'store-nail',           // 성수 손끝 네일(뷰티)
  stay: 'store-stay',           // 익선 한옥 스테이(숙박)
} as const;

const IMG = {
  cafe: '/demo/community/cafe.jpg',
  food: '/demo/community/food.jpg',
  trip: '/demo/community/trip.jpg',
  walk: '/demo/community/walk.jpg',
};

// 지도 탭 카테고리와 같은 이름만 써요: 혼술바 · 술집 · 음식점 · 카페 · 뷰티 · 숙박
const STORES: Array<{ id: string; name: string; category: string; region: string; address: string; lat: number; lng: number; intro: string; images: string[]; hot?: boolean }> = [
  { id: STORE.seongsu, name: '야화 성수뚝섬점', category: '혼술바', region: '성수', address: '서울 성동구 성수이로 14길 8, 2층', lat: 37.5471, lng: 127.0455, intro: '혼자 와도 편한 바 자리. 오늘의 칵테일은 바텐더에게 물어보세요.', images: [IMG.food, IMG.cafe], hot: true },
  { id: STORE.hapjeong, name: '야화 합정점', category: '혼술바', region: '합정', address: '서울 마포구 독막로 3길 21, 1층', lat: 37.5496, lng: 126.9139, intro: '창가 자리에서 합정 골목을 보며 한 잔. 하이볼이 인기예요.', images: [IMG.cafe], hot: true },
  { id: STORE.gangnam, name: '야화 강남역점', category: '혼술바', region: '강남', address: '서울 강남구 강남대로 94길 12, 지하 1층', lat: 37.4989, lng: 127.0277, intro: '퇴근길에 들르기 좋은 강남역 앞 바예요.', images: [IMG.food] },
  { id: STORE.konkuk, name: '야화 건대입구점', category: '혼술바', region: '건대', address: '서울 광진구 아차산로 33길 7, 2층', lat: 37.5407, lng: 127.0700, intro: '주말엔 음악이 조금 커져요. 평일엔 조용히 한 잔.', images: [IMG.walk] },
  { id: STORE.yeonnam, name: '연남 골목 이자카야', category: '술집', region: '연남', address: '서울 마포구 연남로 5길 30', lat: 37.5625, lng: 126.9235, intro: '꼬치와 사케가 맛있는 작은 이자카야예요.', images: [IMG.food] },
  { id: STORE.euljiro, name: '을지로 밤산책', category: '술집', region: '을지로', address: '서울 중구 을지로 15길 6, 3층', lat: 37.5663, lng: 126.9910, intro: '오래된 인쇄소 골목 위 작은 와인바. 글라스 와인 위주예요.', images: [IMG.walk, IMG.food] },
  { id: STORE.kitchen, name: '성수 화덕 키친', category: '음식점', region: '성수', address: '서울 성동구 연무장길 41', lat: 37.5443, lng: 127.0560, intro: '화덕 피자와 파스타. 둘이 나눠 먹기 좋아요.', images: [IMG.food] },
  { id: STORE.cafe, name: '서울숲 오후의볕', category: '카페', region: '성수', address: '서울 성동구 서울숲 2길 18', lat: 37.5452, lng: 127.0412, intro: '창 넓은 2층 카페. 산책 후 들르기 좋아요.', images: [IMG.cafe, IMG.walk] },
  { id: STORE.nail, name: '성수 손끝 네일', category: '뷰티', region: '성수', address: '서울 성동구 아차산로 9길 4, 2층', lat: 37.5440, lng: 127.0510, intro: '1인 예약제 네일숍이에요.', images: [] },
  { id: STORE.stay, name: '익선 한옥 스테이', category: '숙박', region: '종로', address: '서울 종로구 수표로 28길 17', lat: 37.5740, lng: 126.9895, intro: '익선동 골목 안 하룻밤 한옥이에요.', images: [IMG.trip] },
];

// 매장 쿠폰(지도·매장 상세의 '쿠폰 받기'). until: 오늘부터 며칠 뒤까지(음수면 이미 지남, null이면 기한 없음)
const STORE_COUPON_TEXT = '매장 직원에게 쿠폰을 보여주고 확인코드를 입력해주세요. 하루 1회 사용 가능해요.';
const STORE_COUPONS: Array<{ id: string; storeId: string; title: string; label: string; until: number | null; createdDaysAgo: number }> = [
  { id: 'cp-seongsu', storeId: STORE.seongsu, title: '칵테일 첫 잔 20% 할인', label: '첫 잔 20%', until: 30, createdDaysAgo: 40 },
  { id: 'cp-hapjeong', storeId: STORE.hapjeong, title: '칵테일 첫 잔 20% 할인', label: '첫 잔 20%', until: 30, createdDaysAgo: 40 },
  { id: 'cp-gangnam', storeId: STORE.gangnam, title: '칵테일 첫 잔 20% 할인', label: '첫 잔 20%', until: 30, createdDaysAgo: 40 },
  { id: 'cp-konkuk-old', storeId: STORE.konkuk, title: '가을 하이볼 1+1', label: '하이볼 1+1', until: -10, createdDaysAgo: 70 },
  { id: 'cp-konkuk', storeId: STORE.konkuk, title: '칵테일 첫 잔 20% 할인', label: '첫 잔 20%', until: 30, createdDaysAgo: 9 },
  { id: 'cp-yeonnam', storeId: STORE.yeonnam, title: '꼬치 모둠 한 접시 서비스', label: '꼬치 서비스', until: 2, createdDaysAgo: 20 },
  { id: 'cp-euljiro', storeId: STORE.euljiro, title: '글라스 와인 한 잔 무료', label: '와인 1잔', until: 14, createdDaysAgo: 12 },
  { id: 'cp-cafe', storeId: STORE.cafe, title: '음료 1,000원 할인', label: '1,000원 할인', until: null, createdDaysAgo: 25 },
];

// 가입 쿠폰 — 자동 지급(코드 없음) 하나 + 링크(/download?c=코드)로 받는 캠페인 하나
export const SIGNUP_COUPON_ID = 'cp-signup';
export const SIGNUP_LINK_CODE = 'NIGHT';
// 첫 모임 개설 보상(모임 이용안내에 숫자로 보여요)
const FIRST_GATHERING_REWARD_LEAF = 30;

// 매장별 내 포인트(태그히어 적립). 합계 3,350P — users.points(나)도 이 값이면 MY 숫자와 맞아요.
const MY_POINTS: Array<{ storeId: string; balance: number; syncedDaysAgo: number }> = [
  { storeId: STORE.seongsu, balance: 1850, syncedDaysAgo: 1 },
  { storeId: STORE.hapjeong, balance: 900, syncedDaysAgo: 6 },
  { storeId: STORE.gangnam, balance: 600, syncedDaysAgo: 15 },
];
export const MY_POINTS_TOTAL = MY_POINTS.reduce((s, p) => s + p.balance, 0);

// ── 시각 도우미(시드 전용) ─────────────────────────────────────
const DAY = 86_400_000;
const HOUR = 3_600_000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * HOUR).toISOString();
const later = (days: number, hours = 0) => ago(-days, -hours);
// 한국 날짜 'YYYY-MM-DD'(offset일 뒤)
const kstDay = (offset = 0) => new Date(Date.now() + 9 * HOUR + offset * DAY).toISOString().slice(0, 10);
// 쿠폰 날짜 — 한국 시각 05:00에 하루가 바뀌어요(서버 coupon_day()와 같은 기준)
const couponDay = (offset = 0) => new Date(Date.now() + 4 * HOUR + offset * DAY).toISOString().slice(0, 10);
const photoOf = (id: string) => person(id)?.photos[0] ?? null;
const nickOf = (id: string) => person(id)?.nickname ?? '참여자';

// ── 표 만들기 ─────────────────────────────────────────────────

function stores(): Row[] {
  return STORES.map((s, i) => ({
    id: s.id, name: s.name, category: s.category, region: s.region, address: s.address,
    phone: null, lat: s.lat, lng: s.lng, image_urls: s.images, intro: s.intro,
    active: true, hot: !!s.hot,
    waiting_count: 0, waiting_eta_minutes: null, waiting_enabled: true, waiting_slug: null,
    seat_capacity: null, gender_stats_open_days: null, owner_id: null,
    created_at: ago(120 - i),
  }));
}

function coupons(): Row[] {
  const store = STORE_COUPONS.map((c) => ({
    id: c.id, title: c.title, description: STORE_COUPON_TEXT, discount_label: c.label,
    kind: 'store', store_id: c.storeId, valid_until: c.until === null ? null : kstDay(c.until),
    signup_grant: false, signup_code: null, first_gathering_grant: false, reward_leaf: null,
    created_at: ago(c.createdDaysAgo),
  }));
  return [
    ...store,
    { id: SIGNUP_COUPON_ID, title: '가입 환영 · 첫 잔 무료', description: '야화 혼술바 어느 매장에서나 첫 잔 하나를 무료로 드려요.', discount_label: '첫 잔 무료', kind: 'welcome', store_id: null, valid_until: kstDay(28), signup_grant: true, signup_code: null, first_gathering_grant: false, reward_leaf: null, created_at: ago(60) },
    { id: 'cp-signup-link', title: '초대 링크 가입 · 하이볼 한 잔', description: '초대 링크로 가입하면 받는 쿠폰이에요.', discount_label: '하이볼 1잔', kind: 'welcome', store_id: null, valid_until: kstDay(60), signup_grant: true, signup_code: SIGNUP_LINK_CODE, first_gathering_grant: false, reward_leaf: null, created_at: ago(50) },
    { id: 'cp-first-gathering', title: '첫 모임 개설 보상', description: '처음 모임을 열면 리프를 드려요.', discount_label: null, kind: 'reward', store_id: null, valid_until: null, signup_grant: false, signup_code: null, first_gathering_grant: true, reward_leaf: FIRST_GATHERING_REWARD_LEAF, created_at: ago(90) },
  ];
}

// 내 쿠폰함 — 사용 가능 · 곧 만료 · 사용 완료 · 기간 만료가 모두 보이게
function userCoupons(): Row[] {
  const uc = (id: string, couponId: string, grantedDaysAgo: number, extra: Row = {}): Row => ({
    id, user_id: ME_ID, coupon_id: couponId, status: 'active',
    granted_at: ago(grantedDaysAgo, 1), granted_day: couponDay(-grantedDaysAgo), used_at: null, used_store_id: null,
    created_at: ago(grantedDaysAgo, 1), ...extra,
  });
  return [
    uc('uc-signup', SIGNUP_COUPON_ID, 2),                                  // 가입 환영(첫 화면 팝업)
    uc('uc-seongsu-today', 'cp-seongsu', 0),                               // 오늘 받은 성수 쿠폰 → 매장에서 '내 쿠폰 보기'
    uc('uc-yeonnam', 'cp-yeonnam', 4),                                     // 이틀 뒤 만료(D-2)
    uc('uc-gangnam-used', 'cp-gangnam', 7, { status: 'used', used_at: ago(5, 3), used_store_id: STORE.gangnam }),
    uc('uc-konkuk-expired', 'cp-konkuk-old', 30),                          // 기한 지남 → 기간 만료
  ];
}

// 리프·포인트 기록. amount: +는 적립, -는 사용. 사용 내역 화면은 meta.currency로 리프/포인트를 나눠요.
function transactions(): Row[] {
  const t = (id: string, kind: string, amount: number, provider: string, meta: Row, at: string): Row =>
    ({ id, user_id: ME_ID, kind, amount, provider, provider_tx_id: null, refunded_at: null, meta, created_at: at });
  return [
    t('tx-charge-1', 'charge', 105, 'tosspayments', { won: 16900 }, ago(21, 2)),
    t('tx-charge-2', 'charge', 35, 'tosspayments', { won: 8900 }, ago(6, 5)),
    t('tx-mission-1', 'gift', 1, 'event', { feature: 'mission', mission: 'post', date: kstDay(-3), currency: 'leaf' }, ago(3, 4)),
    t('tx-mission-2', 'gift', 5, 'event', { feature: 'mission', mission: 'like1', date: kstDay(-1), currency: 'leaf' }, ago(1, 6)),
    t('tx-mission-3', 'gift', 5, 'event', { feature: 'mission', mission: 'like2', date: kstDay(-1), currency: 'leaf' }, ago(1, 5)),
    t('tx-view-1', 'unlock', -10, 'system', { feature: 'friend_view', target_profile_id: 'u-f04', currency: 'leaf' }, ago(9, 3)),
    t('tx-gender-1', 'unlock', -100, 'system', { feature: 'store_gender_stats', store_id: STORE.seongsu, currency: 'leaf' }, ago(12, 2)),
    t('tx-gender-2', 'unlock', -100, 'system', { feature: 'store_gender_stats', store_id: STORE.konkuk, currency: 'point' }, ago(16, 1)),
  ];
}

function pointBalances(): Row[] {
  return MY_POINTS.map((p, i) => ({
    id: `tpb-${i + 1}`, user_id: ME_ID, store_id: p.storeId, balance: p.balance,
    synced_at: ago(p.syncedDaysAgo, 2), created_at: ago(p.syncedDaysAgo + 30),
  }));
}

// ── 모임 · 채팅(숨은 탭 — 기능 잠시 중단) ─────────────────────────
export const GATHER = { seongsu: 'gather-seongsu', running: 'gather-running', wine: 'gather-wine', board: 'gather-board' } as const;
export const GATHER_CHAT_ROOM = 'room-gather-board';

function gatherings(): Row[] {
  const g = (r: Row): Row => ({
    cover: IMG.food, photos: [], fee: 0, fee_desc: null, gender_mode: 'split', capacity: null,
    social_kind: 'normal', store_id: null, approved: true, place_url: null, place_name: null, place_address: null,
    region: '서울/성수', host_photo: r.host_id === ME_ID ? null : photoOf(r.host_id), host_nick: r.host_id === ME_ID ? null : nickOf(r.host_id),
    ...r,
  });
  return [
    g({ id: GATHER.seongsu, host_id: 'u-f04', title: '성수 혼술바에서 가볍게 한 잔', cat: '술·맛집', cover: IMG.food, ratio: '2:2', slots: 4,
        when_text: '토 저녁 8시', start_at: later(3, 2), place: '야화 성수뚝섬점', description: '퇴근하고 한 잔만 가볍게 해요. 처음 오셔도 편한 자리예요.',
        status: 'recruiting', social_kind: 'yahwa', store_id: STORE.seongsu, created_at: ago(2) }),
    g({ id: GATHER.running, host_id: ME_ID, title: '한강 러닝 5km 뛰고 맥주 한 잔', cat: '러닝', cover: IMG.walk, ratio: '2:2', slots: 4,
        gender_mode: 'any', capacity: 4, when_text: '일 오전 9시', start_at: later(5), place: '여의나루역 2번 출구', region: '서울/영등포',
        description: '천천히 뛰어요. 끝나고 근처에서 맥주 한 잔 해요.', status: 'recruiting', created_at: ago(1) }),
    g({ id: GATHER.wine, host_id: 'u-m02', title: '을지로 와인바 투어', cat: '와인', cover: IMG.walk, ratio: '3:3', slots: 6,
        when_text: '금 저녁 7시 반', start_at: later(6), place: '을지로 밤산책', region: '서울/중구',
        description: '을지로 골목 와인바 두 곳을 돌아요. 와인 몰라도 괜찮아요.', status: 'recruiting', created_at: ago(3) }),
    g({ id: GATHER.board, host_id: 'u-f01', title: '연남동 보드게임 카페', cat: '보드게임', cover: IMG.cafe, ratio: '2:2', slots: 4,
        when_text: '어제 저녁 7시', start_at: ago(1, 2), place: '연남동', region: '서울/마포',
        description: '할리갈리부터 스플렌더까지. 처음이어도 알려 드려요.', status: 'matched', created_at: ago(6) }),
  ];
}

function gatheringSlots(): Row[] {
  const s = (gatheringId: string, userId: string, role: 'host' | 'guest', status: string, slotIndex: number, joinedDaysAgo: number): Row => ({
    id: `slot-${gatheringId}-${userId}`, gathering_id: gatheringId, user_id: userId,
    gender: userId === ME_ID ? 'M' : person(userId)?.gender ?? null, role, slot_index: slotIndex,
    photo: userId === ME_ID ? null : photoOf(userId), status,
    order_id: null, paid_amount: null, platform_fee: null, paid_at: null,
    joined_at: ago(joinedDaysAgo), created_at: ago(joinedDaysAgo),
  });
  return [
    s(GATHER.seongsu, 'u-f04', 'host', 'approved', 0, 2),
    s(GATHER.seongsu, 'u-f06', 'guest', 'approved', 1, 2),
    s(GATHER.seongsu, ME_ID, 'guest', 'pending', 2, 1),
    s(GATHER.running, ME_ID, 'host', 'approved', 0, 1),
    s(GATHER.running, 'u-m05', 'guest', 'approved', 1, 1),
    s(GATHER.running, 'u-f02', 'guest', 'pending', 2, 0),
    s(GATHER.wine, 'u-m02', 'host', 'approved', 0, 3),
    s(GATHER.wine, 'u-f08', 'guest', 'approved', 1, 2),
    s(GATHER.board, 'u-f01', 'host', 'approved', 0, 6),
    s(GATHER.board, ME_ID, 'guest', 'approved', 1, 5),
    s(GATHER.board, 'u-f05', 'guest', 'approved', 2, 5),
    s(GATHER.board, 'u-m04', 'guest', 'approved', 3, 4),
  ];
}

function chat(): Record<string, Row[]> {
  const members = [ME_ID, 'u-f01', 'u-f05', 'u-m04'];
  const lines: Array<[string, string, number]> = [  // [보낸 사람, 내용, 몇 분 전]
    ['u-f01', '다들 반가워요! 연남동 보드게임 카페에서 7시에 봬요 :)', 1500],
    ['u-m04', '저 5분 정도 늦을 것 같아요. 먼저 시작하셔도 돼요!', 1470],
    [ME_ID, '저는 입구 쪽에 와 있어요.', 1455],
    ['u-f05', '어제 정말 재밌었어요. 스플렌더 또 해요 ㅎㅎ', 600],
    ['u-f01', '다음엔 성수 쪽에서 한 번 더 모여요!', 540],
    ['u-m04', '좋아요. 날짜 정해지면 알려 주세요', 30],
  ];
  return {
    chat_rooms: [{ id: GATHER_CHAT_ROOM, kind: 'gather', gathering_id: GATHER.board, locked: false, created_at: ago(5) }],
    chat_members: members.map((u) => ({ id: `cm-${u}`, room_id: GATHER_CHAT_ROOM, user_id: u, created_at: ago(5) })),
    chat_messages: lines.map(([sender, body, min], i) => ({
      id: `msg-board-${i + 1}`, room_id: GATHER_CHAT_ROOM, sender_id: sender, body, kind: 'text',
      created_at: new Date(Date.now() - min * 60_000).toISOString(),
    })),
  };
}

export const seed = (): Record<string, Row[]> => ({
  stores: stores(),
  coupons: coupons(),
  user_coupons: userCoupons(),
  transactions: transactions(),
  taghere_point_balances: pointBalances(),
  waitings: [],
  store_gender_unlocks: [],
  leaf_conversions: [],          // 리프 전환 안내 팝업 — 나의 행을 넣으면 앱을 열 때 한 번 떠요
  partner_applications: [],
  payments: [],
  home_banners: [
    { id: 'banner-1', image_url: IMG.trip, link_url: null, sort_order: 0, active: true, created_at: ago(30) },
    { id: 'banner-2', image_url: IMG.walk, link_url: null, sort_order: 1, active: true, created_at: ago(20) },
  ],
  gatherings: gatherings(),
  gathering_slots: gatheringSlots(),
  host_follows: [
    { id: 'hf-1', follower_id: ME_ID, host_id: 'u-f04', created_at: ago(10) },
    { id: 'hf-2', follower_id: ME_ID, host_id: 'u-f01', created_at: ago(4) },
    { id: 'hf-3', follower_id: 'u-m05', host_id: 'u-f04', created_at: ago(8) },
  ],
  ...chat(),
});
