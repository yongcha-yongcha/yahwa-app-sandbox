// 야화 — 서비스 이용약관 (앱스토어/플레이스토어 제출용 공개 URL: /terms)
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { colors } from '../src/tokens';

const UPDATED = '2026년 6월 3일';
const COMPANY = '야화컴퍼니(주)';
const CONTACT = 'admin@yahwacompany.com';

export default function Terms() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: 20, paddingTop: 24, maxWidth: 760, alignSelf: 'center' as any, width: '100%' as any, paddingBottom: 80 }}>
      <Text style={{ fontSize: 20, lineHeight: 29, fontWeight: '600', color: colors.text }}>야화 서비스 이용약관</Text>
      <Text style={{ marginTop: 6, fontSize: 12, color: colors.mute }}>최종 수정일: {UPDATED}</Text>

      <H>제1조 (목적)</H>
      <P>본 약관은 {COMPANY}(이하 "회사")가 제공하는 야화(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다. 야화는 만 19세 이상만 이용할 수 있는 소셜·데이트 서비스입니다.</P>

      <H>제2조 (정의)</H>
      <LI>"이용자"란 본 약관에 따라 서비스를 이용하는 회원을 말합니다.</LI>
      <LI>"모임"이란 이용자가 모임을 개설·참여하는 기능을, "오늘의 친구"란 이용자 프로필을 통해 연결을 신청하는 기능을 말합니다.</LI>
      <LI>"리프"란 서비스 내에서 연결 신청 등에 사용되는 가상 재화를 말합니다.</LI>

      <H>제3조 (약관의 효력 및 변경)</H>
      <P>본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다. 회사는 관련 법령을 위반하지 않는 범위에서 약관을 개정할 수 있으며, 개정 시 적용일자 및 사유를 명시하여 사전 공지합니다.</P>

      <H>제4조 (이용계약의 성립 및 만 19세 확인)</H>
      <P>이용계약은 이용자가 약관에 동의하고 소셜 로그인(Apple, Kakao)으로 가입을 완료함으로써 성립합니다. 야화는 가입 시 생년월일로 연령을 확인하며, 만 19세 미만으로 확인되는 경우 가입 및 이용이 제한됩니다.</P>

      <H>제5조 (이용자의 의무 및 금지행위)</H>
      <P>이용자는 다음 행위를 하여서는 안 됩니다. 위반 시 회사는 사전 통지 없이 게시물 삭제, 이용 정지, 계정 해지 등의 조치를 할 수 있습니다.</P>
      <LI>타인의 사진·신상정보를 도용하거나 허위 프로필을 등록하는 행위</LI>
      <LI>욕설·혐오·성희롱·음란물 등 타인에게 불쾌감을 주는 콘텐츠 게시</LI>
      <LI>상업적 광고, 스팸, 불법 정보의 게시 및 전송</LI>
      <LI>금전 요구·유인, 성매매 등 법령에 위반되는 만남의 알선</LI>
      <LI>서비스의 정상적 운영을 방해하는 일체의 행위</LI>

      <H>제6조 (콘텐츠 신고 및 제재)</H>
      <P>회사는 부적절한 이용자·콘텐츠에 대한 신고 및 차단 기능을 제공하며, 신고 접수 시 신속히 검토하여 콘텐츠 삭제·이용 제한 등 필요한 조치를 취합니다. 권리 침해(도용 등) 신고는 우선 처리합니다.</P>

      <H>제7조 (연결 및 연락처 공유)</H>
      <P>"오늘의 친구" 또는 "모임"에서 이용자 간 연결이 양측의 승인으로 성립되면, 상호 연락(전화번호 등 연락처)이 공유될 수 있습니다. 이는 이용자 본인의 동의 하에 진행되며, 공유 이후의 연락·만남은 이용자 간 책임입니다. 회사는 오프라인 만남에서 발생하는 분쟁·사고에 대해 책임을 지지 않습니다.</P>

      <H>제8조 (유료 서비스 및 결제)</H>
      <LI>리프(가상 재화)는 모바일 앱에서는 각 앱마켓의 인앱결제 정책에 따라, 웹에서는 결제대행사(토스페이먼츠)를 통해 충전할 수 있습니다.</LI>
      <LI>모임 참가비는 호스트가 정한 금액으로 결제되며, 회사는 플랫폼 운영 수수료를 차감할 수 있습니다.</LI>
      <LI>결제 취소·환불은 관련 법령(전자상거래법 등) 및 각 마켓의 정책에 따릅니다.</LI>

      <H>제9조 (회사의 의무 및 면책)</H>
      <P>회사는 안정적인 서비스 제공을 위해 노력합니다. 다만 천재지변, 이용자 귀책, 제3자의 불법행위 등 회사의 합리적 통제를 벗어난 사유로 인한 손해에 대해서는 책임이 면제됩니다. 회사는 이용자 간 또는 이용자와 제3자 간에 발생한 분쟁에 개입할 의무가 없습니다.</P>

      <H>제10조 (계약 해지 및 계정 삭제)</H>
      <P>이용자는 언제든지 앱 내 [마이 → 계정 삭제]를 통해 이용계약을 해지할 수 있으며, 이 경우 관련 법령에 따라 보존이 필요한 정보를 제외한 데이터는 지체 없이 파기됩니다.</P>

      <H>제11조 (준거법 및 관할)</H>
      <P>본 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련한 분쟁은 회사 본점 소재지를 관할하는 법원을 제1심 관할 법원으로 합니다.</P>

      <H>제12조 (문의)</H>
      <LI>회사: {COMPANY}</LI>
      <LI>문의: {CONTACT}</LI>

      <P style={{ marginTop: 24, color: colors.mute, fontSize: 12 }}>본 약관은 {UPDATED}부터 적용됩니다.</P>
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
