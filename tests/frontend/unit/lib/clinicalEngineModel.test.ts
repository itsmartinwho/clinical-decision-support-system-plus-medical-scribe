// tests/frontend/unit/lib/clinicalEngineModel.test.ts
// The clinical engine's Chat Completions requests to gpt-6-astra, with the SDK
// mocked: no real calls. Astra always reasons, so a request must not send
// temperature or max_tokens, and its budget must leave room for the reasoning.
import { describe, it, expect, vi, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mocks.create } };
  }
}));
vi.mock('@/lib/unifiedAlertsService', () => ({ UnifiedAlertsService: class {} }));
vi.mock('@/lib/supabaseDataService', () => ({ supabaseDataService: {} }));
vi.mock('@/lib/supabaseClient', () => ({ getSupabaseClient: vi.fn() }));

import { ClinicalEngineServiceV3 } from '@/lib/clinicalEngineServiceV3';

const answer = (content: string) => ({ choices: [{ message: { content } }] });

describe('ClinicalEngineServiceV3 model requests', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it.each([
    ['the subjective section', (engine: any) => engine.generateSubjectiveSection('Patient reports two weeks of joint pain.', {})],
    ['the objective section', (engine: any) => engine.generateObjectiveSection('Swelling of both wrists on examination.', {})],
    ['a single field', (engine: any) => engine.extractSingleField({}, 'transcript', { diagnosisName: 'Rheumatoid arthritis' }, 'Give the ICD-10 code')],
    ['the guideline recommendations', (engine: any) => engine.getGuidelinesRecommendations('Rheumatoid arthritis', {})]
  ])('asks gpt-6-astra for %s with a reasoning effort and room to reason', async (_, call) => {
    mocks.create.mockResolvedValue(answer('M05.79'));

    await call(new ClinicalEngineServiceV3());

    expect(mocks.create).toHaveBeenCalledTimes(1);
    const params = mocks.create.mock.calls[0][0];
    expect(params.model).toBe('gpt-6-astra');
    expect(params.reasoning_effort).toBe('low');
    expect(params.max_completion_tokens).toBeGreaterThanOrEqual(8000);
    expect(params).not.toHaveProperty('temperature');
    expect(params).not.toHaveProperty('max_tokens');
  });
});
