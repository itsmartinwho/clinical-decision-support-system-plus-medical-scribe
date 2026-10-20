// tests/frontend/unit/lib/openaiAlertsClient.test.ts
// OpenAIClient.processAlerts against a mocked Responses API: no real calls.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIClient } from '@/lib/ai/gpt-models';
import { getRealTimeTemplate } from '@/lib/ai/prompt-templates';
import { AIModelType, AIProcessingRequest } from '@/types/ai-models';

const context: AIProcessingRequest['context'] = {
  patientId: 'patient-1',
  encounterId: 'encounter-1',
  patientData: {
    demographics: { gender: 'female', dateOfBirth: '1958-03-02' },
    conditions: [{ code: 'M05.79', description: 'Rheumatoid arthritis' }],
    medications: [{ drug: 'Methotrexate 15mg weekly', status: 'active' }],
    labResults: [],
    allergies: [],
    vitals: []
  },
  transcript: {
    full: 'Speaker 0: How is the pain? Speaker 1: I take paracetamol most days now.',
    segment: 'Speaker 1: I take paracetamol most days now.'
  },
  existingAlerts: [
    { id: 'alert-1', type: 'MISSING_LAB_RESULT', message: 'Liver function tests are due.', createdAt: '2025-06-01T00:00:00Z' }
  ]
};

const request = (overrides: Partial<AIProcessingRequest> = {}): AIProcessingRequest => ({
  model: AIModelType.GPT_4O_MINI,
  context,
  promptTemplate: getRealTimeTemplate(),
  isRealTime: true,
  maxAlerts: 3,
  confidenceThreshold: 0.8,
  ...overrides
});

const alert = (overrides: Record<string, unknown> = {}) => ({
  type: 'DRUG_INTERACTION',
  severity: 'WARNING',
  title: 'Methotrexate and paracetamol',
  message: 'Regular paracetamol with methotrexate raises the risk to the liver.',
  suggestion: 'Check AST and ALT.',
  confidence: 0.9,
  reasoning: 'Both are hepatotoxic.',
  ...overrides
});

const completed = (alerts: unknown[]) => ({
  status: 'completed',
  model: 'gpt-4o-mini-2024-07-18',
  output_text: JSON.stringify({ alerts }),
  usage: { input_tokens: 900, output_tokens: 120, total_tokens: 1020 }
});

const mockClient = (response: unknown) => {
  const create = vi.fn().mockResolvedValue(response);
  return { create, client: { responses: { create } } as any };
};

describe('OpenAIClient.processAlerts', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('sends one Responses API request, held to a strict schema of the template alert types', async () => {
    const { create, client } = mockClient(completed([alert()]));
    await new OpenAIClient({ model: AIModelType.GPT_4O_MINI, maxTokens: 1500, temperature: 0.1 }, client)
      .processAlerts(request());

    expect(create).toHaveBeenCalledTimes(1);
    const params = create.mock.calls[0][0];
    expect(params.model).toBe('gpt-4o-mini');
    expect(params.max_output_tokens).toBe(1500);
    expect(params.store).toBe(false);
    expect(params.temperature).toBe(0.1);
    expect(params.reasoning).toBeUndefined();

    const format = params.text.format;
    expect(format.type).toBe('json_schema');
    expect(format.strict).toBe(true);
    const item = format.schema.properties.alerts.items;
    expect(item.properties.type.enum).toEqual(getRealTimeTemplate().alertTypes);
    expect(item.properties.severity.enum).toEqual(['INFO', 'WARNING', 'CRITICAL']);
    expect(item.required).toEqual(
      expect.arrayContaining(['type', 'severity', 'title', 'message', 'suggestion', 'confidence', 'reasoning'])
    );
  });

  it('puts the patient, the transcript, the new segment and the existing alerts in the prompt', async () => {
    const { create, client } = mockClient(completed([]));
    await new OpenAIClient({ model: AIModelType.GPT_4O_MINI }, client).processAlerts(request());

    const { instructions, input } = create.mock.calls[0][0];
    expect(instructions).toContain('HIGH CONFIDENCE (≥0.8)');
    expect(instructions).toContain('DRUG_INTERACTION, COMORBIDITY');
    expect(instructions).toContain('Return at most 3 alerts');
    expect(instructions).not.toMatch(/\{[A-Z_]+\}/);
    expect(input).toContain('Methotrexate 15mg weekly');
    expect(input).toContain('1958-03-02');
    expect(input).toContain('How is the pain?');
    expect(input).toContain('NEW TRANSCRIPT SEGMENT');
    expect(input).toContain('- MISSING_LAB_RESULT: Liver function tests are due.');
    expect(input).not.toMatch(/\{[A-Z_]+\}/);
  });

  it('sets a reasoning effort, and no temperature, for the reasoning model', async () => {
    const { create, client } = mockClient(completed([]));
    await new OpenAIClient({ model: AIModelType.REASONING, maxTokens: 16000, reasoningEffort: 'low', temperature: 0.05 }, client)
      .processAlerts(request({ model: AIModelType.REASONING, isRealTime: false, maxAlerts: 10, confidenceThreshold: 0.7 }));

    const params = create.mock.calls[0][0];
    expect(params.model).toBe('gpt-5.6-sol');
    expect(params.reasoning).toEqual({ effort: 'low' });
    expect(params.temperature).toBeUndefined();
    expect(params.instructions).toContain('reviews the whole consultation');
    expect(params.input).not.toContain('NEW TRANSCRIPT SEGMENT');
  });

  it('returns the alerts that reach the threshold, at most maxAlerts of them', async () => {
    const { client } = mockClient(completed([
      alert(),
      alert({ type: 'ASSESSMENT_QUESTION', severity: 'INFO', title: 'Ask about alcohol', suggestion: null, confidence: 0.85 }),
      alert({ title: 'Below the threshold', confidence: 0.5 }),
      alert({ title: 'Not a probability', confidence: 85 }),
      alert({ type: 'MISSING_LAB_RESULT', title: 'One too many', confidence: 0.95 })
    ]));

    const response = await new OpenAIClient({ model: AIModelType.GPT_4O_MINI }, client)
      .processAlerts(request({ maxAlerts: 2 }));

    expect(response.success).toBe(true);
    expect(response.model).toBe('gpt-4o-mini-2024-07-18');
    expect(response.tokensUsed).toEqual({ prompt: 900, completion: 120, total: 1020 });
    expect(response.alerts).toEqual([
      {
        type: 'DRUG_INTERACTION',
        severity: 'WARNING',
        title: 'Methotrexate and paracetamol',
        message: 'Regular paracetamol with methotrexate raises the risk to the liver.',
        suggestion: 'Check AST and ALT.',
        confidence: 0.9,
        reasoning: 'Both are hepatotoxic.'
      },
      {
        type: 'ASSESSMENT_QUESTION',
        severity: 'INFO',
        title: 'Ask about alcohol',
        message: 'Regular paracetamol with methotrexate raises the risk to the liver.',
        suggestion: undefined,
        confidence: 0.85,
        reasoning: 'Both are hepatotoxic.'
      }
    ]);
  });

  it('fails without alerts when the response is cut short', async () => {
    const { client } = mockClient({
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      model: 'gpt-5.6-sol',
      output_text: '{"alerts": [',
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }
    });

    const response = await new OpenAIClient({ model: AIModelType.REASONING }, client)
      .processAlerts(request({ model: AIModelType.REASONING, isRealTime: false }));

    expect(response.success).toBe(false);
    expect(response.alerts).toEqual([]);
    expect(response.error).toContain('max_output_tokens');
  });

  it('fails without alerts when the output does not match the schema', async () => {
    const { client } = mockClient(completed([alert({ type: 'NOT_A_TYPE' })]));
    const response = await new OpenAIClient({ model: AIModelType.GPT_4O_MINI }, client).processAlerts(request());
    expect(response.success).toBe(false);
    expect(response.alerts).toEqual([]);
  });

  it('fails without alerts when the API call throws', async () => {
    const create = vi.fn().mockRejectedValue(new Error('429 Rate limit reached'));
    const response = await new OpenAIClient({ model: AIModelType.GPT_4O_MINI }, { responses: { create } } as any)
      .processAlerts(request());
    expect(response.success).toBe(false);
    expect(response.error).toBe('429 Rate limit reached');
  });

  it('makes no call without an OpenAI key', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const response = await new OpenAIClient({ model: AIModelType.GPT_4O_MINI }).processAlerts(request());
    expect(response.success).toBe(false);
    expect(response.error).toBe('OPENAI_API_KEY is not set');
  });
});
