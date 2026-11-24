// 야화 — 티어 안내 시트. 전체 등급의 달성 조건·혜택 안내, 내 현재 등급 하이라이트.
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useSheetScrollReporter } from './DraggableSheet';
import { colors, radius } from '../tokens';
import { Icons } from '../icons';
import { DraggableSheet } from './DraggableSheet';
import { TIERS, TIER_ICON, type TierKey } from '../lib/tier';

// 달성 조건 문구 — 블랙 다이아몬드는 기준 비공개, 레드(threshold 0)는 기본 등급.
function conditionText(t: (typeof TIERS)[number]): string {
  if (t.hiddenThreshold) return '달성 조건 비공개';
  if (t.threshold === 0) return '가입 시 기본 등급';
  return `누적 결제 ${t.threshold.toLocaleString()}원 이상`;
}

export function TierGuide({
  open,
  onClose,
  currentKey,
}: {
  open: boolean;
  onClose: () => void;
  currentKey: TierKey;
}) {
  return (
    <DraggableSheet open={open} onClose={onClose}>
      <TierGuideBody currentKey={currentKey} />
    </DraggableSheet>
  );
}

// 시트 내부에서 렌더돼야 useSheetScrollReporter가 시트 컨텍스트를 받는다 (분리 필수)
function TierGuideBody({ currentKey }: { currentKey: TierKey }) {
  const onSheetScroll = useSheetScrollReporter();
  return (
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        onScroll={onSheetScroll}
        scrollEventThrottle={32}
      >
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, paddingTop: 8 }}>티어 안내</Text>
        <Text style={{ fontSize: 11, color: colors.mute, marginTop: 4 }}>
          등급은 야화 매장 누적 결제액으로 산정돼요.
        </Text>

        <View style={{ marginTop: 16, gap: 10 }}>
          {TIERS.map((t) => {
            const mine = t.key === currentKey;
            return (
              <View
                key={t.key}
                style={{
                  borderWidth: mine ? 1.5 : 1,
                  borderColor: mine ? colors.primary : colors.line,
                  backgroundColor: mine ? colors.primarySoft : colors.surface,
                  borderRadius: radius.card,
                  padding: 14,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {/* 티어 다이아 이모지 */}
                  <Image source={TIER_ICON[t.key]} style={{ width: 36, height: 36 }} contentFit="contain" />

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.text }}>{t.label}</Text>
                      {mine && (
                        <View style={{ backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff' }}>내 등급</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, color: colors.sub, marginTop: 2 }}>{conditionText(t)}</Text>
                    {t.note && <Text style={{ fontSize: 10, color: colors.mute, marginTop: 1 }}>{t.note}</Text>}
                  </View>
                </View>

                {t.benefits.length > 0 && (
                  <View style={{ marginTop: 10, gap: 5 }}>
                    {t.benefits.map((b) => (
                      <View key={b} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icons.check size={13} color={colors.primary} />
                        <Text style={{ fontSize: 11.5, color: colors.text }}>{b}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
  );
}
