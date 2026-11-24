// 매장 상세가 쓰는 조각 — 사진 넘기기 · 실시간 현황 줄(숨김 플래그) · 도보 길찾기
import React, { useState } from 'react';
import { View, Text, Pressable, Platform, Linking, ScrollView } from 'react-native';
import { SmartImg } from '../SmartImg';
import { colors, radius } from '../../tokens';
import type { Store } from '../../data/mock';
import { useGenderStats, useUnlockGenderFlow } from '../../lib/hooks';
import { HIDE_IOS_CURRENCY } from '../../lib/flags';
import { DetailRows, type DetailRow } from './ui';

// 매장 사진 — 폭 전체 16:10 · 모서리 16, 가로로 넘겨 본다(최대 5장). 2장 이상이면 오른쪽 위에 '1/n' 칩.
export function StorePhotos({ photos }: { photos: string[] }) {
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(0);
  return (
    <View
      onLayout={(e) => { const nw = Math.round(e.nativeEvent.layout.width); if (nw > 0 && nw !== w) setW(nw); }}
      style={{ width: '100%', aspectRatio: 16 / 10, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.bgSoft }}
    >
      {w > 0 && (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => { const i = Math.round(e.nativeEvent.contentOffset.x / w); if (i !== idx) setIdx(i); }}
          scrollEventThrottle={16}
        >
          {photos.map((uri, i) => (
            <View key={i} style={{ width: w, height: '100%' }}>
              {/* 잘리지 않게 전체를 보여 준다(1014 대표 지시) — 남는 자리는 옅은 회색 */}
              <SmartImg src={uri} width={1080} style={{ width: '100%', height: '100%' }} contentFit="contain" />
            </View>
          ))}
        </ScrollView>
      )}
      {photos.length > 1 && (
        <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: 10, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, backgroundColor: colors.scrimDeep }}>
          <Text style={{ fontSize: 11, lineHeight: 15.4, fontWeight: '600', color: colors.inverse, fontVariant: ['tabular-nums'] }}>{idx + 1}/{photos.length}</Text>
        </View>
      )}
    </View>
  );
}

// 실시간 현황(웨이팅 · 실시간 인원) — SHOW_STORE_LIVE가 켜질 때만 정보 표 줄로 그린다
export function StoreLiveRows({ s }: { s: Store }) {
  const genderQ = useGenderStats();
  const unlockFlow = useUnlockGenderFlow();  // 인증 → (여성 무료 · iOS 자동 · 리프 확인) → 잠금해제
  // 공개 요일 — 점주 설정(기본 금·토). 비공개 요일엔 웨이팅도 숨김.
  const openDays: number[] = (s as any).genderStatsOpenDays ?? [5, 6];
  const kstDow = new Date(Date.now() + 9 * 3600_000).getUTCDay();
  const waitingCount = s.waitingCount ?? 0;
  const g = genderQ.data?.[s.id];
  const rows: DetailRow[] = [];

  if (!openDays.includes(kstDow)) {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    rows.push({ label: '실시간 인원', value: `${[...openDays].sort((a, b) => a - b).map((d) => dayNames[d]).join('·')}요일에만 열려요` });
  } else {
    if (s.waitingEnabled !== false) {
      rows.push({ label: '웨이팅', value: waitingCount > 0 ? `${waitingCount}팀 대기${(s.waitingEtaMinutes ?? 0) > 0 ? ` · 약 ${s.waitingEtaMinutes}분` : ''}` : '바로 입장 가능' });
    }
    rows.push({
      label: '실시간 인원',
      value: g ? (s.seatCapacity ? `${g.totalCount} / ${s.seatCapacity}명` : `총 ${g.totalCount}명`) : (
        <Pressable onPress={() => unlockFlow.trigger(s.id)} disabled={unlockFlow.isPending} accessibilityRole="button">
          <Text style={{ fontSize: 13, lineHeight: 22.1, fontWeight: '600', color: colors.accent }}>
            {unlockFlow.isPending ? '여는 중…' : HIDE_IOS_CURRENCY ? '실시간 인원 보기' : '실시간 인원 보기 · 100리프'}
          </Text>
        </Pressable>
      ),
    });
  }
  return <DetailRows rows={rows} />;
}

// 도보 길찾기 — 앱: 네이버 지도 앱 도보 경로(nmap://route/walk), 앱이 없거나 웹이면 네이버 지도 웹 검색.
export function openDirections(s: Store) {
  const name = encodeURIComponent(s.name);
  const web = `https://map.naver.com/p/search/${name}`;
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.open(web, '_blank', 'noopener');
    return;
  }
  if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) {
    const scheme = `nmap://route/walk?dlat=${s.lat}&dlng=${s.lng}&dname=${name}&appname=kr.yahwa.app`;
    Linking.openURL(scheme).catch(() => Linking.openURL(web).catch(() => {}));
  } else {
    Linking.openURL(web).catch(() => {});
  }
}
