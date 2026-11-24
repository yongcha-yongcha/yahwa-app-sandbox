// 야화 — 오늘의 인연 카드 '표지 열기' 기록(대표 지시 1022-26)
// 공개 시간이 된 카드는 시간('15:00') 표지로 남아 있다가, 누르면 열리며 흐린 사진 + 이름·나이 카드가 된다.
// 카드 열기는 프로필을 본 것과 다르다 — 서버 deck_reveals(0178 record_deck_reveal)에만 남기고,
// '8명 모두 읽기' 판정(deck_views·friend_views)은 프로필을 실제로 열 때만 남는다.
// 다시 켜면 deck_reveals의 이번 배치(정오 기준 batch_date) 행으로 복원한다. 기기 기록(AsyncStorage)은 바로 반영용.
import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

const keyOf = (uid: string) => `yahwa_deck_revealed:${uid}`;
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
    if (saved.batch !== forBatch) return;   // 지난 배치 기록은 버린다(정오에 새 표지)
    merge(saved.ids);
  }).catch(() => {});
}

function merge(list: string[]) {
  const add = list.filter((x) => !ids.has(x));
  if (!add.length) return;
  add.forEach((x) => ids.add(x));
  AsyncStorage.setItem(keyOf(owner), JSON.stringify({ batch, ids: [...ids] })).catch(() => {});
  emit();
}

export function markRevealed(uid: string, batchK: string, profileId: string) {
  ensure(uid, batchK);
  if (!ids.has(profileId)) merge([profileId]);
  void supabase.rpc('record_deck_reveal' as never, { p_profile_id: profileId } as never).then(() => {}, () => {});
}

// 이번 배치에서 표지를 연 사람 — 기기 기록 + 서버 deck_reveals
export function useRevealedIds(uid: string | null, batchK: string): Set<string> {
  if (uid) ensure(uid, batchK);
  const serverQ = useQuery({
    queryKey: ['deck-reveals', uid, batchK],
    enabled: !!uid,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await (supabase as any).from('deck_reveals').select('profile_id').eq('user_id', uid).eq('batch_date', batchK);
      if (error) return [];
      return (data ?? []).map((r: any) => r.profile_id as string);
    },
    staleTime: 60_000,
  });
  useEffect(() => {
    if (uid && owner === uid && batch === batchK && serverQ.data?.length) merge(serverQ.data);
  }, [serverQ.data, uid, batchK]);
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => ids,
    () => ids,
  );
}
