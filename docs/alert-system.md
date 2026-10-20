# Alert System Documentation

## Overview

The Foresight CDSS Alert System is designed to identify critical clinical patterns and provide actionable recommendations to healthcare providers. The system includes multiple types of alerts designed to catch different categories of medical concerns.

## Alert Categories

### 1. Drug Interaction Alerts
- **Purpose**: Identify potentially dangerous drug combinations
- **Severity**: WARNING to CRITICAL
- **Examples**: 
  - Warfarin + NSAIDs (bleeding risk)
  - Methotrexate + Paracetamol (hepatotoxicity)

### 2. Missing Lab Result Alerts
- **Purpose**: Suggest important laboratory tests based on clinical context
- **Severity**: INFO to WARNING
- **Examples**:
  - Overdue INR monitoring for warfarin patients
  - Diabetes monitoring (HbA1c, microalbumin)
  - Thyroid function tests for relevant symptoms

### 3. Complex Condition Alerts
- **Purpose**: Identify patterns suggesting serious conditions requiring specialist care
- **Severity**: WARNING to CRITICAL
- **Categories**:

#### Autoimmune Conditions
- **Systemic Lupus Erythematosus**: Photosensitive rash, arthritis, positive ANA
- **Rheumatoid Arthritis**: Morning stiffness, symmetric polyarthritis, positive RF
- **Sarcoidosis**: Multi-system involvement, hilar lymphadenopathy

#### Oncologic Concerns
- **Lung Cancer**: Smoking history, hemoptysis, weight loss, persistent cough
- **Hematologic Malignancy**: B-symptoms (fever, night sweats, weight loss) with lymphadenopathy
- **General Cancer Screening**: Unexplained weight loss, constitutional symptoms

#### Endocrine Disorders
- **Hyperthyroidism**: Tachycardia, weight loss, heat intolerance with cardiac manifestations
- **Diabetes Complications**: Poor control with end-organ damage signs

### 4. Comorbidity Analysis Alerts
- **Purpose**: Identify increased risk based on multiple conditions
- **Examples**:
  - Cardiovascular risk assessment
  - Diabetes + hypertension management
  - Metabolic syndrome identification

### 5. Diagnostic Gap Alerts
- **Purpose**: Suggest additional evaluations or screenings
- **Examples**:
  - Depression screening (PHQ-9)
  - Cognitive assessment in elderly
  - Preventive care reminders

## Alert Processing

### Real-time Alerts
- Triggered during active consultations
- Process transcript segments as they're generated
- Focus on immediate safety concerns
- Limited to 3 alerts per processing cycle

### Post-consultation Alerts
- Comprehensive analysis after consultation completion
- Consider full patient context and medical history
- More thorough evaluation of complex patterns
- Can generate multiple alerts per category

## Alert Data Structure

```typescript
interface UnifiedAlert {
  id: string;
  patientId: string;
  encounterId?: string;
  alertType: AlertType;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  suggestion: string;
  confidenceScore: number;
  sourceReasoning: string;
  processingModel: string;
  contextData?: any;
  status: AlertStatus;
  createdAt: string;
  acknowledged: boolean;
  // ... additional fields
}
```

## AI Models and Processing

### Models Used
- **gpt-6-astra**, through the Responses API with structured output, for both
  the real-time alerts during the consultation and the post-consultation
  analysis, at low reasoning effort. If the real-time passes lag behind a
  consultation, `gpt-6-luna` at reasoning effort `none` is the faster model to
  try (`DEFAULT_REALTIME_MODEL` in `src/lib/ai/gpt-models.ts`).
- **Clinical Pattern Recognition**: Rule-based patterns for well-established criteria

### Confidence Scoring
- **0.9-1.0**: High confidence, immediate action recommended
- **0.8-0.89**: Good confidence, prompt evaluation suggested
- **0.7-0.79**: Moderate confidence, consider evaluation
- **<0.7**: Low confidence, background monitoring

## Production vs Development

### Development Environment
- Shows mock alerts when no database alerts exist
- Includes comprehensive examples for testing UI
- Immediate fallback to demo data

### Production Environment
- Relies on actual database alerts
- Fallback to demo alerts if database is empty
- Complex case alerts are pre-populated for demonstration

## Database Schema

The unified alerts system uses a single `alerts` table with the following key fields:
- Patient and encounter identification
- Alert classification (type, severity, category)
- Alert content (title, message, suggestion)
- AI metadata (confidence, reasoning, model)
- User interaction tracking (acknowledged, dismissed)
- Audit trail (created, updated, expires)

## User Interface

### Alert Dashboard
- Organized by alert type with tabs
- Statistics overview (total alerts, types, last updated)
- Filtering and search capabilities
- Accept/Dismiss actions

### Alert List
- Grouped by category for better organization
- Color-coded by severity
- Expandable details with reasoning
- One-click actions

## Future Enhancements

- Integration with clinical guidelines database
- Machine learning for pattern refinement
- Specialty-specific alert templates
- Integration with EHR systems
- Real-time collaboration features 