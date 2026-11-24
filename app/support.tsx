// 야화 — 고객지원 페이지 (App Store Connect Support URL: /support)
// Apple Guideline 1.5 대응: 이용자가 실제로 질문하고 지원을 요청할 수 있는 정보를 제공한다.
import React from 'react';
import { View, Text, ScrollView, Linking, Pressable, Platform } from 'react-native';
import { colors } from '../src/tokens';

const UPDATED = '2026년 7월 17일';
const COMPANY = '야화컴퍼니(주)';
const CONTACT = 'admin@yahwacompany.com';

function open(url: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  } else {
    Linking.openURL(url).catch(() => {});
  }
}

export default function Support() {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ padding: 20, paddingTop: 24, maxWidth: 760, alignSelf: 'center' as any, width: '100%' as any, paddingBottom: 80 }}
    >
      <Text style={{ fontSize: 20, lineHeight: 29, fontWeight: '600', color: colors.text }}>야화 고객지원</Text>
      <Text style={{ marginTop: 6, fontSize: 12, color: colors.mute }}>최종 수정일: {UPDATED}</Text>
      <P>
        야화를 이용하면서 궁금한 점이나 문제가 있으면 언제든 문의해주세요. 아래 이메일로 연락 주시면
        영업일 기준 24시간 이내에 답변드립니다.
      </P>

      {/* 문의 카드 — Apple 1.5 핵심: 실제 연락 수단 */}
      <View style={{ marginTop: 20, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 18, backgroundColor: colors.bgSoft }}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.sub }}>이메일 문의</Text>
        <Pressable onPress={() => open(`mailto:${CONTACT}`)} style={{ marginTop: 6 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.accent }}>{CONTACT}</Text>
        </Pressable>
        <Text style={{ marginTop: 10, fontSize: 12, color: colors.sub, lineHeight: 18 }}>
          운영시간: 평일 10:00 ~ 19:00 (KST){'\n'}
          답변: 영업일 기준 24시간 이내{'\n'}
          문의 시 가입하신 계정 정보와 발생한 화면을 함께 보내주시면 더 빠르게 도와드릴 수 있어요.
        </Text>
      </View>

      <H>자주 묻는 질문</H>

      <Q>가입은 어떻게 하나요?</Q>
      <P>
        야화는 만 19세 이상만 이용할 수 있습니다. Apple 또는 카카오 계정으로 로그인한 뒤 생년월일과
        성별, 프로필을 등록하면 가입이 완료됩니다. 만 19세 미만은 가입이 제한됩니다.
      </P>

      <Q>모임은 어떻게 참여하나요?</Q>
      <P>
        홈의 모임 탭에서 원하는 모임을 고르고 참여를 신청하면 호스트의 승인 후 참여가 확정됩니다.
        호스트가 참가비를 설정한 모임은 결제 후 신청되며, 승인 결과는 앱 알림으로 안내됩니다.
        원활한 알림 수신을 위해 앱 알림을 켜주세요.
      </P>

      <Q>오늘의 친구에서 연결은 어떻게 되나요?</Q>
      <P>
        마음에 드는 프로필에 연결을 신청하고 상대가 수락하면 서로의 연락처가 공개됩니다.
        상대가 수락하기 전에는 연락처가 공개되지 않습니다.
      </P>

      <Q>프로필 사진이나 정보를 바꾸고 싶어요.</Q>
      <P>
        마이 탭 → 프로필 편집에서 사진(최대 6장)과 소개, 관심사 등을 언제든 수정할 수 있습니다.
        첫 번째 사진이 대표 사진으로 표시됩니다.
      </P>

      <Q>부적절한 이용자나 게시물을 발견했어요.</Q>
      <P>
        프로필·게시물·댓글 화면의 신고 버튼으로 접수해주세요. 접수된 신고는 24시간 이내에 검토하여
        게시물 삭제, 이용 제한 등의 조치를 취합니다. 특정 이용자를 차단할 수도 있으며, 연락처 기반
        지인 차단 기능으로 아는 사람에게 내 프로필이 노출되지 않게 할 수 있습니다.
      </P>

      <Q>계정을 삭제하고 싶어요.</Q>
      <P>
        마이 탭 → 설정 → 회원 탈퇴에서 직접 삭제할 수 있습니다. 탈퇴 시 프로필, 게시물, 사진 등 모든
        데이터가 영구 삭제되며 복구할 수 없습니다. 앱에서 탈퇴가 어려운 경우 위 이메일로 요청해주세요.
      </P>

      <Q>결제·환불은 어떻게 하나요?</Q>
      <P>
        모임 참가비는 호스트가 설정한 금액이며 앱 내에서 결제됩니다. 모임 취소나 정원 초과 등으로
        참여가 무산된 경우 환불 처리됩니다. 환불이나 결제 관련 문의는 위 이메일로 결제 일시와 금액을
        알려주시면 확인 후 안내드립니다.
      </P>

      <Q>앱 알림이 오지 않아요.</Q>
      <P>
        기기 설정 → 알림 → 야화에서 알림이 허용되어 있는지 확인해주세요. 알림이 꺼져 있으면 호스트
        승인이나 연결 수락 결과를 받으실 수 없습니다.
      </P>

      <H>운영 정보</H>
      <P>
        상호: {COMPANY}{'\n'}
        고객지원 이메일: {CONTACT}
      </P>

      <H>관련 문서</H>
      <View style={{ gap: 8, marginTop: 4 }}>
        <Pressable onPress={() => open('/terms')}>
          <Text style={{ fontSize: 14, color: colors.accent, fontWeight: '600' }}>이용약관</Text>
        </Pressable>
        <Pressable onPress={() => open('/privacy')}>
          <Text style={{ fontSize: 14, color: colors.accent, fontWeight: '600' }}>개인정보처리방침</Text>
        </Pressable>
        <Pressable onPress={() => open('/child-safety')}>
          <Text style={{ fontSize: 14, color: colors.accent, fontWeight: '600' }}>아동 안전 정책</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <Text style={{ marginTop: 28, fontSize: 16, lineHeight: 22.4, fontWeight: '600', color: colors.text }}>{children}</Text>;
}
function Q({ children }: { children: React.ReactNode }) {
  return <Text style={{ marginTop: 18, fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text }}>{children}</Text>;
}
function P({ children }: { children: React.ReactNode }) {
  return <Text style={{ marginTop: 8, fontSize: 14, color: colors.textSecondary, lineHeight: 22.4 }}>{children}</Text>;
}
