// 야화 — 개인정보처리방침 (Google Play / App Store 제출용 공개 URL: /privacy)
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { colors } from '../src/tokens';

const UPDATED = '2026년 6월 2일';
const COMPANY = '야화컴퍼니(주)';
const CONTACT = 'admin@yahwacompany.com';

export default function Privacy() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: 20, paddingTop: 24, maxWidth: 760, alignSelf: 'center' as any, width: '100%' as any, paddingBottom: 80 }}>
      <Text style={{ fontSize: 20, lineHeight: 29, fontWeight: '600', color: colors.text }}>야화 개인정보처리방침</Text>
      <Text style={{ marginTop: 6, fontSize: 12, color: colors.mute }}>최종 수정일: {UPDATED}</Text>

      <P>{COMPANY}(이하 "회사")는 「개인정보 보호법」 등 관련 법령을 준수하며, 야화(이하 "서비스") 이용자의 개인정보를 보호하기 위해 본 개인정보처리방침을 둡니다. 야화는 만 19세 이상만 이용할 수 있는 소셜·데이트 서비스입니다.</P>

      <H>1. 수집하는 개인정보 항목</H>
      <P>회사는 서비스 제공을 위해 다음의 정보를 수집합니다.</P>
      <LI>계정/인증: 소셜 로그인(Apple, Kakao) 식별자, 이메일</LI>
      <LI>프로필: 닉네임, 성별, 생년월일·나이(만 19세 확인용), 지역, 한 줄 소개·자기소개, 관심 태그, 프로필 사진, MBTI·키·흡연·음주 등 선택 입력 정보</LI>
      <LI>연락처: 전화번호(연결·매칭이 성립된 상대방에게 공개되는 정보)</LI>
      <LI>위치: 주변 제휴 매장 및 가까운 사용자를 표시하기 위한 단말의 위치 정보(권한 동의 시)</LI>
      <LI>이용 데이터: 작성한 모임/커뮤니티 글·댓글, 게더링 참여 내역, 채팅 메시지, 좋아요·북마크</LI>
      <LI>결제: 리프(가상 재화) 충전 시 결제대행사(토스페이먼츠)를 통한 결제 정보. 카드번호 등 민감 결제정보는 회사가 저장하지 않습니다.</LI>
      <LI>기기/푸시: 푸시 알림 토큰, 기기 플랫폼(iOS/Android)</LI>
      <LI>매장 웨이팅: 웨이팅 등록 시 제휴 CRM(태그히어)에 전달되는 식별자·인원수</LI>
      <P style={{ marginTop: 12 }}>
        <Text style={{ fontWeight: '600', color: colors.text }}>필수 동의 항목(성별·생년월일·연령대): </Text>
        성별, 생년월일 및 이로부터 산출되는 연령(연령대)은 만 19세 이상 여부 확인과 이성 매칭 서비스 제공을 위해 반드시 필요한 정보이며, 회원가입 시 이용자로부터 별도의 동의를 받아 수집합니다. 해당 정보는 가입 이후 원칙적으로 수정할 수 없고, 동의하지 않을 경우 회원가입 및 서비스 이용이 제한될 수 있습니다.
      </P>

      <H>2. 개인정보의 수집·이용 목적</H>
      <LI>회원 가입·인증 및 만 19세 이상 본인 확인</LI>
      <LI>프로필 기반 매칭, 모임/커뮤니티/게더링/채팅 등 서비스 제공</LI>
      <LI>위치 기반 주변 매장·사용자 표시 및 매장 웨이팅 등록</LI>
      <LI>리프 충전 결제 처리 및 부정 이용 방지</LI>
      <LI>푸시 알림 발송, 고객 문의 응대, 서비스 개선</LI>

      <H>3. 보유 및 이용 기간</H>
      <P>회원 탈퇴 시 또는 수집·이용 목적 달성 시 지체 없이 파기합니다. 다만 관련 법령에 따라 보존이 필요한 정보는 해당 기간 동안 보관합니다(예: 전자상거래법상 결제·계약 기록 5년, 통신비밀보호법상 접속기록 3개월 등). 이용자는 앱 내 [마이 → 계정 삭제]로 언제든지 계정과 데이터 삭제를 요청할 수 있습니다.</P>

      <H>4. 제3자 제공 및 처리위탁</H>
      <P>회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않으며, 서비스 제공을 위해 아래와 같이 일부 업무를 위탁합니다.</P>
      <LI>Supabase: 데이터 저장·인증 인프라</LI>
      <LI>토스페이먼츠: 결제 처리</LI>
      <LI>네이버 클라우드(지도): 위치/지도 표시</LI>
      <LI>Apple, Kakao: 소셜 로그인</LI>
      <LI>태그히어(TagHere): 매장 웨이팅 등록·상태 연동(웨이팅 이용 시)</LI>
      <LI>Expo/푸시 서비스: 푸시 알림 발송</LI>
      <P style={{ marginTop: 12 }}><Text style={{ fontWeight: '600', color: colors.text }}>매칭 시 연락처 공개:</Text> "오늘의 친구" 또는 "모임"에서 이용자 간 연결이 양측의 승인으로 성립되면, 상대방에게 전화번호가 공개됩니다. 이는 이용자 본인의 동의(연결 신청·수락) 하에서만 이루어지며, 동의 없이 제3자에게 연락처가 제공되지 않습니다.</P>

      <H>5. 이용자의 권리</H>
      <P>이용자는 언제든지 자신의 개인정보를 조회·수정([마이 → 프로필 편집])하거나, 계정 삭제([마이 → 계정 삭제])를 통해 처리 정지·삭제를 요청할 수 있습니다. 위치 권한은 기기 설정에서 철회할 수 있습니다.</P>

      <H>6. 개인정보의 파기</H>
      <P>보유기간이 경과하거나 처리 목적이 달성된 개인정보는 복구 불가능한 방법으로 지체 없이 파기합니다. 전자적 파일은 영구 삭제하며, 출력물은 분쇄·소각합니다.</P>

      <H>7. 안전성 확보 조치</H>
      <P>회사는 개인정보 보호를 위해 전송 구간 암호화(HTTPS), 접근 권한 통제(Row Level Security), 인증·인가 분리 등의 보호조치를 시행합니다.</P>

      <H>8. 만 19세 미만 보호</H>
      <P>야화는 만 19세 이상만 가입할 수 있으며, 가입 시 생년월일로 연령을 확인합니다. 만 19세 미만으로 확인되는 경우 가입 및 이용이 제한됩니다.</P>

      <H>9. 개인정보 보호책임자 및 문의</H>
      <LI>회사: {COMPANY}</LI>
      <LI>문의: {CONTACT}</LI>

      <P style={{ marginTop: 24, color: colors.mute, fontSize: 12 }}>본 방침은 {UPDATED}부터 적용됩니다. 법령·서비스 변경에 따라 개정될 수 있으며, 변경 시 본 페이지를 통해 공지합니다.</P>
    </ScrollView>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <Text style={{ marginTop: 24, marginBottom: 6, fontSize: 16, lineHeight: 22.4, fontWeight: '600', color: colors.text }}>{children}</Text>;
}
function P({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[{ marginTop: 8, fontSize: 14, lineHeight: 22.4, color: colors.textSecondary }, style]}>{children}</Text>;
}
function LI({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, paddingLeft: 4 }}>
      <Text style={{ color: colors.mute, fontSize: 14, lineHeight: 22.4 }}>•</Text>
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 22.4, color: colors.textSecondary }}>{children}</Text>
    </View>
  );
}
