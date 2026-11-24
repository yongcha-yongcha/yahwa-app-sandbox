// 야화 — 상대 프로필 더보기 시트 (리뉴얼 1120 · 시안 Person Sheet, spec-dating §3.13)
// 머리(사진 42×56 + 이름 + "26세 · 서울 마포구") 아래 한 시트 안에서 단계가 바뀐다:
//   메뉴(오늘의 인연에서 숨기기 / 차단하기 / 신고하기 / 프로필 교환 해제) → 차단 확인 · 신고 사유 · 교환 해제 확인.
// 숨기기는 묻지 않고 바로 숨기고 [되돌리기] 토스트를 띄운다. 차단 · 신고 · 교환 해제 기록은 예전 그대로(blocks · reports · 0171).
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { colors } from '../../tokens';
import { previewActions } from '../../lib/previewStore';
import { blockUser, reportContent } from '../../lib/api';
import { useMyProfileExchanges } from '../../lib/hooks';
import { releaseProfileExchange } from '../../lib/communityApi';
import { BottomSheet, FadeIn, Icon, SheetButtons, SheetDivider, SheetHeader, SheetRow } from '../../ui';
import { appNav } from '../../lib/appNav';
import { showToastAction } from '../../ui/toastAction';
import { ProfilePhoto } from './ProfilePhoto';
import { RIcons } from './icons';
import { hideProfile, unhideProfile } from './hidden';

export type MenuTarget = { userId: string; nickname: string; photo?: string | null; meta?: string };
const REASONS = ['부적절한 사진', '허위 프로필 · 사칭', '욕설 · 불쾌한 표현', '광고 · 금전 요구', '기타'];
type Step = 'menu' | 'report' | 'block' | 'release';

export function PersonSheet({ target, open, onClose, onLeave, canHide }: {
  target: MenuTarget; open: boolean; onClose: () => void;
  onLeave?: () => void;     // 숨김 · 차단 뒤 프로필에서 나간다
  canHide?: boolean;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('menu');
  // 교환 완료한 상대면 '프로필 교환 해제'(0171)
  const exchangesQ = useMyProfileExchanges();
  const exchange = (exchangesQ.data ?? []).find((r) => r.status === 'accepted' && r.other_id === target.userId);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setStep('menu'); setReason(''); setDetail(''); } }, [open]);
  const name = target.nickname;

  function hide() {
    hideProfile(target.userId);
    onClose();
    onLeave?.();
    showToastAction('오늘의 인연에서 숨겼어요.', '되돌리기', () => {
      unhideProfile(target.userId);
      appNav({ kind: 'friend', userId: target.userId, free: true });   // 그 프로필로 돌아간다
    });
  }
  async function report() {
    if (!reason || busy) return;
    setBusy(true);
    try {
      const extra = reason === '기타' ? detail.trim() : '';
      await reportContent({ targetKind: 'profile', targetId: target.userId, reason, ...(extra ? { detail: extra } : null) });
      onClose();
      previewActions.showToast('신고를 접수했어요. 확인하고 알려 드릴게요.', 2400);
    } catch (e: any) {
      previewActions.showToast(e?.message || '잠시 후 다시 시도해 주세요', 2400);
    } finally {
      setBusy(false);
    }
  }
  async function release() {
    if (!exchange || busy) return;
    setBusy(true);
    try {
      await releaseProfileExchange(exchange.id);
      qc.invalidateQueries({ queryKey: ['profile-exchanges'] });
      qc.invalidateQueries({ queryKey: ['exchanged-ids'], refetchType: 'all' });   // 덱이 안 보이는 동안에도 다시 받아 둔다
      onClose();
      previewActions.showToast('프로필 교환을 해제했어요.', 2200);
    } catch (e: any) {
      previewActions.showToast(e?.message || '잠시 후 다시 시도해 주세요', 2400);
    } finally {
      setBusy(false);
    }
  }
  async function block() {
    if (busy) return;
    setBusy(true);
    try {
      await blockUser(target.userId);
      // 덱·호감 목록이 지금 안 보여도 다시 받아 차단한 사람이 바로 빠지게(ContactBlockGate와 같은 방식)
      qc.invalidateQueries({ queryKey: ['friend-profiles'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['my-deck'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['friend-profile'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['blocked-ids'], refetchType: 'all' });
      onClose();
      previewActions.showToast(`${name} 님을 차단했어요.`, 2200);
      onLeave?.();
    } catch (e: any) {
      previewActions.showToast(e?.message || '차단하지 못했어요. 잠시 후 다시 시도해 주세요', 2400);
    } finally {
      setBusy(false);
    }
  }
  const back = () => setStep('menu');

  return (
    <BottomSheet open={open} onClose={onClose} dismissable={!busy}>
      <View style={{ paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <ProfilePhoto src={target.photo} width={42} height={56} radius={8} thumbWidth={160} position={{ top: '30%', left: '50%' }} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text }}>{name}</Text>
          {!!target.meta && <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, lineHeight: 18, color: colors.mute }}>{target.meta}</Text>}
        </View>
      </View>
      {/* 단계가 바뀌면 새 내용이 떠오른다 */}
      <FadeIn trigger={step} ms={220}>
        {step === 'menu' ? (
          <View style={{ paddingTop: 8 }} accessibilityLabel={`${name} 님 프로필 더보기`}>
            {canHide && (
              <>
                <SheetRow label="오늘의 인연에서 숨기기" desc="다음 인연으로 넘어가요. 되돌릴 수 있어요." icon={(c) => <RIcons.eyeOff color={c} />} onPress={hide} />
                <SheetDivider />
              </>
            )}
            <SheetRow danger label="차단하기" icon={(c) => <RIcons.ban color={c} />} onPress={() => setStep('block')} />
            <SheetRow danger label="신고하기" icon={(c) => <RIcons.siren color={c} />} onPress={() => { setReason(''); setStep('report'); }} />
            {exchange && <SheetRow label="프로필 교환 해제" icon={(c) => <RIcons.lock size={24} color={c} />} onPress={() => setStep('release')} />}
          </View>
        ) : step === 'block' ? (
          <View style={{ paddingTop: 16 }}>
            <SheetHeader title={`${name} 님을 차단할까요?`} desc="서로의 프로필과 커뮤니티 글이 보이지 않아요. 차단은 마이페이지 설정의 차단 관리에서 풀 수 있어요." />
            <SheetButtons onCancel={back} confirmLabel="차단하기" confirmVariant="danger" loading={busy} onConfirm={block} />
          </View>
        ) : step === 'release' ? (
          <View style={{ paddingTop: 16 }}>
            <SheetHeader title="프로필 교환을 해제할까요?" desc="교환 목록에서 프로필을 다시 볼 수 없게 돼요. 이미 보낸 호감과 편지는 그대로 남아요." />
            <SheetButtons onCancel={back} confirmLabel="교환 해제" loading={busy} onConfirm={release} />
          </View>
        ) : (
          <View style={{ paddingTop: 16 }}>
            <SheetHeader title="어떤 점이 불편했나요?" desc={`신고한 내용은 ${name} 님에게 알리지 않아요.`} />
            <View accessibilityRole="radiogroup" style={{ marginHorizontal: -8, marginBottom: 16 }}>
              {REASONS.map((r) => {
                const on = reason === r;
                return (
                  <Pressable key={r} onPress={() => setReason(r)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={({ pressed }) => ({ height: 48, paddingHorizontal: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: pressed ? colors.bgSoft : 'transparent' })}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: on ? 6 : 1.5, borderColor: on ? colors.accent : colors.lineControl, backgroundColor: colors.surface }} />
                    <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '500', color: colors.text }}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>
            {reason === '기타' && (
              <TextInput
                value={detail} onChangeText={setDetail} multiline maxLength={300} placeholder="조금 더 알려 주세요 (선택)" placeholderTextColor={colors.chevron}
                accessibilityLabel="신고 상세 내용"
                style={{ height: 76, marginTop: -8, marginBottom: 16, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, fontSize: 14, lineHeight: 21, color: colors.text, textAlignVertical: 'top' }}
              />
            )}
            <SheetButtons cancelLabel="이전" onCancel={back} confirmLabel="신고하기" confirmVariant="danger" disabled={!reason} loading={busy} onConfirm={report} />
          </View>
        )}
      </FadeIn>
    </BottomSheet>
  );
}

// 머리 줄 오른쪽 ⋯ — 44×44, 점 셋 24 강조 파랑. 시트가 열려 있는 동안 뒤에 회색 원
export function MoreButton({ onPress, open }: { onPress: () => void; open?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="프로필 더보기" accessibilityState={{ expanded: !!open }} onPress={onPress} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: open ? colors.muted : 'transparent', transform: [{ scale: pressed ? 0.94 : 1 }] })}>
      <Icon name="more-horizontal" size={24} color={colors.accent} />
    </Pressable>
  );
}
