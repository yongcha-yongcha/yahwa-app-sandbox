// 야화 — 미션 보상 알림 (리뉴얼 1120 · spec-dating §5-b-9)
// 예전의 가운데 '미션 성공!' 카드는 없앴다. 보상은 토스트 한 줄로 알린다: "오늘의 인연 8명을 모두 만났어요 · 리프 +3".
// 호감 보상은 화면 전체 완료 모션(ActionFeedback)의 둘째 줄 "리프 +N"이 대신한다. 어디서든 showReward(n, 문구).
import { previewActions } from '../lib/previewStore';

export function showReward(amount: number, label: string = '미션 성공') {
  if (!(amount > 0)) return;
  previewActions.showToast(`${label} · 리프 +${amount}`, 2800);
}

// app/_layout이 마운트하던 자리 — 그릴 것이 없다(토스트가 대신한다)
export function RewardLayer() {
  return null;
}
