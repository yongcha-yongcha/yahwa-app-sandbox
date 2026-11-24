// 야화 시연판 — 시연도구 ↔ 앱 화면 연결.
// app/index.tsx가 화면을 바꾸는 함수를 여기에 등록하고, 시연도구는 이 함수로 화면을 옮긴다.
export type DemoTab = 'affinity' | 'heart' | 'letters' | 'lounge' | 'me';
export type DemoOverlayParams = {
  friendUserId?: string;
  letterId?: string;
  loungePostId?: string;
  storeId?: string;
  gatherId?: string;
  chatRoomId?: string;
  myDetailMode?: string;
};
export type DemoNavTarget =
  | { tab: DemoTab }
  | { overlay: string; params?: DemoOverlayParams }
  | { letterCompose: { id: string; nickname: string; photo?: string | null } };

type Handler = {
  tab: (t: DemoTab) => void;
  overlay: (name: string, p?: DemoOverlayParams) => void;
  letterCompose: (r: { id: string; nickname: string; photo?: string | null }) => void;
};
let handler: Handler | null = null;
export function registerDemoNav(h: Handler) { handler = h; return () => { if (handler === h) handler = null; }; }

export function demoGo(t: DemoNavTarget): boolean {
  if (!handler) return false;
  if ('tab' in t) handler.tab(t.tab);
  else if ('overlay' in t) handler.overlay(t.overlay, t.params);
  else handler.letterCompose(t.letterCompose);
  return true;
}

// 지금 보이는 화면(시연도구 위쪽에 표시)
let current = { tab: 'affinity', overlay: null as string | null, entry: null as string | null };
const subs = new Set<() => void>();
export function reportDemoScreen(tab: string, overlay: string | null, entry: string | null) {
  current = { tab, overlay, entry };
  subs.forEach((s) => s());
}
export function getDemoScreen() { return current; }
export function onDemoScreen(cb: () => void) { subs.add(cb); return () => { subs.delete(cb); }; }
