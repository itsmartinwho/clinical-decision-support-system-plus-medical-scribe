import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabaseClient';
import { supabaseDataService } from '@/lib/supabaseDataService';

// The browser edits differentials through this route, so it runs as the anon
// role like the rest of the client: row level security decides what it may do
// (see the differential_diagnoses policies). It must not use the service role,
// which would let anyone who can reach the route bypass them.

// GET: Fetch differential diagnoses for a specific encounter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const encounterId = searchParams.get('encounterId');

    if (!patientId) {
      return NextResponse.json(
        { error: 'Missing required parameter: patientId' },
        { status: 400 }
      );
    }

    console.log('[Differential Diagnoses API] Fetching for:', { patientId, encounterId });

    // Use the appropriate method to get differential diagnoses for the specific patient
    let filteredDiagnoses;
    if (encounterId) {
      // Get differential diagnoses for specific encounter
      filteredDiagnoses = supabaseDataService.getDifferentialDiagnosesForEncounter(patientId, encounterId);

      // Fallback: if cache not yet loaded or empty, query Supabase directly
      if (!filteredDiagnoses || filteredDiagnoses.length === 0) {
        const { data: directDiffs, error: diffErr } = await getSupabaseClient()
          .from('differential_diagnoses')
          .select('*')
          .eq('encounter_id', encounterId);

        if (!diffErr && directDiffs) {
          filteredDiagnoses = directDiffs;
        }
      }
    } else {
      // Get all differential diagnoses for the patient (cache)
      filteredDiagnoses = supabaseDataService.getPatientDifferentialDiagnoses(patientId);
    }

    console.log('[Differential Diagnoses API] Found diagnoses:', filteredDiagnoses.length);

    return NextResponse.json({
      success: true,
      differentialDiagnoses: filteredDiagnoses,
      total: filteredDiagnoses.length
    });

  } catch (error) {
    console.error('[Differential Diagnoses API] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      },
      { status: 500 }
    );
  }
}

// POST: Create a new differential diagnosis
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, encounterId, diagnosis } = body;

    if (!patientId || !diagnosis) {
      return NextResponse.json(
        { error: 'Missing required parameters: patientId, diagnosis' },
        { status: 400 }
      );
    }

    console.log('[Differential Diagnoses API] Creating diagnosis for:', { patientId, encounterId });

    // For now, return a mock response since this is primarily used in demo mode
    const newDiagnosis = {
      id: `diff-diag-${Date.now()}`,
      patientId,
      encounterId,
      diagnosis: diagnosis.name || diagnosis,
      confidence: diagnosis.confidence || 0.8,
      supportingEvidence: diagnosis.supportingEvidence || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      differentialDiagnosis: newDiagnosis
    });

  } catch (error) {
    console.error('[Differential Diagnoses API] Error creating diagnosis:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create differential diagnosis', 
        details: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      },
      { status: 500 }
    );
  }
}

// PUT: Update an existing differential diagnosis
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, diagnosisName, qualitativeRisk, keyFactors, rankOrder } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (diagnosisName !== undefined) updateData.diagnosis_name = diagnosisName;
    if (qualitativeRisk !== undefined) updateData.likelihood = qualitativeRisk;
    if (keyFactors !== undefined) updateData.key_factors = keyFactors;
    if (rankOrder !== undefined) updateData.rank_order = rankOrder;

    const { data: updatedDiagnosis, error } = await getSupabaseClient()
      .from('differential_diagnoses')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating differential diagnosis:', error);
      return NextResponse.json(
        { error: 'Failed to update differential diagnosis' },
        { status: 500 }
      );
    }

    if (!updatedDiagnosis) {
      return NextResponse.json(
        { error: 'Differential diagnosis not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      differentialDiagnosis: updatedDiagnosis,
      message: 'Differential diagnosis updated successfully'
    });
  } catch (error) {
    console.error('Error in PUT /api/differential-diagnoses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a differential diagnosis
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    const { error } = await getSupabaseClient()
      .from('differential_diagnoses')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting differential diagnosis:', error);
      return NextResponse.json(
        { error: 'Failed to delete differential diagnosis' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Differential diagnosis deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/differential-diagnoses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 