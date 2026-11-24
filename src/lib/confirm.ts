// 야화 — 되돌릴 수 없는 동작 전 확인(웹은 window.confirm, 앱은 Alert). 확인하면 onOk 실행.
import { Alert, Platform } from 'react-native';

export function confirmAction(title: string, body: string, okLabel: string, onOk: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n${body}`)) onOk();
    return;
  }
  Alert.alert(title, body, [
    { text: '취소', style: 'cancel' },
    { text: okLabel, style: 'destructive', onPress: onOk },
  ]);
}
