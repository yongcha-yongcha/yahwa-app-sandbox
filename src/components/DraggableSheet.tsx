// 야화 — 드래그 가능한 바텀시트. PanResponder 기반, web/native 호환.
// 핸들 영역에서 시작한 드래그만 시트를 이동시키고, 콘텐츠 영역은 스크롤이 정상 동작.
// 딤(바깥) 탭으로도 닫힌다.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import {
  Animated, Modal, PanResponder, Pressable,
  StyleSheet, View, useWindowDimensions,
} from 'react-native';
import { colors, shadow } from '../tokens';

// 내부 ScrollView가 "맨 위에 있는지"를 시트에 알리는 채널 — 최대 열림 상태에서
// 아래로 당길 때 내부 스크롤과 시트 드래그를 구분하기 위해 필요.
const SheetScrollCtx = createContext<{ setAtTop: (v: boolean) => void } | null>(null);
// 시트 안 ScrollView의 onScroll에 연결해서 사용: onScroll={useSheetScrollReporter()}
export function useSheetScrollReporter() {
  const ctx = useContext(SheetScrollCtx);
  return useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    ctx?.setAtTop(e.nativeEvent.contentOffset.y <= 2);
  }, [ctx]);
}

export function DraggableSheet({
  open,
  onClose,
  children,
  snapTopOffset = 80,  // 시트가 가장 위로 올라왔을 때 화면 상단에서의 여백
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapTopOffset?: number;
}) {
  const { height: screenH } = useWindowDimensions();
  const topPos = snapTopOffset;     // 최대 열림
  // 첫 렌더 프레임에 screenH가 0이면 interpolate inputRange가 [80, 0]이 되어 크래시 —
  // topPos보다 항상 크도록 보정 (다음 레이아웃 패스에서 실제 높이로 재계산됨).
  const closedPos = Math.max(screenH, topPos + 1);
  const halfPos = Math.max(screenH * 0.45, topPos);   // 반쯤 열린 위치

  const translateY = useRef(new Animated.Value(closedPos)).current;
  const currentY = useRef(closedPos);
  useEffect(() => {
    const id = translateY.addListener(({ value }) => { currentY.current = value; });
    return () => translateY.removeListener(id);
  }, [translateY]);
  // 내부 스크롤이 맨 위인지 (기본 true — 스크롤 없는 콘텐츠는 항상 시트 드래그 허용)
  const innerAtTop = useRef(true);
  // 드래그 시작 위치 — 드래그가 끝날 때까지 바뀌면 안 된다.
  // (이전 구현은 addListener가 실시간 갱신하는 값을 그대로 써서 dy가 이중 계산됐고,
  //  스냅 목표가 실제 드래그 거리의 2배로 잡혀 아래로 끌어도 닫히지 않았다.)
  const dragStart = useRef(closedPos);

  // open 토글 시 애니메이션
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: open ? halfPos : closedPos,
      useNativeDriver: false,   // 드래그 중 setValue와 섞이므로 JS 드라이버로 통일
      bounciness: 4,
      speed: 14,
    }).start();
  }, [open, halfPos, closedPos, translateY]);

  // 닫기 — 시트를 내린 뒤 onClose (딤 탭 / 스냅 닫힘 / 안드 뒤로가기 공통)
  const animateClose = useCallback(() => {
    Animated.timing(translateY, {
      toValue: closedPos,
      duration: 200,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [closedPos, translateY, onClose]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 3,
        // 시트 전체에서 세로 드래그를 가로챈다(핸들만 잡을 필요 없게).
        // 최대 열림 상태에선 내부 스크롤을 방해하지 않도록, "맨 위에서 아래로 당길 때"만.
        onMoveShouldSetPanResponderCapture: (_e, g) => {
          if (Math.abs(g.dy) < 8 || Math.abs(g.dy) <= Math.abs(g.dx)) return false;
          if (currentY.current > topPos + 2) return true;            // 반열림 — 어디서든 시트 이동
          return g.dy > 0 && innerAtTop.current;                     // 최대 열림 — 맨 위에서 내려당김만
        },
        onPanResponderGrant: () => {
          // 진행 중 애니메이션을 멈추고 그 시점 위치를 드래그 기준으로 고정
          translateY.stopAnimation((v: number) => {
            dragStart.current = v;
          });
        },
        onPanResponderMove: (_e, g) => {
          // 아래로는 자유롭게, 위로는 topPos까지만
          translateY.setValue(Math.max(topPos, dragStart.current + g.dy));
        },
        onPanResponderRelease: (_e, g) => {
          const curr = Math.max(topPos, dragStart.current + g.dy);
          let target: number;
          if (g.vy > 0.5) target = closedPos;         // 빠르게 아래로 → 닫기
          else if (g.vy < -0.5) target = topPos;      // 빠르게 위로 → 최대 열기
          else {
            // 느린 드래그는 가장 가까운 스냅 지점으로
            const targets = [topPos, halfPos, closedPos];
            target = targets.reduce(
              (best, t) => (Math.abs(curr - t) < Math.abs(curr - best) ? t : best),
              targets[0],
            );
          }
          if (target === closedPos) {
            animateClose();
            return;
          }
          Animated.spring(translateY, {
            toValue: target,
            useNativeDriver: false,
            bounciness: 3,
            speed: 16,
          }).start();
        },
      }),
    [topPos, halfPos, closedPos, translateY, animateClose],
  );

  // backdrop 페이드: 시트 위치에 따라 opacity 계산
  const backdropOpacity = translateY.interpolate({
    inputRange: [topPos, closedPos],
    outputRange: [0.55, 0],
    extrapolate: 'clamp',
  });

  return (
    <Modal transparent visible={open} animationType="none" onRequestClose={animateClose}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdropOpacity }]}
        />
        {/* 딤 영역 탭 → 닫기. 시트는 이 뒤에 렌더되므로 시트 위 터치는 가로채지 않는다. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={animateClose} accessibilityLabel="닫기" />

        <Animated.View
          {...panResponder.panHandlers}
          style={[
            {
              position: 'absolute',
              left: 0, right: 0,
              height: screenH,
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              transform: [{ translateY }],
            },
            shadow.sheet as any,
          ]}
        >
          {/* 드래그 핸들 (시각 표시 — 이제 시트 어디를 잡아도 드래그된다) */}
          <View style={{ paddingTop: 12, paddingBottom: 16, alignItems: 'center' }}>
            <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.line }} />
          </View>
          <SheetScrollCtx.Provider value={{ setAtTop: (v) => { innerAtTop.current = v; } }}>
            <View style={{ flex: 1, backgroundColor: colors.surface }}>
              {children}
            </View>
          </SheetScrollCtx.Provider>
        </Animated.View>
      </View>
    </Modal>
  );
}
