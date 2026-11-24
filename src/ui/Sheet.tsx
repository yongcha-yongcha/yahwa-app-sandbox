// 야화 UI 킷 — 바텀 시트 · 확인 시트 · 가운데 대화상자(spec-shell §2.12 · §3-5)
// 공용 시트(yhSheet): 막 rgba(57,68,77,.32)(누르면 닫힘) · 흰 바탕 · 위 모서리 24 · 안쪽 위 8 · 좌우 20 · 아래 32 + 안전 영역 ·
//   손잡이 36×4 #CFD5DA(아래 12) · 최대 높이 = 화면 − 48(안쪽만 스크롤). 닫기 버튼은 두지 않는다.
// 열림: 막 200ms + 시트 아래에서 300ms Drawer / 닫힘: 막 200ms + 시트 240ms. 동작 줄이기: 160ms 페이드만.
// 닫는 길: 막 누름 · 손잡이 끌어내리기 · 안드로이드 뒤로(Modal onRequestClose). 키보드가 올라오면 시트가 키보드 위로 올라간다.
// open이 false가 되면 닫히는 움직임이 끝난 뒤에 사라진다 — 부르는 쪽은 open만 바꾸면 된다.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, dur, ease, layout, radius, scrimColor, type as typo } from '../tokens';
import { KeyboardAware, useKeyboardHeight } from '../components/KeyboardAware';
import { Button, type ButtonVariant } from './Button';
import { haptic, NATIVE, reduceMotion, usePress } from './motion';
import { T } from './Text';  // 시트 제목·설명은 낱말 단위 줄바꿈(keep-all)

export function BottomSheet({ open, onClose, children, grabber = true, scroll = true, padTop, padX = layout.gutter, dismissable = true, style }: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  grabber?: boolean;        // 손잡이(휠 시트는 false — 안쪽 위 24)
  scroll?: boolean;         // 내용이 길면 안쪽 스크롤(직접 ScrollView·FlatList를 넣으면 false)
  padTop?: number;
  padX?: number;
  dismissable?: boolean;    // false면 막·끌기·뒤로가기로 닫히지 않는다(처리 중)
  style?: StyleProp<ViewStyle>;
}) {
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight(open) > 0;
  const [mounted, setMounted] = useState(open);
  const v = useRef(new Animated.Value(0)).current;       // 0 닫힘 → 1 열림
  const drag = useRef(new Animated.Value(0)).current;    // 손잡이 끌기(px)
  const h = useRef(new Animated.Value(winH)).current;    // 시트 높이
  const hNum = useRef(winH);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const canClose = useRef(dismissable);
  canClose.current = dismissable;

  useEffect(() => {
    const still = reduceMotion();
    if (open) {
      setMounted(true);
      drag.setValue(0);
      haptic('selection');
      Animated.timing(v, { toValue: 1, duration: still ? dur.reduced : dur.sheetIn, easing: ease.drawer, useNativeDriver: NATIVE }).start();
    } else {
      Animated.timing(v, { toValue: 0, duration: still ? dur.reduced : dur.sheetOut, easing: ease.drawer, useNativeDriver: NATIVE })
        .start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [open, v, drag]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => canClose.current,
    onMoveShouldSetPanResponder: (_e, g) => canClose.current && g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_e, g) => drag.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_e, g) => {
      if (g.dy > Math.min(120, hNum.current * 0.3) || g.vy > 0.8) closeRef.current();
      else Animated.timing(drag, { toValue: 0, duration: 200, easing: ease.out, useNativeDriver: NATIVE }).start();
    },
    onPanResponderTerminate: () => { Animated.timing(drag, { toValue: 0, duration: 200, easing: ease.out, useNativeDriver: NATIVE }).start(); },
  })).current;

  if (!mounted) return null;
  const still = reduceMotion();
  const slide = Animated.add(Animated.multiply(Animated.subtract(1, v), h), drag);
  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll ? { bounces: false, showsVerticalScrollIndicator: false, keyboardShouldPersistTaps: 'handled' as const, style: { flexGrow: 0 } } : { style: { flexShrink: 1 } };
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => { if (dismissable) onClose(); }}>
      <KeyboardAware style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* 막 — 200ms(시트보다 먼저 끝나게 앞쪽 2/3 구간에 건다) */}
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor(), opacity: v.interpolate({ inputRange: [0, 0.67, 1], outputRange: [0, 1, 1] }) }]}>
          <Pressable style={[StyleSheet.absoluteFill, Platform.OS === 'web' ? ({ outlineStyle: 'none', cursor: 'default' } as object) : null]} onPress={() => { if (dismissable) onClose(); }} accessibilityLabel="닫기" />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          onLayout={(e) => { hNum.current = e.nativeEvent.layout.height; h.setValue(hNum.current); }}
          style={[
            { maxHeight: winH - 48 - (kb ? 0 : insets.top), backgroundColor: colors.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: padTop ?? (grabber ? 8 : 24), paddingBottom: kb ? 16 : layout.sheetPadBottom + insets.bottom },
            still ? { opacity: v } : { transform: [{ translateY: slide }] },
            style,
          ]}
        >
          {grabber && (
            <View {...pan.panHandlers} style={{ alignItems: 'center', paddingBottom: 12, marginTop: -8, paddingTop: 8 }} accessibilityLabel="시트 닫기 손잡이">
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.control }} />
            </View>
          )}
          <Body {...(bodyProps as object)}>
            <View style={{ paddingHorizontal: padX }}>{children}</View>
          </Body>
        </Animated.View>
      </KeyboardAware>
    </Modal>
  );
}

// 시트 제목 · 설명(확인형) — 제목 600 17/23.8 → 설명 14/22.4 #505C65(위 4 · 아래 20)
export function SheetHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <View style={{ marginBottom: desc ? 20 : 12 }}>
      <T v="sheetTitle" accessibilityRole="header">{title}</T>
      {!!desc && <T v="sheetBody" style={{ marginTop: 4 }}>{desc}</T>}
    </View>
  );
}

// 시트 2버튼 — 2열 · 간격 8 · 높이 52 · 모서리 14. 왼쪽 취소(회색), 오른쪽 실행(primary 또는 danger)
export function SheetButtons({ cancelLabel = '취소', onCancel, confirmLabel, onConfirm, confirmVariant = 'primary', disabled, loading }: {
  cancelLabel?: string; onCancel?: () => void; confirmLabel: string; onConfirm: () => void; confirmVariant?: ButtonVariant; disabled?: boolean; loading?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {!!onCancel && <Button label={cancelLabel} variant="gray" size="sheet" onPress={onCancel} style={{ flex: 1 }} />}
      <Button label={confirmLabel} variant={confirmVariant} size="sheet" onPress={onConfirm} disabled={disabled} loading={loading} style={{ flex: 1 }} />
    </View>
  );
}

// 확인 시트 — 제목 + 설명 + (내용) + 2버튼. danger: 삭제·차단(빨강 실행 버튼)
export function ConfirmSheet({ open, onClose, title, desc, confirmLabel, onConfirm, cancelLabel, danger, loading, disabled, children }: {
  open: boolean; onClose: () => void; title: string; desc?: string; confirmLabel: string; onConfirm: () => void; cancelLabel?: string;
  danger?: boolean; loading?: boolean; disabled?: boolean; children?: React.ReactNode;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} dismissable={!loading}>
      {/* 확인 시트 내용은 손잡이 아래 4부터(시안 .photo-sheet-confirm padding-top 4) */}
      <View style={{ paddingTop: 4 }}><SheetHeader title={title} desc={desc} /></View>
      {children}
      <SheetButtons cancelLabel={cancelLabel} onCancel={onClose} confirmLabel={confirmLabel} onConfirm={onConfirm} confirmVariant={danger ? 'danger' : 'primary'} loading={loading} disabled={disabled} />
    </BottomSheet>
  );
}

// 시트 메뉴 줄 — 높이 52 · 아이콘 24 #505C65 + 12 + 500 15. 누르면 줄이 0.98배 + 뒤에 모서리 16 면. danger: 빨강
export function SheetRow({ label, desc, icon, danger, onPress }: { label: string; desc?: string; icon?: React.ReactNode | ((color: string) => React.ReactNode); danger?: boolean; onPress?: () => void }) {
  const press = usePress(0.98, 100, 160);
  const fg = danger ? colors.danger : colors.text;
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" style={{ marginHorizontal: -8 }}>
      <Animated.View style={[{ minHeight: 52, paddingHorizontal: 8, paddingVertical: desc ? 8 : 0, flexDirection: 'row', alignItems: 'center', gap: 12 }, press.scaleStyle]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 16, backgroundColor: colors.sheetRowPress, opacity: press.p }]} />
        {typeof icon === 'function' ? icon(danger ? colors.danger : colors.textSecondary) : icon}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '500', color: fg }}>{label}</Text>
          {!!desc && <Text style={{ fontSize: 12, lineHeight: 18, color: colors.mute }}>{desc}</Text>}
        </View>
      </Animated.View>
    </Pressable>
  );
}
// 시트 줄 사이 구분선 — 1px #E3E7EA · 위아래 8
export function SheetDivider() {
  return <View style={{ height: 1, marginVertical: 8, backgroundColor: colors.line }} />;
}

// 가운데 대화상자(약관 안내 등) — 폭 310 · 모서리 20 · 안쪽 24 · 흰 바탕 · 막 rgba(57,68,77,.40). 제목 명조 24 · 본문 14/25.2 · 버튼 가득 44. 움직임 없음
export function Dialog({ open, onClose, title, children, confirmLabel = '확인', onConfirm }: {
  open: boolean; onClose: () => void; title?: string; children?: React.ReactNode; confirmLabel?: string; onConfirm?: () => void;
}) {
  const { height: winH } = useWindowDimensions();
  if (!open) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.scrimDialog, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
        <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 310, maxHeight: winH - 96, borderRadius: radius.photo, padding: 24, backgroundColor: colors.surface }}>
          {!!title && <Text accessibilityRole="header" style={[typo.title1, { letterSpacing: 0, marginBottom: 12 }]}>{title}</Text>}
          <ScrollView style={{ flexGrow: 0 }} bounces={false} showsVerticalScrollIndicator={false}>
            {typeof children === 'string' ? <Text style={{ fontSize: 14, lineHeight: 25.2, color: colors.textSecondary }}>{children}</Text> : children}
          </ScrollView>
          <Button label={confirmLabel} size="M" block onPress={onConfirm ?? onClose} style={{ marginTop: 20 }} textStyle={{ fontWeight: '500' }} />
        </View>
      </View>
    </Modal>
  );
}
