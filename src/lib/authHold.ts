// 인증번호 완료 모션이 도는 동안 — 세션이 생겨도 시작(로그인) 화면을 치우지 않게 붙잡는다.
// Login이 확인 직전에 켜고, 모션이 끝나거나(onFinish) 실패·화면이 사라지면 끈다. app/index.tsx가 읽는다.
import { useSyncExternalStore } from 'react';

let held = false;
const subs = new Set<() => void>();

export function setAuthHold(on: boolean) {
  if (held === on) return;
  held = on;
  subs.forEach((f) => f());
}

export function useAuthHold() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => held);
}
