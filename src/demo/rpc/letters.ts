// 야화 시연판 — 편지 서버 함수(supabase.rpc) 목업 + 시연도구 '편지' 상황 버튼.
// 실제 서버(마이그레이션 0146 · 0152 · 0187 · 0190)와 같은 규칙 · 같은 응답 모양 · 같은 오류 문구로 흉내 내요.
//   list_my_letters · send_letter · read_letter · reply_letter · decline_letter · upgrade_letter · set_letter_marks · get_letter_marks
// 비용은 리프 정책 v2(연말까지 이벤트가)와 같아요. 리프가 모자라면 실제처럼 오류 코드 53100을 돌려줘요(앱이 충전 안내를 띄움).
import {
  table, insertRows, updateRows, requireUid, userById, nowIso, now, minutesAgo, DemoError, ME_ID, type Row,
} from '../db';
import { person, women } from '../people';
import type { Scenario } from '../scenario';
import type { DemoNavTarget } from '../bridge';

// ── 상황 버튼이 쓰는 글(여기를 고치면 돼요) ─────────────────────────────
// 여성 회원이 '나'에게 새로 보내는 편지. id별로 쓰고, 없는 사람은 DEFAULT_NEW_LETTER를 써요.
const NEW_LETTERS: Record<string, string> = {
  'u-f07':
    '안녕하세요, 대전에 사는 달빛편지예요.\n'
    + '연구실 창문으로 보이는 은행나무가 요즘 노랗게 물들어서, 점심마다 그 앞 벤치에 앉아 있어요. 오늘은 거기서 프로필을 다시 읽었어요.\n'
    + '사진 속 웃는 얼굴이 편안해 보여서, 이야기를 나눠 보면 좋겠다는 생각이 들었어요. 서울에 갈 일이 생기면 꼭 미리 말할게요.',
  'u-f08':
    '지난번 편지에는 답을 못 드려서 마음에 계속 걸렸어요. 그때는 일이 너무 바빠서 누군가를 만날 여유가 없었거든요.\n'
    + '좋아하는 꽃을 물어봐 주신 게 생각나서 이번엔 제가 먼저 써요. 라넌큘러스예요. 겹겹이 천천히 피는 꽃이요.\n'
    + '괜찮으시면 이번엔 제가 고른 꽃 이야기부터 시작해 봐요.',
  'u-f05':
    '편지를 받고 나서야 답장 말고 먼저 써 보고 싶어졌어요.\n'
    + '요즘은 논문 마감 때문에 연구실에서 밤을 자주 새는데, 새벽에 마시는 자판기 커피가 제일 맛있다는 걸 알게 됐어요.\n'
    + '연수동 쪽 산책길을 좋아해요. 언젠가 필름 카메라 하나씩 들고 같이 걸으면 재밌을 것 같아요.',
};
const DEFAULT_NEW_LETTER =
  '안녕하세요. 며칠 동안 프로필을 몇 번이나 다시 열어 봤어요.\n'
  + '말투가 다정한 분 같아서, 짧게라도 제 마음을 전해 보고 싶었어요. 저는 주말이면 동네 빵집을 찾아다니는 걸 좋아해요.\n'
  + '편할 때 답장 주시면, 좋아하는 동네 이야기도 들려주세요.';

// 상대가 내 편지에 답장할 때 쓰는 글
const REPLIES: Record<string, string> = {
  'u-f05':
    '편지 잘 받았어요. 골목 사진을 알아봐 주셔서 깜짝 놀랐어요. 맞아요, 연수동 집 근처예요.\n'
    + '서랍 속 카메라 꼭 꺼내 주세요. 다음에 필름 한 롤씩 들고 같이 걸어요. 현상비는 제가 아는 싼 곳이 있어요.',
  'u-f06':
    '첫 문장을 열 번이나 고치셨다니, 그 마음이 느껴져서 웃었어요. 충분히 잘 쓰셨어요.\n'
    + '저도 화성 성곽길 좋아해요. 해 질 무렵에 서장대까지 올라가 보셨어요? 같이 걸어요, 이번 주말 어때요?',
  'u-f08':
    '좋아하는 꽃은 라넌큘러스예요. 겹겹이 피는 게 꼭 천천히 마음을 여는 사람 같아서요.\n'
    + '다음에 꽃집에 오시면 예쁜 걸로 말고 제 이름을 말해 주세요. 제일 예쁜 걸로 골라 드릴게요.',
};
const DEFAULT_REPLY =
  '편지 고마워요. 여러 번 읽었어요.\n'
  + '저도 이야기를 더 나눠 보고 싶어요. 연락처 남겨요, 편할 때 연락 주세요.';

// 여성 회원이 편지 · 답장에 적는 연락처(가짜 값)
const CONTACTS: Record<string, { kakao: string | null; phone: string | null }> = {
  'u-f01': { kakao: 'bomvit_01', phone: null },
  'u-f02': { kakao: 'slow_afternoon', phone: null },
  'u-f03': { kakao: null, phone: '01020240303' },
  'u-f04': { kakao: 'small_wave_04', phone: '01020240404' },
  'u-f05': { kakao: 'sky_piece_05', phone: null },
  'u-f06': { kakao: 'cozy_day_06', phone: '01020240606' },
  'u-f07': { kakao: 'moon_letter_07', phone: null },
  'u-f08': { kakao: 'blue_night_08', phone: null },
};
const contactOf = (id: string) => CONTACTS[id] ?? { kakao: `yahwa_${id}`, phone: null };

// ── 가격 · 보관 규칙(실제 서버와 같아요) ──────────────────────────────────
const DAY = 86_400_000;
const EVENT_UNTIL = Date.parse('2027-01-01T00:00:00+09:00');   // 연말까지 오픈 특별가
type PriceKey = 'letter' | 'reply' | 'invite' | 'upgrade';
function price(what: PriceKey, uid: string): number {
  const female = isFemale(uid);
  const event = now() < EVENT_UNTIL;
  const letter = female ? (event ? 5 : 15) : (event ? 15 : 45);
  const invite = female ? (event ? 8 : 25) : (event ? 25 : 70);
  return { letter, reply: letter, invite, upgrade: invite - letter }[what];
}

const at = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
// 보관 기한: 연결 → 연결 시점 + 7일 / 읽음 → 읽은 날 + 7일 / 안 읽음 → 보낸 날 + 3일
function expiresAt(l: Row): string {
  const t = l.replied_at ? at(l.replied_at) + 7 * DAY : l.read_at ? at(l.read_at) + 7 * DAY : at(l.created_at) + 3 * DAY;
  return new Date(t).toISOString();
}
const isActive = (l: Row) => !l.refunded_at && now() < at(expiresAt(l));

// ── 도우미 ───────────────────────────────────────────────────────────
function isFemale(id: string): boolean {
  const u = userById(id);
  return (u?.gender ?? person(id)?.gender) === 'F';
}
function profileOf(id: string) {
  const u = userById(id);
  const p = person(id);
  const age = u?.age ?? (p ? new Date(now()).getFullYear() - p.birthYear : null);
  return { nickname: u?.nickname ?? p?.nickname ?? null, photo: (u?.photos ?? p?.photos ?? [])[0] ?? null, age };
}
function blockedBetween(a: string, b: string): boolean {
  return table('blocks').some((x) => (x.blocker_id === a && x.blocked_id === b) || (x.blocker_id === b && x.blocked_id === a));
}
const findLetter = (id: string) => table('letters').find((l) => l.id === id);

// 리프 차감(charge_leaf_flat) — 모자라면 53100
function chargeLeaf(uid: string, amount: number, reason: string) {
  if (amount <= 0) return;
  const u = userById(uid);
  if (!u) throw new DemoError('user not found', '02000');
  const bal = Number(u.leaf_balance ?? 0);
  if (bal < amount) throw new DemoError('insufficient leaf', '53100');
  updateRows('users', (x) => x.id === uid, { leaf_balance: bal - amount, updated_at: nowIso() });
  insertRows('transactions', { user_id: uid, kind: 'unlock', amount: -amount, provider: 'system', meta: { reason, currency: 'leaf' } });
}

function notify(userId: string, kind: string, title: string, body: string, data: Row) {
  insertRows('notifications', { user_id: userId, kind, title, body, data, read: false });
}

// 편지를 주고받으면 '보낸 관심'에도 남겨요(이미 있으면 그대로)
function touchInterest(from: string, to: string) {
  if (table('interests').some((i) => i.sender_id === from && i.receiver_id === to)) return;
  insertRows('interests', { sender_id: from, receiver_id: to });
}

// 본문 · 연락처 검사(letter_validate)
function validate(body: string, kakao: string | null, phone: string | null) {
  if (body.replace(/\s/g, '').length < 5) throw new DemoError('편지는 5글자 이상 적어주세요.', '22023');
  if (body.length > 2000) throw new DemoError('편지는 2000자까지 쓸 수 있어요.', '22023');
  if (kakao == null && phone == null) throw new DemoError('선택한 연락처를 입력해주세요.', '22023');
  if (kakao != null && kakao.length > 40) throw new DemoError('카톡 ID를 확인해주세요.', '22023');
  if (phone != null && !/^\+?[0-9]{8,15}$/.test(phone)) throw new DemoError('전화번호를 확인해주세요.', '22023');
}
const cleanKakao = (v: any) => (String(v ?? '').trim() || null);
const cleanPhone = (v: any) => (String(v ?? '').replace(/[^0-9+]/g, '') || null);
const profileReady = (u: Row | undefined) => !!u && u.profile_completed !== false && !u.affinity_suspended;

// 3일 동안 안 읽힌 편지 → 사라지고 리프 전액 환불(실제는 10분마다 도는 크론). 시연판은 편지함을 열 때 한 번 훑어요.
function expireLetters(): number {
  const limit = now() - 3 * DAY;
  const due = table('letters').filter((l) => !l.refunded_at && !l.read_at && !l.replied_at && at(l.created_at) < limit);
  for (const l of due) {
    updateRows('letters', (x) => x.id === l.id, { refunded_at: nowIso() });
    if (l.cost > 0) {
      const u = userById(l.sender_id);
      if (u) updateRows('users', (x) => x.id === l.sender_id, { leaf_balance: Number(u.leaf_balance ?? 0) + l.cost, updated_at: nowIso() });
      insertRows('transactions', {
        user_id: l.sender_id, kind: 'refund', amount: l.cost, provider: 'system', provider_tx_id: `letter_refund:${l.id}`,
        meta: { reason: 'letter_unread_refund', letter_id: l.id, currency: 'leaf' },
      });
      notify(l.sender_id, 'letter_refunded', '읽지 않은 편지가 돌아왔어요.', `3일 동안 읽히지 않은 편지가 사라지고 ${l.cost}리프가 돌아왔어요.`, { screen: 'letters' });
    }
  }
  return due.length;
}

// 편지 한 통 → 화면용 LetterRow(src/lib/api.ts). 연락처는 연결 전까지 '있다/없다'만 알려줘요.
function toLetterRow(l: Row, uid: string): Row {
  const out = l.sender_id === uid;
  const otherId = out ? l.receiver_id : l.sender_id;
  const o = profileOf(otherId);
  const linked = !!l.replied_at;
  return {
    id: l.id,
    direction: out ? 'out' : 'in',
    other_id: otherId, other_nickname: o.nickname, other_photo: o.photo, other_age: o.age,
    kind: l.kind, body: l.body, reply_body: l.reply_body ?? null,
    my_kakao: out ? l.sender_kakao ?? null : l.reply_kakao ?? null,
    my_phone: out ? l.sender_phone ?? null : l.reply_phone ?? null,
    their_kakao: !linked ? null : out ? l.reply_kakao ?? null : l.sender_kakao ?? null,
    their_phone: !linked ? null : out ? l.reply_phone ?? null : l.sender_phone ?? null,
    their_has_kakao: out ? l.reply_kakao != null : l.sender_kakao != null,
    their_has_phone: out ? l.reply_phone != null : l.sender_phone != null,
    cost: l.cost, reply_cost: l.reply_cost ?? null,
    created_at: l.created_at, read_at: l.read_at ?? null, replied_at: l.replied_at ?? null, declined_at: l.declined_at ?? null,
    expires_at: expiresAt(l),
  };
}

// 실제 send_letter와 같은 순서로 검사하고 편지를 남겨요(상황 버튼에서 상대가 '나'에게 보낼 때도 씀)
function sendLetterAs(uid: string, receiver: string, rawBody: string, rawKakao: any, rawPhone: any, kind: string): string {
  const body = String(rawBody ?? '').trim();
  const kakao = cleanKakao(rawKakao);
  const phone = cleanPhone(rawPhone);
  if (!receiver || receiver === uid) throw new DemoError('받는 사람을 확인해주세요.', '22023');
  if (kind !== 'letter' && kind !== 'invite') throw new DemoError('편지 종류를 확인해주세요.', '22023');
  validate(body, kakao, phone);
  if (!profileReady(userById(uid))) throw new DemoError('프로필을 완성하면 편지를 보낼 수 있어요.', '42501');
  const r = userById(receiver);
  if (!r || !profileReady(r) || r.affinity_hidden) throw new DemoError('지금은 편지를 보낼 수 없는 상대예요.', '42501');
  if (blockedBetween(uid, receiver)) throw new DemoError('지금은 편지를 보낼 수 없는 상대예요.', '42501');
  const letters = table('letters');
  if (letters.some((l) => l.sender_id === uid && l.receiver_id === receiver && isActive(l))) {
    throw new DemoError('이미 보낸 편지가 있어요.', '23505');
  }
  if (letters.some((l) => l.sender_id === receiver && l.receiver_id === uid && !l.declined_at && !l.replied_at && isActive(l))) {
    throw new DemoError('이분이 보낸 편지가 도착해 있어요. 편지함에서 답장해주세요.', '23505');
  }
  const cost = price(kind as PriceKey, uid);
  chargeLeaf(uid, cost, `letter_${kind}`);
  const [row] = insertRows('letters', {
    sender_id: uid, receiver_id: receiver, kind, body, sender_kakao: kakao, sender_phone: phone, cost,
    read_at: null, reply_body: null, reply_kakao: null, reply_phone: null, reply_cost: null,
    replied_at: null, declined_at: null, refunded_at: null, upgraded_at: null,
  });
  touchInterest(uid, receiver);
  notify(receiver, 'letter_arrived', '누군가의 편지가 도착했어요.', '편지를 열어 마음을 확인해보세요.', { screen: 'letter', letterId: row.id });
  return row.id;
}

// 실제 reply_letter와 같은 검사 · 비용(특별편지 답장은 무료)
function replyLetterAs(uid: string, id: string, rawBody: string, rawKakao: any, rawPhone: any) {
  const body = String(rawBody ?? '').trim();
  const kakao = cleanKakao(rawKakao);
  const phone = cleanPhone(rawPhone);
  if (!profileReady(userById(uid))) throw new DemoError('프로필을 완성하면 편지에 답할 수 있어요.', '42501');
  const l = findLetter(id);
  if (!l || l.receiver_id !== uid) throw new DemoError('편지를 찾을 수 없어요.', '02000');
  if (l.replied_at) throw new DemoError('이미 답장한 편지예요.', '23505');
  if (l.declined_at || !isActive(l)) throw new DemoError('보관 기간이 지난 편지예요.', '22023');
  if (blockedBetween(uid, l.sender_id)) throw new DemoError('지금은 답장할 수 없는 상대예요.', '42501');
  validate(body, kakao, phone);
  const cost = l.kind === 'invite' ? 0 : price('reply', uid);
  chargeLeaf(uid, cost, 'letter_reply');
  const t = nowIso();
  updateRows('letters', (x) => x.id === id, (x) => ({
    reply_body: body, reply_kakao: kakao, reply_phone: phone, reply_cost: cost, replied_at: t, read_at: x.read_at ?? t,
  }));
  touchInterest(uid, l.sender_id);
  const nick = userById(uid)?.nickname ?? person(uid)?.nickname ?? '상대';
  notify(l.sender_id, 'letter_connected', '서로의 편지가 도착했어요.', `${nick}님이 답장을 보냈어요. 연락처를 확인해보세요.`, { screen: 'letter', letterId: id });
}

// ── '마음이 간 곳'(0190) 검사 — 받는 사람의 실제 프로필에 있는 문장 · 사진만 ──
const IDEAL_Q = '이런 사람에게 마음이 가요';
function checkMarks(receiverId: string, items: any) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 2) throw new DemoError('bad_items', 'P0001');
  if (new Set(items.map((x) => JSON.stringify(x))).size !== items.length) throw new DemoError('bad_items', 'P0001');
  const u = userById(receiverId) ?? {};
  const photos: string[] = (u.photos ?? []).filter((x: any) => !!x);
  const ideal: string = (u.intro_want || u.headline || '') as string;
  const extras: any[] = Array.isArray(u.extra_answers) ? u.extra_answers : [];
  for (const it of items) {
    let ok = false;
    if (it?.t === 'line') {
      const text = String(it.text ?? '');
      ok = text.length >= 1 && text.length <= 300 && (
        (it.q === IDEAL_Q && ideal.includes(text))
        || extras.some((e) => e && typeof e === 'object' && e.a && e.q === it.q && String(e.a).includes(text))
      );
    } else if (it?.t === 'photo') {
      ok = Number.isInteger(it.n) && it.n >= 0 && it.n <= 9 && photos[it.n] === it.url;
    }
    if (!ok) throw new DemoError('bad_item', 'P0001');
  }
}

// ── 서버 함수 ─────────────────────────────────────────────────────────
export const rpc: Record<string, (args: any) => any> = {
  // 내 편지함 — 보관 중인 편지만, 거절한 받은 편지와 서로 차단한 상대는 빼고, 최신순 200통
  list_my_letters: () => {
    const uid = requireUid();
    expireLetters();
    return table('letters')
      .filter((l) => (l.sender_id === uid || l.receiver_id === uid) && isActive(l))
      .filter((l) => !(l.receiver_id === uid && l.declined_at))
      .filter((l) => !blockedBetween(uid, l.sender_id === uid ? l.receiver_id : l.sender_id))
      .sort((a, b) => at(b.created_at) - at(a.created_at))
      .slice(0, 200)
      .map((l) => toLetterRow(l, uid));
  },

  // 보내기 → 새 편지 id
  send_letter: (a) => sendLetterAs(requireUid(), a.p_receiver, a.p_body, a.p_kakao, a.p_phone, a.p_kind ?? 'letter'),

  // 받은 편지 읽음(처음 한 번) — 보관 기한이 '읽은 날부터 7일'로 바뀌어요
  read_letter: (a) => {
    const uid = requireUid();
    updateRows('letters', (l) => l.id === a.p_id && l.receiver_id === uid && !l.read_at && isActive(l), { read_at: nowIso() });
    return null;
  },

  // 답장(=수락) → 서로 연결, 연락처 공개
  reply_letter: (a) => { replyLetterAs(requireUid(), a.p_id, a.p_body, a.p_kakao, a.p_phone); return null; },

  // 정중히 거절 — 내 목록에서 사라지고, 보낸 사람 쪽엔 그대로 남아요(환불 없음)
  decline_letter: (a) => {
    const uid = requireUid();
    updateRows(
      'letters',
      (l) => l.id === a.p_id && l.receiver_id === uid && !l.replied_at && !l.declined_at && isActive(l),
      (l) => ({ declined_at: nowIso(), read_at: l.read_at ?? nowIso() }),
    );
    return null;
  },

  // 보낸 일반편지 → 특별편지(차액만 차감)
  upgrade_letter: (a) => {
    const uid = requireUid();
    if (!profileReady(userById(uid))) throw new DemoError('프로필을 완성하면 편지를 바꿀 수 있어요.', '42501');
    const l = findLetter(a.p_id);
    if (!l || l.sender_id !== uid) throw new DemoError('편지를 찾을 수 없어요.', '02000');
    if (l.kind === 'invite') throw new DemoError('이미 특별편지로 보냈어요.', '23505');
    if (l.replied_at || l.declined_at || !isActive(l)) throw new DemoError('지금은 바꿀 수 없는 편지예요.', '22023');
    const cost = price('upgrade', uid);
    chargeLeaf(uid, cost, 'letter_upgrade');
    updateRows('letters', (x) => x.id === l.id, (x) => ({ kind: 'invite', cost: x.cost + cost, upgraded_at: nowIso() }));
    return null;
  },

  // 마음이 간 곳 붙이기 — 보낸 사람만 · 보낸 지 10분 안 · 상대가 읽기 전 · 한 번만
  set_letter_marks: (a) => {
    const uid = requireUid();
    const l = table('letters').find((x) => x.id === a.p_letter && !x.read_at);
    if (!l || l.sender_id !== uid) throw new DemoError('not_allowed', 'P0001');
    if (at(l.created_at) < now() - 10 * 60_000) throw new DemoError('too_late', 'P0001');
    if (table('letter_marks').some((m) => m.letter_id === l.id)) throw new DemoError('already', 'P0001');
    checkMarks(l.receiver_id, a.p_items);
    insertRows('letter_marks', { letter_id: l.id, items: a.p_items });
    return null;
  },

  // 내가 보낸 · 받은 편지에 붙은 곳만 → [{ letter_id, items }]
  get_letter_marks: (a) => {
    const uid = requireUid();
    const ids: string[] = Array.isArray(a.p_ids) ? a.p_ids : [];
    return table('letter_marks')
      .filter((m) => ids.includes(m.letter_id))
      .filter((m) => { const l = findLetter(m.letter_id); return !!l && (l.sender_id === uid || l.receiver_id === uid); })
      .map((m) => ({ letter_id: m.letter_id, items: m.items }));
  },
};

// ── 시연도구 '상황 만들기' — 편지 ───────────────────────────────────────
// 마지막으로 다룬 편지로 바로 가는 이동 버튼(실행한 뒤 시연도구가 go를 읽어요)
let lastLetterId: string | null = null;
const goLast = (): DemoNavTarget => (lastLetterId ? { overlay: 'letterDetail', params: { letterId: lastLetterId } } : { tab: 'letters' });

// 실제 send_letter 규칙으로 '나'에게 새 편지를 보낼 수 있는 여성 — 보관 중인 편지가 아예 없는 사람을 먼저 골라요
function freeWoman(): string | null {
  const active = table('letters').filter(isActive);
  const can = women.filter((p) => !!userById(p.id) && !blockedBetween(ME_ID, p.id)
    && !active.some((l) => l.sender_id === p.id && l.receiver_id === ME_ID)
    && !active.some((l) => l.sender_id === ME_ID && l.receiver_id === p.id && !l.declined_at && !l.replied_at));
  const untouched = can.find((p) => !active.some((l) => l.sender_id === p.id || l.receiver_id === p.id));
  return (untouched ?? can[0])?.id ?? null;
}

function arrive(kind: 'letter' | 'invite'): string {
  lastLetterId = null;
  const from = freeWoman();
  if (!from) return "지금은 나에게 새 편지를 보낼 수 있는 여성 회원이 없어요(한 사람과는 편지가 한 통씩만 오가요). '처음 상태로'를 누르거나 시간을 7일 넘게 흐르게 한 뒤 다시 해 보세요.";
  const c = contactOf(from);
  // 실제 서버 규칙(상대의 리프 · 프로필 상태)까지 따지면 시연이 막힐 수 있어 상대 리프는 깎지 않아요
  const [row] = insertRows('letters', {
    sender_id: from, receiver_id: ME_ID, kind, body: NEW_LETTERS[from] ?? DEFAULT_NEW_LETTER,
    sender_kakao: c.kakao, sender_phone: c.phone, cost: price(kind, from),
    read_at: null, reply_body: null, reply_kakao: null, reply_phone: null, reply_cost: null,
    replied_at: null, declined_at: null, refunded_at: null, upgraded_at: null,
  });
  touchInterest(from, ME_ID);
  notify(ME_ID, 'letter_arrived', '누군가의 편지가 도착했어요.', '편지를 열어 마음을 확인해보세요.', { screen: 'letter', letterId: row.id });
  lastLetterId = row.id;
  const name = profileOf(from).nickname ?? '상대';
  return `${name}님이 ${kind === 'invite' ? '특별편지' : '편지'}를 보냈어요. 편지함 탭으로 가면 위쪽에 도착 카드가 내려와요.`;
}

// 아직 답이 없는 내가 보낸 편지(최신 것부터)
function pendingSent(filter: (l: Row) => boolean = () => true): Row | undefined {
  return table('letters')
    .filter((l) => l.sender_id === ME_ID && !l.replied_at && !l.declined_at && isActive(l) && filter(l))
    .sort((a, b) => at(b.created_at) - at(a.created_at))[0];
}
const NEED_SENT = '답을 기다리는 보낸 편지가 없어요. 먼저 상대 프로필에서 편지를 보내 보세요.';

export const scenarios: Scenario[] = [
  {
    id: 'letters-arrive',
    group: '편지',
    label: '새 편지 받기',
    hint: '여성 회원이 지금 나에게 편지를 보내요. 화면 위쪽에 도착 카드가 내려와요.',
    run: () => arrive('letter'),
    go: { tab: 'letters' },
  },
  {
    id: 'letters-arrive-invite',
    group: '편지',
    label: '특별편지 받기',
    hint: '편지함 맨 위에 고정되고, 답장이 무료인 편지예요.',
    run: () => arrive('invite'),
    go: { tab: 'letters' },
  },
  {
    id: 'letters-their-read',
    group: '편지',
    label: '보낸 편지를 상대가 읽음',
    hint: "가장 최근에 보낸 안 읽힌 편지가 '읽음'으로 바뀌어요.",
    run: () => {
      lastLetterId = null;
      const l = pendingSent((x) => !x.read_at);
      if (!l) return '아직 안 읽힌 보낸 편지가 없어요. 먼저 상대 프로필에서 편지를 보내 보세요.';
      updateRows('letters', (x) => x.id === l.id, { read_at: nowIso() });
      lastLetterId = l.id;
      return `${profileOf(l.receiver_id).nickname ?? '상대'}님이 편지를 읽었어요. 이제 읽은 날부터 7일 동안 보관돼요.`;
    },
    get go() { return goLast(); },
  },
  {
    id: 'letters-their-reply',
    group: '편지',
    label: '보낸 편지에 답장 받기',
    hint: '상대가 답장해서 서로 연결되고 연락처가 열려요.',
    run: () => {
      lastLetterId = null;
      const l = pendingSent();
      if (!l) return NEED_SENT;
      const her = l.receiver_id;
      const c = contactOf(her);
      const t = nowIso();
      // 상대(여성)의 답장 값: 특별편지면 무료, 아니면 이벤트가
      updateRows('letters', (x) => x.id === l.id, (x) => ({
        reply_body: REPLIES[her] ?? DEFAULT_REPLY, reply_kakao: c.kakao, reply_phone: c.phone,
        reply_cost: x.kind === 'invite' ? 0 : price('reply', her), replied_at: t, read_at: x.read_at ?? t,
      }));
      touchInterest(her, ME_ID);
      const name = profileOf(her).nickname ?? '상대';
      notify(ME_ID, 'letter_connected', '서로의 편지가 도착했어요.', `${name}님이 답장을 보냈어요. 연락처를 확인해보세요.`, { screen: 'letter', letterId: l.id });
      lastLetterId = l.id;
      return `${name}님이 답장했어요. 서로 연결돼 연락처가 공개됐어요.`;
    },
    get go() { return goLast(); },
  },
  {
    id: 'letters-their-decline',
    group: '편지',
    label: '보낸 편지를 상대가 거절',
    hint: '내 편지함엔 남지만 특별편지로 바꿀 수 없게 돼요(리프는 돌아오지 않아요).',
    run: () => {
      lastLetterId = null;
      const l = pendingSent();
      if (!l) return NEED_SENT;
      const t = nowIso();
      updateRows('letters', (x) => x.id === l.id, (x) => ({ declined_at: t, read_at: x.read_at ?? t }));
      lastLetterId = l.id;
      return `${profileOf(l.receiver_id).nickname ?? '상대'}님이 편지를 정중히 거절했어요.`;
    },
    get go() { return goLast(); },
  },
  {
    id: 'letters-expire',
    group: '편지',
    label: '보낸 편지 기한 지나게 하기',
    hint: '안 읽힌 보낸 편지를 3일 전에 보낸 것으로 바꿔요. 편지가 사라지고 쓴 리프가 돌아와요.',
    run: () => {
      lastLetterId = null;
      const l = pendingSent((x) => !x.read_at);
      if (!l) return '아직 안 읽힌 보낸 편지가 없어요. 먼저 상대 프로필에서 편지를 보내 보세요.';
      updateRows('letters', (x) => x.id === l.id, { created_at: minutesAgo(3 * 1440 + 1) });
      expireLetters();
      return `${profileOf(l.receiver_id).nickname ?? '상대'}님에게 보낸 편지가 사라지고 ${l.cost}리프가 돌아왔어요. 알림에서도 볼 수 있어요.`;
    },
    go: { tab: 'letters' },
  },
];
