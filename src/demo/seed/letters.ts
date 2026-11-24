// 야화 시연판 — 편지(letters) 처음 상태.
// 편지함의 모든 모습이 한 번씩 보이도록 채워 두었어요.
//   받은 편지: 안 읽음(마음이 간 곳 붙음) · 안 읽은 특별편지(맨 위 고정) · 읽음 · 서로 연결됨(내가 답장)
//   보낸 편지: 답장 기다림(마음이 간 곳 붙음) · 상대가 읽음(특별편지로 바꾼 편지) · 상대가 거절 · 기한 지나 돌아온 편지(목록엔 안 보이고 알림만)
// 편지 글을 바꾸고 싶으면 아래 LETTERS의 body · reply만 고치면 돼요. 서명('○○ 드림')은 화면이 닉네임으로 붙여요.
// 고친 뒤에는 시연도구의 '처음 상태로'를 눌러야 브라우저에 반영돼요.
//
// 보관 규칙(실제 서버와 같아요): 안 읽은 편지는 보낸 지 3일, 읽은 편지는 읽은 날부터 7일, 연결된 편지는 연결된 날부터 7일 뒤 사라져요.
// 그래서 시각은 '지금부터 몇 시간 전'으로 적어요. 3일(72시간)이 넘은 안 읽은 편지는 처음 열자마자 환불 처리돼 사라지니 주의하세요.
import type { Row } from '../db';
import { person } from '../people';
import type { LetterMark } from '../../lib/api';

// 시드는 db.ts가 처음 뜰 때(db.ts의 값 · 시각 도우미가 준비되기 전) 만들어져서, db.ts에서 값을 가져오지 않아요.
// · '나'의 id는 db.ts의 ME_ID와 같은 값을 여기 적어요(가져오면 순환 참조로 아직 비어 있어요).
// · 시계도 직접 읽어요. '처음 상태로'를 누르면 '시간 흐르게 하기'도 0으로 돌아가니 지금 시각과 같아요.
const ME_ID = 'demo-me';
const H = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * H).toISOString();

// 데모 속 '나'가 편지에 적어 보낸 연락처(가짜 값)
export const ME_CONTACT = { kakao: 'yahwa_demo', phone: '01012345678' };

type Contact = { kakao?: string; phone?: string };
type SeedLetter = {
  id: string;
  from: string;              // 보낸 사람 id (ME_ID 또는 PEOPLE id)
  to: string;                // 받는 사람 id
  kind?: 'letter' | 'invite';  // invite = 화면 이름 '특별편지'
  body: string;
  sentHoursAgo: number;
  cost: number;              // 보낼 때 쓴 리프(연말 이벤트가: 일반편지 여성 5 · 남성 15 / 특별편지 여성 8 · 남성 25)
  contact: Contact;          // 보낸 사람이 함께 적은 연락처
  readHoursAgo?: number;
  declinedHoursAgo?: number;
  upgradedHoursAgo?: number; // 일반편지 → 특별편지로 바꾼 시각
  refundedHoursAgo?: number; // 3일 동안 안 읽혀 돌아온 편지(목록에서 사라짐)
  reply?: { body: string; hoursAgo: number; cost: number; contact: Contact };
  marks?: LetterMark[];      // 마음이 간 곳(받는 사람 프로필에서 고른 문장 · 사진, 최대 2곳)
};

const photoOf = (id: string, n: number) => person(id)?.photos[n] ?? '';

// ── 편지 글(여기를 고치면 돼요) ─────────────────────────────────────
export const LETTERS: SeedLetter[] = [
  // 받은 편지 · 안 읽음 · 마음이 간 곳 한 곳
  {
    id: 'lt-f01-in', from: 'u-f01', to: ME_ID, sentHoursAgo: 2, cost: 5, contact: { kakao: 'bomvit_01' },
    marks: [{ t: 'line', q: '이런 사람에게 마음이 가요', text: '말이 없는 순간도 편안한 사람에게 마음이 가요.' }],
    body:
      '안녕하세요. 퇴근길 지하철에서 프로필을 읽다가 내릴 역을 지나칠 뻔했어요.\n'
      + '말이 없는 순간도 편안한 사람이 좋다는 문장이 오래 남았어요. 하루 종일 남의 문장을 다듬는 일을 하다 보니, 저도 퇴근하고 나면 조용히 걷는 시간이 제일 소중하거든요.\n'
      + '망원 한강공원을 자주 걷는데, 혹시 걷는 거 좋아하시면 언젠가 같이 걸어요. 답장은 천천히 주셔도 괜찮아요.',
  },
  // 받은 특별편지 · 안 읽음(편지함 맨 위에 고정, 답장 무료)
  {
    id: 'lt-f02-in', from: 'u-f02', to: ME_ID, kind: 'invite', sentHoursAgo: 20, cost: 8, contact: { kakao: 'slow_afternoon' },
    body:
      '갑자기 편지를 받아서 놀라셨죠. 저도 보내기 전까지 몇 번이나 지웠다 썼어요.\n'
      + '사진 속 카페가 제가 자주 가는 곳이랑 분위기가 정말 비슷했어요. 창가 자리, 오후 햇빛, 천천히 식어 가는 라테 같은 거요.\n'
      + '일할 때는 화면 속 버튼 하나에도 오래 고민하는 편인데, 사람한테는 의외로 직감을 믿어요. 이번엔 그 직감이 꽤 크게 울려서 특별편지로 보내요. 편할 때 답장 주세요.',
  },
  // 받은 편지 · 읽음 · 아직 답장 전
  {
    id: 'lt-f03-in', from: 'u-f03', to: ME_ID, sentHoursAgo: 26, readHoursAgo: 5, cost: 5, contact: { phone: '01020240303' },
    body:
      '안녕하세요, 부산에 사는 여름산책이에요.\n'
      + '거리가 좀 있어서 망설였는데, 그래도 한 번은 써 보고 싶었어요. 아이들한테는 매일 하고 싶은 말은 미루지 말자고 하면서, 정작 저는 그게 제일 어렵더라고요.\n'
      + '저는 아침마다 해운대 바닷가를 걸어요. 요즘은 바람이 차가워져서 따뜻한 커피를 꼭 들고 나가요. 한 달에 한두 번은 서울에 올라가는데, 그때 차 한잔 하면 좋겠어요.',
  },
  // 받은 편지 · 내가 답장해서 서로 연결됨(연락처 공개)
  {
    id: 'lt-f04-in', from: 'u-f04', to: ME_ID, sentHoursAgo: 70, readHoursAgo: 50, cost: 5, contact: { kakao: 'small_wave_04', phone: '01020240404' },
    body:
      '교대 근무라 남들 다 잘 시간에 이 편지를 쓰고 있어요.\n'
      + '밤 근무를 마치고 아침에 집에 오는 길을 제일 좋아해요. 다들 출근하는데 저만 하루를 끝내는 기분이라, 이상하게 뿌듯하거든요.\n'
      + '프로필에 적어 두신 이야기가 차분해서 좋았어요. 성수 쪽에 자주 오시면 언제 맛있는 거 같이 먹어요. 저는 라면도 가끔 불리는 사람이라, 대신 맛집은 잘 찾아요.',
    reply: {
      hoursAgo: 26, cost: 15, contact: { kakao: ME_CONTACT.kakao },
      body:
        '편지 고마워요. 밤새 일하고 돌아오는 길에 쓰셨다니 더 귀하게 읽었어요.\n'
        + '라면 불리는 건 저도 자주 해요. 맛집 찾는 건 자신 없으니까 그건 맡기고, 저는 커피를 살게요.\n'
        + '근무 끝나고 피곤한 날 말고, 푹 쉬고 난 다음 날 편하게 연락 주세요.',
    },
  },
  // 보낸 편지 · 답장 기다림(안 읽음) · 마음이 간 곳 두 곳
  {
    id: 'lt-f05-out', from: ME_ID, to: 'u-f05', sentHoursAgo: 6, cost: 15, contact: { kakao: ME_CONTACT.kakao },
    marks: [
      { t: 'photo', url: photoOf('u-f05', 1), n: 1 },
      { t: 'line', q: '요즘 푹 빠져 있는 것은 무엇인가요?', text: '요즘은 필름 카메라로 동네 골목을 찍어요.' },
    ],
    body:
      '사진 속 골목 풍경이 좋아서 한참 들여다봤어요. 어디인지 궁금했는데 연수동 근처일까요?\n'
      + '필름 카메라로 찍으신다는 말이 반가웠어요. 저도 예전에 하나 샀다가 현상비가 무서워서 서랍에 넣어 뒀거든요. 이 편지를 핑계로 다시 꺼내 볼까 해요.\n'
      + '논문 쓰느라 바쁘실 텐데, 잠깐 쉬어 갈 때 읽어 주시면 좋겠어요.',
  },
  // 보낸 편지 · 상대가 읽음 · 일반편지(15)를 특별편지로 바꿈(+10)
  {
    id: 'lt-f06-out', from: ME_ID, to: 'u-f06', kind: 'invite', sentHoursAgo: 30, upgradedHoursAgo: 26, readHoursAgo: 3, cost: 25,
    contact: { kakao: ME_CONTACT.kakao, phone: ME_CONTACT.phone },
    body:
      '안녕하세요. 웃는 사진에서 눈이 멈춰서 이렇게 편지를 써요.\n'
      + '마케터라고 하셔서 첫 문장을 열 번쯤 고쳤어요. 글 잘 쓰는 분이 읽는다고 생각하니 괜히 긴장되더라고요.\n'
      + '저는 가끔 수원 화성 성곽길을 혼자 걸으러 가요. 해 질 무렵이 정말 예쁜데, 같이 걸어 줄 사람이 생기면 좋겠다고 생각했어요.',
  },
  // 보낸 편지 · 상대가 정중히 거절(내 목록엔 남고, 특별편지로 바꿀 수 없어요)
  {
    id: 'lt-f08-out', from: ME_ID, to: 'u-f08', sentHoursAgo: 52, readHoursAgo: 30, declinedHoursAgo: 30, cost: 15, contact: { kakao: ME_CONTACT.kakao },
    body:
      '꽃집에서 일하신다는 걸 보고, 가장 좋아하는 꽃이 뭔지 제일 먼저 궁금해졌어요.\n'
      + '저는 꽃 이름을 잘 몰라서 꽃집에 가면 늘 예쁜 걸로 주세요, 하고 말해요. 그래서 꽃을 고르는 일을 하는 사람은 어떤 하루를 보낼까 궁금했어요.\n'
      + '시간 되실 때 좋아하는 꽃 이야기를 들려주세요.',
  },
  // 보낸 편지 · 3일 동안 안 읽혀 리프가 돌아옴(목록엔 없고 알림에만 보여요)
  {
    id: 'lt-f07-out', from: ME_ID, to: 'u-f07', sentHoursAgo: 8 * 24, refundedHoursAgo: 5 * 24, cost: 15, contact: { kakao: ME_CONTACT.kakao },
    body:
      '대전에서 연구원으로 일하신다는 소개를 보고 반가웠어요. 저도 학교 다닐 때 유성에서 몇 년 살았거든요.\n'
      + '궁동 칼국숫집이 아직 그대로인지 궁금하네요. 시간 되실 때 요즘 대전 이야기 들려주세요.',
  },
];

// ── 표 행으로 바꾸기 ──────────────────────────────────────────────
function toRow(l: SeedLetter): Row {
  return {
    id: l.id,
    sender_id: l.from,
    receiver_id: l.to,
    kind: l.kind ?? 'letter',
    body: l.body,
    sender_kakao: l.contact.kakao ?? null,
    sender_phone: l.contact.phone ?? null,
    cost: l.cost,
    created_at: ago(l.sentHoursAgo),
    read_at: l.readHoursAgo != null ? ago(l.readHoursAgo) : l.reply ? ago(l.reply.hoursAgo) : null,
    reply_body: l.reply?.body ?? null,
    reply_kakao: l.reply?.contact.kakao ?? null,
    reply_phone: l.reply?.contact.phone ?? null,
    reply_cost: l.reply ? l.reply.cost : null,
    replied_at: l.reply ? ago(l.reply.hoursAgo) : null,
    declined_at: l.declinedHoursAgo != null ? ago(l.declinedHoursAgo) : null,
    refunded_at: l.refundedHoursAgo != null ? ago(l.refundedHoursAgo) : null,
    upgraded_at: l.upgradedHoursAgo != null ? ago(l.upgradedHoursAgo) : null,
  };
}

// 나에게 온 알림(서버가 편지 도착 · 환불 때 남기는 것과 같은 모양)
function notifsForMe(): Row[] {
  const out: Row[] = [];
  for (const l of LETTERS) {
    if (l.to === ME_ID) {
      out.push({
        id: `nt-${l.id}`, user_id: ME_ID, kind: 'letter_arrived',
        title: '누군가의 편지가 도착했어요.', body: '편지를 열어 마음을 확인해보세요.',
        data: { screen: 'letter', letterId: l.id }, read: l.readHoursAgo != null || !!l.reply, created_at: ago(l.sentHoursAgo),
      });
    }
    if (l.from === ME_ID && l.refundedHoursAgo != null && l.cost > 0) {
      out.push({
        id: `nt-${l.id}-refund`, user_id: ME_ID, kind: 'letter_refunded',
        title: '읽지 않은 편지가 돌아왔어요.', body: `3일 동안 읽히지 않은 편지가 사라지고 ${l.cost}리프가 돌아왔어요.`,
        data: { screen: 'letters' }, read: true, created_at: ago(l.refundedHoursAgo),
      });
    }
  }
  return out;
}

export const seed = (): Record<string, Row[]> => ({
  letters: LETTERS.map(toRow),
  letter_marks: LETTERS.filter((l) => l.marks?.length).map((l) => ({
    id: `mk-${l.id}`, letter_id: l.id, items: l.marks, created_at: ago(l.sentHoursAgo),
  })),
  notifications: notifsForMe(),
});
