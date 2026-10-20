// A short-lived Deepgram token for live transcription.
// The browser opens its WebSocket to Deepgram itself, so it needs a credential,
// but the API key stays here: this trades it for a token (a JWT) that Deepgram
// checks only when the socket opens. An open socket outlives its token.
// https://developers.deepgram.com/guides/fundamentals/token-based-authentication

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Fetched just before each socket opens, so it never needs to live long.
const TOKEN_TTL_SECONDS = 30;

export async function POST() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Live transcription is not configured.' }, { status: 503 });
  }

  try {
    const response = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl_seconds: TOKEN_TTL_SECONDS }),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`Deepgram token grant failed with status ${response.status}`);
      return NextResponse.json({ error: 'Could not start live transcription.' }, { status: 502 });
    }

    const { access_token, expires_in } = await response.json();
    return NextResponse.json(
      { accessToken: access_token, expiresIn: expires_in },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Deepgram token grant failed:', error);
    return NextResponse.json({ error: 'Could not start live transcription.' }, { status: 502 });
  }
}
