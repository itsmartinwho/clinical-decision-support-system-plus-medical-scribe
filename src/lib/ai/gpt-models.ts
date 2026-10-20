// OpenAI GPT Model Configurations for Clinical Alerts System
import type OpenAI from 'openai';
import { z } from 'zod';
import {
  AIModelType,
  AIModelConfig,
  AI_MODEL_CONFIGS,
  AIModelCapability,
  AIAlertResult,
  AIProcessingContext,
  AIProcessingRequest,
  AIProcessingResponse,
  AIPromptTemplate
} from '@/types/ai-models';

// Export individual model types for easy import
export const GPT_6_ASTRA = AIModelType.GPT_6_ASTRA;

// Real-time alerts. Astra at low effort; if its passes lag behind the
// consultation, gpt-6-luna (reasoning effort none) is the faster one to try.
export const DEFAULT_REALTIME_MODEL = GPT_6_ASTRA;

// Default model for post-consultation alerts processing
export const DEFAULT_POST_CONSULTATION_MODEL = GPT_6_ASTRA;

export const FALLBACK_ALERTS_MODEL = GPT_6_ASTRA;

// Model selection based on use case
export const getModelForUseCase = (useCase: 'real-time' | 'post-consultation' | 'demo'): AIModelType => {
  switch (useCase) {
    case 'real-time':
      return DEFAULT_REALTIME_MODEL;
    case 'post-consultation':
      return DEFAULT_POST_CONSULTATION_MODEL;
    case 'demo':
      return GPT_6_ASTRA;
    default:
      return FALLBACK_ALERTS_MODEL;
  }
};

// Get model configuration
export const getModelConfig = (modelType: AIModelType): AIModelConfig => {
  return AI_MODEL_CONFIGS[modelType];
};

// Check if model supports specific capabilities
export const modelSupportsCapability = (
  modelType: AIModelType, 
  capability: AIModelCapability
): boolean => {
  const config = getModelConfig(modelType);
  return config.capabilities.includes(capability);
};

// Get optimal model for clinical alerts based on content complexity
export const getOptimalAlertsModel = (
  contentLength: number,
  requiresReasoning: boolean = false,
  isRealTime: boolean = false
): AIModelType => {
  if (isRealTime) {
    // For real-time processing, prioritize speed
    return DEFAULT_REALTIME_MODEL;
  }
  
  if (requiresReasoning || contentLength > 5000) {
    // For complex analysis, use reasoning model
    return DEFAULT_POST_CONSULTATION_MODEL;
  }
  
  // For simple analysis, use fast model
  return DEFAULT_REALTIME_MODEL;
};

// Check if model is a reasoning model
export const isReasoningModel = (model: AIModelType): boolean => {
  return modelSupportsCapability(model, AIModelCapability.REASONING);
};

// Check if model supports multimodal input
export const isMultimodalModel = (model: AIModelType): boolean => {
  return modelSupportsCapability(model, AIModelCapability.MULTIMODAL);
};

// Get model cost per 1000 tokens
export const getModelCost = (model: AIModelType): number => {
  const config = getModelConfig(model);
  return config.costPer1000Tokens;
};

// Validate if a model name is supported
export const validateModelName = (modelName: string): boolean => {
  return Object.values(AIModelType).includes(modelName as AIModelType);
};

// Available models list for validation
export const AVAILABLE_MODELS = Object.values(AIModelType);

// Model recommendations for different scenarios
export const MODEL_RECOMMENDATIONS = {
  REAL_TIME_ALERTS: DEFAULT_REALTIME_MODEL,
  POST_CONSULTATION_ANALYSIS: DEFAULT_POST_CONSULTATION_MODEL,
  COST_OPTIMIZATION: GPT_6_ASTRA,
  ADVANCED_REASONING: GPT_6_ASTRA,
  MULTIMODAL_ANALYSIS: GPT_6_ASTRA,
  FALLBACK: FALLBACK_ALERTS_MODEL
} as const;

// The alerts' model calls: one Responses API request per pass, its output held
// to a JSON schema of the alert types the prompt template asks for.

export interface OpenAIClientConfig {
  model: string;
  maxTokens?: number; // max_output_tokens, which for a reasoning model includes its reasoning
  temperature?: number; // sent to the other models only
  reasoningEffort?: 'low' | 'medium' | 'high'; // sent to reasoning models only
  retryAttempts?: number;
  timeout?: number; // ms, per attempt
}

type ResponsesClient = Pick<OpenAI, 'responses'>;

const alertOutputSchema = (alertTypes: string[]) => z.object({
  alerts: z.array(z.object({
    type: z.enum(alertTypes as [string, ...string[]]),
    severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
    title: z.string(),
    message: z.string(),
    suggestion: z.string().nullable(),
    confidence: z.number().describe('From 0 to 1'),
    reasoning: z.string()
  }))
});

const fillTemplate = (template: string, values: Record<string, string>): string =>
  template.replace(/\{([A-Z_]+)\}/g, (placeholder, key) => values[key] ?? placeholder);

export function buildAlertInstructions(
  template: AIPromptTemplate,
  isRealTime: boolean,
  confidenceThreshold: number,
  maxAlerts: number
): string {
  const system = fillTemplate(template.systemPrompt, {
    CONFIDENCE_THRESHOLD: String(confidenceThreshold),
    IS_REAL_TIME: isRealTime ? 'yes' : 'no',
    ALERT_TYPES: template.alertTypes.join(', ')
  });
  const pass = isRealTime
    ? 'This pass covers a new stretch of a consultation still in progress.'
    : 'This pass reviews the whole consultation after it ended.';
  return `${system}\n\n${pass} Return at most ${maxAlerts} alerts, and an empty list when nothing reaches the threshold.`;
}

export function buildAlertInput(template: AIPromptTemplate, context: AIProcessingContext, isRealTime: boolean): string {
  const existingAlerts = context.existingAlerts.length
    ? context.existingAlerts.map(alert => `- ${alert.type}: ${alert.message}`).join('\n')
    : 'None';
  const input = fillTemplate(template.userPromptTemplate, {
    PATIENT_CONTEXT: JSON.stringify(context.patientData, null, 2),
    TRANSCRIPT: context.transcript.full || '(empty)',
    EXISTING_ALERTS: existingAlerts,
    CONSULTATION_CONTEXT: context.consultationContext ? JSON.stringify(context.consultationContext, null, 2) : 'None'
  });
  return isRealTime && context.transcript.segment
    ? `${input}\n\nNEW TRANSCRIPT SEGMENT (the part to analyze now):\n${context.transcript.segment}`
    : input;
}

export class OpenAIClient {
  private config: OpenAIClientConfig;
  private openai: ResponsesClient | null;

  // Pass a client to use it instead of the SDK's (the tests do).
  constructor(config: OpenAIClientConfig, openai?: ResponsesClient) {
    this.config = config;
    this.openai = openai ?? null;
  }

  private async getOpenAI(): Promise<ResponsesClient | null> {
    if (this.openai) return this.openai;
    if (!process.env.OPENAI_API_KEY) return null;
    // Imported here, so the browser code that shares this module never loads it.
    const { default: OpenAI } = await import('openai');
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: this.config.retryAttempts,
      timeout: this.config.timeout
    });
    return this.openai;
  }

  async processAlerts(request: AIProcessingRequest): Promise<AIProcessingResponse> {
    const startedAt = Date.now();
    const fail = (error: string): AIProcessingResponse => ({
      success: false,
      alerts: [],
      processingTime: Date.now() - startedAt,
      tokensUsed: { prompt: 0, completion: 0, total: 0 },
      model: request.model,
      error
    });

    const openai = await this.getOpenAI();
    if (!openai) return fail('OPENAI_API_KEY is not set');

    const template = request.promptTemplate;
    const threshold = request.confidenceThreshold ?? template.confidenceThreshold;
    const maxAlerts = request.maxAlerts ?? 3;
    const schema = alertOutputSchema(template.alertTypes);

    try {
      const { zodTextFormat } = await import('openai/helpers/zod');
      const response = await openai.responses.create({
        model: request.model,
        instructions: buildAlertInstructions(template, request.isRealTime, threshold, maxAlerts),
        input: buildAlertInput(template, request.context, request.isRealTime),
        text: { format: zodTextFormat(schema, 'clinical_alerts') },
        max_output_tokens: this.config.maxTokens,
        store: false,
        ...(isReasoningModel(request.model)
          ? { reasoning: { effort: this.config.reasoningEffort ?? 'low' } }
          : { temperature: this.config.temperature })
      });

      if (response.status === 'incomplete') {
        return fail(`The response was cut short: ${response.incomplete_details?.reason ?? 'unknown reason'}`);
      }
      if (!response.output_text) {
        return fail('The response had no output');
      }

      const { alerts } = schema.parse(JSON.parse(response.output_text));
      return {
        success: true,
        alerts: alerts
          .filter(alert => alert.confidence >= threshold && alert.confidence <= 1)
          .slice(0, maxAlerts)
          .map((alert): AIAlertResult => ({
            type: alert.type,
            severity: alert.severity,
            title: alert.title,
            message: alert.message,
            suggestion: alert.suggestion ?? undefined,
            confidence: alert.confidence,
            reasoning: alert.reasoning
          })),
        processingTime: Date.now() - startedAt,
        tokensUsed: {
          prompt: response.usage?.input_tokens ?? 0,
          completion: response.usage?.output_tokens ?? 0,
          total: response.usage?.total_tokens ?? 0
        },
        model: response.model || request.model
      };
    } catch (error) {
      console.error('[OpenAIClient] processAlerts failed:', error instanceof Error ? error.message : error);
      return fail(error instanceof Error ? error.message : String(error));
    }
  }
}

export type AvailableModel = typeof AVAILABLE_MODELS[number]; 