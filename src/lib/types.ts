// Type definitions for the clinical decision support app

export interface Patient {
  id: string;
  name?: string;
  firstName: string;
  lastName: string;
  gender?: string;
  dateOfBirth?: string;
  race?: string;
  ethnicity?: string;
  maritalStatus?: string;
  language?: string;
  povertyPercentage?: number;
  photo?: string;
  nextAppointment?: string;
  reason?: string; // Patient-level general reason
  alerts?: ComplexCaseAlert[];
}

export interface Treatment {
  drug: string;
  status: string;
  rationale: string;
}

// Rich content structure for diagnosis and treatments
export interface RichContent {
  content_type: 'text/plain' | 'text/markdown' | 'application/json';
  text_content: string; // Clean text for EHR integration
  rich_elements: RichElement[]; // Charts, tables, decision trees
  created_at: string;
  updated_at?: string;
  version: string;
}

export interface RichElement {
  id: string;
  type: 'chart' | 'table' | 'decision_tree' | 'text_block' | 'progress_bar';
  data: any; // Element-specific data structure
  position?: number; // Order within the content
  editable?: boolean; // Whether this element can be edited
}

export interface DecisionTreeNode {
  id: string;
  label: string;
  type: 'condition' | 'action' | 'outcome';
  children?: DecisionTreeNode[];
  condition?: string; // For decision nodes
  action?: string; // For action nodes
  guidelines_reference?: string; // Reference to clinical guideline
}

export interface Encounter {
  id: string;
  encounterIdentifier: string; // Human-readable/external ID for the encounter
  patientId: string;
  encounter_type?: string; // FHIR Encounter.type (e.g. 'consultation', 'ambulatory')
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string;
  actualEnd?: string;
  reasonCode?: string; // FHIR Encounter.reasonCode.text
  reasonDisplayText?: string; // User-friendly, verbose reason for encounter
  transcript?: string;
  observations?: string[]; // New field for observations
  soapNote?: string;
  treatments?: Treatment[];
  diagnosis_rich_content?: RichContent; // Rich content for diagnosis
  treatments_rich_content?: RichContent; // Rich content for treatments
  priorAuthJustification?: string;
  insuranceStatus?: string; // From database schema insurance_status
  isDeleted?: boolean;
  deletedAt?: string;
  extra_data?: any; // Added to match schema and usage
}

export interface Diagnosis {
  patientId: string;
  encounterId: string;
  code?: string;
  description?: string;
}

export interface LabResult {
  patientId: string;
  encounterId: string;
  name: string;
  value: number | string;
  units?: string;
  dateTime?: string;
  referenceRange?: string;
  flag?: string;
}

export interface ComplexCaseAlert {
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
  likelihood?: number; // Scale of 1-5
  conditionType?: string;
}

export interface ClinicalSource {
  type: "patient_data" | "guideline" | "clinical_trial" | "research";
  id: string;
  title: string;
  content: string;
  relevanceScore?: number;
  accessTime: string;
}

export interface DiagnosticStep {
  id: string;
  description: string;
  query: string;
  completed: boolean;
  sources: ClinicalSource[];
  findings: string;
}

export interface DiagnosticPlan {
  steps: DiagnosticStep[];
  rationale: string;
}

export interface DifferentialDiagnosis {
  name: string;
  /** @deprecated Use probabilityDecimal and derive qualitativeRisk from it. */
  likelihood: string; // "High" | "Medium" | "Low"
  likelihoodPercentage?: number; // 0-100 for visual indicators

  // FHIR-aligned fields
  qualitativeRisk: "Negligible" | "Low" | "Moderate" | "High" | "Certain"; // FHIR qualitativeRisk
  probabilityDecimal: number; // 0-100, FHIR probabilityDecimal. Canonical numeric value.
  rank: number; // UI sort order

  keyFactors: string;
  explanation?: string; // Clinical explanation
  supportingEvidence?: string[]; // Supporting evidence
  icdCodes?: Array<{
    code: string;
    description: string;
  }>; // ICD-10 codes with descriptions

  // Audit and safety flags
  dontMiss?: boolean; // "don't-miss" flag to force display
  confidenceWarning?: boolean; // Flag for calibration drift
  missingAlternativeAlert?: boolean; // Flag for high probability of excluded diagnoses
}

// Database record for differential diagnoses
export interface DifferentialDiagnosisRecord {
  id: string;
  patient_id: string;
  encounter_id: string;
  diagnosis_name: string;
  likelihood: string; // Stored as TEXT in DB. Contains qualitative category.
  key_factors?: string;
  rank_order: number;
  created_at: string;
  updated_at: string;
}

export interface ClinicalTrial {
  id: string;
  title: string;
  phase: string;
  location: string;
  contact: string;
  eligibility: string;
}

export interface DiagnosticResult {
  diagnosisName: string;
  diagnosisCode?: string;
  confidence: number;
  supportingEvidence: string[];
  reasoningExplanation?: string; // Explanation of final diagnosis reasoning
  differentialDiagnoses: DifferentialDiagnosis[];
  recommendedTests: string[];
  recommendedTreatments: string[];
  clinicalTrialMatches: ClinicalTrial[];
}

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  rawTranscriptSnippet?: string;
}

export interface GeneratedReferralDocument {
  referralTo: string;
  reasonForReferral: string;
  summaryOfFindings: string;
  generatedContent: SpecialistReferral; // Or Record<string, any> if more flexible
}

export interface GeneratedPriorAuthDocument {
  medicationOrService: string;
  reasonForRequest: string;
  generatedContent: PriorAuthorization; // Or Record<string, any>
}

export interface ClinicalOutputPackage {
  requestId: string;
  timestamp: string;
  patientId: string;
  diagnosticResult: DiagnosticResult;
  soapNote?: SoapNote;
  referralDocument?: GeneratedReferralDocument;
  priorAuthDocument?: GeneratedPriorAuthDocument;
  evidenceSources: ClinicalSource[];
  // New fields for OpenAI Code Interpreter support
  visualizations?: string[]; // File IDs of generated charts/images
  analysisText?: string; // Full analysis text from assistant
}

export interface PriorAuthorization {
  patientInformation: {
    name: string;
    dateOfBirth: string;
    insuranceId: string;
    gender: string;
  };
  providerInformation: {
    name: string;
    npi: string;
    facility: string;
    contactPhone: string;
    contactEmail: string;
  };
  serviceRequest: {
    diagnosis: string;
    diagnosisCode: string;
    requestedService: string;
    serviceCode: string;
    startDate: string;
    duration: string;
    frequency: string;
  };
  clinicalJustification: string;
  supportingDocumentation: string[];
}

export interface SpecialistReferral {
  date: string;
  referringProvider: {
    name: string;
    npi: string;
    facility: string;
    contactPhone: string;
    contactEmail: string;
  };
  specialist: {
    type: string;
    facility: string;
  };
  patientInformation: {
    name: string;
    dateOfBirth: string;
    gender: string;
    contactPhone: string;
    insurance: string;
  };
  referralReason: {
    diagnosis: string;
    diagnosisCode: string;
    reasonForReferral: string;
  };
  clinicalInformation: {
    historyOfPresentIllness: string;
    relevantPastMedicalHistory: string[];
    currentMedications: string[];
    allergies: string[];
    physicalExamination: string;
    recentLabResults: {
      name: string;
      value: number;
      units: string;
      date: string;
      flag: "H" | "L" | "N";
    }[];
  };
  requestedEvaluation: string[];
}

export interface CopilotSuggestion {
  id: string;
  type: "question" | "test" | "medication" | "guideline" | "alert";
  content: string;
  context: string;
  relevanceScore: number;
  createdAt: string;
  dismissed: boolean;
  actioned: boolean;
}

export interface Consultation {
  dateTime: string; // ISO string
  reason?: string;
}

// New type for the wrapper around encounter details
export interface EncounterDetailsWrapper {
  encounter: Encounter;
  diagnoses: Diagnosis[];
  labResults: LabResult[];
  // Treatments are typically part of the Encounter object itself now as per `Encounter` type above.
  // If a specific tab needs treatments at this wrapper level, it can be added, but prefer it on Encounter.
}

export interface PatientDataPayload {
  patient: Patient | null;
  encounters: Array<{
    encounter: Encounter;
    diagnoses: Diagnosis[];
    labResults: LabResult[];
  }>;
}

// Form-specific types for Prior Authorization and Referral Forms
export interface FHIRResourceType {
  value: string;
  label: string;
  description: string;
}

export interface PriorAuthFormData {
  resourceType: string;
  patientInformation: {
    name: string;
    dateOfBirth: string;
    gender: string;
    insuranceId: string;
    memberId: string;
  };
  providerInformation: {
    name: string;
    npi: string;
    facility: string;
    contactPhone: string;
    contactEmail: string;
  };
  serviceRequest: {
    diagnosis: string;
    diagnosisCode: string;
    requestedService: string;
    serviceCode: string;
    startDate: string;
    duration: string;
    frequency: string;
  };
  clinicalJustification: string;
  authorizationNumber: string;
  urgencyLevel: string;
  supportingDocumentation: string[];
}

export interface ReferralFormData {
  resourceType: string;
  patientInformation: {
    name: string;
    dateOfBirth: string;
    gender: string;
    contactPhone: string;
    insurance: string;
    address: string;
  };
  referringProvider: {
    name: string;
    npi: string;
    facility: string;
    contactPhone: string;
    contactEmail: string;
  };
  specialist: {
    type: string;
    facility: string;
    preferredProvider: string;
  };
  referralReason: {
    diagnosis: string;
    diagnosisCode: string;
    reasonForReferral: string;
    urgency: string;
  };
  clinicalInformation: {
    historyOfPresentIllness: string;
    relevantPastMedicalHistory: string[];
    currentMedications: string[];
    allergies: string[];
    physicalExamination: string;
    recentLabResults: LabResult[];
    vitalSigns: string;
  };
  requestedEvaluation: string[];
  additionalNotes: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}
