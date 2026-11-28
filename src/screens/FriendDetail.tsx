// 야화 — 상대 프로필 (리뉴얼 1120 · 시안 #match-profile, spec-dating §3.3)
// 머리 줄(뒤로 · ⋯)은 위에 떠 있고 본문이 그 뒤로 흐른다. 2 넘게 내리면 머리 뒤에 흰 띠, 이름이 머리 밑으로 지나가면 머리에 사진 28 + 이름.
// 대표 사진 → 이름 · 인증 → 호감 칩 → 직업 · 사는 곳 → 정보 2열 → 이야기와 사진. 호감 · 편지는 오른쪽 아래 떠 있는 56 원.
// 하단 메뉴가 그대로 떠 있다(app/index OVERLAY_GNB). 좌우로 다른 사람 넘김은 없다(인연 홈 카드 줄이 그 역할).
// 받은 편지가 있는 상대는 맨 위에 받은 편지 카드(답장 쓰기 · 거절하기)를 보여 준다. 열람 기록(무료 쿼터 · 덱 8명 보상)은 예전 그대로.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, ease, fontSerif, z } from '../tokens';
import { useFriendProfile, useRecordFriendView, ensureMinLeaf100, useSendInterestFlow } from '../lib/hooks';
import { getCurrentUserId, requireAuth, previewActions } from '../lib/previewStore';
import { listMyLetters, readLetter, declineLetter, recordDeckView, type LetterRow } from '../lib/api';
import { useLeafPricing } from '../lib/leafPricing';
import { PriceText } from '../components/PriceText';
import { HIDE_IOS_CURRENCY } from '../lib/flags';
import { appNav } from '../lib/appNav';
import { usePairs } from '../lib/pairs';
import { useTabGuide } from '../lib/tabGuides';
import { MatchProfile, toFullProfile, regionText, type LikeChip } from '../components/FullProfile';
import { FloatingActions, HeartFab, LetterFab, type HeartState, type LetterBtnState } from '../components/affinity/Floating';
import { PersonSheet, MoreButton } from '../components/affinity/ProfileMenus';
import { ProfilePhoto } from '../components/affinity/ProfilePhoto';
import { EnvelopePill, RIcons } from '../components/affinity/icons';
import { markViewed } from '../lib/viewed';
import { useMyBalance } from '../lib/balance';
import { batchKey } from '../lib/deck';
import { useScreenActive } from '../components/KeepAlive';
import { BackButton, BreathingDots, Button, ConfirmSheet, LeafIcon, NATIVE, T, Tooltip, TopBar, reduceMotion, useGnbBottom, useTabBarClearance } from '../ui';

export function FriendDetail({
  userId,
  onBack,
  freeView,
}: {
  userId: string;
  onBack?: () => void;
  // 인연 덱에서 진입 — 열람 쿼터/과금 없이 무료로 보여준다
  freeView?: boolean;
}) {
  const q = useFriendProfile(userId);
  const interestFlow = useSendInterestFlow();
  const { width: winW } = useWindowDimensions();
  const myUid = getCurrentUserId();
  const qc = useQueryClient();
  const isMe = myUid === userId;
  const pairs = usePairs();
  // 오늘의 밸런스로 소개받은 사람 — 나와 같은 답을 골랐으니 '전 부먹파예요' 칩을 보여 준다
  const myBalance = useMyBalance(batchKey());
  const sameBalanceChip = myBalance.data?.profile_id === userId ? myBalance.data.chip : null;
  const fabBottom = useTabBarClearance(12);
  const padBottom = useTabBarClearance(12) + 56 + 24;
  const gnbBottom = useGnbBottom();

  // 편지 — 이 상대와 보관 중인 편지(받은 편지 카드·열린 봉투 표시)
  const lettersQ = useQuery({ queryKey: ['letters'], queryFn: listMyLetters, enabled: !!myUid, staleTime: 60_000 });
  const letters = (lettersQ.data ?? []).filter((l) => l.other_id === userId);
  const incoming = letters.find((l) => l.direction === 'in' && !l.replied_at) ?? null;
  const connected = letters.find((l) => !!l.replied_at) ?? null;
  const sentLetter = letters.find((l) => l.direction === 'out') ?? null;

  // 사람이 바뀌면 맨 위부터
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [userId]);

  // 일일 열람 기록 (0064) — 하루 10명 무료. 초과 열람은 서버가 needs_payment를 반환하고,
  // 사용자가 리프를 "선택"한 뒤에만 차감·열람. 결제 확정 전에는 프로필을 렌더링하지 않는다(viewGate).
  // 인연 덱 경유(freeView)는 게이트 없이 열되, '8명 모두 읽기' 보상 판정용으로 열람 기록은 남긴다.
  const recordView = useRecordFriendView();
  const [viewGate, setViewGate] = useState<'checking' | 'open' | 'locked'>('checking');
  const VIEW_COST = 100;

  function askCurrencyAndView() {
    if (HIDE_IOS_CURRENCY) {
      // iOS — 리프 개념을 노출하지 않고 조용히 잔액을 채운 뒤 그대로 열람 진행
      void payAndView();
      return;
    }
    previewActions.requestSpend({
      amount: VIEW_COST,
      title: '오늘 무료로 볼 수 있는 인연을 모두 봤어요',
      body: `이 프로필을 보려면 리프 ${VIEW_COST}이 필요해요.`,
      onConfirm: () => { void payAndView(); },
    });
  }

  async function payAndView() {
    const currency = 'leaf' as const;
    try {
      if (HIDE_IOS_CURRENCY) await ensureMinLeaf100();
      const res = await recordView.mutateAsync({ profileUserId: userId, currency });
      if (!HIDE_IOS_CURRENCY && (res?.charged ?? 0) > 0) {
        previewActions.showToast(`리프 ${VIEW_COST}으로 열람했어요`, 2400);
      }
      setViewGate('open');
    } catch (e: any) {
      if (HIDE_IOS_CURRENCY) {
        // 통화 개념 노출 금지 — 실패해도 조용히 열람은 계속 진행(막다른 화면 방지)
        setViewGate('open');
        return;
      }
      const msg = String(e?.message ?? '');
      if (e?.code === '53100' || msg.includes('insufficient') || msg.includes('point credit')) {
        previewActions.openPaywall(VIEW_COST, '리프가 부족해요.\n추가 열람은 1명당 리프 100이 필요해요.');
      } else {
        previewActions.showToast(msg || '열람 처리에 실패했어요', 2400);
      }
    }
  }

  useEffect(() => {
    if (!myUid || !userId || userId === myUid) { setViewGate('open'); return; }
    // 인연 덱·편지 경유 — 무료로 연다(쿼터 초과로 과금이 필요해도 기록만 건너뛴다)
    if (freeView) {
      setViewGate('open');
      recordView.mutate({ profileUserId: userId });
      // 덱 열람 기록(0152) — 쿼터 초과로 위 기록이 빠져도 '8명 모두 읽기'는 판정되게
      recordDeckView(userId).catch(() => {});
      return;
    }
    setViewGate('checking');
    recordView.mutate({ profileUserId: userId }, {
      onSuccess: (res: any) => {
        if (res?.needs_payment) {
          // iOS는 통화 개념을 보여주지 않고 'checking' 스피너를 유지한 채 조용히 처리
          setViewGate(HIDE_IOS_CURRENCY ? 'checking' : 'locked');
          askCurrencyAndView();
          return;
        }
        setViewGate('open');
      },
      // 기록 실패(네트워크 등)로 열람까지 막지 않음 — 무료 구간 UX 우선
      onError: () => setViewGate('open'),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, myUid]);

  // 상세를 실제로 연 상대는 '본 프로필'로 기록 — 이후 어디서든 모자이크 없이 보인다(1010)
  useEffect(() => { if (viewGate === 'open' && userId) markViewed(userId); }, [viewGate, userId]);

  // 받은 편지를 이 화면에서 처음 보면 '읽음'으로 — 보낸 사람에게 '도착했어요'로 바뀐다
  useEffect(() => {
    if (viewGate !== 'open' || !incoming || incoming.read_at) return;
    readLetter(incoming.id).then(() => qc.invalidateQueries({ queryKey: ['letters'] })).catch(() => {});
  }, [viewGate, incoming, qc]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [declineFor, setDeclineFor] = useState<LetterRow | null>(null);
  const [declining, setDeclining] = useState(false);

  // 머리 줄 — 스크롤에 따라 흰 띠(2 넘게) · 이름(본문 이름이 머리 밑으로 지나가면)
  const band = useRef(new Animated.Value(0)).current;
  const who = useRef(new Animated.Value(0)).current;
  const headState = useRef({ band: false, who: false });
  const bodyY = useRef(0);
  const nameY = useRef(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const b = y > 2;
    const w = nameY.current > 0 && y > bodyY.current + nameY.current - 56;
    if (b !== headState.current.band) { headState.current.band = b; Animated.timing(band, { toValue: b ? 1 : 0, duration: 200, easing: ease.out, useNativeDriver: NATIVE }).start(); }
    if (w !== headState.current.who) { headState.current.who = w; Animated.timing(who, { toValue: w ? 1 : 0, duration: 200, easing: ease.out, useNativeDriver: NATIVE }).start(); }
  };

  // 관계 — 호감(보냄 · 받음) · 편지
  const liked = interestFlow.alreadySent(userId);
  const likedMe = !!pairs.get(userId)?.receivedInterest;
  const heartState: HeartState = liked && likedMe ? 'mutual' : liked ? 'sent' : likedMe ? 'incoming' : 'none';
  const letterBtn: LetterBtnState = connected ? 'conn' : sentLetter ? 'sent' : incoming && !incoming.read_at ? 'new' : 'default';
  const likeChip: LikeChip = liked && likedMe ? 'mutual' : likedMe ? 'received' : liked ? 'sent' : null;

  // 첫 방문 말풍선(새 가입자 · 계정당 한 번 — 예전 3단계 안내의 서버 기록을 이어 쓴다): 0 호감 → 1 마음함 → 2 편지
  const shown = useScreenActive();
  const ready = viewGate === 'open' && !!q.data && !isMe && shown;
  const guide = useTabGuide('profile', ready);
  const [tip, setTip] = useState<'like' | 'heartbox' | 'letter' | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTip = (k: 'like' | 'heartbox' | 'letter', ms: number) => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    setTip(k);
    tipTimer.current = setTimeout(() => setTip(null), ms);
    guide.next();   // 본 것으로 기록
  };
  useEffect(() => () => { if (tipTimer.current) clearTimeout(tipTimer.current); }, []);
  // 아직 호감을 안 보낸 프로필을 처음 열 때 — 0.6초 뒤 하트 위 4초
  useEffect(() => {
    if (!ready || guide.step !== 0 || liked) return;
    const t = setTimeout(() => showTip('like', 4000), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, guide.step, liked]);
  // 서로 호감인데 아직 편지를 안 주고받았을 때 — 편지 버튼 위 3초
  useEffect(() => {
    if (!ready || guide.step !== 2 || heartState !== 'mutual' || letters.length || tip) return;
    const t = setTimeout(() => showTip('letter', 3000), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, guide.step, heartState, letters.length]);
  const [tipW, setTipW] = useState(0);

  if (q.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <BreathingDots />
      </View>
    );
  }
  if (!q.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar onBack={onBack} top={12} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, paddingBottom: padBottom }}>
          <T v="label1" color={colors.textSecondary} center>프로필을 찾을 수 없어요</T>
          <T v="caption1" color={colors.mute} center style={{ marginTop: 6 }}>삭제됐거나 인연을 쉬고 있는 회원일 수 있어요</T>
        </View>
      </View>
    );
  }

  // 열람 게이트 — 무료 쿼터 초과 시 리프 선택 전까지 프로필 미노출 (0064)
  if (viewGate !== 'open') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar onBack={onBack} top={12} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingBottom: padBottom }}>
          {viewGate === 'checking' ? (
            <BreathingDots />
          ) : (
            <>
              <RIcons.lock size={32} color={colors.control} />
              <Text style={{ marginTop: 16, fontFamily: fontSerif, fontSize: 20, lineHeight: 30, color: colors.text, textAlign: 'center' }}>오늘 무료로 볼 수 있는{'\n'}인연을 모두 봤어요</Text>
              <T v="body3Reading" color={colors.sub} center style={{ marginTop: 8 }}>리프 {VIEW_COST}으로 이 프로필을 볼 수 있어요.</T>
              <View style={{ alignSelf: 'stretch', marginTop: 24, gap: 8 }}>
                <Button block label={`${VIEW_COST}리프로 프로필 보기`} onPress={askCurrencyAndView} />
                <Button block variant="gray" label="다음에 볼게요" onPress={onBack} />
              </View>
            </>
          )}
        </View>
      </View>
    );
  }

  const p = q.data;
  const nick = p.nickname;
  const photo = p.photos?.[0] ?? null;
  const contentW = Math.min(winW, 560) - 40;

  function onLetter() {
    if (!requireAuth('편지는 로그인 후 보낼 수 있어요')) return;
    if (!previewActions.requireCompleteProfile()) return;
    if (connected) { appNav({ kind: 'letterDetail', letterId: connected.id }); return; }
    if (sentLetter) { appNav({ kind: 'letterDetail', letterId: sentLetter.id }); return; }
    if (incoming) { appNav({ kind: 'letterDetail', letterId: incoming.id }); return; }
    appNav({ kind: 'letterCompose', mode: 'new', receiver: { id: userId, nickname: nick, photo } });
  }
  function acceptLetter(l: LetterRow) {
    if (!previewActions.requireCompleteProfile()) return;
    appNav({ kind: 'letterCompose', mode: 'reply', letterId: l.id, invitedReply: l.kind === 'invite', receiver: { id: userId, nickname: nick, photo } });
  }
  async function doDecline(l: LetterRow) {
    setDeclining(true);
    try {
      await declineLetter(l.id);
      qc.invalidateQueries({ queryKey: ['letters'] });
      setDeclineFor(null);
      previewActions.showToast('편지를 정중히 거절했어요', 2200);
      onBack?.();
    } catch (e: any) {
      previewActions.showToast(e?.message ?? '잠시 후 다시 시도해주세요', 2400);
    } finally {
      setDeclining(false);
    }
  }
  function onLike() {
    interestFlow.trigger(userId, nick, {
      successToast: likedMe ? '서로 호감이에요' : '호감을 보냈어요',
      // 처음 호감을 보낸 뒤 — 완료 모션이 걷히면 하단 메뉴 마음함 칸 위에 작은 말풍선 3초
      onSuccess: () => { if (guide.step === 0 || guide.step === 1) setTimeout(() => showTip('heartbox', 3000), 2600); },
    });
  }

  const showActions = !isMe;
  const meta = [p.age != null ? `${p.age}세` : null, regionText(p.region)].filter(Boolean).join(' · ');
  // 하단 메뉴 마음함 칸(둘째)의 가운데 x — 메뉴는 좌우 20, 안쪽 4
  const heartTabX = 24 + ((winW - 48) / 5) * 1.5;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={() => { if (tip) setTip(null); }}
        contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: padBottom }}
      >
        {/* 받은 편지 — 편지 알림으로 들어와도 바로 보이게 맨 위 */}
        {incoming && <IncomingLetterCard letter={incoming} onAccept={() => acceptLetter(incoming)} onDecline={() => setDeclineFor(incoming)} />}
        <View onLayout={(e) => { bodyY.current = e.nativeEvent.layout.y; }}>
          <MatchProfile p={toFullProfile(p as any)} width={contentW} like={isMe ? null : likeChip} balanceChip={isMe ? null : ((p as any).balance_chip ?? sameBalanceChip)} onNameY={(y) => { nameY.current = y; }} />
        </View>
      </ScrollView>

      {/* 머리 줄 — 위 12 · 높이 44. 뒤 흰 띠(높이 88: 위 절반은 불투명 흰색 → 아래로 투명, 11-22 — 예전 94%·82%는 뒤 사진이 비쳤다)는 스크롤하면 깔린다 */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 88, zIndex: z.sticky }}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: band }]}>
          <LinearGradient colors={['rgba(255,255,255,1)', 'rgba(255,255,255,1)', 'rgba(255,255,255,0)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        </Animated.View>
        <View pointerEvents="box-none" style={{ marginTop: 12, height: 44, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
          <BackButton onPress={onBack} label="돌아가기" />
          <Animated.View pointerEvents="none" style={{ flex: 1, marginLeft: 4, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: who, transform: [{ translateY: who.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion() ? 0 : 6, 0] }) }] }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
              <ProfilePhoto src={photo} width={26} height={26} radius={13} thumbWidth={96} />
            </View>
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 16, lineHeight: 20.8, fontWeight: '600', color: colors.text }}>{nick}</Text>
          </Animated.View>
          {showActions && <MoreButton open={menuOpen} onPress={() => setMenuOpen(true)} />}
        </View>
      </View>

      {/* 떠 있는 호감 · 편지 — 오른쪽 20, 하단 메뉴 위 12 */}
      {showActions && (
        <FloatingActions bottom={fabBottom}>
          <HeartFab state={heartState} disabled={interestFlow.isPending} onPress={onLike} />
          <LetterFab state={letterBtn} onPress={onLetter} />
        </FloatingActions>
      )}

      {/* 첫 방문 말풍선 — 버튼 위 10(가리키는 버튼 가운데로 꼬리) */}
      {showActions && (
        <View pointerEvents="none" onLayout={(e) => setTipW(e.nativeEvent.layout.width)} style={{ position: 'absolute', right: 20, bottom: fabBottom + 56 + 10, zIndex: z.tooltip }}>
          <Tooltip visible={tip === 'like'} text="마음이 가면 호감을 보내 보세요." tailX={tipW - 96} />
          <Tooltip visible={tip === 'letter'} text="편지로 먼저 인사해 볼까요?" tailX={tipW - 28} />
        </View>
      )}
      <View pointerEvents="none" style={{ position: 'absolute', left: heartTabX - 100, width: 200, alignItems: 'center', bottom: gnbBottom + 64 + 4, zIndex: z.tooltip }}>
        <Tooltip small visible={tip === 'heartbox'} text="보낸 호감은 마음함에 모여요" left={<RIcons.heartFill size={12} color={colors.love} />} style={{ alignSelf: 'center' }} />
      </View>

      {showActions && (
        <PersonSheet open={menuOpen} target={{ userId, nickname: nick, photo, meta }} canHide={!!freeView} onClose={() => setMenuOpen(false)} onLeave={onBack} />
      )}
      <ConfirmSheet
        open={!!declineFor}
        onClose={() => setDeclineFor(null)}
        title={`${nick}님의 편지를 정중히 거절할까요?`}
        desc="편지 목록에서 사라지고 다시 추천되지 않아요. 서로의 연락처는 공개되지 않아요."
        confirmLabel="정중히 거절하기"
        loading={declining}
        onConfirm={() => { if (declineFor) void doDecline(declineFor); }}
      />
    </View>
  );
}

// 받은 편지 카드 — 회색 카드 안에 편지 글 + [거절하기] [답장 쓰기 · 값]. 특별편지는 무료. 값은 useLeafPricing(리프 정책 v2)
function IncomingLetterCard({ letter, onAccept, onDecline }: { letter: LetterRow; onAccept: () => void; onDecline: () => void }) {
  const replyCost = useLeafPricing().prices.reply;
  const special = letter.kind === 'invite';
  return (
    <View style={{ marginBottom: 20, padding: 16, borderRadius: 16, backgroundColor: colors.bgSoft }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <EnvelopePill size={16} color={colors.accentStrong} />
        <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500', color: colors.accentStrong }}>{special ? '특별편지가 도착했어요 · 무료로 답장할 수 있어요' : '편지가 도착했어요'}</Text>
      </View>
      <Text style={{ marginTop: 12, fontFamily: fontSerif, fontSize: 15, lineHeight: 27, color: colors.text }}>{letter.body}</Text>
      <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <RIcons.lock size={14} color={colors.mute} />
        <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: colors.mute }}>답장을 나누면 서로의 연락처가 공개돼요</Text>
      </View>
      <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
        <Button variant="tertiary" size="M" label="거절하기" onPress={onDecline} style={{ flex: 1 }} />
        <Button size="M" onPress={onAccept} style={{ flex: 1 }} accessibilityLabel="답장 쓰기">
          <Text style={{ fontSize: 14, lineHeight: 19.6, fontWeight: '600', color: colors.inverse }}>답장 쓰기</Text>
          {!HIDE_IOS_CURRENCY && (
            <View style={{ height: 24, paddingHorizontal: 9, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(255,255,255,0.22)' }}>
              {special ? (
                <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.inverse }}>무료</Text>
              ) : (
                <>
                  <LeafIcon size={14} color={colors.inverse} />
                  <PriceText cost={replyCost} style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.inverse }} />
                </>
              )}
            </View>
          )}
        </Button>
      </View>
    </View>
  );
}
