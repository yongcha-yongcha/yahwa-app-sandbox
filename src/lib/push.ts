// 야화 — 푸시 알림 (Expo Notifications + APNs/FCM)
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { registerPushToken, markServerNotifRead } from './api';
import { queryClient } from './query';

Notifications.setNotificationHandler({
  handleNotification: async (n) => {
    // 지금 보고 있는 채팅방의 새 메시지는 배너를 띄우지 않는다(매 메시지마다 알림 방지)
    const data = (n.request.content.data ?? {}) as any;
    const show = !(data.kind === 'chat' && data.roomId && data.roomId === activeChatRoomId);
    return {
      // SDK 52 expo-notifications API — shouldShowAlert (신/구 키 모두 채워 호환)
      shouldShowAlert: show,
      shouldShowBanner: show,
      shouldShowList: show,
      shouldPlaySound: show,
      shouldSetBadge: true,
    } as Notifications.NotificationBehavior;
  },
});

// 푸시가 온(또는 눌린) 알림 종류에 맞춰 그 화면 데이터를 새로 받는다 —
// 화면이 언마운트돼 있어도 다시 열 때 옛 캐시가 보이지 않게 refetchType 'all'.
function refreshForPush(data: any) {
  const kind = String(data?.kind ?? '');
  const keys: unknown[][] = [['server-notifs']];
  if (kind === 'coupon' || data?.couponId) keys.push(['my-coupons']);
  if (kind.startsWith('credential_')) keys.push(['my-credentials']);
  if (data?.postId) keys.push(['lounge-comments', String(data.postId)], ['lounge-post', String(data.postId)]);
  if (kind === 'affinity' || kind.startsWith('interest') || kind.startsWith('connect_')) keys.push(['interests']);
  if (kind.startsWith('profile_exchange')) keys.push(['profile-exchanges'], ['exchanged-ids']);
  if (kind === 'chat' || kind.startsWith('gather')) keys.push(['chat-rooms-full']);
  if (data?.gatheringId) keys.push(['gathering', String(data.gatheringId)]);
  for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey, refetchType: 'all' });
}

function resolveProjectId(): string | null {
  return (
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    (Constants as any).easConfig?.projectId ||
    null
  );
}

// Android는 채널이 없으면 헤드업(배너) 알림이 뜨지 않는다.
// 앱 시작 시 1회 등록 — 권한 여부와 무관하게 미리 만들어 둔다.
export async function setupAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: '기본 알림',
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  } catch (e) {
    if (__DEV__) console.warn('[push] channel setup failed', e);
  }
}

export async function registerForPushNotifications() {
  if (Platform.OS === 'web') return null;  // 웹은 푸시 미사용 — 로그인 직후 브라우저 알림 권한 창이 뜨지 않게
  await setupAndroidChannel();
  if (!Device.isDevice) {
    if (__DEV__) console.warn('[push] simulator/emulator — skipping');
    return null;
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }
  if (final !== 'granted') return null;

  const projectId = resolveProjectId();
  if (!projectId) {
    if (__DEV__) console.warn('[push] no EAS projectId — set EAS_PROJECT_ID or EXPO_PUBLIC_EAS_PROJECT_ID');
    return null;
  }

  let token: string;
  try {
    const res = await Notifications.getExpoPushTokenAsync({ projectId });
    token = res.data;
  } catch (e) {
    if (__DEV__) console.warn('[push] token fetch failed', e);
    return null;
  }
  if (!token) return null;

  try {
    await registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
  } catch (e) {
    if (__DEV__) console.warn('[push] register failed', e);
  }
  return token;
}

// 인앱 수신 알림을 기기 알림으로도 표시 (네이티브 전용, 베스트에포트).
// 추후 서버발 원격 푸시(Edge Function)로 고도화 예정.
// 액션 완료 직후 "알림 켜기" 유도 — 승인/수락 결과가 푸시로만 전달되므로 필수 안내.
// 권한이 이미 있으면 조용히 토큰만 재등록, 없으면 요청 → 거부 상태면 설정 열기 안내.
export async function promptEnablePush(context: string): Promise<void> {
  if (Platform.OS === 'web') return;  // 웹은 푸시 미사용
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') {
      void registerForPushNotifications().catch(() => {});
      return;
    }
    const { Alert, Linking } = require('react-native');
    Alert.alert(
      '앱 알림을 꼭 켜주세요',
      `${context}
알림이 꺼져 있으면 결과를 알 수 없어요.`,
      [
        { text: '나중에', style: 'cancel' },
        {
          text: '알림 켜기',
          onPress: async () => {
            const r = await Notifications.requestPermissionsAsync().catch(() => null);
            if (r?.status === 'granted') {
              void registerForPushNotifications().catch(() => {});
            } else {
              // 시스템 팝업이 다시 안 뜨는 상태(이전에 거부) — 설정으로 안내
              Alert.alert('설정에서 켜주세요', '설정 > 알림 > 야화에서 알림을 허용해주세요.', [
                { text: '닫기', style: 'cancel' },
                { text: '설정 열기', onPress: () => { Linking.openSettings?.().catch(() => {}); } },
              ]);
            }
          },
        },
      ],
    );
  } catch { /* 안내 실패는 무해 */ }
}

// 현재 열려 있는 채팅방 — 그 방을 보는 중이면 푸시 배너를 띄우지 않는다.
// (ChatRoom이 마운트/언마운트 시 등록·해제, 위 setNotificationHandler가 참조)
let activeChatRoomId: string | null = null;
export function setActiveChatRoomId(roomId: string | null) { activeChatRoomId = roomId; }

// 알림 탭 응답 리스너 — kind/data 기반으로 적절한 화면으로 이동.
// onRoute 콜백: app/index.tsx의 overlay state setter를 받아서 라우팅.
export type PushRouteIntent =
  | { kind: 'chat'; roomId: string }
  | { kind: 'gather'; gatheringId: string }
  | { kind: 'connection'; otherUserId: string }
  | { kind: 'post'; postId: string }
  | { kind: 'exchanges' }
  | { kind: 'coupons' }
  | { kind: 'profileEdit' }
  | { kind: 'badges' }
  | { kind: 'letter'; letterId: string }
  | { kind: 'letters' }
  | { kind: 'letterFrom'; fromUserId: string }
  | { kind: 'notifications' };

// 앱을 보고 있을 때 도착한 푸시 — 종류만 알려 준다(편지 도착 팝업을 바로 띄우는 데 쓴다, 1013)
export function addPushReceivedListener(onKind: (kind: string) => void) {
  const sub = Notifications.addNotificationReceivedListener((n) => {
    const data = (n.request.content.data ?? {}) as any;
    refreshForPush(data);
    if (typeof data.kind === 'string') onKind(data.kind);
  });
  return () => sub.remove();
}

// 이미 처리한 알림 응답 — 같은 실행 중 재로그인하면 getLastNotificationResponseAsync가
// 예전 응답을 다시 돌려줘 그 화면으로 또 끌려가던 문제 방지(콜드 스타트 중복 호출도 함께 막는다)
const handledResponses = new Set<string>();

export function addPushResponseListener(onRoute: (intent: PushRouteIntent) => void) {
  // 콜드 스타트 — 푸시로 앱이 열린 경우의 최초 응답도 처리
  Notifications.getLastNotificationResponseAsync().then((resp) => {
    if (resp) handle(resp);
  }).catch(() => { /* ignore */ });

  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();

  function handle(resp: Notifications.NotificationResponse) {
    const rid = `${resp.notification.request.identifier}:${resp.notification.date}`;
    if (handledResponses.has(rid)) return;
    handledResponses.add(rid);
    const data = (resp.notification.request.content.data ?? {}) as any;
    const kind = data.kind as string | undefined;
    // 화면을 열기 전에 그 화면 데이터를 새로 받고, 누른 알림은 읽음으로
    refreshForPush(data);
    if (data.notification_id) {
      const id = String(data.notification_id);
      queryClient.setQueryData<{ id: string; read: boolean }[]>(['server-notifs'], (prev) => prev?.map((x) => (x.id === id ? { ...x, read: true } : x)));
      markServerNotifRead(id).catch(() => {}).finally(() => {
        void queryClient.invalidateQueries({ queryKey: ['server-notifs'], refetchType: 'all' });
      });
    }
    // 채팅은 gatheringId도 함께 실려오므로 gather 분기보다 먼저 봐야 한다.
    if (kind === 'chat' && data.roomId) {
      onRoute({ kind: 'chat', roomId: String(data.roomId) });
    } else if (kind === 'gather_matched' || kind === 'gather_approved' || kind === 'gather_request' || kind === 'follow_new_gathering') {
      if (data.gatheringId) onRoute({ kind: 'gather', gatheringId: String(data.gatheringId) });
      else onRoute({ kind: 'notifications' });
    } else if (kind === 'profile_exchange_request') {
      onRoute({ kind: 'exchanges' });
    } else if (kind === 'profile_exchange_accepted') {
      if (data.otherUserId) onRoute({ kind: 'connection', otherUserId: String(data.otherUserId) });
      else onRoute({ kind: 'exchanges' });
    } else if (kind === 'connect_approved' || kind === 'connect_request' || kind === 'affinity') {
      if (data.otherUserId) onRoute({ kind: 'connection', otherUserId: String(data.otherUserId) });
      else if (data.requesterId) onRoute({ kind: 'connection', otherUserId: String(data.requesterId) });
      else onRoute({ kind: 'notifications' });
    } else if (kind === 'credential_approved' || kind === 'credential_rejected') {
      // 학력·직장·소득 인증 결과(0157) — 뱃지 관리로
      onRoute({ kind: 'badges' });
    } else if (kind === 'profile_nudge' || kind === 'profile_suspended') {
      // 프로필 등록 유도(0141)·공개 중지(0139) — 프로필 작성/수정 화면으로
      onRoute({ kind: 'profileEdit' });
    } else if (kind === 'interest_message' && data.otherUserId) {
      // 예전 '메시지'(편지로 옮겨짐, 0151) — 보낸 사람의 편지를 도착 팝업으로
      onRoute({ kind: 'letterFrom', fromUserId: String(data.otherUserId) });
    } else if (kind === 'letter_arrived' || kind === 'letter_connected' || kind === 'letter_refunded') {
      // 편지(0146) — 도착·연결은 그 편지로, 환불 안내는 편지함으로
      if (data.letterId) onRoute({ kind: 'letter', letterId: String(data.letterId) });
      else onRoute({ kind: 'letters' });
    } else if (kind === 'coupon' || data.couponId) {
      onRoute({ kind: 'coupons' });
    } else if (data.postId) {
      onRoute({ kind: 'post', postId: String(data.postId) });
    } else {
      onRoute({ kind: 'notifications' });
    }
  }
}
