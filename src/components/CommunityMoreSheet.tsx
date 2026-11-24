// 야화 — 커뮤니티 글·댓글 ⋯ 시트(리뉴얼 1120, spec-rest §3.1 · §3.2 · §9.3 — 바텀 시트 하나로 통일)
//   남의 글 · 댓글: [금지 원] 차단 · [사이렌] 신고 (위험색) → 같은 시트 안에서 차단 확인 / 신고 사유 고르기
//   내 글 · 댓글: [연필] 고치기 — 구분선 — [휴지통] 지우기(위험색) → 같은 시트 안에서 지우기 확인
// 실제 처리는 서버: reports 테이블 · blocks 테이블(신고 접수 24시간 검토 · 차단 즉시 반영). 고치기 · 지우기는 부르는 화면이 한다.
// 시트(Modal) 안에서는 토스트를 띄우지 않는다(겹쳐서 안 보이는 사고) — 먼저 닫고 나서 처리한다.
// 프로필 교환 요청은 ⋯에서 빠지고 얼굴 · 닉네임 누름으로 옮겨졌다(ExchangeRequestSheet).
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { colors, radius } from '../tokens';
import { BottomSheet, Icon, SheetButtons, SheetDivider, SheetHeader, SheetRow } from '../ui';
import { previewActions, requireAuth } from '../lib/previewStore';
import { blockUser, reportContent } from '../lib/api';
import { CIcon } from './community/cIcons';

export type CommunityMoreTarget = {
  kind: 'post' | 'comment';
  id: string;
  authorId?: string;
  nick: string;
  body?: string;
  mine?: boolean;     // 내 글 · 내 댓글
};

type Step = 'menu' | 'report' | 'block' | 'delete';
const REASONS = ['부적절한 사진', '허위 프로필', '욕설·불쾌한 표현', '광고·사기 의심', '기타'];

export function CommunityMoreSheet({ target, onClose, onBlocked, onEdit, onDelete, authorLabel }: {
  target: CommunityMoreTarget | null;
  onClose: () => void;
  onBlocked?: () => void;
  onEdit?: (t: CommunityMoreTarget) => void;     // 없으면 '고치기' 줄을 그리지 않는다(목록 카드)
  onDelete?: (t: CommunityMoreTarget) => void;   // 지우기 확인 뒤
  authorLabel?: boolean;                         // 글 상세의 남의 글: "글쓴이 차단"
}) {
  const [step, setStep] = useState<Step>('menu');
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const qc = useQueryClient();
  // 닫히는 움직임 동안에도 내용이 남아 있게 마지막 대상을 들고 있는다
  const [last, setLast] = useState(target);
  if (target && target !== last) setLast(target);
  useEffect(() => { if (target) { setStep('menu'); setReason(''); setDetail(''); } }, [target]);
  const t = target ?? last;
  if (!t) return null;
  const post = t.kind === 'post';

  async function doReport() {
    const r = reason;
    const d = detail.trim();
    onClose();
    if (!requireAuth('신고는 로그인 후 가능해요')) return;
    try {
      await reportContent({ targetKind: t!.kind, targetId: t!.id, reason: r, ...(r === '기타' && d ? { detail: d } : null) });
      previewActions.showToast('신고가 접수되었어요. 24시간 내 검토합니다.', 2200);
    } catch (e: any) {
      previewActions.showToast(e?.message ?? '신고하지 못했어요', 2400);
    }
  }

  async function doBlock() {
    onClose();
    if (!requireAuth('차단은 로그인 후 가능해요')) return;
    if (!t!.authorId) return;
    try {
      await blockUser(t!.authorId);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['blocked-ids'] }),
        qc.invalidateQueries({ queryKey: ['lounge'] }),
        qc.invalidateQueries({ queryKey: ['lounge-comments'] }),
      ]);
      previewActions.showToast('사용자를 차단했어요.');
      onBlocked?.();
    } catch (e: any) {
      previewActions.showToast(e?.message ?? '차단하지 못했어요', 2400);
    }
  }

  return (
    <BottomSheet open={!!target} onClose={onClose}>
      {step === 'menu' && (t.mine ? (
        <>
          {!!onEdit && (
            <>
              <SheetRow label={post ? '글 고치기' : '이야기 고치기'} icon={(c) => <Icon name="pencil" color={c} />} onPress={() => { onClose(); onEdit(t); }} />
              <SheetDivider />
            </>
          )}
          <SheetRow danger label={post ? '글 지우기' : '이야기 지우기'} icon={(c) => <Icon name="trash" color={c} />} onPress={() => setStep('delete')} />
        </>
      ) : (
        <>
          {!!t.authorId && <SheetRow danger label={post && authorLabel ? '글쓴이 차단' : '이 사람 차단'} icon={(c) => <CIcon name="slash" color={c} />} onPress={() => setStep('block')} />}
          <SheetRow danger label={post ? '신고하기' : '이 이야기 신고하기'} icon={(c) => <CIcon name="siren" color={c} />} onPress={() => setStep('report')} />
        </>
      ))}

      {step === 'delete' && (
        <>
          <SheetHeader title={post ? '이 글을 지울까요?' : '이 이야기를 지울까요?'} desc={post ? '지운 글은 되돌릴 수 없어요.' : '지운 이야기는 되돌릴 수 없어요.'} />
          <SheetButtons onCancel={onClose} confirmLabel="지우기" confirmVariant="danger" onConfirm={() => { onClose(); onDelete?.(t); }} />
        </>
      )}

      {step === 'block' && (
        <>
          <SheetHeader title="이 사용자를 차단할까요?" desc="이 사용자의 프로필과 커뮤니티 글이 보이지 않아요." />
          <SheetButtons onCancel={onClose} confirmLabel="차단하기" confirmVariant="danger" onConfirm={doBlock} />
        </>
      )}

      {step === 'report' && (
        <>
          <SheetHeader title="어떤 점이 불편했나요?" desc={`신고한 내용은 ${t.nick} 님에게 알리지 않아요.`} />
          {/* 사유 줄 — 높이 48 · 라디오 20(기본 테두리 1.5 · 고르면 강조 파랑 6) + 12 + 15 500 · 누르는 동안 회색 면(모서리 12) */}
          <View accessibilityRole="radiogroup" style={{ marginHorizontal: -8, marginBottom: 16 }}>
            {REASONS.map((r) => {
              const sel = reason === r;
              return (
                <Pressable key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityState={{ selected: sel }} style={({ pressed }) => ({ height: 48, paddingHorizontal: 8, borderRadius: radius.field, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? colors.muted : 'transparent' })}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: sel ? 6 : 1.5, borderColor: sel ? colors.accent : colors.control }} />
                  <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: '500', color: colors.text }}>{r}</Text>
                </Pressable>
              );
            })}
          </View>
          {reason === '기타' && (
            <TextInput
              value={detail}
              onChangeText={setDetail}
              multiline
              maxLength={500}
              placeholder="조금 더 알려 주세요 (선택)"
              placeholderTextColor={colors.subtle}
              accessibilityLabel="신고 상세 내용"
              cursorColor={colors.focus}
              selectionColor={colors.focus}
              style={[{ height: 76, marginBottom: 16, padding: 12, borderRadius: radius.field, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, fontSize: 14, lineHeight: 20, color: colors.text, textAlignVertical: 'top' }, Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none' } as object) : null]}
            />
          )}
          <SheetButtons cancelLabel="이전" onCancel={() => setStep('menu')} confirmLabel="신고하기" confirmVariant="danger" disabled={!reason} onConfirm={doReport} />
        </>
      )}
    </BottomSheet>
  );
}
