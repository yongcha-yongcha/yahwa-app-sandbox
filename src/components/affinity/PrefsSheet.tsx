// 야화 — 추천 설정 시트 (리뉴얼 1120 · 시안 인연 홈 필터 시트, spec-dating §3.10)
// 나이는 시트에서 바로 바꾸고 [적용하기]. 시안의 '거리' 자리는 우리 기준인 '지역' 줄(고른 값 요약 → 전체 조건)로 둔다.
// 맞춤 인연 추천 줄은 넣지 않는다(서버 기능 없음).
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '../../tokens';
import { previewActions } from '../../lib/previewStore';
import { BottomSheet, Button, Icon, SheetRow } from '../../ui';
import { AgeSection, lifestyleSummary, prefRegionText, usePrefsDraft } from '../../screens/MatchPrefs';
import { RIcons } from './icons';

export function PrefsSheet({ open, onClose, onOpenAll }: { open: boolean; onClose: () => void; onOpenAll: () => void }) {
  const { d, setD, dirty, saving, save } = usePrefsDraft(open);
  const regions = (d.regions ?? []).map(prefRegionText);
  const regionText = !regions.length ? '상관없음' : regions.length > 2 ? `${regions.slice(0, 2).join(' · ')} 외 ${regions.length - 2}곳` : regions.join(' · ');
  async function apply() {
    if (await save()) {
      onClose();
      previewActions.showToast('다음 소개부터 참고할게요.', 2200);
    }
  }
  const chevron = <Icon name="chevron-right" size={20} color={colors.mute} />;
  return (
    <BottomSheet open={open} onClose={onClose} dismissable={!saving}>
      <View style={{ height: 44, marginBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" style={{ fontSize: 18, lineHeight: 25.2, fontWeight: '600', color: colors.text }}>취향 설정</Text>
        <Pressable onPress={onOpenAll} accessibilityRole="button" style={{ height: 44, paddingHorizontal: 4, marginRight: -4, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={{ fontSize: 14, lineHeight: 14, fontWeight: '500', color: colors.accent }}>전체 조건</Text>
          <Icon name="chevron-right" size={16} color={colors.accent} />
        </Pressable>
      </View>
      <View style={{ marginTop: 28 }}><AgeSection d={d} setD={setD} /></View>
      <View style={{ height: 1, marginTop: 24, marginBottom: 8, backgroundColor: colors.line }} />
      <View>
        <SheetRow label="지역" desc={regionText} icon={(c) => <RIcons.prefHome size={24} color={c} />} onPress={onOpenAll} />
        <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' }}>{chevron}</View>
      </View>
      <View>
        <SheetRow label="생활 방식" desc={lifestyleSummary(d)} icon={(c) => <RIcons.prefFilter size={24} color={c} />} onPress={onOpenAll} />
        <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' }}>{chevron}</View>
      </View>
      <Button size="sheet" block label="적용하기" disabled={!dirty} loading={saving} onPress={apply} style={{ marginTop: 16 }} />
    </BottomSheet>
  );
}
