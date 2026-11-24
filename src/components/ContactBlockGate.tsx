// 야화 — 지인 차단(연락처 해시) 동의 게이트 + 상태 표시.
// · ContactBlockConsentModal: 첫 진입 시 동의를 묻는 시트. 불러오기가 끝나면 시트가 닫히지 않고
//   "지인 차단 켜짐 · 연락처 N개를 반영했어요" 성공 상태로 바뀌어 [확인]으로 닫는다.
//   휴대폰 권한을 거부하면 시트 안에서 [설정 열기]로 안내하고, 설정에서 허용하고 돌아오면 다시 불러오기를 권한다.
// · ContactBlockStatusCard: 켜짐(초록 방패) / 꺼짐(회색 방패) 상태 카드 — 시트 성공 상태 · MY › 지인 차단 화면이 같이 쓴다.
// · 숫자는 늘 "연락처 N개"(올린 번호 개수) — 가입해 가려진 사람 수는 알 수 없고 보여 주지도 않는다.
// 오늘의 인연(홈)이 1차 진입점. 가입 환영 쿠폰 팝업이 있으면 그걸 닫은 뒤에 시트가 올라온다(homeSheetBlock).
import React from 'react';
import { View, Text, Pressable, Platform, Alert, AppState, Linking } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Contacts from 'expo-contacts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, shadow } from '../tokens';
import { Icons } from '../icons';
import { BottomSheet, SheetButtons, SheetHeader, T } from '../ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getSessionUser } from '../lib/supabase';
import { previewActions } from '../lib/previewStore';
import { getContactBlockConsent, declineContactBlock, syncContactBlocks, type ContactConsent } from '../lib/contacts';
import { useHomeSheetBlocked } from '../lib/homeSheetBlock';
import { pressFx } from '../lib/press';

// ── 상태 훅 — 동의 여부 + 차단된 연락처 수 + 마지막 동기화 시각 ────────────────
export type ContactBlockStatus = {
  consent: ContactConsent;
  count: number;
  syncedAt: string | null;
};

export function useContactBlockStatus() {
  return useQuery<ContactBlockStatus>({
    queryKey: ['contact-block-status'],
    enabled: Platform.OS !== 'web',
    queryFn: async () => {
      const consent = await getContactBlockConsent().catch(() => 'declined' as const);
      if (consent !== 'granted') return { consent, count: 0, syncedAt: null };
      const user = await getSessionUser();
      if (!user) return { consent: 'declined', count: 0, syncedAt: null };
      const [{ count }, { data: u }] = await Promise.all([
        (supabase as any).from('contact_blocks').select('phone_hash', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('users').select('contact_sync_at' as any).eq('id', user.id).maybeSingle(),
      ]);
      return { consent, count: count ?? 0, syncedAt: ((u as any)?.contact_sync_at as string) ?? null };
    },
    staleTime: 60_000,
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return ''; }
}

// ── 연락처 불러오기(동의 + 동기화) — MY › 지인 차단 화면과 동의 시트가 같이 쓴다 ─────────
// 시트는 결과를 자기 안에서 보여 주므로 toast: false · onDenied로 권한 거부 안내를 직접 띄운다.
export function useContactBlockSync(opts?: { onDone?: (count: number) => void; onDenied?: () => void; toast?: boolean }) {
  const qc = useQueryClient();
  const [syncing, setSyncing] = React.useState(false);
  const sync = async () => {
    // 웹은 연락처를 읽을 수 없다
    if (Platform.OS === 'web') { previewActions.showToast('지인 차단은 모바일 앱에서 켤 수 있어요.', 2400); return; }
    setSyncing(true);
    try {
      const r = await syncContactBlocks();
      if (r.ok) {
        if (opts?.toast !== false) previewActions.showToast(`연락처 ${r.count.toLocaleString()}개를 반영했어요`);
        // 차단 즉시 반영 — 리스트가 비활성이어도(다른 탭 뒤) 캐시를 새로 채워 되돌아올 때 최신.
        qc.invalidateQueries({ queryKey: ['contact-block-status'] });
        qc.invalidateQueries({ queryKey: ['friend-profiles'], refetchType: 'all' });
        qc.invalidateQueries({ queryKey: ['my-deck'], refetchType: 'all' });
        qc.invalidateQueries({ queryKey: ['friend-profile'], refetchType: 'all' });
        qc.invalidateQueries({ queryKey: ['feed'], refetchType: 'all' });
        opts?.onDone?.(r.count);
      } else if (r.reason === 'permission') {
        if (opts?.onDenied) opts.onDenied();
        else Alert.alert('연락처 권한이 필요해요', '기기 설정에서 야화의 연락처 접근을 허용하면 지인 차단을 켤 수 있어요.');
      }
    } catch {
      Alert.alert('잠시 후 다시 시도해주세요', '지인 차단 설정 중 문제가 생겼어요.');
    } finally {
      setSyncing(false);
    }
  };
  return { syncing, sync };
}

// ── 방패 배지 · 상태 카드 — 켜짐: 초록 원 + 흰 방패 체크 / 꺼짐: 회색 원 + 회색 방패 ─────────
function ShieldBadge({ on }: { on: boolean }) {
  const stroke = on ? colors.inverse : colors.sub;
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.success : colors.control }}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M12 3 5 6v5.5c0 4.3 2.9 7.9 7 9.5 4.1-1.6 7-5.2 7-9.5V6l-7-3Z" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" />
        {on && <Path d="m8.8 12.2 2.3 2.3 4.2-4.4" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
      </Svg>
    </View>
  );
}

// 상태 카드(높이 68: 위아래 14 + 배지 40). flat = 회색 바탕(시트 안 · 꺼짐), 아니면 흰 바탕 + 테두리 + 그림자(화면 위 켜짐)
// right(업데이트 버튼 등)는 세로 가운데 — 공용 Button은 기본이 alignSelf 'flex-start'라 줄 위쪽에 붙으므로 여기서 가운데로 바로잡는다
export function ContactBlockStatusCard({ on, sub, right, flat }: { on: boolean; sub: string; right?: React.ReactNode; flat?: boolean }) {
  return (
    <View
      accessibilityLabel={`지인 차단 ${on ? '켜짐' : '꺼짐'}, ${sub}`}
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingLeft: 16, paddingRight: right ? 14 : 16, borderRadius: 18 },
        flat ? { backgroundColor: colors.bgSoft } : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, ...shadow.note },
      ]}
    >
      <ShieldBadge on={on} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.text }}>{on ? '지인 차단 켜짐' : '지인 차단 꺼짐'}</Text>
        <Text style={{ marginTop: 2, fontSize: 12.5, lineHeight: 18, color: colors.mute }}>{sub}</Text>
      </View>
      {!!right && <View style={{ alignSelf: 'center' }}>{right}</View>}
    </View>
  );
}

// ── 동의 시트 — 인연 첫 진입 자동 안내 · 마이(예전) 화면에서 연다 ─────────
// 단계: ask(묻기) → [연락처 불러오기] → 권한 허용 → done(성공 상태, [확인]) / 거부 → denied([설정 열기])
//   → 설정에서 허용하고 앱으로 돌아오면 allowed(다시 불러오기 권함)
type ConsentPhase = 'ask' | 'denied' | 'allowed' | 'done';
export function ContactBlockConsentModal({
  visible, onClose, title = '지인 차단',
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
}) {
  const statusQ = useContactBlockStatus();
  const web = Platform.OS === 'web';
  const on = statusQ.data?.consent === 'granted';
  const [phase, setPhase] = React.useState<ConsentPhase>('ask');
  const [doneCount, setDoneCount] = React.useState(0);
  const { syncing, sync } = useContactBlockSync({
    toast: false,
    onDone: (n) => { setDoneCount(n); setPhase('done'); },
    onDenied: () => setPhase('denied'),
  });
  // 다시 열 때마다 처음 단계부터
  React.useEffect(() => { if (visible) setPhase('ask'); }, [visible]);
  // 권한 거부 안내 중 — 설정에서 허용하고 돌아오면 다시 불러오기를 권한다
  React.useEffect(() => {
    if (phase !== 'denied' || web) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      Contacts.getPermissionsAsync().then((p) => { if (p.status === 'granted') setPhase('allowed'); }).catch(() => {});
    });
    return () => sub.remove();
  }, [phase, web]);
  // 켜기 전에 닫으면 '나중에'로 기록(첫 진입 자동 안내가 다시 뜨지 않게). 켠 뒤(done)에는 그냥 닫는다
  const decline = () => {
    if (phase !== 'done' && !on && !web) void declineContactBlock();
    onClose();
  };
  return (
    <BottomSheet open={visible} onClose={decline} dismissable={!syncing}>
      {phase === 'done' ? (
        <>
          <ContactBlockStatusCard on flat sub={`연락처 ${doneCount.toLocaleString()}개를 반영했어요`} />
          <T v="sheetBody" style={{ marginTop: 16, marginBottom: 20 }}>이제 연락처 속 지인과는 서로 소개되지 않아요. 연락처가 바뀌면 마이페이지 › 지인 차단에서 업데이트할 수 있어요.</T>
          <SheetButtons confirmLabel="확인" onConfirm={onClose} />
        </>
      ) : phase === 'denied' ? (
        <>
          <SheetHeader title="연락처 접근이 꺼져 있어요" desc="휴대폰 설정 › 야화 › 연락처에서 허용하면 지인 차단을 켤 수 있어요. 원본 번호는 저장하지 않아요." />
          <SheetButtons cancelLabel="나중에" onCancel={decline} confirmLabel="설정 열기" onConfirm={() => { void Linking.openSettings(); }} />
        </>
      ) : (
        <>
          <SheetHeader
            title={title}
            desc={phase === 'allowed'
              ? '연락처 접근이 허용됐어요. 불러오기를 눌러 마무리해 주세요.'
              : '내 휴대폰 연락처의 지인이 인연에서 나를 찾지 않도록 해요. 연락처는 기기에서 암호화된 값만 전송되고, 원본 전화번호는 서버에 저장되지 않아요.'}
          />
          <SheetButtons cancelLabel="나중에" onCancel={decline} confirmLabel={on ? '다시 불러오기' : '연락처 불러오기'} loading={syncing} onConfirm={() => { void sync(); }} />
        </>
      )}
    </BottomSheet>
  );
}

// ── 상태 줄 — 켜짐/꺼짐을 항상 노출. 꺼짐이면 탭해서 켜기 ─────────────────────
export function ContactBlockStatusPill() {
  const statusQ = useContactBlockStatus();
  const [modalOpen, setModalOpen] = React.useState(false);
  if (Platform.OS === 'web' || !statusQ.data) return null;
  const { consent, count, syncedAt } = statusQ.data;
  const on = consent === 'granted';

  return (
    <>
      <Pressable
        onPress={() => {
          if (on) {
            Alert.alert(
              '지인 차단 켜짐',
              `연락처 ${count.toLocaleString()}개 번호가 숨김 처리돼 있어요.\n마지막 동기화: ${fmtDate(syncedAt) || '방금'}\n\n연락처가 바뀌었다면 다시 동기화할 수 있어요.`,
              [
                { text: '닫기', style: 'cancel' },
                { text: '다시 동기화', onPress: () => setModalOpen(true) },
              ],
            );
          } else {
            setModalOpen(true);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={on ? '지인 차단 켜짐' : '지인 차단 켜기'}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 8,
          minHeight: 44, paddingHorizontal: 14, paddingVertical: 10,
          backgroundColor: colors.bgSoft,
          borderRadius: 12,
          ...pressFx(pressed),
        })}
      >
        <Icons.shield size={15} color={on ? colors.success : colors.mute} stroke={1.5} />
        <Text style={{ flex: 1, fontSize: 11.5, fontWeight: on ? '600' : '400', color: on ? colors.text : colors.sub }} numberOfLines={1}>
          {on
            ? `지인 차단 켜짐 · 연락처 ${count.toLocaleString()}개 숨김`
            : '지인 차단 꺼짐 — 아는 사람이 내 프로필을 볼 수 있어요'}
        </Text>
        {!on && (
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.actionSoft }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.action }}>켜기</Text>
          </View>
        )}
      </Pressable>
      <ContactBlockConsentModal visible={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

// ── 첫 진입 자동 안내 — consent가 unknown일 때 1회 모달 (오늘의 친구 진입 시) ──
// 자동 재동기화는 앱 실행당 한 번, 그리고 하루(KST) 한 번까지 — 덱이 다시 붙을 때마다(프로필을 보고 돌아올 때마다)
// 연락처 전체를 읽고 번호마다 해시·업로드하던 것을 막는다. 동의(granted)는 한 번 확인되면 다시 묻지 않는다.
let resyncRanFor: string | null = null;
let grantedFor: string | null = null;
const RESYNC_DAY_KEY = (uid: string) => `yahwa.contactBlock.resyncDay:${uid}`;
const kstDayStr = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

export function ContactBlockAutoPrompt() {
  const qc = useQueryClient();
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS === 'web') return;
    let alive = true;
    (async () => {
      const uid = (await getSessionUser().catch(() => null))?.id ?? null;
      if (!uid || resyncRanFor === uid) return;
      const consent = grantedFor === uid ? 'granted' as const : await getContactBlockConsent().catch(() => 'declined' as const);
      if (!alive) return;
      if (consent === 'unknown') {
        setVisible(true);
      } else if (consent === 'declined') {
        resyncRanFor = uid;  // '나중에'를 고른 회원 — 이번 실행 동안 다시 묻지 않는다(모달도 안 뜨는 상태)
      } else if (consent === 'granted') {
        grantedFor = uid;
        resyncRanFor = uid;
        const today = kstDayStr();
        const last = await AsyncStorage.getItem(RESYNC_DAY_KEY(uid)).catch(() => null);
        if (last === today) return;
        // 재진입 — 조용히 최신 연락처로 재동기화 (새로 저장된 지인 반영). 연락처가 그대로면 올리지 않는다
        const r = await syncContactBlocks({ skipIfUnchanged: true }).catch(() => null);
        if (r?.ok) AsyncStorage.setItem(RESYNC_DAY_KEY(uid), today).catch(() => {});
        // 새 번호가 올라갔을 때만 다시 받는다(보이는 화면만 — 숨은 화면은 붙을 때 새로 받는다)
        if (r?.ok && r.changed) {
          qc.invalidateQueries({ queryKey: ['friend-profiles'] });
          qc.invalidateQueries({ queryKey: ['my-deck'] });
          qc.invalidateQueries({ queryKey: ['feed'] });
          qc.invalidateQueries({ queryKey: ['contact-block-status'] });
        }
      }
    })();
    return () => { alive = false; };
  }, [qc]);

  // 가입 환영 쿠폰 팝업을 확인하는 중이거나 떠 있으면 기다렸다가, 닫힌 뒤에 올린다
  const blocked = useHomeSheetBlocked();
  return <ContactBlockConsentModal visible={visible && !blocked} onClose={() => setVisible(false)} />;
}
