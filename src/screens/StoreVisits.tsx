// 야화 — 매장 방문 관리. 매장별로 적립된 태그히어 포인트를 리스트로 보여준다.
// 웹훅이 포인트를 반영할 때마다 realtime(useMyStoreBalances)으로 즉시 갱신된다.
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { colors } from '../tokens';
import { Icons } from '../icons';
import { NavBar } from '../components/atoms';
import { useMyStoreBalances } from '../lib/hooks';

// ISO → "YYYY.MM.DD" — 기기 시간대와 무관하게 한국 시각(+9h, UTC 필드로 읽음)
function fmtDate(str: string): string {
  const t = new Date(str).getTime();
  if (isNaN(t)) return '';
  const d = new Date(t + 9 * 3600_000);
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function StoreVisits({ onBack }: { onBack?: () => void }) {
  const { data, isLoading } = useMyStoreBalances();
  const total = (data ?? []).reduce((sum, b) => sum + b.balance, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <NavBar
        title="포인트 내역"
        left={
          <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8} onPress={onBack} style={{ width: 44, height: 44, marginLeft: -4, alignItems: 'center', justifyContent: 'center' }}>
            <Icons.chevLeft size={22} color={colors.text} stroke={1.5} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        <Text style={{ fontSize: 11.5, color: colors.sub, paddingTop: 8, paddingBottom: 8 }}>매장별로 적립하신 포인트예요.</Text>

        {isLoading ? (
          <View>
            {Array.from({ length: 4 }).map((_, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgSoft }} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={{ height: 14, width: '50%', borderRadius: 4, backgroundColor: colors.bgSoft }} />
                  <View style={{ height: 11, width: '28%', borderRadius: 4, backgroundColor: colors.bgSoft }} />
                </View>
                <View style={{ height: 14, width: 56, borderRadius: 4, backgroundColor: colors.bgSoft }} />
              </View>
            ))}
          </View>
        ) : !data || data.length === 0 ? (
          <View style={{ paddingVertical: 64, alignItems: 'center', gap: 8 }}>
            <Icons.pin size={26} color={colors.mute} stroke={1.5} />
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.text, marginTop: 4 }}>아직 적립된 매장이 없어요</Text>
            <Text style={{ fontSize: 11.5, color: colors.sub, textAlign: 'center', lineHeight: 18 }}>야화 매장 방문으로 적립돼요.</Text>
          </View>
        ) : (
          <View>
            {data.map((b) => (
              <View
                key={b.storeId}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 14,
                  paddingVertical: 16,
                  borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center' }}>
                  <Icons.store size={18} color={colors.sub} stroke={1.5} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '600', color: colors.text }}>{b.storeName}</Text>
                  <Text style={{ fontSize: 11, color: colors.mute, marginTop: 3, fontVariant: ['tabular-nums'] }}>
                    {fmtDate(b.syncedAt)} 기준
                  </Text>
                </View>
                <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] }}>
                  {b.balance.toLocaleString()} P
                </Text>
              </View>
            ))}

            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 20 }}>
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.sub, flex: 1 }}>합계</Text>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'] }}>{total.toLocaleString()} P</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
