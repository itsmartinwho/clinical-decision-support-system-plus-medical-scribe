import { NextResponse } from 'next/server';

/**
 * Gate for routes that run with the service role (guideline ingestion and the
 * refresh schedule). The service role bypasses row level security, so these
 * routes cannot rely on the database to say no: they refuse unless the request
 * carries `Authorization: Bearer <ADMIN_SECRET>`, the secret being a
 * server-side environment variable, never shipped to the browser.
 *
 * With ADMIN_SECRET unset the answer is always 401, so a deployment that
 * forgot it fails closed rather than open.
 *
 * Usage, first thing in a handler:
 *
 *   const refused = requireAdminSecret(request);
 *   if (refused) return refused;
 */
export function requireAdminSecret(request: Request): NextResponse | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return unauthorized();

  const sent = request.headers.get('authorization') ?? '';
  if (!sameString(sent, `Bearer ${secret}`)) return unauthorized();

  return null;
}

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } }
  );
}

// Compares without stopping at the first difference, so the time taken does
// not say how much of a guess was right.
function sameString(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const longest = Math.max(a.length, b.length);
  for (let i = 0; i < longest; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
