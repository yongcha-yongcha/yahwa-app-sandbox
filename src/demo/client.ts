// 야화 시연판 — 가짜 Supabase 클라이언트.
// 앱 코드는 그대로 `supabase.from/rpc/auth/storage/functions/channel`을 부르지만,
// 여기서 전부 브라우저 안 목업 DB(db.ts)로 처리한다. 네트워크로 나가는 요청은 하나도 없다.
import { from, ok, err } from './query';
import { meta, saveMeta, ME_ID, me, logRequest, onRowChange, DemoError, nowIso, touch, type Row } from './db';
import { findRpc } from './rpc';
import { invokeFunction } from './functions';

// ── 로그인(가짜 세션) ─────────────────────────────────────────
type AuthCb = (event: string, session: any) => void;
const authListeners = new Set<AuthCb>();

function makeSession() {
  const u = me();
  const user = {
    id: ME_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: u?.email ?? 'demo@yahwa.local',
    phone: '',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { nickname: u?.nickname ?? '' },
    created_at: u?.created_at ?? nowIso(),
    identities: [],
  };
  return {
    access_token: 'demo-access-token',
    refresh_token: 'demo-refresh-token',
    token_type: 'bearer',
    expires_in: 3600 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
    user,
  };
}
function currentSession() { return meta.signedIn ? makeSession() : null; }

export function setSignedIn(v: boolean) {
  if (meta.signedIn === v) return;
  meta.signedIn = v;
  saveMeta();
  const s = currentSession();
  authListeners.forEach((cb) => { try { cb(v ? 'SIGNED_IN' : 'SIGNED_OUT', s); } catch { /* noop */ } });
}

function signedInResult() {
  setSignedIn(true);
  const s = makeSession();
  return { data: { session: s, user: s.user }, error: null };
}

const auth = {
  async getSession() { return { data: { session: currentSession() }, error: null }; },
  async getUser() { const s = currentSession(); return { data: { user: s?.user ?? null }, error: null }; },
  onAuthStateChange(cb: AuthCb) {
    authListeners.add(cb);
    // 실제 supabase-js처럼 구독 직후 현재 상태를 한 번 알려 준다
    setTimeout(() => cb('INITIAL_SESSION', currentSession()), 0);
    return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
  },
  async signInWithPassword(_: any) { logRequest({ kind: 'auth', name: 'signInWithPassword' }); return signedInResult(); },
  async signInWithIdToken(_: any) { logRequest({ kind: 'auth', name: 'signInWithIdToken' }); return signedInResult(); },
  async signInWithOAuth(_: any) {
    // 카카오 등 바깥 로그인 페이지로 보내지 않고 바로 로그인된 것으로 처리
    logRequest({ kind: 'auth', name: 'signInWithOAuth', note: '바깥 로그인 페이지로 이동하지 않음' });
    signedInResult();
    return { data: { url: null, provider: 'kakao' }, error: null };
  },
  async signUp(p: any) {
    logRequest({ kind: 'auth', name: 'signUp', note: '메일은 보내지 않아요 · 인증번호는 아무 6자리' });
    const u = me(); if (u && p?.email) { u.email = p.email; touch(); }
    // 실제처럼 인증번호 확인 전에는 세션 없음
    return { data: { user: { id: ME_ID, email: p?.email, identities: [{}] }, session: null }, error: null };
  },
  async verifyOtp(_: any) { logRequest({ kind: 'auth', name: 'verifyOtp', note: '아무 번호나 통과' }); return signedInResult(); },
  async resend(_: any) { logRequest({ kind: 'auth', name: 'resend', note: '메일은 보내지 않아요' }); return { data: {}, error: null }; },
  async resetPasswordForEmail(_: any) { logRequest({ kind: 'auth', name: 'resetPasswordForEmail', note: '메일은 보내지 않아요' }); return { data: {}, error: null }; },
  async updateUser(p: any) { logRequest({ kind: 'auth', name: 'updateUser' }); return { data: { user: { ...makeSession().user, ...p } }, error: null }; },
  async exchangeCodeForSession(_: any) { return signedInResult(); },
  async setSession(_: any) { return signedInResult(); },
  async refreshSession() { return { data: { session: currentSession(), user: currentSession()?.user ?? null }, error: null }; },
  async signOut() { logRequest({ kind: 'auth', name: 'signOut' }); setSignedIn(false); return { error: null }; },
  async startAutoRefresh() {},
  async stopAutoRefresh() {},
};

// ── RPC ─────────────────────────────────────────────────────
async function rpc(name: string, args: any = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const h = findRpc(name);
  if (!h) {
    logRequest({ kind: 'rpc', name, missing: true, note: '목업 없음 — 빈 값으로 응답' });
    if (typeof console !== 'undefined') console.warn(`[시연판] '${name}' 함수의 목업이 없어 빈 값으로 응답했어요. src/demo/rpc/ 에 추가하면 돼요.`);
    return ok(null);
  }
  logRequest({ kind: 'rpc', name });
  try {
    return ok(await h(args ?? {}));
  } catch (e: any) {
    if (e instanceof DemoError) return err(e.message, e.code);
    console.error(`[시연판] '${name}' 목업에서 오류`, e);
    return err(e?.message ?? String(e));
  }
}
// .rpc(...).single() / .maybeSingle() 도 쓰는 곳이 있어 thenable로 감싼다
function rpcBuilder(name: string, args: any) {
  let mode: 'many' | 'one' | 'maybe' = 'many';
  const p = () => rpc(name, args).then((r) => {
    if (mode === 'many' || r.error) return r;
    const d = Array.isArray(r.data) ? r.data[0] ?? null : r.data;
    if (d == null && mode === 'one') return err('행이 없어요', 'PGRST116');
    return { ...r, data: d };
  });
  const b: any = {
    single() { mode = 'one'; return b; },
    maybeSingle() { mode = 'maybe'; return b; },
    select() { return b; }, eq() { return b; }, limit() { return b; }, order() { return b; }, returns() { return b; }, abortSignal() { return b; },
    then(f: any, r: any) { return p().then(f, r); },
    catch(r: any) { return p().catch(r); },
  };
  return b;
}

// ── 사진 저장소(브라우저 메모리) ─────────────────────────────
const blobs = new Map<string, string>();  // `${bucket}/${path}` → object URL / data URL
async function toUrl(body: any): Promise<string> {
  try {
    if (typeof Blob !== 'undefined' && body instanceof Blob) {
      return await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(body); });
    }
    if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
      const blob = new Blob([body as any], { type: 'image/jpeg' });
      return await toUrl(blob);
    }
  } catch { /* 아래로 */ }
  return '/demo/people/person-01-1.jpg';
}
const storage = {
  from(bucket: string) {
    const key = (p: string) => `${bucket}/${p}`;
    return {
      async upload(path: string, body: any) {
        logRequest({ kind: 'storage', name: `upload ${bucket}`, note: '이 브라우저에만 저장' });
        blobs.set(key(path), await toUrl(body));
        return { data: { path, id: path, fullPath: key(path) }, error: null };
      },
      getPublicUrl(path: string) { return { data: { publicUrl: blobs.get(key(path)) ?? path } }; },
      async createSignedUrl(path: string) { return { data: { signedUrl: blobs.get(key(path)) ?? path }, error: null }; },
      async createSignedUrls(paths: string[]) { return { data: paths.map((p) => ({ path: p, signedUrl: blobs.get(key(p)) ?? p, error: null })), error: null }; },
      async remove(paths: string[]) { paths.forEach((p) => blobs.delete(key(p))); return { data: [], error: null }; },
      async download(path: string) { return { data: null, error: { message: `demo: ${path}` } }; },
      async list() { return { data: [], error: null }; },
    };
  },
};

// ── 실시간(postgres_changes) — 목업 DB가 바뀌면 그대로 알려 준다 ─────
function channel(_name: string) {
  const subs: { event: string; table: string; filter?: string; cb: (p: any) => void }[] = [];
  let off: (() => void) | null = null;
  const ch: any = {
    on(_type: string, f: { event: string; table: string; filter?: string }, cb: (p: any) => void) { subs.push({ ...f, cb }); return ch; },
    subscribe(statusCb?: (s: string) => void) {
      off = onRowChange((e) => {
        for (const s of subs) {
          if (s.table !== e.table) continue;
          if (s.event !== '*' && s.event !== e.type) continue;
          if (s.filter) {
            const m = s.filter.match(/^(\w+)=eq\.(.+)$/);
            if (m && String(e.row[m[1]]) !== m[2]) continue;
          }
          setTimeout(() => s.cb({ eventType: e.type, new: e.type === 'DELETE' ? {} : e.row, old: e.old ?? {}, table: e.table, schema: 'public' }), 0);
        }
      });
      statusCb?.('SUBSCRIBED');
      return ch;
    },
    unsubscribe() { off?.(); off = null; return Promise.resolve('ok'); },
    send() { return Promise.resolve('ok'); },
    track() { return Promise.resolve('ok'); },
    presenceState() { return {}; },
  };
  return ch;
}

export const demoClient: any = {
  from,
  rpc: (name: string, args?: any) => rpcBuilder(name, args),
  auth,
  storage,
  functions: { invoke: (name: string, opts?: any) => invokeFunction(name, opts) },
  channel,
  removeChannel(ch: any) { ch?.unsubscribe?.(); return Promise.resolve('ok'); },
  removeAllChannels() { return Promise.resolve([]); },
  getChannels() { return []; },
};

export type { Row };
