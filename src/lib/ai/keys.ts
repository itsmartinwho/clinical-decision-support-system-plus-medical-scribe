// Whether this server can call the AI providers. No Next imports here, so
// services shared with the browser can ask too (the browser never has them).
export function hasOpenAIKey(): boolean {
  return typeof process !== 'undefined' && !!process.env.OPENAI_API_KEY?.trim();
}

export function hasDeepgramKey(): boolean {
  return typeof process !== 'undefined' && !!process.env.DEEPGRAM_API_KEY?.trim();
}
