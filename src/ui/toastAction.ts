// 야화 UI 킷 — 행동 버튼이 붙는 알림 한 줄(시안 .fx-toast.has-act, spec-dating §3.0-2)
// showToastAction('오늘의 인연에서 숨겼어요.', '되돌리기', undo) — 글 뒤 12에 버튼(12/600 흰 글), 4초 머문다.
// 글은 전역 토스트(previewActions.showToast) 그대로 띄우고, 같은 글에 붙을 버튼만 여기 적어 둔다(components/Toast가 읽는다).
import { useSyncExternalStore } from 'react';
import { previewActions } from '../lib/previewStore';

export type ToastAction = { message: string; label: string; onPress: () => void };
let current: ToastAction | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function showToastAction(message: string, label: string, onPress: () => void, ms: number = 4000) {
  current = { message, label, onPress };
  emit();
  previewActions.showToast(message, ms);
}
export function clearToastAction() { if (current) { current = null; emit(); } }
export function useToastAction(): ToastAction | null {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => current, () => current);
}
