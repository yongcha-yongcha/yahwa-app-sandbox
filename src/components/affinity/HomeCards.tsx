// 야화 — 인연 홈의 안내 카드 (리뉴얼 1120 · spec-dating §3.1 "쉬는 중" · §3.15 "프로필 확인 중" 모양)
// · RestingCard: 인연 공개를 꺼 둔 회원 — 카드 줄 자리(위 8)에 흰 카드 + [다시 공개하기].
// · SuspendedCard: 운영 조치로 공개가 중지된 회원(0139) — 시안 '프로필 확인 중' 카드 모양(칩 · 명조 제목 · 세 단계 · 회색 버튼).
//   신규 가입에는 쓰지 않는다(대표 결정 11-20: 승인 절차 없음). 프로필을 고쳐 재검토를 요청했으면 '확인 중', 아니면 '공개 중지'.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontSerif } from '../../tokens';
import { usePreview, previewSelectors } from '../../lib/previewStore';
import { NATIVE, reduceMotion, usePress, useTabBarClearance } from '../../ui';
import { RIcons } from './icons';

// 카드 안 버튼 — 높이 48(킷 버튼에 없는 높이). primary: 진한 파랑 14/500 모서리 14 · gray: #E3E7EA 15/600 모서리 12
function CardButton({ label, tone, onPress }: { label: string; tone: 'primary' | 'gray'; onPress?: () => void }) {
  const press = usePress(0.97);
  const primary = tone === 'primary';
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={label}>
      <Animated.View style={[{ height: 48, borderRadius: primary ? 14 : 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: primary ? colors.btnPrimaryBg : colors.muted }, press.scaleStyle]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: primary ? colors.btnPrimaryPress : colors.control, opacity: press.p }]} />
        <Text style={primary ? { fontSize: 14, lineHeight: 21, fontWeight: '500', color: colors.btnPrimaryFg } : { fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function RestingCard({ onOpenVisibility }: { onOpenVisibility?: () => void }) {
  return (
    <View style={{ marginTop: 8, marginHorizontal: 30, paddingVertical: 24, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
      <Text accessibilityRole="header" style={{ marginBottom: 14, fontFamily: fontSerif, fontSize: 22, lineHeight: 34.1, color: colors.text }}>잠시 쉬어가는 중이에요.</Text>
      <Text style={{ marginBottom: 22, fontSize: 14, lineHeight: 25.2, color: colors.sub }}>준비가 되면 다시 새로운 인연을 만나보세요.</Text>
      <CardButton tone="primary" label="다시 공개하기" onPress={onOpenVisibility} />
    </View>
  );
}

// 지금 단계의 숨 쉬는 점(1.6초 ease-in-out 반복)
function BreathDot() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion()) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: NATIVE }),
      Animated.timing(v, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: NATIVE }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }] }} />;
}

type StepState = 'done' | 'now' | 'todo';
function Step({ state, title, desc, last }: { state: StepState; title: string; desc: string; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingBottom: last ? 0 : 16 }}>
      {/* 다음 단계로 이어지는 세로선(2) */}
      {!last && <View style={{ position: 'absolute', left: 9, top: 24, bottom: 2, width: 2, borderRadius: 1, backgroundColor: state === 'done' ? colors.accent : colors.line }} />}
      <View style={[{ marginTop: 1, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, state === 'done' ? { backgroundColor: colors.accent } : { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: state === 'now' ? colors.accent : colors.line }]}>
        {state === 'done' ? <RIcons.check size={12} color={colors.inverse} stroke={2.4} /> : state === 'now' ? <BreathDot /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, lineHeight: 21, fontWeight: state === 'todo' ? '500' : '600', color: state === 'now' ? colors.accentStrong : state === 'todo' ? colors.mute : colors.text }}>{title}</Text>
        <Text style={{ marginTop: 2, fontSize: 12, lineHeight: 18, color: colors.mute }}>{desc}</Text>
      </View>
    </View>
  );
}

export function SuspendedCard({ reason, onEdit }: { reason?: string | null; onEdit: () => void }) {
  const requestedAt = usePreview(previewSelectors.myProfile).affinityReviewRequestedAt;
  const reviewing = !!requestedAt;
  const pad = useTabBarClearance();
  const d = requestedAt ? new Date(requestedAt) : null;
  const when = d && !Number.isNaN(d.getTime()) ? `${d.getMonth() + 1}월 ${d.getDate()}일에 다시 보냈어요` : '다시 보냈어요';
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 30, paddingBottom: pad }} showsVerticalScrollIndicator={false}>
      <View style={{ paddingTop: 22, paddingHorizontal: 20, paddingBottom: 20, borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }}>
        <View style={{ alignSelf: 'flex-start', height: 24, paddingHorizontal: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: reviewing ? colors.accentSubtle : colors.bgSoft }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: reviewing ? colors.accent : colors.mute }} />
          <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: reviewing ? colors.accentStrong : colors.textSecondary }}>{reviewing ? '확인 중' : '공개 중지'}</Text>
        </View>
        <Text accessibilityRole="header" style={{ marginTop: 12, fontFamily: fontSerif, fontSize: 21, lineHeight: 30.45, letterSpacing: -0.5, color: colors.text }}>
          {reviewing ? '프로필을 확인하고 있어요' : '프로필 공개가 잠시 중지됐어요'}
        </Text>
        <Text style={{ marginTop: 6, fontSize: 13, lineHeight: 20.8, color: colors.sub }}>
          {reviewing
            ? '승인되면 새로운 인연을 만날 수 있어요. 끝나는 대로 알림으로 알려 드릴게요.'
            : `${reason ? `사유: ${reason}\n` : ''}프로필을 고쳐 다시 검토를 요청해 주세요.`}
        </Text>
        <View style={{ marginTop: 20 }}>
          <Step state={reviewing ? 'done' : 'now'} title="프로필 고치기" desc={reviewing ? when : '사진과 소개를 고쳐 주세요'} />
          <Step state={reviewing ? 'now' : 'todo'} title="사진 · 소개 확인 중" desc="운영팀이 다시 살펴보고 있어요" />
          <Step state="todo" title="인연 다시 만나기" desc="매일 12시 · 15시 · 18시 · 21시" last />
        </View>
        <View style={{ marginTop: 20 }}>
          <CardButton tone={reviewing ? 'gray' : 'primary'} label="프로필 수정하기" onPress={onEdit} />
        </View>
      </View>
      <Text style={{ marginTop: 12, fontSize: 12, lineHeight: 18, color: colors.mute, textAlign: 'center' }}>커뮤니티와 플레이스는 계속 이용할 수 있어요.</Text>
    </ScrollView>
  );
}
