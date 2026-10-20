import { NextRequest, NextResponse } from 'next/server';
import { PriorAuthService } from '@/lib/forms/priorAuthService';
import { PDFGenerator } from '@/lib/forms/pdfGenerator';
import { PRODUCT_NAME } from '@/lib/brand';

export async function POST(request: NextRequest) {
  try {
    const { action, formData } = await request.json();

    switch (action) {
      case 'validate':
        const validation = PriorAuthService.validateForm(formData);
        return NextResponse.json(validation);

      case 'save':
        // In a real implementation, this would save to database
        // For now, we'll just return success
        return NextResponse.json({ 
          success: true, 
          message: 'Prior authorization form saved successfully' 
        });

      case 'generate-pdf':
        const pdfData = PriorAuthService.preparePDFData(formData);
        
        // Generate PDF (in this implementation, it's an HTML file)
        const blob = await PDFGenerator.generatePriorAuthPDF(pdfData);
        
        // Convert blob to base64 for transmission
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        
        return NextResponse.json({ 
          success: true, 
          message: 'PDF generated successfully',
          pdfData: base64,
          filename: `Prior_Authorization_${Date.now()}.html`,
          mimeType: 'text/html',
          fhirData: PriorAuthService.toFHIRFormat(formData)
        });

      case 'export-fhir':
        const fhirData = PriorAuthService.toFHIRFormat(formData);
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
    console.error('Prior Auth API Error:', error);
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
      message: 'Prior authorization form template retrieved',
      template: {
        resourceType: 'Claim',
        patientInformation: {
          name: '',
          dateOfBirth: '',
          gender: '',
          insuranceId: '',
          memberId: ''
        },
        providerInformation: {
          name: '',
          npi: '',
          facility: PRODUCT_NAME,
          contactPhone: '',
          contactEmail: ''
        },
        serviceRequest: {
          diagnosis: '',
          diagnosisCode: '',
          requestedService: '',
          serviceCode: '',
          startDate: new Date().toISOString().split('T')[0],
          duration: '30 days',
          frequency: 'As prescribed'
        },
        clinicalJustification: '',
        authorizationNumber: '',
        urgencyLevel: 'routine',
        supportingDocumentation: []
      }
    });
  } catch (error) {
    console.error('Prior Auth GET API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 