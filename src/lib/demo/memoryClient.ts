// An in-memory stand-in for the part of supabase-js the app uses: from(table)
// with select, insert, upsert, update and delete, PostgREST's filters, order,
// limit, range, single and maybeSingle, and rpc for the database functions the
// migrations define. Results have supabase-js's shape ({ data, error, count,
// status, statusText }), errors are returned rather than thrown, and rows are
// copied in and out so callers can never change the store by accident.

export type Row = Record<string, any>;
export type Tables = Record<string, Row[]>;

export interface MemoryStore {
  tables: Tables;
  /** Called after every write that changed something. */
  onWrite?: (table: string) => void;
}

export interface MemoryError {
  message: string;
  details: string | null;
  hint: string | null;
  code: string;
}

export interface MemoryResult<T = any> {
  data: T | null;
  error: MemoryError | null;
  count: number | null;
  status: number;
  statusText: string;
}

type Filter = (row: Row) => boolean;

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export function memoryUuid(): string {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Column defaults from the migrations, applied on insert. */
const DEFAULTS: Record<string, () => Row> = {
  encounters: () => ({ status: 'finished', is_deleted: false }),
  conditions: () => ({ clinical_status: 'active', verification_status: 'confirmed', recorded_date: new Date().toISOString().slice(0, 10) }),
  lab_results: () => ({ value_type: 'string' }),
  alerts: () => ({
    severity: 'INFO', status: 'active', is_real_time: false, is_post_consultation: false,
    acknowledged: false,
  }),
};

/** Unique keys from the migrations, checked on insert. */
const UNIQUE: Record<string, string[][]> = {
  patients: [['patient_id']],
  encounters: [['patient_supabase_id', 'encounter_id']],
};

function error(code: string, message: string, details: string | null = null): MemoryError {
  return { code, message, details, hint: null };
}

function asComparable(v: unknown): unknown {
  if (typeof v === 'string' && v !== '' && !Number.isNaN(Number(v))) return Number(v);
  return v;
}

function compare(a: unknown, b: unknown): number {
  const x = asComparable(a);
  const y = asComparable(b);
  if (typeof x === 'number' && typeof y === 'number') return x - y;
  return String(a).localeCompare(String(b));
}

function equal(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return a === b || (a == null && b == null);
  if (typeof a === 'boolean' || typeof b === 'boolean') return String(a) === String(b);
  return compare(a, b) === 0;
}

function likeToRegExp(pattern: string, flags: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\?]/g, '\\$&').replace(/[%*]/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${escaped}$`, flags);
}

/** A PostgREST operator applied to one column. `value` is already decoded. */
function operator(column: string, op: string, value: unknown): Filter {
  switch (op) {
    case 'eq': return (r) => equal(r[column], value);
    case 'neq': return (r) => !equal(r[column], value);
    case 'gt': return (r) => r[column] != null && compare(r[column], value) > 0;
    case 'gte': return (r) => r[column] != null && compare(r[column], value) >= 0;
    case 'lt': return (r) => r[column] != null && compare(r[column], value) < 0;
    case 'lte': return (r) => r[column] != null && compare(r[column], value) <= 0;
    case 'like': return (r) => r[column] != null && likeToRegExp(String(value), '').test(String(r[column]));
    case 'ilike': return (r) => r[column] != null && likeToRegExp(String(value), 'i').test(String(r[column]));
    case 'is': {
      const want = value === 'null' ? null : value === 'true' ? true : value === 'false' ? false : value;
      return (r) => (want === null ? r[column] == null : r[column] === want);
    }
    case 'in': {
      const list = Array.isArray(value) ? value : String(value).replace(/^\(|\)$/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
      return (r) => list.some((v) => equal(r[column], v));
    }
    case 'cs': case 'contains': {
      return (r) => {
        const cell = r[column];
        if (Array.isArray(cell)) {
          const want = Array.isArray(value) ? value : String(value).replace(/^\{|\}$/g, '').split(',').map((s) => s.trim());
          return want.every((w) => cell.some((c) => equal(c, w)));
        }
        if (cell && typeof cell === 'object' && value && typeof value === 'object') {
          return Object.entries(value as Row).every(([k, v]) => JSON.stringify((cell as Row)[k]) === JSON.stringify(v));
        }
        return false;
      };
    }
    case 'fts': case 'plfts': case 'phfts': case 'wfts': {
      const words = String(value).toLowerCase().split(/[\s&|!:'()]+/).filter(Boolean);
      return (r) => {
        const text = String(r[column] ?? '').toLowerCase();
        return words.every((w) => text.includes(w));
      };
    }
    default:
      throw new Error(`Filter "${op}" is not supported by the demo data`);
  }
}

/** `col.op.value` terms of an or()/and() string, split on top-level commas. */
function splitTerms(expr: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of expr) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

function parseTerm(term: string): Filter {
  const group = /^(and|or)\((.*)\)$/.exec(term);
  if (group) {
    const parts = splitTerms(group[2]).map(parseTerm);
    return group[1] === 'and' ? (r) => parts.every((f) => f(r)) : (r) => parts.some((f) => f(r));
  }
  const first = term.indexOf('.');
  const second = term.indexOf('.', first + 1);
  if (first < 0 || second < 0) throw new Error(`Cannot read filter "${term}"`);
  const column = term.slice(0, first);
  let op = term.slice(first + 1, second);
  let value = term.slice(second + 1);
  if (op === 'not') {
    const third = value.indexOf('.');
    const inner = operator(column, value.slice(0, third), value.slice(third + 1));
    return (r) => !inner(r);
  }
  if (op === 'in') value = value.replace(/^\(|\)$/g, '');
  return operator(column, op, value);
}

function project(row: Row, columns: string): Row {
  const cols = columns.split(',').map((c) => c.trim()).filter(Boolean);
  if (cols.length === 0 || cols.includes('*') || cols.some((c) => c.includes('('))) return clone(row);
  const out: Row = {};
  for (const c of cols) {
    const [alias, source] = c.includes(':') ? c.split(':').map((s) => s.trim()) : [c, c];
    const name = source.replace(/::.*$/, '');
    out[alias.replace(/::.*$/, '')] = clone(row[name] ?? null);
  }
  return out;
}

type Op = 'select' | 'insert' | 'upsert' | 'update' | 'delete';

export class MemoryQuery implements PromiseLike<MemoryResult> {
  private op: Op = 'select';
  private columns = '*';
  private returning = false;
  private countMode: string | null = null;
  private head = false;
  private payload: Row | Row[] | null = null;
  private conflict: string | null = null;
  private filters: Filter[] = [];
  private orders: Array<{ column: string; ascending: boolean; nullsFirst: boolean }> = [];
  private limitTo: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private singleMode: 'single' | 'maybeSingle' | null = null;
  private throws = false;
  private broken: MemoryError | null = null;

  constructor(
    private readonly store: MemoryStore,
    private readonly table: string,
    private readonly source?: () => Row[],
  ) {}

  select(columns = '*', opts?: { count?: string; head?: boolean }) {
    if (this.op === 'select') {
      this.columns = columns;
      this.countMode = opts?.count ?? null;
      this.head = !!opts?.head;
    } else {
      this.returning = true;
      this.columns = columns;
    }
    return this;
  }
  insert(values: Row | Row[], opts?: { count?: string }) { this.op = 'insert'; this.payload = values; this.countMode = opts?.count ?? null; return this; }
  upsert(values: Row | Row[], opts?: { onConflict?: string }) { this.op = 'upsert'; this.payload = values; this.conflict = opts?.onConflict ?? null; return this; }
  update(values: Row, opts?: { count?: string }) { this.op = 'update'; this.payload = values; this.countMode = opts?.count ?? null; return this; }
  delete(opts?: { count?: string }) { this.op = 'delete'; this.countMode = opts?.count ?? null; return this; }

  private add(f: () => Filter) {
    try { this.filters.push(f()); } catch (e) { this.broken = error('PGRST100', e instanceof Error ? e.message : String(e)); }
    return this;
  }
  eq(c: string, v: unknown) { return this.add(() => operator(c, 'eq', v)); }
  neq(c: string, v: unknown) { return this.add(() => operator(c, 'neq', v)); }
  gt(c: string, v: unknown) { return this.add(() => operator(c, 'gt', v)); }
  gte(c: string, v: unknown) { return this.add(() => operator(c, 'gte', v)); }
  lt(c: string, v: unknown) { return this.add(() => operator(c, 'lt', v)); }
  lte(c: string, v: unknown) { return this.add(() => operator(c, 'lte', v)); }
  like(c: string, v: string) { return this.add(() => operator(c, 'like', v)); }
  ilike(c: string, v: string) { return this.add(() => operator(c, 'ilike', v)); }
  is(c: string, v: unknown) { return this.add(() => operator(c, 'is', v === null ? 'null' : String(v))); }
  in(c: string, v: unknown[]) { return this.add(() => operator(c, 'in', v)); }
  contains(c: string, v: unknown) { return this.add(() => operator(c, 'cs', v)); }
  textSearch(c: string, q: string) { return this.add(() => operator(c, 'fts', q)); }
  match(obj: Row) { for (const [k, v] of Object.entries(obj)) this.eq(k, v); return this; }
  not(c: string, op: string, v: unknown) {
    return this.add(() => {
      const inner = operator(c, op, v === null ? 'null' : v);
      return (r: Row) => !inner(r);
    });
  }
  filter(c: string, op: string, v: unknown) {
    if (op.startsWith('not.')) return this.not(c, op.slice(4), v);
    return this.add(() => operator(c, op, v));
  }
  or(expr: string) { return this.add(() => parseTerm(`or(${expr})`)); }
  order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    const ascending = opts?.ascending ?? true;
    this.orders.push({ column, ascending, nullsFirst: opts?.nullsFirst ?? !ascending });
    return this;
  }
  limit(n: number) { this.limitTo = n; return this; }
  range(from: number, to: number) { this.rangeFrom = from; this.rangeTo = to; return this; }
  single() { this.singleMode = 'single'; return this; }
  maybeSingle() { this.singleMode = 'maybeSingle'; return this; }
  abortSignal() { return this; }
  returns() { return this; }
  throwOnError() { this.throws = true; return this; }

  then<A = MemoryResult, B = never>(
    onFulfilled?: ((value: MemoryResult) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: any) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then((res) => {
        if (this.throws && res.error) throw Object.assign(new Error(res.error.message), res.error);
        return res;
      })
      .then(onFulfilled, onRejected);
  }

  private rows(): Row[] {
    if (this.source) return this.source();
    return (this.store.tables[this.table] ??= []);
  }

  private matching(): Row[] {
    return this.rows().filter((r) => this.filters.every((f) => f(r)));
  }

  private shape(rows: Row[], status: number, count: number | null): MemoryResult {
    let out = rows;
    for (const o of [...this.orders].reverse()) {
      out = [...out].sort((a, b) => {
        const x = a[o.column];
        const y = b[o.column];
        if (x == null && y == null) return 0;
        if (x == null) return o.nullsFirst ? -1 : 1;
        if (y == null) return o.nullsFirst ? 1 : -1;
        return o.ascending ? compare(x, y) : compare(y, x);
      });
    }
    if (this.rangeFrom !== null) out = out.slice(this.rangeFrom, (this.rangeTo ?? out.length - 1) + 1);
    if (this.limitTo !== null) out = out.slice(0, this.limitTo);
    const projected = out.map((r) => project(r, this.columns));
    if (this.singleMode) {
      if (projected.length === 1) return { data: projected[0], error: null, count, status, statusText: 'OK' };
      if (projected.length === 0 && this.singleMode === 'maybeSingle') return { data: null, error: null, count, status, statusText: 'OK' };
      return {
        data: null,
        error: error('PGRST116', 'JSON object requested, multiple (or no) rows returned', `The result contains ${projected.length} rows`),
        count, status: 406, statusText: 'Not Acceptable',
      };
    }
    return { data: this.head ? null : projected, error: null, count, status, statusText: 'OK' };
  }

  private run(): MemoryResult {
    if (this.broken) return { data: null, error: this.broken, count: null, status: 400, statusText: 'Bad Request' };
    const now = new Date().toISOString();
    switch (this.op) {
      case 'select': {
        const rows = this.matching();
        return this.shape(rows, 200, this.countMode ? rows.length : null);
      }
      case 'insert':
      case 'upsert': {
        if (this.source) return { data: null, error: error('42809', `${this.table} is read-only`), count: null, status: 400, statusText: 'Bad Request' };
        const incoming = (Array.isArray(this.payload) ? this.payload : [this.payload]).filter(Boolean) as Row[];
        const table = this.rows();
        const written: Row[] = [];
        for (const values of incoming) {
          const conflictCols = this.op === 'upsert'
            ? (this.conflict ? this.conflict.split(',').map((s) => s.trim()) : ['id'])
            : null;
          const existing = conflictCols && table.find((r) => conflictCols.every((c) => values[c] !== undefined && equal(r[c], values[c])));
          if (existing) {
            Object.assign(existing, clone(values), { updated_at: now });
            written.push(existing);
            continue;
          }
          const row: Row = { id: memoryUuid(), created_at: now, updated_at: now, ...(DEFAULTS[this.table]?.() ?? {}), ...clone(values) };
          for (const key of UNIQUE[this.table] ?? []) {
            if (table.some((r) => key.every((c) => row[c] != null && equal(r[c], row[c])))) {
              return {
                data: null,
                error: error('23505', `duplicate key value violates unique constraint on ${this.table} (${key.join(', ')})`),
                count: null, status: 409, statusText: 'Conflict',
              };
            }
          }
          table.push(row);
          written.push(row);
        }
        if (written.length) this.store.onWrite?.(this.table);
        return this.returning
          ? this.shape(written, 201, this.countMode ? written.length : null)
          : { data: null, error: null, count: this.countMode ? written.length : null, status: 201, statusText: 'Created' };
      }
      case 'update': {
        if (this.source) return { data: null, error: error('42809', `${this.table} is read-only`), count: null, status: 400, statusText: 'Bad Request' };
        const rows = this.matching();
        for (const r of rows) Object.assign(r, clone(this.payload as Row), { updated_at: (this.payload as Row)?.updated_at ?? now });
        if (rows.length) this.store.onWrite?.(this.table);
        return this.returning
          ? this.shape(rows, 200, this.countMode ? rows.length : null)
          : { data: null, error: null, count: this.countMode ? rows.length : null, status: 204, statusText: 'No Content' };
      }
      case 'delete': {
        if (this.source) return { data: null, error: error('42809', `${this.table} is read-only`), count: null, status: 400, statusText: 'Bad Request' };
        const table = this.rows();
        const gone = this.matching();
        this.store.tables[this.table] = table.filter((r) => !gone.includes(r));
        if (gone.length) this.store.onWrite?.(this.table);
        return this.returning
          ? this.shape(gone, 200, this.countMode ? gone.length : null)
          : { data: null, error: null, count: this.countMode ? gone.length : null, status: 204, statusText: 'No Content' };
      }
    }
  }
}

/** The database functions the migrations define, computed from the tables. */
function rpcRows(store: MemoryStore, fn: string): Row[] | null {
  const t = store.tables;
  switch (fn) {
    case 'match_guidelines':
    case 'search_guidelines_text':
      return []; // the guideline library is empty until it is ingested
    case 'get_patients_for_clinical_engine':
      return (t.encounters ?? [])
        .filter((e) => typeof e.transcript === 'string' && e.transcript.length > 100)
        .map((e) => {
          const p = (t.patients ?? []).find((x) => x.id === e.patient_supabase_id);
          const diff = (t.differential_diagnoses ?? []).filter((d) => d.encounter_id === e.id).length;
          const conds = (t.conditions ?? []).filter((c) => c.encounter_id === e.id);
          return {
            patient_id: p?.patient_id ?? null, first_name: p?.first_name ?? null, last_name: p?.last_name ?? null,
            encounter_uuid: e.id, encounter_id: e.encounter_id, transcript: e.transcript,
            transcript_length: e.transcript.length, diff_dx_count: diff, conditions_count: conds.length,
            _primary: conds.filter((c) => c.category === 'encounter-diagnosis').length,
          };
        })
        .filter((r) => r.diff_dx_count < 3 || r._primary === 0)
        .map(({ _primary, ...r }) => r);
    default:
      return null;
  }
}

export interface MemoryClient {
  from(table: string): MemoryQuery;
  rpc(fn: string, args?: Row): MemoryQuery;
  channel(name: string): any;
  removeChannel(channel: unknown): Promise<'ok'>;
  removeAllChannels(): Promise<'ok'[]>;
  getChannels(): unknown[];
  auth: any;
  storage: any;
  /** Marks this client as the bundled demo data, for logs and tests. */
  readonly isDemoData: true;
}

export function createMemoryClient(store: MemoryStore): MemoryClient {
  const channel = (name: string) => {
    const ch: any = {
      topic: name,
      on: () => ch,
      subscribe: (cb?: (status: string) => void) => { cb?.('CLOSED'); return ch; },
      unsubscribe: async () => 'ok',
      send: async () => 'ok',
    };
    return ch;
  };
  const offline = async () => ({ data: { session: null, user: null }, error: null });
  return {
    isDemoData: true,
    from: (table: string) => new MemoryQuery(store, table),
    rpc: (fn: string) => {
      const rows = rpcRows(store, fn);
      if (rows === null) {
        const q = new MemoryQuery(store, `rpc:${fn}`, () => []);
        // An unknown function is an error, as PostgREST reports it.
        (q as any).broken = error('PGRST202', `The function ${fn} is not available on the demo data`);
        return q;
      }
      return new MemoryQuery(store, `rpc:${fn}`, () => rows);
    },
    channel,
    removeChannel: async () => 'ok',
    removeAllChannels: async () => [],
    getChannels: () => [],
    auth: {
      getSession: offline,
      getUser: offline,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: error('PGRST000', 'File storage is not available on the demo data') }),
        download: async () => ({ data: null, error: error('PGRST000', 'File storage is not available on the demo data') }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  };
}
