import { NextRequest, NextResponse } from 'next/server';
import { ClinicalEngineServiceV3 } from '@/lib/clinicalEngineServiceV3';
import { DifferentialDiagnosis } from '@/lib/types';
import { openAIKeyMissingResponse } from '@/lib/serverGuards';

export async function POST(request: NextRequest) {
  const noKey = openAIKeyMissingResponse();
  if (noKey) return noKey;
  try {
    const { patientId, encounterId, transcript, patientData } = await request.json();

    if (!patientId || !encounterId) {
      return NextResponse.json(
        { error: 'Missing required parameters: patientId and encounterId' },
        { status: 400 }
      );
    }

    console.log(`Differential diagnosis request: patient ${patientId}, encounter ${encounterId}`);

    const engine = new ClinicalEngineServiceV3();
    
    // If patientData is provided directly, use it; otherwise load from service
    let finalPatientData = patientData;
    if (!finalPatientData) {
      const { supabaseDataService } = await import('@/lib/supabaseDataService');
      finalPatientData = await supabaseDataService.getPatientData(patientId);
    }

    // Generate only differential diagnoses
    const differentialDiagnoses: DifferentialDiagnosis[] = await (engine as any).generateDifferentialDiagnoses(
      finalPatientData,
      transcript || ''
    );

    console.log(`Differential diagnoses generated for patient ${patientId}`);
    return NextResponse.json({ 
      differentialDiagnoses,
      patientId,
      encounterId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Differential diagnosis generation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate differential diagnoses', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 