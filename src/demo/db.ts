// 야화 시연판 — 브라우저 안에만 있는 목업 DB.
// 운영 서버(Supabase)는 이 저장소에 주소도 키도 없다. 모든 읽기·쓰기는 이 파일의 표(table)에서 끝난다.
// 바뀐 내용은 이 브라우저(localStorage)에만 남고, 시연도구의 '처음 상태로'를 누르면 시드로 돌아간다.
import { buildSeed } from './seed';

export type Row = Record<string, any>;
type Tables = Record<string, Row[]>;
type ChangeEvent = { table: string; type: 'INSERT' | 'UPDATE' | 'DELETE'; row: Row; old?: Row };

const STORAGE_KEY = 'yahwa-demo-db-v1';
const META_KEY = 'yahwa-demo-meta-v1';

// 데모 속 '나'의 id. 로그아웃 상태면 세션만 없어지고 이 행은 그대로 남는다.
export const ME_ID = 'demo-me';

// ── 데모 메타(시연도구에서 바꾸는 값) ─────────────────────────
export type DemoMeta = {
  signedIn: boolean;
  timeOffsetMs: number;   // '시간 흐르게 하기' — 지금 시각을 앞당겨 본다
};
const defaultMeta = (): DemoMeta => ({ signedIn: true, timeOffsetMs: 0 });

function loadJson<T>(key: string): T | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
function saveJson(key: string, v: unknown) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(v)); } catch { /* 저장 실패해도 화면은 계속 */ }
}

export const meta: DemoMeta = { ...defaultMeta(), ...(loadJson<DemoMeta>(META_KEY) ?? {}) };

// 표 묶음 — 맨 아래에서 시드(또는 이 브라우저에 저장된 값)로 채운다
let tables: Tables | null = null;
let SIG = '';
// 처음 쓸 때 시드를 만든다(파일 불러오는 순서와 상관없이 모든 시드 파일이 준비된 뒤)
function T(): Tables { if (!tables) loadTables(); return tables!; }

// ── 시각 ───────────────────────────────────────────────────
export function now(): number { return Date.now() + meta.timeOffsetMs; }
export function nowIso(): string { return new Date(now()).toISOString(); }
export function minutesAgo(m: number): string { return new Date(now() - m * 60_000).toISOString(); }
export function hoursAgo(h: number): string { return minutesAgo(h * 60); }
export function daysAgo(d: number): string { return minutesAgo(d * 1440); }
export function daysLater(d: number): string { return minutesAgo(-d * 1440); }

let seq = 0;
export function newId(prefix = 'id'): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
// uuid 모양이 필요한 곳용
export function uuid(): string {
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${h()}${h()}-${h()}-4${h().slice(1)}-a${h().slice(1)}-${h()}${h()}${h()}`;
}

// ── 표 다루기 ───────────────────────────────────────────────
export function table(name: string): Row[] {
  const t = T();
  if (!t[name]) t[name] = [];
  return t[name];
}
export function allTables(): Tables { return T(); }
export function me(): Row | undefined { return table('users').find((u) => u.id === ME_ID); }
// 로그인한 경우에만 나의 id
export function uid(): string | null { return meta.signedIn ? ME_ID : null; }
export function requireUid(): string {
  const id = uid();
  if (!id) throw new DemoError('로그인이 필요해요', 'not_authenticated');
  return id;
}
export function userById(id: string | null | undefined): Row | undefined {
  return id ? table('users').find((u) => u.id === id) : undefined;
}

// 실제 DB의 칼럼 기본값(default) 흉내 — insert 때 빠진 값을 채운다
const TABLE_DEFAULTS: Record<string, () => Row> = {
  user_coupons: () => ({ status: 'active', granted_at: nowIso(), granted_day: nowIso().slice(0, 10), used_at: null }),
};
export function insertRows(name: string, rows: Row | Row[]): Row[] {
  const list = Array.isArray(rows) ? rows : [rows];
  const out = list.map((r) => ({ id: r.id ?? uuid(), created_at: r.created_at ?? nowIso(), ...(TABLE_DEFAULTS[name]?.() ?? {}), ...r }));
  table(name).push(...out);
  out.forEach((row) => emit({ table: name, type: 'INSERT', row }));
  touch();
  return out;
}
export function updateRows(name: string, pred: (r: Row) => boolean, patch: Row | ((r: Row) => Row)): Row[] {
  const out: Row[] = [];
  for (const r of table(name)) {
    if (!pred(r)) continue;
    const old = { ...r };
    Object.assign(r, typeof patch === 'function' ? patch(r) : patch);
    out.push(r);
    emit({ table: name, type: 'UPDATE', row: r, old });
  }
  if (out.length) touch();
  return out;
}
export function deleteRows(name: string, pred: (r: Row) => boolean): Row[] {
  const t = table(name);
  const gone = t.filter(pred);
  if (!gone.length) return gone;
  T()[name] = t.filter((r) => !pred(r));
  gone.forEach((row) => emit({ table: name, type: 'DELETE', row, old: row }));
  touch();
  return gone;
}

// ── 오류 ───────────────────────────────────────────────────
export class DemoError extends Error {
  code: string;
  constructor(message: string, code = 'demo_error') { super(message); this.code = code; }
}

// ── 저장·구독 ───────────────────────────────────────────────
let saveTimer: any = null;
const listeners = new Set<() => void>();
export function touch() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveJson(STORAGE_KEY, { sig: SIG, tables: T() }); saveTimer = null; }, 200);
  listeners.forEach((l) => l());
}
export function saveMeta() { saveJson(META_KEY, meta); listeners.forEach((l) => l()); }
export function onDbChange(cb: () => void): () => void { listeners.add(cb); return () => { listeners.delete(cb); }; }

const changeListeners = new Set<(e: ChangeEvent) => void>();
function emit(e: ChangeEvent) { changeListeners.forEach((l) => { try { l(e); } catch { /* 구독자 오류는 무시 */ } }); }
export function onRowChange(cb: (e: ChangeEvent) => void): () => void { changeListeners.add(cb); return () => { changeListeners.delete(cb); }; }

// 시드로 되돌리기(시연도구 '처음 상태로')
export function resetDb() {
  tables = buildSeed();
  SIG = seedSignature(tables);
  Object.assign(meta, defaultMeta());
  saveJson(STORAGE_KEY, { sig: SIG, tables });
  saveJson(META_KEY, meta);
  listeners.forEach((l) => l());
}

// ── 요청 기록(시연도구 '가짜로 처리한 요청'에 보임) ───────────────
export type LogItem = { at: number; kind: 'rpc' | 'select' | 'insert' | 'update' | 'delete' | 'upsert' | 'auth' | 'storage' | 'function' | 'fetch'; name: string; note?: string; missing?: boolean };
const log: LogItem[] = [];
const logListeners = new Set<() => void>();
export function logRequest(item: Omit<LogItem, 'at'>) {
  log.unshift({ ...item, at: Date.now() });
  if (log.length > 200) log.length = 200;
  logListeners.forEach((l) => l());
}
export function getLog(): LogItem[] { return log; }
export function onLog(cb: () => void): () => void { logListeners.add(cb); return () => { logListeners.delete(cb); }; }

// 시드 파일을 고치면(글·이름·편지 내용 등) 브라우저에 저장된 옛 데이터 대신 새 시드로 다시 시작한다.
// 시각·무작위 id는 열 때마다 달라지므로 빼고 비교한다.
function seedSignature(t: Tables): string {
  const s = JSON.stringify(t)
    .replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '')
    .replace(/-[0-9a-z]{8,}(?=")/g, '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `${s.length}:${h}`;
}
function loadTables() {
  const freshSeed = buildSeed();
  SIG = seedSignature(freshSeed);
  const stored = loadJson<{ sig: string; tables: Tables }>(STORAGE_KEY);
  tables = stored && stored.sig === SIG ? stored.tables : freshSeed;
}
