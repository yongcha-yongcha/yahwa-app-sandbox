// 야화 — 메인 진입점. 세션 → 화면 전환 state machine.
// 모임 채팅 — '모임' 탭 안 '채팅' 서브탭(0118). 인연(1:1)은 채팅 없이 인연 메시지로만.
import React, { useEffect, useMemo, useState } from 'react';
import { View, BackHandler, Platform, Alert, AppState } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Home } from '../src/screens/Home';
import { HeartBox } from '../src/screens/HeartBox';
import { LetterBox } from '../src/screens/LetterBox';
import { useNavDots } from '../src/lib/navDots';
import { GatherFeed, type GatherTabKey } from '../src/screens/Gather';
import { ChatRoom } from '../src/screens/ChatRoom';
import { Lounge } from '../src/screens/Lounge';
import { MyPage } from '../src/screens/MyPage';
import { MapScreen } from '../src/screens/MapScreen';
import { MyStack } from '../src/components/my/MyStack';
import { CredentialsScreen } from '../src/components/my/BadgeCredentials';
import { isMyScreen, MY_GNB, type MyNav, type MyScreen } from '../src/components/my/nav';
import { Splash, GuestStart } from '../src/screens/Onboarding';
import { SignUp } from '../src/screens/SignUp';
import { Charge } from '../src/screens/Charge';
import { GroupProfileEdit } from '../src/screens/GroupProfileEdit';
import { GroupProfileView } from '../src/screens/GroupProfileView';
import { MatchSuccess } from '../src/screens/MatchSuccess';
import { GatherDetail } from '../src/screens/GatherDetail';
import { LoungeDetail } from '../src/screens/LoungeDetail';
import { MyDetail, MyDetailMode } from '../src/screens/MyDetail';
import { Notifications } from '../src/screens/Notifications';
import { StoreDetail } from '../src/screens/StoreDetail';
import { StoreSocialingCreate } from '../src/screens/StoreSocialingCreate';
import { ProfileEdit } from '../src/screens/ProfileEdit';
import { CouponWallet } from '../src/screens/CouponWallet';
import { SignupCouponPopup } from '../src/components/SignupCouponPopup';
import { FriendDetail } from '../src/screens/FriendDetail';
import { LetterCompose } from '../src/screens/LetterCompose';
import { LetterDetail } from '../src/screens/LetterDetail';
import { MatchPrefs } from '../src/screens/MatchPrefs';
import { LetterArrivedPopup } from '../src/components/LetterArrivedPopup';
import { LeafConversionPopup } from '../src/components/LeafConversionPopup';
import { ProfileGate } from '../src/components/entry/ProfileGate';
import { RegionRecheck } from '../src/components/entry/RegionRecheck';
import { regionNeedsRecheck } from '../src/components/entry/profileOptions';
import { SuspendedCard } from '../src/components/affinity/HomeCards';
import { useMyLetters, letterState } from '../src/lib/letters';
import { registerAppNav, type AppNavTarget } from '../src/lib/appNav';
import { prefetchMissions } from '../src/lib/missions';
import { AffinityFriends } from '../src/screens/AffinityFriends';
import { LadderGame } from '../src/screens/LadderGame';
import { StoreVisits } from '../src/screens/StoreVisits';
import { SpendHistory } from '../src/screens/SpendHistory';
import { SettlementInfoForm } from '../src/screens/SettlementInfoForm';
import { FollowingHosts } from '../src/screens/FollowingHosts';
import { ProfileExchanges } from '../src/screens/ProfileExchanges';
import { MySocialings } from '../src/screens/MySocialings';
import { Gnb, useTabBarClearance, type GnbTab } from '../src/ui';
import { KeepTabs } from '../src/components/KeepAlive';
import { ScreenStack } from '../src/components/ScreenMotion';
import { colors } from '../src/tokens';
import { signOut } from '../src/lib/auth';
import { useSession } from '../src/lib/useSession';
import { useAuthHold } from '../src/lib/authHold';
import { setHomeSheetBlocked } from '../src/lib/homeSheetBlock';
import { markChatRoomSeen } from '../src/lib/hooks';
import { supabase } from '../src/lib/supabase';
import { fetchMe, grantCouponByTitle, claimSignupCoupon, fetchSignupGrantedCoupon, touchActiveDay, type LetterRow } from '../src/lib/api';
import { syncTaghirePoints } from '../src/lib/pointsSync';
import { usePreview, previewSelectors, previewActions } from '../src/lib/previewStore';
import { refreshVisibleQueriesSoon, queryClient } from '../src/lib/query';
import { runBackOverrides } from '../src/lib/backHandler';
import { setReloadSafe } from '../src/lib/useOtaUpdate';
import { prefetchStoreThumbs } from '../src/lib/prefetchImages';
import { registerDemoNav, reportDemoScreen } from '../src/demo/bridge';

const PREVIEW_FROM_ENV = process.env.EXPO_PUBLIC_PREVIEW_MODE === '1';
import { configureIAP, bindIAPUser, unbindIAPUser } from '../src/lib/iap';
import { registerForPushNotifications, addPushResponseListener, addPushReceivedListener } from '../src/lib/push';

// 하단 메뉴(리뉴얼 1120, 시안 그대로): 인연 홈 / 마음함 / 편지함 / 커뮤니티 / MY. 플레이스는 MY 아래 겹쳐 여는 화면('place').
// 'gather'(모임)는 하단 메뉴에 없는 숨은 탭 — 기능 잠시 중단.
type TabKey = 'gather' | GnbTab;
const TAB_ORDER: TabKey[] = ['gather', 'affinity', 'heart', 'letters', 'lounge', 'me'];
// 숨겨 두는 탭(KeepAlive) — 모임은 탭에 없어 예전처럼 그때그때 그린다.
const keepTab = (k: TabKey) => k !== 'gather';
// 겹쳐 연 화면 중 하단 메뉴가 계속 떠 있는 화면 → 켜 둘 칸(null = 어느 칸도 켜지 않음, 쿠폰함 계열).
// 여기에 넣은 화면은 스크롤 영역 아래를 useTabBarClearance()만큼 비워야 한다. 아직 옮긴 화면이 없어 비어 있다(영역 담당이 채운다).
const OVERLAY_GNB: Partial<Record<Exclude<Overlay, null>, GnbTab | null>> = { notifications: 'lounge', profileExchanges: 'lounge', friendDetail: 'affinity', ...MY_GNB };
// 아직 새 디자인으로 옮기지 않은 탭 화면 — 떠 있는 하단 메뉴에 내용이 가리지 않게 화면 아래를 메뉴 높이만큼 줄여 둔다.
// 화면을 새로 그리면서 useTabBarClearance()로 직접 비우게 되면 여기서 뺀다.
const LEGACY_TAB_PAD: Partial<Record<TabKey, boolean>> = { gather: true };
function LegacyTabPad({ children }: { children: React.ReactNode }) {
  const pad = useTabBarClearance(0);
  return <View style={{ flex: 1, paddingBottom: pad }}>{children}</View>;
}
// 웹 주소 ?tab=… 로 처음 열 화면(공유 링크·확인용) — 하단 메뉴 탭 이름 또는 map(플레이스)
function initialDeepLink(): { tab: TabKey; place: boolean } {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return { tab: 'affinity', place: false };
  const t = new URLSearchParams(window.location.search).get('tab');
  if (t === 'map' || t === 'place') return { tab: 'affinity', place: true };
  return { tab: t === 'heart' || t === 'letters' || t === 'lounge' || t === 'me' ? t : 'affinity', place: false };
}
// 이 시각 이후 가입한 회원은 가입 직후 인연 프로필 등록이 필수(1010). 배포 시점에 맞춰 조정.
const PROFILE_REQUIRED_SINCE = '2026-10-09T15:00:00';  // = 2026-10-10 00:00 KST (created_at은 UTC 문자열)
type Overlay =
  | null
  | 'chatRoom'
  | 'charge'
  | 'groupProfileEdit'
  | 'groupProfile'
  | 'match'
  | 'gatherDetail'
  | 'loungeDetail'
  | 'myDetail'
  | 'notifications'
  | 'storeDetail'
  | 'storeSocialingCreate'
  | 'profileEdit'
  | 'couponWallet'
  | 'friendDetail'
  | 'affinityFriends'
  | 'miniGame'
  | 'badgeManage'
  | 'storeVisits'
  | 'spendHistory'
  | 'settlementInfo'
  | 'mySocialings'
  | 'followingHosts'
  | 'profileExchanges'
  | 'profileGate'
  | 'letterCompose'
  | 'letterDetail'
  | 'matchPrefs'
  | 'place'
  | MyScreen;  // MY 아래에 쌓이는 화면들(src/components/my/nav)

export default function Index() {
  const { session, loading } = useSession();
  // 숨겨 둔 탭 화면(KeepAlive)을 새로 그릴 기준 계정 — 세션이 바뀐 뒤 useSession이 활성 사용자(getCurrentUserId)를
  // 바꾸고 나서 따라 바꾼다(이펙트 순서). 세션 값을 바로 쓰면 탭 화면이 이전 계정 id를 읽은 채로 새로 그려진다.
  const [tabsUid, setTabsUid] = useState<string | null>(null);
  useEffect(() => { if (!loading) setTabsUid(session?.user.id ?? null); }, [session?.user.id, loading]);
  // 플레이스 매장 사진 미리받기 — 로그인 회원만(첫 화면 덱 사진과 겹치지 않게 늦게 시작한다)
  useEffect(() => { if (session?.user.id) prefetchStoreThumbs(); }, [session?.user.id]);
  // 첫 탭 = 인연(대표 지시 1007: 중요도 인연 > 커뮤니티 > 플레이스, 모임은 잠시 중단)
  const deepLink = React.useRef(initialDeepLink()).current;
  const [tab, setTab] = useState<TabKey>(deepLink.tab);
  // 인연 탭은 인연 프로필을 완성해야 들어갈 수 있다(대표 지시 1003) — 완성 후 탭으로 이어간다
  const [gateToAffinity, setGateToAffinity] = useState(false);
  // 하단 탭 전환 시 보이는 컨텐츠를 새로고침(첫 마운트는 제외 — 이미 초기 로드됨).
  // 전환 움직임(0.42초)이 끝난 뒤에 — 같이 돌면 화면이 버벅인다.
  const tabFirstRun = React.useRef(true);
  useEffect(() => {
    if (tabFirstRun.current) { tabFirstRun.current = false; return; }
    refreshVisibleQueriesSoon();
  }, [tab]);
  const [overlay, setOverlay] = useState<Overlay>(deepLink.place ? 'place' : null);
  // 편지·상세처럼 겹쳐 여는 화면은 뒤로 가면 직전 화면으로 돌아간다(1013)
  const overlayRef = React.useRef<Overlay>(null);
  overlayRef.current = overlay;
  const backStack = React.useRef<Overlay[]>([]);
  const pushOverlay = (next: Overlay) => { backStack.current.push(overlayRef.current); setOverlay(next); };
  const popOverlay = () => { setOverlay(backStack.current.pop() ?? null); };
  // MY 묶음(마이페이지 · 쿠폰함 · 지갑 · 설정) 화면 이동 — 이미 지나온 화면으로 가면 그 위에 쌓인 기록을 걷어 낸다(뒤로 움직임)
  const myNav = React.useRef<MyNav>({
    push: (to) => {
      const i = backStack.current.lastIndexOf(to);
      if (i >= 0) { backStack.current = backStack.current.slice(0, i); setOverlay(to); } else pushOverlay(to);
    },
    back: () => popOverlay(),
    openStore: (id) => { setStoreId(id); pushOverlay('storeDetail'); },
  }).current;
  // 모든 화면이 닫히면(탭 화면) 쌓인 뒤로가기 기록도 비운다 — 오래된 기록 때문에 뒤로를 두 번 누르는 일 방지
  useEffect(() => { if (overlay === null) backStack.current = []; }, [overlay]);
  // 겹쳐 연 화면을 닫고 탭으로 돌아오면 보이는 컨텐츠를 새로고침(전환 움직임이 끝난 뒤)
  const prevOverlay = React.useRef<Overlay>(null);
  useEffect(() => {
    if (overlay === null && prevOverlay.current !== null) refreshVisibleQueriesSoon();
    prevOverlay.current = overlay;
  }, [overlay]);
  const [composeArgs, setComposeArgs] = useState<Extract<AppNavTarget, { kind: 'letterCompose' }> | null>(null);
  const [letterDetailId, setLetterDetailId] = useState<string>('');
  const [gatherId, setGatherId] = useState<string>('g1');
  const [myDetailMode, setMyDetailMode] = useState<MyDetailMode>('likes');
  const [storeId, setStoreId] = useState<string>('s01');
  const [friendUserId, setFriendUserId] = useState<string>('');
  const [groupProfileUserId, setGroupProfileUserId] = useState<string | null>(null);  // 모임 프로필 열람 대상
  const [friendFreeView, setFriendFreeView] = useState(false);
  const [loungePostId, setLoungePostId] = useState<string>('p01');
  const [chatRoomId, setChatRoomId] = useState<string>('');
  // 모임 내부 탭(모임/채팅) — 오버레이는 탭바까지 언마운트하므로 state를 여기 둬야
  // 채팅방을 열었다 닫아도 '채팅' 탭이 유지된다(homeTab과 같은 이유).
  const [gatherTab, setGatherTab] = useState<GatherTabKey>('feed');
  const changeGatherTab = (t: GatherTabKey) => {
    setGatherTab(t);
    refreshVisibleQueriesSoon();
  };
  const insets = useSafeAreaInsets();
  const myProfile = usePreview(previewSelectors.myProfile);
  const authPrompt = usePreview(previewSelectors.authPrompt);
  // 인증번호 완료 모션이 도는 동안은 세션이 생겨도 시작 화면을 그대로 둔다(Login이 모션 끝에 놓는다)
  const authHold = useAuthHold();

  // 인연(오늘의 친구) 게이트 — 가입은 생년월일·성별만 받고, 상세 프로필(사진·소개)은
  // 인연 기능(프로필 열람·연결 신청) 사용 시점에 요구한다. 모임은 프로필 없이 사용 가능.
  // 푸시 리스너 closure에서도 최신값을 읽도록 ref로 미러링.
  const profileCompletedRef = React.useRef(myProfile.profileCompleted);
  profileCompletedRef.current = myProfile.profileCompleted;
  // 인연 액션 게이트(previewStore.requireCompleteProfile) 발동 → 완성 유도 후 위저드 열기
  const profileGatePrompt = usePreview(previewSelectors.profileGate);
  React.useEffect(() => {
    if (!profileGatePrompt) return;
    previewActions.closeProfileGate();
    const msg = '관심을 보내려면 먼저 내 프로필을 완성해야 해요.\n사진과 소개를 채우면 내 프로필도 인연에 공개돼요.';
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(msg + '\n\n지금 완성할까요?')) setOverlay('profileGate');
    } else {
      Alert.alert('프로필을 완성해주세요', msg, [
        { text: '나중에', style: 'cancel' },
        { text: '지금 완성하기', onPress: () => setOverlay('profileGate') },
      ]);
    }
  }, [profileGatePrompt]);
  const sessionRef = React.useRef(session);
  sessionRef.current = session;
  // free=true — 인연 덱(하루 5명) 경유: 열람 쿼터/과금 없이 상세를 보여준다
  function openFriendGated(userId: string, opts?: { free?: boolean }) {
    backStack.current = [];
    setFriendFreeView(!!opts?.free);
    setFriendUserId(userId);
    // 열람은 프로필 미완성이어도 허용 — 관심 보내기 등 '액션' 시점에
    // requireCompleteProfile 게이트(previewStore)가 완성 유도를 띄운다(대표 지시 0821).
    setOverlay('friendDetail');
  }

  // 전역 화면 열기(src/lib/appNav) — 덱·상세·알림에서 편지·취향 화면을 연다
  useEffect(() => registerAppNav((t) => {
    if (t.kind === 'letterCompose') { setComposeArgs(t); pushOverlay('letterCompose'); }
    else if (t.kind === 'letterDetail') { setLetterDetailId(t.letterId); pushOverlay('letterDetail'); }
    else if (t.kind === 'friend') { setFriendFreeView(!!t.free); setFriendUserId(t.userId); pushOverlay('friendDetail'); }
    else if (t.kind === 'matchPrefs') pushOverlay('matchPrefs');
    else if (t.kind === 'letters') { backStack.current = []; setOverlay(null); setTab('letters'); }
    else if (t.kind === 'place') pushOverlay('place');
    else if (t.kind === 'profileEdit') pushOverlay('profileEdit');
    else if (t.kind === 'tab') { backStack.current = []; setOverlay(null); setTab(t.tab); }
    else if (t.kind === 'letterPopup') { backStack.current = []; setOverlay(null); setTab('affinity'); void routeLetterPush(t.letterId, t.fromUserId); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // 시연도구(src/demo/panel) — 오른쪽 패널에서 화면을 바로 옮긴다
  useEffect(() => registerDemoNav({
    tab: (t) => { backStack.current = []; setOverlay(null); setTab(t); },
    overlay: (name, p = {}) => {
      if (p.friendUserId) { setFriendFreeView(true); setFriendUserId(p.friendUserId); }
      if (p.letterId) setLetterDetailId(p.letterId);
      if (p.loungePostId) setLoungePostId(p.loungePostId);
      if (p.storeId) setStoreId(p.storeId);
      if (p.gatherId) setGatherId(p.gatherId);
      if (p.chatRoomId) setChatRoomId(p.chatRoomId);
      if (p.myDetailMode) setMyDetailMode(p.myDetailMode as MyDetailMode);
      backStack.current = [];
      setOverlay(name as Overlay);
    },
    letterCompose: (r) => { setComposeArgs({ kind: 'letterCompose', receiver: r, mode: 'new' }); backStack.current = []; setOverlay('letterCompose'); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // 로그아웃 시 모든 화면 상태 리셋 + IAP 언바인드
  // (처음부터 게스트로 연 경우는 건드리지 않는다 — 웹 주소 ?tab= 로 연 화면이 그대로 남게)
  const hadSession = React.useRef(false);
  useEffect(() => {
    if (session) { hadSession.current = true; return; }
    if (!loading) {
      if (hadSession.current) { setOverlay(null); setTab('affinity'); }
      hadSession.current = false;
      unbindIAPUser().catch(() => {});
    }
  }, [session, loading]);

  // 로그인 성공 시 로그인 유도 모달 닫기
  useEffect(() => {
    if (session) previewActions.closeAuthPrompt();
  }, [session]);

  // 접속 기록(0138) — 앱 실행·포그라운드 복귀 때 남긴다(어드민 MAU·리텐션)
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    void touchActiveDay(uid);
    void syncTaghirePoints();  // 매장 포인트 최신화(1013 — 자동 적립은 웹훅이 안 와서 앱이 직접 가져온다)
    prefetchMissions();        // '미션 성공!' 축하 기준값(오늘 받은 미션)
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') { void touchActiveDay(uid); void syncTaghirePoints(); prefetchMissions(); } });
    return () => sub.remove();
  }, [session?.user.id]);

  // 로그인 후 1회 IAP 사용자 바인딩 + 푸시 토큰 등록
  useEffect(() => {
    if (!session?.user.id) return;
    configureIAP();
    bindIAPUser(session.user.id).catch((e) => {
      if (__DEV__) console.warn('[iap] bind failed', e);
    });
    registerForPushNotifications().catch((e) => {
      if (__DEV__) console.warn('[push] register failed', e);
    });
    // 알림 탭 응답 → 해당 화면으로 라우팅
    const unsub = addPushResponseListener((intent) => {
      if (intent.kind === 'chat') {
        setTab('affinity');
        setGatherTab('chat');
        setChatRoomId(intent.roomId);
        setOverlay('chatRoom');
      } else if (intent.kind === 'gather') {
        setGatherId(intent.gatheringId);
        setOverlay('gatherDetail');
      } else if (intent.kind === 'exchanges') {
        setOverlay('profileExchanges');
      } else if (intent.kind === 'connection') {
        openFriendGated(intent.otherUserId);
      } else if (intent.kind === 'post') {
        setLoungePostId(intent.postId);
        setOverlay('loungeDetail');
      } else if (intent.kind === 'coupons') {
        setOverlay('couponWallet');
      } else if (intent.kind === 'letter') {
        // 편지 푸시로 들어오면 메인 화면에서 도착 팝업으로 맞이한다(1013 — 시안과 동일)
        backStack.current = [];
        setOverlay(null);
        setTab('affinity');
        void routeLetterPush(intent.letterId);
      } else if (intent.kind === 'letterFrom') {
        backStack.current = [];
        setOverlay(null);
        setTab('affinity');
        void routeLetterPush(undefined, intent.fromUserId);
      } else if (intent.kind === 'letters') {
        backStack.current = [];
        setOverlay(null);
        setTab('letters');
      } else if (intent.kind === 'badges') {
        setOverlay('badgeManage');
      } else if (intent.kind === 'profileEdit') {
        // 미완성이면 등록(완성 후 인연으로), 완성이면 편집
        if (profileCompletedRef.current) setOverlay('profileEdit');
        else { setGateToAffinity(true); setOverlay('profileGate'); }
      } else {
        setOverlay('notifications');
      }
    });
    // 앱을 보는 중에 편지 푸시가 오면 편지함을 바로 새로 받아 도착 팝업을 띄운다
    const unsubReceived = addPushReceivedListener((kind) => {
      if (kind.startsWith('letter_')) void queryClient.invalidateQueries({ queryKey: ['letters'] });
    });
    return () => { unsub(); unsubReceived(); };
  }, [session?.user.id]);

  // 새 편지 도착 팝업(1013, 시안과 동일) — 메인 화면에서 안 읽은 받은 편지가 있으면 "누군가의 편지가 도착했어요."
  // [편지 확인] → 그 편지 상세(열면 읽음), [닫기] → 지금 와 있는 안 읽은 편지 전부 다시 띄우지 않음.
  const lettersQ = useMyLetters();
  // 푸시를 눌러 들어온 편지 — 예전에 [닫기]한 편지여도 팝업으로 다시 보여 준다
  const [pushLetterId, setPushLetterId] = useState<string | null>(null);
  // 안 읽은 받은 편지면 팝업, 이미 읽었거나 연결·환불 안내면 그 편지를 바로 연다
  async function routeLetterPush(id?: string, fromUserId?: string) {
    await queryClient.refetchQueries({ queryKey: ['letters'] }).catch(() => {});
    const list = queryClient.getQueryData<LetterRow[]>(['letters']) ?? [];
    const l = id
      ? list.find((x) => x.id === id)
      // 예전 '메시지' 알림(편지로 옮겨짐) — 그 사람이 보낸 받은 편지 중 최신
      : list.filter((x) => x.direction === 'in' && x.other_id === fromUserId)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (l && letterState(l) === 'in_unread') { setPushLetterId(l.id); return; }
    if (l) { setLetterDetailId(l.id); setOverlay('letterDetail'); return; }
    // 못 찾으면(보관 기간 지남 등) 편지함으로
    setTab('letters');
  }
  const [poppedLetters, setPoppedLetters] = useState<Set<string> | null>(null);
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) { setPoppedLetters(null); return; }
    AsyncStorage.getItem(`yahwa_letter_popped:${uid}`)
      .then((v) => setPoppedLetters(new Set(v ? (JSON.parse(v) as string[]) : [])))
      .catch(() => setPoppedLetters(new Set()));
  }, [session?.user.id]);
  const letterList = lettersQ.data ?? [];
  const pushedLetter = pushLetterId
    ? letterList.find((l) => l.id === pushLetterId && letterState(l) === 'in_unread') ?? null
    : null;
  const arrivedLetter = poppedLetters && !overlay
    ? pushedLetter ?? letterList.find((l) => letterState(l) === 'in_unread' && !poppedLetters.has(l.id)) ?? null
    : null;
  function markLetterPopped(id: string) { markLettersPopped([id]); }
  // [나중에]는 지금 와 있는 안 읽은 편지 전부 — 편지 수만큼 팝업이 반복되지 않게
  function markLettersPopped(ids: string[]) {
    const uid = session?.user.id;
    if (!uid) return;
    const next = new Set(poppedLetters ?? []);
    ids.forEach((id) => next.add(id));
    setPoppedLetters(next);
    AsyncStorage.setItem(`yahwa_letter_popped:${uid}`, JSON.stringify([...next].slice(-200))).catch(() => {});
  }

  // 가입 직후 19세 게이트 — public.users.age_locked 확인
  const meQuery = useQuery({
    queryKey: ['me', session?.user.id ?? null],
    queryFn: fetchMe,
    enabled: !!session,
  });

  // 필수 항목 안내(1013) — 이미 프로필을 완성한 회원도 새 필수 항목(학력 등)이 비어 있으면 하루 한 번 채우도록 안내
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid || overlay || !meQuery.data || !(meQuery.data as any).profile_completed) return;
    const p = myProfile as any;
    const missing = [
      ['학력', p.education], ['MBTI', p.mbti], ['키', p.height], ['흡연', p.smoking],
      ['종교', p.religion], ['직업', p.job], ['사는 곳', p.region],
    ].filter(([, v]) => !v).map(([k]) => k as string);
    if (!missing.length) return;
    const key = `yahwa_required_nudge_day:${uid}`;
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
    let cancelled = false;
    AsyncStorage.getItem(key).then((v) => {
      if (cancelled || v === today) return;
      AsyncStorage.setItem(key, today).catch(() => {});
      const msg = `인연 프로필에 ${missing.join(', ')} 항목이 꼭 필요해졌어요.\n지금 채우면 인연 추천이 더 정확해져요.`;
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(msg + '\n\n지금 채울까요?')) setOverlay('profileEdit');
      } else {
        Alert.alert('필수 정보를 채워주세요', msg, [
          { text: '나중에', style: 'cancel' },
          { text: '지금 채우기', onPress: () => setOverlay('profileEdit') },
        ]);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, overlay, meQuery.data, myProfile.education, myProfile.mbti, myProfile.height]);

  // 인연 프로필이 없으면 인연 탭 덱 자리에 등록 안내(시안 .entry-gate, 1013) — 예전엔 작성 화면으로 바로 보냈다.
  // 가입(본인정보) 미완료면 가입 화면이 먼저, 방금 등록(서버 재조회 전)이면 로컬 완료 표시를 믿는다.
  const showAffinityGate = !!session && !!meQuery.data
    && !!(meQuery.data as any).age_locked
    && !(meQuery.data as any).profile_completed
    && !myProfile.profileCompleted;
  // 공개 중지 회원도 인연 탭 대신 안내(서버도 0160부터 프로필·관심·편지를 막는다)
  const affinitySuspended = !!session && !!(meQuery.data as any)?.affinity_suspended;

  // 서버 users 행을 로컬 myProfile로 hydrate
  useEffect(() => {
    if (meQuery.data) {
      previewActions.hydrateFromServer(meQuery.data as any);
    }
  }, [meQuery.data]);

  // 가입 환영 쿠폰 안내 팝업 상태 (아래 두 경로 — 자동 지급 / 링크 청구 — 에서 공용)
  const [signupCoupon, setSignupCoupon] = useState<{ id: string; title: string; discountLabel: string | null } | null>(null);

  // /download?c=코드 경유 가입 — 저장해둔 캠페인 코드를 로그인 후 1회 청구 (웹)
  useEffect(() => {
    if (!session?.user.id || Platform.OS !== 'web' || typeof window === 'undefined') return;
    const code = window.localStorage.getItem('yahwa_signup_coupon');
    if (!code) return;
    claimSignupCoupon(code)
      .then(async (granted) => {
        window.localStorage.removeItem('yahwa_signup_coupon');
        // 링크 경유 지급도 같은 팝업으로 안내(토스트보다 명확)
        if (granted) {
          const c = await fetchSignupGrantedCoupon().catch(() => null);
          if (c) setSignupCoupon(c);
        }
      })
      .catch(() => { /* 코드 무효/네트워크 — 다음 로그인 때 재시도 */ });
  }, [session?.user.id]);

  // 가입 환영 쿠폰 팝업 — "신규 가입 자동" 쿠폰이 지급됐으면 첫 진입 시 1회만 안내.
  // 본 적 있는 쿠폰은 기기에 기록해 다시 뜨지 않게 한다(계정별 키).
  // 확인하는 동안(couponChecking)과 팝업이 떠 있는 동안은 지인 차단 시트를 막는다 — 팝업을 닫은 뒤에 시트가 올라온다
  const [couponChecking, setCouponChecking] = useState(false);
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    let alive = true;
    setCouponChecking(true);
    (async () => {
      try {
        const c = await fetchSignupGrantedCoupon();
        if (!alive || !c) return;
        const key = `yahwa_signup_coupon_seen_${uid}`;
        const seen = await AsyncStorage.getItem(key).catch(() => null);
        if (seen === c.id) return;          // 이미 안내한 쿠폰
        await AsyncStorage.setItem(key, c.id).catch(() => {});
        if (alive) setSignupCoupon(c);
      } catch { /* 안내 실패는 무해 — 쿠폰은 쿠폰함에 그대로 있다 */ }
      finally { if (alive) setCouponChecking(false); }
    })();
    return () => { alive = false; setCouponChecking(false); };
  }, [session?.user.id]);
  useEffect(() => { setHomeSheetBlocked(couponChecking || !!signupCoupon); }, [couponChecking, signupCoupon]);

  // 태그히어 매장이 포인트를 수동으로 적립/조정하면 웹훅이 taghere_point_balances +
  // users.points/store_spend_total을 함께 갱신한다. users 테이블은 RLS가 전체 공개(select using(true))라
  // 다른 사용자 PII 유출 위험 때문에 realtime을 못 걸고, 대신 본인 행만 노출되는(user_id=eq.uid)
  // taghere_point_balances의 변경을 감지해 'me' 쿼리를 즉시 재조회한다.
  const qc = useQueryClient();
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    const channel = supabase
      .channel(`taghere-balances-me-${uid}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'taghere_point_balances', filter: `user_id=eq.${uid}` },
        () => { qc.invalidateQueries({ queryKey: ['me', uid] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user.id, qc]);

  // 전역 Paywall(_layout)의 "충전하러 가기" 인텐트를 소비해 충전 화면으로 이동.
  // (오버레이 화면에서도 페이월이 뜨고 충전으로 넘어갈 수 있게 함)
  const pendingCharge = usePreview(previewSelectors.pendingCharge);
  useEffect(() => {
    if (pendingCharge) {
      previewActions.clearPendingCharge();
      // 편지 쓰기 등 화면 위에서 충전으로 가면, 충전 후 그 화면으로 돌아온다
      pushOverlay('charge');
    }
  }, [pendingCharge]);

  // 첫 화면(리뉴얼 1120) — JS 스플래시 1.2초, 비로그인 첫 실행 1회만 웰컴(둘러보기를 고르거나 로그인하면 다시 띄우지 않는다).
  // 웹 주소 ?tab= 으로 연 화면(공유 링크)은 웰컴 없이 바로 보여 준다.
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSplashDone(true), 1200); return () => clearTimeout(t); }, []);
  const [welcome, setWelcome] = useState<boolean | null>(null);
  useEffect(() => {
    const linked = Platform.OS === 'web' && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('tab');
    if (linked) { setWelcome(false); return; }
    AsyncStorage.getItem('yahwa_welcome_seen').then((v) => setWelcome(v !== '1')).catch(() => setWelcome(false));
  }, []);
  const closeWelcome = () => { setWelcome(false); AsyncStorage.setItem('yahwa_welcome_seen', '1').catch(() => {}); };
  useEffect(() => { if (session && welcome) closeWelcome(); }, [session, welcome]);
  // 첫 프로필 등록을 막 저장한 뒤 완료 화면이 떠 있는 동안 — 서버 값(profile_completed)이 먼저 바뀌어도 화면을 치우지 않는다
  const [introFinishing, setIntroFinishing] = useState(false);

  // 로그인·가입·필수 프로필처럼 탭·오버레이 대신 전체를 덮는 화면인지 — 아래 렌더 분기와 같은 조건
  const me = meQuery.data as any;
  // 사는 곳이 '서울 / 기타' · 시·도만인 예전 회원은 다시 고를 때까지 RegionRecheck(11-27). 저장 직후엔 서버 재조회를 기다리지 않는다
  const [regionFixed, setRegionFixed] = useState(false);
  const needRegion = !PREVIEW_FROM_ENV && !!me && !regionFixed && regionNeedsRecheck(me.region);
  const entryScreen = (!session && (!!authPrompt || !!welcome)) || authHold || introFinishing
    || (!!session && (PREVIEW_FROM_ENV
      ? !myProfile.onboarded
      : !me || !me.age_locked || (!me.profile_completed && String(me.created_at ?? '') >= PROFILE_REQUIRED_SINCE) || needRegion));
  // 시연도구에 지금 화면 알리기
  const demoEntry = !session ? (welcome ? 'welcome' : authPrompt ? 'auth' : null) : entryScreen ? 'signup' : null;
  useEffect(() => { reportDemoScreen(tab, overlay, demoEntry); }, [tab, overlay, demoEntry]);

  // 안드로이드 하드웨어 뒤로가기 — 화면 안 단계·나가기 확인(useBackOverride) → 오버레이 → 탭 순으로 되감는다.
  // 단일 라우트라 스택이 없어, 가로채지 않으면 어디서든 앱이 종료된다.
  const onBackRef = React.useRef<() => boolean>(() => false);
  onBackRef.current = () => {
    if (runBackOverrides()) return true;
    if (entryScreen) return false;  // 로그인·가입 첫 단계 — 기본 동작(앱 종료). 숨은 탭을 되감지 않는다
    // 겹쳐 연 화면(편지·상세 등)은 직전 화면으로, 아니면 탭으로
    if (overlay !== null) { popOverlay(); return true; }
    if (tab !== 'affinity') { setTab('affinity'); return true; }
    return false; // 인연 탭 + 오버레이 없음 → 기본 동작(앱 종료)
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => onBackRef.current());
    return () => sub.remove();
  }, []);

  // 웹 브라우저 뒤로가기 — 겹쳐 연 화면이 있는 동안 같은 주소로 기록을 하나 쌓아 두고, 뒤로가기(popstate)면
  // 앱 안 뒤로가기처럼 맨 위 화면을 닫는다(사이트를 떠나지 않게). 주소는 그대로라 /?tab= 같은 링크도 유지된다.
  const webGuard = React.useRef({ pushed: false, skipPop: false });
  const [webPopTick, setWebPopTick] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onPop = () => {
      const g = webGuard.current;
      if (g.skipPop) { g.skipPop = false; return; }
      if (!g.pushed) return;  // 우리가 쌓은 기록이 아님 — 브라우저 기본 이동
      g.pushed = false;
      if (onBackRef.current()) setWebPopTick((n) => n + 1);  // 화면이 남아 있으면 기록을 다시 쌓는다
      else window.history.back();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const g = webGuard.current;
    if (overlay !== null && !g.pushed) {
      window.history.pushState(window.history.state, '', window.location.href);
      g.pushed = true;
    } else if (overlay === null && g.pushed) {
      // 앱 안 버튼으로 닫았으면 쌓아 둔 기록을 걷어 낸다(다음 뒤로가기가 헛돌지 않게)
      g.pushed = false;
      g.skipPop = true;
      window.history.back();
    }
  }, [overlay, webPopTick]);

  // OTA 리로드 — 탭 화면에 있을 때만(겹쳐 연 화면·편지 쓰기·충전·로그인/가입 중엔 미룬다)
  const reloadSafeNow = overlay === null && !entryScreen;
  useEffect(() => { setReloadSafe(reloadSafeNow); }, [reloadSafeNow]);

  // 탭 화면 — 숨겨 둔 탭(KeepAlive)이 루트가 다시 그려질 때마다 같이 다시 그려지지 않게 같은 요소를 재사용한다.
  // 안에서 쓰는 함수는 setState·ref만 건드려 처음 만든 것을 계속 써도 된다. 테마가 바뀌면 새로 만들어 전체가 새 색을 읽는다.
  const suspendedReason = (meQuery.data as any)?.affinity_suspended_reason;
  /* eslint-disable react-hooks/exhaustive-deps */
  const affinityGate = showAffinityGate
    ? <ProfileGate onRegister={() => { setGateToAffinity(true); setOverlay('profileGate'); }} />
    : affinitySuspended
      ? <SuspendedCard reason={suspendedReason} onEdit={() => setOverlay('profileEdit')} />
      : undefined;
  const homeEl = useMemo(() => (
    <Home
      // 모든 프로필 진입은 FriendDetail(무료 연결 신청 → 연락처 공유)로 통일.
      onOpenFriend={(uid) => openFriendGated(uid, { free: true })}
      onOpenCharge={() => setOverlay('charge')}
      gate={affinityGate}
    />
  ), [showAffinityGate, affinitySuspended, suspendedReason]);
  const heartEl = useMemo(() => (
    <HeartBox onOpenFriend={(uid) => openFriendGated(uid, { free: true })} gate={affinityGate} />
  ), [showAffinityGate, affinitySuspended, suspendedReason]);
  const lettersEl = useMemo(() => <LetterBox />, []);
  const loungeEl = useMemo(() => (
    <Lounge
      onOpenPost={(postId) => {
        setLoungePostId(postId);
        setOverlay('loungeDetail');
      }}
      onOpenNotif={() => setOverlay('notifications')}
    />
  ), []);
  const meEl = useMemo(() => (
    <MyPage
      nav={myNav}
      onOpenSettlementInfo={() => setOverlay('settlementInfo')}
      onOpenMySocialings={() => setOverlay('mySocialings')}
      onOpenFollowing={() => setOverlay('followingHosts')}
    />
  ), []);
  /* eslint-enable react-hooks/exhaustive-deps */
  const navDots = useNavDots();

  // 스플래시(리뉴얼 1120) — 미색 바탕 + 손글씨 로고. 세션을 확인하는 동안 + 최소 1.2초
  if (!authHold && (loading || (session && meQuery.isLoading) || !splashDone || welcome === null)) {
    return <Splash />;
  }

  // 비로그인 첫 실행은 웰컴부터('먼저 둘러볼게요'로 게스트 탭), 그 뒤로는 온보딩 없이 바로 메인 탭을 브라우징.
  // 보호 기능 사용 시 previewActions.requireLogin()이 authPrompt를 켜고 시작(가입·로그인) 화면을 띄운다.
  // 웰컴 사진이 상태 표시줄 뒤까지 차도록 위 안전 영역은 GuestStart가 직접 띄운다.
  if ((!session && (welcome || authPrompt)) || authHold) {
    return (
      <GuestStart
        start={welcome ? 'welcome' : 'auth'}
        onBrowse={() => { closeWelcome(); previewActions.closeAuthPrompt(); }}
        onCloseAuth={() => previewActions.closeAuthPrompt()}
      />
    );
  }

  // 로그인 사용자만: 19세 게이트 → 첫 로그인 필수 프로필
  if (session) {
    if (PREVIEW_FROM_ENV) {
      if (myProfile && !myProfile.onboarded) {
        return (
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'bottom']}>
            <SignUp onDone={() => { /* state already updated */ }} />
          </SafeAreaView>
        );
      }
    } else if (!meQuery.data || !meQuery.data.age_locked) {
      // 만 19세 게이트는 fail-closed — users 행이 없거나(트리거 미실행 등) age_locked=false면 항상 노출.
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top', 'bottom']}>
          <SignUp onDone={() => {
            // 웰컴 쿠폰은 가입 완료 시 지급 — 상세 프로필은 이제 선택(인연 사용 시 요구)이라
            // 프로필 완성 시점에 걸면 안 채우는 회원이 영영 못 받는다.
            grantCouponByTitle('야화 웰컴 · 칵테일 1잔 무료', { discountLabel: '칵테일 1잔 무료', kind: 'welcome', description: '가입을 환영해요' }).catch(() => {});
            meQuery.refetch();
          }} />
        </SafeAreaView>
      );
    }
    // 첫 회원가입 — 인연 프로필 등록까지 마쳐야 앱을 쓸 수 있다(대표 지시 1010, 승인 절차 없음).
    // 기존 회원(이 날짜 이전 가입) 중 미완성자는 지금처럼 인연 탭에 들어갈 때만 등록을 요구한다.
    else if (
      introFinishing ||
      (!(meQuery.data as any).profile_completed &&
      String((meQuery.data as any).created_at ?? '') >= PROFILE_REQUIRED_SINCE)
    ) {
      return (
        // 아래 안전 영역은 ProfileEdit 하단 버튼이 직접 띄운다
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
          <ProfileEdit
            mandatory
            onSubmitted={() => setIntroFinishing(true)}
            onDone={() => { setIntroFinishing(false); setOverlay(null); setGateToAffinity(false); meQuery.refetch(); setTab('affinity'); }}
            onExit={() => { signOut().catch(() => {}); }}
          />
        </SafeAreaView>
      );
    }
    else if (needRegion) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
          <RegionRecheck current={me.region} onDone={() => { setRegionFixed(true); meQuery.refetch(); }} />
        </SafeAreaView>
      );
    }
  }

  // 메인 탭 + 오버레이
  // 겹쳐 여는 화면 — 탭 화면 위에 덮는다(탭 화면은 아래에 그대로 둔다)
  const overlayEl = (() => {
  if (overlay === 'match') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.primary }} edges={['top', 'bottom']}>
        <MatchSuccess onStart={() => setOverlay(null)} onLater={() => setOverlay(null)} />
      </SafeAreaView>
    );
  }
  if (isMyScreen(overlay)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <MyStack screen={overlay} nav={myNav} />
      </SafeAreaView>
    );
  }
  if (overlay === 'place') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <MapScreen nav={myNav} />
      </SafeAreaView>
    );
  }
  if (overlay === 'chatRoom') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <ChatRoom roomId={chatRoomId} onBack={() => { markChatRoomSeen(chatRoomId); setOverlay(null); }} />
      </SafeAreaView>
    );
  }
  if (overlay === 'charge') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <Charge nav={myNav} />
      </SafeAreaView>
    );
  }
  if (overlay === 'gatherDetail') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <GatherDetail
          id={gatherId}
          onBack={() => setOverlay(null)}
          // 모임은 인연과 분리 — 인연 프로필 미완성이어도 열리는 경량 모임 프로필로
          onOpenProfile={(userId) => { setGroupProfileUserId(userId); setOverlay('groupProfile'); }}
        />
      </SafeAreaView>
    );
  }
  if (overlay === 'loungeDetail') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <LoungeDetail postId={loungePostId} onBack={() => setOverlay(null)} onOpenPost={(id) => setLoungePostId(id)} onOpenExchanges={() => pushOverlay('profileExchanges')} />
      </SafeAreaView>
    );
  }
  if (overlay === 'myDetail') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <MyDetail
          mode={myDetailMode}
          onBack={() => setOverlay(null)}
          onOpenEditProfile={() => setOverlay('profileEdit')}
        />
      </SafeAreaView>
    );
  }
  if (overlay === 'notifications') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <Notifications
          onOpenProfileEdit={() => setOverlay('profileEdit')}
          onOpenBadges={() => setOverlay('badgeManage')}
          onOpenExchanges={() => pushOverlay('profileExchanges') /* 시안: 교환 화면에서 뒤로 가면 알림으로 */}
          onBack={() => setOverlay(null)}
          onOpenPost={(postId) => { setLoungePostId(postId); setOverlay('loungeDetail'); }}
          onOpenGather={(id) => { setGatherId(id); setOverlay('gatherDetail'); }}
          onOpenProfile={(uid) => openFriendGated(uid)}
          onOpenAffinity={() => setOverlay('affinityFriends')}
          onOpenCoupons={() => setOverlay('couponWallet')}
          onOpenChat={(roomId) => { setChatRoomId(roomId); setOverlay('chatRoom'); }}
        />
      </SafeAreaView>
    );
  }
  if (overlay === 'storeDetail') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <StoreDetail id={storeId} nav={myNav} />
      </SafeAreaView>
    );
  }
  if (overlay === 'storeSocialingCreate') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <StoreSocialingCreate
          storeId={storeId}
          onBack={() => setOverlay('storeDetail')}
          onDone={() => setOverlay(null)}
          onOpenSettlementInfo={() => setOverlay('settlementInfo')}
        />
      </SafeAreaView>
    );
  }
  if (overlay === 'profileEdit') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <ProfileEdit onBack={popOverlay} />
      </SafeAreaView>
    );
  }
  if (overlay === 'groupProfile') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        {groupProfileUserId && (
          <GroupProfileView userId={groupProfileUserId} onBack={() => { setOverlay('gatherDetail'); }} />
        )}
      </SafeAreaView>
    );
  }
  if (overlay === 'groupProfileEdit') {
    // 모임 프로필(대표사진·닉네임·지역)만 — 인연 프로필은 인연 탭 > 마이페이지에서
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <GroupProfileEdit onBack={() => setOverlay(null)} />
      </SafeAreaView>
    );
  }
  if (overlay === 'profileGate') {
    // 인연 게이트 경유 프로필 완성 — mandatory(사진 필수)지만 뒤로가기는 그냥 닫기.
    // 완성하면 원래 보려던 인연 프로필로 바로 이어간다.
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <ProfileEdit
          mandatory
          onBack={() => { setGateToAffinity(false); setOverlay(null); }}
          onDone={() => {
            meQuery.refetch();
            if (gateToAffinity) {
              setGateToAffinity(false);
              setTab('affinity');
              setOverlay(null);
              return;
            }
            setOverlay(friendUserId ? 'friendDetail' : null);
          }}
        />
      </SafeAreaView>
    );
  }
  if (overlay === 'couponWallet') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <CouponWallet nav={myNav} />
      </SafeAreaView>
    );
  }
  if (overlay === 'letterCompose' && composeArgs) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <LetterCompose
          receiver={composeArgs.receiver}
          mode={composeArgs.mode}
          letterId={composeArgs.letterId}
          invitedReply={composeArgs.invitedReply}
          onBack={popOverlay}
          onSent={popOverlay}
        />
      </SafeAreaView>
    );
  }
  if (overlay === 'letterDetail') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <LetterDetail
          letterId={letterDetailId}
          onBack={popOverlay}
          onOpenProfile={(uid) => { setFriendFreeView(true); setFriendUserId(uid); pushOverlay('friendDetail'); }}
          onReply={(l) => {
            setComposeArgs({
              kind: 'letterCompose', mode: 'reply', letterId: l.id, invitedReply: l.kind === 'invite',
              receiver: { id: l.other_id, nickname: l.other_nickname ?? '상대', photo: l.other_photo },
            });
            pushOverlay('letterCompose');
          }}
        />
      </SafeAreaView>
    );
  }
  if (overlay === 'matchPrefs') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <MatchPrefs onBack={popOverlay} />
      </SafeAreaView>
    );
  }
  if (overlay === 'friendDetail') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <FriendDetail
          userId={friendUserId}
          freeView={friendFreeView}
          onBack={popOverlay}
        />
      </SafeAreaView>
    );
  }
  if (overlay === 'affinityFriends') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <AffinityFriends
          onBack={() => setOverlay(null)}
          onOpenFriend={(userId) => openFriendGated(userId)}
        />
      </SafeAreaView>
    );
  }
  if (overlay === 'miniGame') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <LadderGame onBack={() => setOverlay(null)} />
      </SafeAreaView>
    );
  }
  if (overlay === 'badgeManage') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <CredentialsScreen nav={myNav} />
      </SafeAreaView>
    );
  }
  if (overlay === 'storeVisits') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <StoreVisits onBack={() => setOverlay(null)} />
      </SafeAreaView>
    );
  }
  if (overlay === 'spendHistory') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <SpendHistory nav={myNav} />
      </SafeAreaView>
    );
  }
  if (overlay === 'settlementInfo') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <SettlementInfoForm onBack={() => setOverlay(null)} onDone={() => setOverlay(null)} />
      </SafeAreaView>
    );
  }
  if (overlay === 'profileExchanges') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <ProfileExchanges
          onBack={popOverlay}
          onOpenProfile={(uid) => openFriendGated(uid, { free: true })}
          onOpenPost={(pid) => { setLoungePostId(pid); setOverlay('loungeDetail'); }}
        />
      </SafeAreaView>
    );
  }
  if (overlay === 'followingHosts') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <FollowingHosts
          onBack={() => setOverlay(null)}
          onOpenProfile={(userId) => { setGroupProfileUserId(userId); setOverlay('groupProfile'); }}
        />
      </SafeAreaView>
    );
  }
  if (overlay === 'mySocialings') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <MySocialings
          onBack={() => setOverlay(null)}
          onOpenGather={(gid) => { setGatherId(gid); setOverlay('gatherDetail'); }}
        />
      </SafeAreaView>
    );
  }

  return null;
  })();

  // 하단 메뉴 — 탭 화면과, 하단 메뉴를 띄워 두기로 한 안쪽 화면(OVERLAY_GNB)에서 보인다
  const gnbOn = overlay === null ? tab !== 'gather' : overlay in OVERLAY_GNB;
  // 상대 프로필은 들어온 탭(인연 홈 · 마음함 · 편지함)의 칸을 그대로 켜 둔다
  const gnbActive: GnbTab | null = overlay === null || overlay === 'friendDetail' ? (tab === 'gather' ? null : tab) : OVERLAY_GNB[overlay] ?? null;
  const tabScreen = (k: TabKey, el: React.ReactNode) => (LEGACY_TAB_PAD[k] ? <LegacyTabPad>{el}</LegacyTabPad> : el);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* 탭 화면은 글·프로필 같은 화면을 열어도 없애지 않고 아래에 둔다(KeepAlive) — 돌아오면 다시 그리지 않고 바로 보인다.
          겹쳐 여는 화면은 오른쪽에서 밀려 들어오고 뒤로 가면 밀려 나간다(ScreenStack) */}
      <ScreenStack
        overlayKey={overlayEl === null ? null : overlay}
        overlay={overlayEl}
        // 아이폰 왼쪽 끝에서 밀어 뒤로 — 먼저 인연 상세만(11-22). 뒤로 버튼과 같은 popOverlay
        swipeBack={overlay === 'friendDetail'}
        onSwipeBack={popOverlay}
        base={
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeepTabs
          // 로그인 계정이 바뀌면 숨겨 둔 탭 화면도 새로 그린다
          key={tabsUid ?? 'guest'}
          active={tab}
          order={TAB_ORDER}
          keep={keepTab}
          screens={{
            gather: tab === 'gather' ? tabScreen('gather',
              <GatherFeed
                onOpen={(id) => {
                  setGatherId(id);
                  setOverlay('gatherDetail');
                }}
                onOpenNotif={() => setOverlay('notifications')}
                onOpenSettlementInfo={() => setOverlay('settlementInfo')}
                tab={gatherTab}
                onTabChange={changeGatherTab}
                onOpenChatRoom={(id) => { setChatRoomId(id); setOverlay('chatRoom'); }}
              />
            ) : null,
            affinity: tabScreen('affinity', homeEl),
            heart: tabScreen('heart', heartEl),
            letters: tabScreen('letters', lettersEl),
            lounge: tabScreen('lounge', loungeEl),
            me: tabScreen('me', meEl),
          }}
        />
      </SafeAreaView>
      {/* 편지 도착 — [편지 확인]을 누르면 받은 편지 상세(보낸 사람 사진·이름·편지·수락)가 열린다(시안과 동일) */}
      {arrivedLetter && !signupCoupon && (
        <LetterArrivedPopup
          visible
          from={arrivedLetter.other_nickname}
          onConfirm={() => {
            markLetterPopped(arrivedLetter.id);
            setPushLetterId(null);
            setLetterDetailId(arrivedLetter.id);
            pushOverlay('letterDetail');
          }}
          onLater={() => {
            setPushLetterId(null);
            markLettersPopped(letterList.filter((l) => letterState(l) === 'in_unread').map((l) => l.id));
          }}
        />
      )}
      {/* 가입 환영 쿠폰 안내 — 지급 직후 메인 화면에서 1회 */}
      {signupCoupon && overlay === null && (
        <SignupCouponPopup
          title={signupCoupon.title}
          discountLabel={signupCoupon.discountLabel}
          onGoWallet={() => { setSignupCoupon(null); setOverlay('couponWallet'); }}
          onClose={() => setSignupCoupon(null)}
        />
      )}
      {/* 리프 전환 안내(0187) — 다른 안내가 없을 때 메인 화면에서 1회 */}
      {session && !signupCoupon && !arrivedLetter && overlay === null && <LeafConversionPopup />}
      </View>
        }
      />
      {/* 하단 메뉴 — 화면들 위에 떠 있는 한 겹(화면이 밀려 바뀌어도 그대로 있다) */}
      <Gnb
        active={gnbActive}
        visible={gnbOn}
        avatar={session ? myProfile.photo : undefined}
        dots={session ? navDots : undefined}
        onTab={(k) => {
          // 게스트는 마이 탭 사용 시 로그인 유도
          if (!session && k === 'me') {
            previewActions.requireLogin('로그인하면 내 프로필을 쓸 수 있어요');
            return;
          }
          // 하단 메뉴가 떠 있는 안쪽 화면에서 누르면 그 화면을 닫고 탭으로
          if (overlay !== null) { backStack.current = []; setOverlay(null); }
          setTab(k);
        }}
      />
    </View>
  );
}
