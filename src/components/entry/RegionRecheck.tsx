// 사는 곳 다시 고르기(11-27) — 예전 회원 중 '서울 / 기타' · 시·도만 있는 값(regionNeedsRecheck)은 앱에 들어오면 이 화면부터.
// 인연 탭 안내(ProfileGate)와 같은 틀. 휠은 가입 · 프로필 수정과 같은 RegionWheel. 저장되면 바로 앱으로 넘어간다(닫기 없음).
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { colors, fontSerif, layout } from '../../tokens';
import { Button, T } from '../../ui';
import { previewActions } from '../../lib/previewStore';
import { updateUserProfileServer } from '../../lib/api';
import { SIDO, regionText, sidoOf, subOf } from './profileOptions';
import { RegionWheel } from './RegionWheel';
import { StatusChip } from './ProfileGate';

export function RegionRecheck({ current, onDone }: { current?: string | null; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save(region: string) {
    setOpen(false);
    setPicked(region);
    setSaving(true);
    setErr('');
    try {
      await updateUserProfileServer({ region });
      previewActions.updateMyProfile({ region });
      onDone();
    } catch (e: any) {
      setErr(e?.message || '저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      setSaving(false);
    }
  }

  // 지금 저장된 값 — 맞지 않는 세부('기타')는 줄을 긋는다
  const sido = sidoOf(current);
  const sub = subOf(current);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: 40, paddingHorizontal: layout.gutter, paddingBottom: 30 }}>
      <StatusChip label="사는 곳 확인" tone="sky" />
      <T accessibilityRole="header" style={{ marginTop: 14, fontFamily: fontSerif, fontSize: 21, lineHeight: 31.5, letterSpacing: -0.6, color: colors.text }}>사는 곳을 다시 알려 주세요.</T>
      <T style={{ marginTop: 8, fontSize: 13, lineHeight: 23.4, color: colors.sub }}>{'이제 시·군·구까지 고를 수 있어요.\n가까운 곳에 사는 인연을 더 잘 찾아 드릴게요.'}</T>
      <View style={{ marginTop: 24, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: colors.bgSoft }}>
        <Text style={{ fontSize: 12, lineHeight: 18, color: colors.mute }}>{picked ? '새로 고른 곳' : '지금 저장된 곳'}</Text>
        <Text style={{ marginTop: 2, fontSize: 15, lineHeight: 22, fontWeight: '600', color: colors.text }}>
          {picked ? regionText(picked) : sido ? (
            <>
              {sido}
              {!!sub && ' '}
              {!!sub && <Text style={{ fontWeight: '500', color: colors.subtle, textDecorationLine: 'line-through' }}>{sub}</Text>}
            </>
          ) : <Text style={{ fontWeight: '500', color: colors.subtle }}>아직 없어요</Text>}
        </Text>
      </View>
      {!!err && <Text style={{ marginTop: 10, fontSize: 12, lineHeight: 18, color: colors.danger }}>{err}</Text>}
      <Button label="사는 곳 고르기" block loading={saving} disabled={saving} onPress={() => setOpen(true)} style={{ marginTop: 24 }} />
      <Text style={{ marginTop: 16, fontSize: 12, lineHeight: 18, color: colors.mute }}>한 번만 고르면 바로 이어서 쓸 수 있어요.</Text>
      <RegionWheel open={open} value={SIDO.includes(sido) ? current ?? '' : ''} onClose={() => setOpen(false)} onPick={save} />
    </ScrollView>
  );
}
