import { DifferentialDiagnosis, DifferentialDiagnosisRecord } from './types';

export type LikelihoodCategory = "Negligible" | "Low" | "Moderate" | "High" | "Certain";

export const getLikelihoodCategory = (probabilityDecimal: number): LikelihoodCategory => {
  if (probabilityDecimal < 1) return "Negligible";
  if (probabilityDecimal >= 1 && probabilityDecimal < 10) return "Low";
  if (probabilityDecimal >= 10 && probabilityDecimal < 40) return "Moderate";
  if (probabilityDecimal >= 40 && probabilityDecimal < 70) return "High";
  return "Certain";
};

// This function can be used when a user selects a category and we need to store a representative decimal.
// We are using the lower bound of each category's range.
export const getDecimalForCategory = (category: LikelihoodCategory): number => {
    switch (category) {
        case "Certain":
            return 70;
        case "High":
            return 40;
        case "Moderate":
            return 10;
        case "Low":
            return 1;
        case "Negligible":
            return 0;
        default:
            return 0;
    }
}


// This function will help transition from the old data model to the new one.
// It will take a diagnosis record from the DB and map it to the new frontend object.
export const mapDiagnosisRecordToDifferentialDiagnosis = (record: DifferentialDiagnosisRecord): DifferentialDiagnosis => {
  // The likelihood column holds a category ("High") or, from the seed, a
  // percentage ("30.0"); read either.
  const numeric = Number(record.likelihood);
  const isNumber = record.likelihood !== null && record.likelihood !== '' && Number.isFinite(numeric);
  const qualitativeRisk = isNumber ? getLikelihoodCategory(numeric) : (record.likelihood as LikelihoodCategory);
  const probabilityDecimal = isNumber ? numeric : getDecimalForCategory(qualitativeRisk);

  return {
    name: record.diagnosis_name,
    rank: record.rank_order,
    probabilityDecimal: probabilityDecimal,
    qualitativeRisk: qualitativeRisk,
    keyFactors: record.key_factors || '',
    
    // Properties that may not exist in every record
    // explanation: record.explanation,
    // supportingEvidence: record.supporting_evidence,
    // icdCodes: record.icd_codes,
    // dontMiss: record.dont_miss,
    // confidenceWarning: record.confidence_warning,
    // missingAlternativeAlert: record.missing_alternative_alert,
    
    // For backward compatibility during refactoring
    likelihood: qualitativeRisk,
    likelihoodPercentage: probabilityDecimal
  };
}; 