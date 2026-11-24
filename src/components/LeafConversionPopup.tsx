// 야화 — 리프 전환 안내(리프 정책 v2, 0187). 보유 리프를 ×7.5로 바꾼 회원에게 앱을 열면 한 번 뜬다.
// 서버 my_leaf_conversion()에 기록이 있고 아직 안 봤으면(notice_seen_at 없음) 보여 주고, 닫으면 ack_leaf_conversion()으로 본 것으로 남긴다.
// 이벤트 중이면 '연말까지 오픈 특별가'를 여기서 한 번 소개한다(홈·카드에는 넣지 않는다).
import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, dur } from '../tokens';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/previewStore';
import { HIDE_IOS_CURRENCY } from '../lib/flags';
import { useLeafPricing } from '../lib/leafPricing';
import { BottomSheet, Button, LeafIcon, SheetHeader } from '../ui';
import { EventBadge } from '../ui/LeafCost';

type Conv = { before: number; after: number; notice_seen_at: string | null };

export function LeafConversionPopup() {
  const uid = getCurrentUserId();
  const qc = useQueryClient();
  const pricing = useLeafPricing();
  const q = useQuery({
    queryKey: ['leaf-conversion', uid],
    enabled: !!uid,
    staleTime: Infinity,
    queryFn: async (): Promise<Conv | null> => {
      const { data, error } = await supabase.rpc('my_leaf_conversion' as never);
      if (error) return null;  // 0187 적용 전
      return ((data ?? []) as unknown as Conv[])[0] ?? null;
    },
  });
  const [closing, setClosing] = useState(false);
  const done = useRef(false);
  const c = q.data;
  if (!c || c.notice_seen_at || HIDE_IOS_CURRENCY) return null;

  function close() {
    if (done.current) return;
    done.current = true;
    setClosing(true);
    void supabase.rpc('ack_leaf_conversion' as never).then(() => undefined, () => undefined);
    setTimeout(() => qc.setQueryData(['leaf-conversion', uid], { ...c!, notice_seen_at: new Date().toISOString() }), dur.sheetOut);
  }

  return (
    <BottomSheet open={!closing} onClose={close}>
      <SheetHeader title="리프 이용 기준이 바뀌었어요" desc="리프 이용 기준이 변경되어, 보유하신 리프를 7.5배로 전환해드렸어요." />
      {/* 전 → 후 잔액 */}
      <View style={{ marginBottom: 16, padding: 16, borderRadius: 16, backgroundColor: colors.bgSoft, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, lineHeight: 16.8, color: colors.mute }}>전환 전</Text>
          <Text style={{ marginTop: 4, fontSize: 17, lineHeight: 22, fontWeight: '600', color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{c.before.toLocaleString()}리프</Text>
        </View>
        <Text style={{ fontSize: 16, color: colors.subtle }}>→</Text>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, lineHeight: 16.8, color: colors.mute }}>전환 후</Text>
          <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <LeafIcon size={16} />
            <Text style={{ fontSize: 20, lineHeight: 26, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] }}>{c.after.toLocaleString()}리프</Text>
          </View>
        </View>
      </View>
      {/* 이벤트 한 번 소개 — 할인율 없이 이름 + 실제 리프 */}
      {pricing.event && (
        <View style={{ marginBottom: 20, gap: 6 }}>
          <EventBadge />
          <Text style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}>
            {`올해 12월 31일까지 일반편지는 ${pricing.prices.letter}리프, 특별편지는 ${pricing.prices.invite}리프로 보낼 수 있어요.`}
          </Text>
        </View>
      )}
      <Button size="sheet" block label="확인" onPress={close} />
    </BottomSheet>
  );
}
