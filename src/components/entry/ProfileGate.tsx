// 야화 — 인연 탭 안내(리뉴얼 1120, spec-shell §4.15 · §5.4 b-16)
// 같은 틀(칩 → 명조 21 제목 → 13 안내 → 버튼)로 세 가지를 보여 준다:
//  · 인연 프로필을 아직 등록하지 않은 예전 회원 → 등록 유도
//  · 운영팀이 인연 공개를 중지한 회원(0139) → 사유 + 프로필 수정
//  · 고쳐서 재검토를 요청한 회원 → 시안 '프로필 확인 중' 카드 모양(세 단계 · 숨 쉬는 점). 신규 가입에는 쓰지 않는다(승인 절차 없음).
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { colors, fontSerif, layout } from '../../tokens';
import { BreathingDots, Button, Icon, T } from '../../ui';
import { usePreview, previewSelectors } from '../../lib/previewStore';

export function StatusChip({ label, tone }: { label: string; tone: 'sky' | 'gray' | 'red' }) {
  const c = tone === 'sky' ? { bg: colors.accentSubtle, fg: colors.accentStrong, dot: colors.accent } : tone === 'red' ? { bg: colors.dangerSoft, fg: colors.dangerPress, dot: colors.danger } : { bg: colors.bgSoft, fg: colors.textSecondary, dot: colors.mute };
  return (
    <View style={{ alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: c.bg, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.dot }} />
      <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: c.fg }}>{label}</Text>
    </View>
  );
}

// 세 단계 줄 — 끝난 단계는 체크, 지금 단계는 숨 쉬는 점, 남은 단계는 빈 원
function StepRow({ state, label, sub, last }: { state: 'done' | 'now' | 'next'; label: string; sub?: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: state === 'done' ? colors.accent : colors.surface, borderWidth: state === 'done' ? 0 : 1.5, borderColor: state === 'now' ? colors.accent : colors.control }}>
          {state === 'done' && <Icon name="check" size={12} color={colors.inverse} />}
          {state === 'now' && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />}
        </View>
        {!last && <View style={{ width: 1.5, flex: 1, minHeight: 18, backgroundColor: colors.line }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : 18 }}>
        <View style={{ minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: state === 'now' ? '600' : '400', color: state === 'next' ? colors.mute : colors.text }}>{label}</Text>
          {state === 'now' && <BreathingDots size={4} gap={4} />}
        </View>
        {!!sub && <Text style={{ fontSize: 12, lineHeight: 18, color: colors.mute }}>{sub}</Text>}
      </View>
    </View>
  );
}

// suspended — 운영팀이 인연 공개를 중지한 회원(0139). 고치면 다시 검토받는다(1014: 중지 중엔 인연 이용 불가)
export function ProfileGate({ onRegister, suspended, reason }: { onRegister: () => void; suspended?: boolean; reason?: string | null }) {
  const requestedAt = usePreview(previewSelectors.myProfile).affinityReviewRequestedAt;
  const reviewing = !!suspended && !!requestedAt;
  const title = reviewing ? '프로필을 확인하고 있어요.' : suspended ? '프로필 공개가 잠시 중지됐어요.' : '당신의 이야기를 들려주세요.';
  const body = reviewing
    ? '확인이 끝나면 새로운 인연을 다시 만날 수 있어요.'
    : suspended
      ? `${reason ? `사유: ${reason}\n` : ''}프로필을 고쳐 다시 검토를 요청해 주세요.`
      : '프로필을 등록하면 인연을 만날 수 있어요.';
  const d = requestedAt ? new Date(requestedAt) : null;
  const when = d && !Number.isNaN(d.getTime()) ? `${d.getMonth() + 1}월 ${d.getDate()}일 요청` : undefined;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: 40, paddingHorizontal: layout.gutter, paddingBottom: 30 }}>
      <StatusChip label={reviewing ? '재검토 중' : suspended ? '공개 중지' : '프로필 미등록'} tone={reviewing ? 'sky' : suspended ? 'red' : 'gray'} />
      <T accessibilityRole="header" style={{ marginTop: 14, fontFamily: fontSerif, fontSize: 21, lineHeight: 31.5, letterSpacing: -0.6, color: colors.text }}>{title}</T>
      <T style={{ marginTop: 8, fontSize: 13, lineHeight: 23.4, color: colors.sub }}>{body}</T>
      {reviewing && (
        <View style={{ marginTop: 24, padding: 16, borderRadius: 16, backgroundColor: colors.bgSoft }}>
          <StepRow state="done" label="프로필 수정 · 재검토 요청" sub={when} />
          <StepRow state="now" label="사진 · 소개 확인 중" />
          <StepRow state="next" label="인연 다시 공개" last />
        </View>
      )}
      <Button label={suspended ? '프로필 수정하기' : '프로필 등록하기'} variant={reviewing ? 'gray' : 'primary'} block onPress={onRegister} style={{ marginTop: 24 }} />
      <Text style={{ marginTop: 16, fontSize: 12, lineHeight: 18, color: colors.mute }}>커뮤니티와 플레이스는 계속 이용할 수 있어요.</Text>
    </ScrollView>
  );
}
