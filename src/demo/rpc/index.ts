// 야화 시연판 — 서버 함수(supabase.rpc) 목업 모음. 영역별 파일의 함수를 합친다.
// 여기 없는 이름을 앱이 부르면 빈 값(null)으로 응답하고, 시연도구 '요청 기록'에 '목업 없음'으로 보인다.
// 파일끼리 서로 불러오는 순서에 흔들리지 않게, 부를 때 찾는다.
import * as affinity from './affinity';
import * as letters from './letters';
import * as community from './community';
import * as my from './my';

// 뒤에 있는 영역이 같은 이름을 덮어쓴다
const AREAS = () => [affinity, letters, community, my];

export function findRpc(name: string): ((args: any) => any) | undefined {
  let found: ((args: any) => any) | undefined;
  for (const a of AREAS()) { const f = (a as any).rpc?.[name]; if (f) found = f; }
  return found;
}
export function allScenarios() {
  return [letters, affinity, community, my].flatMap((a) => (a as any).scenarios ?? []);
}
export function demoControls(): any { return (affinity as any).controls ?? {}; }
