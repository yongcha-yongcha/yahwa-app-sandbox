// 야화 — 레이아웃 헬퍼. 모든 기기(아이폰 홈 인디케이터/갤럭시 네비)에서 하단 컨텐츠가
// 잘리지 않도록 안전영역 + 화면 1% 여백을 더한 하단 패딩을 일관되게 제공.
import { Dimensions } from 'react-native';

// 화면 높이 1% (네비게이션바와 동일 기준)
export const BOTTOM_GAP = Math.round(Dimensions.get('window').height * 0.01);

// 하단 고정 바(CTA/입력)용 패딩 — insets.bottom(없으면 최소 12) + 1% 여백
export function bottomBarPad(insetBottom: number, base = 12): number {
  return Math.max(insetBottom, base) + BOTTOM_GAP;
}
