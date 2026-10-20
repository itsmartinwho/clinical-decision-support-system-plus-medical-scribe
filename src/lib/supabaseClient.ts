import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout, getDataMode, readSupabaseConfig, resolveDataMode, SupabaseRole } from './dataMode';
import { getDemoStore } from './demo/demoStore';
import { createMemoryClient, MemoryClient } from './demo/memoryClient';

// Every part of the app asks for its client here. What it gets routes each
// query to the Supabase project in the environment or, when there is none or
// it does not answer (see dataMode.ts), to the bundled demo data. A query made
// before that is settled waits for it, and then runs against whichever won;
// callers do not change. Nothing here throws for missing keys, so building and
// rendering never need them.

const realClients: Partial<Record<SupabaseRole, SupabaseClient>> = {};
let memoryClient: Promise<MemoryClient> | null = null;

/**
 * The client for the Supabase project in the environment, or null when there
 * is none. `anon` (the default) holds the public key, so row level security
 * applies; `service` holds the service role key on the server when it is set.
 */
export function getRealSupabaseClient(role: SupabaseRole = 'anon'): SupabaseClient | null {
  const made = realClients[role];
  if (made) return made;
  const config = readSupabaseConfig(role);
  if (!config) return null;
  const client = createClient(config.url, config.key, {
    global: { fetch: fetchWithTimeout() },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  realClients[role] = client;
  return client;
}

function getMemoryClient(): Promise<MemoryClient> {
  memoryClient ??= getDemoStore().then(createMemoryClient);
  return memoryClient;
}

async function activeClient(role: SupabaseRole): Promise<SupabaseClient | MemoryClient> {
  const mode = await resolveDataMode();
  if (mode.source === 'supabase') {
    const client = getRealSupabaseClient(role);
    if (client) return client;
  }
  return getMemoryClient();
}

/**
 * A query builder that records the calls made on it (filters, order, single,
 * ...) and replays them on the active client when it is awaited.
 */
function deferredQuery(role: SupabaseRole, start: (client: any) => any): any {
  void resolveDataMode(); // start the check now; the query runs when awaited
  const calls: Array<[string, unknown[]]> = [];
  let run: Promise<any> | null = null;
  const execute = () => {
    run ??= activeClient(role).then((client) => calls.reduce((q, [name, args]) => q[name](...args), start(client)));
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

function routingClient(role: SupabaseRole): SupabaseClient {
  return new Proxy({} as SupabaseClient, {
    get(_target, prop) {
      if (prop === 'from') return (table: string) => deferredQuery(role, (c) => c.from(table));
      if (prop === 'rpc') return (fn: string, args?: unknown, opts?: unknown) => deferredQuery(role, (c) => c.rpc(fn, args, opts));
      // Realtime, auth and storage are not used for data; give them the real
      // client when there is one and a harmless stub otherwise.
      const mode = getDataMode();
      const real = mode?.source === 'demo' ? null : getRealSupabaseClient(role);
      if (real) {
        const value = (real as any)[prop];
        return typeof value === 'function' ? value.bind(real) : value;
      }
      const stub = createMemoryClient({ tables: {} }) as any;
      const value = stub[prop];
      return typeof value === 'function' ? value.bind(stub) : value;
    },
  });
}

const anonClient = routingClient('anon');
const serviceClient = routingClient('service');

/**
 * The app's client, in the browser and on the server. It always holds the
 * public anon key, so row level security decides what it may do.
 */
export function getSupabaseClient(): SupabaseClient {
  return anonClient;
}

/**
 * The server's client with SUPABASE_SERVICE_ROLE_KEY, which bypasses row level
 * security, for the routes that need it; with no service key set, the anon
 * key. On demo data both are the same in-memory records.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  return serviceClient;
}

/** For tests: drop the clients so the next query builds them again. */
export function __resetSupabaseClientsForTests(): void {
  delete realClients.anon;
  delete realClients.service;
  memoryClient = null;
}
