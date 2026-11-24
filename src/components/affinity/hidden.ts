// 야화 — '이 인연 숨기기' (시안 숨기기 모달, 1013-B)
// 오늘의 인연에서만 빼는 개인 설정이라 기기에 계정별로 저장한다(보낸 호감·편지는 그대로).
// 서버에 숨김 목록이 생기면 여기만 바꾸면 된다.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId } from '../../lib/previewStore';

const keyOf = (uid: string) => `yahwa_hidden_profile_ids:${uid}`;
let owner: string | null = null;
let ids = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => { ids = new Set(ids); listeners.forEach((l) => l()); };

function ensureOwner() {
  const uid = getCurrentUserId();
  if (uid === owner) return;
  owner = uid;
  ids = new Set();
  if (!uid) return;
  AsyncStorage.getItem(keyOf(uid))
    .then((v) => {
      if (!v || owner !== uid) return;
      (JSON.parse(v) as string[]).forEach((x) => ids.add(x));
      emit();
    })
    .catch(() => {});
}

export function hideProfile(userId: string) {
  ensureOwner();
  if (!owner || ids.has(userId)) return;
  ids.add(userId);
  AsyncStorage.setItem(keyOf(owner), JSON.stringify([...ids].slice(-500))).catch(() => {});
  emit();
}

// 숨김 해제 — MY 설정 '숨긴 인연'에서
export function unhideProfile(userId: string) {
  ensureOwner();
  if (!owner || !ids.has(userId)) return;
  ids.delete(userId);
  AsyncStorage.setItem(keyOf(owner), JSON.stringify([...ids])).catch(() => {});
  emit();
}

export function useHiddenIds(): Set<string> {
  ensureOwner();
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => ids,
    () => ids,
  );
}
