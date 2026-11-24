// 인연 프로필 '본 적 있음' 기록 (대표 지시 1010)
// 모자이크 = 아직 안 본 프로필 표시. 한 번 본 프로필은 날짜와 상관없이 계속 풀려 있어야 한다.
// 출처 3가지를 합친다:
//   · 이 기기에 저장한 열람 기록(AsyncStorage) — 덱의 '사진 보기', 프로필 상세 진입
//   · 서버 friend_views — 프로필 상세 열람 기록(전체 기간)
//   · 서버 interests — 내가 관심을 보낸 상대(전체 기간)
import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { getCurrentUserId } from './previewStore';

// 계정마다 따로 저장 — 한 기기에서 다른 계정으로 로그인해도 열람 기록이 섞이지 않게
const keyOf = (uid: string) => `yahwa_viewed_profile_ids:${uid}`;
let owner: string | null = null;
let ids = new Set<string>();
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => { ids = new Set(ids); listeners.forEach((l) => l()); };

// 로그인 계정이 바뀌면 메모리 기록을 비우고 그 계정 것을 다시 읽는다
function ensureOwner(uid: string | null) {
  if (uid === owner) return;
  owner = uid;
  ids = new Set();
  loaded = false;
}

function load() {
  if (loaded || !owner) return;
  loaded = true;
  const forUid = owner;
  AsyncStorage.getItem(keyOf(forUid))
    .then((v) => {
      if (!v || owner !== forUid) return;
      const arr: string[] = JSON.parse(v);
      if (arr.some((x) => !ids.has(x))) { arr.forEach((x) => ids.add(x)); emit(); }
    })
    .catch(() => {});
}
function persist() {
  if (!owner) return;
  AsyncStorage.setItem(keyOf(owner), JSON.stringify([...ids].slice(-2000))).catch(() => {});
}

export function markViewed(userId: string) {
  ensureOwner(getCurrentUserId());
  if (!userId || !owner || ids.has(userId)) return;
  ids.add(userId);
  persist();
  emit();
}

function mergeServer(serverIds: string[]) {
  const add = serverIds.filter((x) => !ids.has(x));
  if (!add.length) return;
  add.forEach((x) => ids.add(x));
  persist();
  emit();
}

// 본 적 있는 프로필 id 집합 — 변경 시 구독 컴포넌트만 다시 그린다
export function useViewedIds(): Set<string> {
  const uid = getCurrentUserId();
  ensureOwner(uid);
  load();
  const serverQ = useQuery({
    queryKey: ['viewed-profile-ids', uid],
    enabled: !!uid,
    queryFn: async (): Promise<string[]> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const [views, sent] = await Promise.all([
        (supabase as any).from('friend_views').select('profile_id').order('created_at', { ascending: false }).limit(1000),
        (supabase as any).from('interests').select('receiver_id').eq('sender_id', session.user.id).order('created_at', { ascending: false }).limit(1000),
      ]);
      if (views.error) throw views.error;
      if (sent.error) throw sent.error;
      return [
        ...(views.data ?? []).map((r: any) => r.profile_id as string),
        ...(sent.data ?? []).map((r: any) => r.receiver_id as string),
      ].filter(Boolean);
    },
    staleTime: 60_000,
  });
  useEffect(() => { if (serverQ.data?.length && owner === uid) mergeServer(serverQ.data); }, [serverQ.data, uid]);
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => ids,
    () => ids,
  );
}
