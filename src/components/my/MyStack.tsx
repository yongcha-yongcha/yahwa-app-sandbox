// 야화 — MY 아래에 쌓이는 화면 모음(리뉴얼 1120). app/index가 겹쳐 여는 화면 이름(MyScreen)으로 이 중 하나를 그린다.
import React from 'react';
import type { MyNav, MyScreen } from './nav';
import { PreviewScreen, VisibilityScreen, ContactBlockScreen } from './ProfileScreens';
import { RewardsScreen, ConvertScreen } from './WalletScreens';
import { NotifScreen, SettingsScreen, AccountScreen, NicknameScreen, BlocksScreen, HiddenScreen, InquiryScreen, TermsScreen, WithdrawScreen } from './SettingsScreens';
import { CertFormScreen } from './BadgeCredentials';
import { CouponDetailScreen, CouponUseScreen } from '../place/CouponScreens';
import { PointLedgerScreen } from '../place/PointLedger';
import { BadgeManage } from '../../screens/BadgeManage';

const SCREENS: Record<MyScreen, React.ComponentType<{ nav: MyNav }>> = {
  myPreview: PreviewScreen,
  myRewards: RewardsScreen,
  myConvert: ConvertScreen,
  myPointLedger: PointLedgerScreen,
  myCouponDetail: CouponDetailScreen,
  myCouponUse: CouponUseScreen,
  myCertForm: CertFormScreen,
  myBadges: ({ nav }) => <BadgeManage onBack={nav.back} />,
  myVisibility: VisibilityScreen,
  myContactBlock: ContactBlockScreen,
  myNotif: NotifScreen,
  mySettings: SettingsScreen,
  myAccount: AccountScreen,
  myNickname: NicknameScreen,
  myBlocks: BlocksScreen,
  myHidden: HiddenScreen,
  myInquiry: InquiryScreen,
  myTerms: TermsScreen,
  myWithdraw: WithdrawScreen,
};

export function MyStack({ screen, nav }: { screen: MyScreen; nav: MyNav }) {
  const C = SCREENS[screen];
  return <C nav={nav} />;
}
