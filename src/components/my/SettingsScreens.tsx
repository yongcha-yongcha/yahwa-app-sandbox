// 야화 — MY 안쪽 화면: 알림 설정 · 설정 · 도움말 · 계정 관리 · 닉네임 변경 · 차단 관리 · 숨긴 인연 · 문의하기 · 약관 · 회원 탈퇴
// (리뉴얼 1120 · spec-rest §8 · §9.3 · §9.4). 동작은 예전 모달(NotifSettingsSheet · SettingsSheet) 그대로다.
// · 알림: 앱(전체) · 인연 · 커뮤니티 스위치 3개. 끄면 휴대폰 푸시만 멈추고 앱 안 알림 목록은 그대로 남는다(0163·0170).
//   인연 = users.affinity_mute_notifs · 전체/커뮤니티 = notif_mute_all / notif_mute_community(0170, 적용 전 서버에서는 막아 둔다)
// · 문의: 적은 내용을 메일 본문으로 채워 메일 앱을 연다(서버 저장 없음)
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, radius } from '../../tokens';
import { BottomSheet, Button, Card, ConfirmSheet, DockArea, Icon, Row, SheetHeader, Switch } from '../../ui';
import { registerForPushNotifications } from '../../lib/push';
import { supabase } from '../../lib/supabase';
import { updateUserProfileServer, fetchMyBlocks, unblockUser, type BlockRow } from '../../lib/api';
import { useFriendProfile } from '../../lib/hooks';
import { nicknameError, NICKNAME_MAX } from '../../lib/nickname';
import { signOut, deleteAccount } from '../../lib/auth';
import { previewActions, previewSelectors, usePreview, getCurrentUserId } from '../../lib/previewStore';
import { unhideProfile, useHiddenIds } from '../affinity/hidden';
import { useResting } from '../VisibilitySheet';
import { Screen, GroupTitle, Sub, EmptyLine } from './ui';
import { CfInput } from './BadgeCredentials';
import type { MyNav } from './nav';

const PREVIEW = process.env.EXPO_PUBLIC_PREVIEW_MODE === '1';
const CONTACT = 'admin@yahwacompany.com';
const WEB_NO_OUTLINE = (Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0 } : null) as object | null;

// ── 알림 설정 ─────────────────────────────────────────────
type Prefs = { all: boolean; community: boolean; ready: boolean };
const KEY = ['notif-prefs'];

async function fetchPrefs(): Promise<Prefs> {
  const uid = getCurrentUserId();
  if (!uid) return { all: false, community: false, ready: false };
  const { data, error } = await supabase.from('users').select('notif_mute_all, notif_mute_community' as any).eq('id', uid).maybeSingle();
  if (error) return { all: false, community: false, ready: false };  // 0170 적용 전(열 없음)
  const row = (data ?? {}) as { notif_mute_all?: boolean; notif_mute_community?: boolean };
  return { all: !!row.notif_mute_all, community: !!row.notif_mute_community, ready: true };
}

// 기기 알림 권한(시안 .permission-state) — 웹은 브라우저 Notification, 앱은 expo-notifications
type Perm = 'granted' | 'denied' | 'unknown';
const webNotif = () => (Platform.OS === 'web' && typeof (globalThis as any).Notification !== 'undefined' ? (globalThis as any).Notification : null);
async function readPerm(): Promise<Perm> {
  if (Platform.OS === 'web') {
    const N = webNotif();
    return !N ? 'unknown' : N.permission === 'granted' ? 'granted' : N.permission === 'denied' ? 'denied' : 'unknown';
  }
  try {
    const r = await Notifications.getPermissionsAsync();
    return r.status === 'granted' ? 'granted' : r.status === 'denied' ? 'denied' : 'unknown';
  } catch { return 'unknown'; }
}
function usePushPermission() {
  const [perm, setPerm] = useState<Perm>('unknown');
  useEffect(() => { void readPerm().then(setPerm); }, []);
  async function check() {
    if (Platform.OS === 'web') {
      const N = webNotif();
      if (N && N.permission === 'default') { await N.requestPermission().catch(() => null); setPerm(await readPerm()); return; }
      previewActions.showToast(perm === 'granted' ? '알림 권한이 허용되어 있어요.' : '브라우저 설정에서 알림을 허용해주세요.', 2400);
      return;
    }
    const cur = await Notifications.getPermissionsAsync().catch(() => null);
    if (cur?.status === 'granted') {
      void registerForPushNotifications().catch(() => {});
      previewActions.showToast('알림 권한이 허용되어 있어요.', 2400);
      return;
    }
    if (cur?.canAskAgain !== false) {
      const r = await Notifications.requestPermissionsAsync().catch(() => null);
      setPerm(await readPerm());
      if (r?.status === 'granted') { void registerForPushNotifications().catch(() => {}); return; }
    }
    // 시스템 팝업이 다시 뜨지 않는 상태(이전에 거부) — 설정으로 안내
    Alert.alert('설정에서 켜주세요', '설정 > 알림 > 야화에서 알림을 허용해주세요.', [
      { text: '닫기', style: 'cancel' },
      { text: '설정 열기', onPress: () => { Linking.openSettings?.().catch(() => {}); } },
    ]);
  }
  return { perm, check };
}

export function NotifScreen({ nav }: { nav: MyNav }) {
  const qc = useQueryClient();
  const profile = usePreview(previewSelectors.myProfile);
  const q = useQuery({ queryKey: KEY, queryFn: fetchPrefs, staleTime: 30_000 });
  const prefs = q.data ?? { all: false, community: false, ready: false };
  const appOn = !prefs.all;
  const datingOn = !profile.affinityMuteNotifs;
  const communityOn = !prefs.community;
  const { perm, check } = usePushPermission();

  function fail() { previewActions.showToast('설정 저장에 실패했어요. 잠시 후 다시 시도해주세요', 2400); }

  // 전체·커뮤니티 — 화면 먼저 반영 후 저장, 실패하면 되돌린다
  function setMute(col: 'notif_mute_all' | 'notif_mute_community', muted: boolean) {
    const uid = getCurrentUserId();
    if (!uid) return;
    const prev = prefs;
    const next = { ...prev, ...(col === 'notif_mute_all' ? { all: muted } : { community: muted }) };
    qc.setQueryData(KEY, next);
    supabase.from('users').update({ [col]: muted } as never).eq('id', uid).then(({ error }) => {
      if (error) { qc.setQueryData(KEY, prev); fail(); }
    });
  }
  // 인연 — 기존 방식 그대로(로컬 먼저 → 서버 저장 → 실패 시 원복)
  function setDating(on: boolean) {
    previewActions.updateMyProfile({ affinityMuteNotifs: !on } as any);
    updateUserProfileServer({ affinityMuteNotifs: !on } as any).catch(() => {
      previewActions.updateMyProfile({ affinityMuteNotifs: on } as any);
      fail();
    });
  }

  const rows: { name: string; detail: string; on: boolean; disabled: boolean; toggle: () => void }[] = [
    { name: '앱 알림', detail: '전체 알림을 켜거나 꺼요.', on: appOn, disabled: !prefs.ready, toggle: () => setMute('notif_mute_all', appOn) },
    { name: '인연 알림', detail: '새로운 인연 · 호감 · 편지', on: datingOn, disabled: !appOn, toggle: () => setDating(!datingOn) },
    { name: '커뮤니티 알림', detail: '댓글 · 답글 · 프로필 교환', on: communityOn, disabled: !appOn || !prefs.ready, toggle: () => setMute('notif_mute_community', communityOn) },
  ];

  // 시안 알림 스위치는 줄 오른쪽 끝에서 8 안쪽(.fx-switch margin-right 8)
  const sw = (r: (typeof rows)[number]) => <View style={{ marginRight: 8 }}><Switch value={r.on} disabled={r.disabled} accessibilityLabel={r.name} onChange={r.toggle} /></View>;
  return (
    <Screen title="알림 설정" onBack={nav.back}>
      <Card><Row kind="group" first label="전체 알림" sub="모든 알림을 한 번에 켜거나 꺼요." right={sw(rows[0])} /></Card>
      <Card style={{ marginTop: 12 }}>
        <Row kind="group" first label={rows[1].name} sub={rows[1].detail} right={sw(rows[1])} />
        <Row kind="group" label={rows[2].name} sub={rows[2].detail} right={sw(rows[2])} />
      </Card>
      <Card style={{ marginTop: 12 }}>
        <Row kind="icon" label="기기 알림 권한" value={perm === 'granted' ? '허용' : perm === 'denied' ? '차단' : '확인 필요'} onPress={() => { void check(); }} />
      </Card>
      {/* 권한이 꺼져 있으면 기기 설정도 확인하라고 한 줄 더 */}
      {perm === 'denied' && (
        <Sub style={{ marginTop: 12 } as any}>{Platform.OS === 'web' ? '알림 권한이 꺼져 있어요. 브라우저의 사이트 설정에서 알림을 허용할 수 있어요.' : '알림 권한이 꺼져 있어요. 휴대폰의 알림 권한도 확인해주세요.'}</Sub>
      )}
      <Sub style={{ marginTop: 12 } as any}>푸시만 꺼지고, 앱 안 알림 목록에는 그대로 남아요.</Sub>
    </Screen>
  );
}

// ── 설정 · 도움말 ─────────────────────────────────────────
const Line = () => <View style={{ marginHorizontal: 16, height: 1, backgroundColor: colors.line }} />;

export function SettingsScreen({ nav }: { nav: MyNav }) {
  return (
    <Screen title="설정 · 도움말" onBack={nav.back}>
      <Card>
        <Row kind="group" first label="계정 관리" onPress={() => nav.push('myAccount')} />
        <Row kind="group" label="차단 관리" onPress={() => nav.push('myBlocks')} />
      </Card>
      <Card style={{ marginTop: 12 }}>
        <Row kind="group" first label="문의하기" onPress={() => nav.push('myInquiry')} />
        <Row kind="group" label="약관 · 개인정보 안내" onPress={() => nav.push('myTerms')} />
      </Card>
    </Screen>
  );
}

// 로그아웃 — 서버 로그아웃 + 로컬 정리(signedOut=true → 다음 렌더에서 로그인 화면)
async function signOutNow() {
  try {
    if (!PREVIEW) await signOut();
    previewActions.signOutPreview();
  } catch (e: any) {
    if (Platform.OS === 'web') window.alert('로그아웃 실패: ' + (e?.message || ''));
    else Alert.alert('실패', e?.message || '다시 시도해 주세요');
  }
}

export function AccountScreen({ nav }: { nav: MyNav }) {
  const { resting } = useResting();
  const [logout, setLogout] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Screen title="계정 관리" onBack={nav.back}>
      <Card>
        <Row kind="group" first label="닉네임 변경" onPress={() => nav.push('myNickname')} />
        <Row kind="group" label={resting ? '인연 다시 시작하기' : '인연 쉬어가기'} onPress={() => nav.push('myVisibility')} />
      </Card>
      <Card style={{ marginTop: 12 }}>
        <Row kind="group" first label="로그아웃" onPress={() => setLogout(true)} />
        <Row kind="group" label="회원 탈퇴" onPress={() => nav.push('myWithdraw')} />
      </Card>
      <ConfirmSheet open={logout} onClose={() => setLogout(false)} title="로그아웃할까요?" confirmLabel="로그아웃" loading={busy} onConfirm={async () => { setBusy(true); try { await signOutNow(); } finally { setBusy(false); setLogout(false); } }} />
    </Screen>
  );
}

// 닉네임 변경 — 무료. 규칙은 가입·프로필 수정과 같다(nicknameError)
export function NicknameScreen({ nav }: { nav: MyNav }) {
  const profile = usePreview(previewSelectors.myProfile);
  const [nick, setNick] = useState(profile.nickname ?? '');
  const [busy, setBusy] = useState(false);
  const name = nick.trim();
  const err = name ? nicknameError(name) : null;
  const ok = !!name && !err && name !== profile.nickname;
  async function save() {
    if (!ok || busy) return;
    setBusy(true);
    const prev = profile.nickname;
    previewActions.updateMyProfile({ nickname: name });
    try {
      await updateUserProfileServer({ nickname: name });
      previewActions.showToast('닉네임을 바꿨어요');
      nav.back();
    } catch {
      previewActions.updateMyProfile({ nickname: prev });
      previewActions.showToast('닉네임을 바꾸지 못했어요. 잠시 후 다시 시도해주세요', 2400);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="닉네임 변경" onBack={nav.back} gnb={false} dock={<DockArea note={err ?? undefined}><Button size="sheet" block label="저장하기" disabled={!ok} loading={busy} onPress={save} /></DockArea>}>
      <Sub>인연 프로필과 편지에 보이는 이름이에요.</Sub>
      <GroupTitle top={20}>닉네임</GroupTitle>
      <CfInput value={nick} onChangeText={(v) => setNick(v.slice(0, NICKNAME_MAX))} maxLength={NICKNAME_MAX} autoFocus placeholder="닉네임" accessibilityLabel="닉네임" returnKeyType="done" onSubmitEditing={save} />
    </Screen>
  );
}

// 차단 관리(시안 §8.3) — 차단한 사람 목록 · 차단 해제(누르면 바로 해제 + 토스트) + 숨긴 인연 관리.
// 이름은 인연에서 이미 아는 사람만 보인다(0186 my_blocks) — 익명 이야기에서 차단한 사람은 "익명 이야기에서 차단" + 날짜
const blockDate = (iso: string) => { const d = new Date(new Date(iso).getTime() + 9 * 3600_000); return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`; };
export function BlocksScreen({ nav }: { nav: MyNav }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['my-blocks', getCurrentUserId()], queryFn: fetchMyBlocks, enabled: !!getCurrentUserId() });
  const [busy, setBusy] = useState<string | null>(null);
  async function unblock(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      await unblockUser(id);
      qc.setQueryData(['my-blocks', getCurrentUserId()], (rows: BlockRow[] | undefined) => (rows ?? []).filter((r) => r.blocked_id !== id));
      // 차단이 풀리면 글·인연 목록에 다시 보인다
      for (const k of ['lounge', 'lounge-post', 'lounge-comments', 'friend-profiles', 'my-deck', 'blocked-ids']) qc.invalidateQueries({ queryKey: [k], refetchType: 'all' });
      previewActions.showToast('차단을 해제했어요.');
    } catch {
      previewActions.showToast('잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(null);
    }
  }
  const rows = q.data ?? [];
  return (
    <Screen title="차단 관리" onBack={nav.back}>
      {rows.length ? (
        <Card>
          {rows.map((r, i) => (
            <Row
              key={r.blocked_id}
              kind="group"
              first={i === 0}
              label={r.nickname ?? `익명 이야기에서 차단 · ${blockDate(r.created_at)}`}
              right={(
                <UndoLink label="차단 해제" onPress={() => unblock(r.blocked_id)} disabled={!!busy} dim={busy === r.blocked_id} a11y={`${r.nickname ?? '이 사용자'} 차단 해제`} />
              )}
            />
          ))}
        </Card>
      ) : (
        <EmptyLine>{q.isLoading ? '불러오는 중이에요.' : '차단한 사용자가 없어요.'}</EmptyLine>
      )}
      {/* 목록 카드 아래는 카드 사이 12, 빈 줄(14/21) 아래는 20 */}
      <Card style={{ marginTop: rows.length ? 12 : 20 }}>
        <Row kind="group" first label="숨긴 인연 관리" onPress={() => nav.push('myHidden')} />
      </Card>
    </Screen>
  );
}

// 줄 오른쪽 해제 글자(.nb-v) — 13 글자-연 + 4 + 꺾쇠 20
function UndoLink({ label, onPress, disabled, dim, a11y }: { label: string; onPress: () => void; disabled?: boolean; dim?: boolean; a11y?: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={a11y ?? label} hitSlop={8} style={{ minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 4, opacity: dim ? 0.5 : 1 }}>
      <Text style={{ fontSize: 13, lineHeight: 18, color: colors.mute }}>{label}</Text>
      <Icon name="chevron-right" size={20} color={colors.mute} />
    </Pressable>
  );
}

// 숨긴 인연 한 줄 — 이름은 기존 프로필 조회로
function HiddenRow({ id, first }: { id: string; first: boolean }) {
  const q = useFriendProfile(id);
  return (
    <Row
      kind="group"
      first={first}
      label={q.data?.nickname ?? (q.isLoading ? '불러오는 중' : '알 수 없는 회원')}
      right={(
        <UndoLink label="숨김 해제" onPress={() => { unhideProfile(id); previewActions.showToast('숨김을 해제했어요.'); }} />
      )}
    />
  );
}
export function HiddenScreen({ nav }: { nav: MyNav }) {
  const hidden = [...useHiddenIds()];
  return (
    <Screen title="숨긴 인연" onBack={nav.back}>
      {hidden.length ? <Card>{hidden.map((id, i) => <HiddenRow key={id} id={id} first={i === 0} />)}</Card> : (
        // 빈 상태(.fx-empty) — 가운데 15/27 글자-연, 위아래 40
        <View style={{ paddingVertical: 40, paddingHorizontal: 15 }}>
          <Text style={{ fontSize: 15, lineHeight: 27, color: colors.mute, textAlign: 'center' }}>숨긴 인연이 없어요.</Text>
        </View>
      )}
    </Screen>
  );
}

// 문의하기 — 5자 이상 적으면 메일 앱으로 운영팀 주소에 보낸다
const ASK_MAX = 2000;
const ASK_MIN = 5;
export function InquiryScreen({ nav }: { nav: MyNav }) {
  const [text, setText] = useState('');
  const [focus, setFocus] = useState(false);
  function send() {
    if (text.trim().length < ASK_MIN) { previewActions.showToast('5자 이상 입력해주세요.'); return; }
    const url = `mailto:${CONTACT}?subject=${encodeURIComponent('[야화] 문의')}&body=${encodeURIComponent(text.trim())}`;
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.href = url;
    else Linking.openURL(url).catch(() => previewActions.showToast(`${CONTACT}로 메일을 보내주세요`, 2600));
    nav.back();
  }
  return (
    <Screen title="문의하기" onBack={nav.back}>
      <GroupTitle top={0} bottom={15}>문의 내용</GroupTitle>
      <View style={{ height: 200, borderRadius: radius.field, backgroundColor: focus ? colors.surface : colors.bgSoft }}>
        {focus && <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius.field, borderWidth: 1.5, borderColor: colors.inverseStrong }} />}
        <TextInput
          value={text}
          onChangeText={(v) => setText(v.slice(0, ASK_MAX))}
          multiline
          maxLength={ASK_MAX}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder="궁금한 점이나 불편했던 점을 적어 주세요"
          placeholderTextColor={colors.mute}
          accessibilityLabel="문의 내용"
          style={[{ flex: 1, paddingVertical: 14, paddingHorizontal: 16, fontSize: 15, lineHeight: 24, color: colors.text, textAlignVertical: 'top' }, WEB_NO_OUTLINE]}
        />
      </View>
      <Button size="dock" style={{ marginTop: 29 }} label="문의 보내기" onPress={send} />
      <Sub style={{ marginTop: 12 } as any}>보내기를 누르면 메일 앱이 열려요.</Sub>
    </Screen>
  );
}

// 약관 · 개인정보 — 문서는 각 주소(/terms · /privacy · /child-safety)의 화면으로 연다
export function TermsScreen({ nav }: { nav: MyNav }) {
  const appVersion = Constants.expoConfig?.version ?? '';
  const open = (path: string) => router.push(path as never);
  return (
    <Screen title="약관 및 개인정보" onBack={nav.back}>
      <Card>
        <Row kind="group" first label="이용약관" onPress={() => open('/terms')} />
        <Row kind="group" label="개인정보처리방침" onPress={() => open('/privacy')} />
        <Row kind="group" label="아동 안전" onPress={() => open('/child-safety')} />
      </Card>
      <Text style={{ marginTop: 12, fontSize: 12, lineHeight: 18, color: colors.mute }}>{appVersion ? `앱 버전 ${appVersion} · ` : ''}야화컴퍼니(주)</Text>
    </Screen>
  );
}

// 회원 탈퇴 — 안내 + 남은 재화 줄(→ 안내 시트) + 아래 고정 위험색 버튼 → 마지막 확인 시트
export function WithdrawScreen({ nav }: { nav: MyNav }) {
  const leaf = usePreview(previewSelectors.leafBalance);
  const points = usePreview(previewSelectors.points);
  const [info, setInfo] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  async function handleDelete() {
    setBusy(true);
    try {
      if (!PREVIEW) await deleteAccount();
      previewActions.deleteAccountPreview();
    } catch (e: any) {
      if (Platform.OS === 'web') window.alert('삭제 실패: ' + (e?.message || ''));
      else Alert.alert('실패', e?.message || '다시 시도해 주세요');
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }
  return (
    <Screen title="회원 탈퇴" onBack={nav.back} gnb={false} dock={<DockArea><Button size="sheet" block variant="danger" label="탈퇴하기" onPress={() => setConfirm(true)} /></DockArea>}>
      <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.text }}>탈퇴하면 프로필과 계정 정보가 삭제돼요.</Text>
      <Sub style={{ marginTop: 8 } as any}>카카오 연결도 함께 해제되고, 남은 리프와 포인트도 사라져요. 삭제한 계정은 다시 복구할 수 없어요.</Sub>
      <Card style={{ marginTop: 20 }}>
        <Row kind="icon" label="남은 리프 · 포인트" value={`${leaf.toLocaleString()}리프 · ${points.toLocaleString()}P`} onPress={() => setInfo(true)} />
      </Card>
      <BottomSheet open={info} onClose={() => setInfo(false)}>
        <SheetHeader title="탈퇴 재화 안내" desc="탈퇴하면 남은 리프와 매장 포인트가 모두 사라지고, 다시 가입해도 돌아오지 않아요. 결제 취소·환불은 관련 법령과 각 앱마켓의 정책에 따라요." />
        <Button size="sheet" block label="확인" onPress={() => setInfo(false)} />
      </BottomSheet>
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} danger title="정말 탈퇴하시겠어요?" desc="삭제한 계정은 복구할 수 없어요." confirmLabel="탈퇴하기" loading={busy} onConfirm={handleDelete} />
    </Screen>
  );
}
