// 야화 — 모임 홈 (리뉴얼: yahwa-social-ui 레이아웃 포트).
// '모임' → '모임' 워딩 통일. "내가 원하는 모임 만들기"를 상단에 배치해 모임 생성을 유도.
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, shadow } from '../tokens';
import { Icons } from '../icons';
import { Chip, useTabBarClearance } from '../components/atoms';
import { CAT_BG, fillCount, Gather } from '../data/mock';
import { usePreview, previewSelectors, requireAuth, getCurrentUserId } from '../lib/previewStore';
import { thumbUrl } from '../lib/img';
import { useGatheringsFull, useMySettlementInfo, useHomeBanners, useServerNotifs, useMyFollowedHostIds } from '../lib/hooks';
import { adaptServerGather } from '../lib/api';
import { GatherCreate } from './GatherCreate';
import { GatherChatTab } from './ChatList';
import { RegionPicker } from '../components/RegionPicker';
import { SettlementPromptSheet } from '../components/SettlementPromptSheet';
import { restoreRef, saveScrollHandler } from '../lib/scrollMemory';
import { ALL_CATEGORIES } from '../data/categories';

// 카테고리 리뉴얼(대표 지시 2026-08-18, 문토 참고) — 대표 타일 4종 + 더보기 시트의 전체 목록.
// 저장값은 라벨 그대로(gatherings.cat text). 기존 저장값(자유만남/와인/낮술/러닝/맛집/보드게임/기타)도
// 아래 그룹 매핑으로 계속 검색된다.

// 대표 타일(더보기 제외) — 5번째 참고 사진 레이아웃과 동일 구성
const CAT_TILES: { label: string; icon: keyof typeof Icons }[] = [
  { label: '자유만남', icon: 'users' },
  { label: '술·맛집', icon: 'martini' },
  { label: '운동', icon: 'dumbbell' },
  { label: '문화·취미', icon: 'palette' },
];
// 그룹 타일 → 포함되는 세부 카테고리(레거시 저장값 포함)
const CAT_GROUPS: Record<string, string[]> = {
  '술·맛집': ['술·맛집', '와인', '낮술', '맛집', '맛집투어', '카페'],
  '운동': ['운동', '러닝', '등산', '테니스', '골프', '볼링'],
  '문화·취미': ['문화·취미', '전시·공연', '영화', '음악', '사진', '보드게임', '게임', '독서'],
};

// '모임 필터' 퀵필터 — 마감 임박 / 오늘 / 주말 / 소규모(총정원 4명 이하 = 2:2 이하)
const QUICK: { key: string; label: string }[] = [
  { key: 'deadline', label: '마감 임박' },
  { key: 'today', label: '오늘 모임' },
  { key: 'weekend', label: '주말 모임' },
  { key: 'small', label: '소규모' },
];

function sameLocalDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// 특정 날짜(YYYY-MM-DD) 매칭 — 날짜 시트에서 하루를 고르는 방식(대표 지시).
function matchesDate(g: Gather, ymd: string): boolean {
  if (!g.startAt) return false;
  const t = new Date(g.startAt);
  if (!Number.isFinite(t.getTime())) return false;
  const d = new Date(ymd + 'T00:00:00');
  return sameLocalDate(t, d);
}
function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 퀵필터 판정 — 마감임박(정원 70%+ 또는 48시간 내 시작) / 오늘 / 주말 / 소규모(총 4명 이하)
function matchesQuick(g: Gather, key: string): boolean {
  const c = fillCount(g);
  const now = Date.now();
  const ratio = c.total > 0 ? c.cur / c.total : 0;
  switch (key) {
    case 'deadline': {
      const almostFull = c.total > 0 && ratio >= 0.7 && c.cur < c.total;
      const startSoon = !!g.startAt && (() => {
        const t = new Date(g.startAt as string).getTime();
        return Number.isFinite(t) && t > now && t - now <= 48 * 3600_000;
      })();
      return almostFull || startSoon;
    }
    case 'today': return !!g.startAt && sameLocalDate(new Date(g.startAt as string), new Date());
    case 'weekend': {
      if (!g.startAt) return false;
      const t = new Date(g.startAt as string);
      const day = t.getDay();
      const diff = t.getTime() - now;
      return (day === 0 || day === 6) && diff > -12 * 3600_000 && diff <= 7 * 24 * 3600_000;
    }
    case 'small': return (g.capacity ?? c.total) <= 4;   // 2:2 이하
    default: return true;
  }
}

// 히어로 배너 — admin에서 업로드한 배너를 큰 이미지 캐러셀로 노출 (Munto 스타일).
// 배너가 없으면 렌더하지 않는다.
function BannerCarousel() {
  const [idx, setIdx] = React.useState(0);
  // admin 배너 규격 1:1 (1080×1080 권장) — 인물 그룹 샷 기준 모바일 최적
  const HERO_RATIO = 1;
  const [containerW, setContainerW] = React.useState(0);
  const bannersQ = useHomeBanners();
  const banners = bannersQ.data ?? [];
  if (banners.length === 0) return null;

  function onScrollEnd(e: any) {
    if (containerW > 0) setIdx(Math.round(e.nativeEvent.contentOffset.x / containerW));
  }

  return (
    <View
      style={{ marginTop: 8, marginHorizontal: 16, borderRadius: radius.card, overflow: 'hidden' }}
      onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}
    >
      {containerW > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          onScroll={onScrollEnd}
          scrollEventThrottle={16}
          snapToInterval={containerW}
          decelerationRate="fast"
        >
          {banners.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => { if (b.link_url) openHeroLink(b.link_url); }}
              style={{ width: containerW }}
            >
              <View style={{ aspectRatio: HERO_RATIO, backgroundColor: colors.bgSoft }}>
                <Image source={{ uri: thumbUrl(b.image_url, 1080) ?? b.image_url }} style={StyleSheet.absoluteFillObject} contentFit="cover" transition={150} cachePolicy="memory-disk" />
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {banners.length > 1 && (
        <View
          style={{
            position: 'absolute', right: 10, bottom: 10,
            paddingHorizontal: 8, paddingVertical: 3,
            borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.45)',
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '500', color: '#fff' }}>
            {idx + 1}/{banners.length}
          </Text>
        </View>
      )}
    </View>
  );
}

// 배너 링크 열기 — 외부 URL은 브라우저, yahwa:// 등은 Linking
function openHeroLink(url: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  } else {
    const { Linking } = require('react-native');
    Linking.openURL(url).catch(() => {});
  }
}

// ⚠️ 함수형 — 모듈 상수로 두면 로드 시점 팔레트가 고정돼 다크모드 스왑이 반영되지 않는다
const circleBtn = () => ({
  width: 44,
  height: 44,
  borderRadius: 22,
  borderWidth: 1,
  borderColor: colors.line,
  backgroundColor: colors.surface,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
});

export type GatherTabKey = 'feed' | 'chat';

export function GatherFeed({
  onOpen, onOpenSettlementInfo, onOpenNotif,
  tab = 'feed', onTabChange, onOpenChatRoom,
}: {
  onOpen?: (id: string) => void;
  onOpenSettlementInfo?: () => void;
  onOpenNotif?: () => void;
  tab?: GatherTabKey;
  onTabChange?: (t: GatherTabKey) => void;
  onOpenChatRoom?: (roomId: string) => void;
}) {
  const tabBarSpace = useTabBarClearance();
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [curation, setCuration] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [catSheetOpen, setCatSheetOpen] = useState(false);   // 카테고리 '더보기' 시트
  const [region, setRegion] = useState<string | null>(null);
  const [regionOpen, setRegionOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchTxt, setSearchTxt] = useState('');
  const [showSettlementPrompt, setShowSettlementPrompt] = useState(false);
  const settlementQ = useMySettlementInfo();

  // 알림 미읽음 — 로컬 + 서버 합산 (기존 홈 헤더와 동일)
  const unreadLocal = usePreview(previewSelectors.unreadCount);
  const serverNotifsQ = useServerNotifs();
  const unread = unreadLocal + (serverNotifsQ.data ?? []).filter((n) => !n.read).length;

  const serverGathersQ = useGatheringsFull();
  const followedQ = useMyFollowedHostIds(!!getCurrentUserId());
  const followedIds = React.useMemo(() => new Set(followedQ.data ?? []), [followedQ.data]);
  const [followOnly, setFollowOnly] = React.useState(false);
  const allGathers = (serverGathersQ.data ?? []).map(adaptServerGather);

  // 홈에는 '모집 중이고 아직 시작 전'인 모임만 (대표 지시 0830).
  // 매칭 완료·취소·종료됐거나 시작 시각이 지난 모임은 '내 모임'에만 남는다.
  const openGathers = allGathers.filter((g) => {
    if (g.status && g.status !== 'recruiting') return false;
    if (g.startAt && new Date(g.startAt).getTime() < Date.now()) return false;
    return true;
  });

  // 필터 적용 — 지역 + 카테고리(그룹 매핑) + 특정 날짜 + 퀵필터(AND)
  const filtered = openGathers.filter((g) => {
    if (region && g.region !== region) return false;
    if (catFilter) {
      const group = CAT_GROUPS[catFilter];
      if (group ? !group.includes(g.cat) : g.cat !== catFilter) return false;
    }
    if (dateFilter && !matchesDate(g, dateFilter)) return false;
    if (curation && !matchesQuick(g, curation)) return false;
    if (followOnly && !(g.host.userId && followedIds.has(g.host.userId))) return false;
    return true;
  });
  // 팔로우한 호스트의 모임을 위로 — 재참여 유도
  filtered.sort((a, b) => {
    const fa = a.host.userId && followedIds.has(a.host.userId) ? 1 : 0;
    const fb = b.host.userId && followedIds.has(b.host.userId) ? 1 : 0;
    return fb - fa;
  });
  const list = searchTxt.trim()
    ? filtered.filter((g) => g.title.includes(searchTxt.trim()) || g.place.includes(searchTxt.trim()) || g.cat.includes(searchTxt.trim()) || g.tags.some((t) => t.includes(searchTxt.trim())))
    : filtered;

  // '오늘 인기 모임' — 모집 중인 모임에서 랜덤 1개. 데이터가 새로 오면(dataUpdatedAt 변경 =
  // 앱 재실행·당겨 새로고침·탭 복귀 재조회) 픽도 바뀐다.
  const heroPick = React.useMemo(() => {
    const pool = openGathers;
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverGathersQ.dataUpdatedAt]);

  const dateLabel = dateFilter
    ? (() => { const d = new Date(dateFilter + 'T00:00:00'); return `${d.getMonth() + 1}/${d.getDate()}(${['일','월','화','수','목','금','토'][d.getDay()]})`; })()
    : null;

  function openCreate() {
    if (!requireAuth('모임 만들기는 로그인 후 가능해요')) return;
    setCreateOpen(true);
  }

  // 서브탭 바 — 기존 '전체' 카테고리 탭바 자리를 '모임 | 채팅'으로 대체(대표 지시 0826).
  // 세부 카테고리 탭 복원 시 ALL_CATEGORIES를 이 아래에 다시 매핑하면 된다.
  const subTabs = (
    <View style={{ flexDirection: 'row', gap: 18 }}>
      {([['feed', '모임'], ['chat', '채팅']] as const).map(([k, label]) => {
        const active = tab === k;
        return (
          <Pressable key={k} onPress={() => onTabChange?.(k)} style={{ paddingTop: 10, paddingBottom: 12, position: 'relative' }}>
            <Text style={{ fontSize: 14.5, fontWeight: active ? '700' : '500', color: active ? colors.text : colors.mute }}>{label}</Text>
            {active && (
              <View style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 3, backgroundColor: colors.primary, borderRadius: 2 }} />
            )}
          </Pressable>
        );
      })}
    </View>
  );

  // 상단 헤더 — 서브탭(모임 | 채팅) + 검색·알림. 지역은 아래 필터 행으로 내렸다.
  const header = (showSearch: boolean) => (
    <View
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingTop: 4,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft,
      }}
    >
      {subTabs}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {showSearch && (
          <Pressable
            style={circleBtn()}
            onPress={() => { setSearching((v) => !v); if (searching) setSearchTxt(''); }}
          >
            <Icons.search size={19} color={colors.text} />
          </Pressable>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel="알림" hitSlop={8} style={circleBtn()} onPress={onOpenNotif}>
          <Icons.bell size={19} color={colors.text} />
          {unread > 0 && (
            <View
              style={{
                position: 'absolute', top: 6, right: 6,
                minWidth: 14, height: 14, paddingHorizontal: 3,
                backgroundColor: colors.danger, borderRadius: 7,
                borderWidth: 1.5, borderColor: colors.surface,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );

  // 채팅 탭 — 피드 ScrollView 안에 넣으면 스크롤이 중첩되므로 별도 분기로 렌더한다.
  if (tab === 'chat') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        {header(false)}
        <GatherChatTab onOpenRoom={onOpenChatRoom} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {header(true)}

      {searching && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <View
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              height: 42, paddingHorizontal: 12,
              borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.text,
              backgroundColor: colors.surface,
            }}
          >
            <Icons.search size={18} color={colors.text} />
            <TextInput
              value={searchTxt}
              onChangeText={setSearchTxt}
              autoFocus
              placeholder="모임 검색 (제목·지역·카테고리·태그)"
              placeholderTextColor={colors.mute}
              style={[
                { flex: 1, height: 40, fontSize: 12.5, color: colors.text },
                Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none' } as any) : null,
              ]}
            />
            <Pressable onPress={() => { setSearching(false); setSearchTxt(''); }}>
              <Icons.close size={18} color={colors.sub} />
            </Pressable>
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarSpace }}
        ref={restoreRef('gather-feed')}
        onScroll={saveScrollHandler('gather-feed')}
        scrollEventThrottle={120}
      >
        {/* 히어로 배너 — 대표 지시(2026-08-18)로 숨김. 복원 시 <BannerCarousel /> 되살릴 것
            (admin 배너 업로드 기능은 그대로 유지). */}

        {/* 오늘의 모임 — 모집 중에서 랜덤 픽. 전면 이미지 + 하단 그라데이션 오버레이 */}
        {heroPick && (
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <Pressable
              onPress={() => onOpen?.(heroPick.id)}
              style={[
                { height: 210, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.bgSoft },
                shadow.card as any,
              ]}
            >
              <Image source={{ uri: thumbUrl(heroPick.cover, 720) ?? heroPick.cover }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
              <LinearGradient
                colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0.06)', 'rgba(0,0,0,0.88)']}
                locations={[0, 0.32, 1]}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16, gap: 5 }}>
                <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: -0.4 }}>{heroPick.title}</Text>
                <Text numberOfLines={1} style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.86)' }}>
                  {[fmtStart(heroPick), heroPick.place].filter(Boolean).join(' · ')}
                </Text>
                {(() => { const c = fillCount(heroPick); return (
                  <Text style={{ fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.86)' }}>{c.cur} / {c.total}명</Text>
                ); })()}
              </View>
            </Pressable>
          </View>
        )}

        {/* 카테고리 — 라인 아이콘 한 줄(대표 지시 0827: 이모지 폐지) */}
        <View style={{ paddingHorizontal: 16, paddingTop: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 15.5, fontWeight: '700', color: colors.text, letterSpacing: -0.3 }}>카테고리</Text>
          <Pressable onPress={() => setCatSheetOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '500', color: colors.mute }}>전체 보기</Text>
            <Icons.chev size={13} color={colors.mute} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 8, paddingTop: 16 }}>
          {CAT_TILES.map((c) => {
            const act = catFilter === c.label;
            const Ico = Icons[c.icon];
            return (
              <Pressable
                key={c.label}
                onPress={() => setCatFilter(act ? null : c.label)}
                style={{ flex: 1, alignItems: 'center', gap: 8, paddingVertical: 4 }}
              >
                <Ico size={26} color={act ? colors.primary : colors.text} />
                <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: act ? '700' : '500', color: act ? colors.primary : colors.sub }}>{c.label}</Text>
              </Pressable>
            );
          })}
          {(() => {
            const act = !!catFilter && !CAT_TILES.some((c) => c.label === catFilter);
            return (
              <Pressable onPress={() => setCatSheetOpen(true)} style={{ flex: 1, alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                <Icons.grid size={26} color={act ? colors.primary : colors.text} />
                <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: act ? '700' : '500', color: act ? colors.primary : colors.sub }}>
                  {act ? catFilter : '더보기'}
                </Text>
              </Pressable>
            );
          })()}
        </View>

        {/* 필터 행 — '모임 필터'(큐레이션) + '날짜 선택' + '지역'을 나란히 (대표 지시 0827) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 24 }}
          style={{ flexGrow: 0 }}
        >
          <Pressable
            onPress={() => { setQuickOpen((v) => !v); setDateOpen(false); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingHorizontal: 12, height: 34, borderRadius: radius.pill,
              borderWidth: 1, borderColor: curation ? colors.text : colors.line,
              backgroundColor: curation ? colors.text : colors.surface,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: curation ? colors.bg : colors.text }}>
              {curation ? (QUICK.find((q) => q.key === curation)?.label ?? '모임 필터') : '모임 필터'}
            </Text>
            <Icons.chevDown size={13} color={curation ? colors.bg : colors.mute} />
          </Pressable>
          <Pressable
            onPress={() => { setDateOpen((v) => !v); setQuickOpen(false); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingHorizontal: 12, height: 34, borderRadius: radius.pill,
              borderWidth: 1, borderColor: dateFilter ? colors.text : colors.line,
              backgroundColor: dateFilter ? colors.text : colors.surface,
            }}
          >
            <Icons.calendar size={14} color={dateFilter ? colors.bg : colors.text} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: dateFilter ? colors.bg : colors.text }}>
              {dateLabel ?? '날짜 선택'}
            </Text>
            <Icons.chevDown size={13} color={dateFilter ? colors.bg : colors.mute} />
          </Pressable>
          <Pressable
            onPress={() => setRegionOpen(true)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingHorizontal: 12, height: 34, borderRadius: radius.pill,
              borderWidth: 1, borderColor: region ? colors.text : colors.line,
              backgroundColor: region ? colors.text : colors.surface,
            }}
          >
            <Icons.pin size={14} color={region ? colors.bg : colors.text} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: region ? colors.bg : colors.text }}>
              {region ?? '전체 지역'}
            </Text>
            <Icons.chevDown size={13} color={region ? colors.bg : colors.mute} />
          </Pressable>
          {followedIds.size > 0 && (
            <Pressable
              onPress={() => setFollowOnly((v) => !v)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                paddingHorizontal: 12, height: 34, borderRadius: radius.pill,
                borderWidth: 1, borderColor: followOnly ? colors.text : colors.line,
                backgroundColor: followOnly ? colors.text : colors.surface,
              }}
            >
              <Icons.bell size={13} color={followOnly ? colors.bg : colors.mute} />
              <Text style={{ fontSize: 12, fontWeight: '600', color: followOnly ? colors.bg : colors.text }}>팔로잉</Text>
            </Pressable>
          )}
          {(curation || dateFilter || region || followOnly) && (
            <Pressable onPress={() => { setCuration(null); setDateFilter(null); setRegion(null); setFollowOnly(false); }} hitSlop={8} style={{ padding: 4 }}>
              <Icons.close size={15} color={colors.mute} />
            </Pressable>
          )}
        </ScrollView>
        {quickOpen && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingTop: 12 }} style={{ flexGrow: 0 }}>
            {QUICK.map((q) => {
              const act = curation === q.key;
              return (
                <Pressable
                  key={q.key}
                  onPress={() => { setCuration(act ? null : q.key); setQuickOpen(false); }}
                  style={{
                    paddingHorizontal: 14, height: 34, justifyContent: 'center',
                    borderRadius: radius.pill, backgroundColor: act ? colors.text : colors.surface,
                    borderWidth: 1, borderColor: act ? colors.text : colors.line,
                  }}
                >
                  <Text style={{ fontSize: 11.5, fontWeight: act ? '700' : '500', color: act ? colors.bg : colors.sub }}>{q.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
        {dateOpen && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingTop: 12 }} style={{ flexGrow: 0 }}>
            {Array.from({ length: 60 }, (_, i) => {
              const d = new Date(); d.setDate(d.getDate() + i);
              const key = ymdOf(d);
              const act = dateFilter === key;
              const dow = ['일','월','화','수','목','금','토'][d.getDay()];
              return (
                <Pressable
                  key={key}
                  onPress={() => { setDateFilter(act ? null : key); setDateOpen(false); }}
                  style={{
                    width: 52, paddingVertical: 9, alignItems: 'center', gap: 2,
                    borderRadius: radius.md, backgroundColor: act ? colors.text : colors.surface,
                    borderWidth: 1, borderColor: act ? colors.text : colors.line,
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '500', color: act ? colors.bg : (d.getDay() === 0 ? colors.danger : d.getDay() === 6 ? '#3B82F6' : colors.mute) }}>
                    {i === 0 ? '오늘' : dow}
                  </Text>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: act ? colors.bg : colors.text }}>
                    {d.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* 모임 리스트 — 섹션 헤더(모집 수) + 모임 만들기 */}
        <View style={{ paddingHorizontal: 16, paddingTop: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 15.5, fontWeight: '700', color: colors.text, letterSpacing: -0.3 }}>
            지금 모집 중{list.length > 0 ? ` ${list.length}` : ''}
          </Text>
          <Pressable onPress={openCreate} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icons.plus size={15} color={colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>모임 만들기</Text>
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 12 }}>
          {list.map((g) => (
            <RowCard key={g.id} g={g} followed={!!(g.host.userId && followedIds.has(g.host.userId))} onPress={() => onOpen?.(g.id)} />
          ))}
          {list.length === 0 && (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 11.5, color: colors.mute }}>조건에 맞는 모임이 없어요</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 카테고리 전체 시트 (더보기) */}
      {catSheetOpen && (
        <Pressable onPress={() => setCatSheetOpen(false)} style={[StyleSheet.absoluteFillObject as any, { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }]}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: 10, paddingBottom: 28, maxHeight: '70%' }}>
            <View style={{ width: 40, height: 4, backgroundColor: colors.line, borderRadius: 2, alignSelf: 'center', marginBottom: 12 }} />
            <Text style={{ fontSize: 15.5, fontWeight: '800', color: colors.text, paddingHorizontal: 18, marginBottom: 12 }}>모임 카테고리</Text>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 8 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ALL_CATEGORIES.map((c) => {
                  const act = catFilter === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => { setCatFilter(act ? null : c); setCatSheetOpen(false); }}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill,
                        backgroundColor: act ? colors.text : colors.surface,
                        borderWidth: 1, borderColor: act ? colors.text : colors.line,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: act ? '700' : '500', color: act ? colors.bg : colors.sub }}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      )}

      {/* 모임 생성 FAB 제거 — 상단 '+ 모임 만들기' 텍스트 버튼으로 대체(목업) */}

      <RegionPicker
        visible={regionOpen}
        value={region}
        onSelect={(r) => { setRegion(r); setRegionOpen(false); }}
        onClose={() => setRegionOpen(false)}
      />
      <GatherCreate
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { if (!settlementQ.data) setShowSettlementPrompt(true); }}
      />
      <SettlementPromptSheet
        open={showSettlementPrompt}
        onClose={() => setShowSettlementPrompt(false)}
        onRegisterNow={() => { setShowSettlementPrompt(false); onOpenSettlementInfo?.(); }}
      />
    </View>
  );
}

function FilterTile({
  icon, title, sub, active, onPress,
}: {
  icon: React.ReactNode; title: string; sub: string; active?: boolean; onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderRadius: radius.lg,
        backgroundColor: active ? colors.surface : colors.bgSoft,
        borderWidth: 1,
        borderColor: active ? colors.text : 'transparent',
      }}
    >
      {icon}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.text }}>{title}</Text>
        <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '400', color: colors.mute, marginTop: 2 }}>{sub}</Text>
      </View>
    </Pressable>
  );
}

// 썸네일 배지 — 매칭완료 > 마감임박(잔여 2자리 이하) > D-day > 신규
function thumbBadge(g: Gather, cur: number, total: number): { label: string; bg: string; fg: string } | null {
  if (g.status === 'matched') return { label: '매칭 완료', bg: colors.night, fg: '#fff' };
  const remaining = total - cur;
  if (total > 0 && remaining > 0 && remaining <= 2) return { label: `${remaining}자리 남음`, bg: colors.surface, fg: colors.text };
  if (g.startAt) {
    const t = new Date(g.startAt as string);
    if (Number.isFinite(t.getTime())) {
      const now = new Date();
      if (sameLocalDate(t, now)) return { label: '오늘', bg: colors.surface, fg: colors.text };
      const days = Math.ceil((t.getTime() - now.getTime()) / (24 * 3600_000));
      if (days > 0 && days <= 7) return { label: `D-${days}`, bg: colors.surface, fg: colors.text };
    }
  }
  const isNew = !!g.createdAt && (() => {
    const t = new Date(g.createdAt as string).getTime();
    return Number.isFinite(t) && Date.now() - t <= 3 * 24 * 3600_000;
  })();
  if (isNew) return { label: 'NEW', bg: colors.surface, fg: colors.success };
  return null;
}

// 시작 시각 표기 — "오늘 오후 8:00" / "토요일 오후 3:00". start_at 없으면 when_text 폴백.
function fmtStart(g: Gather): string {
  if (g.startAt) {
    const t = new Date(g.startAt as string);
    if (Number.isFinite(t.getTime())) {
      const now = new Date();
      const tm = new Date(now); tm.setDate(now.getDate() + 1);
      const day = sameLocalDate(t, now)
        ? '오늘'
        : sameLocalDate(t, tm)
          ? '내일'
          : `${['일', '월', '화', '수', '목', '금', '토'][t.getDay()]}요일`;
      const h = t.getHours();
      const ampm = h < 12 ? '오전' : '오후';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      const mm = String(t.getMinutes()).padStart(2, '0');
      return `${day} ${ampm} ${h12}:${mm}`;
    }
  }
  return [g.when, g.whenTime].filter(Boolean).join(' ');
}

function RowCard({ g, followed, onPress }: { g: Gather; followed?: boolean; onPress?: () => void }) {
  const c = fillCount(g);
  const badge = thumbBadge(g, c.cur, c.total);
  const grad: readonly [string, string] = CAT_BG[g.cat] || [colors.night, '#0E0E11'];
  // 리뉴얼 전 카드의 "관심이 높아지고 있는 모임" 복원 — 게스트가 1명 이상 붙은 모임은
  // 참여자 프로필 스택으로 열기를 보여준다 (호스트 혼자면 미노출).
  const parts = [...g.slots.M, ...g.slots.F].filter((s) => s.filled);
  const guestCount = parts.filter((s) => !s.host).length;
  const showParts = guestCount >= 1 && g.status !== 'matched';
  // 성별 무관 모임은 ratio(2:2) 대신 1:1 / N명 표기
  const capLabel = g.genderMode === 'any'
    ? (g.capacity === 2 ? '1:1' : `${g.capacity ?? c.total}명`)
    : g.ratio;
  const feeLabel = (g.fee ?? 0) > 0 ? `${(g.fee as number).toLocaleString()}원` : '무료';

  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          flexDirection: 'row',
          gap: 14,
          backgroundColor: colors.surface,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.lineSoft,
          padding: 12,
        },
        shadow.card as any,
      ]}
    >
      {/* 썸네일 */}
      <View style={{ width: 96, height: 96, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.night }}>
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFillObject} />
        <Image source={{ uri: thumbUrl(g.cover, 320) ?? g.cover }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        {badge && (
          <View
            style={{
              position: 'absolute', top: 6, left: 6,
              paddingHorizontal: 7, paddingVertical: 3,
              backgroundColor: badge.bg, borderRadius: radius.pill,
            }}
          >
            <Text style={{ fontSize: 8, fontWeight: '700', color: badge.fg }}>{badge.label}</Text>
          </View>
        )}
      </View>

      {/* 메타 — 카드 안에서는 제목만 강조, 나머지는 보조 위계 */}
      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {followed && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, height: 17, borderRadius: radius.pill, backgroundColor: colors.primarySoft ?? colors.bgSoft }}>
              <Icons.bell size={9} color={colors.primary} />
              <Text style={{ fontSize: 8.5, fontWeight: '700', color: colors.primary }}>팔로잉</Text>
            </View>
          )}
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 10, fontWeight: '400', color: colors.mute }}>
            {[g.cat, g.place].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Text numberOfLines={2} style={{ fontSize: 13.5, fontWeight: '600', color: colors.text, lineHeight: 19, marginTop: 3 }}>
          {g.title}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: '400', color: colors.sub, marginTop: 4 }}>
          {fmtStart(g)} · {c.cur}/{c.total}명
        </Text>
        <View style={{ flexDirection: 'row', gap: 5, marginTop: 8 }}>
          <MiniTag>승인제</MiniTag>
          <MiniTag>{feeLabel}</MiniTag>
          <MiniTag>{capLabel}</MiniTag>
        </View>
        {showParts && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <View style={{ flexDirection: 'row' }}>
              {parts.slice(0, 4).map((s, i) => (
                <View
                  key={i}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    marginLeft: i === 0 ? 0 : -7,
                    borderWidth: 1.5,
                    borderColor: '#fff',
                    overflow: 'hidden',
                    backgroundColor: colors.mute,
                  }}
                >
                  {s.photo ? (
                    <Image
                      source={typeof s.photo === 'number' ? s.photo : { uri: thumbUrl(s.photo, 96) ?? s.photo }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                    />
                  ) : null}
                </View>
              ))}
            </View>
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 10, fontWeight: '600', color: colors.primary }}>
              {parts.length > 4 ? `+${parts.length - 4} · ` : ''}관심이 높아지고 있는 모임
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function MiniTag({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.sm,
        backgroundColor: colors.bgSoft,
        borderWidth: 1,
        borderColor: colors.lineSoft,
      }}
    >
      <Text style={{ fontSize: 9.5, fontWeight: '500', color: colors.sub }}>{children}</Text>
    </View>
  );
}
