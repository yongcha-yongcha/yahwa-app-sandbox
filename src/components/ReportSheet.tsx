// 야화 — 신고/차단 시트. 전역 마운트(app/_layout.tsx)되어 openReport 인텐트로 열림.
// 실제 백엔드(reports/blocks 테이블)에 기록한다. Apple 1.2(UGC) 대응.
import React, { useState } from 'react';
import { View, Alert, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet, SheetDivider, SheetHeader, SheetRow } from '../ui';
import { CIcon } from './community/cIcons';
import { usePreview, previewSelectors, previewActions } from '../lib/previewStore';
import { reportContent, blockUser } from '../lib/api';

// RN-web은 Alert.alert가 no-op — 웹에선 window.alert로 폴백
function notify(title: string, body?: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(body ? `${title}\n${body}` : title);
  else Alert.alert(title, body);
}

const REASONS = ['부적절한 사진/음란물', '욕설/폭력적 언어', '혐오/차별', '허위 정보', '스팸/광고', '기타'];

export function ReportSheet() {
  const target = usePreview(previewSelectors.reportTarget);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  // 닫히는 움직임 동안에도 내용이 남아 있게 마지막 대상을 들고 있는다
  const [last, setLast] = useState(target);
  if (target && target !== last) setLast(target);
  const t = target ?? last;
  if (!t) return null;

  const close = () => previewActions.openReport(null);

  async function report(reason: string) {
    if (busy || !target) return;
    setBusy(true);
    try {
      await reportContent({ targetKind: target.kind, targetId: target.id, reason });
      close();
      previewActions.showToast('신고가 접수되었어요. 24시간 내 검토합니다.', 2200);
    } catch (e: any) {
      notify('신고 실패', e?.message || '잠시 후 다시 시도해 주세요');
    } finally {
      setBusy(false);
    }
  }

  async function block() {
    if (busy || !target?.userId) return;
    setBusy(true);
    try {
      await blockUser(target.userId);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['blocked-ids'] }),
        qc.invalidateQueries({ queryKey: ['lounge'] }),
        qc.invalidateQueries({ queryKey: ['lounge-comments'] }),
        qc.invalidateQueries({ queryKey: ['social-posts'] }),
      ]);
      close();
      previewActions.showToast('차단했어요. 이 사용자의 글이 더 이상 보이지 않아요.', 2200);
    } catch (e: any) {
      notify('차단 실패', e?.message || '잠시 후 다시 시도해 주세요');
    } finally {
      setBusy(false);
    }
  }

  return (
    // 리뉴얼 1120 — 공용 바텀 시트 틀(손잡이 · 줄 52 · 위험 줄은 빨강). 사유를 누르면 바로 접수한다(예전 동작 그대로)
    <BottomSheet open={!!target} onClose={close} dismissable={!busy}>
      <SheetHeader title="어떤 점이 불편했나요?" />
      <View style={{ opacity: busy ? 0.45 : 1 }} pointerEvents={busy ? 'none' : 'auto'}>
        {REASONS.map((r) => (
          <SheetRow key={r} label={r} onPress={() => report(r)} />
        ))}
        {!!t.userId && (
          <>
            <SheetDivider />
            <SheetRow danger label="이 사용자 차단하기" icon={(c) => <CIcon name="slash" color={c} />} onPress={block} />
          </>
        )}
      </View>
    </BottomSheet>
  );
}
