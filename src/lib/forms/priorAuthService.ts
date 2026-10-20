import { Patient, Encounter, Diagnosis, PriorAuthFormData, FHIRResourceType, FormValidationResult } from '@/lib/types';
import { PRODUCT_NAME } from '@/lib/brand';

// FHIR Resource Types for Prior Authorization
export const PRIOR_AUTH_RESOURCE_TYPES: FHIRResourceType[] = [
  {
    value: 'Claim',
    label: 'Claim',
    description: 'Standard prior authorization claim request'
  },
  {
    value: 'CoverageEligibilityRequest',
    label: 'Coverage Eligibility Request',
    description: 'Request for coverage eligibility verification'
  },
  {
    value: 'ServiceRequest',
    label: 'Service Request',
    description: 'Request for specific medical services'
  }
];

export class PriorAuthService {
  
  /**
   * Auto-populate prior authorization form from encounter data
   */
  static autoPopulateForm(
    patient: Patient,
    encounter: Encounter,
    diagnoses: Diagnosis[],
    resourceType: string = 'Claim'
  ): PriorAuthFormData {
    // Ensure inputs are arrays to prevent map errors
    const safeDiagnoses = Array.isArray(diagnoses) ? diagnoses : [];
    
    // Use standard treatments field from encounters table (non-enriched)
    const safeTreatments = Array.isArray(encounter?.treatments) ? encounter.treatments : [];

    return {
      resourceType,
      patientInformation: {
        name: patient.name || `${patient.firstName} ${patient.lastName}`.trim(),
        dateOfBirth: patient.dateOfBirth || '',
        gender: patient.gender || '',
        insuranceId: encounter.insuranceStatus || '',
        memberId: patient.id
      },
      providerInformation: {
        name: '', // Placeholder - not available in current system
        npi: '', // Placeholder - not available in current system
        facility: PRODUCT_NAME, // Default facility
        contactPhone: '', // Placeholder
        contactEmail: '' // Placeholder
      },
      serviceRequest: {
        diagnosis: safeDiagnoses[0]?.description || encounter.reasonDisplayText || encounter.reasonCode || '',
        diagnosisCode: safeDiagnoses[0]?.code || '', // Use diagnosis code from conditions table
        requestedService: safeTreatments[0]?.drug || 'Proposed Treatment',
        serviceCode: '', // Placeholder for manual input
        startDate: new Date().toISOString().split('T')[0],
        duration: '30 days', // Default duration
        frequency: safeTreatments[0]?.status || 'As prescribed'
      },
      clinicalJustification: encounter.priorAuthJustification || encounter.reasonDisplayText || encounter.reasonCode || '',
      authorizationNumber: '', // Placeholder - manual input required
      urgencyLevel: 'routine', // Default urgency
      supportingDocumentation: []
    };
  }

  /**
   * Validate prior authorization form data
   */
  static validateForm(formData: PriorAuthFormData): FormValidationResult {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    // Required field validation
    if (!formData.patientInformation.name.trim()) {
      errors.patientName = 'Patient name is required';
    }
    
    if (!formData.patientInformation.dateOfBirth) {
      errors.dateOfBirth = 'Date of birth is required';
    }

    if (!formData.serviceRequest.diagnosis.trim()) {
      errors.diagnosis = 'Diagnosis is required';
    }

    if (!formData.serviceRequest.requestedService.trim()) {
      errors.requestedService = 'Requested service/medication is required';
    }

    if (!formData.clinicalJustification.trim()) {
      errors.clinicalJustification = 'Clinical justification is required';
    }

    // Warning validation
    if (!formData.providerInformation.name.trim()) {
      warnings.providerName = 'Provider name should be filled for complete submission';
    }

    if (!formData.providerInformation.npi.trim()) {
      warnings.providerNPI = 'Provider NPI should be provided when available';
    }

    if (!formData.serviceRequest.serviceCode.trim()) {
      warnings.serviceCode = 'Service code enhances processing efficiency';
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
  static toFHIRFormat(formData: PriorAuthFormData): any {
    const baseResource = {
      resourceType: formData.resourceType,
      id: `prior-auth-${Date.now()}`,
      status: 'active',
      created: new Date().toISOString(),
      patient: {
        reference: `Patient/${formData.patientInformation.memberId}`,
        display: formData.patientInformation.name
      }
    };

    switch (formData.resourceType) {
      case 'Claim':
        return {
          ...baseResource,
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/claim-type',
              code: 'professional'
            }]
          },
          use: 'preauthorization',
          priority: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/processpriority',
              code: formData.urgencyLevel
            }]
          },
          diagnosis: [{
            sequence: 1,
            diagnosisCodeableConcept: {
              coding: [{
                system: 'http://hl7.org/fhir/sid/icd-10-cm',
                code: formData.serviceRequest.diagnosisCode,
                display: formData.serviceRequest.diagnosis
              }]
            }
          }],
          item: [{
            sequence: 1,
            productOrService: {
              text: formData.serviceRequest.requestedService
            },
            category: {
              coding: [{
                system: 'https://terminology.hl7.org/CodeSystem/ex-benefitcategory',
                code: 'medical'
              }]
            }
          }]
        };

      case 'ServiceRequest':
        return {
          ...baseResource,
          intent: 'order',
          code: {
            text: formData.serviceRequest.requestedService
          },
          reasonCode: [{
            coding: [{
              system: 'http://hl7.org/fhir/sid/icd-10-cm',
              code: formData.serviceRequest.diagnosisCode,
              display: formData.serviceRequest.diagnosis
            }]
          }],
          note: [{
            text: formData.clinicalJustification
          }]
        };

      default:
        return baseResource;
    }
  }

  /**
   * Generate structured data for PDF generation
   */
  static preparePDFData(formData: PriorAuthFormData): any {
    return {
      title: `Prior Authorization Request - ${formData.resourceType}`,
      timestamp: new Date().toLocaleString(),
      patientInfo: formData.patientInformation,
      providerInfo: formData.providerInformation,
      serviceInfo: formData.serviceRequest,
      clinicalJustification: formData.clinicalJustification,
      authorizationDetails: {
        authNumber: formData.authorizationNumber,
        urgency: formData.urgencyLevel,
        supportingDocs: formData.supportingDocumentation
      },
      fhirCompliantData: this.toFHIRFormat(formData)
    };
  }
} 