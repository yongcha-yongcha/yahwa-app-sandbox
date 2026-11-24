// 야화 시연판 — 서버 함수(Edge Function)와 /api/* 서버 경로를 흉내.
// 결제·메일·알림톡·태그히어 같은 바깥 서비스로는 아무것도 보내지 않는다.
import { logRequest, me, updateRows, insertRows, ME_ID, nowIso, table } from './db';

type FnResult = { data: any; error: any };
const okFn = (data: any): FnResult => ({ data, error: null });

export async function invokeFunction(name: string, opts: { body?: any } = {}): Promise<FnResult> {
  await new Promise((r) => setTimeout(r, 120));
  const body = opts?.body ?? {};
  logRequest({ kind: 'function', name, note: '바깥 서비스로 보내지 않음' });
  switch (name) {
    case 'face-check': return okFn({ ok: true });
    case 'univ-verify':
      if (body.action === 'request') return okFn({ ok: true, univName: '야화대학교' });
      if (body.action === 'confirm') {
        updateRows('users', (u) => u.id === ME_ID, { univ_name: '야화대학교', univ_verified_at: nowIso() });
        return okFn({ ok: true });
      }
      return okFn({ ok: true });
    case 'place-search':
      return okFn({ results: [
        { name: '야화 라운지 성수', address: '서울 성동구 성수동 1가', lat: 37.5446, lng: 127.0557 },
        { name: '야화 라운지 연남', address: '서울 마포구 연남동', lat: 37.5622, lng: 126.9254 },
      ] });
    case 'place-lookup': return okFn({ ok: true, place: null });
    case 'tosspay-confirm': {
      // 시연판 결제 — 돈은 오가지 않고 리프만 늘어난다
      const n = Number(body.leafCount) || 0;
      const u = me();
      if (u && n > 0) {
        updateRows('users', (x) => x.id === ME_ID, { leaf_balance: (u.leaf_balance ?? 0) + n });
        insertRows('transactions', { user_id: ME_ID, kind: 'charge', amount: n, provider: 'demo', meta: { won: body.amount }, created_at: nowIso() });
      }
      return okFn({ ok: true });
    }
    case 'tosspay-gather-confirm': return okFn({ ok: true });
    case 'delete-account': return okFn({ ok: true });
    default: return okFn({ ok: true });
  }
}

// /api/* — 같은 출처의 서버 경로. 응답 본문(JSON)을 돌려준다.
export function apiRoute(path: string, body: any): any {
  const u = me();
  switch (path) {
    case '/api/gender-stats': return { ok: true, stats: [] };
    case '/api/points-link': return { ok: true, balance: u?.points ?? 0 };
    case '/api/points-spend': {
      const amount = Number(body?.amount) || 0;
      if ((u?.points ?? 0) < amount) return { ok: false, reason: '포인트가 부족해요' };
      updateRows('users', (x) => x.id === ME_ID, { points: (u?.points ?? 0) - amount });
      return { ok: true };
    }
    case '/api/points-exchange': {
      const leaf = Number(body?.leaf) || 0;
      const cost = leaf * 100;
      if ((u?.points ?? 0) < cost) return { ok: false, reason: '포인트가 부족해요' };
      updateRows('users', (x) => x.id === ME_ID, { points: (u?.points ?? 0) - cost, leaf_balance: (u?.leaf_balance ?? 0) + leaf });
      return { ok: true, leaf, pointsSpent: cost };
    }
    case '/api/taghere-sync-stores': return { ok: true, updated: 0 };
    case '/api/waiting': return { ok: true, waitingId: `demo-${Date.now()}`, position: 3, etaMinutes: 24 };
    case '/api/alimtalk': return { ok: true };
    case '/api/geocode': return { ok: true, lat: 37.5446, lng: 127.0557 };
    case '/api/naver-place': return { ok: true };
    default: return { ok: true };
  }
}

export { table };
