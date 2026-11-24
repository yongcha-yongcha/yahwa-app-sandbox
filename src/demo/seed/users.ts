// 야화 시연판 — 회원(users) 처음 상태 + 인연(마음함·열람 기록) 처음 상태.
// 아래 PROFILES · MY_PROFILE · HEART_PLAN 글만 바꿔도 오늘의 인연 · 마음함 · 프로필 상세에 그대로 보여요.
// 고친 뒤에는 시연도구의 '처음 상태로'를 눌러야 브라우저에 반영돼요.
//
// ⚠️ 이 파일의 seed()는 db.ts가 처음 만들어질 때 불려요. 그때는 db.ts의 now()·daysAgo()를 아직 못 쓰니
//    시각은 여기 있는 ago()(Date.now 기준)로만 만들어요.
import { ME_ID, type Row } from '../db';
import { PEOPLE, type Person } from '../people';
import { regionValue } from '../../components/entry/profileOptions';

// ── 1. 사람별 프로필 내용(이름·사진·직업·지역은 people.ts) ─────────────────────
type Cred = { kind: 'school' | 'company' | 'income'; label: string };
type Profile = {
  birth: [number, number];          // 생일 [월, 일] — 태어난 해는 people.ts
  headline: string;                 // 한 줄 소개
  want: string;                     // 필수 소개 "이런 사람에게 마음이 가요"
  answers: [string, string][];      // 고른 질문과 답 — 질문은 entry/storyBank.ts 글자 그대로
  mbti: string; height: number; education: string; religion: string;
  smoking: string; drinking: string;
  politics?: string; politicsPublic?: boolean;
  creds?: Cred[];                   // 운영팀이 승인한 인증(프로필에 파란 배지)
  featured?: boolean;               // 추천 프로필(가입 첫날 덱 앞쪽)
  joined: number;                   // 가입한 지 며칠
};

export const PROFILES: Record<string, Profile> = {
  'u-f01': {
    birth: [4, 12], headline: '책 냄새 나는 주말을 좋아해요',
    want: '대화가 잠깐 끊겨도 조용히 기다려 주는 사람에게 마음이 가요. 서두르지 않고 제 이야기를 끝까지 들어 주면 그날이 오래 기억에 남아요.',
    answers: [
      ['간단한 자기소개를 들려주세요', '평일엔 원고를 다듬고, 주말엔 동네 독립서점을 한 곳씩 들러요. 마음에 드는 문장을 만나면 사진으로 찍어 두는 버릇이 있어요.'],
      ['내가 생각하는 기분 좋은 첫 데이트는?', '작은 서점에서 서로에게 책 한 권씩 골라 주고, 근처 카페에서 왜 그 책을 골랐는지 이야기하면 좋겠어요.'],
    ],
    mbti: 'INFJ', height: 163, education: '대학교 졸업', religion: '무교', smoking: '비흡연', drinking: '가끔',
    creds: [{ kind: 'school', label: '국어국문학과 졸업' }], featured: true, joined: 62,
  },
  'u-f02': {
    birth: [9, 3], headline: '천천히 오래 보는 사람이에요',
    want: '작은 약속을 기억해 주는 사람이요. 지나가듯 한 말을 다음에 다시 꺼내 주면 그게 제일 설레요.',
    answers: [
      ['요즘 푹 빠져 있는 것은 무엇인가요?', '퇴근하고 수채화를 그려요. 물감이 번지는 걸 기다리는 시간이 좋아서 하루 중 제일 느긋한 시간이 됐어요.'],
      ['어떤 대화를 나눌 때 편안함을 느끼나요?', '정답이 없는 이야기요. 어릴 때 좋아하던 만화나 요즘 꽂힌 노래 얘기처럼 가볍게 시작해서 길어지는 대화가 좋아요.'],
    ],
    mbti: 'ISFP', height: 166, education: '대학교 졸업', religion: '천주교', smoking: '비흡연', drinking: '가끔',
    creds: [{ kind: 'company', label: '판교 IT 회사 재직 중' }], joined: 40,
  },
  'u-f03': {
    birth: [7, 21], headline: '바다 앞에서 자란 웃음 많은 사람',
    want: '작은 일에도 같이 웃어 주는 사람에게 마음이 가요. 진지할 땐 진지하고, 사소한 일엔 크게 웃을 줄 아는 사람이면 좋겠어요.',
    answers: [
      ['쉬는 날에는 주로 무엇을 하나요?', '아침엔 해변을 따라 걷고, 오후엔 동네 빵집에서 다음 주 수업 준비를 해요. 저녁엔 엄마랑 통화하는 게 루틴이에요.'],
      ['함께 떠나고 싶은 여행은 어떤 모습인가요?', '기차 타고 처음 가 보는 작은 도시요. 지도 없이 걷다가 마음에 드는 식당에 들어가는 여행을 좋아해요.'],
    ],
    mbti: 'ESFJ', height: 161, education: '대학교 졸업', religion: '기독교', smoking: '비흡연', drinking: '안마심',
    creds: [{ kind: 'school', label: '교육대학교 졸업' }], joined: 33,
  },
  'u-f04': {
    birth: [2, 8], headline: '교대 근무 끝나고 마시는 커피가 행복이에요',
    want: '바쁜 날에도 짧게 안부를 물어 주는 사람이요. 길지 않아도 마음이 담긴 연락이면 하루를 버틸 힘이 생겨요.',
    answers: [
      ['퇴근 후 나만의 충전 방법은?', '나이트 근무가 끝나면 따뜻한 물로 씻고 좋아하는 라디오를 틀어요. 한숨 푹 자고 나면 다시 웃을 힘이 생겨요.'],
      ['힘든 날 어떤 위로를 받고 싶나요?', '말없이 맛있는 걸 사 주면 다 풀려요. 해결책보다 오늘 수고했다는 한마디가 더 크게 와닿아요.'],
    ],
    mbti: 'ISTJ', height: 165, education: '대학교 졸업', religion: '무교', smoking: '비흡연', drinking: '가끔',
    creds: [{ kind: 'company', label: '대학병원 재직 중' }], joined: 21,
  },
  'u-f05': {
    birth: [11, 30], headline: '실험실과 하늘 사진 사이',
    want: '궁금한 게 많은 사람에게 끌려요. 엉뚱한 질문에도 같이 진지하게 고민해 주면 금방 친해질 수 있어요.',
    answers: [
      ['일상에서 자주 찍는 사진은?', '연구실 창문으로 보이는 하늘이요. 매일 같은 자리에서 찍는데 한 번도 같은 적이 없어서 신기해요.'],
      ['최근 새롭게 시작한 취미는?', '클라이밍을 시작했어요. 아직 쉬운 문제에서도 헤매지만 하나 끝낼 때마다 꽤 뿌듯해요.'],
    ],
    mbti: 'INTP', height: 168, education: '대학원 재학', religion: '무교', smoking: '비흡연', drinking: '가끔', joined: 15,
  },
  'u-f06': {
    birth: [6, 17], headline: '맛집 지도 하나쯤은 자신 있어요',
    want: '음식 앞에서 표정이 솔직한 사람이요. 맛있는 걸 먹고 "이거 진짜 맛있다" 하고 웃어 주면 저도 행복해져요.',
    answers: [
      ['나만의 맛집 선택 기준은?', '메뉴판이 짧은 집이요. 몇 가지에만 집중하는 가게는 대부분 실패가 없더라고요.'],
      ['나와 빠르게 친해지는 방법은?', '좋아하는 국밥집이나 떡볶이집을 알려 주세요. 그 얘기만으로 한 시간은 떠들 수 있어요.'],
      ['연인이 생기면 함께 하고 싶은 일은?', '동네 시장 구경하고 장 봐서 같이 저녁 만들기요. 서툴러도 같이 만든 게 제일 맛있잖아요.'],
    ],
    mbti: 'ENFP', height: 160, education: '대학교 졸업', religion: '불교', smoking: '비흡연', drinking: '즐김',
    politics: '중도', politicsPublic: true, joined: 48,
  },
  'u-f07': {
    birth: [1, 25], headline: '아직도 손편지를 써요',
    want: '말보다 행동이 따뜻한 사람에게 마음이 가요. 비 오는 날 우산을 제 쪽으로 기울여 주는 그런 사람이요.',
    answers: [
      ['최근 마음에 남은 영화나 책은?', '오래된 서간집을 다시 읽었어요. 짧은 편지 한 장에 계절이 다 들어 있는 게 좋아서 저도 요즘 편지를 써요.'],
      ['내가 꿈꾸는 편안한 연애는 어떤 모습인가요?', '같은 공간에서 각자 할 일을 하다가 가끔 눈 마주치고 웃는 연애요. 조용해도 어색하지 않은 사이가 좋아요.'],
    ],
    mbti: 'INFJ', height: 164, education: '석사 졸업', religion: '천주교', smoking: '비흡연', drinking: '가끔',
    creds: [{ kind: 'school', label: '생명과학 석사' }, { kind: 'income', label: '연 소득 5천+' }], joined: 90,
  },
  'u-f08': {
    birth: [8, 9], headline: '꽃 한 송이로 하루를 바꾸는 일을 해요',
    want: '자기 일을 좋아하는 사람이요. 좋아하는 걸 이야기할 때 눈이 반짝이는 사람에게 끌려요.',
    answers: [
      ['내 하루를 기분 좋게 만드는 작은 순간은?', '새벽 꽃시장에서 막 들어온 작약 상자를 여는 순간이요. 향이 확 올라오면 피곤함이 사라져요.'],
      ['좋아하는 계절을 보내는 방법은?', '봄엔 무조건 한강이요. 돗자리 하나랑 김밥만 있으면 하루가 금방 가요.'],
    ],
    mbti: 'ESFP', height: 167, education: '전문대 졸업', religion: '무교', smoking: '비흡연', drinking: '즐김',
    featured: true, joined: 7,
  },
  'u-m01': {
    birth: [3, 14], headline: '새벽 5km, 오늘도 완주했어요',
    want: '자기만의 루틴이 있는 사람이 멋있어 보여요. 서로의 루틴을 존중하면서 가끔은 같이 달려 주면 좋겠어요.',
    answers: [
      ['요즘 내가 이루고 싶은 목표는 무엇인가요?', '내년 봄 하프 마라톤 완주요. 지금은 일주일에 네 번 새벽에 호수 둘레를 돌고 있어요.'],
      ['퇴근 후 나만의 충전 방법은?', '샤워하고 좋아하는 게임 한 판이요. 딱 30분만 하고 일찍 자는 게 제 나름의 규칙이에요.'],
    ],
    mbti: 'ISTP', height: 178, education: '대학교 졸업', religion: '무교', smoking: '비흡연', drinking: '가끔',
    creds: [{ kind: 'company', label: 'IT 서비스 회사 재직 중' }], joined: 55,
  },
  'u-m02': {
    birth: [10, 2], headline: '오래된 건물 구경을 좋아하는 건축가',
    want: '자기 생각을 차분히 말할 줄 아는 사람이요. 의견이 달라도 서로 왜 그렇게 생각하는지 궁금해하는 대화가 좋아요.',
    answers: [
      ['자꾸 다시 찾게 되는 나만의 장소는?', '언덕 위 오래된 골목이요. 계단 따라 집들이 겹쳐 있는 모습이 볼 때마다 달라서 사진을 계속 찍게 돼요.'],
      ['전시를 볼 때 나는 어떤 편인가요?', '공간부터 봐요. 작품보다 빛이 어떻게 들어오는지 먼저 보게 되는 건 직업병 같아요.'],
    ],
    mbti: 'INTJ', height: 181, education: '석사 졸업', religion: '무교', smoking: '비흡연', drinking: '가끔',
    creds: [{ kind: 'school', label: '건축학 석사' }, { kind: 'income', label: '연 소득 7천+' }], featured: true, joined: 70,
  },
  'u-m03': {
    birth: [12, 19], headline: '평일엔 숫자, 주말엔 냄비',
    want: '맛있게 먹어 주는 사람에게 약해요. 제가 만든 음식을 먹고 솔직하게 말해 주면 다음엔 더 잘 만들고 싶어져요.',
    answers: [
      ['요즘 푹 빠져 있는 것은 무엇인가요?', '라구 소스요. 일요일 오후 내내 끓이는데, 그동안 집에 퍼지는 냄새가 좋아서 계속 하게 돼요.'],
      ['연인과 함께 만들고 싶은 작은 습관은?', '일요일 저녁은 같이 요리해서 먹기요. 바쁜 한 주를 정리하는 우리만의 시간이 있으면 좋겠어요.'],
    ],
    mbti: 'ESTJ', height: 175, education: '대학교 졸업', religion: '기독교', smoking: '비흡연', drinking: '가끔',
    creds: [{ kind: 'company', label: '회계법인 재직 중' }], joined: 38,
  },
  'u-m04': {
    birth: [5, 27], headline: '필름 카메라 들고 동네 산책',
    want: '사소한 걸 오래 보는 사람이요. 같이 걷다가 멈춰서 하늘 좀 보자고 말해 주는 사람이면 좋겠어요.',
    answers: [
      ['일상에서 자주 찍는 사진은?', '해 질 녘 골목 그림자요. 필름이라 바로 못 보는데, 현상하고 나면 그날 기분이 떠오르는 게 좋아요.'],
      ['비 오는 날 함께 보내고 싶은 시간은?', '창가 자리 카페에서 빗소리 들으면서 각자 사진 정리하기요. 가끔 서로 찍은 사진을 보여 주고요.'],
    ],
    mbti: 'INFP', height: 183, education: '대학교 졸업', religion: '무교', smoking: '비흡연', drinking: '가끔', joined: 26,
  },
  'u-m05': {
    birth: [8, 30], headline: '퇴근길 한강 걷기가 낙이에요',
    want: '밝게 인사해 주는 사람이요. 작은 친절이 자연스러운 사람과 함께 있으면 저도 더 다정해지는 것 같아요.',
    answers: [
      ['쉬는 날에는 주로 무엇을 하나요?', '자전거 타고 강을 따라 한참 달려요. 중간에 편의점 라면 하나 먹는 게 하이라이트예요.'],
      ['내가 다정함을 표현하는 방법은?', '상대가 지나가듯 좋아한다고 한 걸 기억해 뒀다가 챙겨요. 크게 티 내진 않아도 오래 기억하는 편이에요.'],
    ],
    mbti: 'ESFJ', height: 176, education: '대학교 졸업', religion: '천주교', smoking: '비흡연', drinking: '가끔', joined: 12,
  },
  'u-m06': {
    birth: [4, 4], headline: '제주에서 자라 바람을 좋아해요',
    want: '자기 이야기를 솔직하게 꺼낼 수 있는 사람이요. 일이 바빠도 서로의 하루를 궁금해하는 관계를 꿈꿔요.',
    answers: [
      ['다시 가고 싶은 여행지와 이유는?', '어릴 때 살던 바닷가 마을이요. 돌담 사이로 부는 바람 소리를 들으면 아직도 마음이 편해져요.'],
      ['서로 의견이 다를 때 어떻게 풀어가고 싶나요?', '일할 땐 이기는 게 중요하지만 연애에선 듣는 게 먼저라고 생각해요. 하루 지나서라도 꼭 다시 이야기 나누고 싶어요.'],
    ],
    mbti: 'ENTJ', height: 180, education: '석사 졸업', religion: '무교', smoking: '비흡연', drinking: '가끔',
    politics: '중도', politicsPublic: true,
    creds: [{ kind: 'school', label: '법학전문대학원 졸업' }, { kind: 'income', label: '연 소득 1억+' }], joined: 44,
  },
  'u-m07': {
    birth: [9, 22], headline: '주말엔 작은 책방을 지켜요',
    want: '책 한 권으로 밤새 이야기할 수 있는 사람이요. 취향이 달라도 서로 추천해 주는 재미가 있으면 좋겠어요.',
    answers: [
      ['간단한 자기소개를 들려주세요', '평일엔 고등학생들과 문학 수업을 하고, 주말엔 친구와 같이 여는 작은 책방을 지켜요.'],
      ['최근 마음에 남은 영화나 책은?', '오래된 단편소설집을 학생들과 같이 읽었는데, 학생들이 저보다 더 깊게 읽어서 놀랐어요.'],
    ],
    mbti: 'INFJ', height: 177, education: '대학교 졸업', religion: '불교', smoking: '비흡연', drinking: '안마심',
    creds: [{ kind: 'company', label: '고등학교 교사' }], joined: 80,
  },
  'u-m08': {
    birth: [2, 14], headline: '오늘의 원두를 골라 드려요',
    want: '아침 인사를 잘하는 사람이요. 하루를 기분 좋게 시작하는 사람 옆에 있으면 저도 덩달아 웃게 돼요.',
    answers: [
      ['나를 웃게 하는 의외의 포인트는?', '손님이 커피를 마시고 몰래 엄지를 들어 줄 때요. 그 장면 보려고 이 일을 하는 것 같아요.'],
      ['함께 먹어보고 싶은 음식은?', '제가 아는 제일 맛있는 크루아상이요. 거기에 제가 내린 커피 한 잔이면 완벽한 아침이에요.'],
    ],
    mbti: 'ENFP', height: 174, education: '전문대 졸업', religion: '무교', smoking: '비흡연', drinking: '즐김', joined: 5,
  },
};

// ── 2. 나(데모 계정) ───────────────────────────────────────────────────────
// 내 사진은 따로 준비된 게 없어 목록 속 인물 사진을 빌려 써요. 성별을 바꾸면 사진도 바뀌어요.
export const MY_PHOTOS: Record<'M' | 'F', string[]> = {
  M: [1, 2, 3, 4].map((i) => `/demo/people/person-12-${i}.jpg`),
  F: [1, 2, 3, 4].map((i) => `/demo/people/person-04-${i}.jpg`),
};
export const MY_PROFILE = {
  nickname: '오늘도맑음',
  birth: [1996, 5, 14] as [number, number, number],
  region: '서울 / 성동',
  job: '개발자',
  headline: '퇴근 후 산책과 커피를 좋아해요',
  want: '작은 일에도 고맙다고 말할 줄 아는 사람에게 마음이 가요. 같이 걷다가 맛있어 보이는 가게에 즉흥으로 들어가는 걸 좋아하면 더 좋고요.',
  answers: [
    ['쉬는 날에는 주로 무엇을 하나요?', '오전엔 동네 카페에서 책을 읽고, 오후엔 숲길을 따라 한참 걸어요. 저녁엔 친구들이랑 보드게임을 자주 해요.'],
    ['함께 떠나고 싶은 여행은 어떤 모습인가요?', '숙소 하나만 정하고 나머지는 그날 기분대로 정하는 여행이요. 길을 잃어도 같이 웃을 수 있으면 좋겠어요.'],
  ] as [string, string][],
  mbti: 'ENFP', height: 178, education: '대학교 졸업', religion: '무교', smoking: '비흡연', drinking: '가끔',
  politics: '중도', politicsPublic: false,
  // 나의 취향(MY › 나의 취향) — 오늘의 인연 순서에만 쓰여요
  matchPrefs: { ageAny: false, minAge: 24, maxAge: 33, regions: [] as string[], mbtis: [] as string[], religion: '상관없음', politics: '상관없음', drinking: '상관없음', smoking: '상관없음' },
  leaf: 120,
  points: 3500,
  myCredential: { kind: 'school' as const, label: '컴퓨터공학과 졸업' },  // 승인된 내 인증
};

// ── 3. 마음함 처음 상태 ─────────────────────────────────────────────────────
// '나와 다른 성별' 사람을 people.ts 순서대로 하나씩 짝지어요. 숫자는 '몇 시간 전'.
//   received: 상대가 나에게 보낸 마음 / sent: 내가 보낸 마음 / 둘 다 있으면 '서로 마음'
//   7일(168시간)이 지난 마음은 마음함에서 사진이 가려지고 '다시 보기'(10리프)가 떠요.
export const HEART_PLAN: { received?: number; sent?: number }[] = [
  { received: 3, sent: 26 },              // 서로 마음(오늘)
  { received: 1 },                        // 방금 받은 마음
  { received: 20 },                       // 어제 받은 마음
  { sent: 5 },                            // 내가 보낸 마음
  { received: 24 * 9 },                   // 9일 전 받은 마음 — 사진 가려짐
  { sent: 48 },                           // 이틀 전 보낸 마음
  { received: 24 * 10, sent: 24 * 11 },   // 오래된 서로 마음 — 사진 가려짐
  {},                                     // 아직 아무 사이 아님(오늘의 인연에서만)
];

// ── 아래는 행(row) 만드는 코드 ─────────────────────────────────────────────
const HOUR = 3_600_000;
const ago = (t: number, hours: number) => new Date(t - hours * HOUR).toISOString();
const kstDay = (iso: string) => new Date(Date.parse(iso) + 9 * HOUR).toISOString().slice(0, 10);
export const ALL_GUIDES_SEEN = { profile: true, 'profile-0': true, 'profile-1': true, 'profile-2': true, community: true, place: true, my: true };

// 만 나이(한국 날짜 기준)
export function manAge(y: number, m: number, d: number, t = Date.now()): number {
  const k = new Date(t + 9 * HOUR);
  let age = k.getUTCFullYear() - y;
  if (k.getUTCMonth() + 1 < m || (k.getUTCMonth() + 1 === m && k.getUTCDate() < d)) age -= 1;
  return age;
}

function personRow(p: Person, i: number, t: number): Row {
  const f = PROFILES[p.id];
  const [bm, bd] = f?.birth ?? [6, 1];
  const created = ago(t, 24 * (f?.joined ?? 30) + i);
  return {
    id: p.id, email: null, nickname: p.nickname, gender: p.gender,
    birth_year: p.birthYear, birth_month: bm, birth_day: bd, age: manAge(p.birthYear, bm, bd, t), age_locked: true,
    phone: `010-5${String(100 + i).padStart(3, '0')}-${String(2000 + i * 37).slice(-4)}`, phone_hash: null, kakao_id: null,
    region: regionValue(p.region, p.district), photos: p.photos, group_photo: null,
    headline: f?.headline ?? null, bio: null,
    intro_want: f?.want ?? null, intro_interest: null, intro_hobby: null,
    extra_answers: (f?.answers ?? []).map(([q, a]) => ({ q, a })),
    job: p.job, education: f?.education ?? null, religion: f?.religion ?? null,
    mbti: f?.mbti ?? null, height: f?.height ?? null, smoking: f?.smoking ?? null, drinking: f?.drinking ?? null,
    politics: f?.politics ?? null, politics_public: !!f?.politicsPublic,
    univ_name: null,
    // 시연판 전용 칸 — 다른 회원의 승인된 인증(실제 서버는 profile_credentials 표에서 모아 와요)
    demo_credentials: f?.creds ?? [],
    leaf_balance: 0, points: 0, store_spend_total: 0, verified: true,
    profile_completed: true, match_prefs: {}, tab_guides_seen: ALL_GUIDES_SEEN,
    affinity_hidden: false, affinity_suspended: false, affinity_suspended_reason: null, affinity_suspended_at: null,
    affinity_review_requested_at: null, affinity_deck_paused: false, affinity_mute_notifs: false,
    notif_mute_all: false, notif_mute_community: false, contact_sync_at: null,
    privacy_agreed_at: created, marketing_opt_in: false, is_seed: false,
    created_at: created, updated_at: ago(t, 30 + i),
  };
}

// 프로필을 모두 채운 '나'의 칸들 — controls.completeMyProfile · setMyGender도 이걸 써요
export function fullMeFields(gender: 'M' | 'F', t = Date.now()): Row {
  const m = MY_PROFILE;
  const [y, mo, d] = m.birth;
  return {
    nickname: m.nickname, gender,
    birth_year: y, birth_month: mo, birth_day: d, age: manAge(y, mo, d, t), age_locked: true,
    phone: '010-1234-5678', kakao_id: 'yahwa_demo',
    region: m.region, photos: MY_PHOTOS[gender], headline: m.headline, bio: null,
    intro_want: m.want, intro_interest: null, intro_hobby: null,
    extra_answers: m.answers.map(([q, a]) => ({ q, a })),
    job: m.job, education: m.education, religion: m.religion, mbti: m.mbti, height: m.height,
    smoking: m.smoking, drinking: m.drinking, politics: m.politics, politics_public: m.politicsPublic,
    match_prefs: m.matchPrefs, profile_completed: true, tab_guides_seen: ALL_GUIDES_SEEN,
    affinity_suspended: false, affinity_suspended_reason: null, affinity_suspended_at: null, affinity_hidden: false,
  };
}

function meRow(t: number): Row {
  const created = ago(t, 24 * 45);
  return {
    id: ME_ID, email: 'demo@yahwa.local',
    ...fullMeFields('M', t),
    phone_hash: null, group_photo: null, univ_name: null,
    leaf_balance: MY_PROFILE.leaf, points: MY_PROFILE.points, store_spend_total: 0, verified: true,
    affinity_review_requested_at: null, affinity_deck_paused: false, affinity_mute_notifs: false,
    notif_mute_all: false, notif_mute_community: false, contact_sync_at: null,
    privacy_agreed_at: created, marketing_opt_in: false, is_seed: false,
    created_at: created, updated_at: ago(t, 2),
  };
}

// 나와 다른 성별 사람들과 주고받은 마음 · 알림 · 열람 기록(HEART_PLAN대로)
export function myHeartRows(myGender: 'M' | 'F', t = Date.now()): { interests: Row[]; notifications: Row[]; friend_views: Row[] } {
  const others = PEOPLE.filter((p) => p.gender !== myGender);
  const interests: Row[] = [];
  const notifications: Row[] = [];
  const friend_views: Row[] = [];
  HEART_PLAN.forEach((plan, i) => {
    const p = others[i];
    if (!p) return;
    if (plan.received != null) {
      const at = ago(t, plan.received);
      interests.push({ id: `seed-int-in-${p.id}`, sender_id: p.id, receiver_id: ME_ID, created_at: at });
      if (plan.received < 72) {
        notifications.push({
          id: `seed-noti-int-${p.id}`, user_id: ME_ID, kind: 'interest', title: '새로운 관심이 도착했어요',
          body: `${p.nickname} 님이 회원님에게 관심을 보냈어요. 호감 탭에서 확인해보세요.`,
          data: { kind: 'interest', otherUserId: p.id }, read: plan.received > 12, created_at: at,
        });
      }
    }
    if (plan.sent != null) {
      const at = ago(t, plan.sent);
      interests.push({ id: `seed-int-out-${p.id}`, sender_id: ME_ID, receiver_id: p.id, created_at: at });
      // 마음을 보내기 전에 프로필을 열어 봤어요
      const seen = ago(t, plan.sent + 0.2);
      friend_views.push({ id: `seed-view-${p.id}`, user_id: ME_ID, profile_id: p.id, viewed_on: kstDay(seen), created_at: seen });
    }
  });
  return { interests, notifications, friend_views };
}

export const seed = (): Record<string, Row[]> => {
  const t = Date.now();
  const hearts = myHeartRows('M', t);
  return {
    users: [meRow(t), ...PEOPLE.map((p, i) => personRow(p, i, t))],
    // 추천 프로필(운영팀 지정)
    featured_profiles: PEOPLE.filter((p) => PROFILES[p.id]?.featured).map((p) => ({ id: `feat-${p.id}`, user_id: p.id, created_at: ago(t, 24 * 3) })),
    ...hearts,
    // 내 인증 — 학력은 승인 완료(MY › 인증 관리)
    profile_credentials: [{
      id: 'seed-cred-me-school', user_id: ME_ID, kind: MY_PROFILE.myCredential.kind, label: MY_PROFILE.myCredential.label,
      ref_year: null, proof_path: null, verified_email: null, status: 'approved', reject_reason: null,
      created_at: ago(t, 24 * 20), reviewed_at: ago(t, 24 * 19),
    }],
    // 아래 표는 처음엔 비어 있어요(앱이 쓰면서 채워져요)
    blocks: [], contact_blocks: [], deck_batches: [], deck_reveals: [], deck_views: [], friend_deck_extras: [],
    mind_photo_unlocks: [], reward_grants: [], unlocks: [], connections: [], connection_contact_unlocks: [],
    leaf_conversions: [], user_active_days: [], push_tokens: [], univ_verifications: [],
  };
};
