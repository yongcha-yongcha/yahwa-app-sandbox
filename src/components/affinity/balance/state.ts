// 오늘의 밸런스 — 화면 쪽 상태.
// · 시안 후보(제목 · 표지 캐릭터 · 뒷면): 시연도구에서 바꾼다. 저장하지 않아서 링크를 새로 열면 늘 T1 · 정면 · 피크닉으로 시작해요.
// · 표지를 열었는지: 이번 배치(정오~정오) 동안만 기억한다. 고른 답은 서버(목업)의 몫이라 여기엔 없다.
import { useSyncExternalStore } from 'react';

export type BalanceTitle = 't1' | 't2';
export type BalanceChar = '7' | '8' | '9';
export type BalanceBack = 'picnic' | 'mobile' | 'arcade';
export type BalanceLook = { title: BalanceTitle; char: BalanceChar; back: BalanceBack };

export const TITLE_OPTIONS: [BalanceTitle, string][] = [['t1', 'T1 깔끔 굵게'], ['t2', 'T2 명조']];
export const CHAR_OPTIONS: [BalanceChar, string][] = [['7', '7 정면'], ['8', '8 윙크'], ['9', '9 모아 쥐기']];
export const BACK_OPTIONS: [BalanceBack, string][] = [['picnic', '피크닉'], ['mobile', '밤하늘 모빌'], ['arcade', '오락기']];

const DEFAULT: BalanceLook = { title: 't1', char: '7', back: 'picnic' };

let look: BalanceLook = DEFAULT;
let openedKey = '';      // 표지를 연 배치
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export function getBalanceLook(): BalanceLook { return look; }
export function setBalanceLook(patch: Partial<BalanceLook>) {
  look = { ...look, ...patch };
  // 후보를 바꾸면 표지부터 다시 본다
  openedKey = '';
  emit();
}
export function useBalanceLook(): BalanceLook { return useSyncExternalStore(subscribe, () => look); }

export function setBalanceOpened(batchKey: string, open: boolean) { openedKey = open ? batchKey : ''; emit(); }
export function useBalanceOpened(batchKey: string): boolean { return useSyncExternalStore(subscribe, () => openedKey === batchKey); }

// 시연도구 '밸런스 카드로 가기' — 홈 카드 줄을 밸런스 카드로 넘긴다
let focusReq = 0;
export function requestBalanceFocus() { focusReq += 1; emit(); }
export function useBalanceFocusReq(): number { return useSyncExternalStore(subscribe, () => focusReq); }
