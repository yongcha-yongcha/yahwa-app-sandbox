// 야화 — MY 아래에 쌓이는 화면들의 이름과 이동 약속(리뉴얼 1120 · spec-rest §1.3)
// 예전에는 MY 기능을 전부 가운데 모달로 열었다. 지금은 화면마다 app/index의 겹쳐 여는 화면(Overlay) 이름을 하나씩 갖고,
// 머리 줄(뒤로 + 제목)이 있는 안쪽 화면으로 밀려 들어온다. 화면 사이 이동은 MyNav 하나로 한다.
import type { GnbTab } from '../../ui';

export const MY_SCREENS = [
  'myPreview',       // 내 프로필 보기
  'myRewards',       // 무료 리프 받기
  'myConvert',       // 포인트를 리프로
  'myPointLedger',   // 매장 포인트 내역
  'myCouponDetail',  // 쿠폰 자세히
  'myCouponUse',     // 직원에게 보여주세요(확인코드)
  'myCertForm',      // 인증 입력
  'myBadges',        // 내 뱃지(대학교 인증 등)
  'myVisibility',    // 인연 공개
  'myContactBlock',  // 지인 차단
  'myNotif',         // 알림 설정
  'mySettings',      // 설정 · 도움말
  'myAccount',       // 계정 관리
  'myNickname',      // 닉네임 변경
  'myBlocks',        // 차단 관리
  'myHidden',        // 숨긴 인연
  'myInquiry',       // 문의하기
  'myTerms',         // 약관 · 개인정보
  'myWithdraw',      // 회원 탈퇴
] as const;
export type MyScreen = (typeof MY_SCREENS)[number];
export const isMyScreen = (o: string | null): o is MyScreen => !!o && (MY_SCREENS as readonly string[]).includes(o);

// MY 묶음에서 갈 수 있는 곳 — 위 화면들 + 예전부터 있던 겹쳐 여는 화면
//  charge 리프 충전 · spendHistory 사용 · 적립 내역 · couponWallet 받은 쿠폰 · place 쿠폰함(지도) · storeDetail 매장 상세(openStore로) ·
//  badgeManage 배지 · 인증 · profileEdit 프로필 수정
export type MyTarget = MyScreen | 'charge' | 'spendHistory' | 'couponWallet' | 'place' | 'badgeManage' | 'profileEdit';
export type MyNav = {
  push: (to: MyTarget) => void;        // 안쪽으로(뒤로 = 직전 화면)
  back: () => void;                    // 직전 화면으로
  openStore: (storeId: string) => void; // 매장 상세
};

// 하단 메뉴를 띄워 두는 화면 → 켜 둘 칸(MY). 아래 고정 버튼이 있는 화면(인증 입력 · 지인 차단 · 포인트 바꾸기 · 닉네임 · 탈퇴)은 뺀다.
// 매장 상세 · 쿠폰 자세히(아래 고정 버튼) · 직원 확인(확인코드 입력)도 뺀다(시안 coupon-box 개선안, 11-23).
export const MY_GNB: Partial<Record<MyTarget | 'storeDetail', GnbTab>> = {
  myPreview: 'me', myRewards: 'me', myPointLedger: 'me', myBadges: 'me',
  myVisibility: 'me', myNotif: 'me', mySettings: 'me', myAccount: 'me', myBlocks: 'me', myHidden: 'me', myInquiry: 'me', myTerms: 'me',
  charge: 'me', spendHistory: 'me', couponWallet: 'me', place: 'me', badgeManage: 'me',
};

// 화면에 넘길 값 — 겹쳐 연 화면은 뒤로 돌아오면 새로 그려지므로 화면 밖(여기)에 둔다
export type CertKind = 'school' | 'company' | 'income';
export const myParams: {
  certKind: CertKind;                 // 인증 입력: 어떤 인증인지
  userCouponId: string | null;        // 쿠폰 자세히 · 직원 확인: 내 쿠폰(user_coupons.id)
  placeFocusStoreId: string | null;   // 쿠폰함(지도): 들어가자마자 가운데로 옮길 매장(매장 상세 '지도에서 보기')
  couponTab: 'usable' | 'used' | 'expired';  // 받은 쿠폰: 처음 보일 칩
} = { certKind: 'school', userCouponId: null, placeFocusStoreId: null, couponTab: 'usable' };
