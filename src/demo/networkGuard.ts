// 야화 시연판 — 네트워크 안전장치.
// 앱이 서버(/api/*)·Supabase·결제·알림톡으로 보내려는 요청을 브라우저 밖으로 내보내지 않고 여기서 받는다.
// 사진·글꼴·화면 파일처럼 읽기만 하는 요청은 그대로 통과한다.
import { apiRoute } from './functions';
import { logRequest } from './db';

// 밖으로 나가면 안 되는 주소(운영 서버·결제·메시지)
const BLOCKED = [/supabase\.(co|in)/i, /yahwa\.vercel\.app/i, /tosspayments\.com/i, /solapi|aligo|alimtalk|kakao\.com\/v\d\/api/i, /taghere/i, /revenuecat/i, /exp\.host\/--\/api\/v2\/push/i];

function json(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function installNetworkGuard() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function' || (window as any).__yahwaDemoGuard) return;
  (window as any).__yahwaDemoGuard = true;
  const raw = window.fetch.bind(window);
  window.fetch = async (input: any, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input?.url ?? String(input);
    let u: URL | null = null;
    try { u = new URL(url, window.location.href); } catch { /* 상대경로 아님 */ }
    if (u && u.origin === window.location.origin && u.pathname.startsWith('/api/')) {
      let body: any = null;
      try { body = init?.body ? JSON.parse(String(init.body)) : null; } catch { /* 본문 없음 */ }
      logRequest({ kind: 'fetch', name: u.pathname, note: '서버로 보내지 않고 시연판이 응답' });
      await new Promise((r) => setTimeout(r, 80));
      return json(apiRoute(u.pathname, body));
    }
    if (BLOCKED.some((re) => re.test(url))) {
      logRequest({ kind: 'fetch', name: u?.host ?? url, note: '차단 — 운영 서버로 나가지 않음' });
      console.warn('[시연판] 운영 서버로 가는 요청을 막았어요:', url);
      return json({ ok: false, error: 'blocked in demo' }, 503);
    }
    return raw(input, init);
  };
  // XMLHttpRequest로 운영 주소에 가는 것도 막는다
  const XO = (window as any).XMLHttpRequest?.prototype?.open;
  if (XO) {
    (window as any).XMLHttpRequest.prototype.open = function (method: string, url: string, ...rest: any[]) {
      if (BLOCKED.some((re) => re.test(String(url)))) {
        logRequest({ kind: 'fetch', name: String(url), note: '차단 — 운영 서버로 나가지 않음' });
        return XO.call(this, method, 'data:application/json,{"ok":false}', ...rest);
      }
      return XO.call(this, method, url, ...rest);
    };
  }
}
