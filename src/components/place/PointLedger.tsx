// 야화 — 매장 포인트 내역(리뉴얼 1120 · spec-rest §4.5 · §10 B-5)
// 보유 포인트 카드 → 매장별 적립 줄(태그히어 동기화 시각) + 포인트 사용 기록 → '리프로 바꾸기' → '포인트는 어떻게 쓰나요?'(시트)
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { colors, fontSerif } from '../../tokens';
import { BottomSheet, Button, Card, Row, SheetHeader } from '../../ui';
import { useMySpendHistory, useMyStoreBalances, POINTS_PER_LEAF } from '../../lib/hooks';
import { previewSelectors, usePreview } from '../../lib/previewStore';
import { HIDE_IOS_CURRENCY } from '../../lib/flags';
import { labelFor, currencyFor } from '../../screens/SpendHistory';
import { Screen, LedgerRow, EmptyLine, kstDate } from '../my/ui';
import type { MyNav } from '../my/nav';

export function PointHelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <SheetHeader title="매장 포인트" desc={`야화 혼술바에서 쌓은 매장 포인트를 앱에서 리프로 바꿀 수 있어요. ${POINTS_PER_LEAF}포인트가 1리프이고, 남은 포인트는 그대로 보관돼요.`} />
      <Button size="sheet" block label="확인" onPress={onClose} />
    </BottomSheet>
  );
}

export function PointLedgerScreen({ nav }: { nav: MyNav }) {
  const points = usePreview(previewSelectors.points);
  const stores = useMyStoreBalances().data ?? [];
  const spends = (useMySpendHistory().data ?? []).filter((tx) => currencyFor(tx) === 'point');
  const [help, setHelp] = useState(false);
  const empty = stores.length + spends.length === 0;
  return (
    <Screen title="매장 포인트 내역" onBack={nav.back}>
      <Card pad={16} style={{ borderRadius: 18 }}>
        <Text style={{ fontSize: 13, lineHeight: 22.75, color: colors.sub }}>보유 포인트</Text>
        <Text style={{ fontFamily: fontSerif, fontSize: 32, lineHeight: 46, color: colors.text }}>{points.toLocaleString()} P</Text>
      </Card>
      {empty ? (
        <View style={{ marginTop: 20 }}><EmptyLine>아직 내역이 없어요.</EmptyLine></View>
      ) : (
        <Card style={{ marginTop: 12 }}>
          {stores.map((b, i) => <LedgerRow key={b.storeId} first={i === 0} title={b.storeName} at={kstDate(b.syncedAt, true)} amount={`+${b.balance.toLocaleString()}`} />)}
          {spends.map((tx, i) => <LedgerRow key={tx.id} first={stores.length + i === 0} title={labelFor(tx)} at={kstDate(tx.created_at, true)} amount={`-${Math.abs(tx.amount).toLocaleString()}`} />)}
        </Card>
      )}
      {!HIDE_IOS_CURRENCY && <Button size="dock" style={{ marginTop: 26 }} label="리프로 바꾸기" onPress={() => nav.push('myConvert')} />}
      <Card style={{ marginTop: 14 }}>
        <Row kind="group" first label="포인트는 어떻게 쓰나요?" onPress={() => setHelp(true)} />
      </Card>
      <PointHelpSheet open={help} onClose={() => setHelp(false)} />
    </Screen>
  );
}
