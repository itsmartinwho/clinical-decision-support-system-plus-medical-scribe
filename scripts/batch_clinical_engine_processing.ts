/*
Batch Clinical Engine Processing Script

Description:
This script identifies patients with clinical transcripts but minimal existing clinical results
(e.g., short or missing differential diagnoses, encounter diagnoses). For each identified
encounter, it calls the clinical engine API to generate comprehensive clinical results,
which are then automatically saved to the database by the backend services. The script
includes rate limiting, retry logic for API calls, and verification steps to check if
data was created.

Environment Variables:
Create a .env.local file in the root of your project with the following variables:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
API_BASE_URL=your_api_base_url (e.g., http://localhost:3000)

Running the Script:
Ensure you have Node.js and npm/yarn installed. Install dependencies if needed (e.g., @supabase/supabase-js, dotenv, typescript, ts-node).
Run the script from the project root using:
npx ts-node scripts/batch_clinical_engine_processing.ts

What to Check:
1. Console Output:
   - Watch for logs indicating the number of encounters fetched.
   - Monitor the progress for each encounter (API calls, retries, verification steps).
   - Check for any error messages.
   - Review the final summary for counts of processed encounters, successful API calls, and verified data.

2. Supabase Dashboard:
   - After the script (or a portion of it) runs, check the `conditions` table for new records
     with `category = 'encounter-diagnosis'` for the processed encounters.
   - Check the `differential_diagnoses` table for new records associated with the processed encounters.
   - Verify that the data seems consistent with what the clinical engine should generate.

Important Considerations:
- SQL Function: This script relies on a PostgreSQL function `get_patients_for_clinical_engine()`
  being present in your Supabase database. The definition for this function is provided in a
  comment block within this script. Ensure it's created via a migration.
- Rate Limiting: The script has a 1-second delay between API calls to avoid overwhelming the
  clinical engine or external services like OpenAI if it's used by the engine.
- Data Modification: The clinical engine API calls are expected to save new data. This script
  primarily triggers that process and verifies its occurrence. It does not directly modify
  existing clinical records beyond what the engine does.
*/
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Initialize dotenv to load environment variables from .env.local
// Ensure this path is correct for your project structure.
// If .env.local is at the root, and scripts is a subdirectory, this might need adjustment
// or rely on the script being run from the root directory.
// For now, assuming '.env.local' is discoverable from where the script is run.
dotenv.config({ path: process.cwd() + '/.env.local' }); // More robust path

// Define a type for our Supabase client instance
let supabase: SupabaseClient;

// Define an interface for the data returned by the RPC function
interface EncounterToProcess {
  patient_id: string;
  first_name: string;
  last_name: string;
  encounter_uuid: string; // This is e.id from the SQL
  encounter_id: string; // This is e.encounter_id from the SQL
  transcript: string; // Added this, as it's needed for the API call later and is in the SQL select
  transcript_length: number;
  diff_dx_count: number;
  conditions_count: number;
}

/*
  NOTE: The following SQL function needs to be created in your Supabase database
  (e.g., via a new migration file in `supabase/migrations`):

  CREATE OR REPLACE FUNCTION get_patients_for_clinical_engine()
  RETURNS TABLE (
    patient_id TEXT,
    first_name TEXT,
    last_name TEXT,
    encounter_uuid UUID,
    encounter_id TEXT,
    transcript TEXT,
    transcript_length INT,
    diff_dx_count BIGINT,
    conditions_count BIGINT
  )
  AS $$
  BEGIN
    RETURN QUERY
    SELECT DISTINCT
      p.patient_id,
      p.first_name,
      p.last_name,
      e.id as encounter_uuid,
      e.encounter_id,
      e.transcript, -- Ensure transcript is selected
      length(e.transcript) as transcript_length,
      (SELECT COUNT(*) FROM differential_diagnoses dd WHERE dd.encounter_id = e.id) as diff_dx_count,
      (SELECT COUNT(*) FROM conditions c WHERE c.encounter_id = e.id) as conditions_count
    FROM patients p
    JOIN encounters e ON p.id = e.patient_supabase_id
    WHERE e.transcript IS NOT NULL
      AND length(e.transcript) > 100
      AND (
        (SELECT COUNT(*) FROM differential_diagnoses dd WHERE dd.encounter_id = e.id) < 3
        OR (SELECT COUNT(*) FROM conditions c WHERE c.encounter_id = e.id AND c.category = 'encounter-diagnosis') = 0
      )
    ORDER BY p.patient_id, e.encounter_id;
  END;
  $$ LANGUAGE plpgsql;

*/

// Define the expected structure of the API response (can be expanded later if needed)
interface ClinicalEngineResult {
  // Assuming the result contains at least these based on generate_demo_clinical_results.ts
  diagnosticResult: {
    diagnosisName?: string;
    diagnosisCode?: string;
    confidence?: number;
    differentialDiagnoses?: any[];
    recommendedTreatments?: any[];
  };
  soapNote?: any;
  // Add other fields as necessary based on actual API response
}

async function callClinicalEngineAPI(
  patientId: string,
  encounterUuid: string, // Changed from encounterId to reflect it's the UUID for the API call
  transcript: string
): Promise<ClinicalEngineResult> {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

  console.log(`Calling clinical engine API for patient ${patientId}, encounter ${encounterUuid}...`);

  // The issue states the API expects patientId, encounterId, transcript.
  // It's crucial to clarify if 'encounterId' for the API means the business ID (e.g., E12345)
  // or the database UUID. The issue's example `callClinicalEngineAPI` used `encounterId`.
  // My `EncounterToProcess` interface has `encounter_uuid` (database e.id) and `encounter_id` (business id).
  // The issue's API processing workflow shows:
  // body: JSON.stringify({ patientId, encounterId, transcript }),
  // The SQL query selects p.patient_id (business id) and e.id as encounter_uuid.
  // It also selects e.encounter_id (business id).
  // Let's assume the API needs the *database UUID* for `encounterId` based on "Use encounter UUID (e.id) not encounter business ID for database operations".
  // And the example from generate_demo_clinical_results.ts uses `demoEncounter.id` which is likely the UUID.
  // So, I will pass `encounterUuid` as `encounterId` in the API body.

  const requestBody = {
    patientId: patientId,       // This is p.patient_id from our SQL query
    encounterId: encounterUuid, // This is e.id (encounter_uuid) from our SQL query
    transcript: transcript
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/clinical-engine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API call failed for patient ${patientId}, encounter ${encounterUuid}: ${response.status} ${response.statusText} - ${errorText}`);
      throw new Error(`API call failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`Successfully received API response for patient ${patientId}, encounter ${encounterUuid}.`);
    return result as ClinicalEngineResult;
  } catch (error) {
    console.error(`Error in callClinicalEngineAPI for patient ${patientId}, encounter ${encounterUuid}:`, error);
    throw error; // Rethrow to be handled by the caller's retry logic
  }
}

async function getEncountersToProcess(supabaseClient: SupabaseClient): Promise<EncounterToProcess[]> {
  console.log('Fetching encounters to process using RPC call...');
  const { data, error } = await supabaseClient.rpc('get_patients_for_clinical_engine');

  if (error) {
    console.error('Error calling get_patients_for_clinical_engine RPC:', error);
    throw error; // Rethrow to be caught by main's catch block
  }

  if (!data) {
    console.log('No data returned from get_patients_for_clinical_engine RPC.');
    return [];
  }

  console.log(`Found ${data.length} encounters that match criteria via RPC.`);
  return data;
}

async function verifyClinicalResults(
  supabaseClient: SupabaseClient, 
  encounterUuid: string, 
  patientId: string
): Promise<void> {
  console.log(`Verifying clinical results for encounter ${encounterUuid}...`);
  
  try {
    // Check for primary diagnoses in conditions table
    const { data: conditionsData, error: conditionsError } = await supabaseClient
      .from('conditions')
      .select('*')
      .eq('encounter_id', encounterUuid)
      .eq('category', 'encounter-diagnosis');

    if (conditionsError) {
      console.error(`Error verifying conditions for encounter ${encounterUuid}:`, conditionsError);
      return;
    }

    // Check for differential diagnoses
    const { data: diffDxData, error: diffDxError } = await supabaseClient
      .from('differential_diagnoses')
      .select('*')
      .eq('encounter_id', encounterUuid);

    if (diffDxError) {
      console.error(`Error verifying differential diagnoses for encounter ${encounterUuid}:`, diffDxError);
      return;
    }

    const primaryDiagnosesCount = conditionsData?.length || 0;
    const differentialDiagnosesCount = diffDxData?.length || 0;

    console.log(`  - Primary diagnoses created: ${primaryDiagnosesCount}`);
    console.log(`  - Differential diagnoses created: ${differentialDiagnosesCount}`);

    // Update global counters (we'll need to pass these by reference or return them)
    // For now, just log the results
    if (primaryDiagnosesCount > 0) {
      console.log(`  ✓ Successfully verified primary diagnosis creation for encounter ${encounterUuid}`);
    }
    if (differentialDiagnosesCount > 0) {
      console.log(`  ✓ Successfully verified differential diagnoses creation for encounter ${encounterUuid}`);
    }
    if (primaryDiagnosesCount === 0 && differentialDiagnosesCount === 0) {
      console.warn(`  ⚠ No clinical results found after API call for encounter ${encounterUuid}`);
    }

  } catch (error) {
    console.error(`Error during verification for encounter ${encounterUuid}:`, error);
  }
}

async function main() {
  console.log('Starting batch clinical engine processing...');

  // Initialize Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local');
    process.exit(1);
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('Supabase client initialized.');

  const encountersToProcess = await getEncountersToProcess(supabase);

  if (encountersToProcess.length === 0) {
    console.log('No encounters found to process. Exiting.');
    return;
  }
  console.log(`Successfully fetched ${encountersToProcess.length} encounters for processing.`);

  // Counters for summary
  let encountersProcessedCount = 0;
  let successfulApiCallCount = 0;
  let skippedTranscriptLengthCount = 0;
  let verifiedPrimaryDiagnosesCount = 0;
  let verifiedDifferentialDiagnosesCount = 0;
  // Add more counters as needed for verification step

  const totalEncounters = encountersToProcess.length;
  for (let i = 0; i < totalEncounters; i++) {
    const encounter = encountersToProcess[i];
    console.log(`Processing encounter ${i + 1} of ${totalEncounters}: Patient ID ${encounter.patient_id}, Encounter UUID ${encounter.encounter_uuid}`);

    // Validate transcript length
    if (!encounter.transcript || encounter.transcript.length <= 100) {
      console.warn(`Skipping encounter ${encounter.encounter_uuid} for patient ${encounter.patient_id} due to short or missing transcript (length: ${encounter.transcript?.length || 0}).`);
      skippedTranscriptLengthCount++;
      continue; // Skip to the next encounter
    }

    // Rate limiting: 1 second delay between API calls
    if (i > 0) { // No delay before the first call
      console.log('Waiting 1 second for rate limiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    encountersProcessedCount++;

    let attemptApiCallSuccessful = false; // Renamed for clarity within the attempt loop
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`Attempt ${attempt} of ${maxRetries} for encounter ${encounter.encounter_uuid}`);
      try {
        const apiResult = await callClinicalEngineAPI(
          encounter.patient_id,
          encounter.encounter_uuid,
          encounter.transcript
        );
        attemptApiCallSuccessful = true; // Mark this attempt as successful
        break; // Exit retry loop on success
      } catch (error) {
        console.error(`API call attempt ${attempt} failed for encounter ${encounter.encounter_uuid}:`, error.message);
        if (attempt === maxRetries) {
          console.error(`All ${maxRetries} API call attempts failed for encounter ${encounter.encounter_uuid}. Skipping verification for this encounter.`);
        } else {
          console.log('Waiting 1 second before retrying...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (attemptApiCallSuccessful) {
      successfulApiCallCount++; // Increment only if any attempt was successful
      await verifyClinicalResults(supabase, encounter.encounter_uuid, encounter.patient_id);
    }
  }

  console.log('\n--- Batch Processing Summary ---');
  console.log(`Total encounters matching initial criteria: ${totalEncounters}`);
  console.log(`Encounters skipped (short/missing transcript): ${skippedTranscriptLengthCount}`);
  const attemptedProcessingCount = totalEncounters - skippedTranscriptLengthCount;
  console.log(`Encounters attempted for API processing: ${attemptedProcessingCount}`);
  // encountersProcessedCount should be equal to attemptedProcessingCount if logic is correct.
  console.log(`Encounters successfully processed by API: ${successfulApiCallCount}`);
  console.log(`  Verified primary diagnoses created: ${verifiedPrimaryDiagnosesCount}`);
  console.log(`  Verified differential diagnoses items created: ${verifiedDifferentialDiagnosesCount}`);
  // Add more summary items as needed

  console.log('\nBatch processing finished.');
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('Script completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}
