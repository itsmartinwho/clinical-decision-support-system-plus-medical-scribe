// Opens the live transcription socket to Deepgram from the browser.
// The API key never reaches the browser: each socket gets a fresh short-lived
// token from /api/deepgram/token, which a browser WebSocket passes as the
// "bearer" subprotocol (an API key would go as "token").

export class TranscriptionUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptionUnavailableError';
  }
}

export async function fetchDeepgramToken(): Promise<string> {
  let response: Response;
  try {
    response = await fetch('/api/deepgram/token', { method: 'POST', cache: 'no-store' });
  } catch {
    throw new TranscriptionUnavailableError('Could not reach the transcription service.');
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.accessToken !== 'string') {
    throw new TranscriptionUnavailableError(body.error || 'Could not start live transcription.');
  }
  return body.accessToken;
}

// Fetch the token right before opening: it only has to be valid as the socket opens.
export async function openDeepgramSocket(url: string): Promise<WebSocket> {
  const token = await fetchDeepgramToken();
  return new WebSocket(url, ['bearer', token]);
}
