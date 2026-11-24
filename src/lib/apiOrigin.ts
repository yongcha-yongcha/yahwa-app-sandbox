// 야화 — Vercel 서버리스(/api/*) 호출 원점.
// RN에도 전역 window는 존재하지만 window.location.origin이 없어서
// `typeof window !== 'undefined'` 체크만으로는 네이티브에서 "undefined/api/..."로
// 요청이 나가 전부 실패한다(실시간 인원·포인트 결제가 네이티브에서 죽어 있던 원인).
import { Platform } from 'react-native';

export const WEB_ORIGIN = 'https://yahwa.vercel.app';

export function apiOrigin(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return WEB_ORIGIN;
}
