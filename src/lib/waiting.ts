// 야화 — 태그히어 원격 웨이팅. 자체 웨이팅 시스템 없이 태그히어 QR 웨이팅 웹으로 연결.
// (알림톡·순번 관리 등은 태그히어가 책임 — 야화는 링크만 연다)
import { Linking, Platform } from 'react-native';

export const TAGHERE_WAITING_BASE = 'https://taghere-crm-web-g96p.onrender.com/w/';

export function waitingUrl(slug: string): string {
  return `${TAGHERE_WAITING_BASE}${encodeURIComponent(slug)}`;
}

// 사용자가 전체 URL을 붙여넣어도 슬러그만 추출 (owner 입력 편의)
export function extractWaitingSlug(input: string): string {
  const t = input.trim();
  const m = t.match(/\/w\/([a-z0-9-]+)/i);
  if (m) return m[1].toLowerCase();
  return t.toLowerCase();
}

export function openWaiting(slug: string): void {
  const url = waitingUrl(slug);
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
  } else {
    void Linking.openURL(url);
  }
}
