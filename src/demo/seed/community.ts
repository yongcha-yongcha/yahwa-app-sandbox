// 야화 시연판 — 커뮤니티(익명 이야기) · 알림 · 프로필 교환의 처음 상태.
// 위쪽 POSTS · EXCHANGES만 고치면 돼요. 아래 '만드는 부분'이 표(table) 행으로 바꿔 줘요.
//   · 글 첫 줄이 제목이에요(앱도 첫 줄을 제목으로 저장해요).
//   · by: 글쓴이 id — people.ts의 'u-f01' 같은 id, 나는 ME.
//   · ago: 몇 분 전인지. m(5) = 5분 전, h(3) = 3시간 전, d(2) = 2일 전.
//   · 댓글 닉네임은 글마다 자동으로 붙어요(같은 글 안에서 같은 사람은 같은 닉네임).
//   · 내 글에 달린 댓글 · 내 댓글에 달린 답글 알림은 실제 서버처럼 자동으로 만들어져요(최근 70분 안의 것만 '안 읽음').
//   · 탭: 전체(최신순) · 공감순(좋아요+댓글 3 이상, 최근 7일 안에 뽑힌 글) · 내 글.
//   · 음성 글·음성 댓글은 넣지 않았어요(시연판에 음성 파일이 없어요). 시연 중에 새로 녹음해 올리는 건 돼요.
import type { Row } from '../db';
import { person } from '../people';

// 나(db.ts의 ME_ID와 같은 값). 시드는 db.ts가 다 읽히기 전에 만들어져서 db.ts에서 가져오지 않고 그대로 적는다.
export const ME = 'demo-me';
const m = (n: number) => n;
const h = (n: number) => n * 60;
const d = (n: number) => n * 1440;

type Cat = 'free' | 'love' | 'qna' | 'meet' | 'food';
type CommentSeed = {
  id?: string;            // 교환 요청에서 가리킬 댓글만 적어요
  by: string;
  ago: number;
  text: string;
  likes?: number;
  likedByMe?: boolean;    // 내가 공감(♡)한 댓글
  replies?: CommentSeed[];
};
type PostSeed = {
  id: string;
  by: string;
  cat: Cat;
  ago: number;
  nick: string;           // 이 글에서 글쓴이의 익명 닉네임
  text: string;           // 첫 줄 = 제목
  photos?: ('cafe' | 'food' | 'trip' | 'walk')[];
  likes: number;
  likedByMe?: boolean;
  views?: number;
  comments?: CommentSeed[];
};

// ── 글 · 댓글 ────────────────────────────────────────────────
export const POSTS: PostSeed[] = [
  {
    id: 'lp-01', by: 'u-f05', cat: 'free', ago: m(12), nick: '설레는 프리지아', likes: 7, views: 41,
    text: '퇴근길 지하철에서 옆 사람이 제 책을 같이 읽고 있었어요\n페이지를 넘기려니까 아주 작게 "아 잠깐만요" 해서 둘 다 웃음이 터졌어요. 내릴 때 책 제목을 물어보길래 알려 줬는데, 이런 것도 인연이라고 해야 할까요 ㅎㅎ',
    comments: [
      { by: 'u-m08', ago: m(5), text: '드라마 첫 장면 같아요 ㅋㅋ 무슨 책이었는지 저도 궁금해요' },
    ],
  },
  {
    id: 'lp-me1', by: ME, cat: 'love', ago: h(2), nick: '다정한 수국', likes: 9, views: 88,
    text: '소개팅 후 애프터 연락, 다음 날 하는 게 맞을까요?\n어제 소개팅을 했는데 대화가 정말 잘 통했어요. 바로 연락하면 너무 들이대는 것 같고, 이틀 기다리면 관심 없어 보일까 봐 고민이에요. 다들 보통 언제 연락하세요?',
    comments: [
      {
        by: 'u-f06', ago: m(110), likes: 6, likedByMe: true,
        text: '다음 날 점심쯤 "어제 즐거웠어요" 한 줄이면 충분하다고 생각해요! 너무 재지 마세요 ㅎㅎ',
        replies: [
          { by: ME, ago: m(100), text: '점심쯤이 딱 좋겠네요. 조언 고마워요!' },
          { by: 'u-f02', ago: m(90), likes: 2, text: '저도 동의해요. 너무 늦으면 오히려 관심 없는 줄 알아요' },
        ],
      },
      { by: 'u-m04', ago: m(95), likes: 3, text: '저는 그날 밤에 잘 들어갔냐고 보내요. 타이밍보다 진심이 더 중요한 것 같아요' },
      { by: 'u-f03', ago: m(60), likes: 4, text: '대화가 잘 통했다면 상대도 연락 기다리고 있을 거예요. 응원해요!' },
      { by: 'u-f02', ago: m(35), likes: 1, text: '이틀은 너무 길어요 ㅠㅠ 저라면 조금 서운할 것 같아요' },
    ],
  },
  {
    id: 'lp-02', by: 'u-m03', cat: 'food', ago: h(3), nick: '주말의 라벤더', likes: 14, views: 120, photos: ['food'],
    text: '주말에 처음으로 라자냐를 만들어 봤어요\n생각보다 손이 많이 가는데, 오븐에서 꺼낼 때 그 냄새가 다 보상해 줘요. 다음엔 누군가랑 같이 먹고 싶어요… 혼자 먹기엔 양이 너무 많았거든요',
    comments: [
      { by: 'u-f05', ago: h(2.8), likes: 2, text: '라자냐를 직접 만드는 사람 너무 멋있어요' },
      {
        by: ME, ago: h(2.5), likes: 1,
        text: '레시피 공유해 주세요! 저도 이번 주말에 도전해 볼래요',
        replies: [
          { by: 'u-m03', ago: h(2.2), text: '생각보다 어렵지 않아요. 라구 소스만 넉넉히 만들어 두면 반은 끝이에요' },
        ],
      },
    ],
  },
  {
    id: 'lp-03', by: 'u-f02', cat: 'love', ago: h(5), nick: '수줍은 튤립', likes: 21, likedByMe: true, views: 203,
    text: '연락 텀이 긴 사람, 관심이 없는 걸까요?\n만나면 정말 다정한데 카톡 답장은 반나절씩 걸려요. 원래 폰을 잘 안 보는 사람이라는데, 저만 매번 기다리는 것 같아서 조금 지쳐요.',
    comments: [
      {
        by: ME, ago: h(4), likes: 5,
        text: '저도 연락이 느린 편인데 관심이 없어서 그런 건 아니었어요. 만났을 때 어떤지가 더 중요한 것 같아요',
        replies: [
          { by: 'u-f02', ago: h(3.8), likes: 1, text: '그 말 들으니까 좀 안심돼요. 고마워요!' },
          { by: 'u-f05', ago: m(50), text: '맞아요, 만났을 때 다정하면 그게 진짜예요' },
        ],
      },
      { by: 'u-f04', ago: h(3), likes: 7, likedByMe: true, text: '기다리는 게 지치면 솔직하게 말해 보는 것도 방법이에요. 생각보다 쉽게 바뀌기도 해요' },
      { by: 'u-m05', ago: h(2), likes: 2, text: '사람마다 연락 스타일이 진짜 달라요. 한 번 이야기해 보세요' },
    ],
  },
  {
    id: 'lp-04', by: 'u-m01', cat: 'meet', ago: h(7), nick: '새벽의 코스모스', likes: 6, views: 64, photos: ['walk'],
    text: '토요일 아침 한강 러닝 같이 하실 분 계신가요\n잠실 쪽에서 아침 7시쯤 5km 가볍게 뛰어요. 페이스는 맞춰 드려요! 끝나고 근처에서 커피 한 잔 하기 딱 좋은 계절이에요.',
    comments: [
      { by: 'u-m05', ago: h(6), text: '저 영등포인데 잠실까지 가 볼게요!' },
      { by: 'u-f06', ago: h(5), likes: 1, text: '아침 7시… 의지가 대단하세요' },
    ],
  },
  {
    id: 'lp-05', by: 'u-f08', cat: 'free', ago: h(9), nick: '고요한 수선화', likes: 18, likedByMe: true, views: 151, photos: ['cafe'],
    text: '비 오는 날 창가 자리를 차지한 날\n라테 하나 시켜 놓고 두 시간째 멍하니 있는 중이에요. 이런 날은 누가 옆에서 아무 말 없이 같이 있어 주기만 해도 좋을 것 같아요.',
    comments: [
      {
        by: 'u-f01', ago: h(8), likes: 3, text: '사진 분위기 너무 좋아요. 어디 카페예요?',
        replies: [{ by: 'u-f08', ago: h(7.5), likes: 1, text: '강남역 근처 골목에 있는 작은 곳이에요!' }],
      },
      { by: 'u-m04', ago: h(6), likes: 2, text: '비 오는 날 창가 자리는 못 참죠' },
    ],
  },
  {
    id: 'lp-06', by: 'u-m05', cat: 'qna', ago: h(14), nick: '차분한 해바라기', likes: 11, views: 97,
    text: '프로필 사진, 셀카 vs 친구가 찍어 준 사진\n어떤 게 더 호감이세요? 저는 셀카가 너무 어색하게 나와서 고민이에요. 여행 가서 찍힌 사진은 있는데 얼굴이 작게 나와요.',
    comments: [
      { id: 'lc-06-f03', by: 'u-f03', ago: h(13), likes: 6, text: '친구가 찍어 준 자연스러운 사진이 훨씬 좋아요!' },
      { by: 'u-f07', ago: h(12), likes: 3, text: '웃는 사진 하나는 꼭 넣으세요. 그게 제일 기억에 남아요' },
      { by: ME, ago: h(11), text: '저도 같은 고민이었는데 댓글 보고 사진 바꿔야겠어요' },
    ],
  },
  {
    id: 'lp-me2', by: ME, cat: 'free', ago: d(1), nick: '산책하는 물망초', likes: 5, views: 52,
    text: '요즘 퇴근하고 30분씩 걷는 중이에요\n처음엔 운동하려고 시작했는데, 걷다 보니 머릿속이 정리되는 게 더 좋더라고요. 다들 하루 끝에 하는 작은 루틴 있으세요?',
    comments: [
      {
        by: 'u-f08', ago: h(20), likes: 4, text: '저는 자기 전에 오늘 좋았던 일 세 가지를 적어요. 별거 아닌데 기분이 좋아져요',
        replies: [{ by: ME, ago: h(19), text: '오 그거 좋네요. 오늘부터 해 볼게요' }],
      },
      { by: 'u-m07', ago: h(18), likes: 1, text: '저녁 먹고 동네 한 바퀴! 걷는 거 최고죠' },
      { by: 'u-f06', ago: h(6), likes: 2, text: '퇴근길에 한 정거장 먼저 내려서 걸어요. 노을 볼 때가 제일 좋아요' },
    ],
  },
  {
    id: 'lp-07', by: 'u-f03', cat: 'love', ago: d(1.2), nick: '가을빛 동백', likes: 25, views: 240, photos: ['trip'],
    text: '혼자 떠난 여행에서 생긴 일\n부산 토박이인데 일부러 여행자처럼 동네를 다녀 봤어요. 게스트하우스 옥상에서 처음 본 사람들이랑 밤새 이야기했는데, 연애도 이렇게 편하게 시작하면 좋겠다 싶었어요.',
    comments: [
      { by: 'u-m02', ago: d(1.1), likes: 4, text: '그런 밤이 오래 기억에 남죠' },
      { by: 'u-f01', ago: d(1), likes: 2, text: '옥상 대화 너무 낭만적이에요' },
      { by: ME, ago: h(20), likes: 1, text: '부산 어느 동네였는지 궁금해요! 다음 여행 때 가 보고 싶어요' },
    ],
  },
  {
    id: 'lp-08', by: 'u-m06', cat: 'qna', ago: d(2), nick: '고요한 라일락', likes: 16, views: 180,
    text: '첫 만남 장소, 어디가 제일 무난할까요?\n카페는 너무 면접 같고 식당은 부담스럽다는 말을 들어서요. 전시회나 산책 코스도 괜찮을까요?',
    comments: [
      { id: 'lc-08-f01', by: 'u-f01', ago: d(1.9), likes: 9, text: '전시회 좋아요! 대화 소재가 자연스럽게 생겨서 어색할 틈이 없어요' },
      { id: 'lc-08-f04', by: 'u-f04', ago: d(1.8), likes: 5, text: '산책 코스 추천해요. 걷다가 마음에 드는 카페에 들어가면 딱이에요' },
      { by: 'u-m03', ago: d(1.7), likes: 2, text: '저는 무조건 맛집이요 ㅋㅋ 먹으면서 이야기하면 금방 친해져요' },
    ],
  },
  {
    id: 'lp-09', by: 'u-f06', cat: 'free', ago: d(2.5), nick: '포근한 안개꽃', likes: 33, likedByMe: true, views: 312,
    text: '서른이 되니까 연애 방식이 달라졌어요\n예전엔 설렘이 제일 중요했는데, 요즘은 대화가 편한 사람이 제일 좋아요. 같이 조용히 있어도 어색하지 않은 사람이요. 저만 그런가요?',
    comments: [
      { by: 'u-f07', ago: d(2.4), likes: 8, text: '완전 공감해요. 결국 편한 사람이 최고예요' },
      { by: 'u-m01', ago: d(2.3), likes: 3, text: '저도요. 같이 밥 먹을 때 편한 사람이 좋더라고요' },
      { id: 'lc-09-me', by: ME, ago: d(2.2), likes: 5, text: '나이가 들수록 말이 잘 통하는 사람이 제일 소중한 것 같아요' },
    ],
  },
  {
    id: 'lp-10', by: 'u-m08', cat: 'food', ago: d(3), nick: '반짝이는 거베라', likes: 27, likedByMe: true, views: 275,
    text: '바리스타가 알려 주는, 집에서 커피 맛있게 내리는 법\n원두는 꼭 마시기 직전에 갈아 주세요. 물 온도는 90~93도, 처음 30초는 뜸 들이기! 이것만 지켜도 맛이 확 달라져요. 궁금한 거 물어보세요 :)',
    comments: [
      {
        by: 'u-f05', ago: d(2.9), likes: 2, text: '핸드드립 도전해 보고 싶어요! 드리퍼는 뭐가 좋아요?',
        replies: [{ by: 'u-m08', ago: d(2.8), likes: 3, text: '처음엔 플라스틱 드리퍼로도 충분해요. 익숙해지면 그때 바꿔도 돼요' }],
      },
      { by: 'u-f02', ago: d(2.7), likes: 1, text: '뜸 들이기가 핵심이었군요. 매번 그냥 부었어요 ㅎㅎ' },
    ],
  },
  {
    id: 'lp-11', by: 'u-f07', cat: 'love', ago: d(4), nick: '별 보는 능소화', likes: 19, views: 190,
    text: '헤어지고 1년, 이제 다시 누군가를 만나도 될까요\n마음은 괜찮은데 막상 새로운 사람을 만나려니 조금 겁이 나요. 다시 시작하신 분들은 어떤 계기가 있었는지 궁금해요.',
    comments: [
      { by: 'u-f04', ago: d(3.9), likes: 4, text: '천천히 하셔도 돼요. 마음이 먼저 열릴 때가 와요' },
      { by: 'u-m07', ago: d(3.8), likes: 3, text: '저도 그랬어요. 친구 만나듯이 편하게 시작해 보세요' },
      { id: 'lc-11-f08', by: 'u-f08', ago: d(3.7), likes: 6, text: '저는 좋아하는 취미 모임부터 다시 나갔어요. 그러다 보니 자연스럽게 되더라고요' },
    ],
  },
  {
    id: 'lp-12', by: 'u-m02', cat: 'free', ago: d(5), nick: '은은한 목련', likes: 22, views: 230,
    text: '건축가가 추천하는 서울 산책 코스\n서촌에서 시작해서 윤동주 문학관까지 걷는 길을 좋아해요. 오래된 집들 사이로 골목이 이어져서 천천히 걷기 좋아요. 데이트 코스로도 추천해요!',
    comments: [
      { by: 'u-f01', ago: d(4.9), likes: 2, text: '서촌 골목 정말 좋죠. 해 질 때 가면 더 예뻐요' },
      { by: 'u-f03', ago: d(4.5), text: '부산에도 이런 코스가 있으면 좋겠어요' },
    ],
  },
  {
    id: 'lp-13', by: 'u-f04', cat: 'qna', ago: d(6), nick: '상냥한 데이지', likes: 15, views: 160,
    text: '교대 근무하는 분들, 연애 어떻게 하세요?\n간호사라 3교대인데 주말에 쉬는 날이 거의 없어요. 상대가 서운해할까 봐 시작도 전에 걱정부터 돼요.',
    comments: [
      { by: 'u-f06', ago: d(5.9), likes: 3, text: '서로 일정 공유하는 앱 써 보세요! 생각보다 도움 많이 돼요' },
      { by: 'u-m05', ago: d(5.8), likes: 4, text: '이해해 주는 사람 꼭 있어요. 처음부터 솔직하게 말하면 돼요' },
    ],
  },
  {
    id: 'lp-14', by: 'u-m07', cat: 'free', ago: d(8), nick: '꿈꾸는 민들레', likes: 12, views: 140,
    text: '주말에 읽을 책 추천 받아요\n요즘 사람 사이의 거리를 다정하게 이야기하는 에세이를 다시 읽고 있어요. 다들 최근에 좋았던 책 있으면 알려 주세요.',
    comments: [
      { by: 'u-f01', ago: d(7.9), likes: 2, text: '편집자로서 반가운 글이에요 ㅎㅎ 저도 에세이 몇 권 추천해 드릴게요' },
    ],
  },
  {
    id: 'lp-15', by: 'u-f01', cat: 'meet', ago: d(9), nick: '봄날의 아네모네', likes: 9, views: 110,
    text: '마포 근처 독서 모임 관심 있으신 분\n한 달에 한 권 읽고 카페에서 이야기 나누는 작은 모임이에요. 출판 편집자라 책 고르는 건 자신 있어요 ㅎㅎ',
    comments: [
      { by: 'u-m07', ago: d(8.9), likes: 1, text: '독서 모임 관심 있어요!' },
      { by: 'u-f05', ago: d(8.5), text: '마포면 갈 수 있을 것 같아요' },
    ],
  },
];

// ── 프로필 교환 ──────────────────────────────────────────────
// from이 요청한 사람, to가 받은 사람. post/comment는 어디서 요청했는지(댓글이면 그 댓글을 쓴 사람이 to).
// status: pending(기다림) · accepted(성사) · declined(거절) · released(해제)
// 성사·해제한 사람은 '오늘의 인연' 추천에서 빠져요(실제 서버와 같아요).
type ExchangeSeed = {
  id: string; from: string; to: string;
  post: string; comment?: string;
  status: 'pending' | 'accepted' | 'declined' | 'released';
  ago: number;                // 요청한 때
  respondedAgo?: number;      // 수락·거절한 때
  releasedAgo?: number; releasedBy?: string;
  read?: boolean;             // 나에게 온 알림을 읽었는지
};
export const EXCHANGES: ExchangeSeed[] = [
  // 받은 요청 — 내 글을 보고(기다리는 중)
  { id: 'px-01', from: 'u-f02', to: ME, post: 'lp-me1', status: 'pending', ago: m(30), read: false },
  { id: 'px-02', from: 'u-f06', to: ME, post: 'lp-me2', status: 'pending', ago: h(3), read: true },
  // 보낸 요청 — 상대 댓글을 보고
  { id: 'px-03', from: ME, to: 'u-f04', post: 'lp-08', comment: 'lc-08-f04', status: 'pending', ago: d(1) },
  { id: 'px-04', from: ME, to: 'u-f01', post: 'lp-08', comment: 'lc-08-f01', status: 'accepted', ago: d(1.5), respondedAgo: h(2), read: false },
  // 교환 기록
  { id: 'px-05', from: 'u-f07', to: ME, post: 'lp-09', comment: 'lc-09-me', status: 'accepted', ago: d(2), respondedAgo: d(1.9), read: true },
  { id: 'px-06', from: ME, to: 'u-f03', post: 'lp-06', comment: 'lc-06-f03', status: 'declined', ago: d(2.5), respondedAgo: d(2) },
  { id: 'px-07', from: ME, to: 'u-f08', post: 'lp-11', comment: 'lc-11-f08', status: 'released', ago: d(3.5), respondedAgo: d(3.4), releasedAgo: d(1.5), releasedBy: 'u-f08' },
];

// 알림 '안 읽음'으로 둘 기준(이보다 최근 댓글 알림만 안 읽음)
const UNREAD_WITHIN_MIN = 70;

// ─────────────────────────────────────────────────────────────
// 만드는 부분 — 위 내용을 표(table) 행으로 바꾼다
// ─────────────────────────────────────────────────────────────

// 익명 닉네임 — 앱(makeAnonNick)과 같은 '수식어 + 꽃' 모양
const ADJ = ['싱그러운', '다정한', '포근한', '수줍은', '설레는', '은은한', '나른한', '반짝이는', '상냥한', '말랑한', '차분한', '엉뚱한', '발랄한', '고요한', '따스한', '새벽의', '봄날의', '가을빛', '꿈꾸는', '별 보는'];
const FLOWER = ['데이지', '라벤더', '튤립', '프리지아', '안개꽃', '수국', '작약', '물망초', '해바라기', '코스모스', '동백', '목련', '민들레', '아네모네', '거베라', '백합', '라일락', '능소화', '수선화', '팬지'];
function hash(s: string): number { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; }
// 글 하나 안에서 그 사람의 닉네임 — taken에 없는 것으로
export function anonNick(seed: string, taken: Set<string>): string {
  const n = hash(seed);
  for (let i = 0; i < 40; i++) {
    const nick = `${ADJ[(n + i * 7) % ADJ.length]} ${FLOWER[(Math.floor(n / 7) + i) % FLOWER.length]}`;
    if (!taken.has(nick)) return nick;
  }
  return '익명';
}
export const genderOf = (id: string): 'M' | 'F' | null => (id === ME ? 'M' : person(id)?.gender ?? null);
export const titleOf = (text: string) => Array.from(text.split('\n')[0]).slice(0, 40).join('');

// 시드는 db.ts가 처음 불릴 때 만들어진다 — 그때는 db.ts의 시각 함수(minutesAgo 등)를 아직 쓸 수 없어 여기서 직접 계산한다
export const seed = (): Record<string, Row[]> => {
  const t0 = Date.now();
  const at = (min: number) => new Date(t0 - min * 60_000).toISOString();
  const posts: Row[] = [];
  const comments: Row[] = [];
  const postLikes: Row[] = [];
  const commentLikes: Row[] = [];
  const notifs: Row[] = [];

  for (const p of POSTS) {
    const nicks = new Map<string, string>([[p.by, p.nick]]);
    const nickFor = (uid: string) => {
      if (!nicks.has(uid)) nicks.set(uid, anonNick(`${p.id}:${uid}`, new Set(nicks.values())));
      return nicks.get(uid)!;
    };
    const title = titleOf(p.text);
    let n = 0;
    const addComment = (c: CommentSeed, parent: Row | null) => {
      n += 1;
      const row: Row = {
        id: c.id ?? `${p.id}-c${n}`, post_id: p.id, parent_id: parent?.id ?? null,
        author_id: c.by, anon_nickname: nickFor(c.by), author_gender: genderOf(c.by),
        body: c.text, likes: c.likes ?? 0, edited_at: null, deleted_at: null,
        audio_url: null, audio_duration: null, created_at: at(c.ago),
      };
      comments.push(row);
      if (c.likedByMe) commentLikes.push({ id: `lcl-${row.id}`, comment_id: row.id, user_id: ME, created_at: at(c.ago - 1) });
      // 서버 알림 트리거(0133)와 같은 규칙 — 나에게 오는 것만 만든다
      const unread = c.ago < UNREAD_WITHIN_MIN;
      const preview = c.text.slice(0, 60);
      if (parent && parent.author_id === ME && c.by !== ME) {
        notifs.push({ id: `nt-${row.id}`, user_id: ME, kind: 'lounge_reply', title: '내 댓글에 답글이 달렸어요', body: preview, data: { postId: p.id, commentId: row.id }, read: !unread, created_at: row.created_at });
      } else if (p.by === ME && c.by !== ME) {
        notifs.push({ id: `nt-${row.id}`, user_id: ME, kind: 'lounge_comment', title: `${title || '내 글'}에 댓글이 달렸어요`, body: preview, data: { postId: p.id, commentId: row.id }, read: !unread, created_at: row.created_at });
      }
      (c.replies ?? []).forEach((r) => addComment(r, row));
    };
    (p.comments ?? []).forEach((c) => addComment(c, null));

    // 인기(공감순) — 좋아요+댓글이 3 이상이면 뽑히고 7일 유지(서버 0100). 뽑힌 때는 글 쓴 뒤 조금 지나서로 둔다
    const commentCount = comments.filter((c) => c.post_id === p.id).length;
    const popular = p.likes + commentCount >= 3 ? at(Math.max(0, p.ago - Math.min(60, p.ago / 2))) : null;
    posts.push({
      id: p.id, author_id: p.by, anon_nickname: p.nick, cat: p.cat, title, body: p.text,
      attachments: (p.photos ?? []).map((k) => `/demo/community/${k}.jpg`),
      likes: p.likes, views: p.views ?? 0, popular_since: popular,
      author_gender: genderOf(p.by), audio_url: null, audio_duration: null,
      created_at: at(p.ago),
    });
    if (p.likedByMe) postLikes.push({ id: `ll-${p.id}`, post_id: p.id, user_id: ME, created_at: at(p.ago - 1) });
  }

  const exchanges: Row[] = EXCHANGES.map((x) => ({
    id: x.id, requester_id: x.from, target_id: x.to, post_id: x.post, comment_id: x.comment ?? null,
    status: x.status, created_at: at(x.ago),
    responded_at: x.respondedAgo != null ? at(x.respondedAgo) : null,
    released_at: x.releasedAgo != null ? at(x.releasedAgo) : null,
    released_by: x.releasedBy ?? null,
    requester_viewed_at: null, target_viewed_at: null,
  }));
  // 교환 알림 — 받은 요청(서버 0187 문구) · 내가 보낸 요청이 수락됨(0132 문구)
  for (const x of EXCHANGES) {
    if (x.to === ME) {
      notifs.push({
        id: `nt-${x.id}-req`, user_id: ME, kind: 'profile_exchange_request', title: '프로필 교환 신청',
        body: x.comment ? '내 댓글을 보고 프로필 교환을 신청했어요' : '내 글을 보고 프로필 교환을 신청했어요',
        data: { exchangeId: x.id, postId: x.post, commentId: x.comment ?? null }, read: x.read ?? true, created_at: at(x.ago),
      });
    }
    if (x.from === ME && x.respondedAgo != null && x.status !== 'declined') {
      notifs.push({
        id: `nt-${x.id}-ok`, user_id: ME, kind: 'profile_exchange_accepted', title: '프로필 교환 성사',
        body: '상대가 수락했어요. 이제 서로의 인연 프로필을 볼 수 있어요',
        data: { exchangeId: x.id, otherUserId: x.to }, read: x.read ?? true, created_at: at(x.respondedAgo),
      });
    }
  }

  return {
    lounge_posts: posts,
    lounge_comments: comments,
    lounge_likes: postLikes,
    lounge_comment_likes: commentLikes,
    profile_exchanges: exchanges,
    notifications: notifs,
    reports: [],
  };
};
