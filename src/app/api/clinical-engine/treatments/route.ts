import { NextRequest, NextResponse } from 'next/server';
import { clinicalEngineServiceV3 } from '@/lib/clinicalEngineServiceV3';
import { openAIKeyMissingResponse } from '@/lib/serverGuards';

export async function POST(request: NextRequest) {
  const noKey = openAIKeyMissingResponse();
  if (noKey) return noKey;
  try {
    const { patientData, transcript, diagnosis } = await request.json();

    if (!patientData || !diagnosis) {
      return NextResponse.json(
        { error: 'Patient data and diagnosis are required' },
        { status: 400 }
      );
    }

    // Generate treatment plan using the clinical engine
    const treatmentResult = await (clinicalEngineServiceV3 as any).generateTreatmentPlan(
      patientData,
      transcript || '',
      diagnosis
    );

    return NextResponse.json({
      success: true,
      treatments: treatmentResult
    });

  } catch (error) {
    console.error('Error in treatment generation:', error);
    return NextResponse.json(
      { error: 'Failed to generate treatment plan' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Treatment generation endpoint',
    methods: ['POST'],
    description: 'Generate treatment plans with decision trees based on established diagnosis'
  });
} 