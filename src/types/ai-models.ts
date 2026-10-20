// AI Model Integration Types
// Defines types for integrating with OpenAI models for alert processing

// Every OpenAI model the app calls. Each value must be unique: the configs
// below are keyed by it.
// Since 2026-10-20 that is one model, gpt-6-astra, OpenAI's "most capable model
// for the most demanding work". It replaced gpt-4o and gpt-4o-mini (shut down
// on 2027-01-14) and gpt-5.6-sol. Its model page lists what the app needs: the
// Responses API and Chat Completions, structured outputs, and Code Interpreter
// (the advisor's charts). It always reasons (effort low to max, no temperature).
export enum AIModelType {
  GPT_6_ASTRA = 'gpt-6-astra'
}

export interface AIModelConfig {
  name: string;
  displayName: string;
  maxTokens: number;
  costPer1000Tokens: number;
  capabilities: AIModelCapability[];
  description: string;
}

export enum AIModelCapability {
  TEXT_GENERATION = 'text_generation',
  REASONING = 'reasoning',
  CODE_GENERATION = 'code_generation',
  MULTIMODAL = 'multimodal',
  FUNCTION_CALLING = 'function_calling'
}

export interface AIModelResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finishReason: string;
  }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  created: number;
}

export interface AIPromptTemplate {
  id: string;
  name: string;
  description: string;
  alertTypes: string[];
  systemPrompt: string;
  userPromptTemplate: string;
  fewShotExamples?: AIFewShotExample[];
  requiredContext: string[];
  outputFormat: 'json' | 'text';
  confidenceThreshold: number;
}

export interface AIFewShotExample {
  input: {
    patientContext: string;
    transcriptSegment: string;
    existingAlerts?: string[];
  };
  output: {
    alerts: Array<{
      type: string;
      severity: string;
      title: string;
      message: string;
      suggestion?: string;
      confidence: number;
      reasoning: string;
    }>;
  };
}

export interface AIProcessingContext {
  patientId: string;
  encounterId?: string;
  patientData: {
    demographics: Record<string, any>;
    conditions: Record<string, any>[];
    medications: Record<string, any>[];
    labResults: Record<string, any>[];
    allergies?: string[];
    vitals?: Record<string, any>[];
  };
  transcript: {
    full: string;
    segment?: string;
    lastProcessedIndex?: number;
  };
  existingAlerts: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: string;
  }>;
  consultationContext?: {
    soapNote?: string;
    diagnosticResults?: Record<string, any>;
    treatments?: Record<string, any>[];
  };
}

export interface AIAlertResult {
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  suggestion?: string;
  confidence: number;
  reasoning: string;
  relatedData?: Record<string, any>;
  navigationTarget?: string;
  proposedEdit?: Record<string, any>;
}

export interface AIProcessingRequest {
  model: AIModelType;
  context: AIProcessingContext;
  promptTemplate: AIPromptTemplate;
  isRealTime: boolean;
  maxAlerts?: number;
  confidenceThreshold?: number;
}

export interface AIProcessingResponse {
  success: boolean;
  alerts: AIAlertResult[];
  processingTime: number;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  error?: string;
}

// Real-time specific configurations
export interface RealTimeAIConfig extends AIModelConfig {
  model: AIModelType;
  processingInterval: number; // in seconds (60 for minute-by-minute)
  maxContextTokens: number;
  priorityThreshold: number; // Confidence threshold for immediate alerts
}

// Post-consultation specific configurations
export interface PostConsultationAIConfig extends AIModelConfig {
  model: AIModelType;
  comprehensiveAnalysis: boolean;
  includeRealTimeAlerts: boolean;
  alertRefreshLogic: boolean;
}

// Error handling types
export interface AIProcessingError {
  code: 'RATE_LIMIT' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'MODEL_ERROR' | 'CONTEXT_TOO_LARGE';
  message: string;
  retryable: boolean;
  retryAfter?: number; // seconds
  details?: Record<string, any>;
}

// Monitoring and metrics
export interface AIModelMetrics {
  modelName: string;
  requestCount: number;
  successRate: number;
  averageResponseTime: number;
  averageTokensUsed: number;
  errorRate: number;
  lastUpdated: string;
}

export interface AIAlertQualityMetrics {
  totalAlertsGenerated: number;
  alertsAccepted: number;
  alertsDismissed: number;
  averageConfidenceScore: number;
  alertTypeDistribution: Record<string, number>;
  userFeedbackScore?: number;
}

// Prompt engineering utilities
export interface PromptContext {
  patientSummary: string;
  currentMedications: string;
  recentLabResults: string;
  medicalHistory: string;
  transcriptSegment: string;
  existingAlerts: string;
  consultationReason?: string;
}

export interface PromptBuilder {
  buildSystemPrompt(alertTypes: string[]): string;
  buildUserPrompt(context: PromptContext): string;
  formatFewShotExamples(examples: AIFewShotExample[]): string;
  validatePromptLength(prompt: string, maxTokens: number): boolean;
}

// Model configuration presets
export const AI_MODEL_CONFIGS: Record<AIModelType, AIModelConfig> = {
  [AIModelType.GPT_6_ASTRA]: {
    name: 'gpt-6-astra',
    displayName: 'GPT-6 Astra',
    maxTokens: 1050000,
    costPer1000Tokens: 10, // as the earlier entries had it: USD per 1M input tokens
    capabilities: [
      AIModelCapability.TEXT_GENERATION,
      AIModelCapability.REASONING,
      AIModelCapability.CODE_GENERATION,
      AIModelCapability.MULTIMODAL,
      AIModelCapability.FUNCTION_CALLING
    ],
    description: "OpenAI's most capable model, for every feature of the app"
  }
};

// Default model selections for different use cases
export const AI_MODEL_PRESETS = {
  FAST_RESPONSE: AIModelType.GPT_6_ASTRA, // Real-time alerts
  BALANCED: AIModelType.GPT_6_ASTRA,
  REASONING: AIModelType.GPT_6_ASTRA, // Post-consultation analysis
  COST_EFFECTIVE: AIModelType.GPT_6_ASTRA,
  ADVANCED_REASONING: AIModelType.GPT_6_ASTRA
};

export type AIModel = keyof typeof AI_MODEL_CONFIGS;

// API client interfaces
export interface AIAPIClient {
  processAlerts(request: AIProcessingRequest): Promise<AIProcessingResponse>;
  validateApiKey(): Promise<boolean>;
  getModelStatus(model: AIModelType): Promise<'available' | 'unavailable' | 'rate_limited'>;
  estimateTokens(text: string): number;
}

export interface AIModelFactory {
  createClient(config: AIModelConfig): AIAPIClient;
  getAvailableModels(): AIModelType[];
  getModelCapabilities(model: AIModelType): {
    maxContextLength: number;
    maxOutputTokens: number;
    supportsRealTime: boolean;
    costPerToken: number;
  };
} 