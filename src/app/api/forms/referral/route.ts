import { NextRequest, NextResponse } from 'next/server';
import { ReferralService } from '@/lib/forms/referralService';
import { PDFGenerator } from '@/lib/forms/pdfGenerator';
import { PRODUCT_NAME } from '@/lib/brand';

export async function POST(request: NextRequest) {
  try {
    const { action, formData } = await request.json();

    switch (action) {
      case 'validate':
        const validation = ReferralService.validateForm(formData);
        return NextResponse.json(validation);

      case 'save':
        // In a real implementation, this would save to database
        // For now, we'll just return success
        return NextResponse.json({ 
          success: true, 
          message: 'Referral form saved successfully' 
        });

      case 'generate-pdf':
        const pdfData = ReferralService.preparePDFData(formData);
        
        // Generate PDF (in this implementation, it's an HTML file)
        const blob = await PDFGenerator.generateReferralPDF(pdfData);
        
        // Convert blob to base64 for transmission
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        
        return NextResponse.json({ 
          success: true, 
          message: 'PDF generated successfully',
          pdfData: base64,
          filename: `Referral_${Date.now()}.html`,
          mimeType: 'text/html',
          fhirData: ReferralService.toFHIRFormat(formData)
        });

      case 'export-fhir':
        const fhirData = ReferralService.toFHIRFormat(formData);
        return NextResponse.json({
          success: true,
          fhirData,
          message: 'FHIR data exported successfully'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action specified' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Referral API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const encounterId = searchParams.get('encounterId');

    if (!patientId || !encounterId) {
      return NextResponse.json(
        { error: 'Patient ID and Encounter ID are required' },
        { status: 400 }
      );
    }

    // In a real implementation, this would fetch from database
    // For now, return empty form structure
    return NextResponse.json({
      success: true,
      message: 'Referral form template retrieved',
      template: {
        resourceType: 'ServiceRequest',
        patientInformation: {
          name: '',
          dateOfBirth: '',
          gender: '',
          contactPhone: '',
          insurance: '',
          address: ''
        },
        referringProvider: {
          name: '',
          npi: '',
          facility: PRODUCT_NAME,
          contactPhone: '',
          contactEmail: ''
        },
        specialist: {
          type: '',
          facility: '',
          preferredProvider: ''
        },
        referralReason: {
          diagnosis: '',
          diagnosisCode: '',
          reasonForReferral: '',
          urgency: 'routine'
        },
        clinicalInformation: {
          historyOfPresentIllness: '',
          relevantPastMedicalHistory: [],
          currentMedications: [],
          allergies: [],
          physicalExamination: '',
          recentLabResults: [],
          vitalSigns: ''
        },
        requestedEvaluation: [
          'Initial consultation',
          'Diagnostic evaluation',
          'Treatment recommendations'
        ],
        additionalNotes: ''
      }
    });
  } catch (error) {
    console.error('Referral GET API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 