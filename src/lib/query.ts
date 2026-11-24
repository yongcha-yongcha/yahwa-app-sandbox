// 야화 — React Query 클라이언트
import { AppState, Platform } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';

// RN은 window focus 이벤트가 없어 AppState로 연결 — 앱 포그라운드 복귀 시
// refetchOnWindowFocus를 켠 쿼리(지도 웨이팅/성별 등)가 재조회된다.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      // 앱을 백그라운드에 뒀다가(푸시 확인 등) 복귀하면 stale 쿼리를 자동 재조회 —
      // "다시 켜야 새로고침되는" 문제 해결. staleTime 이내 복귀는 재조회 안 하므로 저렴.
      refetchOnWindowFocus: true,
      // 화면 재진입 시 캐시는 바로 보여 주고 staleTime(60초)이 지난 것만 다시 불러온다.
      // 오버레이가 탭 화면을 언마운트해서, false면 마운트 안 된 쿼리는 invalidate해도 영영 옛 캐시였다
      // (지운 글·차단한 사람·읽은 점·보낸 하트가 그대로 남던 원인).
      refetchOnMount: true,
    },
    mutations: {
      retry: 0,  // 결제·차감 같은 mutation 재시도 금지
    },
  },
});

// 탭 전환 시 새로고침에서 제외할 쿼리(첫 키 기준):
//  - gender-stats: 태그히어 유료 호출 + 이미 30초 폴링
//  - leaf-packages: 정적 상품 목록
//  (me는 뺐다(1110) — 탭 화면을 숨겨 두게 되면서(KeepAlive) 화면이 새로 그려질 때 받던 재조회가 없어져,
//   여기서 60초 지난 것만 다시 받아 예전과 같은 주기를 유지한다)
//  - letters: 루트가 60초마다 폴링 + 보내기·읽기·푸시가 직접 갱신
const SKIP_ON_TAB_FOCUS = new Set(['gender-stats', 'leaf-packages', 'letters']);

// 탭이 활성화될 때 화면에 보이는(mounted=active) 컨텐츠 쿼리 중 "stale된 것만" 재조회한다.
// RN은 탭 전환이 window focus 이벤트가 아니라, 전환해도 캐시가 그대로 남아 "정적"으로 보였다.
// 단 매 전환마다 fresh까지 강제 refetch하면(=invalidate) 부하가 커 전반 속도가 느려진다 →
// refetchQueries({stale:true})로 staleTime 지난 것만 다시 불러와 부하를 최소화한다.
// (즉시 반영이 필요한 연락처 차단 등은 각 지점에서 명시적으로 invalidate한다.)
export function refreshVisibleQueries() {
  queryClient.refetchQueries({
    type: 'active',
    stale: true,
    predicate: (q) => {
      const k = q.queryKey?.[0];
      return typeof k !== 'string' || !SKIP_ON_TAB_FOCUS.has(k);
    },
  }, { cancelRefetch: false });  // 마운트 재조회로 이미 불러오는 중이면 그대로 기다린다(취소 후 재요청 X)
}

// 화면 전환 움직임(0.42초)과 겹치지 않게 조금 뒤에 — 연달아 불리면 마지막 한 번만
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
export function refreshVisibleQueriesSoon() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { refreshTimer = null; refreshVisibleQueries(); }, 450);
}
