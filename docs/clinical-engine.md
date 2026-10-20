# Clinical Engine Documentation

## Overview

The Foresight Clinical Engine is a sophisticated AI-powered diagnostic system that leverages OpenAI's GPT models to analyze patient data and provide clinical decision support. The engine implements a multi-stage diagnostic pipeline following FHIR Core 6.1 standards.

## FHIR Core 6.1 Compliance

The clinical engine creates both rich and non-rich versions of clinical content to support different use cases and FHIR compliance:

### Content Storage Strategy

**Diagnosis Content:**
- **Non-Rich Version**: `conditions.description` - Plain text diagnosis name for FHIR Condition resources
- **Rich Version**: `encounters.diagnosis_rich_content` - Structured markdown with charts, visualizations, and clinical reasoning

**Treatment Content:**
- **Non-Rich Version**: `encounters.treatments` - Simple array of treatment strings for basic clinical workflows
- **Rich Version**: `encounters.treatments_rich_content` - Structured content with decision trees, monitoring plans, and detailed protocols

### FHIR Status Codes

The engine applies FHIR-compliant status codes based on diagnostic confidence:

**Clinical Status** (conditions.clinical_status):
- `active` - Applied to all diagnoses (confidence ≥ 0.6 and < 0.6) following FHIR guidelines that active conditions should remain active until proven otherwise

**Verification Status** (conditions.verification_status):
- `confirmed` - High confidence (≥ 0.8)
- `provisional` - Moderate-high confidence (≥ 0.6)
- `differential` - Moderate confidence (≥ 0.4) 
- `unconfirmed` - Low confidence (< 0.4)

### Rich Content Features

Rich versions contain the same core clinical information as non-rich versions but enhanced with:
- **Enhanced Markdown Formatting**: Headers, lists, tables for better readability
- **Interactive Visualizations**: Confidence meters, decision trees, diagnostic charts
- **Structured Metadata**: FHIR-compliant linking, source tracking, version control
- **Clinical Decision Support**: Embedded guidelines references, monitoring parameters

## Architecture

### Core Components

1. **ClinicalEngineServiceV3** - Main service orchestrating the diagnostic pipeline
2. **Multi-stage AI Analysis** - Differential diagnoses → Primary diagnosis → Treatment planning
3. **Rich Content Generators** - Create enhanced clinical documentation
4. **FHIR Compliance Layer** - Ensures proper status codes and resource mapping

### Diagnostic Pipeline Stages

1. **Data Collection** - Patient data aggregation from multiple sources
2. **Differential Diagnoses** - AI-generated ranked differential diagnoses
3. **Primary Diagnosis** - Confident primary diagnosis selection
4. **Treatment Planning** - Evidence-based treatment recommendations with decision trees
5. **SOAP Note Generation** - Structured clinical documentation
6. **Rich Content Creation** - Enhanced versions with visualizations
7. **FHIR-Compliant Storage** - Proper mapping to database with status codes

### AI Models Used

- **gpt-6-astra**, through Chat Completions, for every step: differentials,
  the primary diagnosis, the treatment plan, the SOAP note and the documents

## Database Schema Integration

### Conditions Table
```sql
conditions (
  id,
  patient_id,
  encounter_id,
  code,                    -- ICD-10 code
  description,             -- Non-rich diagnosis text (FHIR Condition.text)
  category,                -- 'encounter-diagnosis'
  clinical_status,         -- FHIR clinical status (active, inactive, etc.)
  verification_status,     -- FHIR verification status (confirmed, provisional, etc.)
  note                     -- Additional clinical notes
)
```

### Encounters Table
```sql
encounters (
  id,
  treatments,                   -- Non-rich: Simple array of treatment strings
  treatments_rich_content,      -- Rich: Structured JSON with decision trees
  diagnosis_rich_content,       -- Rich: Enhanced markdown with visualizations
  soap_note,                    -- Clinical documentation
  prior_auth_justification      -- Insurance documentation
)
```

## Implementation Details

### Content Generation Process

1. **Non-Rich Content Creation**:
   - `conditions.description` = Plain diagnosis name from AI analysis
   - `encounters.treatments` = Simple string array of treatments

2. **Rich Content Enhancement**:
   - `diagnosis_rich_content` = Markdown with confidence visualizations
   - `treatments_rich_content` = Structured treatment plans with decision trees

3. **FHIR Status Assignment**:
   - Clinical status based on confidence thresholds
   - Verification status for diagnostic certainty levels

### Content Consistency

The system ensures content consistency by:
- Using the same source data for both rich and non-rich versions
- Applying enhanced formatting to rich versions while preserving core information
- Maintaining conceptual linking through encounter relationships
- Adding metadata for traceability and version control

## API Endpoints

### Primary Diagnostic Pipeline
```
POST /api/clinical-engine
```
- Runs full diagnostic pipeline
- Returns structured clinical output package
- Automatically saves both rich and non-rich content

### Differential Diagnoses
```
POST /api/clinical-engine/differential-diagnoses
```
- Generates ranked differential diagnoses
- FHIR-compliant probability assessments

### Treatment Recommendations
```
POST /api/clinical-engine/treatments
```
- Evidence-based treatment planning
- Decision tree generation
- Guidelines integration

## Configuration

### Model Selection
- Model: gpt-6-astra (`GPT_6_ASTRA` in `src/lib/ai/gpt-models.ts`)
- Reasoning effort: low. Astra takes no temperature, and `max_completion_tokens`
  covers its reasoning as well as its answer, so each step's budget has 8,000
  tokens added for the reasoning

### FHIR Compliance Settings
- Clinical status threshold: 0.6 confidence
- Verification status mapping: Confidence-based
- Rich content versioning: Semantic versioning

## Quality Assurance

### Content Validation
- Dual content generation ensures consistency
- FHIR validation for status codes
- Rich content rendering verification

### Clinical Accuracy
- Evidence-based reasoning chains
- Guidelines integration
- Confidence scoring and transparency

## Integration Points

### Frontend Components
- `DifferentialDiagnosesList` - Displays structured diagnosis data
- `TreatmentRenderer` - Renders rich treatment content
- `ConfidenceMeter` - Visualizes diagnostic confidence

### External Services
- **Supabase** - Database persistence with FHIR schema
- **OpenAI** - AI reasoning and content generation
- **Guidelines Service** - Evidence-based recommendations

## Monitoring and Logging

The engine provides comprehensive logging for:
- Content generation status (rich vs non-rich)
- FHIR compliance verification
- AI model performance metrics
- Database operation success/failure

Example log output:
```
✅ Diagnosis Non-Rich: conditions.description (plain text)
✅ Diagnosis Rich: encounters.diagnosis_rich_content (with charts/tables)
✅ Treatment Non-Rich: encounters.treatments (simple array)
✅ Treatment Rich: encounters.treatments_rich_content (structured content)
✅ FHIR Clinical Status: Applied based on confidence (0.85)
```

## Future Enhancements

- **Advanced Visualizations**: 3D diagnostic charts, interactive decision trees
- **Real-time Updates**: Live confidence adjustments based on new data
- **Multi-modal Integration**: Image analysis, lab result interpretation
- **Enhanced FHIR Support**: Full R6 resource compliance, terminologies integration 