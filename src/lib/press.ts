// 야화 — 버튼 눌림 공용 값(리뉴얼 1120 · spec-shell §3-3)
// 누르면 0.97배(120ms cubic-bezier(.23,1,.32,1)), 투명도는 바꾸지 않는다 — 색은 한 단계 진한 바탕으로(ui/Button 등이 맡는다).
// 대상별 배율: 공용 버튼 0.97 · 웰컴/로그인 0.985(soft) · 칩·선택 카드 0.96(chip) · 하단 메뉴·원 버튼 0.94(nav) · 시트 줄·카드 버튼 0.98(row).
// · pressFx(pressed): Pressable style 함수에 쓰는 모양값. 웹은 CSS transition으로 부드럽게 돌아온다.
// · 앱에서 돌아오는 움직임까지 필요하면 components/Tap(애니메이션 Pressable)을 쓴다.
import { Easing, Platform, type ViewStyle } from 'react-native';

export const PRESS = { scale: 0.97, label: 0.97, soft: 0.985, chip: 0.96, nav: 0.94, row: 0.98, opacity: 1, ms: 120 } as const;
export const PRESS_EASE = Easing.bezier(0.23, 1, 0.32, 1);

export const pressTransition = (Platform.OS === 'web'
  ? { transitionProperty: 'transform', transitionDuration: `${PRESS.ms}ms`, transitionTimingFunction: 'cubic-bezier(.23,1,.32,1)' }
  : {}) as ViewStyle;

// 안 눌렸을 때는 크기를 넣지 않는다 — 같은 스타일의 다른 transform(흐림 등)을 덮지 않게
export function pressFx(pressed: boolean, scale: number = PRESS.scale): ViewStyle {
  return pressed ? { transform: [{ scale }], ...pressTransition } : pressTransition;
}
