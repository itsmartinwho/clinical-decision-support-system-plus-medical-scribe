import { Patient, Encounter, Diagnosis, LabResult, ReferralFormData, FHIRResourceType, FormValidationResult } from '@/lib/types';
import { PRODUCT_NAME } from '@/lib/brand';

// FHIR Resource Types for Referrals
export const REFERRAL_RESOURCE_TYPES: FHIRResourceType[] = [
  {
    value: 'ServiceRequest',
    label: 'Service Request',
    description: 'Standard referral for specialist consultation'
  },
  {
    value: 'Task',
    label: 'Task',
    description: 'Task-based referral with specific actions'
  },
  {
    value: 'Appointment',
    label: 'Appointment',
    description: 'Direct appointment scheduling referral'
  }
];

// Common specialty types for referrals
export const SPECIALTY_TYPES = [
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'Hematology',
  'Neurology',
  'Oncology',
  'Orthopedics',
  'Psychiatry',
  'Pulmonology',
  'Rheumatology',
  'Urology',
  'Ophthalmology',
  'ENT (Otolaryngology)',
  'Nephrology',
  'Emergency Medicine',
  'Other'
];

export class ReferralService {
  
  /**
   * Auto-populate referral form from encounter data
   */
  static autoPopulateForm(
    patient: Patient,
    encounter: Encounter,
    diagnoses: Diagnosis[],
    labResults: LabResult[] = [],
    resourceType: string = 'ServiceRequest'
  ): ReferralFormData {
    // Ensure inputs are arrays to prevent map errors
    const safeDiagnoses = Array.isArray(diagnoses) ? diagnoses : [];
    const safeLabResults = Array.isArray(labResults) ? labResults : [];
    
    // Use standard treatments field from encounters table (non-enriched)
    const safeTreatments = Array.isArray(encounter?.treatments) ? encounter.treatments : [];

    return {
      resourceType,
      patientInformation: {
        name: patient.name || `${patient.firstName} ${patient.lastName}`.trim(),
        dateOfBirth: patient.dateOfBirth || '',
        gender: patient.gender || '',
        contactPhone: '', // Not available in current patient model
        insurance: encounter.insuranceStatus || '',
        address: '' // Not available in current patient model
      },
      referringProvider: {
        name: '', // Placeholder - not available in current system
        npi: '', // Placeholder - not available in current system
        facility: PRODUCT_NAME, // Default facility
        contactPhone: '', // Placeholder
        contactEmail: '' // Placeholder
      },
      specialist: {
        type: '', // Manual input required
        facility: '', // Manual input required
        preferredProvider: '' // Manual input required
      },
      referralReason: {
        diagnosis: safeDiagnoses[0]?.description || encounter.reasonDisplayText || encounter.reasonCode || '',
        diagnosisCode: safeDiagnoses[0]?.code || '', // Use diagnosis code from conditions table
        reasonForReferral: encounter.reasonDisplayText || encounter.reasonCode || '',
        urgency: 'routine' // Default urgency
      },
      clinicalInformation: {
        historyOfPresentIllness: encounter.reasonDisplayText || encounter.reasonCode || '',
        relevantPastMedicalHistory: [], // Not available in current system
        currentMedications: safeTreatments.map(t => t.drug).filter(Boolean),
        allergies: [], // Not available in current patient model
        physicalExamination: encounter.observations?.join(', ') || '',
        recentLabResults: safeLabResults,
        vitalSigns: '' // Not available in current system
      },
      requestedEvaluation: [], // Manual input required
      additionalNotes: encounter.soapNote || ''
    };
  }

  /**
   * Suggest specialty based on diagnosis
   */
  private static suggestSpecialty(diagnosis: string): string {
    const diagnosisLower = diagnosis.toLowerCase();
    
    if (diagnosisLower.includes('heart') || diagnosisLower.includes('cardiac') || diagnosisLower.includes('hypertension')) {
      return 'Cardiology';
    }
    if (diagnosisLower.includes('skin') || diagnosisLower.includes('rash') || diagnosisLower.includes('dermat')) {
      return 'Dermatology';
    }
    if (diagnosisLower.includes('diabetes') || diagnosisLower.includes('thyroid') || diagnosisLower.includes('endocrin')) {
      return 'Endocrinology';
    }
    if (diagnosisLower.includes('stomach') || diagnosisLower.includes('gastro') || diagnosisLower.includes('digestive')) {
      return 'Gastroenterology';
    }
    if (diagnosisLower.includes('brain') || diagnosisLower.includes('neuro') || diagnosisLower.includes('seizure')) {
      return 'Neurology';
    }
    if (diagnosisLower.includes('cancer') || diagnosisLower.includes('tumor') || diagnosisLower.includes('oncology')) {
      return 'Oncology';
    }
    if (diagnosisLower.includes('bone') || diagnosisLower.includes('joint') || diagnosisLower.includes('orthopedic')) {
      return 'Orthopedics';
    }
    if (diagnosisLower.includes('depression') || diagnosisLower.includes('anxiety') || diagnosisLower.includes('psychiatric')) {
      return 'Psychiatry';
    }
    if (diagnosisLower.includes('lung') || diagnosisLower.includes('respiratory') || diagnosisLower.includes('asthma')) {
      return 'Pulmonology';
    }
    if (diagnosisLower.includes('eye') || diagnosisLower.includes('vision') || diagnosisLower.includes('ophthalm')) {
      return 'Ophthalmology';
    }
    if (diagnosisLower.includes('kidney') || diagnosisLower.includes('renal') || diagnosisLower.includes('nephro')) {
      return 'Nephrology';
    }
    
    return 'Other'; // Default when no match
  }

  /**
   * Validate referral form data
   */
  static validateForm(formData: ReferralFormData): FormValidationResult {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    // Required field validation
    if (!formData.patientInformation.name.trim()) {
      errors.patientName = 'Patient name is required';
    }
    
    if (!formData.patientInformation.dateOfBirth) {
      errors.dateOfBirth = 'Date of birth is required';
    }

    if (!formData.referralReason.diagnosis.trim()) {
      errors.diagnosis = 'Diagnosis is required';
    }

    if (!formData.referralReason.reasonForReferral.trim()) {
      errors.reasonForReferral = 'Reason for referral is required';
    }

    if (!formData.specialist.type.trim()) {
      errors.specialtyType = 'Specialty type is required';
    }

    // Warning validation
    if (!formData.referringProvider.name.trim()) {
      warnings.providerName = 'Referring provider name should be filled for complete submission';
    }

    if (!formData.referringProvider.npi.trim()) {
      warnings.providerNPI = 'Provider NPI should be provided when available';
    }

    if (!formData.specialist.facility.trim()) {
      warnings.specialistFacility = 'Preferred specialist facility enhances referral processing';
    }

    if (!formData.clinicalInformation.historyOfPresentIllness.trim()) {
      warnings.clinicalHistory = 'Clinical history provides important context for the specialist';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings
    };
  }

  /**
   * Convert form data to FHIR-compliant format
   */
  static toFHIRFormat(formData: ReferralFormData): any {
    const baseResource = {
      resourceType: formData.resourceType,
      id: `referral-${Date.now()}`,
      status: 'active',
      created: new Date().toISOString(),
      subject: {
        reference: `Patient/${formData.patientInformation.name.replace(/\s+/g, '-').toLowerCase()}`,
        display: formData.patientInformation.name
      }
    };

    switch (formData.resourceType) {
      case 'ServiceRequest':
        return {
          ...baseResource,
          intent: 'order',
          category: [{
            coding: [{
              system: 'http://snomed.info/sct',
              code: '103696004',
              display: 'Patient referral to specialist'
            }]
          }],
          code: {
            text: `${formData.specialist.type} consultation`
          },
          reasonCode: [{
            coding: [{
              system: 'http://hl7.org/fhir/sid/icd-10-cm',
              code: formData.referralReason.diagnosisCode,
              display: formData.referralReason.diagnosis
            }]
          }],
          reasonReference: [{
            display: formData.referralReason.reasonForReferral
          }],
          note: [{
            text: this.formatClinicalNotes(formData)
          }],
          priority: formData.referralReason.urgency
        };

      case 'Task':
        return {
          ...baseResource,
          intent: 'order',
          code: {
            text: `Referral to ${formData.specialist.type}`
          },
          description: formData.referralReason.reasonForReferral,
          focus: {
            display: formData.referralReason.diagnosis
          }
        };

      case 'Appointment':
        return {
          ...baseResource,
          serviceCategory: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/service-category',
              code: 'specialist',
              display: 'Specialist'
            }]
          }],
          serviceType: [{
            text: formData.specialist.type
          }],
          reasonCode: [{
            text: formData.referralReason.diagnosis
          }],
          comment: formData.referralReason.reasonForReferral
        };

      default:
        return baseResource;
    }
  }

  /**
   * Format clinical notes for FHIR
   */
  private static formatClinicalNotes(formData: ReferralFormData): string {
    const notes = [];
    
    if (formData.clinicalInformation.historyOfPresentIllness) {
      notes.push(`History of Present Illness: ${formData.clinicalInformation.historyOfPresentIllness}`);
    }
    
    if (formData.clinicalInformation.relevantPastMedicalHistory.length > 0) {
      notes.push(`Past Medical History: ${formData.clinicalInformation.relevantPastMedicalHistory.join(', ')}`);
    }
    
    if (formData.clinicalInformation.currentMedications.length > 0) {
      notes.push(`Current Medications: ${formData.clinicalInformation.currentMedications.join(', ')}`);
    }
    
    if (formData.clinicalInformation.allergies.length > 0) {
      notes.push(`Allergies: ${formData.clinicalInformation.allergies.join(', ')}`);
    }
    
    if (formData.clinicalInformation.physicalExamination) {
      notes.push(`Physical Examination: ${formData.clinicalInformation.physicalExamination}`);
    }
    
    if (formData.clinicalInformation.vitalSigns) {
      notes.push(`Vital Signs: ${formData.clinicalInformation.vitalSigns}`);
    }

    if (formData.requestedEvaluation.length > 0) {
      notes.push(`Requested Evaluation: ${formData.requestedEvaluation.join(', ')}`);
    }
    
    if (formData.additionalNotes) {
      notes.push(`Additional Notes: ${formData.additionalNotes}`);
    }
    
    return notes.join('\n\n');
  }

  /**
   * Generate structured data for PDF generation
   */
  static preparePDFData(formData: ReferralFormData): any {
    return {
      title: `Referral Request - ${formData.resourceType}`,
      timestamp: new Date().toLocaleString(),
      patientInfo: formData.patientInformation,
      providerInfo: formData.referringProvider,
      specialistInfo: formData.specialist,
      referralReason: formData.referralReason,
      clinicalInfo: formData.clinicalInformation,
      requestedEvaluation: formData.requestedEvaluation,
      additionalNotes: formData.additionalNotes,
      fhirCompliantData: this.toFHIRFormat(formData)
    };
  }
} 