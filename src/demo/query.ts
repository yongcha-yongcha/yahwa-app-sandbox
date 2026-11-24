// 야화 시연판 — supabase.from(...) 흉내. 목업 DB(db.ts)만 읽고 쓴다.
// 앱 코드가 쓰는 만큼만 구현했다: select(+관계 묶음·count) / insert / update / upsert / delete,
// eq·neq·gt·gte·lt·lte·in·is·not·like·ilike·contains·overlaps·or·match·filter, order·limit·range·single·maybeSingle.
import { table, insertRows, updateRows, deleteRows, logRequest, type Row } from './db';

type Result = { data: any; error: any; count?: number | null; status: number; statusText: string };
type Pred = (r: Row) => boolean;

// 관계 이름이 규칙(<단수>_id)과 다른 것만 적는다
const ONE_TO_MANY_FK: Record<string, string> = {
  'lounge_posts>lounge_comments': 'post_id',
  'chat_rooms>chat_members': 'room_id',
  'chat_rooms>chat_messages': 'room_id',
};
const singular = (t: string) => t.replace(/ies$/, 'y').replace(/s$/, '');

function splitTop(s: string): string[] {
  const out: string[] = []; let depth = 0; let cur = '';
  for (const c of s) {
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

type Embed = { alias: string; target: string; hint?: string; inner: boolean; cols: string };
type Rename = { alias: string; col: string };
function parseSelect(sel: string): { embeds: Embed[]; renames: Rename[] } {
  const embeds: Embed[] = []; const renames: Rename[] = [];
  for (const part of splitTop(sel || '*')) {
    const m = part.match(/^(?:([a-zA-Z_0-9]+):)?([a-zA-Z_0-9]+)(?:!([a-zA-Z_0-9]+))?(?:!(inner))?\s*\((.*)\)$/s);
    if (m) {
      const hint = m[3] === 'inner' ? undefined : m[3];
      embeds.push({ alias: m[1] ?? m[2], target: m[2], hint, inner: m[3] === 'inner' || m[4] === 'inner', cols: m[5] });
      continue;
    }
    const r = part.match(/^([a-zA-Z_0-9]+):([a-zA-Z_0-9]+)$/);
    if (r) renames.push({ alias: r[1], col: r[2] });
  }
  return { embeds, renames };
}

// childPreds: 'lounge_comments.deleted_at' 같은 묶음 칼럼 조건 — 묶음 행에만 걸고, 부모 행은 빼지 않는다(실제 PostgREST와 같음)
type ChildPreds = Record<string, Pred[]>;
function resolveEmbed(src: string, row: Row, e: Embed, preds: Pred[] = []): any {
  const target = table(e.target).filter((x) => preds.every((p) => p(x)));
  const isCount = e.cols.trim() === 'count';
  const nested = (rows: Row[]) => rows.map((r) => attach(e.target, { ...r }, e.cols));
  const one = (t: Row | undefined) => (t ? attach(e.target, { ...t }, e.cols) : null);
  const many = (rows: Row[]) => (isCount ? [{ count: rows.length }] : nested(rows));
  // 1) 힌트가 원본 칼럼(users:user_id) → 다대일
  if (e.hint && e.hint in row) return one(target.find((x) => x.id === row[e.hint!]));
  // 2) 제약 이름(gathering_slots_gathering_id_fkey)
  if (e.hint && e.hint.endsWith('_fkey')) {
    const body = e.hint.replace(/_fkey$/, '');
    if (body.startsWith(src + '_')) { const col = body.slice(src.length + 1); return one(target.find((x) => x.id === row[col])); }
    if (body.startsWith(e.target + '_')) { const col = body.slice(e.target.length + 1); return many(target.filter((x) => x[col] === row.id)); }
  }
  // 3) 규칙: 원본에 <대상 단수>_id가 있으면 다대일
  const fkCol = `${singular(e.target)}_id`;
  if (fkCol in row) return one(target.find((x) => x.id === row[fkCol]));
  // 4) 일대다: 대상에 <원본 단수>_id
  const back = ONE_TO_MANY_FK[`${src}>${e.target}`] ?? `${singular(src)}_id`;
  return many(target.filter((x) => x[back] === row.id));
}

function attach(src: string, row: Row, sel: string, childPreds: ChildPreds = {}): Row {
  const { embeds, renames } = parseSelect(sel);
  for (const e of embeds) row[e.alias] = resolveEmbed(src, row, e, childPreds[e.alias]);
  for (const r of renames) row[r.alias] = row[r.col];
  return row;
}

function getPath(row: Row, path: string): any {
  // JSON 칼럼 경로: meta->>feature, meta->a->>b
  if (path.includes('->')) {
    const [col, ...keys] = path.split(/->>?/);
    return keys.reduce((v: any, k) => (v == null ? v : v[k.replace(/^'|'$/g, '')]), row[col]);
  }
  if (!path.includes('.')) return row[path];
  return path.split('.').reduce((v: any, k) => (Array.isArray(v) ? v[0]?.[k] : v?.[k]), row);
}
const likeToRe = (p: string, flags: string) => new RegExp('^' + String(p).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$', flags);
function parseVal(v: string): any {
  if (v === 'null') return null; if (v === 'true') return true; if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v.replace(/^"|"$/g, '');
}
function cmp(op: string, a: any, b: any): boolean {
  switch (op) {
    case 'eq': return a === b || (a != null && b != null && String(a) === String(b));
    case 'neq': return !(a === b || (a != null && b != null && String(a) === String(b)));
    case 'gt': return a != null && a > b;
    case 'gte': return a != null && a >= b;
    case 'lt': return a != null && a < b;
    case 'lte': return a != null && a <= b;
    case 'is': return b === null ? a == null : a === b;
    case 'in': return (b as any[]).some((x) => x === a || String(x) === String(a));
    case 'like': return a != null && likeToRe(b, '').test(String(a));
    case 'ilike': return a != null && likeToRe(b, 'i').test(String(a));
    case 'cs': case 'contains':
      if (Array.isArray(a)) return (Array.isArray(b) ? b : [b]).every((x) => a.includes(x));
      if (a && typeof a === 'object') return Object.entries(b ?? {}).every(([k, v]) => a[k] === v);
      return false;
    case 'cd': case 'containedBy': return Array.isArray(a) && a.every((x) => (b as any[]).includes(x));
    case 'ov': case 'overlaps': return Array.isArray(a) && (b as any[]).some((x) => a.includes(x));
    default: return true;
  }
}
// .or('a.eq.1,b.is.null') 문자열
function parseOr(expr: string): Pred {
  const parts = splitTop(expr);
  const preds = parts.map((p): Pred => {
    const and = p.match(/^and\((.*)\)$/);
    if (and) { const inner = splitTop(and[1]).map((x) => parseOr(x)); return (r) => inner.every((f) => f(r)); }
    const [col, ...rest] = p.split('.');
    let op = rest[0]; let neg = false; let valStr = rest.slice(1).join('.');
    if (op === 'not') { neg = true; op = rest[1]; valStr = rest.slice(2).join('.'); }
    let val: any = parseVal(valStr);
    if (op === 'in') val = valStr.replace(/^\(|\)$/g, '').split(',').map(parseVal);
    return (r) => { const ok = cmp(op, getPath(r, col), val); return neg ? !ok : ok; };
  });
  return (r) => preds.some((f) => f(r));
}

class Query implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private sel = '*';
  private wantRows = true;   // insert/update/delete 뒤에 .select() 했는지
  private payload: any = null;
  private opts: any = {};
  private preds: Pred[] = [];
  private childPreds: ChildPreds = {};
  private orders: { col: string; asc: boolean; nullsFirst?: boolean }[] = [];
  private lim: number | null = null;
  private from_: number | null = null; private to_: number | null = null;
  private single_: 'one' | 'maybe' | null = null;
  private countMode: string | null = null; private head = false;

  constructor(private t: string) {}

  select(cols = '*', o: { count?: string; head?: boolean } = {}) {
    if (this.op === 'select') { this.sel = cols; this.countMode = o.count ?? null; this.head = !!o.head; }
    else { this.sel = cols; this.wantRows = true; }
    return this;
  }
  insert(rows: any, o: any = {}) { this.op = 'insert'; this.payload = rows; this.opts = o; this.wantRows = false; return this; }
  upsert(rows: any, o: any = {}) { this.op = 'upsert'; this.payload = rows; this.opts = o; this.wantRows = false; return this; }
  update(patch: any, o: any = {}) { this.op = 'update'; this.payload = patch; this.opts = o; this.wantRows = false; return this; }
  delete(o: any = {}) { this.op = 'delete'; this.opts = o; this.wantRows = false; return this; }

  private add(col: string, op: string, val: any, neg = false) {
    if (col.includes('.') && !col.includes('->')) {
      const [alias, ...rest] = col.split('.');
      const sub = rest.join('.');
      (this.childPreds[alias] ??= []).push((r) => { const ok = cmp(op, getPath(r, sub), val); return neg ? !ok : ok; });
      return this;
    }
    this.preds.push((r) => { const ok = cmp(op, getPath(r, col), val); return neg ? !ok : ok; });
    return this;
  }
  eq(c: string, v: any) { return this.add(c, 'eq', v); }
  neq(c: string, v: any) { return this.add(c, 'neq', v); }
  gt(c: string, v: any) { return this.add(c, 'gt', v); }
  gte(c: string, v: any) { return this.add(c, 'gte', v); }
  lt(c: string, v: any) { return this.add(c, 'lt', v); }
  lte(c: string, v: any) { return this.add(c, 'lte', v); }
  in(c: string, v: any[]) { return this.add(c, 'in', v ?? []); }
  is(c: string, v: any) { return this.add(c, 'is', v); }
  like(c: string, v: string) { return this.add(c, 'like', v); }
  ilike(c: string, v: string) { return this.add(c, 'ilike', v); }
  contains(c: string, v: any) { return this.add(c, 'cs', v); }
  containedBy(c: string, v: any) { return this.add(c, 'cd', v); }
  overlaps(c: string, v: any) { return this.add(c, 'ov', v); }
  not(c: string, op: string, v: any) {
    let val = v;
    if (op === 'in' && typeof v === 'string') val = v.replace(/^\(|\)$/g, '').split(',').map(parseVal);
    return this.add(c, op, val, true);
  }
  filter(c: string, op: string, v: any) {
    if (op === 'in' && typeof v === 'string') return this.add(c, 'in', v.replace(/^\(|\)$/g, '').split(',').map(parseVal));
    return this.add(c, op, typeof v === 'string' ? parseVal(v) : v);
  }
  match(obj: Record<string, any>) { Object.entries(obj).forEach(([k, v]) => this.eq(k, v)); return this; }
  or(expr: string) { this.preds.push(parseOr(expr)); return this; }
  textSearch() { return this; }
  order(col: string, o: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: string; referencedTable?: string } = {}) {
    if (o.foreignTable || o.referencedTable) return this;
    this.orders.push({ col, asc: o.ascending !== false, nullsFirst: o.nullsFirst }); return this;
  }
  limit(n: number) { this.lim = n; return this; }
  range(a: number, b: number) { this.from_ = a; this.to_ = b; return this; }
  single() { this.single_ = 'one'; return this; }
  maybeSingle() { this.single_ = 'maybe'; return this; }
  returns() { return this; }
  abortSignal() { return this; }
  throwOnError() { return this; }

  private match_(r: Row) { return this.preds.every((p) => p(r)); }

  private finish(rows: Row[], withEmbeds = true): Result {
    let out = rows.map((r) => (withEmbeds ? attach(this.t, { ...r }, this.sel, this.childPreds) : { ...r }));
    // 묶음 조건으로 비게 된 !inner 묶음은 부모 행째 뺀다
    for (const e of parseSelect(this.sel).embeds) if (e.inner) out = out.filter((r) => r[e.alias] != null && (!Array.isArray(r[e.alias]) || r[e.alias].length));
    if (this.orders.length) {
      out.sort((a, b) => {
        for (const o of this.orders) {
          const x = getPath(a, o.col); const y = getPath(b, o.col);
          if (x == null && y == null) continue;
          if (x == null) return o.nullsFirst ? -1 : 1;
          if (y == null) return o.nullsFirst ? 1 : -1;
          if (x < y) return o.asc ? -1 : 1;
          if (x > y) return o.asc ? 1 : -1;
        }
        return 0;
      });
    }
    const total = out.length;
    if (this.from_ != null) out = out.slice(this.from_, (this.to_ ?? out.length - 1) + 1);
    if (this.lim != null) out = out.slice(0, this.lim);
    if (this.head) return ok(null, total);
    if (this.single_) {
      if (out.length === 0) return this.single_ === 'maybe' ? ok(null) : err('행이 없어요', 'PGRST116');
      return ok(out[0], this.countMode ? total : null);
    }
    return ok(out, this.countMode ? total : null);
  }

  private run(): Result {
    const t = this.t;
    try {
      if (this.op === 'select') {
        logRequest({ kind: 'select', name: t });
        return this.finish(table(t).filter((r) => this.match_(r)));
      }
      if (this.op === 'insert') {
        logRequest({ kind: 'insert', name: t });
        const rows = insertRows(t, this.payload);
        return this.wantRows ? this.finish(rows) : ok(null);
      }
      if (this.op === 'upsert') {
        logRequest({ kind: 'upsert', name: t });
        const keys: string[] = String(this.opts.onConflict ?? 'id').split(',').map((s: string) => s.trim());
        const list = Array.isArray(this.payload) ? this.payload : [this.payload];
        const out: Row[] = [];
        for (const p of list) {
          const hit = table(t).find((r) => keys.every((k) => p[k] !== undefined && r[k] === p[k]));
          if (hit) { if (!this.opts.ignoreDuplicates) out.push(...updateRows(t, (r) => r === hit, p)); }
          else out.push(...insertRows(t, p));
        }
        return this.wantRows ? this.finish(out) : ok(null);
      }
      if (this.op === 'update') {
        logRequest({ kind: 'update', name: t });
        const rows = updateRows(t, (r) => this.match_(r), this.payload);
        return this.wantRows ? this.finish(rows) : ok(null, this.opts.count ? rows.length : null);
      }
      logRequest({ kind: 'delete', name: t });
      const gone = deleteRows(t, (r) => this.match_(r));
      return this.wantRows ? this.finish(gone, false) : ok(null, this.opts.count ? gone.length : null);
    } catch (e: any) {
      return err(e?.message ?? String(e), e?.code);
    }
  }

  then<A = Result, B = never>(onF?: ((v: Result) => A | PromiseLike<A>) | null, onR?: ((e: any) => B | PromiseLike<B>) | null): Promise<A | B> {
    // 실제 네트워크처럼 아주 잠깐 늦게 — 로딩 상태가 한 번은 그려지게
    return new Promise<Result>((res) => setTimeout(() => res(this.run()), 40)).then(onF as any, onR as any);
  }
  catch(onR: (e: any) => any) { return this.then(undefined, onR); }
  finally(f: () => void) { return this.then((v) => { f(); return v; }, (e) => { f(); throw e; }); }
}

export function ok(data: any, count: number | null = null): Result { return { data, error: null, count, status: 200, statusText: 'OK' }; }
export function err(message: string, code = 'demo_error'): Result { return { data: null, error: { message, code, details: null, hint: null }, count: null, status: 400, statusText: 'Bad Request' }; }

export function from(t: string) { return new Query(t); }
