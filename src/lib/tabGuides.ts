// 야화 — 탭 첫 방문 안내(시안 1022 first-tour) 상태
// · 대상: 새로 가입한 회원만. 탭(인연 profile · 커뮤니티 community · 플레이스 place · MY my)마다 처음 들어갈 때 한 번.
//   인연은 3단계(profile-0·1·2)를 하나씩 기록해, 중간에 나가도 남은 단계부터 이어서 보여 준다(시안 te()).
// · 기록: 서버 users.tab_guides_seen(jsonb, 0177) — 기기를 바꿔도 다시 뜨지 않는다.
//   기존 회원은 0177이 모든 탭을 '본 것'으로 채워 두므로 뜨지 않는다.
// · 0177 적용 전이거나 서버 실패 시: 가입 시각이 TOUR_SINCE 이후인 회원만, 기기 저장소(yahwa-tab-guides-v2:)로 대신한다.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { fetchMe } from './api';
import { getCurrentUserId } from './previewStore';

export type TourTab = 'profile' | 'community' | 'place' | 'my';
const STORE = 'yahwa-tab-guides-v2:';
// 서버 기록(0177)이 없을 때 '새 가입자'로 보는 기준 — 이 기능이 나간 날(KST)
const TOUR_SINCE = Date.parse('2026-10-22T00:00:00+09:00');

// 기기 기록 — 사용자별. 메모리 사본 + 구독(같은 화면 여러 곳이 같은 값을 보게)
let mem: { uid: string | null; keys: Set<string>; loaded: boolean } = { uid: null, keys: new Set(), loaded: false };
const subs = new Set<() => void>();
let version = 0;
const emit = () => { version++; subs.forEach((f) => f()); };

async function loadLocal(uid: string) {
  if (mem.uid === uid && mem.loaded) return;
  mem = { uid, keys: new Set(), loaded: false };
  try {
    const raw = await AsyncStorage.getItem(STORE + uid);
    if (raw) (JSON.parse(raw) as string[]).forEach((k) => mem.keys.add(k));
  } catch { /* 저장소 없음 — 빈 기록 */ }
  mem.loaded = true;
  emit();
}

function markLocal(uid: string, key: string) {
  if (mem.uid !== uid) mem = { uid, keys: new Set(), loaded: true };
  mem.keys.add(key);
  AsyncStorage.setItem(STORE + uid, JSON.stringify([...mem.keys])).catch(() => {});
  emit();
}

type MeRow = { created_at?: string | null; tab_guides_seen?: Record<string, unknown> | null } | null;

// 이 회원에게 안내를 보여 줄지 + 이미 본 키
function useSeen(): { ready: boolean; eligible: boolean; seen: (k: string) => boolean; mark: (k: string) => void } {
  const uid = getCurrentUserId();
  const qc = useQueryClient();
  const meQ = useQuery({ queryKey: ['me', uid ?? null], queryFn: fetchMe, enabled: !!uid, staleTime: 60_000 });
  useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => version);
  useEffect(() => { if (uid) void loadLocal(uid); }, [uid]);

  const me = meQ.data as MeRow | undefined;
  const server = me && me.tab_guides_seen !== undefined ? (me.tab_guides_seen ?? {}) : undefined;  // undefined = 0177 전
  const created = me?.created_at ? Date.parse(me.created_at) : NaN;
  const ready = !!uid && meQ.isSuccess && !!me && mem.uid === uid && mem.loaded;
  // 0177 적용 후: 서버 값이 기준(기존 회원은 모두 본 상태). 적용 전: 가입 시각으로 새 회원만
  const eligible = ready && (server !== undefined ? true : Number.isFinite(created) && created >= TOUR_SINCE);

  const seen = useCallback((k: string) => mem.keys.has(k) || (!!server && !!(server as Record<string, unknown>)[k]), [server]);
  const mark = useCallback((k: string) => {
    if (!uid) return;
    markLocal(uid, k);
    // 서버 기록 — 실패해도 기기 기록으로 충분(다음 접속 때 다시 보내지 않아도 기기에서는 안 뜬다)
    supabase.rpc('mark_tab_guide_seen' as never, { p_key: k } as never).then(({ data, error }) => {
      if (!error && data) qc.setQueryData(['me', uid], (old: any) => (old ? { ...old, tab_guides_seen: data } : old));
    });
  }, [uid, qc]);
  return { ready, eligible, seen, mark };
}

// 탭 안내 진행 — step: 지금 보여 줄 단계(없으면 null). 시안 te()/O() 그대로.
// active: 그 탭이 화면에 보이고 안내를 띄워도 되는 상태(가입·심사 단계가 끝난 뒤 등)
export function useTabGuide(tab: TourTab, active: boolean) {
  const { ready, eligible, seen, mark } = useSeen();
  const first = useCallback((from = 0): number | null => {
    if (seen(tab)) return null;
    if (tab !== 'profile') return 0;
    for (let i = from; i < 3; i++) if (!seen(`profile-${i}`)) return i;
    return null;
  }, [seen, tab]);
  const [step, setStep] = useState<number | null>(null);
  const on = active && ready && eligible;
  // 탭에 들어올 때 한 번 정한다(진행 중 단계는 next/close로만 바뀐다)
  useEffect(() => { setStep(on ? first() : null); }, [on]);  // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => { mark(tab); setStep(null); }, [mark, tab]);
  const next = useCallback(() => {
    if (step == null) return;
    if (tab !== 'profile') { close(); return; }
    mark(`profile-${step}`);
    const n = first(step + 1);
    if (n == null) close(); else setStep(n);
  }, [step, tab, close, mark, first]);
  return { step, next, close };
}
