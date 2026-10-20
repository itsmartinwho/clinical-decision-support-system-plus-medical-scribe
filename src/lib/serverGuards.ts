// Early answers for API routes that cannot work in this deployment, so the
// client hears why at once instead of waiting on a call that cannot succeed.
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

