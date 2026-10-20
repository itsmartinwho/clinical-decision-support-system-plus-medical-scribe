// tests/frontend/unit/lib/alertEngine.test.ts
// The alert engine end to end, with the OpenAI SDK, the alerts table and the
// patient data mocked: no real calls.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlertCategory, AlertStatus } from '@/types/alerts';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  getAlerts: vi.fn(),
  createAlert: vi.fn(),
  updateAlert: vi.fn(),
  getPatientData: vi.fn(),
  clearPatientCache: vi.fn()
}));

vi.mock('openai', () => ({
  default: class {
    responses = { create: mocks.create };
  }
}));

vi.mock('@/lib/unifiedAlertsService', () => ({
  UnifiedAlertsService: class {
    getAlerts = mocks.getAlerts;
    createAlert = mocks.createAlert;
    updateAlert = mocks.updateAlert;
  }
}));

vi.mock('@/lib/supabaseDataService', () => ({
  supabaseDataService: {
    getPatientData: mocks.getPatientData,
    clearPatientCache: mocks.clearPatientCache
  }
}));

import { AlertEngine } from '@/lib/alerts/alert-engine';

const patientData = (transcript?: string) => ({
  patient: {
    id: 'patient-1',
    firstName: 'Dorothy',
    lastName: 'Robinson',
    gender: 'female',
    dateOfBirth: '1958-03-02',
    language: 'English'
  },
  encounters: [
    {
      encounter: {
        id: 'encounter-1',
        encounterIdentifier: 'ENC-1',
        patientId: 'patient-1',
        scheduledStart: '2025-06-01T09:00:00Z',
        scheduledEnd: '2025-06-01T09:30:00Z',
        transcript,
        soapNote: 'S: Joint pain.',
        treatments: [{ drug: 'Methotrexate 15mg weekly', status: 'active', rationale: 'RA' }]
      },
      diagnoses: [{ patientId: 'patient-1', encounterId: 'encounter-1', code: 'M05.79', description: 'Rheumatoid arthritis' }],
      labResults: [{ patientId: 'patient-1', encounterId: 'encounter-1', name: 'ALT', value: 52, units: 'U/L', flag: 'H' }]
    }
  ]
});

const modelAnswer = (model: string) => ({
  status: 'completed',
  model,
  output_text: JSON.stringify({
    alerts: [{
      type: 'DRUG_INTERACTION',
      severity: 'WARNING',
      title: 'Methotrexate and paracetamol',
      message: 'Regular paracetamol with methotrexate raises the risk to the liver.',
      suggestion: 'Check AST and ALT.',
      confidence: 0.9,
      reasoning: 'Both are hepatotoxic, and her ALT is already high.'
    }]
  }),
  usage: { input_tokens: 900, output_tokens: 120, total_tokens: 1020 }
});

describe('AlertEngine', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.createAlert.mockImplementation(async (request) => ({ id: 'new-alert', ...request }));
    mocks.updateAlert.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('turns a stretch of transcript into alerts, telling the model about the real patient', async () => {
    mocks.getAlerts.mockResolvedValue({ alerts: [] });
    mocks.getPatientData.mockResolvedValue(patientData());
    mocks.create.mockResolvedValue(modelAnswer('gpt-6-astra'));

    const alerts = await new AlertEngine().processRealTimeAlerts(
      'patient-1',
      'encounter-1',
      'Speaker 1: I take paracetamol most days now.',
      'Speaker 0: How is the pain? Speaker 1: I take paracetamol most days now.'
    );

    expect(mocks.create).toHaveBeenCalledTimes(1);
    const params = mocks.create.mock.calls[0][0];
    expect(params.model).toBe('gpt-6-astra');
    expect(params.reasoning).toEqual({ effort: 'low' });
    expect(params.temperature).toBeUndefined();
    expect(params.input).toContain('1958-03-02');
    expect(params.input).toContain('Rheumatoid arthritis');
    expect(params.input).toContain('Methotrexate 15mg weekly');
    expect(params.input).toContain('"name": "ALT"');
    expect(params.input).not.toContain('"age": 45');

    expect(mocks.createAlert).toHaveBeenCalledWith(expect.objectContaining({
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      alertType: 'DRUG_INTERACTION',
      severity: 'WARNING',
      title: 'Methotrexate and paracetamol',
      suggestion: 'Check AST and ALT.',
      confidenceScore: 0.9,
      sourceReasoning: 'Both are hepatotoxic, and her ALT is already high.',
      processingModel: 'gpt-6-astra',
      isRealTime: true,
      category: AlertCategory.REAL_TIME
    }));
    expect(alerts).toHaveLength(1);
  });

  it('skips an alert that repeats one already active', async () => {
    mocks.getAlerts.mockResolvedValue({
      alerts: [{
        id: 'old',
        alertType: 'DRUG_INTERACTION',
        message: 'Regular paracetamol with methotrexate raises the risk to the liver.',
        createdAt: '2025-06-01T09:05:00Z'
      }]
    });
    mocks.getPatientData.mockResolvedValue(patientData());
    mocks.create.mockResolvedValue(modelAnswer('gpt-6-astra'));

    const alerts = await new AlertEngine().processRealTimeAlerts('patient-1', 'encounter-1', 'Speaker 1: Paracetamol.');

    expect(mocks.createAlert).not.toHaveBeenCalled();
    expect(alerts).toEqual([]);
  });

  it('reviews the saved consultation after it ends', async () => {
    mocks.getAlerts.mockResolvedValue({
      alerts: [{ id: 'rt-1', alertType: 'ASSESSMENT_QUESTION', message: 'Ask about alcohol.', status: AlertStatus.ACTIVE, createdAt: '2025-06-01T09:05:00Z' }]
    });
    mocks.getPatientData.mockResolvedValue(patientData('Speaker 0: How is the pain? Speaker 1: I take paracetamol most days now.'));
    mocks.create.mockResolvedValue(modelAnswer('gpt-6-astra'));

    const alerts = await new AlertEngine().processPostConsultationAlerts('patient-1', 'encounter-1');

    expect(mocks.clearPatientCache).toHaveBeenCalledWith('patient-1');
    const params = mocks.create.mock.calls[0][0];
    expect(params.model).toBe('gpt-6-astra');
    expect(params.max_output_tokens).toBe(16000);
    expect(params.reasoning).toEqual({ effort: 'low' });
    expect(params.input).toContain('I take paracetamol most days now.');
    expect(params.input).toContain('S: Joint pain.');
    expect(params.input).toContain('- ASSESSMENT_QUESTION: Ask about alcohol.');

    expect(mocks.updateAlert).toHaveBeenCalledWith('rt-1', { status: AlertStatus.RESOLVED });
    expect(mocks.createAlert).toHaveBeenCalledWith(expect.objectContaining({
      alertType: 'DRUG_INTERACTION',
      processingModel: 'gpt-6-astra',
      isPostConsultation: true,
      category: AlertCategory.POST_CONSULTATION
    }));
    expect(alerts).toHaveLength(1);
  });

  it('calls no model after a consultation with no saved transcript', async () => {
    mocks.getAlerts.mockResolvedValue({ alerts: [] });
    mocks.getPatientData.mockResolvedValue(patientData(''));

    const alerts = await new AlertEngine().processPostConsultationAlerts('patient-1', 'encounter-1');

    expect(mocks.create).not.toHaveBeenCalled();
    expect(alerts).toEqual([]);
  });
});
