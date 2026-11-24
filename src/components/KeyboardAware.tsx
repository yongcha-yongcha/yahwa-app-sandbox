// 야화 — 키보드 회피 래퍼.
// 배경: Expo SDK 54 + targetSdk 35는 Android edge-to-edge가 강제라
// windowSoftInputMode=adjustResize가 더 이상 콘텐츠를 밀어 올리지 않는다.
// 기존 코드는 Android에서 behavior를 주지 않아(=undefined) 키보드 회피가 통째로 꺼져 있었고,
// 입력창이 키보드 뒤에 완전히 가려졌다.
//
// 두 가지 모드:
//  - 기본(pinned): 입력창이 하단에 고정된 화면(채팅 등). iOS 'padding' / Android 'height'.
//  - scroll: 내부가 ScrollView인 긴 폼. iOS는 KeyboardAvoidingView를 쓰지 않고(=undefined)
//    ScrollView의 automaticallyAdjustKeyboardInsets가 포커스된 입력을 키보드 위로 자동
//    스크롤한다(네비바는 고정). Android는 'height'로 컨테이너를 줄여 스크롤 가능하게 한다.
//    ※ scroll 모드에서는 감싸는 ScrollView에 반드시 automaticallyAdjustKeyboardInsets를 준다.
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Keyboard, Platform, StyleProp, ViewStyle } from 'react-native';

export function KeyboardAware({
  children,
  style,
  iosOffset = 0,
  scroll = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** iOS pinned 모드에서 헤더/노치만큼 보정할 값 (보통 insets.top). Android에는 적용하지 않는다. */
  iosOffset?: number;
  /** 내부가 ScrollView인 긴 폼이면 true. iOS는 ScrollView 인셋에 맡기고 KAV를 끈다. */
  scroll?: boolean;
}) {
  const behavior =
    Platform.OS === 'ios'
      ? (scroll ? undefined : 'padding')
      : 'height';

  return (
    <KeyboardAvoidingView
      behavior={behavior}
      keyboardVerticalOffset={Platform.OS === 'ios' && !scroll ? iosOffset : 0}
      style={style}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

// 키보드 높이 — 창 높이로 최대 높이를 정한 카드·시트가 키보드로 줄어든 영역에 맞춰 같이 줄도록(웹은 0)
export function useKeyboardHeight(active = true): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!active) return;
    const ios = Platform.OS === 'ios';
    const s = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setH(e.endCoordinates?.height ?? 0));
    const d = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setH(0));
    return () => { s.remove(); d.remove(); setH(0); };
  }, [active]);
  return h;
}
