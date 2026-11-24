// 야화 — 이야기에서 시작한 인연 = 프로필 교환함(리뉴얼 1120, 시안 exchange · spec-rest §3.10 · §9.1 · 서버 0132 · 0171)
// 머리 줄 "이야기에서 시작한 인연" + ⓘ(교환 안내 시트) → 탭 세 칸: 받은 요청(개수 칩) · 보낸 요청 · 교환 기록(수락 + 거절)
// 한 줄: 얼굴 40(교환 전 = 익명 얼굴 / 교환 뒤 = 실제 사진) + 이름 · 시간 → 한마디 → "함께 이야기한 글 ›" → 상태 한 줄 → 알약 버튼.
//   받은 요청: [거절] [수락] / 교환한 사이: [교환 해제] [프로필 보기]. 처리하면 그 줄이 240ms 동안 왼쪽으로 12 빠지며 사라진다.
// 수락하면 지금처럼 바로 상대 인연 프로필로 간다(§13-9) — 돌아오면 '교환 기록' 탭. 알림에서 한 건만 열면 탭 없이 그 줄만(focusId).
// '안 봄' 표시(빨간 개수 칩 · 파란 점 · 기록의 빨간 점)는 기기에 남긴 마지막으로 본 시각으로 계산한다(서버 변경 없음).
import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, Pressable, ScrollView } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { SwipeTabs } from '../components/SwipeTabs';
import { Image } from 'expo-image';
import { colors, ease, layout } from '../tokens';
import { BottomSheet, Button, ConfirmSheet, Dot, Icon, NATIVE, SheetHeader, T, TopBar, reduceMotion, usePress, useTabBarClearance } from '../ui';
import { thumbUrl } from '../lib/img';
import { previewActions } from '../lib/previewStore';
import { useMyProfileExchanges, useRespondProfileExchangeMutation } from '../lib/hooks';
import { HIDE_IOS_CURRENCY } from '../lib/flags';
import { useLeafPricing } from '../lib/leafPricing';
import type { ExchangeRow } from '../lib/api';
import { releaseProfileExchange } from '../lib/communityApi';
import { CLine } from '../components/community/cIcons';
import { CommunityAvatar } from '../components/CommunityAvatar';
import { noticeAgo } from '../components/community/time';
import { consumeExchangeFocus, consumeExchangeReturnTab, setExchangeReturnTab } from '../components/community/focus';
import { getSeen, markSeen } from '../components/community/seen';
import { appNav } from '../lib/appNav';
import { useNow } from '../lib/useNow';

type Tab = '받은 요청' | '보낸 요청' | '교환 기록';
const TABS: Tab[] = ['받은 요청', '보낸 요청', '교환 기록'];
const EMPTY: Record<Tab, [string, string]> = {
  '받은 요청': ['받은 요청이 없어요', '이야기를 나누다 마음이 가면 요청이 도착해요.'],
  '보낸 요청': ['보낸 요청이 없어요', '글이나 댓글의 작성자에게 프로필 교환을 요청할 수 있어요.'],
  '교환 기록': ['교환 기록이 없어요', '수락하거나 거절한 요청이 여기에 모여요.'],
};
const at = (iso?: string | null) => (iso ? new Date(iso).getTime() : 0);

// 결과가 난 때 — 해제면 해제한 때, 그 밖엔 응답한 때(없으면 신청한 때)
const resultAt = (r: ExchangeRow) => (r.status === 'released' ? r.released_at : r.responded_at) ?? r.created_at;

export function ProfileExchanges({
  onBack,
  onOpenPost,
}: {
  onBack?: () => void;
  onOpenProfile?: (userId: string) => void;  // (안 씀 — 프로필은 appNav로 쌓아 연다. app/index 호환용으로 남김)
  onOpenPost?: (postId: string) => void;
}) {
  const q = useMyProfileExchanges();
  const qc = useQueryClient();
  const respond = useRespondProfileExchangeMutation();
  const [tab, setTab] = useState<Tab>(() => consumeExchangeReturnTab() ?? '받은 요청');
  // 알림에서 요청 하나를 눌러 왔으면 그 요청만, 탭 없이(시안). 처리하면 탭 목록으로 돌아간다.
  const [focusId, setFocusId] = useState<string | null>(consumeExchangeFocus);
  const [infoOpen, setInfoOpen] = useState(false);
  const [release, setRelease] = useState<ExchangeRow | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);   // 처리 중이라 빠지고 있는 줄
  const cost = useLeafPricing().prices.exchange;  // 남녀 공통(리프 정책 v2)
  const now = useNow(60_000);
  const pad = useTabBarClearance();
  const rows = q.data ?? [];
  const received = rows.filter((r) => r.direction === 'received' && r.status === 'pending');
  const shown = focusId ? rows.filter((r) => r.id === focusId) : tab === '받은 요청' ? received
    : tab === '보낸 요청' ? rows.filter((r) => r.direction === 'sent' && r.status === 'pending')
      : rows.filter((r) => r.status === 'accepted' || r.status === 'declined' || r.status === 'released').sort((a, b) => at(resultAt(b)) - at(resultAt(a)));

  // '안 봄' — 들어올 때의 마지막으로 본 시각을 들고 있다가(이번 방문 동안 점 유지), 탭을 열면 본 것으로 남긴다
  const [seen, setSeen] = useState<{ received: number; log: number } | null>(null);
  const [opened, setOpened] = useState<{ received: boolean; log: boolean }>({ received: false, log: false });
  useEffect(() => { void Promise.all([getSeen('exchange-received'), getSeen('exchange-log')]).then(([a, b]) => setSeen({ received: a, log: b })); }, []);
  useEffect(() => {
    if (!seen || focusId) return;
    if (tab === '받은 요청' && !opened.received) { markSeen('exchange-received'); setOpened((o) => ({ ...o, received: true })); }
    if (tab === '교환 기록' && !opened.log) { markSeen('exchange-log'); setOpened((o) => ({ ...o, log: true })); }
  }, [tab, seen, focusId, opened]);
  const isNewRequest = (r: ExchangeRow) => !!seen && r.direction === 'received' && r.status === 'pending' && at(r.created_at) > seen.received;
  const isNewResult = (r: ExchangeRow) => !!seen && r.status !== 'pending' && at(resultAt(r)) > seen.log;
  const chipNew = !opened.received && received.some(isNewRequest);
  const logNew = !opened.log && rows.some(isNewResult);

  // 교환한 상대 프로필 — 화면 쌓기로 열어 뒤로 오면 이 목록 '교환 기록' 탭
  function openProfile(uid: string) {
    setExchangeReturnTab('교환 기록');
    appNav({ kind: 'friend', userId: uid, free: true });
  }

  function answer(row: ExchangeRow, accept: boolean) {
    if (respond.isPending || leaving) return;
    setLeaving(row.id);
    respond.mutate(
      { id: row.id, accept },
      {
        onSuccess: async () => {
          setFocusId(null);
          if (!accept) { previewActions.showToast('요청을 정중히 거절했어요'); return; }
          // 수락하면 바로 상대 인연 프로필로 — 돌아오면 '교환 기록' 탭
          setTab('교환 기록');
          const fresh = await q.refetch();
          const other = fresh.data?.find((x) => x.id === row.id)?.other_id;
          if (other) openProfile(other);
          else previewActions.showToast('프로필을 교환했어요 · 교환 기록에서 볼 수 있어요');
        },
        onError: (e: any) => previewActions.showToast(e?.message ?? '처리하지 못했어요', 2400),
        onSettled: () => setLeaving(null),
      },
    );
  }

  async function doRelease() {
    if (!release || releasing) return;
    setReleasing(true);
    try {
      await releaseProfileExchange(release.id);
      qc.invalidateQueries({ queryKey: ['profile-exchanges'] });
      qc.invalidateQueries({ queryKey: ['exchanged-ids'], refetchType: 'all' });
      setRelease(null);
      previewActions.showToast('프로필 교환을 해제했어요.', 2200);
    } catch (e: any) {
      setRelease(null);
      previewActions.showToast(e?.message || '잠시 후 다시 시도해 주세요', 2400);
    } finally {
      setReleasing(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="이야기에서 시작한 인연" onBack={onBack} right={(
        <Pressable accessibilityRole="button" accessibilityLabel="프로필 교환 안내" onPress={() => setInfoOpen(true)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <CLine name="info" size={22} />
        </Pressable>
      )} />

      {/* 탭(.xc-tabs) — 머리 아래 16 · 높이 44 · 세 칸 균등 · 15 600 · 고른 탭 진회색 + 밑줄 2(칸 폭 전체) · 줄 맨 아래 1px 선 */}
      {!focusId && (
        <View accessibilityRole="tablist" style={{ marginTop: 16, marginHorizontal: layout.gutter, height: 44, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line }}>
          {TABS.map((t) => {
            const on = tab === t;
            return (
              <Pressable key={t} onPress={() => setTab(t)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: '600', color: on ? colors.inverseStrong : colors.subtle }}>{t}</Text>
                {/* 받은 요청 개수 칩 — 고른 탭: 진회색 + 흰 글자 / 안 고른 탭: #E3E7EA + 글자-안내 / 아직 안 본 요청이 있으면 빨강 */}
                {t === '받은 요청' && received.length > 0 && (
                  <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: chipNew ? colors.danger : on ? colors.inverseStrong : colors.muted }}>
                    <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: '600', color: chipNew || on ? colors.inverse : colors.sub, fontVariant: ['tabular-nums'] }}>{received.length}</Text>
                  </View>
                )}
                {t === '교환 기록' && logNew && <Dot size={6} label="새 결과 있음" style={{ marginLeft: -2, marginBottom: 10 }} />}
                {on && <View style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, backgroundColor: colors.inverseStrong }} />}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* 탭 화면 좌우로 넘기기(공용 SwipeTabs, 1020 대표 지시) */}
      <SwipeTabs index={TABS.indexOf(tab)} count={TABS.length} onIndexChange={(i) => setTab(TABS[i])} enabled={!focusId} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingTop: focusId ? 16 : 12, paddingHorizontal: layout.gutter, paddingBottom: pad }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <CLine name="lock" size={14} color={colors.mute} />
            <Text style={{ fontSize: 12, lineHeight: 18, color: colors.mute }}>수락하면 서로의 인연 프로필만 공개돼요</Text>
          </View>
          {shown.map((r, i) => (
            <ExchangeItem
              key={r.id}
              r={r}
              first={i === 0}
              now={now}
              leaving={leaving === r.id}
              newRequest={isNewRequest(r)}
              newResult={tab === '교환 기록' && isNewResult(r)}
              onPost={r.post_id ? () => onOpenPost?.(r.post_id!) : undefined}
              onAccept={() => answer(r, true)}
              onDecline={() => answer(r, false)}
              onProfile={() => r.other_id && openProfile(r.other_id)}
              onRelease={() => setRelease(r)}
            />
          ))}
          {!q.isLoading && shown.length === 0 && (
            <View style={{ paddingTop: 72, alignItems: 'center' }}>
              <T v="label1" style={{ fontWeight: '600' }}>{EMPTY[tab][0]}</T>
              <T v="caption1" color={colors.mute} center style={{ marginTop: 6 }}>{EMPTY[tab][1]}</T>
            </View>
          )}
        </ScrollView>
      </SwipeTabs>

      <BottomSheet open={infoOpen} onClose={() => setInfoOpen(false)}>
        {/* 가격 문구만 정책대로(요청 리프는 서버 값, 남녀 공통) */}
        <SheetHeader
          title="프로필 교환 안내"
          desc={`수락 전에는 인연 프로필이 가려져 있어요. 요청자의 첫 댓글과 관련 게시글을 보고 결정할 수 있어요.${HIDE_IOS_CURRENCY ? ' 수락은 무료예요.' : ` 요청은 ${cost}리프이며 수락은 무료예요. 보내진 요청의 리프는 반환되지 않아요.`} 수락하면 서로의 인연 프로필만 공개되고 연락처는 공개되지 않아요. 교환한 사람은 오늘의 인연 추천에 추가되지 않아요. 교환 기록에서 언제든 해제할 수 있어요.`}
        />
        <Button label="확인" size="sheet" block onPress={() => setInfoOpen(false)} />
      </BottomSheet>
      <ConfirmSheet
        open={!!release}
        onClose={() => setRelease(null)}
        title="프로필 교환을 해제할까요?"
        desc="교환 목록에서 프로필을 다시 볼 수 없게 돼요. 이미 보낸 호감과 편지는 그대로 남아요."
        confirmLabel="교환 해제"
        danger
        loading={releasing}
        onConfirm={doRelease}
      />
    </View>
  );
}

// 한 줄(.xc-it) — 카드 없음 · 위아래 16 · 줄 사이 1px 선 · 얼굴 40 + 12 + 본문 칸
function ExchangeItem({ r, first, now, leaving, newRequest, newResult, onPost, onAccept, onDecline, onProfile, onRelease }: {
  r: ExchangeRow; first: boolean; now: number; leaving: boolean; newRequest: boolean; newResult: boolean;
  onPost?: () => void; onAccept: () => void; onDecline: () => void; onProfile: () => void; onRelease: () => void;
}) {
  // 처리 중 — 240ms 동안 왼쪽으로 12 빠지며 사라진다(움직임 줄이기면 흐려지기만)
  const out = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(out, { toValue: leaving ? 1 : 0, duration: leaving ? 240 : 0, easing: ease.out, useNativeDriver: NATIVE }).start();
  }, [leaving, out]);
  const done = r.status === 'accepted';
  const name = done ? r.nickname ?? '닉네임 없음' : r.anon_nickname ?? '익명';
  const status = r.status === 'declined' ? (r.direction === 'received' ? '정중히 거절했어요' : '상대가 정중히 거절했어요')
    : r.status === 'released' ? (r.released_by_me ? '교환을 해제했어요' : '상대가 교환을 해제했어요')
      : r.status === 'pending' && r.direction === 'sent' ? '응답을 기다리고 있어요' : null;
  const time = at(r.status === 'pending' ? r.created_at : resultAt(r));
  return (
    <Animated.View style={{ paddingVertical: 16, flexDirection: 'row', gap: 12, borderTopWidth: first ? 0 : 1, borderTopColor: colors.line, opacity: out.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateX: out.interpolate({ inputRange: [0, 1], outputRange: [0, reduceMotion() ? 0 : -12] }) }] }}>
      <View style={{ width: 40, height: 40 }}>
        {done && r.photo ? (
          <Image source={{ uri: thumbUrl(r.photo, 160) ?? r.photo }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgSoft }} contentFit="cover" />
        ) : (
          <CommunityAvatar gender={(r.gender as 'M' | 'F' | null) ?? null} size={40} seed={(r.post_id ?? '') + (r.anon_nickname ?? '')} />
        )}
        {/* 새 요청 — 오른쪽 위 파란 점 9 + 흰 링 2 */}
        {newRequest && <Dot size={9} ring={2} color={colors.accent} label="새 요청" style={{ position: 'absolute', right: -2, top: -2 }} />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, lineHeight: 19.6, fontWeight: '600', color: colors.text }}>{name}</Text>
          {newResult && <Dot size={6} label="새 결과" style={{ marginLeft: 3, marginBottom: 10 }} />}
          <Text style={{ marginLeft: 'auto', paddingLeft: 8, fontSize: 11, lineHeight: 13, color: colors.mute }}>{time ? noticeAgo(time, now) : ''}</Text>
        </View>
        {!!r.comment_body && <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 21.7, color: colors.text }}>{r.comment_body}</Text>}
        {!!onPost && (
          <Pressable onPress={onPost} accessibilityRole="button" style={{ marginTop: 2, height: 28, flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: 12, lineHeight: 17.4, fontWeight: '500', color: colors.accent }}>함께 이야기한 글</Text>
            <Icon name="chevron-right" size={14} color={colors.accent} />
          </Pressable>
        )}
        {!!status && <Text style={{ marginTop: 6, fontSize: 12, lineHeight: 18, color: colors.mute }}>{status}</Text>}
        {r.status === 'pending' && r.direction === 'received' && (
          <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Pill ghost label="거절" onPress={onDecline} disabled={leaving} />
            <Pill label="수락" onPress={onAccept} disabled={leaving} />
          </View>
        )}
        {done && (
          <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <Pill ghost label="교환 해제" onPress={onRelease} />
            <Pill label="프로필 보기" onPress={onProfile} />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

// 알약 버튼(.xc-pill) — 높이 36 · 좌우 16 · 13 600 · 누름 0.97. 글자만(글자-연, 누르는 동안 #E3E7EA 알약 + 글자-보조) / 강조 파랑 + 흰 글자(누르는 동안 sky-600)
function Pill({ label, ghost, onPress, disabled }: { label: string; ghost?: boolean; onPress: () => void; disabled?: boolean }) {
  const press = usePress(0.97);
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} disabled={disabled} accessibilityRole="button">
      <Animated.View style={[{ height: 36, paddingHorizontal: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: ghost ? 'transparent' : colors.accent }, press.scaleStyle]}>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 18, backgroundColor: ghost ? colors.muted : colors.accentStrong, opacity: press.p }} />
        <Text style={{ fontSize: 13, lineHeight: 18.85, fontWeight: '600', color: ghost ? colors.mute : colors.inverse }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}
