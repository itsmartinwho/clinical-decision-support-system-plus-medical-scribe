// Early answers for API routes that cannot work in this deployment, so the
// client hears why at once instead of waiting on a call that cannot succeed.
import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { resolveDataMode } from './dataMode';

export const OPENAI_KEY_MISSING =
  'The AI features are off in this deployment: OPENAI_API_KEY is not set.';

export { hasOpenAIKey } from './ai/keys';
import { hasOpenAIKey } from './ai/keys';

/** 503 with a plain reason when OPENAI_API_KEY is not set, otherwise null. */
export function openAIKeyMissingResponse(): NextResponse | null {
  if (hasOpenAIKey()) return null;
  return NextResponse.json(
    { error: OPENAI_KEY_MISSING, details: OPENAI_KEY_MISSING, code: 'OPENAI_API_KEY_MISSING' },
    { status: 503 },
  );
}

/** 503 when the app is on the bundled demo data and `feature` needs a real database. */
export async function databaseRequiredResponse(feature: string): Promise<NextResponse | null> {
  const mode = await resolveDataMode();
  if (mode.source === 'supabase') return null;
  const why = mode.detail ? ` ${mode.detail}` : '';
  return NextResponse.json(
    {
      success: false,
      error: `${feature} needs a Supabase project; this deployment is running on demo data.${why}`,
      code: 'DEMO_DATA',
    },
    { status: 503 },
  );
}

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * For the admin routes that spend money (guideline ingestion and embeddings):
 * refused unless GUIDELINES_ADMIN_SECRET is set on the server and the request
 * carries it as a bearer token. Null when the request may go ahead.
 */
export function adminSecretRequiredResponse(request: Request, what: string): NextResponse | null {
  const secret = process.env.GUIDELINES_ADMIN_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: `${what} is turned off in this deployment: GUIDELINES_ADMIN_SECRET is not set.`, code: 'ADMIN_DISABLED' },
      { status: 403 },
    );
  }
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ') || !sameSecret(auth.slice(7), secret)) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  return null;
}
