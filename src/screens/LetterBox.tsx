// 야화 — 편지함 탭 화면 (리뉴얼 1120 · spec-dating §3.6)
// 제목 "편지함" + 부제목(오른쪽에 보관 안내 아이콘) + 줄 목록. 줄을 누르면 편지 세부(받은 편지는 그때 읽음).
import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../tokens';
import { getCurrentUserId, previewActions } from '../lib/previewStore';
import { appNav } from '../lib/appNav';
import type { LetterRow } from '../lib/api';
import { LetterList } from '../components/LetterList';
import { LetterKeepSheet } from '../components/letters/ui';
import { useOnScreenInactive } from '../components/KeepAlive';
import { TabTitle, TextLink, useTabBarClearance } from '../ui';

export function LetterBox() {
  const myUid = getCurrentUserId();
  const bottomSpace = useTabBarClearance();
  const [infoOpen, setInfoOpen] = useState(false);
  useOnScreenInactive(() => setInfoOpen(false));
  const open = useCallback((l: LetterRow) => appNav({ kind: 'letterDetail', letterId: l.id }), []);
  const header = (
    <View>
      <TabTitle title="편지함" subtitle="첫 편지에서 이어지는 우리 이야기" />
      {/* 편지 보관 안내 — 부제목 줄 오른쪽 정보 아이콘(터치 44 · 선 20) */}
      {!!myUid && (
        <Pressable
          onPress={() => setInfoOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="편지 보관 안내"
          style={({ pressed }) => ({ position: 'absolute', right: 8, top: 67.6, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.mute} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <Circle cx={12} cy={12} r={9} />
            <Path d="M12 11v5.5M12 7.6v.2" />
          </Svg>
        </Pressable>
      )}
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {myUid ? (
        <LetterList header={header} onOpen={open} contentContainerStyle={{ paddingBottom: bottomSpace }} />
      ) : (
        <>
          {header}
          <View style={{ paddingVertical: 40, paddingHorizontal: 15, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, lineHeight: 24, color: colors.mute, textAlign: 'center' }}>로그인하면 주고받은 편지가 보여요.</Text>
            <TextLink label="로그인하기" onPress={() => previewActions.requireLogin('편지함은 로그인 후 볼 수 있어요')} />
          </View>
        </>
      )}
      <LetterKeepSheet open={infoOpen} onClose={() => setInfoOpen(false)} />
    </View>
  );
}
