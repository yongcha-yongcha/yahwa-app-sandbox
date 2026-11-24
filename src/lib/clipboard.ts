// 야화 — 크로스플랫폼 클립보드. 웹은 navigator.clipboard, 네이티브는 RN Clipboard.
// (navigator.clipboard는 네이티브에 없어서 "복사 실패"가 났던 원인 — expo-clipboard는
// 네이티브 모듈 추가 = 새 빌드가 필요해 OTA 불가라 RN 내장 Clipboard 사용)
import { Platform } from 'react-native';

export async function copyText(text: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch { /* fall through */ }
    return false;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Clipboard } = require('react-native');
    if (Clipboard?.setString) {
      Clipboard.setString(text);
      return true;
    }
  } catch { /* fall through */ }
  return false;
}
