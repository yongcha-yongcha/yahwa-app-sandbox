// 홈 위 안내 차례 — 가입 환영 쿠폰 팝업을 확인하는 중이거나 떠 있는 동안에는 지인 차단 시트를 띄우지 않는다.
// app/index.tsx가 켜고 끄고, ContactBlockAutoPrompt가 읽는다(쿠폰 팝업을 닫은 뒤에 시트가 올라온다).
import { useSyncExternalStore } from 'react';

let blocked = false;
const subs = new Set<() => void>();

export function setHomeSheetBlocked(on: boolean) {
  if (blocked === on) return;
  blocked = on;
  subs.forEach((f) => f());
}

export function useHomeSheetBlocked() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => blocked);
}
