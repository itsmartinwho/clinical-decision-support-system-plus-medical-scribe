'use client';

import { useState, useCallback } from 'react';
import { supabaseDataService } from '@/lib/supabaseDataService';
import { getSupabaseClient } from '@/lib/supabaseClient';
import type { Encounter } from '@/lib/types';

interface EditableFieldUpdate {
  reasonDisplayText?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  soapNote?: string;
  transcript?: string;
  priorAuthJustification?: string;
  insuranceStatus?: string;
  treatments?: any; // JSONB - can be any valid JSON
  observations?: string[]; // TEXT[] array
  extraData?: any; // JSONB - can be any valid JSON
}

interface UseEditableEncounterFieldsOptions {
  patientId: string;
  encounterId: string;
  onSuccess?: (updatedEncounter: Encounter) => void;
  onError?: (error: Error) => void;
}

export function useEditableEncounterFields({
  patientId,
  encounterId,
  onSuccess,
  onError,
}: UseEditableEncounterFieldsOptions) {
  const [isSaving, setIsSaving] = useState(false);

  // Helper function to update extra_data with latest encounter fields
  const updateExtraData = useCallback(async (encounterUuid: string, updatedFields: EditableFieldUpdate) => {
    try {
      // Get current encounter data
      const { data: currentEncounter, error: fetchError } = await getSupabaseClient()
        .from('encounters')
        .select('*')
        .eq('id', encounterUuid)
        .single();

      if (fetchError || !currentEncounter) {
        console.warn('Could not fetch encounter for extra_data update:', fetchError);
        return;
      }

      // Create comprehensive extra_data object with all current encounter data
      const extraData = {
        encounter_id: currentEncounter.encounter_id,
        encounter_type: currentEncounter.encounter_type,
        status: currentEncounter.status,
        scheduled_start_datetime: currentEncounter.scheduled_start_datetime,
        scheduled_end_datetime: currentEncounter.scheduled_end_datetime,
        actual_start_datetime: currentEncounter.actual_start_datetime,
        actual_end_datetime: currentEncounter.actual_end_datetime,
        reason_code: currentEncounter.reason_code,
        reason_display_text: currentEncounter.reason_display_text,
        transcript: currentEncounter.transcript,
        soap_note: currentEncounter.soap_note,
        treatments: currentEncounter.treatments,
        observations: currentEncounter.observations,
        prior_auth_justification: currentEncounter.prior_auth_justification,
        insurance_status: currentEncounter.insurance_status,
        updated_at: new Date().toISOString(),
        // Merge any additional updated fields
        ...updatedFields,
      };

      // Update extra_data field
      const { error: updateError } = await getSupabaseClient()
        .from('encounters')
        .update({ 
          extra_data: extraData,
          updated_at: new Date().toISOString()
        })
        .eq('id', encounterUuid);

      if (updateError) {
        console.warn('Failed to update extra_data:', updateError);
      }
    } catch (error) {
      console.warn('Error updating extra_data:', error);
    }
  }, []);

  const updateField = useCallback(async (
    fieldName: keyof EditableFieldUpdate,
    newValue: any
  ): Promise<void> => {
    setIsSaving(true);

    try {
      // Find the encounter data from the data service
      const patientData = await supabaseDataService.getPatientData(patientId);
      
      if (!patientData) {
        throw new Error('Patient data not found');
      }

      const encounterData = patientData.encounters.find(
        ew => ew.encounter.encounterIdentifier === encounterId || ew.encounter.id === encounterId
      )?.encounter;
      
      if (!encounterData) {
        throw new Error('Encounter not found');
      }

      const encounterUuid = encounterData.id;

      // Prepare the update object with proper database column names
      const updateData: Record<string, any> = {};
      
      switch (fieldName) {
        case 'reasonDisplayText':
          updateData.reason_display_text = newValue;
          break;
        case 'scheduledStart':
          updateData.scheduled_start_datetime = newValue;
          break;
        case 'scheduledEnd':
          updateData.scheduled_end_datetime = newValue;
          break;
        case 'actualStart':
          updateData.actual_start_datetime = newValue;
          break;
        case 'actualEnd':
          updateData.actual_end_datetime = newValue;
          break;
        case 'soapNote':
          updateData.soap_note = newValue;
          break;
        case 'transcript':
          updateData.transcript = newValue;
          break;
        case 'priorAuthJustification':
          updateData.prior_auth_justification = newValue;
          break;
        case 'insuranceStatus':
          updateData.insurance_status = newValue;
          break;
        case 'treatments':
          updateData.treatments = newValue;
          break;
        case 'observations':
          updateData.observations = newValue;
          break;
        case 'extraData':
          updateData.extra_data = newValue;
          break;
        default:
          throw new Error(`Unknown field: ${fieldName}`);
      }

      updateData.updated_at = new Date().toISOString();

      // Update the encounter in the database
      const { data, error } = await getSupabaseClient()
        .from('encounters')
        .update(updateData)
        .eq('id', encounterUuid)
        .select()
        .single();

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }

      // NEW: Update local cache directly instead of clearing everything
      if (data) {
        supabaseDataService.updateEncounterCacheFromDBRow(data);
      }

      // Update extra_data with the latest field values
      await updateExtraData(encounterUuid, { [fieldName]: newValue });

      // Trigger change subscribers to update UI (lightweight)
      const changeEvent = new CustomEvent('supabase-data-change', { 
        detail: { patientId, encounterId, fieldName, newValue } 
      });
      window.dispatchEvent(changeEvent);

      // Get the updated encounter data after cache refresh
      const updatedPatientData = await supabaseDataService.getPatientData(patientId);
      const updatedEncounterData = updatedPatientData?.encounters.find(
        ew => ew.encounter.encounterIdentifier === encounterId || ew.encounter.id === encounterId
      )?.encounter;
      
      if (updatedEncounterData && onSuccess) {
        onSuccess(updatedEncounterData);
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error occurred');
      console.error('Failed to update encounter field:', errorObj);
      
      if (onError) {
        onError(errorObj);
      }
    } finally {
      setIsSaving(false);
    }
  }, [patientId, encounterId, onSuccess, onError, updateExtraData]);

  // Batch update multiple fields at once
  const updateFields = useCallback(async (
    fields: EditableFieldUpdate
  ): Promise<void> => {
    setIsSaving(true);

    try {
      // Find the encounter data from the data service
      const patientData = await supabaseDataService.getPatientData(patientId);
      
      if (!patientData) {
        throw new Error('Patient data not found');
      }

      const encounterData = patientData.encounters.find(
        ew => ew.encounter.encounterIdentifier === encounterId || ew.encounter.id === encounterId
      )?.encounter;
      
      if (!encounterData) {
        throw new Error('Encounter not found');
      }

      const encounterUuid = encounterData.id;

      // Prepare the update object with proper database column names
      const updateData: Record<string, any> = {};
      
      if (fields.reasonDisplayText !== undefined) {
        updateData.reason_display_text = fields.reasonDisplayText;
      }
      if (fields.scheduledStart !== undefined) {
        updateData.scheduled_start_datetime = fields.scheduledStart;
      }
      if (fields.scheduledEnd !== undefined) {
        updateData.scheduled_end_datetime = fields.scheduledEnd;
      }
      if (fields.actualStart !== undefined) {
        updateData.actual_start_datetime = fields.actualStart;
      }
      if (fields.actualEnd !== undefined) {
        updateData.actual_end_datetime = fields.actualEnd;
      }
      if (fields.soapNote !== undefined) {
        updateData.soap_note = fields.soapNote;
      }
      if (fields.transcript !== undefined) {
        updateData.transcript = fields.transcript;
      }
      if (fields.priorAuthJustification !== undefined) {
        updateData.prior_auth_justification = fields.priorAuthJustification;
      }
      if (fields.insuranceStatus !== undefined) {
        updateData.insurance_status = fields.insuranceStatus;
      }
      if (fields.treatments !== undefined) {
        updateData.treatments = fields.treatments;
      }
      if (fields.observations !== undefined) {
        updateData.observations = fields.observations;
      }
      if (fields.extraData !== undefined) {
        updateData.extra_data = fields.extraData;
      }

      updateData.updated_at = new Date().toISOString();

      // Update the encounter in the database
      const { data, error } = await getSupabaseClient()
        .from('encounters')
        .update(updateData)
        .eq('id', encounterUuid)
        .select()
        .single();

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }

      // NEW: Update local cache directly instead of clearing everything
      if (data) {
        supabaseDataService.updateEncounterCacheFromDBRow(data);
      }

      // Update extra_data with the latest field values
      await updateExtraData(encounterUuid, fields);

      // Trigger change subscribers to update UI (lightweight)
      const changeEvent = new CustomEvent('supabase-data-change', { 
        detail: { patientId, encounterId, fields } 
      });
      window.dispatchEvent(changeEvent);

      // Get the updated encounter data after cache refresh
      const updatedPatientData = await supabaseDataService.getPatientData(patientId);
      const updatedEncounterData = updatedPatientData?.encounters.find(
        ew => ew.encounter.encounterIdentifier === encounterId || ew.encounter.id === encounterId
      )?.encounter;
      
      if (updatedEncounterData && onSuccess) {
        onSuccess(updatedEncounterData);
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error occurred');
      console.error('Failed to update encounter fields:', errorObj);
      
      if (onError) {
        onError(errorObj);
      }
    } finally {
      setIsSaving(false);
    }
  }, [patientId, encounterId, onSuccess, onError, updateExtraData]);

  return {
    updateField,
    updateFields,
    isSaving,
  };
} 