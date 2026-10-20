import type { NextRequest } from 'next/server';
import { getRealSupabaseClient } from '@/lib/supabaseClient';

// Vercel calls this once a day (vercel.json `crons`), so the Supabase project
// sees a request and is not paused for a week without activity, as free
// projects are. One read of one patient id: nothing is written.
//
// With CRON_SECRET set in the project, Vercel sends it as a bearer token and
// any other caller gets 401. Without it the route still only does that read.

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = getRealSupabaseClient();
  if (!supabase) {
    return Response.json(
      { ok: false, error: 'Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL and a key are needed.' },
      { status: 503 },
    );
  }

  const started = Date.now();
  try {
    const { data, error } = await supabase.from('patients').select('id').limit(1);
    if (error) {
      return Response.json({ ok: false, error: `Supabase answered with an error: ${error.message}` }, { status: 503 });
    }
    return Response.json({ ok: true, rows: data?.length ?? 0, ms: Date.now() - started });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, error: `Could not reach Supabase: ${message}` }, { status: 503 });
  }
}
