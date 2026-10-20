// @vitest-environment node
// tests/frontend/unit/lib/deepgramToken.test.ts
// The Deepgram token route and the browser side that uses it, with fetch and
// WebSocket mocked: no real calls.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { POST } from '@/app/api/deepgram/token/route';
import { openDeepgramSocket, TranscriptionUnavailableError } from '@/lib/deepgram';

const KEY = 'dg-test-key-not-real';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('POST /api/deepgram/token', () => {
  it('says transcription is not configured without a key, and calls nothing', async () => {
    vi.stubEnv('DEEPGRAM_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST();

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trades the key for a 30-second token, and never returns the key', async () => {
    vi.stubEnv('DEEPGRAM_API_KEY', KEY);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'jwt.token.here', expires_in: 30 }), { status: 200 })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST();
    const text = await response.text();

    expect(fetchMock).toHaveBeenCalledWith('https://api.deepgram.com/v1/auth/grant', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: `Token ${KEY}` }),
      body: JSON.stringify({ ttl_seconds: 30 })
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(JSON.parse(text)).toEqual({ accessToken: 'jwt.token.here', expiresIn: 30 });
    expect(text).not.toContain(KEY);
  });

  it('fails without detail when Deepgram refuses', async () => {
    vi.stubEnv('DEEPGRAM_API_KEY', KEY);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ err_code: 'FORBIDDEN', err_msg: 'Insufficient permissions.' }), { status: 403 })
    ));

    const response = await POST();
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(text).not.toContain(KEY);
    expect(text).not.toContain('FORBIDDEN');
  });
});

describe('openDeepgramSocket', () => {
  it('opens the socket with a fresh token as the bearer subprotocol', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'jwt.token.here', expiresIn: 30 }), { status: 200 })
    ));
    const sockets: Array<{ url: string; protocols: string[] }> = [];
    vi.stubGlobal('WebSocket', class {
      constructor(url: string, protocols: string[]) {
        sockets.push({ url, protocols });
      }
    });

    await openDeepgramSocket('wss://api.deepgram.com/v1/listen?model=nova-3-medical');

    expect(fetch).toHaveBeenCalledWith('/api/deepgram/token', expect.objectContaining({ method: 'POST' }));
    expect(sockets).toEqual([
      { url: 'wss://api.deepgram.com/v1/listen?model=nova-3-medical', protocols: ['bearer', 'jwt.token.here'] }
    ]);
  });

  it('passes on why transcription is unavailable, and opens no socket', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Live transcription is not configured.' }), { status: 503 })
    ));
    const WebSocketMock = vi.fn();
    vi.stubGlobal('WebSocket', WebSocketMock);

    const opening = openDeepgramSocket('wss://api.deepgram.com/v1/listen');

    await expect(opening).rejects.toBeInstanceOf(TranscriptionUnavailableError);
    await expect(opening).rejects.toThrow('Live transcription is not configured.');
    expect(WebSocketMock).not.toHaveBeenCalled();
  });
});
