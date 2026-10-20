// Unified Alert System Types
// This file defines types for the new unified alerts system that replaces both
// the existing copilot alerts and complex case alerts

export enum AlertType {
  // Existing copilot alert types
  DRUG_INTERACTION = 'DRUG_INTERACTION',
  MISSING_LAB_RESULT = 'MISSING_LAB_RESULT',
  CLINICAL_GUIDELINE = 'CLINICAL_GUIDELINE',
  ABNORMAL_VITAL = 'ABNORMAL_VITAL',
  COMORBIDITY_REMINDER = 'COMORBIDITY_REMINDER',
  
  // New alert types
  COMORBIDITY = 'COMORBIDITY',
  ASSESSMENT_QUESTION = 'ASSESSMENT_QUESTION',
  DIAGNOSTIC_GAP = 'DIAGNOSTIC_GAP',
  COMPLEX_CONDITION = 'COMPLEX_CONDITION'
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACCEPTED = 'accepted',
  DISMISSED = 'dismissed',
  RESOLVED = 'resolved',
  EXPIRED = 'expired'
}

export enum AlertCategory {
  COPILOT = 'copilot',
  COMPLEX_CASE = 'complex_case',
  CLINICAL_ENGINE = 'clinical_engine',
  REAL_TIME = 'real_time',
  POST_CONSULTATION = 'post_consultation'
}

// Main unified alert interface
export interface UnifiedAlert {
  id: string;
  patientId: string;
  encounterId?: string;
  
  // Alert classification
  alertType: AlertType;
  severity: AlertSeverity;
  category?: AlertCategory;
  
  // Alert content
  title: string;
  message: string;
  suggestion?: string;
  
  // AI and processing metadata
  confidenceScore?: number; // 0.0 to 1.0
  sourceReasoning?: string;
  processingModel?: string; // the model's id as OpenAI returns it, e.g. 'gpt-6-astra'
  contextData?: Record<string, any>;
  
  // Alert lifecycle
  status: AlertStatus;
  isRealTime: boolean;
  isPostConsultation: boolean;
  
  // User interaction tracking
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  dismissedAt?: string;
  dismissedBy?: string;
  acceptedAt?: string;
  acceptedBy?: string;
  actionTaken?: string;
  
  // Related data and navigation
  relatedData?: Record<string, any>;
  relatedPatientDataRefs?: Record<string, any>;
  navigationTarget?: string;
  proposedEdit?: Record<string, any>;
  
  // Legacy support
  legacyAlertData?: Record<string, any>;
  migratedFromPatientAlerts: boolean;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  tags?: string[];
  extraData?: Record<string, any>;
}

// Specific alert data interfaces for different alert types
export interface DrugInteractionAlertData {
  drug1: string;
  drug2: string;
  interactionDetails: string;
  severity: 'mild' | 'moderate' | 'severe';
  mechanism?: string;
  clinicalEffect?: string;
  management?: string;
}

export interface MissingLabAlertData {
  labName: string;
  reasonForSuggestion: string;
  urgency?: 'routine' | 'urgent' | 'stat';
  expectedValues?: string;
  clinicalContext?: string;
}

export interface ComorbidityAlertData {
  suspectedCondition: string;
  confidenceLevel: number;
  supportingEvidence: string[];
  recommendedWorkup: string[];
  riskFactors: string[];
}

export interface AssessmentQuestionAlertData {
  questionCategory: string;
  suggestedQuestions: string[];
  clinicalRationale: string;
  priority: 'high' | 'medium' | 'low';
}

export interface DiagnosticGapAlertData {
  gapType: 'missing_differential' | 'insufficient_workup' | 'inconsistent_findings' | 'overlooked_red_flags';
  description: string;
  suggestedActions: string[];
  clinicalImpact: string;
}

export interface ComplexConditionAlertData {
  conditionType: 'autoimmune' | 'inflammatory' | 'oncology' | 'rare_disease';
  triggeringFactors: string[];
  suggestedSpecialty?: string;
  urgencyLevel: 'routine' | 'expedited' | 'urgent';
  supportingEvidence: string[];
}

// Alert creation and management interfaces
export interface CreateAlertRequest {
  patientId: string;
  encounterId?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  category?: AlertCategory;
  title: string;
  message: string;
  suggestion?: string;
  confidenceScore?: number;
  sourceReasoning?: string;
  processingModel?: string;
  contextData?: Record<string, any>;
  relatedData?: Record<string, any>;
  navigationTarget?: string;
  proposedEdit?: Record<string, any>;
  isRealTime?: boolean;
  isPostConsultation?: boolean;
  expiresAt?: string;
  tags?: string[];
}

export interface UpdateAlertRequest {
  status?: AlertStatus;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  actionTaken?: string;
  extraData?: Record<string, any>;
}

export interface AlertFilterOptions {
  patientId?: string;
  encounterId?: string;
  alertTypes?: AlertType[];
  severities?: AlertSeverity[];
  categories?: AlertCategory[];
  statuses?: AlertStatus[];
  isRealTime?: boolean;
  isPostConsultation?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  includeExpired?: boolean;
}

export interface AlertQueryResult {
  alerts: UnifiedAlert[];
  totalCount: number;
  hasMore: boolean;
}

// Real-time alert processing interfaces
export interface RealTimeAlertContext {
  patientId: string;
  encounterId: string;
  transcriptSegment: string;
  fullTranscript: string;
  patientHistory: Record<string, any>;
  existingAlerts: UnifiedAlert[];
  lastProcessedAt?: string;
}

export interface PostConsultationAlertContext {
  patientId: string;
  encounterId: string;
  fullTranscript: string;
  soapNote?: string;
  patientHistory: Record<string, any>;
  realTimeAlerts: UnifiedAlert[];
  diagnosticResults?: Record<string, any>;
  treatments?: Record<string, any>;
}

// UI and display interfaces
export interface AlertDisplayProps {
  alert: UnifiedAlert;
  onAccept?: (alertId: string) => void;
  onDismiss?: (alertId: string) => void;
  onNavigate?: (target: string) => void;
  showActions?: boolean;
  compact?: boolean;
}

export interface AlertToastProps {
  alert: UnifiedAlert;
  duration?: number;
  onExpire?: () => void;
  onHover?: () => void;
  onLeave?: () => void;
}

export interface AlertDashboardProps {
  alerts: UnifiedAlert[];
  filters?: AlertFilterOptions;
  onFilterChange?: (filters: AlertFilterOptions) => void;
  onAlertAction?: (alertId: string, action: 'accept' | 'dismiss') => void;
}

// Legacy support - mapping from old alert types
export interface LegacyComplexCaseAlert {
  id: string;
  patientId: string;
  msg?: string;
  date?: string;
  type?: "autoimmune" | "inflammatory" | "oncology";
  severity: "low" | "medium" | "high" | string;
  triggeringFactors?: string[];
  suggestedActions?: string[];
  createdAt?: string;
  acknowledged?: boolean;
  acknowledgedAt?: string;
  confidence?: number;
  likelihood?: number;
  conditionType?: string;
}

// Utility types for alert processing
export type AlertProcessor = (context: RealTimeAlertContext | PostConsultationAlertContext) => Promise<CreateAlertRequest[]>;
export type AlertValidator = (alert: CreateAlertRequest) => boolean;
export type AlertDeduplicator = (newAlert: CreateAlertRequest, existingAlerts: UnifiedAlert[]) => boolean; 