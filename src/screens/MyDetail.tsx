// 야화 — 마이페이지 디테일 (project/야화/screens-detail.jsx MyDetail 픽셀 포트)
// mode: 'likes' | 'setting'
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { colors, radius } from '../tokens';
import { Icons } from '../icons';
import { NavBar, MosaicImg, Toggle } from '../components/atoms';
import { FEED } from '../data/mock';
import { IS_DEMO } from '../lib/flags';
import { signOut, deleteAccount } from '../lib/auth';
import { ContactBlockConsentModal, useContactBlockStatus } from '../components/ContactBlockGate';
import { previewActions } from '../lib/previewStore';

const VISIBLE_FEED = IS_DEMO ? FEED : [];

export type MyDetailMode = 'likes' | 'setting';

export function MyDetail({
  mode,
  onBack,
  onOpenEditProfile,
}: {
  mode: MyDetailMode;
  onBack?: () => void;
  onOpenEditProfile?: () => void;
}) {
  const title = mode === 'likes' ? '받은 좋아요' : '설정';
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <NavBar
        title={title}
        left={
          <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={8} onPress={onBack} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Icons.chevLeft size={22} color={colors.text} stroke={1.5} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        {mode === 'likes' && <LikesView />}
        {mode === 'setting' && <SettingView onOpenEditProfile={onOpenEditProfile} onAfterSignOut={onBack} />}
      </ScrollView>
    </View>
  );
}

function LikesView() {
  return (
    <>
      {/* 요약 — 숫자 두 칸, 헤어라인으로만 구분 */}
      <View
        style={{
          flexDirection: 'row',
          paddingVertical: 20,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.line,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11.5, color: colors.sub }}>받은 좋아요</Text>
          <Text style={{ fontSize: 25, fontWeight: '700', color: colors.text, marginTop: 4, letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}>12</Text>
        </View>
        <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginRight: 20 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11.5, color: colors.sub }}>새 매칭</Text>
          <Text style={{ fontSize: 25, fontWeight: '700', color: colors.text, marginTop: 4, letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}>3</Text>
        </View>
      </View>

      <View style={{ paddingTop: 20, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 20 }}>
        {VISIBLE_FEED.slice(0, 6).map((u) => (
          <View key={u.id} style={{ width: '48%' }}>
            <View style={{ aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.bgSoft }}>
              <MosaicImg src={u.photos[0]} mosaic blurStrength={12} />
              <View
                style={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderRadius: radius.pill,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>NEW</Text>
              </View>
            </View>
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: colors.text, marginTop: 10 }}>{u.nick}</Text>
            <Text style={{ fontSize: 11.5, color: colors.sub, marginTop: 2 }}>{u.region}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

// 크로스 플랫폼 confirm — RN web Alert가 onPress를 신뢰성있게 호출하지 못해 window.confirm 폴백
function confirmCross(title: string, message: string): boolean | Promise<boolean> {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`);
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: '취소', style: 'cancel', onPress: () => resolve(false) },
      { text: '확인', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

function SettingView({
  onOpenEditProfile,
  onAfterSignOut,
}: {
  onOpenEditProfile?: () => void;
  onAfterSignOut?: () => void;
}) {
  const router = useRouter();
  const appVersion = Constants.expoConfig?.version ?? '0.0.1';
  const [notifs, setNotifs] = useState([true, true, true, false]);
  const labels = ['매칭 알림', '메시지 알림', '좋아요 알림', '이벤트/혜택'];

  async function handleSignOut() {
    const ok = await confirmCross('로그아웃', '정말 로그아웃할까요?');
    if (!ok) return;
    try {
      await signOut();
    } catch { /* ignore — 로컬 store 정리는 어쨌든 진행 */ }
    previewActions.signOutPreview();
    onAfterSignOut?.();
  }

  async function handleDelete() {
    const ok1 = await confirmCross('회원 탈퇴', '계정과 모든 데이터가 영구 삭제돼요. 복구할 수 없어요. 계속할까요?');
    if (!ok1) return;
    const ok2 = await confirmCross('정말 탈퇴할까요?', '한 번 더 확인할게요. 진짜 삭제하면 되돌릴 수 없어요.');
    if (!ok2) return;
    try {
      await deleteAccount();
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert('삭제 실패: ' + (e?.message ?? ''));
      else Alert.alert('탈퇴 실패', e?.message ?? '잠시 후 다시 시도해주세요');
      return;
    }
    previewActions.deleteAccountPreview();
    onAfterSignOut?.();
  }

  function openLegal(label: string) {
    // 약관/방침은 앱 내 라우트로 — 배포 도메인에 의존하지 않음(기존 yahwa.vercel.app 하드코딩 제거).
    if (label === '이용약관') { router.push('/terms' as never); return; }
    if (label === '개인정보처리방침') { router.push('/privacy' as never); return; }
    // 문의 — 법적 페이지와 동일한 공식 이메일로 통일(기존 hello@yahwa.app 불일치 수정).
    const url = 'mailto:admin@yahwacompany.com';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = url;
    } else {
      Linking.openURL(url).catch(() => { /* ignore */ });
    }
  }

  // 지인 차단 상태 — 계정 관리에서도 켜짐/꺼짐을 확인·설정 가능
  const contactBlockQ = useContactBlockStatus();
  const [contactModalOpen, setContactModalOpen] = React.useState(false);

  const accountActions: Record<string, () => void> = {
    '프로필 편집': () => { onOpenEditProfile?.(); },
    '지인 차단': () => {
      // RN-web은 Alert.alert가 no-op — 웹에선 window.alert
      if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.alert('앱에서 설정할 수 있어요\n연락처 접근은 모바일 앱에서만 가능해요.'); return; }
      const st = contactBlockQ.data;
      if (st?.consent === 'granted') {
        Alert.alert(
          '지인 차단 켜짐',
          `연락처 ${(st.count ?? 0).toLocaleString()}개 번호가 숨김 처리돼 있어요.\n연락처가 바뀌었다면 다시 동기화하세요.`,
          [
            { text: '닫기', style: 'cancel' },
            { text: '다시 동기화', onPress: () => setContactModalOpen(true) },
          ],
        );
      } else {
        setContactModalOpen(true);
      }
    },
    '본인 인증': () => {
      if (Platform.OS === 'web') { if (typeof window !== 'undefined') window.alert('이미 완료됨\n가입 시 인증된 계정이에요.'); }
      else Alert.alert('이미 완료됨', '가입 시 인증된 계정이에요.');
    },
    '로그아웃': () => { void handleSignOut(); },
  };

  return (
    <>
      <SectionLabel first>알림</SectionLabel>
      {labels.map((k, i) => (
        <View key={k} style={[rowStyle(i === labels.length - 1), { justifyContent: 'space-between' }]}>
          <Text style={{ fontSize: 14.5, color: colors.text }}>{k}</Text>
          <Toggle
            value={notifs[i]}
            onChange={() => setNotifs((arr) => arr.map((v, idx) => (idx === i ? !v : v)))}
          />
        </View>
      ))}

      <ContactBlockConsentModal visible={contactModalOpen} onClose={() => setContactModalOpen(false)} />
      <SectionLabel>계정</SectionLabel>
      {['프로필 편집', '지인 차단', '본인 인증', '로그아웃'].map((k, i, a) => (
        <Pressable
          key={k}
          onPress={accountActions[k]}
          accessibilityRole="button"
          style={({ pressed }) => [rowStyle(i === a.length - 1), { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={{ flex: 1, fontSize: 14.5, color: k === '로그아웃' ? colors.danger : colors.text }}>{k}</Text>
          {/* 지인 차단 — 현재 상태를 행에서 바로 확인 */}
          {k === '지인 차단' && Platform.OS !== 'web' && contactBlockQ.data && (
            <Text style={{ fontSize: 11.5, color: colors.sub, fontVariant: ['tabular-nums'] }}>
              {contactBlockQ.data.consent === 'granted' ? `켜짐 · ${contactBlockQ.data.count.toLocaleString()}개` : '꺼짐'}
            </Text>
          )}
          <Icons.chev size={16} color={colors.mute} stroke={1.5} />
        </Pressable>
      ))}

      <SectionLabel>기타</SectionLabel>
      {['이용약관', '개인정보처리방침', '문의하기', `앱 버전 ${appVersion}`].map((k, i, a) => {
        const isVersion = i === a.length - 1;
        return (
          <Pressable
            key={k}
            disabled={isVersion}
            onPress={() => openLegal(k)}
            accessibilityRole={isVersion ? 'text' : 'button'}
            style={({ pressed }) => [rowStyle(isVersion), { opacity: pressed ? 0.6 : 1 }]}
          >
            {isVersion ? (
              <>
                <Text style={{ flex: 1, fontSize: 14.5, color: colors.text }}>앱 버전</Text>
                <Text style={{ fontSize: 12.5, color: colors.mute, fontVariant: ['tabular-nums'] }}>{appVersion}</Text>
              </>
            ) : (
              <>
                <Text style={{ flex: 1, fontSize: 14.5, color: colors.text }}>{k}</Text>
                <Icons.chev size={16} color={colors.mute} stroke={1.5} />
              </>
            )}
          </Pressable>
        );
      })}

      <View style={{ paddingTop: 28, paddingBottom: 20, alignItems: 'center' }}>
        <Pressable onPress={handleDelete} accessibilityRole="button" hitSlop={8} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }}>
          <Text style={{ color: colors.danger, fontSize: 12.5 }}>회원 탈퇴</Text>
        </Pressable>
      </View>
    </>
  );
}

// 섹션 라벨 — MY '더보기'와 같은 톤(13 · sub)
function SectionLabel({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <Text accessibilityRole="header" style={{ fontSize: 11.5, color: colors.sub, marginTop: first ? 16 : 32, marginBottom: 4 }}>
      {children}
    </Text>
  );
}

// 설정 행 — 56px, 헤어라인 구분(섹션 마지막 행은 선 없음)
function rowStyle(last: boolean) {
  return {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    minHeight: 56,
    borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  };
}
