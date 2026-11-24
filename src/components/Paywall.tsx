// 야화 — Paywall. 리프가 모자라면 바텀 시트 '리프가 조금 부족해요'(사용할 리프 카드 + [닫기 · 리프 충전하기])를 띄운다.
import React, { useEffect, useState } from 'react';
import { usePreview, previewSelectors, previewActions } from '../lib/previewStore';
import { LeafShortSheet } from '../screens/Charge';

export function Paywall() {
  const pw = usePreview(previewSelectors.paywall);
  // 닫히는 움직임 동안 내용이 남게 마지막 필요량을 기억한다
  const [needed, setNeeded] = useState(0);
  useEffect(() => { if (pw?.open) setNeeded(pw.needed); }, [pw]);
  return <LeafShortSheet open={!!pw?.open} needed={pw?.needed ?? needed} onClose={previewActions.closePaywall} />;
}
