// The tables behind demo mode: the bundled fixture (src/data/demo/fixture.json,
// made from supabase/seed.sql), copied so it can be written to. In the browser,
// writes are kept in sessionStorage, so they last as long as the tab and no
// longer; on the server they last as long as the process.

import type { DemoFixture } from '@/data/demo/types';
import type { MemoryStore, Tables } from './memoryClient';

const SESSION_KEY = 'foresight.demoData.v1';

let fixture: DemoFixture | null = null;
let store: MemoryStore | null = null;
let loading: Promise<MemoryStore> | null = null;
let edited = false;
const listeners = new Set<(table: string) => void>();

async function loadFixture(): Promise<DemoFixture> {
  if (fixture) return fixture;
  const mod: any = await import('@/data/demo/fixture.json');
  fixture = (mod.default ?? mod) as DemoFixture;
  return fixture;
}

function session(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null; // storage blocked
  }
}

function freshTables(f: DemoFixture): Tables {
  return JSON.parse(JSON.stringify(f.tables));
}

function restore(f: DemoFixture): Tables | null {
  try {
    const raw = session()?.getItem(SESSION_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    // Edits made against another version of the fixture are dropped.
    if (saved?.sha1 !== f.source.sha1 || typeof saved.tables !== 'object') return null;
    return saved.tables as Tables;
  } catch {
    return null;
  }
}

function persist(): void {
  if (!store || !fixture) return;
  try {
    session()?.setItem(SESSION_KEY, JSON.stringify({ sha1: fixture.source.sha1, tables: store.tables }));
  } catch {
    // Full or blocked storage: the edits still live in memory for this page.
  }
}

export async function getDemoStore(): Promise<MemoryStore> {
  if (store) return store;
  loading ??= loadFixture().then((f) => {
    const restored = restore(f);
    edited = !!restored;
    store = {
      tables: restored ?? freshTables(f),
      onWrite: (table) => {
        edited = true;
        persist();
        listeners.forEach((cb) => { try { cb(table); } catch { /* a listener's problem */ } });
      },
    };
    return store;
  });
  return loading;
}

/** True once anything has been written in this tab (or restored from earlier in it). */
export function hasDemoEdits(): boolean {
  return edited;
}

export function onDemoWrite(cb: (table: string) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Back to the bundled data: drops this tab's edits. */
export async function resetDemoStore(): Promise<void> {
  const f = await loadFixture();
  try { session()?.removeItem(SESSION_KEY); } catch { /* blocked storage */ }
  edited = false;
  if (store) store.tables = freshTables(f);
}

/** For tests: forget everything, including the cached fixture copy. */
export function __resetDemoStoreForTests(): void {
  store = null;
  loading = null;
  edited = false;
  listeners.clear();
  try { session()?.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
