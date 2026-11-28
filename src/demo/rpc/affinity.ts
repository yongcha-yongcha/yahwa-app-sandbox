// 야화 시연판 — 인연 · 프로필 · 계정 서버 함수(supabase.rpc) 목업.
// 실제 서버(supabase/migrations)의 같은 이름 함수와 같은 모양으로 돌려준다. 모든 쓰기는 목업 DB(db.ts)에 남는다.
// 가격·규칙을 바꿔 보고 싶으면 아래 PRICE · RULE만 고치면 돼요.
import {
  table, insertRows, updateRows, deleteRows, uid, requireUid, me, userById, now, nowIso, touch,
  onRowChange, DemoError, ME_ID, type Row,
} from '../db';
import { PEOPLE } from '../people';
import { fullMeFields, myHeartRows, ALL_GUIDES_SEEN, manAge } from '../seed/users';
import type { Scenario } from '../scenario';
import { BALANCE_Q, type BalanceSide } from '../../components/affinity/balance/content';

// ── 가격 · 규칙(리프 정책 v2 · 0187) ─────────────────────────────────────────
const EVENT_UNTIL = Date.parse('2027-01-01T00:00:00+09:00');   // 연말까지 오픈 특별가
const RULE = {
  deckSize: 8,             // 오늘의 인연 인원
  extraPerBuy: 2,          // 추가 소개 한 번에 받는 인원
  freeViewsPerDay: 10,     // 상세 무료 열람(덱 밖에서 연 프로필)
  overViewCost: 100,       // 무료 열람을 넘긴 뒤 1명당 리프
  contactCost: 100,        // 연락처 보기(예전 '오늘의 친구')
  unlockProfileCost: 30,   // 예전 잠금 해제
  missionLike: 5,          // 하루 첫·두 번째 관심 보상
  missionDeckRead: 3,      // 오늘의 인연 8명 모두 읽기 보상
  mindPhotoDays: 7,        // 마음함 사진이 선명한 기간
};
function priceTable(female: boolean, event: boolean) {
  const letter = female ? (event ? 5 : 15) : (event ? 15 : 45);
  const invite = female ? (event ? 8 : 25) : (event ? 25 : 70);
  return { letter, reply: letter, invite, upgrade: invite - letter, extra: 20, exchange: 10, mind_photo: 10 };
}
const eventOn = () => now() < EVENT_UNTIL;
const price = (k: keyof ReturnType<typeof priceTable>) => priceTable(me()?.gender === 'F', eventOn())[k];

// ── 날짜 · 공통 도우미 ──────────────────────────────────────────────────────
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const kstDate = (ms = now()) => new Date(ms + 9 * HOUR).toISOString().slice(0, 10);          // 한국 날짜
const batchDate = (ms = now()) => new Date(ms + 9 * HOUR - 12 * HOUR).toISOString().slice(0, 10);  // 정오 기준 배치 날짜
const kstHour = () => new Date(now() + 9 * HOUR).getUTCHours();
const opposite = (g: any): 'M' | 'F' | null => (g === 'F' ? 'M' : g === 'M' ? 'F' : null);
const isMe = (r: Row) => r.id === ME_ID;

function myRow(): Row {
  requireUid();
  const u = me();
  if (!u) throw new DemoError('로그인이 필요해요', 'not_authenticated');
  return u;
}
const eligible = (u?: Row) => !!u && !!u.profile_completed && !u.affinity_suspended;
function setMe(patch: Row) { updateRows('users', isMe, { ...patch, updated_at: nowIso() }); }

// 리프 차감(실제 charge_leaf_flat) — 부족하면 53100
function chargeLeaf(amount: number, reason: string, meta: Row = {}) {
  const u = myRow();
  if ((u.leaf_balance ?? 0) < amount) throw new DemoError('리프가 부족해요', '53100');
  setMe({ leaf_balance: (u.leaf_balance ?? 0) - amount });
  insertRows('transactions', { user_id: ME_ID, kind: 'unlock', amount: -amount, provider: 'system', meta: { reason, currency: 'leaf', ...meta } });
}

// 무료 리프 미션 지급(실제 grant_mission_reward) — 오늘 이미 받았으면 false
export function grantMission(mission: string, amount: number): boolean {
  const day = kstDate();
  if (table('reward_grants').some((r) => r.user_id === ME_ID && r.day === day && r.mission === mission)) return false;
  insertRows('reward_grants', { user_id: ME_ID, day, mission, amount });
  const u = me();
  setMe({ leaf_balance: (u?.leaf_balance ?? 0) + amount });
  insertRows('transactions', {
    user_id: ME_ID, kind: 'gift', amount, provider: 'event', provider_tx_id: `mission:${mission}:${ME_ID}:${day}`,
    meta: { feature: 'mission', mission, date: day, currency: 'leaf' },
    // 앱이 .eq('meta->>feature', 'mission')으로 찾는데 목업 조회기는 JSON 안을 못 봐서 같은 값을 칸으로도 둔다
    'meta->>feature': 'mission',
  });
  return true;
}

// ── 프로필 행(실제 friend_profile_rows) ───────────────────────────────────
const featuredIds = () => new Set(table('featured_profiles').map((r) => r.user_id));
function myApprovedCredentials(): Row[] {
  return table('profile_credentials').filter((c) => c.user_id === ME_ID && c.status === 'approved')
    .map((c) => ({ kind: c.kind, label: c.label, year: c.ref_year ?? null, verified_at: c.reviewed_at }));
}
const CRED_ORDER = ['school', 'company', 'income'];
function profileRow(u: Row, feat = featuredIds()): Row {
  const creds = (u.id === ME_ID ? myApprovedCredentials() : (u.demo_credentials ?? []).map((c: Row) => ({ kind: c.kind, label: c.label, year: null, verified_at: u.created_at })))
    .sort((a: Row, b: Row) => CRED_ORDER.indexOf(a.kind) - CRED_ORDER.indexOf(b.kind));
  return {
    user_id: u.id, nickname: u.nickname, age: u.age ?? null, gender: u.gender ?? null, region: u.region ?? null,
    headline: u.headline ?? null, photos: u.photos ?? [], mbti: u.mbti ?? null, height: u.height ?? null,
    smoking: u.smoking ?? null, drinking: u.drinking ?? null,
    intro_want: u.intro_want ?? null, intro_interest: u.intro_interest ?? null, intro_hobby: u.intro_hobby ?? null,
    created_at: u.created_at, univ_name: u.univ_name ?? null, job: u.job ?? null, religion: u.religion ?? null,
    politics: u.politics_public ? (u.politics ?? null) : null,
    extra_answers: u.extra_answers ?? [], education: u.education ?? null,
    featured: feat.has(u.id),
    basic_verified: !!u.gender && !!u.age_locked && !!String(u.phone ?? '').trim(),
    credentials: creds,
  };
}
// 보여 줄 수 있는 사람만(프로필 완성 · 공개 중지 아님 · 숨김 아님)
function rowsFor(ids: string[], includeHidden: boolean): Row[] {
  const feat = featuredIds();
  const viewer = uid();
  return ids.map((id) => userById(id))
    .filter((u): u is Row => !!u && u.id !== viewer && !!u.profile_completed && !u.affinity_suspended && (includeHidden || !u.affinity_hidden))
    .map((u) => profileRow(u, feat));
}

// ── 오늘의 인연 배치(실제 deck_candidates · deck_pick · ensure_deck_batch) ─────────
function hash(s: string): number { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h >>> 0; }
function exchangedIds(): Set<string> {
  const me_ = uid();
  return new Set(table('profile_exchanges')
    .filter((e) => (e.requester_id === me_ || e.target_id === me_) && (e.status === 'accepted' || e.status === 'released'))
    .map((e) => (e.requester_id === me_ ? e.target_id : e.requester_id)));
}
function likedIds(): Set<string> {
  return new Set([
    ...table('interests').filter((i) => i.sender_id === ME_ID).map((i) => i.receiver_id),
    ...table('letters').filter((l) => l.sender_id === ME_ID).map((l) => l.receiver_id),
  ]);
}
// 본 사람 → 마지막으로 본 날짜
function seenDates(): Map<string, string> {
  const m = new Map<string, string>();
  const add = (pid: string, d: string) => { if (!m.has(pid) || (m.get(pid) as string) < d) m.set(pid, d); };
  table('friend_views').filter((r) => r.user_id === ME_ID).forEach((r) => add(r.profile_id, r.viewed_on));
  table('deck_views').filter((r) => r.user_id === ME_ID).forEach((r) => add(r.profile_id, r.batch_date));
  table('deck_reveals').filter((r) => r.user_id === ME_ID).forEach((r) => add(r.profile_id, r.batch_date));
  table('friend_deck_extras').filter((r) => r.user_id === ME_ID).forEach((r) => add(r.profile_id, r.day));
  return m;
}
const norm = (s: string) => String(s ?? '').replace(/\s+/g, '');
const LEGACY_REGIONS = ['서울/강남', '서울/성동', '서울/마포', '서울/송파', '경기/수원', '경기/용인', '경기/성남', '경기/화성'];
function regionMatch(region: string | null, wanted: string[]): boolean {
  if (!region) return false;
  const mine = norm(region);
  return wanted.some((w0) => {
    const w = norm(w0);
    if (w === mine) return true;
    if (!w.includes('/') && w === mine.split('/')[0]) return true;
    return w.includes('/') && w.split('/')[1] === '기타' && w.split('/')[0] === mine.split('/')[0] && !LEGACY_REGIONS.includes(mine);
  });
}
const anyPref = (v: any) => !!v && v !== '상관없음';
// 나의 취향을 모두 만족하는지 + 가점
function prefCheck(u: Row, pf: Row): { ok: boolean; score: number } {
  let ok = true; let score = 0;
  if (!pf.ageAny && pf.minAge != null && pf.maxAge != null) {
    const inAge = u.age != null && u.age >= pf.minAge && u.age <= pf.maxAge;
    ok = ok && inAge; if (inAge) score += 3;
  }
  if (Array.isArray(pf.regions) && pf.regions.length) {
    const hit = regionMatch(u.region, pf.regions);
    ok = ok && hit; if (hit) score += 3;
  }
  if (Array.isArray(pf.mbtis) && pf.mbtis.length) {
    const hit = !!u.mbti && pf.mbtis.includes(u.mbti);
    ok = ok && hit; if (hit) score += 2;
  }
  if (anyPref(pf.religion)) { const hit = u.religion === pf.religion; ok = ok && hit; if (hit) score += 1; }
  if (anyPref(pf.politics)) { const hit = !!u.politics_public && u.politics === pf.politics; ok = ok && hit; if (hit) score += 1; }
  if (anyPref(pf.drinking)) { const hit = u.drinking === pf.drinking; ok = ok && hit; if (hit) score += 1; }
  if (anyPref(pf.smoking)) { const hit = u.smoking === pf.smoking; ok = ok && hit; if (hit) score += 1; }
  return { ok, score };
}
// 후보 순서 — 처음 보는 사람 → (본 사람은 오래전에 본 순) → 마음·편지 보낸 사람은 맨 뒤 · 취향 만족 먼저 · 가점 · 배치별 고정 셔플
// 프로필을 교환한 사람은 실제로는 빠진다. 시연판은 사람이 적어서, 8명이 안 차면 맨 뒤에 붙여 채운다(fillWithExchanged).
function rankedCandidates(batch: string, fillWithExchanged = false): string[] {
  const viewer = uid();
  const mine = viewer ? me() : undefined;
  const g = viewer ? opposite(mine?.gender) : 'M';   // 비회원은 남성 기준(실제와 같다)
  const pf: Row = mine?.match_prefs ?? {};
  const ex = viewer ? exchangedIds() : new Set<string>();
  const liked = viewer ? likedIds() : new Set<string>();
  const seen = viewer ? seenDates() : new Map<string, string>();
  const salt = mine?.demo_deck_salt ?? '';
  return table('users')
    .filter((u) => u.id !== viewer && u.profile_completed && !u.affinity_suspended && !u.affinity_hidden
      && (!g || u.gender === g) && (fillWithExchanged || !ex.has(u.id)))
    .map((u) => {
      const p = prefCheck(u, pf);
      return { id: u.id, ex: ex.has(u.id) ? 1 : 0, tier: liked.has(u.id) ? 2 : seen.has(u.id) ? 1 : 0, last: seen.get(u.id) ?? '', ok: p.ok ? 1 : 0, score: p.score, h: hash(`${batch}:${viewer ?? 'guest'}:${salt}:${u.id}`) };
    })
    .sort((a, b) => a.ex - b.ex || a.tier - b.tier || (a.tier === 1 ? a.last.localeCompare(b.last) : 0) || b.ok - a.ok || b.score - a.score || a.h - b.h)
    .map((c) => c.id);
}
function pickBatch(batch: string): string[] {
  const ranked = rankedCandidates(batch, true);
  const mine = uid() ? me() : undefined;
  // 비회원·가입 첫날은 추천 프로필 1~3명을 앞에
  const firstDay = !mine || kstDate(Date.parse(mine.created_at)) === kstDate();
  let feat: string[] = [];
  if (firstDay) {
    const f = featuredIds();
    feat = ranked.filter((id) => f.has(id)).slice(0, 1 + (hash(batch) % 3));
  }
  return [...feat, ...ranked.filter((id) => !feat.includes(id))].slice(0, RULE.deckSize);
}
// 내 이번 배치 8명 — 없으면 정해서 고정
function ensureBatch(): string[] {
  const viewer = uid();
  const batch = batchDate();
  if (!viewer) return pickBatch(batch);
  const hit = table('deck_batches').find((b) => b.user_id === viewer && b.batch_date === batch);
  if (hit) return hit.ids;
  const ids = pickBatch(batch);
  if (ids.length) insertRows('deck_batches', { user_id: viewer, batch_date: batch, ids });
  return ids;
}
// 다음 추가 소개 후보 n명(이번 배치 · 이번에 이미 받은 사람 제외)
function nextPids(n: number): string[] {
  const batch = batchDate();
  const inBatch = new Set(ensureBatch());
  const got = new Set(table('friend_deck_extras').filter((e) => e.user_id === ME_ID && e.day === batch).map((e) => e.profile_id));
  return rankedCandidates(batch).filter((id) => !inBatch.has(id) && !got.has(id)).slice(0, n);
}
// 나와 관련된 사람(실제 profile_visible_ids) — 이 사람들 프로필만 목록으로 내려간다
function visibleIds(): string[] {
  const viewer = uid();
  if (!viewer) return ensureBatch();
  const s = new Set<string>(ensureBatch());
  table('friend_deck_extras').filter((e) => e.user_id === viewer).forEach((e) => s.add(e.profile_id));
  table('interests').forEach((i) => { if (i.sender_id === viewer) s.add(i.receiver_id); if (i.receiver_id === viewer) s.add(i.sender_id); });
  table('letters').forEach((l) => { if (l.sender_id === viewer) s.add(l.receiver_id); if (l.receiver_id === viewer) s.add(l.sender_id); });
  table('profile_exchanges').forEach((x) => { if (x.requester_id === viewer) s.add(x.target_id); if (x.target_id === viewer) s.add(x.requester_id); });
  table('affinity_ratings').forEach((a) => { if (a.rater_id === viewer) s.add(a.ratee_id); if (a.ratee_id === viewer) s.add(a.rater_id); });
  table('friend_views').filter((v) => v.user_id === viewer).forEach((v) => s.add(v.profile_id));
  table('deck_views').filter((v) => v.user_id === viewer).forEach((v) => s.add(v.profile_id));
  s.delete(viewer);
  return [...s];
}

// ── 관심(마음) 보내기 뒤처리 — 실제 서버의 interests 트리거 몫 ───────────────────
// 앱은 supabase.from('interests').insert(...)로 보내므로, 그 행이 들어오면 여기서 미션 보상을 준다.
// 하루 첫·두 번째(처음 마음 보내는 상대만) 각 5리프.
onRowChange((e) => {
  if (e.table !== 'interests' || e.type !== 'INSERT' || e.row.sender_id !== ME_ID) return;
  const before = table('interests').some((i) => i !== e.row && i.id !== e.row.id && i.sender_id === ME_ID && i.receiver_id === e.row.receiver_id);
  if (before) return;
  if (!grantMission('like1', RULE.missionLike)) grantMission('like2', RULE.missionLike);
});

// ── 서버 함수 ──────────────────────────────────────────────────────────────
export const rpc: Record<string, (args: any) => any> = {
  // 내 전체 행(setof users)
  get_me: () => { const u = me(); return uid() && u ? [{ ...u }] : []; },

  // 오늘의 인연 — 배치 8명(slot 0~7) + 이번 배치에 추가로 받은 사람(extra)
  get_my_deck: () => {
    const viewer = uid();
    if (viewer && !eligible(me())) return [];
    // 밸런스로 앞당겨 소개한 사람은 원래 칸에서 빼고 밸런스 자리에 보인다(시연판은 사람이 적어 배치 안에서 데려온다)
    const pulled = new Set(viewer ? table('friend_deck_extras').filter((e) => e.user_id === viewer && e.day === batchDate() && e.balance).map((e) => e.profile_id) : []);
    const ids = ensureBatch().filter((id) => !pulled.has(id));
    const out: Row[] = rowsFor(ids, false).map((r) => ({ ...r, slot: ids.indexOf(r.user_id), extra: null, extra_at: null }));
    if (viewer) {
      const batch = batchDate();
      const extras = table('friend_deck_extras').filter((e) => e.user_id === viewer && e.day === batch && !ids.includes(e.profile_id));
      for (const e of extras) {
        const r = rowsFor([e.profile_id], true)[0];
        if (r) out.push({ ...r, slot: null, extra: e.balance ? 'balance' : e.bonus ? 'bonus' : 'paid', extra_at: e.created_at, balance_chip: e.balance ? BALANCE_Q[e.balance as BalanceSide].chip : null });
      }
    }
    return out;
  },
  deck_next_available: () => !uid() || nextPids(RULE.extraPerBuy).length >= RULE.extraPerBuy,

  // 추가 소개 — 20리프로 두 명, 배치당 한 번
  buy_extra_friend: () => {
    myRow();
    const batch = batchDate();
    if (table('friend_deck_extras').some((e) => e.user_id === ME_ID && e.day === batch && !e.bonus && !e.balance)) return 'limit';
    const pids = nextPids(RULE.extraPerBuy);
    if (pids.length < RULE.extraPerBuy) return 'none';
    chargeLeaf(price('extra'), 'deck_extra_friend');
    insertRows('friend_deck_extras', pids.map((pid) => ({ user_id: ME_ID, profile_id: pid, day: batch, bonus: false })));
    return 'ok';
  },

  // 오늘의 밸런스 — 이번 배치에 고른 답(없으면 null)
  get_my_balance: () => {
    const viewer = uid();
    if (!viewer) return null;
    const r = table('balance_picks').find((b) => b.user_id === viewer && b.day === batchDate());
    return r ? { choice: r.choice, chip: r.chip, profile_id: r.profile_id } : null;
  },
  // 답 고르기 — 하루 한 번. 같은 쪽을 고른 한 사람을 오늘의 인연에 더한다(실제는 같은 답을 고른 회원 중에서 고른다)
  pick_balance: ({ p_choice }: { p_choice: BalanceSide }) => {
    myRow();
    if (p_choice !== 'a' && p_choice !== 'b') throw new Error('invalid choice');
    const batch = batchDate();
    const had = table('balance_picks').find((b) => b.user_id === ME_ID && b.day === batch);
    if (had) return { choice: had.choice, chip: had.chip, profile_id: had.profile_id };
    // 같은 쪽을 고른 사람 — 이번 배치 밖의 새 사람이 먼저. 시연판은 사람이 적어서 없으면 아직 공개 전인 오늘의 인연을 앞당긴다
    const batchIds = ensureBatch();
    const kst = new Date(now() + 9 * HOUR).getUTCHours();
    const open = kst >= 21 ? 8 : kst >= 18 ? 6 : kst >= 15 ? 4 : kst >= 12 ? 2 : 8;
    const pid = nextPids(1)[0] ?? batchIds.slice(open).slice(-1)[0] ?? batchIds.slice(-1)[0] ?? null;
    const chip = BALANCE_Q[p_choice].chip;
    insertRows('balance_picks', { user_id: ME_ID, day: batch, choice: p_choice, chip, profile_id: pid });
    if (pid) insertRows('friend_deck_extras', { user_id: ME_ID, profile_id: pid, day: batch, bonus: false, balance: p_choice });
    return { choice: p_choice, chip, profile_id: pid };
  },

  // 목록용 프로필 — 나와 관련된 사람만. target_user를 주면 그 한 명
  get_friend_profiles: ({ target_user, want_gender }: { target_user?: string | null; want_gender?: string | null }) => {
    if (uid() && !eligible(me())) return [];
    // 시연판은 상세 화면이 비지 않게 '관련된 사람' 조건 없이 한 명을 돌려준다(실제는 관련된 사람만)
    const rows = target_user ? rowsFor([target_user], true) : rowsFor(visibleIds(), false);
    return rows.filter((r) => !want_gender || r.gender === want_gender)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  // 덱 카드 표지 열기 · 덱에서 프로필 열기 기록
  record_deck_reveal: ({ p_profile_id }: { p_profile_id: string }) => {
    const viewer = uid();
    if (!viewer || !p_profile_id || p_profile_id === viewer) return null;
    const batch = batchDate();
    const mine = table('deck_reveals').filter((r) => r.user_id === viewer && r.batch_date === batch);
    if (mine.length < 12 && !mine.some((r) => r.profile_id === p_profile_id)) insertRows('deck_reveals', { user_id: viewer, profile_id: p_profile_id, batch_date: batch });
    return null;
  },
  record_deck_view: ({ p_profile_id }: { p_profile_id: string }) => {
    const viewer = uid();
    if (!viewer || !p_profile_id || p_profile_id === viewer) return null;
    const batch = batchDate();
    const mine = table('deck_views').filter((r) => r.user_id === viewer && r.batch_date === batch);
    if (mine.length < 12 && !mine.some((r) => r.profile_id === p_profile_id)) insertRows('deck_views', { user_id: viewer, profile_id: p_profile_id, batch_date: batch });
    return null;
  },
  my_deck_history: () => {
    if (!uid()) return [];
    const seen = seenDates();
    const liked = likedIds();
    const ids = new Set([...seen.keys(), ...liked]);
    return [...ids].map((pid) => ({ profile_id: pid, liked: liked.has(pid), last_seen: seen.get(pid) ?? null }));
  },
  // 8명 모두 읽기 → 3리프(21시부터 판정)
  claim_deck_read_reward: ({ p_ids }: { p_ids: string[] }) => {
    myRow();
    const ids = [...new Set((p_ids ?? []).filter((x) => x !== ME_ID))];
    if (ids.length < RULE.deckSize) return { granted: false, reason: 'need_8' };
    const h = kstHour();
    if (h >= 12 && h <= 20) return { granted: false, reason: 'not_all_released' };
    const batch = batchDate();
    const seen = new Set([
      ...table('friend_views').filter((v) => v.user_id === ME_ID && ids.includes(v.profile_id) && v.viewed_on >= batch).map((v) => v.profile_id),
      ...table('deck_views').filter((v) => v.user_id === ME_ID && ids.includes(v.profile_id) && v.batch_date === batch).map((v) => v.profile_id),
    ]);
    if (seen.size < RULE.deckSize) return { granted: false, reason: 'not_viewed', seen: seen.size };
    const ok = grantMission('deck_read', RULE.missionDeckRead);
    return { granted: ok, amount: ok ? RULE.missionDeckRead : 0 };
  },

  // 상세 열람 기록 — 하루 10명 무료, 넘으면 needs_payment → 리프 100
  record_friend_view: ({ p_profile_id, p_currency }: { p_profile_id: string; p_currency?: 'leaf' | 'point' | null }) => {
    const u = myRow();
    const empty = { views_today: 0, rewarded: false, charged: 0, needs_payment: false };
    if (!p_profile_id || p_profile_id === ME_ID || !userById(p_profile_id)) return empty;
    const today = kstDate();
    const todays = () => table('friend_views').filter((v) => v.user_id === ME_ID && v.viewed_on === today);
    const already = todays().some((v) => v.profile_id === p_profile_id);
    const exchanged = table('profile_exchanges').some((x) => x.status === 'accepted'
      && ((x.requester_id === ME_ID && x.target_id === p_profile_id) || (x.target_id === ME_ID && x.requester_id === p_profile_id)));
    const free = u.gender === 'F' || exchanged;
    let charged = 0;
    if (!already && todays().length >= RULE.freeViewsPerDay && !free) {
      if (!p_currency) return { views_today: todays().length, rewarded: false, charged: 0, needs_payment: true };
      if (p_currency === 'point') {
        if ((u.points ?? 0) < RULE.overViewCost) throw new DemoError('포인트가 부족해요', '53100');
        setMe({ points: (u.points ?? 0) - RULE.overViewCost });
      } else {
        chargeLeaf(RULE.overViewCost, 'friend_view_over_quota', { feature: 'friend_view_over_quota', profile_id: p_profile_id, date: today });
      }
      charged = RULE.overViewCost;
    }
    if (!already) insertRows('friend_views', { user_id: ME_ID, profile_id: p_profile_id, viewed_on: today });
    return { views_today: todays().length, rewarded: false, charged, needs_payment: false };
  },

  // 마음함 사진 7일 가림 · 다시 보기(10리프)
  mind_photo_state: () => {
    if (!uid()) return [];
    const m = new Map<string, Row>();
    const get = (pid: string) => { if (!m.has(pid)) m.set(pid, { profile_id: pid, received_at: null, sent_at: null, unlocked_until: null }); return m.get(pid) as Row; };
    for (const i of table('interests')) {
      if (i.receiver_id === ME_ID) { const r = get(i.sender_id); if (!r.received_at || i.created_at > r.received_at) r.received_at = i.created_at; }
      if (i.sender_id === ME_ID) { const r = get(i.receiver_id); if (!r.sent_at || i.created_at > r.sent_at) r.sent_at = i.created_at; }
    }
    for (const r of m.values()) r.unlocked_until = table('mind_photo_unlocks').find((x) => x.user_id === ME_ID && x.profile_id === r.profile_id)?.until ?? null;
    return [...m.values()];
  },
  unlock_mind_photo: ({ p_profile_id }: { p_profile_id: string }) => {
    myRow();
    if (!p_profile_id || p_profile_id === ME_ID) throw new DemoError('invalid profile', '22023');
    const times = table('interests')
      .filter((i) => (i.receiver_id === ME_ID && i.sender_id === p_profile_id) || (i.sender_id === ME_ID && i.receiver_id === p_profile_id))
      .map((i) => Date.parse(i.created_at));
    if (!times.length) throw new DemoError('마음을 주고받은 사람만 다시 볼 수 있어요', '22023');
    const base = Math.max(...times);
    const until = table('mind_photo_unlocks').find((x) => x.user_id === ME_ID && x.profile_id === p_profile_id)?.until;
    if (until && Date.parse(until) > now()) return until;                                     // 이미 열려 있음
    if (base > now() - RULE.mindPhotoDays * DAY) return new Date(base + RULE.mindPhotoDays * DAY).toISOString();  // 아직 안 가려짐
    chargeLeaf(price('mind_photo'), 'mind_photo_unlock');
    const next = new Date(now() + RULE.mindPhotoDays * DAY).toISOString();
    deleteRows('mind_photo_unlocks', (x) => x.user_id === ME_ID && x.profile_id === p_profile_id);
    insertRows('mind_photo_unlocks', { user_id: ME_ID, profile_id: p_profile_id, until: next });
    return next;
  },

  // 예전 '오늘의 친구' 연락처(연결이 수락된 사람만)
  has_connection_contact_unlock: ({ other_id }: { other_id: string }) =>
    table('connection_contact_unlocks').some((x) => x.user_id === uid() && x.other_user_id === other_id),
  get_connection_contact: ({ other_id }: { other_id: string }) => {
    const viewer = uid();
    const approved = table('connections').some((c) => c.status === 'approved'
      && ((c.requester_id === viewer && c.target_id === other_id) || (c.requester_id === other_id && c.target_id === viewer)));
    const opened = table('connection_contact_unlocks').some((x) => x.user_id === viewer && x.other_user_id === other_id);
    return approved && opened ? (userById(other_id)?.phone ?? null) : null;
  },
  unlock_connection_contact: ({ p_other_id, p_currency }: { p_other_id: string; p_currency: 'leaf' | 'point' }) => {
    const u = myRow();
    const approved = table('connections').some((c) => c.status === 'approved'
      && ((c.requester_id === ME_ID && c.target_id === p_other_id) || (c.requester_id === p_other_id && c.target_id === ME_ID)));
    if (!approved) throw new DemoError('연결이 수락된 친구만 연락처를 볼 수 있어요', 'P0001');
    if (table('connection_contact_unlocks').some((x) => x.user_id === ME_ID && x.other_user_id === p_other_id)) return true;
    if (u.gender === 'F') { insertRows('connection_contact_unlocks', { user_id: ME_ID, other_user_id: p_other_id, currency: 'leaf', cost: 0 }); return true; }
    if (p_currency === 'point') {
      if ((u.points ?? 0) < RULE.contactCost) throw new DemoError('포인트가 부족해요', '53100');
      setMe({ points: (u.points ?? 0) - RULE.contactCost });
    } else {
      chargeLeaf(RULE.contactCost, 'connection_contact', { feature: 'connection_contact', other_user_id: p_other_id });
    }
    insertRows('connection_contact_unlocks', { user_id: ME_ID, other_user_id: p_other_id, currency: p_currency, cost: RULE.contactCost });
    return true;
  },

  // 프로필 교환(커뮤니티)으로 이어진 사람
  exchanged_user_ids: () => (uid() ? [...exchangedIds()] : []),
  can_view_exchanged_profile: ({ p_other }: { p_other: string }) => {
    const viewer = uid();
    if (!viewer) return false;
    if (table('blocks').some((b) => b.blocker_id === viewer && b.blocked_id === p_other)) return false;
    const x = table('profile_exchanges').find((e) => e.status === 'accepted'
      && ((e.requester_id === viewer && e.target_id === p_other) || (e.target_id === viewer && e.requester_id === p_other)));
    if (!x) return false;
    const mineCol = x.requester_id === viewer ? 'requester_viewed_at' : 'target_viewed_at';
    const blockedByOther = table('blocks').some((b) => b.blocker_id === p_other && b.blocked_id === viewer);
    if (blockedByOther && x[mineCol]) return false;
    if (!x[mineCol]) updateRows('profile_exchanges', (e) => e.id === x.id, { [mineCol]: nowIso() });
    return true;
  },

  // 차단 관리 — 아는 사람만 이름 · 사진
  my_blocks: () => {
    const viewer = uid();
    if (!viewer) return [];
    const known = new Set(visibleIds());
    return table('blocks').filter((b) => b.blocker_id === viewer)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map((b) => {
        const u = known.has(b.blocked_id) ? userById(b.blocked_id) : undefined;
        return { blocked_id: b.blocked_id, nickname: u?.nickname ?? null, photo: u?.photos?.[0] ?? null, created_at: b.created_at };
      });
  },

  // 가입 — 생년월일(만 19~39세), 한 번 정하면 못 바꿔요
  set_birth_date: ({ p_year, p_month, p_day }: { p_year: number; p_month: number; p_day: number }) => {
    const u = myRow();
    if (!p_year || p_year < 1900 || p_year > new Date(now()).getFullYear()) throw new DemoError('invalid year', '22023');
    if (!p_month || p_month < 1 || p_month > 12) throw new DemoError('invalid month', '22023');
    if (!p_day || p_day < 1 || p_day > 31) throw new DemoError('invalid day', '22023');
    const age = manAge(p_year, p_month, p_day, now());
    if (age < 19) throw new DemoError('만 19세 이상만 가입할 수 있어요', '42501');
    if (age >= 40) throw new DemoError('만 40세 이상은 가입할 수 없어요', '42501');
    if (u.age_locked) throw new DemoError('age already set', '42501');
    setMe({ age, age_locked: true, birth_year: p_year, birth_month: p_month, birth_day: p_day });
    return null;
  },
  touch_active_day: () => {
    const viewer = uid();
    const day = kstDate();
    if (viewer && !table('user_active_days').some((r) => r.user_id === viewer && r.day === day)) insertRows('user_active_days', { user_id: viewer, day });
    return null;
  },
  mark_tab_guide_seen: ({ p_key }: { p_key: string }) => {
    const u = myRow();
    if (!['profile', 'profile-0', 'profile-1', 'profile-2', 'community', 'place', 'my'].includes(p_key)) throw new DemoError('invalid key', '22023');
    const seen = { ...(u.tab_guides_seen ?? {}), [p_key]: true };
    setMe({ tab_guides_seen: seen });
    return seen;
  },

  // 무료 리프 미션 · 리프 가격 · 리프 전환 안내
  my_missions_today: () => {
    const day = kstDate();
    const out: Record<string, number> = {};
    table('reward_grants').filter((r) => r.user_id === uid() && r.day === day).forEach((r) => { out[r.mission] = r.amount; });
    return out;
  },
  ensure_min_leaf_100: () => {
    const u = myRow();
    if ((u.leaf_balance ?? 0) < 100) setMe({ leaf_balance: 100 });
    return null;
  },
  get_leaf_pricing: () => {
    const female = !!uid() && me()?.gender === 'F';
    return { event: eventOn(), event_until: new Date(EVENT_UNTIL).toISOString(), prices: priceTable(female, eventOn()), normal: priceTable(female, false) };
  },
  my_leaf_conversion: () => table('leaf_conversions').filter((c) => c.user_id === uid())
    .map((c) => ({ before: c.before, after: c.after, converted_at: c.converted_at, notice_seen_at: c.notice_seen_at ?? null })),
  ack_leaf_conversion: () => { updateRows('leaf_conversions', (c) => c.user_id === uid() && !c.notice_seen_at, { notice_seen_at: nowIso() }); return null; },

  // 인증(학력 · 직장 · 소득) — 종류마다 한 건, 다시 신청하면 검토 대기로
  submit_credential: ({ p_kind, p_label, p_proof_path }: { p_kind: string; p_label: string; p_proof_path: string }) =>
    upsertCredential(p_kind, p_label, { proof_path: p_proof_path, verified_email: null }, ['school', 'company', 'income']),
  submit_email_credential: ({ p_kind, p_label }: { p_kind: string; p_label: string }) =>
    // 실제는 30분 안에 학교·회사 메일 인증을 마쳐야 해요. 시연판은 메일 확인 없이 받아요
    upsertCredential(p_kind, p_label, { proof_path: null, verified_email: me()?.email ?? 'demo@yahwa.local' }, ['school', 'company']),
  withdraw_credential: ({ p_kind }: { p_kind: string }) => {
    myRow();
    const gone = deleteRows('profile_credentials', (c) => c.user_id === ME_ID && c.kind === p_kind);
    return gone[0]?.proof_path ?? null;
  },

  // ── 예전 화면용(지금 앱에서는 거의 안 불려요) ──
  get_profile_cards: () => {
    const viewer = uid();
    if (!viewer) return [];
    return table('users').filter((u) => u.id !== viewer && u.profile_completed && !u.affinity_suspended).slice(0, 100)
      .map((u) => ({ user_id: u.id, tags: [], visible: true, photo_count: (u.photos ?? []).length, cover_photo: u.photos?.[0] ?? null, nickname: u.nickname, age: u.age ?? null, region: u.region ?? null, headline: u.headline ?? null }));
  },
  get_profile_full: ({ target_id }: { target_id: string }) => {
    const viewer = requireUid();
    const u = userById(target_id);
    if (!u) return [];
    const unlocked = viewer === target_id || table('unlocks').some((x) => x.user_id === viewer && x.target_profile_id === target_id);
    return [{
      user_id: u.id, photos: unlocked ? (u.photos ?? []) : [], intro: unlocked ? (u.intro_want ?? null) : null,
      basic_info: unlocked ? { job: u.job, mbti: u.mbti, height: u.height } : null, tags: [],
      nickname: u.nickname, age: u.age ?? null, region: u.region ?? null, headline: u.headline ?? null, unlocked,
    }];
  },
  unlock_profile: ({ target_profile_id }: { target_profile_id: string }) => {
    const u = myRow();
    if (target_profile_id === ME_ID) throw new DemoError('cannot unlock self', '22023');
    if (table('unlocks').some((x) => x.user_id === ME_ID && x.target_profile_id === target_profile_id)) return 0;
    if (table('blocks').some((b) => (b.blocker_id === ME_ID && b.blocked_id === target_profile_id) || (b.blocker_id === target_profile_id && b.blocked_id === ME_ID))) {
      throw new DemoError('blocked', '42501');
    }
    const cost = u.gender === 'F' ? 0 : RULE.unlockProfileCost;
    if (cost > 0) chargeLeaf(cost, 'unlock_profile', { target_profile_id });
    insertRows('unlocks', { user_id: ME_ID, target_profile_id, cost_leaf: cost });
    return cost;
  },
};

function upsertCredential(kind: string, label0: string, extra: Row, kinds: string[]) {
  myRow();
  const label = String(label0 ?? '').replace(/\s+/g, ' ').trim();
  if (!kinds.includes(kind)) throw new DemoError('invalid kind', '22023');
  if (label.length < 2 || label.length > 40) throw new DemoError('invalid label', '22023');
  const old = table('profile_credentials').find((c) => c.user_id === ME_ID && c.kind === kind);
  const patch = {
    label, ref_year: kind === 'income' ? new Date(now() + 9 * HOUR).getUTCFullYear() - 1 : null, ...extra,
    status: 'pending', reject_reason: null, created_at: nowIso(), reviewed_at: null,
  };
  const row = old
    ? updateRows('profile_credentials', (c) => c === old, patch)[0]
    : insertRows('profile_credentials', { user_id: ME_ID, kind, ...patch })[0];
  const replaced = old?.proof_path && old.proof_path !== extra.proof_path ? old.proof_path : null;
  return { id: row.id, replaced_proof: replaced };
}

// ── 시연도구 오른쪽 패널에서 부르는 조작 ────────────────────────────────────
// 나와 관련된 인연 기록을 지운다(마음 · 열람 · 덱 · 사진 다시 보기 · 미션)
function clearMyAffinity() {
  deleteRows('interests', (i) => i.sender_id === ME_ID || i.receiver_id === ME_ID);
  deleteRows('notifications', (n) => n.user_id === ME_ID && n.kind === 'interest');
  for (const t of ['friend_views', 'deck_batches', 'deck_reveals', 'deck_views', 'friend_deck_extras', 'mind_photo_unlocks', 'balance_picks']) deleteRows(t, (r) => r.user_id === ME_ID);
}
// 처음 상태의 마음함(HEART_PLAN)을 지금 성별에 맞게 다시 깐다 — 미션 보상이 붙지 않게 표에 바로 넣는다
function reseedMyHearts(gender: 'M' | 'F') {
  const rows = myHeartRows(gender, now());
  table('interests').push(...rows.interests);
  table('notifications').push(...rows.notifications);
  table('friend_views').push(...rows.friend_views);
  touch();
}

export const controls = {
  // 내 성별 바꾸기 — 오늘의 인연이 반대 성별로 다시 뽑히고, 마음함도 그 성별 사람들로 다시 채워져요
  // 오늘의 밸런스 다시 하기 — 오늘 고른 답과 그 답으로 소개받은 사람을 지운다
  resetBalance() {
    const batch = batchDate();
    deleteRows('balance_picks', (b) => b.user_id === ME_ID && b.day === batch);
    deleteRows('friend_deck_extras', (e) => e.user_id === ME_ID && e.day === batch && !!e.balance);
  },
  setMyGender(g: 'F' | 'M') {
    const u = me();
    if (!u) return;
    setMe({ gender: g, photos: u.profile_completed ? fullMeFields(g).photos : u.photos });
    clearMyAffinity();
    if (u.profile_completed) reseedMyHearts(g);
  },
  // 방금 가입한 회원처럼 — 앱이 가입(생년월일·성별) → 인연 프로필 등록 단계를 보여 줘요
  resetMeToNewUser() {
    clearMyAffinity();
    deleteRows('profile_credentials', (c) => c.user_id === ME_ID);
    deleteRows('reward_grants', (r) => r.user_id === ME_ID);
    deleteRows('blocks', (b) => b.blocker_id === ME_ID);
    setMe({
      nickname: '야화친구', gender: null, age: null, age_locked: false, birth_year: null, birth_month: null, birth_day: null,
      phone: null, kakao_id: null, region: null, photos: [], headline: null, bio: null,
      intro_want: null, intro_interest: null, intro_hobby: null, extra_answers: [],
      job: null, education: null, religion: null, politics: null, politics_public: false,
      mbti: null, height: null, smoking: null, drinking: null, univ_name: null,
      match_prefs: {}, tab_guides_seen: {}, profile_completed: false,
      affinity_suspended: false, affinity_suspended_reason: null, affinity_suspended_at: null, affinity_hidden: false,
      leaf_balance: 0, points: 0, created_at: nowIso(), privacy_agreed_at: null,
    });
  },
  // 인연 프로필을 다 채운 회원으로 — 마음함이 비어 있으면 처음 상태로 채워요
  completeMyProfile() {
    const u = me();
    if (!u) return;
    const g: 'M' | 'F' = u.gender === 'F' ? 'F' : 'M';
    setMe({ ...fullMeFields(g), tab_guides_seen: u.tab_guides_seen && Object.keys(u.tab_guides_seen).length ? u.tab_guides_seen : ALL_GUIDES_SEEN });
    if (!table('interests').some((i) => i.sender_id === ME_ID || i.receiver_id === ME_ID)) reseedMyHearts(g);
  },
  setMyLeaf(n: number) { setMe({ leaf_balance: Math.max(0, Math.floor(n)) }); },
};

// ── 시연도구 '상황 만들기' ─────────────────────────────────────────────────
function oppositePeople(): Row[] {
  const g = opposite(me()?.gender) ?? 'F';
  return PEOPLE.filter((p) => p.gender === g).map((p) => userById(p.id)).filter((u): u is Row => !!u && !!u.profile_completed);
}
function receiveHeart(from: Row) {
  const at = nowIso();
  insertRows('interests', { sender_id: from.id, receiver_id: ME_ID, created_at: at });
  insertRows('notifications', {
    user_id: ME_ID, kind: 'interest', title: '새로운 관심이 도착했어요',
    body: `${from.nickname} 님이 회원님에게 관심을 보냈어요. 호감 탭에서 확인해보세요.`,
    data: { kind: 'interest', otherUserId: from.id }, read: false, created_at: at,
  });
}
const lastAt = (pred: (i: Row) => boolean) => table('interests').filter(pred).reduce((m, i) => (i.created_at > m ? i.created_at : m), '');
let lastMutualId: string | null = null;

export const scenarios: Scenario[] = [
  {
    id: 'affinity-new-heart', group: '인연', label: '새 마음 받기',
    hint: '다른 성별 한 명이 나에게 마음을 보내요',
    run: () => {
      myRow();
      const list = oppositePeople();
      if (!list.length) return '마음을 보낼 사람이 없어요.';
      // 아직 나에게 마음을 안 보낸 사람 먼저, 다 보냈으면 가장 오래전에 보낸 사람
      const from = list.find((u) => !lastAt((i) => i.sender_id === u.id && i.receiver_id === ME_ID))
        ?? [...list].sort((a, b) => lastAt((i) => i.sender_id === a.id && i.receiver_id === ME_ID).localeCompare(lastAt((i) => i.sender_id === b.id && i.receiver_id === ME_ID)))[0];
      receiveHeart(from);
      return `${from.nickname} 님이 마음을 보냈어요. 마음함 '받은 마음'에서 볼 수 있어요.`;
    },
    go: { tab: 'heart' },
  },
  {
    id: 'affinity-mutual', group: '인연', label: '서로 마음 성사',
    hint: '내가 마음을 보낸 사람이 마음을 돌려줘요',
    run: () => {
      myRow();
      const list = oppositePeople();
      const sentTo = (u: Row) => !!lastAt((i) => i.sender_id === ME_ID && i.receiver_id === u.id);
      const gotFrom = (u: Row) => !!lastAt((i) => i.sender_id === u.id && i.receiver_id === ME_ID);
      let who = list.find((u) => sentTo(u) && !gotFrom(u));
      if (!who) {
        who = list.find((u) => !sentTo(u) && !gotFrom(u)) ?? list[0];
        if (!who) return '마음을 주고받을 사람이 없어요.';
        if (!sentTo(who)) table('interests').push({ id: `demo-int-${Date.now()}`, sender_id: ME_ID, receiver_id: who.id, created_at: new Date(now() - HOUR).toISOString() });
      }
      receiveHeart(who);
      lastMutualId = who.id;
      return `${who.nickname} 님과 서로 마음이 됐어요. 마음함 '서로 마음'에도 보여요.`;
    },
    // 실행한 뒤에 정해지는 사람으로 이동해요
    get go() { return lastMutualId ? { overlay: 'friendDetail', params: { friendUserId: lastMutualId } } : { tab: 'heart' as const }; },
  },
  {
    id: 'affinity-new-deck', group: '인연', label: '오늘의 인연 새로 받기',
    hint: '이번 배치 8명을 다시 뽑고 표지·추가 소개를 처음으로',
    run: () => {
      myRow();
      const batch = batchDate();
      deleteRows('deck_batches', (b) => b.user_id === ME_ID && b.batch_date === batch);
      deleteRows('deck_reveals', (r) => r.user_id === ME_ID && r.batch_date === batch);
      deleteRows('deck_views', (r) => r.user_id === ME_ID && r.batch_date === batch);
      deleteRows('friend_deck_extras', (r) => r.user_id === ME_ID && r.day === batch);
      setMe({ demo_deck_salt: Math.random().toString(36).slice(2, 8) });   // 순서가 바뀌게
      // 기기에 남은 '표지 연 기록'도 지워요(앱 화면은 새로고침 뒤에 표지부터 다시 보여요)
      try { localStorage.removeItem(`yahwa_deck_revealed:${ME_ID}`); localStorage.removeItem(`yahwa_deck_viewed:${ME_ID}`); } catch { /* 저장소 없음 */ }
      ensureBatch();
      const h = kstHour();
      const open = h < 12 ? RULE.deckSize : 2 * [12, 15, 18, 21].filter((x) => h >= x).length;
      return `새 인연 ${RULE.deckSize}명을 뽑았어요. 지금 시각엔 ${open}명이 열려 있어요. 표지부터 다시 보려면 페이지를 새로고침해 주세요.`;
    },
    go: { tab: 'affinity' },
  },
  {
    id: 'affinity-suspend', group: '인연', label: '프로필 공개 중지 ↔ 해제',
    hint: '운영팀이 내 인연 프로필 공개를 멈춘 상태를 켜고 꺼요',
    run: () => {
      const u = myRow();
      const on = !u.affinity_suspended;
      setMe(on
        ? { affinity_suspended: true, affinity_suspended_reason: '대표 사진에서 얼굴이 잘 보이지 않아요', affinity_suspended_at: nowIso(), affinity_review_requested_at: null }
        : { affinity_suspended: false, affinity_suspended_reason: null, affinity_suspended_at: null, affinity_review_requested_at: null });
      insertRows('notifications', {
        user_id: ME_ID, kind: on ? 'profile_suspended' : 'profile_restored',
        title: on ? '인연 프로필 공개가 중지됐어요' : '인연 프로필이 다시 공개됐어요',
        body: on ? '운영 정책에 맞지 않아 인연 프로필 공개를 잠시 중지했어요. MY에서 사유를 확인하고 프로필을 수정해 주세요.'
          : '프로필을 확인했어요. 다시 오늘의 인연에 소개돼요.',
        data: { reason: on ? '대표 사진에서 얼굴이 잘 보이지 않아요' : null }, read: false,
      });
      return on ? '공개 중지 상태예요. 인연 탭에 중지 안내가 보여요. 한 번 더 누르면 풀려요.' : '공개 중지를 풀었어요. 다시 오늘의 인연이 보여요.';
    },
    go: { tab: 'affinity' },
  },
  {
    id: 'affinity-credential-approve', group: '인연', label: '인증 심사 통과',
    hint: '검토 대기 중인 내 학력·직장·소득 인증을 승인해요',
    run: () => {
      myRow();
      const pending = table('profile_credentials').filter((c) => c.user_id === ME_ID && c.status === 'pending');
      if (!pending.length) return "검토 대기 중인 인증이 없어요. MY › 인증 관리에서 먼저 신청해 보세요.";
      const ko: Record<string, string> = { school: '학력', company: '직장', income: '소득' };
      for (const c of pending) {
        updateRows('profile_credentials', (x) => x === c, { status: 'approved', reviewed_at: nowIso(), proof_path: null, reject_reason: null });
        insertRows('notifications', {
          user_id: ME_ID, kind: 'credential_approved', title: `${ko[c.kind] ?? ''} 인증이 완료됐어요`,
          body: `'${c.label}' 인증이 프로필에 표시돼요. 제출한 자료는 검토가 끝나 바로 삭제돼요.`,
          data: { credentialId: c.id, credentialKind: c.kind }, read: false,
        });
      }
      return `인증 ${pending.length}건을 승인했어요. 내 프로필에 파란 배지가 붙어요.`;
    },
    go: { overlay: 'notifications' },
  },
];

