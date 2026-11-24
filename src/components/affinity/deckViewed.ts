// 야화 — 오늘의 인연 덱에서 '이번 배치에' 프로필을 본 기록(대표 지시 1025)
// 예전에 본 적 있는 사람도 덱 카드는 항상 표지 → 흐린 사진 → 선명한 사진 순서로 다시 열어야 한다.
// 그래서 덱 카드의 '열린' 판정은 전체 기간 열람 기록(viewed.ts)이 아니라 이번 배치에서 연 기록만 쓴다.
// 서버 deck_views는 클라이언트가 읽을 수 없어 기기 기록(AsyncStorage)만 둔다 — 기록이 없으면 다시 열면 된다.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const keyOf = (uid: string) => `yahwa_deck_viewed:${uid}`;
let owner = '';
let batch = '';
let ids = new Set<string>();
const subs = new Set<() => void>();
const emit = () => { ids = new Set(ids); subs.forEach((f) => f()); };

function ensure(uid: string, batchK: string) {
  if (owner === uid && batch === batchK) return;
  owner = uid; batch = batchK; ids = new Set();
  const forUid = uid, forBatch = batchK;
  AsyncStorage.getItem(keyOf(uid)).then((v) => {
    if (!v || owner !== forUid || batch !== forBatch) return;
    const saved = JSON.parse(v) as { batch: string; ids: string[] };
    if (saved.batch !== forBatch) return;   // 지난 배치 기록은 버린다
    const add = saved.ids.filter((x) => !ids.has(x));
    if (!add.length) return;
    add.forEach((x) => ids.add(x));
    emit();
  }).catch(() => {});
}

export function markDeckViewed(uid: string, batchK: string, profileId: string) {
  ensure(uid, batchK);
  if (ids.has(profileId)) return;
  ids.add(profileId);
  AsyncStorage.setItem(keyOf(uid), JSON.stringify({ batch: batchK, ids: [...ids] })).catch(() => {});
  emit();
}

// 이번 배치에서 덱으로 프로필을 본 사람
export function useDeckViewedIds(uid: string | null, batchK: string): Set<string> {
  if (uid) ensure(uid, batchK);
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => ids,
    () => ids,
  );
}
