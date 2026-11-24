// 야화 — 리프 사용 확인 시트(리뉴얼 1120 · spec-rest §2.5). 무엇에 · 사용할 리프 카드 · [취소 · 사용하기].
import React, { useEffect, useState } from 'react';
import { ConfirmSheet, LeafCostCard } from '../ui';
import { usePreview, previewSelectors, previewActions } from '../lib/previewStore';

export function ConfirmLeafSpend() {
  const cs = usePreview(previewSelectors.confirmSpend);
  const bal = usePreview(previewSelectors.leafBalance);
  // 닫히는 움직임 동안 내용이 남게 마지막 요청을 기억한다
  const [last, setLast] = useState(cs);
  useEffect(() => { if (cs?.open) setLast(cs); }, [cs]);
  const shown = cs?.open ? cs : last;
  if (!shown) return null;
  return (
    <ConfirmSheet
      open={!!cs?.open}
      onClose={previewActions.closeConfirmSpend}
      title={shown.title}
      confirmLabel={shown.confirmLabel ?? '사용하기'}
      onConfirm={() => { const fn = shown.onConfirm; previewActions.closeConfirmSpend(); fn(); }}
    >
      <LeafCostCard cost={shown.amount} balance={bal} />
    </ConfirmSheet>
  );
}
