import { describe, expect, it } from 'vitest';
import { createMemoryClient } from '@/lib/demo/memoryClient';

function client() {
  const writes: string[] = [];
  const store = {
    tables: {
      alerts: [
        { id: 'a', patient_id: 'p', severity: 'CRITICAL', status: 'active', expires_at: null, created_at: '2025-01-01T00:00:00Z' },
        { id: 'b', patient_id: 'p', severity: 'INFO', status: 'dismissed', expires_at: '2020-01-01T00:00:00Z', created_at: '2025-02-01T00:00:00Z' },
        { id: 'c', patient_id: 'q', severity: 'WARNING', status: 'active', expires_at: '2999-01-01T00:00:00Z', created_at: '2025-03-01T00:00:00Z' },
      ],
    },
    onWrite: (t: string) => writes.push(t),
  };
  return { db: createMemoryClient(store), store, writes };
}

describe('memory client', () => {
  it('filters, orders and projects like PostgREST', async () => {
    const { db } = client();
    const { data, count } = await db.from('alerts').select('id', { count: 'exact' })
      .in('status', ['active'])
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false });
    expect(data).toEqual([{ id: 'c' }, { id: 'a' }]);
    expect(count).toBe(2);
  });

  it('single() errors unless exactly one row matches; maybeSingle() allows none', async () => {
    const { db } = client();
    expect((await db.from('alerts').select('*').eq('patient_id', 'p').single()).error?.code).toBe('PGRST116');
    expect((await db.from('alerts').select('*').eq('id', 'zzz').maybeSingle())).toMatchObject({ data: null, error: null });
    expect((await db.from('alerts').select('id').eq('id', 'a').single()).data).toEqual({ id: 'a' });
  });

  it('inserts with defaults, updates, deletes, and reports each write', async () => {
    const { db, store, writes } = client();
    const inserted = await db.from('encounters').insert({ encounter_id: 'E1', patient_supabase_id: 'p' }).select().single();
    expect(inserted.data).toMatchObject({ encounter_id: 'E1', status: 'finished', is_deleted: false });
    expect(inserted.data.id).toMatch(/^[0-9a-f-]{36}$/);

    const dup = await db.from('encounters').insert({ encounter_id: 'E1', patient_supabase_id: 'p' });
    expect(dup.error?.code).toBe('23505');

    await db.from('encounters').update({ soap_note: 'S: ...' }).eq('id', inserted.data.id);
    expect(store.tables.encounters[0].soap_note).toBe('S: ...');

    await db.from('alerts').delete().eq('id', 'b');
    expect(store.tables.alerts.map((a: any) => a.id)).toEqual(['a', 'c']);
    expect(writes).toEqual(['encounters', 'encounters', 'alerts']);
  });

  it('never hands out the stored rows themselves', async () => {
    const { db, store } = client();
    const { data } = await db.from('alerts').select('*').eq('id', 'a').single();
    data.status = 'changed';
    expect(store.tables.alerts[0].status).toBe('active');
  });

  it('answers the migrations\' functions, and names the ones it cannot', async () => {
    const { db } = client();
    expect((await db.rpc('match_guidelines', {})).data).toEqual([]);
    expect((await db.rpc('no_such_function')).error?.code).toBe('PGRST202');
  });
});
