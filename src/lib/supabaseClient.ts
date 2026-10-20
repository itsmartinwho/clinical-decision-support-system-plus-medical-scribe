import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout, getDataMode, readSupabaseConfig, resolveDataMode } from './dataMode';
import { getDemoStore } from './demo/demoStore';
import { createMemoryClient, MemoryClient } from './demo/memoryClient';

// Every part of the app asks for its client here. What it gets routes each
// query to the Supabase project in the environment or, when there is none or
// it does not answer (see dataMode.ts), to the bundled demo data. A query made
// before that is settled waits for it, and then runs against whichever won;
// callers do not change. Nothing here throws for missing keys, so building and
// rendering never need them.

let realClient: SupabaseClient | null = null;
let memoryClient: Promise<MemoryClient> | null = null;

/** The client for the Supabase project in the environment, or null when there is none. */
export function getRealSupabaseClient(): SupabaseClient | null {
  if (realClient) return realClient;
  const config = readSupabaseConfig();
  if (!config) return null;
  realClient = createClient(config.url, config.key, {
    global: { fetch: fetchWithTimeout() },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return realClient;
}

function getMemoryClient(): Promise<MemoryClient> {
  memoryClient ??= getDemoStore().then(createMemoryClient);
  return memoryClient;
}

async function activeClient(): Promise<SupabaseClient | MemoryClient> {
  const mode = await resolveDataMode();
  if (mode.source === 'supabase') {
    const client = getRealSupabaseClient();
    if (client) return client;
  }
  return getMemoryClient();
}

/**
 * A query builder that records the calls made on it (filters, order, single,
 * ...) and replays them on the active client when it is awaited.
 */
function deferredQuery(start: (client: any) => any): any {
  void resolveDataMode(); // start the check now; the query runs when awaited
  const calls: Array<[string, unknown[]]> = [];
  let run: Promise<any> | null = null;
  const execute = () => {
    run ??= activeClient().then((client) => calls.reduce((q, [name, args]) => q[name](...args), start(client)));
    return run;
  };
  const proxy: any = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') return (ok: any, fail: any) => execute().then(ok, fail);
      if (prop === 'catch') return (fail: any) => execute().catch(fail);
      if (prop === 'finally') return (done: any) => execute().finally(done);
      if (typeof prop === 'symbol') return undefined;
      return (...args: unknown[]) => { calls.push([prop, args]); return proxy; };
    },
  });
  return proxy;
}

const routingClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (prop === 'from') return (table: string) => deferredQuery((c) => c.from(table));
    if (prop === 'rpc') return (fn: string, args?: unknown, opts?: unknown) => deferredQuery((c) => c.rpc(fn, args, opts));
    // Realtime, auth and storage are not used for data; give them the real
    // client when there is one and a harmless stub otherwise.
    const mode = getDataMode();
    const real = mode?.source === 'demo' ? null : getRealSupabaseClient();
    if (real) {
      const value = (real as any)[prop];
      return typeof value === 'function' ? value.bind(real) : value;
    }
    const stub = createMemoryClient({ tables: {} }) as any;
    const value = stub[prop];
    return typeof value === 'function' ? value.bind(stub) : value;
  },
});

/** The app's client, in the browser and on the server. */
export function getSupabaseClient(): SupabaseClient {
  return routingClient;
}

/**
 * The server's client. It uses SUPABASE_SERVICE_ROLE_KEY when that is set (see
 * readSupabaseConfig), and the anon key otherwise; on demo data both are the same.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  return routingClient;
}

/** For tests: drop the clients so the next query builds them again. */
export function __resetSupabaseClientsForTests(): void {
  realClient = null;
  memoryClient = null;
}
