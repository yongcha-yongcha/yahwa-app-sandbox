// 야화 — iOS 키보드가 떠 있는지. 아래 입력 줄은 키보드가 올라오면 홈 인디케이터 여백(insets.bottom)이 필요 없다 —
// 남겨 두면 키보드 위에 빈 띠가 생긴다. KeyboardAvoidingView와 같은 순간(will)에 바꿔 함께 움직이게 한다.
// 안드로이드·웹은 그대로(false) — 키보드 높이 계산이 달라 여백을 건드리지 않는다.
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useIosKeyboardShown(): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const a = Keyboard.addListener('keyboardWillShow', () => setShown(true));
    const b = Keyboard.addListener('keyboardWillHide', () => setShown(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  return shown;
}
