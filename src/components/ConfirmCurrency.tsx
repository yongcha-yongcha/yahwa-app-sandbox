// 야화 — 리프/포인트 중 골라 쓰는 확인 시트(모임 참여 등). 하나를 골라 '사용하기'를 눌러야 실제로 사용된다.
import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { colors, radius } from '../tokens';
import { BottomSheet, Button, SheetHeader, TextLink } from '../ui';
import { usePreview, previewSelectors, previewActions } from '../lib/previewStore';

export function ConfirmCurrency() {
  const cc = usePreview(previewSelectors.currencyChoice);
  const leaf = usePreview(previewSelectors.leafBalance);
  const points = usePreview(previewSelectors.points);
  // 처음엔 둘 다 미선택
  const [sel, setSel] = React.useState<'leaf' | 'point' | null>(null);
  const open = !!cc?.open;
  React.useEffect(() => { if (open) setSel(null); }, [open]);
  if (!cc?.open) return null;
  const ccNN = cc;

  function confirm() {
    if (!sel) return;
    const fn = ccNN.onPick;
    const chosen = sel;
    previewActions.closeCurrencyChoice();
    fn(chosen);
  }

  const option = (currency: 'leaf' | 'point', label: string, balance: number) => {
    const enough = balance >= ccNN.amount;
    const active = sel === currency;
    return (
      <Pressable
        onPress={() => enough && setSel(active ? null : currency)}
        disabled={!enough}
        accessibilityRole="radio"
        accessibilityState={{ checked: active, disabled: !enough }}
        accessibilityLabel={`${label} ${ccNN.amount}, 보유 ${balance.toLocaleString()}`}
        style={{ flex: 1, paddingVertical: 16, borderRadius: radius.card, backgroundColor: colors.bgSoft, borderWidth: 1.5, borderColor: active ? colors.inverseStrong : colors.bgSoft, alignItems: 'center', gap: 4, opacity: enough ? 1 : 0.45 }}
      >
        <Text style={{ fontSize: 20, lineHeight: 26, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] }}>{ccNN.amount}</Text>
        <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: '500', color: colors.text }}>{label}</Text>
        <Text style={{ fontSize: 12, lineHeight: 18, color: colors.mute }}>보유 {balance.toLocaleString()}</Text>
      </Pressable>
    );
  };

  return (
    <BottomSheet open onClose={previewActions.closeCurrencyChoice}>
      <SheetHeader title={ccNN.title} desc={ccNN.body || undefined} />
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
        {option('leaf', '리프 사용', leaf)}
        {option('point', '포인트 사용', points)}
      </View>
      <Button size="sheet" block disabled={!sel} label={sel ? `${sel === 'leaf' ? '리프' : '포인트'} ${ccNN.amount} 사용하기` : '사용하기'} onPress={confirm} />
      {/* 충전 화면으로 — Paywall과 같은 pendingCharge 인텐트 경로(웹만) */}
      {Platform.OS === 'web' && <TextLink label="리프 충전하기" onPress={() => { previewActions.closeCurrencyChoice(); previewActions.requestCharge(); }} />}
    </BottomSheet>
  );
}
