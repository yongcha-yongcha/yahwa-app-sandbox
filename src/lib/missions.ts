// 야화 — 무료 리프 하루 미션(0147) 조회·축하.
// 지급은 전부 서버(트리거·RPC)가 한다. 앱은 행동 직후 오늘 미션을 다시 읽어서
// 새로 생긴 미션이 있으면 "미션 성공!" 레이어를 띄우고 잔액을 새로 고친다.
import { useQuery } from '@tanstack/react-query';
import { queryClient } from './query';
import { fetchMyMissionsToday, MISSIONS, type MissionKey } from './api';
import { showReward } from '../components/RewardLayer';

const KEY = ['missions-today'] as const;

function kstDay(ms: number): string {
  return new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);
}

export function useMissionsToday(enabled = true) {
  // 자정(KST)이 지나도 어제 미션이 남아 보이지 않게 — 열 때마다 다시 받는다(키는 축하 기준값과 공유해 그대로)
  return useQuery({ queryKey: KEY, queryFn: fetchMyMissionsToday, enabled, staleTime: 30_000, refetchOnMount: 'always' });
}

// 행동 직후 호출 — 새로 받은 미션 보상을 합쳐 한 번 축하한다. (트리거 반영이 늦을 수 있어 짧게 한 번 더 확인)
// 기준값은 앱 시작 때 prefetchMissions()로 받아 둔다. 기준이 없으면 축하 없이 값만 갱신한다.
// quiet: 보상 레이어 없이 값만 갱신(행동 피드백이 리프를 대신 보여줄 때)
export async function celebrateNewMissions(opts?: { quiet?: boolean }): Promise<number> {
  // 기준값이 어제 받은 것이면(앱을 켜 둔 채 자정이 지남) 오늘은 아직 받은 미션이 없는 것으로 본다
  const st = queryClient.getQueryState(KEY);
  const sameDay = !!st?.dataUpdatedAt && kstDay(st.dataUpdatedAt) === kstDay(Date.now());
  const cached = (queryClient.getQueryData(KEY) as Partial<Record<MissionKey, number>> | undefined) ?? null;
  const before = cached ? (sameDay ? cached : {}) : null;
  const tryOnce = async () => {
    const after = await fetchMyMissionsToday().catch(() => null);
    if (!after) return 0;
    queryClient.setQueryData(KEY, after);
    if (!before) return 0;  // 기준이 없으면 축하하지 않는다(중복 축하 방지)
    let gained = 0;
    for (const [k, v] of Object.entries(after)) if (!(k in before)) gained += Number(v) || 0;
    return gained;
  };
  let gained = await tryOnce();
  if (gained === 0) {
    await new Promise((r) => setTimeout(r, 700));
    gained = await tryOnce();
  }
  if (gained > 0) {
    if (!opts?.quiet) showReward(gained);
    queryClient.invalidateQueries({ queryKey: ['me'] });
    queryClient.invalidateQueries({ queryKey: ['leaf-balance'] });
  }
  return gained;
}

// 행동 직후 바로 띄울 보상 예상(시안: 오늘 받은 관심 보상이 2번 미만이면 5리프) — 오늘 기준값이 있을 때만
export function predictMissionGain(keys: MissionKey[]): number {
  const st = queryClient.getQueryState(KEY);
  if (!st?.dataUpdatedAt) return 0;
  const today = kstDay(st.dataUpdatedAt) === kstDay(Date.now());
  const got = today ? ((queryClient.getQueryData(KEY) as Partial<Record<MissionKey, number>> | undefined) ?? {}) : {};
  const k = keys.find((x) => !(x in got));
  return k ? (MISSIONS.find((m) => m.key === k)?.amount ?? 0) : 0;
}

export function prefetchMissions() {
  void queryClient.prefetchQuery({ queryKey: KEY, queryFn: fetchMyMissionsToday });
}
