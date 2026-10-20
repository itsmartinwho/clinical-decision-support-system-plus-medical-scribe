// Where the app's data comes from: the Supabase project in the environment, or
// the synthetic records bundled with the app (src/data/demo) when there is no
// project, or it does not answer. Decided once per page load in the browser,
// and once per process on the server, by asking Supabase for one patient id.
//
// A free Supabase project pauses after a week without use, and a paused or
// deleted project stops resolving in DNS. Before this, every page waited on it
// forever; now the app says it is on demo data and carries on.

export type DataSource = 'supabase' | 'demo';
export type DemoReason = 'unconfigured' | 'unreachable' | 'timeout' | 'rejected';

export interface DataModeState {
  source: DataSource;
  reason?: DemoReason;
  /** A sentence for people, e.g. "No answer from Supabase in 4 s." */
  detail?: string;
}

export interface SupabaseConfig {
  url: string;
  key: string;
}

/** How long the first question to Supabase may take before the app goes to demo data. */
export const PROBE_TIMEOUT_MS = 4000;
/** How long any later request to Supabase may take before it fails. */
export const REQUEST_TIMEOUT_MS = 12000;

const isServer = () => typeof window === 'undefined';

/** The project URL and the key this runtime should use, or null when either is missing. */
export function readSupabaseConfig(): SupabaseConfig | null {
  // Spelled out in full so Next inlines the public values into the browser bundle.
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
  const service = isServer() ? (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim() : '';
  const key = service || anon;
  if (!url || !key || !/^https?:\/\//.test(url)) return null;
  return { url: url.replace(/\/+$/, ''), key };
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  return String(error);
}

/**
 * Asks the project for one patient id. Any answer but a 2xx sends the app to
 * demo data: no DNS, no connection, no answer in time, or a refusal (a wrong
 * key, a missing table) all leave it unable to show patients.
 */
export async function probeSupabase(
  config: SupabaseConfig,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<DataModeState> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? PROBE_TIMEOUT_MS;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => { timedOut = true; resolve('timeout'); controller?.abort(); }, timeoutMs);
  });
  const noAnswer = (): DataModeState => ({
    source: 'demo', reason: 'timeout', detail: `No answer from Supabase in ${Math.round(timeoutMs / 1000)} s.`,
  });
  try {
    const answer = await Promise.race([
      fetchImpl(`${config.url}/rest/v1/patients?select=id&limit=1`, {
        headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
        signal: controller?.signal,
        cache: 'no-store',
      }),
      timeout,
    ]);
    if (answer === 'timeout') return noAnswer();
    if (answer.ok) return { source: 'supabase' };
    return { source: 'demo', reason: 'rejected', detail: `Supabase refused the request (HTTP ${answer.status}).` };
  } catch (error) {
    if (timedOut) return noAnswer();
    return { source: 'demo', reason: 'unreachable', detail: `Could not reach Supabase: ${describe(error)}.` };
  } finally {
    clearTimeout(timer);
  }
}

let state: DataModeState | null = null;
let pending: Promise<DataModeState> | null = null;
const listeners = new Set<(s: DataModeState) => void>();

/** Settles where the data comes from, once; later calls get the same answer. */
export function resolveDataMode(): Promise<DataModeState> {
  if (state) return Promise.resolve(state);
  pending ??= (async () => {
    const config = readSupabaseConfig();
    const result: DataModeState = config
      ? await probeSupabase(config)
      : { source: 'demo', reason: 'unconfigured', detail: 'No Supabase project is configured.' };
    state = result;
    if (result.source === 'demo') {
      console.info(`[data] Using the bundled demo data. ${result.detail ?? ''}`.trim());
    }
    listeners.forEach((cb) => { try { cb(result); } catch { /* a listener's problem */ } });
    return result;
  })();
  return pending;
}

/** The settled mode, or null while the first check is still running. */
export function getDataMode(): DataModeState | null {
  return state;
}

export function isDemoData(): boolean {
  return state?.source === 'demo';
}

export function onDataModeChange(cb: (s: DataModeState) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** For tests: forget the settled mode so the next call checks again. */
export function __resetDataModeForTests(): void {
  state = null;
  pending = null;
  listeners.clear();
}

/** A fetch that gives up after REQUEST_TIMEOUT_MS, and never uses Next's data cache. */
export function fetchWithTimeout(timeoutMs = REQUEST_TIMEOUT_MS): typeof fetch {
  return (input: RequestInfo | URL, init: RequestInit = {}) => {
    const controller = new AbortController();
    const outer = init.signal;
    if (outer) {
      if (outer.aborted) controller.abort(outer.reason);
      else outer.addEventListener('abort', () => controller.abort(outer.reason), { once: true });
    }
    const timer = setTimeout(
      () => controller.abort(new Error(`Supabase did not answer in ${Math.round(timeoutMs / 1000)} s`)),
      timeoutMs,
    );
    return fetch(input, { cache: 'no-store', ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}
