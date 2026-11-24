// 야화 UI 킷 — 아래 고정 버튼 영역(spec-shell §2.18)
// 좌우 20 · 버튼 54 · 바닥 max(30, 안전 영역 + 12). 화면 바탕색(흰색)으로 칠해 내용이 버튼 뒤로 비치지 않는다.
// fade: 영역 위 48 동안 투명 → 흰색 그라데이션(미리보기처럼 내용이 서서히 숨는 화면). note: 버튼 위 한 줄 안내(12/18, 버튼과 8).
// 화면 구조: <KeyboardAware style={{flex:1}}> <ScrollView style={{flex:1}}/> <DockArea>…</DockArea> </KeyboardAware>
//  — 키보드가 올라오면 KeyboardAware(고정 모드)가 이 영역을 키보드 위로 올린다. 그때 바닥 여백은 12로 줄인다.
// 이 영역이 있는 화면은 하단 메뉴를 숨긴다. 토스트는 이 영역보다 12 위에 뜬다(높이를 자동으로 알린다).
import React, { useState } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, type as typo } from '../tokens';
import { useKeyboardHeight } from '../components/KeyboardAware';
import { useToastAnchor } from './toastAnchor';

export function useDockBottom(): number {
  const insets = useSafeAreaInsets();
  return Math.max(layout.dockBottom, insets.bottom + 12);
}

export function DockArea({ children, note, fade, top = 12, style }: { children: React.ReactNode; note?: string; fade?: boolean; top?: number; style?: StyleProp<ViewStyle> }) {
  const bottom = useDockBottom();
  const kb = useKeyboardHeight() > 0;
  const [h, setH] = useState(0);
  useToastAnchor(h);
  return (
    <View onLayout={(e) => setH(e.nativeEvent.layout.height)} style={[{ paddingTop: top, paddingHorizontal: layout.gutter, paddingBottom: kb ? 12 : bottom, backgroundColor: colors.bg }, style]}>
      {fade && <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0)', '#FFFFFF']} style={{ position: 'absolute', left: 0, right: 0, top: -48, height: 48 }} />}
      {!!note && <Text style={[typo.caption1, { textAlign: 'center', marginBottom: 8 }]}>{note}</Text>}
      {children}
    </View>
  );
}
