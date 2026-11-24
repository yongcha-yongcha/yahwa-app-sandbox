// 야화 — 아동 안전 표준 (CSAE/CSAM) 공개 페이지. Google Play 아동 안전 정책 필수.
// 공개 URL: /child-safety  (활성·전세계 공개·PDF 아님)
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { colors } from '../src/tokens';

const UPDATED = '2026년 6월 14일';
const COMPANY = '야화컴퍼니(주)';
const CONTACT = 'admin@yahwacompany.com';

export default function ChildSafety() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: 20, paddingTop: 24, maxWidth: 760, alignSelf: 'center' as any, width: '100%' as any, paddingBottom: 80 }}>
      <Text style={{ fontSize: 20, lineHeight: 29, fontWeight: '600', color: colors.text }}>야화 아동 안전 표준</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.sub, marginTop: 2 }}>YAHWA Child Safety Standards (CSAE / CSAM)</Text>
      <Text style={{ marginTop: 6, fontSize: 12, color: colors.mute }}>최종 수정일: {UPDATED}</Text>

      <P>{COMPANY}(이하 "회사")가 운영하는 야화(이하 "서비스")는 아동 성적 학대 및 착취(CSAE)와 아동 성적 학대 콘텐츠(CSAM)에 대해 <B>무관용(zero tolerance)</B> 원칙을 적용합니다. 회사는 아동을 보호하기 위한 표준을 수립하고 이를 엄격히 이행합니다.</P>

      <H>1. 무관용 원칙</H>
      <LI>아동 성적 학대·착취와 관련된 모든 콘텐츠, 행위, 유인(grooming), 거래는 어떤 경우에도 절대 금지됩니다.</LI>
      <LI>위반이 확인되면 사전 통지 없이 콘텐츠를 삭제하고 계정을 영구 정지하며, 관련 증거를 보존합니다.</LI>

      <H>2. 성인 전용 서비스</H>
      <LI>야화는 <B>만 19세 이상 성인만</B> 가입·이용할 수 있습니다. 미성년자의 가입과 이용은 금지됩니다.</LI>
      <LI>가입 시 생년월일로 연령을 확인하며, 만 19세 미만으로 확인되면 가입·이용이 차단됩니다.</LI>
      <LI>미성년자로 의심되는 계정을 발견하면 즉시 이용을 제한하고 검토합니다.</LI>

      <H>3. 앱 내 신고</H>
      <P>사용자는 앱 내에서 아동 안전 관련 우려사항을 신고할 수 있습니다. 모든 프로필·게시물·메시지에는 신고 기능이 제공되며, 신고 유형에는 아동 안전 위반이 포함됩니다.</P>
      <LI>프로필/콘텐츠의 <B>신고</B> 버튼으로 즉시 신고</LI>
      <LI>이메일 신고: <B>{CONTACT}</B></LI>
      <P>접수된 아동 안전 신고는 <B>최우선으로 24시간 이내 1차 검토</B>하며, 필요한 조치를 신속히 취합니다.</P>

      <H>4. 대응 및 법규 준수</H>
      <LI>회사는 아동 안전과 관련된 모든 해당 법규를 준수합니다.</LI>
      <LI>CSAM이 확인되면 콘텐츠를 보존·삭제하고, 계정을 영구 정지하며, <B>관련 당국 및 국가 신고 기관에 신고</B>합니다.</LI>
      <LI>대한민국의 관계 당국(예: 경찰청)과 국제 신고 기관(예: 미국 NCMEC, National Center for Missing &amp; Exploited Children)에 법령에 따라 신고합니다.</LI>

      <H>5. 아동 안전 책임자 연락처</H>
      <P>아동 안전(CSAE/CSAM) 방지 관행 및 규정 준수에 관한 문의는 아래 지정 담당자에게 연락할 수 있습니다.</P>
      <LI>회사: {COMPANY}</LI>
      <LI>아동 안전 담당 연락처: <B>{CONTACT}</B></LI>

      <H>English Summary</H>
      <P>YAHWA, operated by {COMPANY}, maintains a strict <B>zero-tolerance</B> policy toward Child Sexual Abuse and Exploitation (CSAE) and Child Sexual Abuse Material (CSAM).</P>
      <LI>YAHWA is a strictly adults-only service (19+). Minors are prohibited; age is verified at sign-up.</LI>
      <LI>Users can report child-safety concerns in-app (report button on every profile, post and message) or by email at {CONTACT}. Reports are prioritized and reviewed within 24 hours.</LI>
      <LI>Confirmed CSAM results in immediate content removal, permanent account ban, evidence preservation, and reporting to relevant authorities and national reporting bodies (e.g., NCMEC and Korean law enforcement).</LI>
      <LI>We comply with all applicable child-safety laws and report to local and national authorities as required.</LI>
      <LI>Child-safety point of contact: {CONTACT}</LI>

      <P style={{ marginTop: 24, color: colors.mute, fontSize: 12 }}>본 표준은 {UPDATED}부터 적용됩니다. / Effective from {UPDATED}.</P>
    </ScrollView>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <Text style={{ marginTop: 24, marginBottom: 6, fontSize: 16, lineHeight: 22.4, fontWeight: '600', color: colors.text }}>{children}</Text>;
}
function P({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[{ marginTop: 8, fontSize: 14, lineHeight: 22.4, color: colors.textSecondary }, style]}>{children}</Text>;
}
function B({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontWeight: '600', color: colors.text }}>{children}</Text>;
}
function LI({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, paddingLeft: 4 }}>
      <Text style={{ color: colors.mute, fontSize: 14, lineHeight: 22.4 }}>•</Text>
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 22.4, color: colors.textSecondary }}>{children}</Text>
    </View>
  );
}
