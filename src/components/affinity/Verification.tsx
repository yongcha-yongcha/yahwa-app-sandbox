// 야화 — 인증 설명 창 (시안 S 컴포넌트 .verification-dialog, 1013-B)
// 이름 옆 기본 인증 씰 → 성별·나이·전화번호 확인 목록, 선택 인증 줄 → 그 인증이 무엇을 확인했는지.
import React from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { colors, scrimColor } from '../../tokens';
import { VerificationSeal, CertBadge, CertBlue, RIcons, type CredentialKind } from './icons';
import { Icon } from '../../ui';
import { LS } from './ui';

export type Credential = { kind: CredentialKind; label: string };
export type VerificationTarget = 'basic' | Credential;

const TITLE: Record<CredentialKind, string> = { school: '학력 인증', company: '직장 인증', income: '소득 인증' };
const DESC: Record<CredentialKind, string> = {
  school: '제출한 자료로 학교와 재학·졸업 상태를 확인한 표시예요.',
  company: '제출한 자료로 회사와 재직 상태를 확인한 표시예요.',
  income: '제출한 자료로 해당 연도의 소득 구간을 확인한 표시예요.',
};

export function VerificationDialog({ target, onClose }: { target: VerificationTarget | null; onClose: () => void }) {
  const small = { fontSize: 12, lineHeight: 19.8, letterSpacing: LS, color: colors.sub, marginTop: 8 } as const;
  const body = { fontSize: 14, lineHeight: 24.5, letterSpacing: LS, color: colors.text } as const;
  return (
    <Modal transparent visible={!!target} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: scrimColor(), padding: 16, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} accessibilityLabel="닫기" />
        {!!target && (
          <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 320, maxHeight: '80%', backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden' }}>
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 24 }} bounces={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text accessibilityRole="header" style={{ fontSize: 20, lineHeight: 30, fontWeight: '600', letterSpacing: -0.5, color: colors.text }}>
                  {target === 'basic' ? '기본 인증' : TITLE[target.kind]}
                </Text>
                <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="인증 설명 닫기" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 24, lineHeight: 30, color: colors.text }}>×</Text>
                </Pressable>
              </View>
              {target === 'basic' ? (
                <View style={{ marginVertical: 16, gap: 12 }}>
                  {['성별', '나이', '전화번호'].map((x) => (
                    <View key={x} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <VerificationSeal size={18} />
                      <Text style={{ fontSize: 14, lineHeight: 23.1, letterSpacing: LS, color: colors.text }}>{x} 인증 완료</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <>
                  <Text style={body}>{target.label}</Text>
                  <Text style={body}>{DESC[target.kind]}</Text>
                </>
              )}
              <Text style={target === 'basic' ? { ...small, marginTop: 0 } : small}>실제 전화번호와 제출 자료는 공개하지 않아요.</Text>
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ── 인증 팝업(리뉴얼 1120 · 시안 cert-popup, spec-dating §3.13) ──
// 화면 가운데 상자 312 · 모서리 24 · 안쪽 24 20 12 · 오른쪽 위 닫기(44, 아이콘 20). 큰 배지 44 → "○○님의 인증" 18/26 600 →
// 줄(높이 52, 줄 사이 1px): 배지 22 + 이름 15/22 500 + 오른쪽 "✓ 인증됨" 13/500. 줄 종류: 나이 · 전화번호 / 직장 / 학력 / 소득.
const CERT_ROW: Record<CredentialKind, string> = { company: '직장', school: '학력', income: '소득' };
const CERT_ORDER: CredentialKind[] = ['company', 'school', 'income'];
export function CertDialog({ open, name, basic, credentials, onClose }: {
  open: boolean; name: string; basic?: boolean; credentials?: Credential[] | null; onClose: () => void;
}) {
  const creds = CERT_ORDER.map((k) => credentials?.find((c) => c.kind === k)).filter(Boolean) as Credential[];
  const rows: { key: string; label: string; hi: boolean }[] = [
    ...(basic ? [{ key: 'basic', label: '나이 · 전화번호', hi: false }] : []),
    ...creds.map((c) => ({ key: c.kind, label: c.label ? `${CERT_ROW[c.kind]} · ${c.label}` : CERT_ROW[c.kind], hi: true })),
  ];
  return (
    <Modal transparent visible={open} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.scrimDialog, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} accessibilityLabel="닫기" />
        <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 312, paddingTop: 24, paddingHorizontal: 20, paddingBottom: 12, borderRadius: 24, backgroundColor: colors.surface, boxShadow: '0px 24px 48px -24px rgba(39,48,55,0.35)' }}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="닫기" style={{ position: 'absolute', right: 8, top: 8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
            <Icon name="close" size={20} color={colors.mute} />
          </Pressable>
          <CertBadge size={44} hi={creds.length > 0} />
          <Text accessibilityRole="header" style={{ marginTop: 12, marginBottom: 8, paddingRight: 32, fontSize: 18, lineHeight: 26, fontWeight: '600', letterSpacing: -0.2, color: colors.text }}>{name}님의 인증</Text>
          {rows.map((r, i) => (
            <View key={r.key} style={{ height: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
              {r.hi ? <CertBlue size={22} /> : <CertBadge size={22} />}
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '500', color: colors.text }}>{r.label}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <RIcons.check size={14} color={colors.accentStrong} stroke={2.2} />
                <Text style={{ fontSize: 13, lineHeight: 13, fontWeight: '500', color: colors.accentStrong }}>인증됨</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}
