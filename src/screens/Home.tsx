// 야화 — 인연 홈 탭 화면 (리뉴얼 1120 · 시안 #discovery, spec-dating §3.1)
// 머리(제목 '오늘의 인연' · 일정 문구 · 보유 리프 · 추천 설정) + 오늘의 인연 카드 줄. 쉬어가는 중이면 안내 카드만,
// 프로필 등록 전 · 공개 중지 회원은 gate(안내)만 보인다. 화면은 하단 메뉴 뒤까지 깔고 안쪽에서 메뉴 자리를 비운다.
import React, { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, type as typo } from '../tokens';
import { previewSelectors, usePreview, requireAuth } from '../lib/previewStore';
import { useOnScreenInactive } from '../components/KeepAlive';
import { HIDE_IOS_CURRENCY } from '../lib/flags';
import { AffinityDeckTab } from './AffinityDeck';
import { RestingCard } from '../components/affinity/HomeCards';
import { MyLine } from '../components/my/icons';
import { PrefsSheet } from '../components/affinity/PrefsSheet';
import { VisibilitySheet } from '../components/VisibilitySheet';
import { appNav } from '../lib/appNav';
import { LeafIcon, usePress } from '../ui';

const COAST = require('../../assets/renewal/discovery-coast.jpg');

// 인연 홈 머리 — 높이 106(카드 줄이 여기서 시작). 제목 left 20 · top 12, 일정 문구 top 58, 리프 right 20 · top 10(오른쪽 구석),
// 추천 설정 right 20 · top 52(44) — 리프 아래 · 카드 오른쪽 끝 위(카드까지 10). 일정 문구 줄 오른쪽 빈자리라 카드는 그대로(시안 home-prefs A안, 11-23)
// 11-22 탭 제목 위 여백 30 → 12(머리 전체 18 위로, 그만큼 카드가 길어진다)
function HomeHeader({ onOpenCharge, onOpenPrefs, prefsOpen, tools }: { onOpenCharge?: () => void; onOpenPrefs: () => void; prefsOpen: boolean; tools: boolean }) {
  const leaf = usePreview(previewSelectors.leafBalance);
  const leafPress = usePress(0.94);
  const filterPress = usePress(0.94);
  return (
    <View style={{ height: 106 }}>
      <Text accessibilityRole="header" style={[typo.tabTitle, { position: 'absolute', left: 20, top: 12 }]}>오늘의 인연</Text>
      {tools && <Text style={{ position: 'absolute', left: 20, top: 58, fontSize: 12, lineHeight: 20, color: colors.mute }}>매일 12시 · 15시 · 18시 · 21시, 두 명씩</Text>}
      {!HIDE_IOS_CURRENCY && (
        <Pressable
          onPress={onOpenCharge}
          onPressIn={leafPress.onPressIn}
          onPressOut={leafPress.onPressOut}
          accessibilityRole="button"
          accessibilityLabel={`보유 리프 ${leaf}개 · 리프 화면 열기`}
          style={{ position: 'absolute', right: 20, top: 10, height: 44, paddingHorizontal: 6, justifyContent: 'center' }}
        >
          <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, leafPress.scaleStyle]}>
            <LeafIcon size={20} color={colors.textSecondary} />
            <Text style={{ fontSize: 14, lineHeight: 14, fontWeight: '600', letterSpacing: -0.2, color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{leaf.toLocaleString()}</Text>
          </Animated.View>
        </Pressable>
      )}
      {tools && (
        <Pressable
          onPress={onOpenPrefs}
          onPressIn={filterPress.onPressIn}
          onPressOut={filterPress.onPressOut}
          accessibilityRole="button"
          accessibilityLabel="인연 추천 설정"
          accessibilityState={{ expanded: prefsOpen }}
          style={{ position: 'absolute', right: 20, top: 52, width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: prefsOpen ? colors.muted : 'transparent' }}
        >
          <Animated.View style={filterPress.scaleStyle}><MyLine name="slider" size={22} color={colors.textSecondary} /></Animated.View>
        </Pressable>
      )}
    </View>
  );
}

export function Home({
  onOpenFriend,
  onOpenCharge,
  gate,
}: {
  // 프로필 등록 전·공개 중지 안내 — 있으면 머리 아래 카드 줄 대신 이것만 보인다
  gate?: React.ReactNode;
  onOpenFriend?: (userId: string) => void;  // 상대 프로필
  onOpenCharge?: () => void;
}) {
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  useOnScreenInactive(() => { setVisibilityOpen(false); setPrefsOpen(false); });
  const me = usePreview(previewSelectors.myProfile);
  const resting = !!(me?.affinityDeckPaused || me?.affinityHidden);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* 맨 위 바다 결(시안 #discovery:before) — 높이 175 · 투명도 0.18 · 위아래로 사라진다 */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 175 }}>
        <Image source={COAST} style={[StyleSheet.absoluteFill, { opacity: 0.18 }]} contentFit="cover" />
        <LinearGradient colors={['#FFFFFF', 'rgba(255,255,255,0)', '#FFFFFF']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <HomeHeader
        onOpenCharge={onOpenCharge}
        prefsOpen={prefsOpen}
        onOpenPrefs={() => { if (requireAuth('취향 설정은 로그인 후 할 수 있어요')) setPrefsOpen(true); }}
        tools={!gate}
      />
      <View style={{ flex: 1 }}>
        {gate ? (
          gate
        ) : resting ? (
          <RestingCard onOpenVisibility={() => setVisibilityOpen(true)} />
        ) : (
          <AffinityDeckTab onOpenProfile={onOpenFriend} onOpenVisibility={() => setVisibilityOpen(true)} onOpenCharge={onOpenCharge} />
        )}
      </View>
      {/* 인연 공개 설정 — 쉬는 중 카드의 [다시 공개하기]에서 연다 */}
      <VisibilitySheet open={visibilityOpen} onClose={() => setVisibilityOpen(false)} />
      {/* 추천 설정 시트 — 나이 · 지역을 바로 바꾸고, 나머지는 '전체 조건'(취향 설정 화면)에서 */}
      <PrefsSheet open={prefsOpen} onClose={() => setPrefsOpen(false)} onOpenAll={() => { setPrefsOpen(false); appNav({ kind: 'matchPrefs' }); }} />
    </View>
  );
}
