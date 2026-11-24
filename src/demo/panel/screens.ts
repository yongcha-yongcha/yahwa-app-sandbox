// 야화 시연도구 — '화면 이동' 목록. 화면 이름(app/index.tsx의 Overlay)과 한국어 이름.
// 새 화면을 만들었으면 여기에 한 줄 추가하면 시연도구에서 바로 열 수 있어요.
import { table, ME_ID, userById } from '../db';
import { PEOPLE } from '../people';
import type { DemoNavTarget } from '../bridge';

export type ScreenLink = { label: string; target: () => DemoNavTarget | null; note?: string };
export type ScreenGroup = { title: string; items: ScreenLink[] };

// 나와 다른 성별의 첫 사람(상대 프로필 열 때)
function firstMatch(): string {
  const g = userById(ME_ID)?.gender ?? 'M';
  return (PEOPLE.find((p) => p.gender !== g) ?? PEOPLE[0]).id;
}
const firstId = (t: string, pred: (r: any) => boolean = () => true) => table(t).find(pred)?.id ?? null;
const firstLetter = () => firstId('letters', (l) => l.receiver_id === ME_ID) ?? firstId('letters');

export const SCREEN_GROUPS: ScreenGroup[] = [
  {
    title: '하단 메뉴',
    items: [
      { label: '인연 홈', target: () => ({ tab: 'affinity' }) },
      { label: '마음함', target: () => ({ tab: 'heart' }) },
      { label: '편지함', target: () => ({ tab: 'letters' }) },
      { label: '커뮤니티', target: () => ({ tab: 'lounge' }) },
      { label: 'MY', target: () => ({ tab: 'me' }) },
    ],
  },
  {
    title: '인연',
    items: [
      { label: '상대 프로필', target: () => ({ overlay: 'friendDetail', params: { friendUserId: firstMatch() } }) },
      { label: '편지 쓰기', target: () => { const p = PEOPLE.find((x) => x.id === firstMatch())!; return { letterCompose: { id: p.id, nickname: p.nickname, photo: p.photos[0] } }; } },
      { label: '나의 취향', target: () => ({ overlay: 'matchPrefs' }) },
      { label: '인연 이용안내', target: () => ({ overlay: 'affinityFriends' }) },
    ],
  },
  {
    title: '편지',
    items: [
      { label: '받은 편지 열기', target: () => { const id = firstLetter(); return id ? { overlay: 'letterDetail', params: { letterId: id } } : null; } },
    ],
  },
  {
    title: '커뮤니티',
    items: [
      { label: '글 상세', target: () => { const id = firstId('lounge_posts'); return id ? { overlay: 'loungeDetail', params: { loungePostId: id } } : null; } },
      { label: '알림', target: () => ({ overlay: 'notifications' }) },
      { label: '프로필 교환', target: () => ({ overlay: 'profileExchanges' }) },
      { label: '내가 공감한 글', target: () => ({ overlay: 'myDetail', params: { myDetailMode: 'likes' } }) },
    ],
  },
  {
    title: 'MY',
    items: [
      { label: '내 프로필 보기', target: () => ({ overlay: 'myPreview' }) },
      { label: '프로필 수정', target: () => ({ overlay: 'profileEdit' }) },
      { label: '리프 충전', target: () => ({ overlay: 'charge' }) },
      { label: '무료 리프 받기', target: () => ({ overlay: 'myRewards' }) },
      { label: '사용 · 적립 내역', target: () => ({ overlay: 'spendHistory' }) },
      { label: '포인트 → 리프', target: () => ({ overlay: 'myConvert' }) },
      { label: '받은 쿠폰', target: () => ({ overlay: 'couponWallet' }) },
      { label: '쿠폰함(지도)', target: () => ({ overlay: 'place' }) },
      { label: '매장 상세', target: () => { const id = firstId('stores'); return id ? { overlay: 'storeDetail', params: { storeId: id } } : null; } },
      { label: '뱃지 · 인증', target: () => ({ overlay: 'badgeManage' }) },
      { label: '내 뱃지', target: () => ({ overlay: 'myBadges' }) },
      { label: '인연 공개', target: () => ({ overlay: 'myVisibility' }) },
      { label: '지인 차단', target: () => ({ overlay: 'myContactBlock' }) },
      { label: '알림 설정', target: () => ({ overlay: 'myNotif' }) },
      { label: '설정 · 도움말', target: () => ({ overlay: 'mySettings' }) },
      { label: '차단 관리', target: () => ({ overlay: 'myBlocks' }) },
      { label: '숨긴 인연', target: () => ({ overlay: 'myHidden' }) },
      { label: '회원 탈퇴', target: () => ({ overlay: 'myWithdraw' }) },
    ],
  },
];

// 지금 화면 이름(시연도구 맨 위)
const TAB_NAME: Record<string, string> = { affinity: '인연 홈', heart: '마음함', letters: '편지함', lounge: '커뮤니티', me: 'MY', gather: '모임' };
const EXTRA_NAMES: Record<string, string> = { letterCompose: '편지 쓰기', letterDetail: '편지 상세', profileGate: '인연 프로필 등록', chatRoom: '채팅방', storeSocialingCreate: '매장 모임 만들기', myCouponDetail: '쿠폰 자세히', myCouponUse: '직원 확인', myCertForm: '인증 입력', myAccount: '계정 관리', myNickname: '닉네임 변경', myInquiry: '문의하기', myTerms: '약관', myPointLedger: '매장 포인트 내역' };
// 처음 부를 때 만든다(목업 데이터가 준비된 뒤)
let overlayNames: Record<string, string> | null = null;
function overlayName(o: string): string {
  if (!overlayNames) {
    overlayNames = { ...EXTRA_NAMES };
    for (const i of SCREEN_GROUPS.flatMap((g) => g.items)) {
      const t = i.target();
      if (t && 'overlay' in t && !overlayNames[t.overlay]) overlayNames[t.overlay] = i.label;
    }
  }
  return overlayNames[o] ?? o;
}

export function screenName(tab: string, overlay: string | null, entry: string | null): string {
  if (entry === 'welcome') return '웰컴(첫 실행)';
  if (entry === 'auth') return '로그인 · 가입';
  if (entry === 'signup') return '가입 · 프로필 등록';
  if (overlay) return overlayName(overlay);
  return TAB_NAME[tab] ?? tab;
}
