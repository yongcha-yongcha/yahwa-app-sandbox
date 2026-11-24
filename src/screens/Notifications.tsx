// 야화 — 새로운 소식(리뉴얼 1120, 시안 notifications · spec-rest §3.9 · §9.1). 커뮤니티 알림만 보인다(대표 1022).
// 머리 줄 "새로운 소식" + "모두 읽음" → 맨 위 고정 줄(기다리는 받은 교환 요청이 있을 때만) → 묶음 "오늘 · 이번 주 · 이전"
// 소식 줄: 종류 아이콘 원 40 + [문장 14/20.3 600 / 무엇에 대한 소식인지 12/18 / 시간 11/15.4]. 안 읽음은 sky-50 80% 바탕 + 오른쪽 위 점 8.
// 누르면 읽음 처리 후 그곳으로(이동 규칙은 예전 그대로). 서버 알림 + 기기 알림 + 프로필 교환 목록을 한 줄씩으로 합친다.
import React from 'react';
import { Animated, View, Text, Pressable, SectionList } from 'react-native';
import { colors, layout, radius } from '../tokens';
import { Dot, Icon, T, TopBar, usePress, useTabBarClearance } from '../ui';
import { usePreview, previewSelectors, previewActions, Notif } from '../lib/previewStore';
import { useServerNotifs, useMarkServerNotifReadMutation, useMyProfileExchanges } from '../lib/hooks';
import type { ServerNotif, ExchangeRow } from '../lib/api';
import { appNav } from '../lib/appNav';
import { CIcon, CLine } from '../components/community/cIcons';
import { noticeAgo, noticeGroup } from '../components/community/time';
import { setFocusComment, setExchangeFocus } from '../components/community/focus';
import { UNREAD_BG } from '../components/community/tone';
import { isCommunityLocalKind, isCommunityServerKind } from '../components/community/notifKinds';
import { useNow } from '../lib/useNow';

// 종류 아이콘 3종(시안): 댓글 · 답글 · 좋아요 = 하늘 / 교환 = 장미 / 그 밖 = 회색 카드
type IconKey = 'talk' | 'exchange' | 'etc';
type Row = { key: string; icon: IconKey; title: string; preview: string; at: number | null; timeText?: string; unread: boolean; onPress: () => void };
const ms = (iso?: string | null) => (iso ? new Date(iso).getTime() : NaN);

const ICONS: Record<Notif['kind'], IconKey> = { match: 'etc', message: 'talk', like: 'talk', comment: 'talk', gather: 'etc', system: 'etc' };
function serverIcon(kind: string): IconKey {
  if (kind.startsWith('lounge_') || kind === 'chat') return 'talk';
  if (kind.startsWith('profile_exchange') || kind.startsWith('connect')) return 'exchange';
  return 'etc';
}
// 커뮤니티 알림은 짧은 상태 문구로(시안) — 내용은 아래 줄에
function serverTitle(n: ServerNotif): string {
  if (n.kind === 'lounge_comment') return '내 글에 댓글이 달렸어요.';
  if (n.kind === 'lounge_reply') return '내 댓글에 답글이 달렸어요.';
  return n.title;
}

export function Notifications({
  onBack,
  onOpenChat,
  onOpenPost,
  onOpenGather,
  onOpenProfile,
  onOpenAffinity,
  onOpenCoupons,
  onOpenExchanges,
  onOpenProfileEdit,
  onOpenBadges,
}: {
  onBack?: () => void;
  onOpenChat?: (roomId: string) => void;
  onOpenExchanges?: () => void;
  onOpenProfileEdit?: () => void;
  onOpenBadges?: () => void;  // 인증 승인·반려 → 뱃지 관리
  onOpenPost?: (postId: string) => void;
  onOpenGather?: (gatherId: string) => void;
  onOpenProfile?: (userId: string) => void;
  onOpenAffinity?: () => void;
  onOpenCoupons?: () => void;
}) {
  // 커뮤니티 알림만(대표 1022) — 인연·편지·인증·운영 알림은 각 화면에서 본다
  const list = usePreview(previewSelectors.notifications).filter((n) => isCommunityLocalKind(n.kind));
  const serverQ = useServerNotifs();
  const markServerRead = useMarkServerNotifReadMutation();
  const now = useNow(60_000);

  const serverList = (serverQ.data ?? []).filter((n) => isCommunityServerKind(n.kind));

  function handleLocal(n: Notif) {
    previewActions.markNotifRead(n.id);
    // 채팅 폐지 — message kind는 더 이상 라우팅 안 함. 잔존 데이터는 silent하게 읽음 처리만
    if (n.kind === 'message') return;
    if (n.targetPostId && onOpenPost) onOpenPost(n.targetPostId);
    else if (n.targetGatherId && onOpenGather) onOpenGather(n.targetGatherId);
    else if (n.targetUserId && onOpenProfile) onOpenProfile(n.targetUserId);
  }

  function handleServer(n: ServerNotif) {
    if (!n.read) markServerRead.mutate(n.id);
    const d = n.data ?? {};
    // 호감 알림 → 마이페이지 '호감 친구' 화면으로 이동 (보낸 사람은 익명이라 프로필 대신 목록)
    if (n.kind === 'affinity' && onOpenAffinity) { onOpenAffinity(); return; }
    // 쿠폰 도착 알림 → 쿠폰함
    if (n.kind === 'coupon' && onOpenCoupons) { onOpenCoupons(); return; }
    // 연결 신청 → 신청자 프로필(수락/거절 가능), 수락 → 상대 프로필(연락처 확인).
    // ⚠️ 상대 id 키가 트리거마다 달라(otherUserId/requesterId/targetId) 하나만 보면
    //    "연락처가 공개됐어요"처럼 눌러도 아무 데도 안 가는 죽은 알림이 생긴다. 전부 본다.
    // 채팅 알림은 gatheringId도 같이 실려오므로 gather 분기보다 먼저 봐야 한다
    if (n.kind === 'chat' && d.roomId && onOpenChat) { onOpenChat(String(d.roomId)); return; }
    // 프교 신청 → 프로필 교환함(수락/거절). 성사 알림은 상대 프로필로 간다(otherUserId).
    if (n.kind === 'profile_exchange_request' && onOpenExchanges) { onOpenExchanges(); return; }
    // 편지(0146) — 도착·연결은 그 편지로, 환불 안내는 편지함으로
    // 받은 편지는 도착 팝업으로 맞이한다(1014 — 안 읽었으면 팝업, 읽었으면 그 편지)
    if (n.kind === 'letter_arrived' && d.letterId) { appNav({ kind: 'letterPopup', letterId: String(d.letterId) }); return; }
    // 예전 '메시지' 알림 — 메시지는 편지로 옮겨졌다(0151). 보낸 사람의 편지를 찾아 연다
    if (n.kind === 'interest_message') {
      const from = d.senderId ?? d.otherUserId ?? d.requesterId ?? null;
      if (from) { appNav({ kind: 'letterPopup', fromUserId: String(from) }); return; }
      appNav({ kind: 'letters' });
      return;
    }
    if (n.kind.startsWith('letter_')) {
      if (d.letterId) appNav({ kind: 'letterDetail', letterId: String(d.letterId) });
      else appNav({ kind: 'letters' });
      return;
    }
    // 운영 조치(0139) — 중지 알림은 프로필 수정으로, 해제 알림은 인연으로
    if ((n.kind === 'credential_approved' || n.kind === 'credential_rejected') && onOpenBadges) { onOpenBadges(); return; }
    if ((n.kind === 'profile_suspended' || n.kind === 'profile_nudge') && onOpenProfileEdit) { onOpenProfileEdit(); return; }
    if (n.kind === 'profile_restored' && onOpenAffinity) { onOpenAffinity(); return; }
    const otherId = d.otherUserId ?? d.requesterId ?? d.targetId ?? null;
    if (otherId && onOpenProfile) { onOpenProfile(String(otherId)); return; }
    if (d.gatheringId && onOpenGather) { onOpenGather(String(d.gatheringId)); return; }
    if (d.postId && onOpenPost) {
      // 댓글·답글 알림은 그 댓글을 펼쳐 강조한다(시안 focused-comment)
      if (d.commentId) setFocusComment(String(d.commentId));
      onOpenPost(String(d.postId)); return;
    }
    // 위 어디에도 안 걸리는 알림은 최소한 관련 화면으로 — 죽은 탭을 만들지 않는다.
    if (n.kind.startsWith('connect') && onOpenAffinity) onOpenAffinity();
  }

  // 모두 읽음 — 이 화면에 보이는 커뮤니티 알림만 읽음 처리(서버 기존 읽음 처리 그대로)
  function markAll() {
    list.filter((n) => !n.read).forEach((n) => previewActions.markNotifRead(n.id));
    serverList.filter((n) => !n.read).forEach((n) => markServerRead.mutate(n.id));
  }

  // 프로필 교환 — 요청·수락·완료를 교환 목록에서 만든다. 같은 교환의 서버 알림은 이 줄로 합친다(읽음 표시만 빌림)
  const exchanges = useMyProfileExchanges().data ?? [];
  const exNotifs = (id: string) => serverList.filter((n) => n.kind.startsWith('profile_exchange') && String(n.data?.exchangeId ?? '') === id);
  const merged = new Set<string>();
  // 기다리는 받은 요청은 맨 위 고정 줄 하나로 모은다(같은 요청의 서버 알림도 그 줄에 합친다)
  const waiting = exchanges.filter((e) => e.direction === 'received' && e.status === 'pending');
  waiting.forEach((e) => exNotifs(e.id).forEach((n) => merged.add(n.id)));
  const exRows: Row[] = exchanges.filter((e) => e.status !== 'declined' && e.status !== 'released' && !(e.direction === 'received' && e.status === 'pending')).map((e: ExchangeRow) => {
    const ns = exNotifs(e.id);
    ns.forEach((n) => merged.add(n.id));
    const anon = e.anon_nickname ?? '익명';
    const name = e.nickname ?? anon;
    const done = e.status === 'accepted';
    // 시안 1021 문구 — 성사 · 보낸 요청 · 받은 요청(상태 문구) + 누가(내용 줄)
    const title = done ? '프로필 교환이 성사됐어요.' : e.direction === 'sent' ? '프로필 교환을 요청했어요.' : '프로필 교환 요청이 도착했어요.';
    const preview = done
      ? (e.direction === 'sent' ? `${name}님이 요청을 수락했어요.` : `${name}님과 프로필을 교환했어요.`)
      : e.direction === 'sent' ? `${anon}님의 답변을 기다리고 있어요.` : `${anon}님이 프로필 교환을 요청했어요.`;
    return {
      key: `x_${e.id}`,
      icon: 'exchange' as const,
      title,
      preview,
      at: ms(done ? e.responded_at ?? e.created_at : e.created_at),
      unread: ns.some((n) => !n.read),
      onPress: () => {
        ns.filter((n) => !n.read).forEach((n) => markServerRead.mutate(n.id));
        if (done && e.other_id && onOpenProfile) onOpenProfile(e.other_id);
        else { setExchangeFocus(e.id); onOpenExchanges?.(); }  // 시안: 그 요청 하나만(탭 없이)
      },
    };
  });
  const rows: Row[] = [
    ...exRows,
    ...serverList.filter((n) => !merged.has(n.id)).map((n) => ({
      key: `s_${n.id}`, icon: serverIcon(n.kind), title: serverTitle(n), preview: n.body ?? '',
      at: ms(n.created_at), unread: !n.read, onPress: () => handleServer(n),
    })),
  ].sort((a, b) => (b.at || 0) - (a.at || 0));
  // 기기에만 있는 알림(시각 문자열만 있음)은 뒤에
  const localRows: Row[] = list.map((n) => ({
    key: `l_${n.id}`, icon: ICONS[n.kind], title: n.title, preview: n.body, at: null, timeText: n.time, unread: !n.read, onPress: () => handleLocal(n),
  }));
  const all = [...rows, ...localRows];
  const anyUnread = all.some((r) => r.unread) || waiting.some((e) => exNotifs(e.id).some((n) => !n.read));
  function markAllRead() {
    markAll();
    waiting.forEach((e) => exNotifs(e.id).filter((n) => !n.read).forEach((n) => markServerRead.mutate(n.id)));
    previewActions.showToast('모두 읽음으로 표시했어요');
  }
  // 묶음 — 오늘 · 이번 주 · 이전(기기에만 있는 알림은 시각이 없어 '이전')
  const sections = (['오늘', '이번 주', '이전'] as const)
    .map((title) => ({ title, data: all.filter((r) => (r.at ? noticeGroup(r.at, now) : '이전') === title) }))
    .filter((sec) => sec.data.length > 0);
  const pad = useTabBarClearance();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="새로운 소식" onBack={onBack} right={(
        <Pressable onPress={markAllRead} disabled={!anyUnread} accessibilityRole="button" accessibilityLabel="커뮤니티 알림 모두 읽음" accessibilityState={{ disabled: !anyUnread }} hitSlop={8} style={{ height: 44, paddingLeft: 12, justifyContent: 'center', opacity: anyUnread ? 1 : 0.4 }}>
          <Text style={{ fontSize: 14, lineHeight: 20.3, fontWeight: '600', color: colors.accent }}>모두 읽음</Text>
        </Pressable>
      )} />
      <SectionList
        sections={sections}
        keyExtractor={(r) => r.key}
        contentContainerStyle={{ paddingTop: 16, paddingHorizontal: layout.gutter, paddingBottom: pad }}
        stickySectionHeadersEnabled={false}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        extraData={now}
        ListHeaderComponent={waiting.length > 0 ? <PinRow n={waiting.length} onPress={() => onOpenExchanges?.()} /> : null}
        ListEmptyComponent={waiting.length > 0 ? null : (
          <View style={{ paddingTop: 96, alignItems: 'center' }}>
            <T v="heading4">아직 새로운 소식이 없어요</T>
            <T v="body2" color={colors.mute} center style={{ marginTop: 6 }}>내 글에 댓글이 달리면 여기에 모여요.</T>
          </View>
        )}
        renderSectionHeader={({ section }) => (
          // 묶음 제목 — 13 600 글자-연 · 위 24 · 아래 4(첫 묶음이 화면 맨 위면 위 여백 없이)
          <Text style={{ marginTop: section.title === sections[0]?.title && waiting.length === 0 ? 0 : 24, marginBottom: 4, fontSize: 13, lineHeight: 16, fontWeight: '600', color: colors.mute }}>{section.title}</Text>
        )}
        renderItem={({ item }) => <NoticeRow r={item} now={now} />}
      />
    </View>
  );
}

// 종류 아이콘 원 40
function KindIcon({ k }: { k: IconKey }) {
  const bg = k === 'talk' ? colors.selected : k === 'exchange' ? colors.loveSoft : colors.bgSoft;
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      {k === 'talk' ? <CLine name="talk" size={20} color={colors.accentStrong} /> : k === 'exchange' ? <CLine name="person" size={20} color={colors.loveStrong} /> : <CIcon name="bell" size={20} color={colors.textSecondary} />}
    </View>
  );
}

// 맨 위 고정 줄(.nt-pin) — 흰 바탕 + 테두리 1 · 모서리 16 · 안쪽 14/16: 장미 원 40 + ["프로필 교환 요청" 14/19.6 600 / "이야기에서 시작한 인연" 13/22.75] + 개수 알약 + 꺾쇠 20. 누름 0.98
function PinRow({ n, onPress }: { n: number; onPress: () => void }) {
  const press = usePress(0.98);
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={`프로필 교환 요청 ${n}개`}>
      <Animated.View style={[{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.card, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 }, press.scaleStyle]}>
        <KindIcon k="exchange" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, lineHeight: 19.6, fontWeight: '600', color: colors.text }}>프로필 교환 요청</Text>
          <Text style={{ fontSize: 13, lineHeight: 22.75, color: colors.sub }}>이야기에서 시작한 인연</Text>
        </View>
        <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 7, backgroundColor: colors.badge, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 12, lineHeight: 14, fontWeight: '600', color: colors.inverse, fontVariant: ['tabular-nums'] }}>{n}</Text>
        </View>
        <Icon name="chevron-right" size={20} color={colors.mute} />
      </Animated.View>
    </Pressable>
  );
}

// 소식 줄(.nt-it) — 폭 전체 · 안쪽 12 · 모서리 16 · 줄 사이 4. 안 읽음: sky-50 80% 바탕 + 오른쪽 위(오른쪽 14 · 위 18) 점 8. 누르는 동안 #E3E7EA
function NoticeRow({ r, now }: { r: Row; now: number }) {
  return (
    <Pressable
      onPress={r.onPress}
      accessibilityRole="button"
      accessibilityLabel={`${r.unread ? '읽지 않은 소식, ' : ''}${r.title}`}
      style={({ pressed }) => ({ marginTop: 4, padding: 12, borderRadius: radius.card, flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: pressed ? colors.muted : r.unread ? UNREAD_BG : 'transparent' })}
    >
      <KindIcon k={r.icon} />
      <View style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
        <Text numberOfLines={2} style={{ fontSize: 14, lineHeight: 20.3, fontWeight: '600', color: colors.text }}>{r.title}</Text>
        {!!r.preview && <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12, lineHeight: 18, color: colors.mute }}>{r.preview}</Text>}
        <Text style={{ marginTop: 2, fontSize: 11, lineHeight: 15.4, color: colors.mute }}>{r.at ? noticeAgo(r.at, now) : r.timeText}</Text>
      </View>
      {r.unread && <Dot style={{ position: 'absolute', right: 14, top: 18 }} label="안 읽음" />}
    </Pressable>
  );
}
