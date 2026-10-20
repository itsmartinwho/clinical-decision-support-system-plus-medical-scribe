import { getSupabaseClient } from './supabaseClient';
import {
  Patient, Encounter, Diagnosis, LabResult, ComplexCaseAlert, Treatment,
  PatientDataPayload, DifferentialDiagnosisRecord, DifferentialDiagnosis // Import the new types
} from './types';

/*
  A minimal drop-in replacement for PatientDataService when NEXT_PUBLIC_USE_SUPABASE=true.
  Only the methods currently used by the UI have been implemented.
  Any additional methods simply return empty data structures for now.
*/
class SupabaseDataService {
  private get supabase() { return getSupabaseClient(); } // on first use, so the build needs no keys
  private isLoaded = false;
  private isLoading = false; // This will be managed by loadPromise
  private loadPromise: Promise<void> | null = null;
  private singlePatientLoadPromises: Map<string, Promise<void>> = new Map(); // Added for single patient loads
  private patients: Record<string, Patient> = {}; // key = original PatientID (e.g., "1", "FB2ABB...")
  private encounters: Record<string, Encounter> = {}; // key = composite `${patientId}_${originalEncounterID}`
  private encountersByPatient: Record<string, string[]> = {}; // key = original PatientID, value = array of composite encounter keys
  private diagnoses: Record<string, Diagnosis[]> = {}; // key = patient ID, value = array of diagnoses
  private labResults: Record<string, LabResult[]> = {}; // key = patient ID, value = array of lab results
  private differentialDiagnoses: Record<string, DifferentialDiagnosisRecord[]> = {}; // key = patient ID, value = array of differential diagnoses
  private patientUuidToOriginalId: Record<string, string> = {}; // key = Supabase UUID, value = original patient ID
  /** Simple pub-sub so UI layers can refresh after data-mutating calls */
  private changeSubscribers: Array<() => void> = [];

  // NEW: Cache for complete patient payloads to avoid re-assembling JSON
  private cachedPatientPayloads: Record<string, PatientDataPayload> = {}; // key = patientId, value = complete payload
  private payloadCacheTimestamps: Record<string, number> = {}; // key = patientId, value = timestamp when cached
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

  // Method to load data for a single patient with PARALLEL fetching and JSON caching
  private async loadSinglePatientData(patientId: string): Promise<void> {
    if (this.patients[patientId]) { // Already loaded
      return Promise.resolve();
    }
    if (this.singlePatientLoadPromises.has(patientId)) { // Load already in progress
      return this.singlePatientLoadPromises.get(patientId);
    }

    console.log(`SupabaseDataService: Loading data for patient ${patientId} with parallel fetching`);
    const promise = (async () => {
      try {
        // STEP 1: First fetch patient demographics to get the Supabase UUID
        const patientResponse = await this.supabase
          .from('patients')
          .select('*')
          .eq('patient_id', patientId)
          .single();

        // Check for patient fetch errors first
        if (patientResponse.error) {
          console.error(`SupabaseDataService (Prod Debug): Error fetching patient ${patientId}:`, patientResponse.error);
          throw patientResponse.error;
        }
        if (!patientResponse.data) {
          throw new Error(`Patient ${patientId} not found.`);
        }

        const patientRow = patientResponse.data;

        // STEP 2: PARALLEL FETCH encounters, conditions, and lab results using the Supabase UUID
        const [
          encountersResponse,
          conditionsResponse,
          labResultsResponse
        ] = await Promise.all([
          // Fetch encounters (including SOAP notes and treatments) using correct foreign key
          this.supabase
            .from('encounters')
            .select('*')
            .eq('patient_supabase_id', patientRow.id)
            .eq('is_deleted', false), // Only fetch non-deleted encounters
          
          // Fetch conditions (non-rich diagnoses) using Supabase UUID
          this.supabase
            .from('conditions')
            .select('*')
            .eq('patient_id', patientRow.id),
          
          // Fetch lab results using Supabase UUID
          this.supabase
            .from('lab_results')
            .select('*')
            .eq('patient_id', patientRow.id)
        ]);

        // Process patient demographics
        const patient: Patient = {
          id: patientRow.patient_id,
          name: patientRow.name,
          firstName: patientRow.first_name,
          lastName: patientRow.last_name,
          gender: patientRow.gender,
          dateOfBirth: patientRow.birth_date ? (() => {
            try {
              const isoString = new Date(patientRow.birth_date).toISOString();
              return isoString ? isoString.split('T')[0] : undefined;
            } catch {
              return undefined;
            }
          })() : undefined,
          photo: patientRow.photo_url,
          race: patientRow.race,
          ethnicity: patientRow.ethnicity,
          maritalStatus: patientRow.marital_status,
          language: patientRow.language,
          povertyPercentage: patientRow.poverty_percentage !== null ? Number(patientRow.poverty_percentage) : undefined,
          alerts: (() => { // Simplified alerts parsing for brevity, ensure it matches full load
            const src = patientRow.alerts || patientRow.alerts_json || (patientRow as any).alertsJSON || patientRow.extra_data?.alerts || patientRow.extra_data?.alertsJSON;
            if (!src) return [];
            try {
              if (Array.isArray(src)) return src as ComplexCaseAlert[];
              if (typeof src === 'string') {
                let s = src.trim();
                if ((s.startsWith('\"') && s.endsWith('\"')) || (s.startsWith("'") && s.endsWith("'"))) {
                  s = s.substring(1, s.length - 1);
                }
                s = s.replace(/""/g, '"');
                const parsed = JSON.parse(s);
                return Array.isArray(parsed) ? parsed as ComplexCaseAlert[] : [];
              }
            } catch (e) { console.warn('SupabaseDataService: Unable to parse alerts for patient', patientRow.patient_id, e); }
            return [];
          })(),
          nextAppointment: patientRow.next_appointment_date ? new Date(patientRow.next_appointment_date).toISOString() : undefined,
          reason: patientRow.patient_level_reason,
        };

        // Store patient and UUID mapping
        this.patients[patient.id] = patient;
        if (!this.encountersByPatient[patient.id]) {
          this.encountersByPatient[patient.id] = [];
        }
        this.patientUuidToOriginalId[patientRow.id] = patient.id;

        // Process encounters (check for errors)
        if (encountersResponse.error) {
          console.error(`SupabaseDataService (Prod Debug): Error fetching encounters for patient ${patientId}:`, encountersResponse.error);
          throw encountersResponse.error;
        }

        if (encountersResponse.data) {
          encountersResponse.data.forEach((row) => {
            const encounterSupabaseUUID = row.id;
            const encounterBusinessKey = row.encounter_id;
            const patientSupabaseUUIDFromEncounter = row.patient_supabase_id;

            if (!encounterBusinessKey) {
              console.warn(`SupabaseDataService: Skipping encounter ${encounterSupabaseUUID} - missing encounter_id`);
              return;
            }

            if (!patientSupabaseUUIDFromEncounter) {
              console.warn(`SupabaseDataService: Skipping encounter ${encounterBusinessKey} - missing patient_supabase_id`);
              return;
            }
            
            const patientPublicId = this.patientUuidToOriginalId[patientSupabaseUUIDFromEncounter];

            if (!patientPublicId) {
              console.warn(`SupabaseDataService: Skipping encounter ${encounterBusinessKey} - patient ${patientSupabaseUUIDFromEncounter} not found`);
              return;
            }
            
            const compositeKey = `${patientPublicId}_${encounterBusinessKey}`;
            
            const encounter: Encounter = {
              id: encounterSupabaseUUID, 
              encounterIdentifier: encounterBusinessKey, 
              patientId: patientPublicId, 
              scheduledStart: row.scheduled_start_datetime ? new Date(row.scheduled_start_datetime).toISOString() : '',
              scheduledEnd: row.scheduled_end_datetime ? new Date(row.scheduled_end_datetime).toISOString() : '',
              actualStart: row.actual_start_datetime ? new Date(row.actual_start_datetime).toISOString() : undefined,
              actualEnd: row.actual_end_datetime ? new Date(row.actual_end_datetime).toISOString() : undefined,
              reasonCode: row.reason_code,
              reasonDisplayText: row.reason_display_text,
              transcript: row.transcript,
              soapNote: row.soap_note, // SOAP notes included as requested
              treatments: row.treatments || undefined, // Treatments (non-rich) included as requested
              // Exclude rich content fields as per requirements
              priorAuthJustification: row.prior_auth_justification,
              isDeleted: !!row.is_deleted,
              deletedAt: row.updated_at && row.is_deleted ? new Date(row.updated_at).toISOString() : undefined,
            };
            this.encounters[compositeKey] = encounter;
            if (!this.encountersByPatient[patientPublicId]) {
              this.encountersByPatient[patientPublicId] = [];
            }
            if (!this.encountersByPatient[patientPublicId].includes(compositeKey)) {
              this.encountersByPatient[patientPublicId].push(compositeKey);
            }
          });
        }

        // Process conditions (non-rich diagnoses) directly from the parallel fetch
        if (conditionsResponse.error) {
          console.error(`SupabaseDataService (Prod Debug): Error fetching conditions for patient ${patientId}:`, conditionsResponse.error);
        } else if (conditionsResponse.data) {
          this.diagnoses[patientId] = conditionsResponse.data.map(dx => ({
            patientId: patientId,
            encounterId: dx.encounter_id || '',
            code: dx.code,
            description: dx.description, // Condition descriptions (non-rich) as requested
          }));
        }
        
        // Process lab results directly from the parallel fetch
        if (labResultsResponse.error) {
          console.error(`SupabaseDataService (Prod Debug): Error fetching lab results for patient ${patientId}:`, labResultsResponse.error);
        } else if (labResultsResponse.data) {
          this.labResults[patientId] = labResultsResponse.data.map(lab => ({
            patientId: patientId,
            encounterId: lab.encounter_id || '',
            name: lab.name,
            value: lab.value,
            units: lab.units,
            dateTime: lab.date_time ? new Date(lab.date_time).toISOString() : undefined,
            referenceRange: lab.reference_range,
            flag: lab.flag,
          }));
        }

        // Build and cache the complete patient payload JSON immediately after all data is assembled
        // Only include non-deleted encounters for AI context
        const patientEncounters = this.getPatientEncounters(patientId, false);
        const encounterDetails = patientEncounters.map(encounter => ({
          encounter: encounter,
          diagnoses: this.getDiagnosesForEncounter(patientId, encounter.id),
          labResults: this.getLabResultsForEncounter(patientId, encounter.id),
        }));

        const completePayload: PatientDataPayload = { 
          patient, 
          encounters: encounterDetails 
        };

        // Cache the complete JSON payload for future requests
        this.cachedPatientPayloads[patientId] = completePayload;
        this.payloadCacheTimestamps[patientId] = Date.now();

        console.log(`SupabaseDataService: Successfully loaded and cached complete payload for patient ${patientId}`);
        this.emitChange(); // Notify subscribers
      } catch (error) {
        console.error(`SupabaseDataService (Prod Debug): Exception during parallel patient data fetch for ${patientId}:`, error);
        throw error; // Re-throw
      } finally {
        this.singlePatientLoadPromises.delete(patientId); // Clear promise once done (success or fail)
      }
    })();
    this.singlePatientLoadPromises.set(patientId, promise);
    return promise;
  }

  async loadPatientData(): Promise<void> {
    if (this.isLoaded) {
      return Promise.resolve();
    }
    if (this.loadPromise) {
      console.log("SupabaseDataService (Prod Debug): Load already in progress, returning existing promise.");
      return this.loadPromise;
    }

    console.log("SupabaseDataService: Loading patient data...");
    this.loadPromise = (async () => {
      // this.isLoading = true; // loadPromise presence indicates loading

      this.patients = {}; // Clear previous state
      this.encounters = {};
      this.encountersByPatient = {};

      let patientRows = null;
      try {
        console.log('SupabaseDataService: Fetching patients...');
        const { data, error: pErr } = await this.supabase.from('patients').select('*');
        if (pErr) {
          console.error('SupabaseDataService (Prod Debug): Error fetching patients:', pErr);
          throw pErr;
        }
        patientRows = data;
      } catch (error) {
        console.error('SupabaseDataService (Prod Debug): Exception during patient fetch:', error);
        this.loadPromise = null; // Reset promise on error
        // this.isLoading = false;
        throw error; // Re-throw to be caught by caller if necessary
      }
      
      if (!patientRows) {
          console.error('SupabaseDataService (Prod Debug): patientRows is null after fetch. Cannot proceed.');
          this.loadPromise = null;
          // this.isLoading = false;
          throw new Error("Patient rows fetch returned null.");
      }

      patientRows.forEach((row) => {
        // Gather possible alert sources
        const candidateSources = [
          { key: 'alerts', value: row.alerts },
          { key: 'alerts_json', value: row.alerts_json },
          { key: 'alertsJSON', value: (row as any).alertsJSON },
          { key: 'extra_data.alerts', value: row.extra_data?.alerts },
          { key: 'extra_data.alertsJSON', value: row.extra_data?.alertsJSON },
        ];
        // Pick first candidate that appears to have meaningful data (non-empty array or non-empty string)
        let chosenRawAlerts: any = undefined;
        let chosenKey = '';
        for (const c of candidateSources) {
          if (c.value === undefined || c.value === null) continue;
          if (Array.isArray(c.value) && c.value.length === 0) continue; // skip empty array
          if (typeof c.value === 'string' && c.value.trim().length === 0) continue; // skip empty string
          chosenRawAlerts = c.value;
          chosenKey = c.key;
          break;
        }
        const rawAlertsData = chosenRawAlerts;
        const patient: Patient = {
          id: row.patient_id,
          name: row.name,
          firstName: row.first_name,
          lastName: row.last_name,
          gender: row.gender,
          dateOfBirth: row.birth_date ? (() => {
            try {
              const isoString = new Date(row.birth_date).toISOString();
              return isoString ? isoString.split('T')[0] : undefined;
            } catch {
              return undefined;
            }
          })() : undefined,
          photo: row.photo_url,
          race: row.race,
          ethnicity: row.ethnicity,
          maritalStatus: row.marital_status,
          language: row.language,
          povertyPercentage: row.poverty_percentage !== null ? Number(row.poverty_percentage) : undefined,
          alerts: (() => {
            const srcCandidates = [row.alerts, row.alerts_json, (row as any).alertsJSON, row.extra_data?.alerts, row.extra_data?.alertsJSON];
            let src: any = undefined;
            for (const val of srcCandidates) {
              if (val === undefined || val === null) continue;
              if (Array.isArray(val) && val.length === 0) continue;
              if (typeof val === 'string' && val.trim().length === 0) continue;
              src = val;
              break;
            }
            if (!src) return [];
            try {
              if (Array.isArray(src)) return src as ComplexCaseAlert[];
              if (typeof src === 'string') {
                let s = src.trim();
                if ((s.startsWith('\"') && s.endsWith('\"')) || (s.startsWith("'") && s.endsWith("'"))) {
                  s = s.substring(1, s.length - 1);
                }
                s = s.replace(/""/g, '"');
                const parsed = JSON.parse(s);
                return Array.isArray(parsed) ? parsed as ComplexCaseAlert[] : [];
              }
            } catch (e) {
              console.warn('SupabaseDataService: Unable to parse alerts for patient', row.patient_id, e);
            }
            return [];
          })(),

          nextAppointment: row.next_appointment_date ? new Date(row.next_appointment_date).toISOString() : undefined,
          reason: row.patient_level_reason,
        };
        this.patients[patient.id] = patient;
        this.encountersByPatient[patient.id] = []; 
        // Store the mapping from Supabase UUID to original patient ID
        this.patientUuidToOriginalId[row.id] = patient.id;
      });

      let encounterRows = null;
      let totalEncountersAvailable = 0;
      try {
          console.log('SupabaseDataService: Fetching encounters...');
          const { data, error: vErr, count } = await this.supabase
              .from('encounters')
              .select('*', { count: 'exact' }); 

          if (vErr) {
              console.error('SupabaseDataService (Prod Debug): Error fetching encounters:', vErr);
              throw vErr;
          }
          encounterRows = data;
          totalEncountersAvailable = count ?? 0;
      } catch (error) {
          console.error('SupabaseDataService (Prod Debug): Exception during encounters fetch:', error);
          this.loadPromise = null; 
          // this.isLoading = false;
          throw error;
      }

      if (!encounterRows) {
          console.error('SupabaseDataService (Prod Debug): encounterRows is null after fetch. Cannot proceed with encounters.');
          this.loadPromise = null;
          // this.isLoading = false;
          throw new Error("Encounter rows fetch returned null.");
      }

      let encountersProcessed = 0;
      encounterRows.forEach((row) => {
        const encounterSupabaseUUID = row.id; 
        const encounterBusinessKey = row.encounter_id; // Assumes DB column is now encounter_id
        const patientSupabaseUUIDFromEncounter = row.patient_supabase_id;

        if (!encounterBusinessKey) {
          console.warn(`SupabaseDataService: Skipping encounter ${encounterSupabaseUUID} - missing encounter_id`);
          return;
        }

        if (!patientSupabaseUUIDFromEncounter) {
          console.warn(`SupabaseDataService: Skipping encounter ${encounterBusinessKey} - missing patient_supabase_id`);
          return;
        }

        const patientPublicId = this.patientUuidToOriginalId[patientSupabaseUUIDFromEncounter];

        if (!patientPublicId) {
          console.warn(`SupabaseDataService: Skipping encounter ${encounterBusinessKey} - patient ${patientSupabaseUUIDFromEncounter} not found`);
          return;
        }
        
        const compositeKey = `${patientPublicId}_${encounterBusinessKey}`;

        const encounter: Encounter = {
          id: encounterSupabaseUUID, 
          encounterIdentifier: encounterBusinessKey, 
          patientId: patientPublicId, 
          scheduledStart: row.scheduled_start_datetime ? new Date(row.scheduled_start_datetime).toISOString() : '',
          scheduledEnd: row.scheduled_end_datetime ? new Date(row.scheduled_end_datetime).toISOString() : '',
          actualStart: row.actual_start_datetime ? new Date(row.actual_start_datetime).toISOString() : undefined,
          actualEnd: row.actual_end_datetime ? new Date(row.actual_end_datetime).toISOString() : undefined,
          reasonCode: row.reason_code,
          reasonDisplayText: row.reason_display_text,
          transcript: row.transcript,
          observations: row.observations || undefined,
          soapNote: row.soap_note,
          treatments: row.treatments || undefined,
          // === Rich content fields ===
          diagnosis_rich_content: row.diagnosis_rich_content || undefined,
          treatments_rich_content: row.treatments_rich_content || undefined,
          priorAuthJustification: row.prior_auth_justification,
          insuranceStatus: row.insurance_status,
          isDeleted: !!row.is_deleted, 
          deletedAt: row.updated_at && row.is_deleted ? new Date(row.updated_at).toISOString() : undefined,
          extra_data: row.extra_data || undefined,
        };
        this.encounters[compositeKey] = encounter;
        if (!this.encountersByPatient[patientPublicId]) {
          this.encountersByPatient[patientPublicId] = [];
        }
        if (!this.encountersByPatient[patientPublicId].includes(compositeKey)) {
          this.encountersByPatient[patientPublicId].push(compositeKey);
        }
        encountersProcessed++;
      });

      this.isLoaded = true;
      // this.isLoading = false;
      this.loadPromise = null;

      // Fetch diagnoses for all patients
      console.log('SupabaseDataService: Fetching diagnoses...');
      const { data: allDiagnoses, error: dxErr } = await this.supabase
        .from('conditions')
        .select('*');
      
      if (dxErr) {
        console.error('SupabaseDataService: Error fetching diagnoses:', dxErr);
      } else if (allDiagnoses) {
        // Group diagnoses by patient
        allDiagnoses.forEach((dx) => {
          // Find the original patient ID from the UUID
          const originalPatientId = this.patientUuidToOriginalId[dx.patient_id];
          
          if (originalPatientId) {
            if (!this.diagnoses[originalPatientId]) {
              this.diagnoses[originalPatientId] = [];
            }
            
            const diagnosis: Diagnosis = {
              patientId: originalPatientId,
              encounterId: dx.encounter_id || '', // This is now a UUID that references encounters.id
              code: dx.code,
              description: dx.description,
            };
            
            this.diagnoses[originalPatientId].push(diagnosis);
          }
        });
        console.log(`SupabaseDataService: Loaded ${allDiagnoses.length} diagnoses`);
      }

      // Fetch lab results for all patients
      console.log('SupabaseDataService: Fetching lab results...');
      const { data: allLabResults, error: labErr } = await this.supabase
        .from('lab_results')
        .select('*');
      
      if (labErr) {
        console.error('SupabaseDataService: Error fetching lab results:', labErr);
      } else if (allLabResults) {
        // Group lab results by patient
        allLabResults.forEach((lab) => {
          // Find the original patient ID from the UUID
          const originalPatientId = this.patientUuidToOriginalId[lab.patient_id];
          
          if (originalPatientId) {
            if (!this.labResults[originalPatientId]) {
              this.labResults[originalPatientId] = [];
            }
            
            const labResult: LabResult = {
              patientId: originalPatientId,
              encounterId: lab.encounter_id || '', // This is now a UUID that references encounters.id
              name: lab.name,
              value: lab.value,
              units: lab.units,
              dateTime: lab.date_time ? new Date(lab.date_time).toISOString() : undefined,
              referenceRange: lab.reference_range,
              flag: lab.flag,
            };
            
            this.labResults[originalPatientId].push(labResult);
          }
        });
        console.log(`SupabaseDataService: Loaded ${allLabResults.length} lab results`);
      }

      // Fetch differential diagnoses for all patients
      console.log('SupabaseDataService: Fetching differential diagnoses...');
      const { data: allDifferentialDiagnoses, error: diffErr } = await this.supabase
        .from('differential_diagnoses')
        .select('*');
      
      if (diffErr) {
        console.error('SupabaseDataService: Error fetching differential diagnoses:', diffErr);
      } else if (allDifferentialDiagnoses) {
        // Group differential diagnoses by patient
        allDifferentialDiagnoses.forEach((diff) => {
          // Find the original patient ID from the UUID
          const originalPatientId = this.patientUuidToOriginalId[diff.patient_id];
          
          if (originalPatientId) {
            if (!this.differentialDiagnoses[originalPatientId]) {
              this.differentialDiagnoses[originalPatientId] = [];
            }
            
            this.differentialDiagnoses[originalPatientId].push(diff);
          }
        });
        console.log(`SupabaseDataService: Loaded ${allDifferentialDiagnoses.length} differential diagnoses`);
      }

      this.emitChange();
    })();
    return this.loadPromise;
  }

  getAllPatients(): Patient[] {
    if (!this.isLoaded && !this.isLoading) {
        // Kick off a background load; return empty array for now.
        this.loadPatientData().catch(() => {/* error already logged inside */});
        return [];
    }
    return Object.values(this.patients);
  }

  getPatient(patientId: string): Patient | null {
    // No need to trigger load here, getPatientData will handle it.
    // This method becomes a simple cache accessor.
    return this.patients[patientId] ?? null;
  }

  getPatientEncounters(patientId: string, includeDeleted: boolean = false): Encounter[] {
    // If patient data isn't loaded at all, this might return empty
    // but getPatientData should ensure data is loaded before this is relied upon heavily.
    const encounterKeys = this.encountersByPatient[patientId] || [];
    const encounters = encounterKeys.map(key => this.encounters[key]).filter(Boolean) as Encounter[];
    
    // Filter out deleted encounters unless specifically requested
    if (!includeDeleted) {
      return encounters.filter(encounter => !encounter.isDeleted);
    }
    
    return encounters;
  }

  async getPatientData(patientId: string): Promise<PatientDataPayload | null> {
    console.log(`SupabaseDataService: getPatientData called for ${patientId}`);
    
    // Check if we have a valid cached payload first
    const cachedPayload = this.cachedPatientPayloads[patientId];
    const cacheTimestamp = this.payloadCacheTimestamps[patientId];
    
    if (cachedPayload && cacheTimestamp) {
      const cacheAge = Date.now() - cacheTimestamp;
      if (cacheAge < this.CACHE_TTL_MS) {
        console.log(`SupabaseDataService: Returning cached payload for patient ${patientId} (age: ${Math.round(cacheAge / 1000)}s)`);
        return cachedPayload;
      } else {
        console.log(`SupabaseDataService: Cache expired for patient ${patientId} (age: ${Math.round(cacheAge / 1000)}s), will reload`);
        // Clear expired cache
        delete this.cachedPatientPayloads[patientId];
        delete this.payloadCacheTimestamps[patientId];
      }
    }
    
    // If the specific patient is not in cache, try to load them.
    if (!this.patients[patientId] && !this.singlePatientLoadPromises.has(patientId)) {
      console.log(`SupabaseDataService: Patient ${patientId} not in cache. Attempting parallel load.`);
      try {
        await this.loadSinglePatientData(patientId);
      } catch (error) {
        console.error(`SupabaseDataService: Failed to load single patient ${patientId} in getPatientData:`, error);
        return null; // Failed to load, return null
      }
    } else if (this.singlePatientLoadPromises.has(patientId)) {
      // If a load is in progress for this patient, await it
      console.log(`SupabaseDataService: Patient ${patientId} load in progress. Awaiting...`);
      try {
        await this.singlePatientLoadPromises.get(patientId);
      } catch (error) {
         console.error(`SupabaseDataService: Existing load for single patient ${patientId} failed:`, error);
        return null;
      }
    }

    // After loading, return the cached payload (which should now be available)
    const finalCachedPayload = this.cachedPatientPayloads[patientId];
    if (finalCachedPayload) {
      console.log(`SupabaseDataService: Returning newly loaded and cached payload for patient ${patientId}`);
      return finalCachedPayload;
    }

    // Fallback: if cache is somehow missing, build payload on-the-fly
    console.warn(`SupabaseDataService: Cache missing for patient ${patientId}, building payload on-the-fly`);
    const patient = this.patients[patientId];
    if (!patient) {
        console.warn(`SupabaseDataService: getPatientData - Patient ${patientId} not found in cache (after load attempt).`);
        return null;
    }

    // Include only non-deleted encounters for AI context
    const patientEncounters = this.getPatientEncounters(patientId, false);
    const encounterDetails = patientEncounters.map(encounter => ({
      encounter: encounter,
      diagnoses: this.getDiagnosesForEncounter(patientId, encounter.id),
      labResults: this.getLabResultsForEncounter(patientId, encounter.id),
    }));
    return { patient, encounters: encounterDetails };
  }

  getUpcomingConsultations(): { patient: Patient; encounter: Encounter }[] {
    if (!this.isLoaded && !this.isLoading) {
        console.error("SupabaseDataService: getUpcomingConsultations called when data not loaded and not currently loading. THIS IS A BUG.");
    }
    const upcoming: { patient: Patient; encounter: Encounter }[] = [];
    const now = new Date();
    const nowTime = now.getTime();

    Object.values(this.encounters).forEach(enc => {
      if ((enc as any).isDeleted) return;
      if (enc.scheduledStart && typeof enc.scheduledStart === 'string' && enc.scheduledStart.length > 0) {
        try {
          const startDate = new Date(enc.scheduledStart);
          const startTime = startDate.getTime();
          if (startDate instanceof Date && !isNaN(startTime)) { 
            const isInFuture = startTime > nowTime;
            if (isInFuture) {
              const patient = this.patients[enc.patientId];
              if (patient) {
                upcoming.push({ patient, encounter: enc });
              } else {
                 console.warn(`SupabaseDataService (Prod Debug): Found upcoming encounter ${enc.id} but patient ${enc.patientId} not found in cache.`);
              }
            }
          } else {
             console.warn(`SupabaseDataService (Prod Debug): Invalid date object after parsing scheduledStart for encounter ${enc.id}. Original string: ${enc.scheduledStart}`);
          }
        } catch (e) {
            console.warn(`SupabaseDataService (Prod Debug): Error processing date for encounter ${enc.id}. Original string: ${enc.scheduledStart}. Error: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    });
    return upcoming.sort((a, b) => new Date(a.encounter.scheduledStart).getTime() - new Date(b.encounter.scheduledStart).getTime());
  }

  getPastConsultations(): { patient: Patient; encounter: Encounter }[] {
    if (!this.isLoaded && !this.isLoading) {
      console.error("SupabaseDataService: getPastConsultations called when data not loaded and not currently loading. THIS IS A BUG.");
    }
    const past: { patient: Patient; encounter: Encounter }[] = [];
    const now = new Date();
    const nowTime = now.getTime();

    Object.values(this.encounters).forEach(enc => {
      if ((enc as any).isDeleted) return;
      if (enc.scheduledStart && typeof enc.scheduledStart === 'string' && enc.scheduledStart.length > 0) {
        try {
          const startDate = new Date(enc.scheduledStart);
          const startTime = startDate.getTime();
          if (startDate instanceof Date && !isNaN(startTime)) {
            const isInPast = startTime <= nowTime;
            if (isInPast) {
              const patient = this.patients[enc.patientId];
              if (patient) {
                past.push({ patient, encounter: enc });
              }
            }
          }
        } catch (e) {
          // Ignore parse errors for past
        }
      }
    });
    return past.sort((a, b) => new Date(b.encounter.scheduledStart).getTime() - new Date(a.encounter.scheduledStart).getTime());
  }

  async updateEncounterTranscript(patientId: string, encounterCompositeId: string, transcript: string): Promise<void> {
    const originalEncounterId = encounterCompositeId.split('_').slice(-1)[0];
    const { error } = await this.supabase
      .from('encounters')
      .update({ transcript: transcript })
      .eq('encounter_id', originalEncounterId);
    if (error) {
      console.error('SupabaseDataService (Prod Debug): Error updating transcript in DB:', error.message);
      throw error;
    }
    if (this.encounters[encounterCompositeId]) {
      this.encounters[encounterCompositeId].transcript = transcript;
      this.clearPatientPayloadCache(patientId); // Clear cache when data is updated
      this.emitChange();
    } else {
      console.warn(`SupabaseDataService (Prod Debug): updateEncounterTranscript - Encounter with composite ID ${encounterCompositeId} not found in local cache to update.`);
    }
  }

  async updateEncounterObservations(
    patientId: string, // Though not directly used in the SQL, good for context/caching if needed
    encounterCompositeId: string, 
    observations: string[]
  ): Promise<void> {
    const originalEncounterId = encounterCompositeId.split('_').pop(); // Get the actual encounter_id for the DB
    if (!originalEncounterId) {
      console.error('SupabaseDataService: Could not extract originalEncounterId from composite ID:', encounterCompositeId);
      throw new Error('Invalid encounterCompositeId');
    }

    const { error } = await this.supabase
      .from('encounters')
      .update({ observations: observations })
      .eq('encounter_id', originalEncounterId);

    if (error) {
      console.error('SupabaseDataService (Prod Debug): Error updating observations in DB:', error.message);
      throw error;
    }

    // Update local cache
    if (this.encounters[encounterCompositeId]) {
      this.encounters[encounterCompositeId].observations = observations;
      this.clearPatientPayloadCache(patientId); // Clear cache when data is updated
      this.emitChange(); // Notify subscribers of the change
    } else {
      console.warn(`SupabaseDataService (Prod Debug): updateEncounterObservations - Encounter with composite ID ${encounterCompositeId} not found in local cache to update.`);
    }
    console.log("Observations updated successfully in DB and cache for encounter:", encounterCompositeId);
  }

  async updateEncounterSOAPNote(patientId: string, encounterCompositeId: string, soapNote: string): Promise<void> {
    const originalEncounterId = encounterCompositeId.split('_').pop();
    if (!originalEncounterId) {
      console.error('SupabaseDataService: Could not extract originalEncounterId from composite ID:', encounterCompositeId);
      throw new Error('Invalid encounterCompositeId');
    }

    const { error } = await this.supabase
      .from('encounters')
      .update({ soap_note: soapNote })
      .eq('encounter_id', originalEncounterId);

    if (error) {
      console.error('SupabaseDataService: Error updating SOAP note in DB:', error.message);
      throw error;
    }

    // Update local cache
    if (this.encounters[encounterCompositeId]) {
      this.encounters[encounterCompositeId].soapNote = soapNote;
      this.clearPatientPayloadCache(patientId); // Clear cache when data is updated
      this.emitChange();
    } else {
      console.warn(`SupabaseDataService: updateEncounterSOAPNote - Encounter with composite ID ${encounterCompositeId} not found in local cache to update.`);
    }
    console.log("SOAP note updated successfully in DB and cache for encounter:", encounterCompositeId);
  }

  async updateEncounterTreatments(patientId: string, encounterCompositeId: string, treatments: Treatment[]): Promise<void> {
    const originalEncounterId = encounterCompositeId.split('_').pop();
    if (!originalEncounterId) {
      console.error('SupabaseDataService: Could not extract originalEncounterId from composite ID:', encounterCompositeId);
      throw new Error('Invalid encounterCompositeId');
    }

    const { error } = await this.supabase
      .from('encounters')
      .update({ treatments: treatments })
      .eq('encounter_id', originalEncounterId);

    if (error) {
      console.error('SupabaseDataService: Error updating treatments in DB:', error.message);
      throw error;
    }

    // Update local cache
    if (this.encounters[encounterCompositeId]) {
      this.encounters[encounterCompositeId].treatments = treatments;
      this.clearPatientPayloadCache(patientId); // Clear cache when data is updated
      this.emitChange();
    } else {
      console.warn(`SupabaseDataService: updateEncounterTreatments - Encounter with composite ID ${encounterCompositeId} not found in local cache to update.`);
    }
    console.log("Treatments updated successfully in DB and cache for encounter:", encounterCompositeId);
  }

  async createNewEncounter(
    patientId: string,
    opts?: { reason?: string; scheduledStart?: string; scheduledEnd?: string; duration?: number }
  ): Promise<Encounter> {
    // Ensure patient exists (reload on demand)
    if (!this.patients[patientId]) {
      if (!this.isLoaded && !this.isLoading) {
        await this.loadPatientData();
      }
      if (!this.patients[patientId]) {
        throw new Error(`Patient with original ID ${patientId} not found in cache; cannot create encounter.`);
      }
    }

    // Find the Supabase UUID for this patient
    const patientSupabaseUuid = Object.keys(this.patientUuidToOriginalId).find(
      uuid => this.patientUuidToOriginalId[uuid] === patientId
    );

    if (!patientSupabaseUuid) {
      throw new Error(`Patient Supabase UUID not found for patient ID ${patientId}; cannot create encounter.`);
    }

    const newEncounterId = crypto.randomUUID();
    const nowIso = new Date().toISOString();

    // Compute start and end times based on optional duration
    const startIso = opts?.scheduledStart ?? nowIso;
    const endIso = opts?.duration
      ? new Date(new Date(startIso).getTime() + opts.duration * 60000).toISOString()
      : opts?.scheduledEnd ?? null;

    // Insert into DB
    const { error: insertErr } = await this.supabase.from('encounters').insert([
      {
        encounter_id: newEncounterId,
        patient_supabase_id: patientSupabaseUuid, // Fix: Add the required foreign key
        reason_code: opts?.reason ?? null,
        reason_display_text: opts?.reason ?? null, // Set the display text as well
        scheduled_start_datetime: startIso,
        scheduled_end_datetime: endIso,
        actual_start_datetime: null,
        actual_end_datetime: null,
        is_deleted: false,
        extra_data: { PatientID: patientId },
      },
    ]);

    if (insertErr) {
      console.error('SupabaseDataService: Failed to insert new encounter into DB', insertErr);
      throw insertErr;
    }

    // Get the actual Supabase UUID for the encounter we just created
    const { data: createdEncounter, error: fetchErr } = await this.supabase
      .from('encounters')
      .select('id')
      .eq('encounter_id', newEncounterId)
      .single();

    if (fetchErr || !createdEncounter) {
      console.error('SupabaseDataService: Failed to fetch created encounter UUID', fetchErr);
      throw new Error('Failed to retrieve created encounter UUID');
    }

    const encounterSupabaseUuid = createdEncounter.id;

    // Build local cache record
    const compositeId = `${patientId}_${newEncounterId}`;
    const encounter: Encounter = {
      id: encounterSupabaseUuid, // Use the actual Supabase UUID
      encounterIdentifier: newEncounterId,
      patientId,
      scheduledStart: startIso,
      scheduledEnd: endIso ?? '',
      reasonCode: undefined, // Will be AI generated
      reasonDisplayText: opts?.reason ?? undefined, // This now takes the verbose reason
    } as Encounter;

    this.encounters[compositeId] = encounter;
    if (!this.encountersByPatient[patientId]) this.encountersByPatient[patientId] = [];
    this.encountersByPatient[patientId].unshift(compositeId);
    this.clearPatientPayloadCache(patientId); // Clear cache when new encounter is created
    this.emitChange();
    return encounter;
  }

  // ------------------------------------------------------------------
  // Utility pub-sub helpers & simple CRUD fallbacks
  // ------------------------------------------------------------------
  subscribe(cb: () => void) {
    if (!this.changeSubscribers.includes(cb)) {
      this.changeSubscribers.push(cb);
    }
  }

  private emitChange() {
    this.changeSubscribers.forEach((fn) => {
      try {
        fn();
      } catch {
        /* no-op */
      }
    });
  }

  // Clear cached payload for a specific patient (when data is updated)
  private clearPatientPayloadCache(patientId: string) {
    if (this.cachedPatientPayloads[patientId]) {
      delete this.cachedPatientPayloads[patientId];
      delete this.payloadCacheTimestamps[patientId];
      console.log(`SupabaseDataService: Cleared cached payload for patient ${patientId}`);
    }
  }

  // Clear all cached payloads (useful for bulk operations)
  private clearAllPayloadCaches() {
    const clearedCount = Object.keys(this.cachedPatientPayloads).length;
    this.cachedPatientPayloads = {};
    this.payloadCacheTimestamps = {};
    if (clearedCount > 0) {
      console.log(`SupabaseDataService: Cleared ${clearedCount} cached patient payloads`);
    }
  }

  // Public method to manually clear a patient's cached payload
  public clearPatientCache(patientId: string): void {
    this.clearPatientPayloadCache(patientId);
  }

  // Public method to manually clear all cached payloads
  public clearAllCaches(): void {
    this.clearAllPayloadCaches();
  }

  async createNewPatient(input: { firstName: string; lastName: string; gender?: string; dateOfBirth?: string }): Promise<Patient> {
    const newId = crypto.randomUUID();

    const { error: insertErr } = await this.supabase.from('patients').insert([
      {
        patient_id: newId,
        first_name: input.firstName,
        last_name: input.lastName,
        gender: input.gender ?? null,
        birth_date: input.dateOfBirth ?? null,
        name: `${input.firstName} ${input.lastName}`.trim(),
      },
    ]);

    if (insertErr) {
      console.error('SupabaseDataService: Failed to insert new patient', insertErr);
      throw insertErr;
    }

    const patient: Patient = {
      id: newId,
      firstName: input.firstName,
      lastName: input.lastName,
      name: `${input.firstName} ${input.lastName}`.trim(),
      gender: input.gender,
      dateOfBirth: input.dateOfBirth,
      alerts: [],
          } as Patient;
      this.patients[newId] = patient;
      this.encountersByPatient[newId] = [];
      this.emitChange();
      return patient;
  }

  async createNewPatientWithEncounter(
    patientInput: { firstName: string; lastName: string; gender?: string; dateOfBirth?: string },
    encounterInput?: { reason?: string; scheduledStart?: string; scheduledEnd?: string; duration?: number }
  ): Promise<{ patient: Patient; encounter: Encounter }> {
    const patient = await this.createNewPatient(patientInput);
    const encounter = await this.createNewEncounter(patient.id, encounterInput);
    return { patient, encounter };
  }

  // ------------------------------------------------------------------
  // Soft delete helpers (in-memory updates; DB persistence TBD)
  // ------------------------------------------------------------------
  /**
   * Mark an encounter as deleted (soft delete).
   * Returns true if encounter exists and was marked deleted.
   */
  async markEncounterAsDeleted(patientId: string, encounterId: string): Promise<boolean> {
    // Handle both composite keys and Supabase UUIDs
    let compositeKey = encounterId;
    let encounter = this.encounters[encounterId];
    
    if (!encounter) {
      // Try to find by Supabase UUID
      const foundEntry = Object.entries(this.encounters).find(([key, enc]) => enc.id === encounterId);
      if (foundEntry) {
        compositeKey = foundEntry[0];
        encounter = foundEntry[1];
      }
    }
    
    if (!encounter || encounter.patientId !== patientId) {
      console.error(`SupabaseDataService: Encounter ${encounterId} not found or doesn't belong to patient ${patientId}`);
      return false;
    }
    
    if (encounter.isDeleted) {
      console.log(`SupabaseDataService: Encounter ${encounterId} already deleted`);
      return true; // already deleted
    }

    // Update in-memory cache first for immediate UI feedback
    const deletedAt = new Date().toISOString();
    encounter.isDeleted = true;
    encounter.deletedAt = deletedAt;

    // Persist to DB using the Supabase UUID
    try {
      const { error } = await this.supabase.from('encounters')
        .update({ 
          is_deleted: true,
          updated_at: deletedAt
        })
        .eq('id', encounter.id); // Use the Supabase UUID

      if (error) {
        console.error('SupabaseDataService: Failed to soft delete encounter in DB', error);
        // Revert in-memory changes on DB failure
        encounter.isDeleted = false;
        delete encounter.deletedAt;
        return false;
      }

      console.log(`SupabaseDataService: Successfully soft deleted encounter ${encounterId}`);
      this.clearPatientPayloadCache(patientId); // Clear cache when encounter is deleted
      this.emitChange();
      return true;
    } catch (error) {
      console.error('SupabaseDataService: Exception during soft delete', error);
      // Revert in-memory changes on exception
      encounter.isDeleted = false;
      delete encounter.deletedAt;
      return false;
    }
  }

  /** Restore a previously soft-deleted encounter */
  async restoreEncounter(patientId: string, encounterId: string): Promise<boolean> {
    // Handle both composite keys and Supabase UUIDs
    let compositeKey = encounterId;
    let encounter = this.encounters[encounterId];
    
    if (!encounter) {
      // Try to find by Supabase UUID
      const foundEntry = Object.entries(this.encounters).find(([key, enc]) => enc.id === encounterId);
      if (foundEntry) {
        compositeKey = foundEntry[0];
        encounter = foundEntry[1];
      }
    }
    
    if (!encounter || encounter.patientId !== patientId) {
      console.error(`SupabaseDataService: Encounter ${encounterId} not found or doesn't belong to patient ${patientId}`);
      return false;
    }
    
    if (!encounter.isDeleted) {
      console.log(`SupabaseDataService: Encounter ${encounterId} not deleted, nothing to restore`);
      return true; // already active
    }

    // Update in-memory cache first for immediate UI feedback
    encounter.isDeleted = false;
    delete encounter.deletedAt;

    // Persist to DB using the Supabase UUID
    try {
      const { error } = await this.supabase.from('encounters')
        .update({ 
          is_deleted: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', encounter.id); // Use the Supabase UUID

      if (error) {
        console.error('SupabaseDataService: Failed to restore encounter in DB', error);
        // Revert in-memory changes on DB failure
        encounter.isDeleted = true;
        encounter.deletedAt = new Date().toISOString();
        return false;
      }

      console.log(`SupabaseDataService: Successfully restored encounter ${encounterId}`);
      this.clearPatientPayloadCache(patientId); // Clear cache when encounter is restored
      this.emitChange();
      return true;
    } catch (error) {
      console.error('SupabaseDataService: Exception during restore', error);
      // Revert in-memory changes on exception
      encounter.isDeleted = true;
      encounter.deletedAt = new Date().toISOString();
      return false;
    }
  }

  /** Permanently remove an encounter from cache and database */
  async permanentlyDeleteEncounter(patientId: string, encounterId: string): Promise<boolean> {
    // Handle both composite keys and Supabase UUIDs
    let compositeKey = encounterId;
    let encounter = this.encounters[encounterId];
    
    if (!encounter) {
      // Try to find by Supabase UUID
      const foundEntry = Object.entries(this.encounters).find(([key, enc]) => enc.id === encounterId);
      if (foundEntry) {
        compositeKey = foundEntry[0];
        encounter = foundEntry[1];
      }
    }
    
    if (!encounter || encounter.patientId !== patientId) {
      console.error(`SupabaseDataService: Encounter ${encounterId} not found or doesn't belong to patient ${patientId}`);
      return false;
    }

    // Store references before deletion for potential rollback
    const encounterData = { ...encounter };
    const encountersByPatientRef = [...(this.encountersByPatient[patientId] || [])];

    // Remove from in-memory maps first for immediate UI update
    delete this.encounters[compositeKey];
    if (this.encountersByPatient[patientId]) {
      this.encountersByPatient[patientId] = this.encountersByPatient[patientId].filter(key => key !== compositeKey);
    }

    // Delete from DB using the Supabase UUID
    try {
      const { error } = await this.supabase.from('encounters')
        .delete()
        .eq('id', encounter.id); // Use the Supabase UUID

      if (error) {
        console.error('SupabaseDataService: Failed to permanently delete encounter from DB', error);
        // Rollback in-memory changes on DB failure
        this.encounters[compositeKey] = encounterData;
        this.encountersByPatient[patientId] = encountersByPatientRef;
        return false;
      }

      console.log(`SupabaseDataService: Successfully permanently deleted encounter ${encounterId}`);
      this.emitChange();
      return true;
    } catch (error) {
      console.error('SupabaseDataService: Exception during permanent delete', error);
      // Rollback in-memory changes on exception
      this.encounters[compositeKey] = encounterData;
      this.encountersByPatient[patientId] = encountersByPatientRef;
      return false;
    }
  }

  unsubscribe(cb: () => void) {
    this.changeSubscribers = this.changeSubscribers.filter(s => s !== cb);
    // console.log("SupabaseDataService (Prod Debug): Unsubscribed a callback. Total subscribers:", this.changeSubscribers.length);
  }

  /**
   * Clear demo patient data from cache when demo ends
   * This prevents demo patients from appearing in upcoming consultations after demo ends
   */
  clearDemoPatientData(demoPatientId: string): void {
    console.log(`SupabaseDataService: Clearing demo patient data for ${demoPatientId}`);
    
    // Remove patient from cache
    if (this.patients[demoPatientId]) {
      delete this.patients[demoPatientId];
    }

    // Remove all encounters for this patient
    const patientEncounters = this.encountersByPatient[demoPatientId] || [];
    patientEncounters.forEach(compositeKey => {
      delete this.encounters[compositeKey];
    });

    // Clear patient encounter mapping
    delete this.encountersByPatient[demoPatientId];

    // Clear diagnoses and lab results
    delete this.diagnoses[demoPatientId];
    delete this.labResults[demoPatientId];
    delete this.differentialDiagnoses[demoPatientId];

    // Remove from UUID mapping
    const uuidToRemove = Object.keys(this.patientUuidToOriginalId).find(
      uuid => this.patientUuidToOriginalId[uuid] === demoPatientId
    );
    if (uuidToRemove) {
      delete this.patientUuidToOriginalId[uuidToRemove];
    }

    console.log(`SupabaseDataService: Demo patient ${demoPatientId} cleared from cache`);
    this.emitChange();
  }

  /**
   * Force refresh a specific patient's data by clearing their cache and reloading
   * Useful for debugging or when database changes need to be reflected immediately
   */
  async forceRefreshPatient(patientId: string): Promise<void> {
    console.log(`SupabaseDataService: Force refreshing patient ${patientId} with parallel fetching`);
    
    // Clear cached payload first
    this.clearPatientPayloadCache(patientId);
    
    // Clear patient from cache (similar to clearDemoPatientData but for any patient)
    if (this.patients[patientId]) {
      delete this.patients[patientId];
    }

    // Remove all encounters for this patient
    const patientEncounters = this.encountersByPatient[patientId] || [];
    patientEncounters.forEach(compositeKey => {
      delete this.encounters[compositeKey];
    });

    // Clear patient encounter mapping
    delete this.encountersByPatient[patientId];

    // Clear diagnoses and lab results
    delete this.diagnoses[patientId];
    delete this.labResults[patientId];
    delete this.differentialDiagnoses[patientId];

    // Remove from UUID mapping
    const uuidToRemove = Object.keys(this.patientUuidToOriginalId).find(
      uuid => this.patientUuidToOriginalId[uuid] === patientId
    );
    if (uuidToRemove) {
      delete this.patientUuidToOriginalId[uuidToRemove];
    }

    // Remove any pending load promises to force fresh load
    this.singlePatientLoadPromises.delete(patientId);

    console.log(`SupabaseDataService: Patient ${patientId} cleared from cache, reloading with parallel fetching...`);
    
    // Force reload the patient data with parallel fetching and caching
    await this.loadSinglePatientData(patientId);
    
    console.log(`SupabaseDataService: Patient ${patientId} successfully refreshed with new cached payload`);
    this.emitChange();
  }

  getPatientDiagnoses(patientId: string): Diagnosis[] {
    return this.diagnoses[patientId] || [];
  }

  getPatientLabResults(patientId: string): LabResult[] {
    return this.labResults[patientId] || [];
  }

  getDiagnosesForEncounter(patientId: string, encounterId: string): Diagnosis[] {
    const patientDiagnoses = this.diagnoses[patientId] || [];
    
    // Filter by Supabase UUID (encounter_id in database is a UUID foreign key)
    const filtered = patientDiagnoses.filter(dx => dx.encounterId === encounterId);
    return filtered;
  }

  getLabResultsForEncounter(patientId: string, encounterId: string): LabResult[] {
    const patientLabs = this.labResults[patientId] || [];
    
    // Filter by Supabase UUID (encounter_id in database is a UUID foreign key)
    const filtered = patientLabs.filter(lab => lab.encounterId === encounterId);
    return filtered;
  }

  // Differential Diagnoses methods
  getDifferentialDiagnoses(): DifferentialDiagnosisRecord[] {
    // Return all differential diagnoses across all patients for the API
    return Object.values(this.differentialDiagnoses).flat();
  }

  getPatientDifferentialDiagnoses(patientId: string): DifferentialDiagnosisRecord[] {
    return this.differentialDiagnoses[patientId] || [];
  }

  getDifferentialDiagnosesForEncounter(patientId: string, encounterId: string): DifferentialDiagnosisRecord[] {
    const allDiffs = this.differentialDiagnoses[patientId] || [];
    return allDiffs.filter(diff => diff.encounter_id === encounterId);
  }

  async saveDifferentialDiagnoses(
    patientId: string, 
    encounterId: string, 
    differentials: DifferentialDiagnosis[]
  ): Promise<void> {
    try {
      // Get patient UUID
      const patient = this.patients[patientId];
      if (!patient) {
        throw new Error(`Patient ${patientId} not found`);
      }

      const patientUuid = Object.keys(this.patientUuidToOriginalId).find(
        uuid => this.patientUuidToOriginalId[uuid] === patientId
      );

      if (!patientUuid) {
        throw new Error(`Patient UUID not found for ${patientId}`);
      }

      // Get encounter UUID
      const encounter = this.encounters[`${patientId}_${encounterId}`];
      if (!encounter) {
        throw new Error(`Encounter ${encounterId} not found for patient ${patientId}`);
      }

      // Delete existing differential diagnoses for this encounter
      await this.supabase
        .from('differential_diagnoses')
        .delete()
        .eq('patient_id', patientUuid)
        .eq('encounter_id', encounter.id);

      // Insert new differential diagnoses
      if (differentials.length > 0) {
        const records = differentials.map((diff, index) => ({
          patient_id: patientUuid,
          encounter_id: encounter.id,
          diagnosis_name: diff.name,
          likelihood: diff.likelihood,
          key_factors: diff.keyFactors,
          rank_order: index + 1
        }));

        const { error } = await this.supabase
          .from('differential_diagnoses')
          .insert(records);

        if (error) {
          throw error;
        }

        // Update local cache
        const newRecords: DifferentialDiagnosisRecord[] = records.map(record => ({
          id: '', // Will be filled by database
          patient_id: record.patient_id,
          encounter_id: record.encounter_id,
          diagnosis_name: record.diagnosis_name,
          likelihood: record.likelihood,
          key_factors: record.key_factors,
          rank_order: record.rank_order,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        if (!this.differentialDiagnoses[patientId]) {
          this.differentialDiagnoses[patientId] = [];
        }

        // Remove old records for this encounter and add new ones
        this.differentialDiagnoses[patientId] = this.differentialDiagnoses[patientId]
          .filter(diff => diff.encounter_id !== encounter.id)
          .concat(newRecords);
      }

      this.emitChange();
    } catch (error) {
      console.error('Error saving differential diagnoses:', error);
      throw error;
    }
  }

  async savePrimaryDiagnosis(
    patientId: string, 
    encounterId: string, 
    diagnosisName: string,
    diagnosisCode?: string
  ): Promise<void> {
    try {
      // Get patient UUID
      const patient = this.patients[patientId];
      if (!patient) {
        throw new Error(`Patient ${patientId} not found`);
      }

      const patientUuid = Object.keys(this.patientUuidToOriginalId).find(
        uuid => this.patientUuidToOriginalId[uuid] === patientId
      );

      if (!patientUuid) {
        throw new Error(`Patient UUID not found for ${patientId}`);
      }

      // Get encounter UUID
      const encounter = this.encounters[`${patientId}_${encounterId}`];
      if (!encounter) {
        throw new Error(`Encounter ${encounterId} not found for patient ${patientId}`);
      }

      // Delete existing primary diagnosis for this encounter (encounter-diagnosis category)
      await this.supabase
        .from('conditions')
        .delete()
        .eq('patient_id', patientUuid)
        .eq('encounter_id', encounter.id)
        .eq('category', 'encounter-diagnosis');

      // Insert new primary diagnosis if provided
      if (diagnosisName && diagnosisName.trim()) {
        const { error } = await this.supabase
          .from('conditions')
          .insert({
            patient_id: patientUuid,
            encounter_id: encounter.id,
            code: diagnosisCode || '',
            description: diagnosisName,
            category: 'encounter-diagnosis',
            clinical_status: 'active',
            verification_status: 'confirmed'
          });

        if (error) {
          throw error;
        }

        // Update local cache
        if (!this.diagnoses[patientId]) {
          this.diagnoses[patientId] = [];
        }

        // Remove old primary diagnosis for this encounter and add new one
        this.diagnoses[patientId] = this.diagnoses[patientId]
          .filter(dx => !(dx.encounterId === encounter.id && dx.code === 'encounter-diagnosis'))
          .concat([{
            patientId: patientId,
            encounterId: encounter.id,
            code: diagnosisCode || '',
            description: diagnosisName
          }]);
      }

      this.emitChange();
    } catch (error) {
      console.error('Error saving primary diagnosis:', error);
      throw error;
    }
  }

  // ======================= NEW CACHE REFRESH HELPERS =======================
  /**
   * Update (or insert) a single encounter in the in-memory cache using a freshly-fetched
   * database row. This avoids the heavy-handed clear→reload cycle and enables very fast
   * UI updates after inline edits.
   */
  public updateEncounterCacheFromDBRow(row: any): void {
    if (!row) return;

    const encounterSupabaseUUID = row.id;
    const encounterBusinessKey = row.encounter_id;
    const patientSupabaseUUID = row.patient_supabase_id;

    if (!encounterBusinessKey || !patientSupabaseUUID) {
      console.warn('updateEncounterCacheFromDBRow: missing encounter_id or patient_supabase_id');
      return;
    }

    const patientPublicId = this.patientUuidToOriginalId[patientSupabaseUUID];
    if (!patientPublicId) {
      console.warn(`updateEncounterCacheFromDBRow: patient UUID ${patientSupabaseUUID} not mapped to public id`);
      return;
    }

    const compositeKey = `${patientPublicId}_${encounterBusinessKey}`;

    const newEncounter: Encounter = {
      id: encounterSupabaseUUID,
      encounterIdentifier: encounterBusinessKey,
      patientId: patientPublicId,
      scheduledStart: row.scheduled_start_datetime ? new Date(row.scheduled_start_datetime).toISOString() : '',
      scheduledEnd: row.scheduled_end_datetime ? new Date(row.scheduled_end_datetime).toISOString() : '',
      actualStart: row.actual_start_datetime ? new Date(row.actual_start_datetime).toISOString() : undefined,
      actualEnd: row.actual_end_datetime ? new Date(row.actual_end_datetime).toISOString() : undefined,
      reasonCode: row.reason_code,
      reasonDisplayText: row.reason_display_text,
      transcript: row.transcript,
      observations: row.observations || undefined,
      soapNote: row.soap_note,
      treatments: row.treatments || undefined,
      // === Rich content fields ===
      diagnosis_rich_content: row.diagnosis_rich_content || undefined,
      treatments_rich_content: row.treatments_rich_content || undefined,
      priorAuthJustification: row.prior_auth_justification,
      insuranceStatus: row.insurance_status,
      isDeleted: !!row.is_deleted,
      deletedAt: row.updated_at && row.is_deleted ? new Date(row.updated_at).toISOString() : undefined,
      extra_data: row.extra_data || undefined,
    } as Encounter;

    this.encounters[compositeKey] = newEncounter;
    if (!this.encountersByPatient[patientPublicId]) {
      this.encountersByPatient[patientPublicId] = [];
    }
    if (!this.encountersByPatient[patientPublicId].includes(compositeKey)) {
      this.encountersByPatient[patientPublicId].push(compositeKey);
    }

    this.emitChange();
  }

  /**
   * Restore (un-delete) every encounter for the given patient that was soft-deleted on the
   * specified calendar day. Returns the number of encounters successfully restored.
   */
  public async restoreDeletedEncountersForPatientOnDate(patientId: string, isoDate: string): Promise<number> {
    const datePart = isoDate.split('T')[0]; // YYYY-MM-DD

    // Ensure we have fresh data for the patient
    try {
      await this.loadSinglePatientData(patientId);
    } catch (e) {
      // Fallback to full reload if single-patient fetch fails
      await this.loadPatientData();
    }

    const encounters = this.getPatientEncounters(patientId, true /* includeDeleted */);
    let restored = 0;
    for (const enc of encounters) {
      if (!enc.isDeleted || !enc.deletedAt) continue;
      if (!enc.deletedAt.startsWith(datePart)) continue;

      const ok = await this.restoreEncounter(patientId, enc.id);
      if (ok) restored++;
    }

    return restored;
  }
}

// Export as singleton consistent with legacy implementation
export const supabaseDataService = new SupabaseDataService();

// Expose service globally for debugging in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).supabaseDataService = supabaseDataService;
  (window as any).forceRefreshDorothy = () => supabaseDataService.forceRefreshPatient('0681FA35-A794-4684-97BD-00B88370DB41');
}