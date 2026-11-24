// 야화 — 태그히어 매장 포인트를 앱에서 직접 가져와 맞춘다(pull).
//
// 태그히어 CRM은 직원 수동 적립 때만 야화에 웹훅을 보내고, 손님 자동 적립(카카오·네이버
// 로그인 적립, 테이블오더 자동 적립 등)은 알려주지 않는다(1013 조사). 그래서 앱을 열거나
// 다시 돌아올 때 /api/points-link로 최신 잔액을 끌어와 미러에 반영한다.
// 미러 테이블은 실시간 구독 중이라 반영되는 즉시 화면 포인트가 바뀐다.
import { supabase } from './supabase';
import { apiOrigin } from './apiOrigin';
import { queryClient } from './query';
import { fetchMe } from './api';

const MIN_INTERVAL_MS = 5 * 60_000;  // 같은 계정은 5분에 한 번까지만
let lastAt = 0;
let lastUid: string | null = null;   // 다른 계정으로 바꿔 로그인하면 바로 다시 가져온다
let inflight: Promise<void> | null = null;

export function syncTaghirePoints(opts?: { force?: boolean }): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      if (!opts?.force && session.user.id === lastUid && Date.now() - lastAt < MIN_INTERVAL_MS) return;
      lastUid = session.user.id;
      lastAt = Date.now();
      const r = await fetch(`${apiOrigin()}/api/points-link`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!r.ok) return;
      // 응답 { ok, balance } — balance는 서버 미러 합계(users.points)와 같은 값. 이미 받은 내 정보와 같으면
      // 바뀐 게 없으니 다시 받지 않는다(앱 시작 직후 내 정보를 한 번 더 받던 것). 미러가 바뀌면 루트 realtime도 갱신한다.
      const body = await r.json().catch(() => null) as { ok?: boolean; balance?: number } | null;
      const key = ['me', session.user.id];
      const me = await queryClient.ensureQueryData({ queryKey: key, queryFn: fetchMe }).catch(() => null) as { points?: number } | null;
      if (body?.ok && typeof body.balance === 'number' && typeof me?.points === 'number' && me.points === body.balance) return;
      queryClient.invalidateQueries({ queryKey: ['me'] });
    } catch {
      /* 무해 — 다음 앱 진입 때 다시 시도 */
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
