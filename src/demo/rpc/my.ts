// 야화 시연판 — MY · 지갑 · 쿠폰함 · 플레이스(매장) · 모임/채팅 서버 함수 목업 + 시연도구 '상황 만들기' 버튼.
// 실제 서버 함수(supabase/migrations)와 같은 이름·인자·응답 모양으로 흉내 내고, 쓰기는 목업 DB만 바꿔요.
import {
  table, insertRows, updateRows, deleteRows, requireUid, me, userById, now, nowIso, daysAgo,
  DemoError, ME_ID, type Row,
} from '../db';
import type { Scenario } from '../scenario';
import { STORE, SIGNUP_COUPON_ID } from '../seed/my';

// ── 고치기 쉬운 값 ─────────────────────────────────────────────
const STORE_LIVE_COST = 100;          // 실시간 인원 보기 비용(리프/포인트)
const STORE_LIVE_HOURS = 6;           // 잠금해제 유지 시간
// 쿠폰 확인코드(PIN): 시연판에서는 숫자 4자리면 무엇이든 통과해요. 틀린 경우를 보여 주고 싶으면 여기 값을 넣으세요.
const WRONG_PIN_FOR_DEMO = '0000';

// ── 공용 도우미 ────────────────────────────────────────────────
const HOUR = 3_600_000;
const kstToday = () => new Date(now() + 9 * HOUR).toISOString().slice(0, 10);
const kstDay = (offset: number) => new Date(now() + 9 * HOUR + offset * 86_400_000).toISOString().slice(0, 10);
const couponDay = () => new Date(now() + 4 * HOUR).toISOString().slice(0, 10);   // KST 05:00에 하루가 바뀜
const photoOf = (u: Row | undefined): string | null => u?.group_photo ?? (Array.isArray(u?.photos) ? u!.photos[0] ?? null : null);
const ageOf = (u: Row | undefined): number | null => {
  if (!u) return null;
  if (typeof u.age === 'number') return u.age;
  const y = Number(u.birth_year ?? String(u.birth_date ?? '').slice(0, 4));
  return y ? new Date(now()).getFullYear() - y : null;
};
const isFemale = (uid: string) => userById(uid)?.gender === 'F';
const notify = (userId: string, kind: string, title: string, body: string, data: Row) =>
  insertRows('notifications', { user_id: userId, kind, title, body, data, read: false });

function storeActive(storeId: string): Row {
  const s = table('stores').find((x) => x.id === storeId && x.active !== false);
  if (!s) throw new DemoError('store not found', '02000');
  return s;
}

// 매장 쿠폰 받기 — 서버 download_store_coupon과 같아요. 'granted' | 'already' | 'none'
function downloadStoreCoupon(uid: string, storeId: string): 'granted' | 'already' | 'none' {
  const today = kstToday();
  const store = table('stores').find((s) => s.id === storeId && s.active !== false);
  if (!store) return 'none';
  const c = table('coupons')
    .filter((x) => x.store_id === storeId && x.kind === 'store' && (!x.valid_until || x.valid_until >= today))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  if (!c) return 'none';
  const day = couponDay();
  if (table('user_coupons').some((u) => u.user_id === uid && u.coupon_id === c.id && u.granted_day === day)) return 'already';
  insertRows('user_coupons', { user_id: uid, coupon_id: c.id, status: 'active', granted_at: nowIso(), granted_day: day, used_at: null, used_store_id: null });
  return 'granted';
}

// 리프 더하기/빼기 + 기록
function addLeaf(uid: string, amount: number, kind: string, provider: string, meta: Row) {
  const u = userById(uid);
  if (!u) throw new DemoError('user not found', '02000');
  updateRows('users', (x) => x.id === uid, { leaf_balance: (u.leaf_balance ?? 0) + amount });
  insertRows('transactions', { user_id: uid, kind, amount, provider, provider_tx_id: null, meta });
}

// 매장 실시간 인원 잠금해제 기록(이미 열려 있으면 그 만료 시각)
function openUnlock(uid: string, storeId: string): string | null {
  const t = nowIso();
  const hit = table('store_gender_unlocks')
    .filter((x) => x.user_id === uid && x.store_id === storeId && x.expires_at > t)
    .sort((a, b) => String(b.expires_at).localeCompare(String(a.expires_at)))[0];
  return hit?.expires_at ?? null;
}

// ── 서버 함수 ──────────────────────────────────────────────────
export const rpc: Record<string, (args: any) => any> = {
  // ── 쿠폰 ──
  // 직원이 확인코드를 눌러 쿠폰 사용 처리(0181)
  redeem_coupon({ p_user_coupon_id, p_store_id, p_pin }: { p_user_coupon_id: string; p_store_id: string; p_pin: string }) {
    const uid = requireUid();
    const uc = table('user_coupons').find((x) => x.id === p_user_coupon_id && x.user_id === uid);
    const c = uc && table('coupons').find((x) => x.id === uc.coupon_id);
    if (!uc || !c) throw new DemoError('쿠폰을 찾을 수 없어요');
    if (uc.status !== 'active') throw new DemoError('이미 사용됐거나 만료된 쿠폰이에요');
    if (c.valid_until && c.valid_until < kstToday()) throw new DemoError('유효기간이 지난 쿠폰이에요');
    if (c.store_id && c.store_id !== p_store_id) throw new DemoError('이 쿠폰은 발행한 매장에서만 사용할 수 있어요');
    const pin = String(p_pin ?? '').trim();
    if (!/^\d{4}$/.test(pin) || pin === WRONG_PIN_FOR_DEMO) throw new DemoError('확인코드가 올바르지 않아요. 매장 직원에게 입력을 요청해주세요');
    updateRows('user_coupons', (x) => x.id === uc.id, { status: 'used', used_at: nowIso(), used_store_id: p_store_id });
    return null;
  },

  // 지도·매장 상세 '쿠폰 받기' — 하루 한 번(0126)
  download_store_coupon({ p_store_id }: { p_store_id: string }) {
    return downloadStoreCoupon(requireUid(), p_store_id);
  },

  // /download?c=코드 로 가입한 뒤 캠페인 쿠폰 받기(0179) — 받으면 true
  claim_signup_coupon({ p_code }: { p_code: string }) {
    const uid = requireUid();
    const today = kstToday();
    const c = table('coupons').find((x) => x.signup_grant && x.signup_code === String(p_code ?? '').trim() && (!x.valid_until || x.valid_until >= today));
    if (!c) return false;
    if (table('user_coupons').some((x) => x.user_id === uid && x.coupon_id === c.id)) return true;
    insertRows('user_coupons', { user_id: uid, coupon_id: c.id, status: 'active', granted_at: nowIso(), granted_day: couponDay(), used_at: null, used_store_id: null });
    notify(uid, 'coupon', '쿠폰이 도착했어요', `${c.title} 쿠폰을 쿠폰함에서 확인해보세요`, { couponId: c.id });
    return true;
  },

  // ── 매장 실시간 인원(지금은 화면에서 숨김 — SHOW_STORE_LIVE) ──
  // 시연판은 공개 요일 제한 없이 열어 줘요. 여성은 무료(0106).
  unlock_store_gender({ p_store_id, p_currency }: { p_store_id: string; p_currency: 'leaf' | 'point' }) {
    const uid = requireUid();
    if (p_currency !== 'leaf' && p_currency !== 'point') throw new DemoError('invalid currency', '22023');
    storeActive(p_store_id);
    const open = openUnlock(uid, p_store_id);
    if (open) return open;
    const u = userById(uid);
    if (!u) throw new DemoError('user not found', '02000');
    let cost = STORE_LIVE_COST;
    if (isFemale(uid)) cost = 0;
    else if (p_currency === 'leaf') {
      if ((u.leaf_balance ?? 0) < cost) throw new DemoError('insufficient leaf', '53100');
      updateRows('users', (x) => x.id === uid, { leaf_balance: u.leaf_balance - cost });
    } else {
      if ((u.points ?? 0) < cost) throw new DemoError('insufficient points', '53100');
      updateRows('users', (x) => x.id === uid, { points: u.points - cost });
    }
    const expires = new Date(now() + STORE_LIVE_HOURS * HOUR).toISOString();
    insertRows('store_gender_unlocks', { user_id: uid, store_id: p_store_id, currency: p_currency, cost, expires_at: expires });
    if (cost > 0) insertRows('transactions', { user_id: uid, kind: 'unlock', amount: -cost, provider: 'system', meta: { feature: 'store_gender_stats', store_id: p_store_id, currency: p_currency } });
    return expires;
  },
  // 포인트는 /api/points-spend가 먼저 깎고, 여기서는 잠금해제 기록만(0069)
  record_store_gender_unlock_after_point_spend({ p_store_id }: { p_store_id: string }) {
    const uid = requireUid();
    const open = openUnlock(uid, p_store_id);
    if (open) return open;
    const expires = new Date(now() + STORE_LIVE_HOURS * HOUR).toISOString();
    insertRows('store_gender_unlocks', { user_id: uid, store_id: p_store_id, currency: 'point', cost: STORE_LIVE_COST, expires_at: expires });
    return expires;
  },

  // ── 지갑 ──
  // iOS 화폐 숨김 시절 함수(지금 운영에선 실행 권한 없음) — 시연판은 잔액을 100까지 채워 줘요
  ensure_min_leaf_100() {
    const uid = requireUid();
    const bal = userById(uid)?.leaf_balance ?? 0;
    if (bal < 100) addLeaf(uid, 100 - bal, 'gift', 'event', { feature: 'ios_free_access', currency: 'leaf' });
    return null;
  },
  // 리프 전환 안내(0187) — leaf_conversions에 나의 행이 있을 때만 팝업이 떠요
  my_leaf_conversion() {
    const uid = requireUid();
    return table('leaf_conversions').filter((x) => x.user_id === uid)
      .map((x) => ({ before: x.before, after: x.after, converted_at: x.converted_at ?? x.created_at, notice_seen_at: x.notice_seen_at ?? null }));
  },
  ack_leaf_conversion() {
    const uid = requireUid();
    updateRows('leaf_conversions', (x) => x.user_id === uid && !x.notice_seen_at, { notice_seen_at: nowIso() });
    return null;
  },

  // ── 모임(숨은 탭) ──
  // 모임 상세 + 호스트 요약 + 슬롯(신청자 닉네임·나이)(0071)
  get_gathering_detail({ p_id }: { p_id: string }) {
    const g = table('gatherings').find((x) => x.id === p_id);
    if (!g) return null;
    const host = userById(g.host_id);
    const slots = table('gathering_slots').filter((s) => s.gathering_id === g.id)
      .sort((a, b) => (a.slot_index ?? 99) - (b.slot_index ?? 99))
      .map((s) => {
        const au = userById(s.user_id);
        return { user_id: s.user_id, gender: s.gender, role: s.role, slot_index: s.slot_index, photo: s.photo, status: s.status,
          applicant: au ? { nickname: au.nickname ?? null, age: ageOf(au) } : null };
      });
    return { ...g, host: host ? { age: ageOf(host), gender: host.gender ?? null, univ_name: host.univ_name ?? null } : null, gathering_slots: slots };
  },
  // 매칭 연락처 — 호스트만 볼 수 있어요(0124)
  get_gathering_contacts({ gid }: { gid: string }) {
    const uid = requireUid();
    const slots = table('gathering_slots').filter((s) => s.gathering_id === gid);
    if (!slots.some((s) => s.user_id === uid && s.role === 'host')) return [];
    return slots.filter((s) => s.role === 'host' || s.status === 'approved')
      .map((s, i) => {
        const u = userById(s.user_id);
        return { user_id: s.user_id, nickname: u?.nickname ?? '참여자', phone: u?.phone ?? `010-0000-${String(1001 + i)}`, is_host: s.role === 'host', photo: photoOf(u) };
      })
      .sort((a, b) => Number(b.is_host) - Number(a.is_host) || a.nickname.localeCompare(b.nickname));
  },
  // 호스트가 참여 신청 승인/거절(0021)
  decide_gathering_slot({ p_gathering_id, p_user_id, p_approve }: { p_gathering_id: string; p_user_id: string; p_approve: boolean }) {
    const uid = requireUid();
    const g = table('gatherings').find((x) => x.id === p_gathering_id);
    if (!g) throw new DemoError('gathering_not_found');
    if (g.host_id !== uid) throw new DemoError('not_host');
    updateRows('gathering_slots', (s) => s.gathering_id === p_gathering_id && s.user_id === p_user_id && s.role !== 'host',
      { status: p_approve ? 'approved' : 'rejected' });
    notify(p_user_id, p_approve ? 'gather_approved' : 'gather_rejected', p_approve ? '모임 참여가 확정됐어요' : '모임 참여가 어려워졌어요', `"${g.title}" 모임`, { gatheringId: g.id });
    return null;
  },
  // 호스트가 모임 내리기 — 취소 상태로 바꾸고 채팅방은 지워요(0122)
  cancel_gathering({ p_id }: { p_id: string }) {
    const uid = requireUid();
    const g = table('gatherings').find((x) => x.id === p_id);
    if (!g) throw new DemoError('모임을 찾을 수 없어요');
    if (g.host_id !== uid) throw new DemoError('호스트만 모임을 내릴 수 있어요');
    if (g.status === 'cancelled') return null;
    if (table('payments').some((p) => p.gathering_id === p_id && p.status === 'paid')) {
      throw new DemoError('참가비를 결제한 참여자가 있어 바로 내릴 수 없어요. 고객센터로 문의해주세요');
    }
    updateRows('gatherings', (x) => x.id === p_id, { status: 'cancelled' });
    for (const s of table('gathering_slots').filter((s) => s.gathering_id === p_id && s.role !== 'host' && (s.status === 'pending' || s.status === 'approved'))) {
      notify(s.user_id, 'gather_cancelled', '모임이 취소됐어요', `"${g.title ?? '모임'}" 모임이 호스트에 의해 취소됐어요`, { gatheringId: p_id });
    }
    const rooms = table('chat_rooms').filter((r) => r.gathering_id === p_id).map((r) => r.id);
    if (rooms.length) {
      deleteRows('chat_messages', (m) => rooms.includes(m.room_id));
      deleteRows('chat_members', (m) => rooms.includes(m.room_id));
      deleteRows('chat_rooms', (r) => rooms.includes(r.id));
    }
    return null;
  },
  // 모임용 프로필(0124) — 배열로 돌려줘요
  get_group_profile({ target_id }: { target_id: string }) {
    requireUid();
    const u = userById(target_id);
    if (!u) return [];
    return [{ user_id: u.id, nickname: u.nickname ?? null, age: ageOf(u), gender: u.gender ?? null, region: u.region ?? null, photo: photoOf(u), created_at: u.created_at ?? null }];
  },
  // 호스트 팔로우(0131)
  get_host_follow_stats({ p_host }: { p_host: string }) {
    const uid = requireUid();
    const f = table('host_follows').filter((x) => x.host_id === p_host);
    return [{ follower_count: f.length, following: f.some((x) => x.follower_id === uid) }];
  },
  get_my_followed_hosts() {
    const uid = requireUid();
    const t = nowIso();
    return table('host_follows').filter((f) => f.follower_id === uid)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((f) => {
        const u = userById(f.host_id);
        if (!u) return null;
        const mine = table('gatherings').filter((g) => g.host_id === u.id);
        return {
          host_id: u.id, nickname: u.nickname ?? null, photo: photoOf(u), age: ageOf(u), gender: u.gender ?? null, followed_at: f.created_at,
          hosted_count: mine.filter((g) => g.status !== 'cancelled').length,
          open_count: mine.filter((g) => g.status === 'recruiting' && g.approved && (!g.start_at || g.start_at > t)).length,
        };
      })
      .filter(Boolean);
  },

  // ── 채팅(숨은 탭) ──
  // 내가 들어가 있는 방들의 멤버 프로필(0124)
  get_chat_members() {
    const uid = requireUid();
    const mine = new Set(table('chat_members').filter((m) => m.user_id === uid).map((m) => m.room_id));
    return table('chat_members').filter((m) => mine.has(m.room_id)).map((m) => {
      const u = userById(m.user_id);
      return { room_id: m.room_id, user_id: m.user_id, nickname: u?.nickname ?? null, photo: photoOf(u) };
    });
  },

  // ── 제휴 신청(앱에서 지금 부르는 곳은 없어요 — 0161 모양만 맞춰 둠) ──
  submit_partner_application(a: { p_kind?: string; p_business_name?: string; p_phone?: string; p_naver_place_url?: string; p_coupon?: string; p_category?: string }) {
    const phone = String(a.p_phone ?? '').replace(/\D/g, '');
    const name = String(a.p_business_name ?? '').trim();
    const url = String(a.p_naver_place_url ?? '').trim();
    const coupon = String(a.p_coupon ?? '').trim();
    const category = String(a.p_category ?? '').trim();
    if (!['store', 'franchise'].includes(a.p_kind ?? 'store')) throw new DemoError('신청 유형이 올바르지 않아요', '22023');
    if (!['혼술바', '술집', '음식점', '카페', '뷰티', '숙박', '미용', '네일아트'].includes(category)) throw new DemoError('업종을 선택해 주세요', '22023');
    if (name.length < 1 || name.length > 60) throw new DemoError('상호명을 확인해 주세요', '22023');
    if (!/^0\d{8,10}$/.test(phone)) throw new DemoError('대표 연락처를 확인해 주세요', '22023');
    if (!/^https?:\/\/([a-z0-9-]+\.)*(naver\.me|naver\.com)(\/|$)/i.test(url)) throw new DemoError('네이버 플레이스 URL을 확인해 주세요', '22023');
    if (coupon.length < 1 || coupon.length > 200) throw new DemoError('제공 예정 쿠폰을 적어 주세요', '22023');
    const [row] = insertRows('partner_applications', { kind: a.p_kind ?? 'store', business_name: name, phone, naver_place_url: url, coupon, category, status: 'pending' });
    return row.id;
  },
};

// ── 시연도구 '상황 만들기' ───────────────────────────────────────
const G = 'MY · 쿠폰';
const myUsableStoreCoupons = () => table('user_coupons').filter((uc) => {
  if (uc.user_id !== ME_ID || uc.status !== 'active') return false;
  const c = table('coupons').find((x) => x.id === uc.coupon_id);
  return !!c && (!c.valid_until || c.valid_until >= kstToday());
});

export const scenarios: Scenario[] = [
  {
    id: 'my-store-coupon',
    group: G,
    label: '매장 쿠폰 받기',
    hint: '야화 합정점 쿠폰을 받은 상태로 만들어요',
    run: () => {
      const r = downloadStoreCoupon(ME_ID, STORE.hapjeong);
      return r === 'granted' ? '야화 합정점 쿠폰을 쿠폰함에 담았어요.' : r === 'already' ? '오늘은 이미 받은 쿠폰이에요.' : '이 매장엔 지금 받을 수 있는 쿠폰이 없어요.';
    },
    go: { overlay: 'storeDetail', params: { storeId: STORE.hapjeong } },
  },
  {
    id: 'my-store-coupon-reset',
    group: G,
    label: '오늘 받은 매장 쿠폰 지우기',
    hint: '매장에서 ‘쿠폰 받기’를 처음부터 눌러 볼 수 있어요',
    run: () => {
      const day = couponDay();
      const storeCoupons = new Set(table('coupons').filter((c) => c.kind === 'store').map((c) => c.id));
      const gone = deleteRows('user_coupons', (uc) => uc.user_id === ME_ID && uc.granted_day === day && uc.status === 'active' && storeCoupons.has(uc.coupon_id));
      return `오늘 받은 매장 쿠폰 ${gone.length}장을 지웠어요.`;
    },
    go: { overlay: 'storeDetail', params: { storeId: STORE.seongsu } },
  },
  {
    id: 'my-points-earn',
    group: G,
    label: '매장 결제로 포인트 적립',
    hint: '야화 성수뚝섬점에서 25,000원 결제 → 500P',
    run: () => {
      const add = 500;
      const hit = table('taghere_point_balances').find((b) => b.user_id === ME_ID && b.store_id === STORE.seongsu);
      if (hit) updateRows('taghere_point_balances', (b) => b === hit, { balance: (hit.balance ?? 0) + add, synced_at: nowIso() });
      else insertRows('taghere_point_balances', { user_id: ME_ID, store_id: STORE.seongsu, balance: add, synced_at: nowIso() });
      const u = me();
      updateRows('users', (x) => x.id === ME_ID, { points: (u?.points ?? 0) + add, store_spend_total: (u?.store_spend_total ?? 0) + 25000 });
      return `야화 성수뚝섬점에서 ${add}P가 쌓였어요.`;
    },
    go: { overlay: 'spendHistory' },
  },
  {
    id: 'my-coupon-soon',
    group: G,
    label: '쿠폰 만료 임박으로 보기',
    hint: '쓸 수 있는 쿠폰의 기한을 내일까지로',
    run: () => {
      const ids = new Set(myUsableStoreCoupons().map((uc) => uc.coupon_id));
      updateRows('coupons', (c) => ids.has(c.id), { valid_until: kstDay(1) });
      return `쿠폰 ${ids.size}종의 기한을 내일까지로 바꿨어요.`;
    },
    go: { overlay: 'couponWallet' },
  },
  {
    id: 'my-coupon-expired',
    group: G,
    label: '쿠폰 기간 만료로 보기',
    hint: '쓸 수 있는 쿠폰의 기한을 어제로',
    run: () => {
      const ids = new Set(myUsableStoreCoupons().map((uc) => uc.coupon_id));
      updateRows('coupons', (c) => ids.has(c.id), { valid_until: kstDay(-1) });
      return `쿠폰 ${ids.size}종이 기간 만료가 됐어요.`;
    },
    go: { overlay: 'couponWallet' },
  },
  {
    id: 'my-signup-coupon',
    group: G,
    label: '가입 환영 쿠폰 새로 지급',
    hint: '새로고침하면 첫 화면에 쿠폰 팝업이 떠요',
    run: () => {
      deleteRows('user_coupons', (uc) => uc.user_id === ME_ID && uc.coupon_id === SIGNUP_COUPON_ID);
      updateRows('coupons', (c) => c.id === SIGNUP_COUPON_ID, { valid_until: kstDay(28) });
      insertRows('user_coupons', { user_id: ME_ID, coupon_id: SIGNUP_COUPON_ID, status: 'active', granted_at: nowIso(), granted_day: couponDay(), used_at: null, used_store_id: null });
      return '가입 환영 쿠폰을 새로 넣었어요. 새로고침하면 팝업이 떠요.';
    },
    go: { overlay: 'couponWallet' },
  },
  {
    id: 'my-leaf-100',
    group: G,
    label: '리프 100 받기',
    run: () => {
      addLeaf(ME_ID, 100, 'gift', 'event', { feature: 'demo', currency: 'leaf' });
      return `리프 100을 넣었어요. 지금 ${me()?.leaf_balance ?? 0}리프예요.`;
    },
    go: { tab: 'me' },
  },
  {
    id: 'my-leaf-zero',
    group: G,
    label: '리프 다 쓴 상태로',
    hint: '충전 화면·부족 안내를 볼 때',
    run: () => {
      updateRows('users', (x) => x.id === ME_ID, { leaf_balance: 0 });
      return '리프를 0으로 만들었어요.';
    },
    go: { overlay: 'charge' },
  },
  {
    id: 'my-leaf-conversion',
    group: G,
    label: '리프 전환 안내 팝업 띄우기',
    hint: '새로고침하면 ‘리프 이용 기준이 바뀌었어요’ 시트가 떠요',
    run: () => {
      const bal = me()?.leaf_balance ?? 0;
      const before = Math.max(1, Math.round(bal / 7.5));
      deleteRows('leaf_conversions', (x) => x.user_id === ME_ID);
      insertRows('leaf_conversions', { user_id: ME_ID, before, after: Math.round(before * 7.5), converted_at: daysAgo(1), notice_seen_at: null });
      return `전환 기록(${before} → ${Math.round(before * 7.5)}리프)을 넣었어요. 새로고침하면 떠요.`;
    },
    go: { tab: 'me' },
  },
];
