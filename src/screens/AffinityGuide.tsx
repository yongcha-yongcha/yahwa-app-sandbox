// 야화 — 인연 '이용안내' 탭 (프로토타입 v2 정책, 1013).
// 인연이 어떻게 굴러가는지(순서)와, 결제 없이 리프를 모으는 법을 한 화면에 담는다.
//
// 숫자는 전부 실제 동작에서 끌어온다 — 안내와 코드가 어긋나지 않게:
//   · 배치 크기 → src/lib/deck.ts, 편지 비용 → useLeafPricing(0187), 미션 → MISSIONS(0147)
//   · 첫 모임 보상액 → 어드민이 바꾸는 값이라 서버에서 조회(useFirstGatheringReward)
// HIDE_IOS_CURRENCY가 켜지면 리프 수치를 감춘다(다른 화면과 동일 규칙).
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../tokens';
import { Icons } from '../icons';
import { HIDE_IOS_CURRENCY } from '../lib/flags';
import { useFirstGatheringReward } from '../lib/hooks';
import { MISSIONS } from '../lib/api';
import { useLeafPricing } from '../lib/leafPricing';
import { DAILY_DECK_SIZE } from './AffinityDeck';
import { SLOT_TEXT } from '../lib/deck';

const DAILY_MISSION_MAX = MISSIONS.reduce((n, m) => n + m.amount, 0);

// 리디자인(1010) — 시연본 톤: 흰 바탕 · 여백 + 헤어라인으로만 묶는 차분한 안내.
export function AffinityGuide() {
  const rewardQ = useFirstGatheringReward();
  const firstGatherReward = rewardQ.data ?? null;
  const P = useLeafPricing().prices;

  return (
    <ScrollView
      style={{ backgroundColor: colors.surface }}
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 56 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── 머리말 ─────────────────────────────────────────────────────── */}
      <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.notice }}>
        관심은 무료 · 하루 {DAILY_DECK_SIZE}명
      </Text>
      <Text
        style={{
          fontSize: 25, fontWeight: '700', color: colors.text,
          lineHeight: 34, letterSpacing: -0.8, marginTop: 10,
        }}
      >
        야화의 인연은{'\n'}이렇게 연결돼요
      </Text>
      <Text style={{ fontSize: 13.5, color: colors.sub, lineHeight: 22, marginTop: 12 }}>
        수십 명에게 무작위로 뿌리는 소개팅이 아니에요.{'\n'}{SLOT_TEXT}
      </Text>

      {/* ── 연결 순서 ─────────────────────────────────────────────────────── */}
      <SectionTitle>연결되는 순서</SectionTitle>
      <Step
        n={1}
        title="오늘의 인연을 만나요"
        desc={`매일 12·15·18·21시에 두 명씩, 하루 ${DAILY_DECK_SIZE}명이 도착해요. '사진 보기'를 누르면 프로필 전체를 볼 수 있어요.`}
      />
      <Step
        n={2}
        title="마음이 가면 관심 보내기"
        desc="관심은 누구나 무료예요. 보낸 관심은 하트가 빨갛게 채워지고, 상대의 받은 호감에 표시돼요."
      />
      <Step
        n={3}
        title="편지로 마음을 전해요"
        desc="연락처(카톡 ID·전화번호)와 함께 편지를 보내요. 상대가 수락하고 답장을 보내야 서로의 연락처가 공개돼요."
        last
      />

      {/* ── 리프 모으는 법 ─────────────────────────────────────────────── */}
      {!HIDE_IOS_CURRENCY && (
        <>
          <SectionTitle>리프, 충전 없이 모으는 법</SectionTitle>
          {MISSIONS.map((m) => (
            <Earn key={m.key} title={m.title} desc={m.sub} amount={`+${m.amount} 리프`} repeat="매일" />
          ))}
          <Text style={{ fontSize: 11, color: colors.mute, lineHeight: 16, marginTop: 10 }}>
            하루 최대 {DAILY_MISSION_MAX}리프 · 매일 자정(한국 시간)에 초기화돼요.
          </Text>
          {firstGatherReward != null && (
            <Earn
              title="첫 모임 만들기"
              desc="모임 탭에서 직접 모임을 열면 적립돼요"
              amount={`+${firstGatherReward.toLocaleString()} 리프`}
              repeat="1회"
            />
          )}
          <Earn
            title="제휴 매장 이용하기"
            desc="야화 제휴 매장에서 결제하면 포인트가 쌓여요"
            amount="포인트"
            repeat="리프로 환전"
            last
          />

          {/* ── 쓰는 곳 — 가격을 숨기지 않는다 ── */}
          <SectionTitle>리프는 여기에 써요</SectionTitle>
          <Spend label="관심 보내기" value="무료" />
          <Spend label="일반편지 보내기" value={`${P.letter}리프`} />
          <Spend label="특별편지 보내기 (상대는 무료로 답장)" value={`${P.invite}리프`} />
          <Spend label="받은 편지 수락하기" value={`${P.reply}리프 · 특별편지는 무료`} />
          <Spend label="새로운 프로필 두 명 더 보기" value={`${P.extra}리프`} last />
          <Text style={{ fontSize: 11, color: colors.mute, lineHeight: 16, marginTop: 14 }}>
            읽지 않은 편지는 3일 뒤 사라지고 사용한 리프가 돌아가요. 읽은 편지는 읽은 날부터 7일, 서로 답장한 편지는 7일 동안 남아 있어요.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

// ── 파츠 ──────────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      accessibilityRole="header"
      style={{ fontSize: 18, fontWeight: '700', color: colors.text, letterSpacing: -0.4, marginTop: 44, marginBottom: 6 }}
    >
      {children}
    </Text>
  );
}

const rowLine = (last?: boolean) => ({
  borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
  borderBottomColor: colors.line,
});

function Step({ n, title, desc, last }: { n: number; title: string; desc: string; last?: boolean }) {
  return (
    <View style={[{ flexDirection: 'row', gap: 14, paddingVertical: 18 }, rowLine(last)]}>
      {/* 번호 — 얇은 원 안의 작은 숫자 */}
      <View
        style={{
          width: 24, height: 24, borderRadius: 12, marginTop: 1,
          borderWidth: 1, borderColor: colors.line,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 11, fontWeight: '600', color: colors.sub, fontVariant: ['tabular-nums'],
            // @ts-ignore Android 전용 — 숫자가 원 안에서 아래로 쏠리는 것 방지
            includeFontPadding: false,
          }}
        >
          {n}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text, letterSpacing: -0.2 }}>{title}</Text>
        <Text style={{ fontSize: 12.5, color: colors.sub, lineHeight: 20, marginTop: 4 }}>{desc}</Text>
      </View>
    </View>
  );
}

function Earn({
  title, desc, amount, repeat, last,
}: { title: string; desc: string; amount: string; repeat: string; last?: boolean }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18 }, rowLine(last)]}>
      <Icons.leaf size={20} color={colors.leaf} stroke={1.5} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '600', color: colors.text, letterSpacing: -0.2 }}>{title}</Text>
        <Text style={{ fontSize: 11.5, color: colors.sub, lineHeight: 17, marginTop: 3 }}>{desc}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] }}>{amount}</Text>
        <Text style={{ fontSize: 11, color: colors.mute, marginTop: 2 }}>{repeat}</Text>
      </View>
    </View>
  );
}

function Spend({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, paddingVertical: 14, gap: 16 }, rowLine(last)]}>
      <Text style={{ flexShrink: 1, fontSize: 13.5, color: colors.text }}>{label}</Text>
      <Text style={{ fontSize: 12.5, color: colors.sub, textAlign: 'right', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}
