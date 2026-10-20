import { PRODUCT_NAME } from '@/lib/brand';
// PDF Generation Utility for Prior Authorization and Referral Forms
// This would typically use a library like jsPDF or PDFKit in a real implementation

export interface PDFGenerationOptions {
  title: string;
  timestamp: string;
  includeForesightBranding?: boolean;
  includeWatermark?: boolean;
  format?: 'A4' | 'Letter';
}

export interface PDFSection {
  title: string;
  content: Array<{
    label: string;
    value: string | string[] | any;
    type?: 'text' | 'list' | 'object' | 'json';
  }>;
}

export class PDFGenerator {
  
  /**
   * Generate PDF for Prior Authorization form
   */
  static async generatePriorAuthPDF(
    formData: any, 
    options: PDFGenerationOptions = {
      title: 'Prior Authorization Request',
      timestamp: new Date().toLocaleString(),
      includeForesightBranding: true
    }
  ): Promise<Blob> {
    
    const sections: PDFSection[] = [
      {
        title: 'Patient Information',
        content: [
          { label: 'Patient Name', value: formData.patientInfo.name },
          { label: 'Date of Birth', value: formData.patientInfo.dateOfBirth },
          { label: 'Gender', value: formData.patientInfo.gender },
          { label: 'Insurance ID', value: formData.patientInfo.insuranceId },
          { label: 'Member ID', value: formData.patientInfo.memberId }
        ]
      },
      {
        title: 'Provider Information',
        content: [
          { label: 'Provider Name', value: formData.providerInfo.name },
          { label: 'NPI Number', value: formData.providerInfo.npi },
          { label: 'Facility', value: formData.providerInfo.facility },
          { label: 'Contact Phone', value: formData.providerInfo.contactPhone },
          { label: 'Contact Email', value: formData.providerInfo.contactEmail }
        ]
      },
      {
        title: 'Service Request',
        content: [
          { label: 'Diagnosis', value: formData.serviceInfo.diagnosis },
          { label: 'ICD-10 Code', value: formData.serviceInfo.diagnosisCode },
          { label: 'Requested Service', value: formData.serviceInfo.requestedService },
          { label: 'Service Code', value: formData.serviceInfo.serviceCode },
          { label: 'Start Date', value: formData.serviceInfo.startDate },
          { label: 'Duration', value: formData.serviceInfo.duration },
          { label: 'Frequency', value: formData.serviceInfo.frequency }
        ]
      },
      {
        title: 'Clinical Justification',
        content: [
          { label: 'Clinical Justification', value: formData.clinicalJustification }
        ]
      },
      {
        title: 'Authorization Details',
        content: [
          { label: 'Authorization Number', value: formData.authorizationDetails.authNumber },
          { label: 'Urgency Level', value: formData.authorizationDetails.urgency },
          { label: 'Supporting Documentation', value: formData.authorizationDetails.supportingDocs, type: 'list' }
        ]
      }
    ];

    return this.generatePDF(sections, options);
  }

  /**
   * Generate PDF for Referral form
   */
  static async generateReferralPDF(
    formData: any,
    options: PDFGenerationOptions = {
      title: 'Specialist Referral',
      timestamp: new Date().toLocaleString(),
      includeForesightBranding: true
    }
  ): Promise<Blob> {
    
    const sections: PDFSection[] = [
      {
        title: 'Patient Information',
        content: [
          { label: 'Patient Name', value: formData.patientInfo.name },
          { label: 'Date of Birth', value: formData.patientInfo.dateOfBirth },
          { label: 'Gender', value: formData.patientInfo.gender },
          { label: 'Contact Phone', value: formData.patientInfo.contactPhone },
          { label: 'Insurance', value: formData.patientInfo.insurance },
          { label: 'Address', value: formData.patientInfo.address }
        ]
      },
      {
        title: 'Referring Provider Information',
        content: [
          { label: 'Provider Name', value: formData.providerInfo.name },
          { label: 'NPI Number', value: formData.providerInfo.npi },
          { label: 'Facility', value: formData.providerInfo.facility },
          { label: 'Contact Phone', value: formData.providerInfo.contactPhone },
          { label: 'Contact Email', value: formData.providerInfo.contactEmail }
        ]
      },
      {
        title: 'Specialist Information',
        content: [
          { label: 'Specialty Type', value: formData.specialistInfo.type },
          { label: 'Preferred Facility', value: formData.specialistInfo.facility },
          { label: 'Preferred Provider', value: formData.specialistInfo.preferredProvider }
        ]
      },
      {
        title: 'Referral Reason',
        content: [
          { label: 'Primary Diagnosis', value: formData.referralReason.diagnosis },
          { label: 'ICD-10 Code', value: formData.referralReason.diagnosisCode },
          { label: 'Reason for Referral', value: formData.referralReason.reasonForReferral },
          { label: 'Urgency Level', value: formData.referralReason.urgency }
        ]
      },
      {
        title: 'Clinical Information',
        content: [
          { label: 'History of Present Illness', value: formData.clinicalInfo.historyOfPresentIllness },
          { label: 'Relevant Past Medical History', value: formData.clinicalInfo.relevantPastMedicalHistory, type: 'list' },
          { label: 'Current Medications', value: formData.clinicalInfo.currentMedications, type: 'list' },
          { label: 'Allergies', value: formData.clinicalInfo.allergies, type: 'list' },
          { label: 'Physical Examination', value: formData.clinicalInfo.physicalExamination },
          { label: 'Vital Signs', value: formData.clinicalInfo.vitalSigns }
        ]
      },
      {
        title: 'Requested Evaluation',
        content: [
          { label: 'Requested Evaluations', value: formData.requestedEvaluation, type: 'list' }
        ]
      },
      {
        title: 'Additional Information',
        content: [
          { label: 'Additional Notes', value: formData.additionalNotes }
        ]
      }
    ];

    return this.generatePDF(sections, options);
  }

  /**
   * Core PDF generation function
   * In a real implementation, this would use a proper PDF library
   */
  private static async generatePDF(
    sections: PDFSection[], 
    options: PDFGenerationOptions
  ): Promise<Blob> {
    
    // This is a simplified implementation that generates HTML and converts to PDF
    // In production, you would use jsPDF, PDFKit, or similar library
    
    const htmlContent = this.generateHTMLContent(sections, options);
    
    // Create blob with HTML content that looks like a PDF
    // In production, this would be converted to actual PDF
    const blob = new Blob([htmlContent], { type: 'text/html' });
    
    // Return the blob for the client to handle download
    return blob;
  }

  /**
   * Generate HTML content for PDF
   */
  private static generateHTMLContent(sections: PDFSection[], options: PDFGenerationOptions): string {
    const foresightBranding = options.includeForesightBranding ? `
      <div style="display: flex; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="#1C211F" style="margin-right: 12px;" aria-hidden="true"><rect x="3" y="12.5" width="4" height="7" rx="2"/><rect x="8.5" y="12.5" width="4" height="7" rx="2"/><rect x="14" y="3" width="4" height="26" rx="2"/><rect x="19.5" y="12.5" width="4" height="7" rx="2"/><rect x="25" y="12.5" width="4" height="7" rx="2"/></svg>
        <div>
          <div style="font-size: 20px; color: #1C211F; font-family: Georgia, serif;">${PRODUCT_NAME}</div>
          <div style="font-size: 12px; color: #6b7280;">Clinical Decision Support System</div>
        </div>
      </div>
    ` : '';

    const sectionsHTML = sections.map(section => `
      <div style="margin-bottom: 30px;">
        <h2 style="font-size: 18px; font-weight: bold; color: #1f2937; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 1px solid #e5e7eb;">${section.title}</h2>
        <div style="margin-left: 20px;">
          ${section.content.map(item => this.formatContentItem(item)).join('')}
        </div>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${options.title}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            background-color: white;
            color: #1f2937;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
          }
          .timestamp {
            color: #6b7280;
            font-size: 12px;
            margin-bottom: 20px;
          }
          @media print {
            body { margin: 0; padding: 20px; }
          }
        </style>
      </head>
      <body>
        ${foresightBranding}
        <div class="header">
          <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 10px; color: #1f2937;">${options.title}</h1>
          <div class="timestamp">Generated on ${options.timestamp}</div>
        </div>
        ${sectionsHTML}
        <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 10px;">
          This document was generated by ${PRODUCT_NAME}. For questions, please contact your healthcare provider.
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Format individual content items
   */
  private static formatContentItem(item: any): string {
    const value = item.value;
    
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return `
        <div style="margin-bottom: 15px;">
          <strong style="color: #374151;">${item.label}:</strong>
          <span style="color: #9ca3af; font-style: italic; margin-left: 10px;">Not provided</span>
        </div>
      `;
    }

    if (item.type === 'list' && Array.isArray(value)) {
      const listItems = value.map(v => `<li style="margin-bottom: 5px;">${v}</li>`).join('');
      return `
        <div style="margin-bottom: 15px;">
          <strong style="color: #374151;">${item.label}:</strong>
          <ul style="margin: 8px 0 0 20px; padding: 0;">
            ${listItems}
          </ul>
        </div>
      `;
    }

    if (item.type === 'json' || item.type === 'object') {
      return `
        <div style="margin-bottom: 15px;">
          <strong style="color: #374151;">${item.label}:</strong>
          <pre style="background-color: #f9fafb; padding: 10px; border-radius: 6px; margin: 8px 0; font-size: 12px; overflow-x: auto;">${JSON.stringify(value, null, 2)}</pre>
        </div>
      `;
    }

    return `
      <div style="margin-bottom: 15px;">
        <strong style="color: #374151;">${item.label}:</strong>
        <span style="margin-left: 10px;">${value}</span>
      </div>
    `;
  }

  /**
   * Download blob as file (client-side download)
   */
  static downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generate FHIR-compliant JSON export
   */
  static generateFHIRExport(fhirData: any, filename: string): void {
    const jsonString = JSON.stringify(fhirData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    this.downloadBlob(blob, filename.replace(/\.(html|pdf)$/, '.json'));
  }
} 