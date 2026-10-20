-- Migration: Insert Dorothy Robinson seed data (safe, idempotent)
-- Description: Adds patient, one enriched encounter, primary diagnosis, and a complex-case alert for Dorothy Robinson without touching existing records.
-- NOTE: All inserts use existence checks to remain idempotent and avoid overwriting data.

DO $seed$
DECLARE
  v_patient_uuid UUID; -- Supabase internal UUID for Dorothy after insert/find
  v_encounter_uuid UUID; -- Will hold newly inserted encounter UUID (if needed)
BEGIN
  ------------------------------------------------------------------
  -- 1. Insert Patient row ----------------------------------------------------
  ------------------------------------------------------------------
  IF NOT EXISTS (
    SELECT 1 FROM public.patients WHERE patient_id = '0681FA35-A794-4684-97BD-00B88370DB41'
  ) THEN
    INSERT INTO public.patients (
      patient_id, first_name, last_name, gender, birth_date,
      race, ethnicity, marital_status, language,
      poverty_percentage, photo_url, alerts, extra_data
    ) VALUES (
      '0681FA35-A794-4684-97BD-00B88370DB41',
      'Dorothy',
      'Robinson',
      'female',
      '1978-10-02',
      'White',
      'Hispanic or Latino',
      'Unknown',
      'Spanish',
      19.16,
      'https://ui-avatars.com/api/?name=DR&background=D0F0C0&color=ffffff&size=60&rounded=true',
      '[{"id":"0681FA35-A794-4684-97BD-00B88370DB41_malignancy_history","patientId":"0681FA35-A794-4684-97BD-00B88370DB41","msg":"History of acute myelomonocytic leukemia in complete remission; higher risk of secondary malignancies and infection.","type":"oncology","severity":"moderate","triggeringFactors":["Previous AML","Immunocompromised history"],"suggestedActions":["Monitor for infection signs","Regular oncology follow-up"],"createdAt":"2025-01-15T09:00:00Z","confidence":95,"likelihood":4,"conditionType":"Cancer History"}]'::jsonb,
      jsonb_build_object(
        'nextAppointment', '2025-07-01T10:00:00Z',
        'reason', 'Oncology follow-up and general health maintenance'
      )
    );
  END IF;

  -- Retrieve patient UUID into variable
  SELECT id INTO v_patient_uuid FROM public.patients WHERE patient_id = '0681FA35-A794-4684-97BD-00B88370DB41';

  ------------------------------------------------------------------
  -- 2. Insert Encounter row ---------------------------------------------------
  ------------------------------------------------------------------
  IF v_patient_uuid IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.encounters 
    WHERE encounter_id = 'ENC-0681FA35-A794-4684-97BD-00B88370DB41-003'
      AND patient_supabase_id = v_patient_uuid
  ) THEN
    INSERT INTO public.encounters (
      encounter_id, patient_supabase_id, encounter_type, status,
      scheduled_start_datetime, scheduled_end_datetime,
      actual_start_datetime, actual_end_datetime,
      reason_code, reason_display_text,
      transcript, soap_note, treatments,
      diagnosis_rich_content, treatments_rich_content
    ) VALUES (
      'ENC-0681FA35-A794-4684-97BD-00B88370DB41-003',
      v_patient_uuid,
      'ambulatory',
      'finished',
      '2025-05-17T14:11:57.063Z',
      '2025-05-17T14:56:57.063Z',
      '2025-05-17T14:11:57.063Z',
      '2025-05-17T14:56:57.063Z',
      'E11.9',
      'Type 2 diabetes mellitus without complications',
      $$Dr. Chen: Good afternoon, Ms. Robinson. I'm Dr. Chen. I see you're here for your diabetes follow-up. How have you been feeling lately?

Patient: Hi doctor. I've been having some issues. My blood sugars have been all over the place, and I've been getting these dizzy spells, especially when I stand up.

[... Transcript truncated to fit migration for brevity ...]$$,
      $$S: 46-year-old female with Type 2 diabetes mellitus presents with orthostatic dizziness, increased urination, thirst, and easy bruising. Currently taking metformin 1000mg BID and glyburide (started 3 weeks ago) for diabetes, plus warfarin for history of DVT. Reports recent nosebleed and multiple bruises. Last INR check 2 months ago, no recent diabetes monitoring labs. Broken glucometer, not checking blood sugars at home.

O: Vital signs: BP 95/60 (orthostatic to 85/55), HR 88, Temp 98.6°F, RR 16. General: Alert, mildly dehydrated appearance. [... SOAP note truncated ...]$$,
      $$[
        {"drug":"Discontinue warfarin immediately","status":"Discontinued","rationale":"Immediate cessation of warfarin is essential to stop further anticoagulation contributing to bleeding"},
        {"drug":"Vitamin K (Phytonadione) 5-10 mg IV once","status":"Prescribed","rationale":"Rapidly reverses warfarin effect by restoring vitamin K-dependent clotting factors; IV route preferred for serious bleeding due to faster onset"},
        {"drug":"4-factor Prothrombin Complex Concentrates (PCC) 25-50 units/kg IV once","status":"Prescribed","rationale":"Provides rapid replacement of vitamin K-dependent factors II, VII, IX, and X for prompt reversal of anticoagulation; preferred over FFP due to faster INR correction and lower infusion volume"},
        {"drug":"Fresh Frozen Plasma (FFP) 10-15 mL/kg IV if PCC unavailable","status":"Alternative","rationale":"Alternative coagulation factor replacement; slower onset and requires large volume infusion; carries risk of volume overload"},
        {"drug":"Hold glyburide immediately","status":"Discontinued","rationale":"Glyburide potentiates bleeding risk by interaction with warfarin and causes hypoglycemia; hold to prevent further adverse effects"},
        {"drug":"Supportive care as clinically indicated","status":"Ongoing","rationale":"Maintain hemodynamic stability with fluids and blood transfusions as needed; localized hemostasis if applicable"}
      ]$$::jsonb,
      -- Minimal rich diagnosis content
      $${"content_type":"text/plain","text_content":"Warfarin-induced hemorrhagic disorder with bleeding tendency requiring immediate anticoagulation reversal and medication adjustment","version":"1.0"}$$::jsonb,
      -- Minimal rich treatment content
      $${"content_type":"text/plain","text_content":"See comprehensive treatment plan in transcript","version":"1.0"}$$::jsonb
    ) RETURNING id INTO v_encounter_uuid;
  END IF;

  ------------------------------------------------------------------
  -- 3. Insert Primary Diagnosis into conditions table ------------------------
  ------------------------------------------------------------------
  IF v_patient_uuid IS NOT NULL AND v_encounter_uuid IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.conditions 
    WHERE patient_id = v_patient_uuid AND encounter_id = v_encounter_uuid AND code = 'D68.32'
  ) THEN
    INSERT INTO public.conditions (
      patient_id, encounter_id, code, description, category, clinical_status, verification_status, onset_date, note
    ) VALUES (
      v_patient_uuid,
      v_encounter_uuid,
      'D68.32',
      'Warfarin-induced hemorrhagic disorder with bleeding tendency requiring immediate anticoagulation reversal and medication adjustment',
      'encounter-diagnosis',
      'active',
      'confirmed',
      '2025-05-17',
      'Primary diagnosis added from demo seed migration'
    );
  END IF;

  ------------------------------------------------------------------
  -- 4. Insert Complex Case Alert into unified alerts table -------------------
  ------------------------------------------------------------------
  IF v_patient_uuid IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.alerts 
    WHERE patient_id = v_patient_uuid AND title = 'Possible Systemic Lupus Erythematosus'
  ) THEN
    INSERT INTO public.alerts (
      patient_id, encounter_id, alert_type, severity, category,
      title, message, suggestion, confidence_score, source_reasoning, processing_model,
      context_data, status, is_post_consultation
    ) VALUES (
      v_patient_uuid,
      NULL,
      'COMPLEX_CONDITION',
      'CRITICAL',
      'complex_case',
      'Possible Systemic Lupus Erythematosus',
      'Patient presents with classic lupus triad: photosensitive malar rash, polyarthritis, and constitutional symptoms. Combined with positive ANA and low complement levels, this strongly suggests SLE requiring urgent rheumatology evaluation.',
      'URGENT rheumatology referral (within 1-2 weeks). Order anti-dsDNA, anti-Sm antibodies, complete urinalysis with microscopy, and monitor for renal involvement.',
      0.88,
      'Patient meets multiple SLE criteria (malar rash, oral ulcers, arthritis, positive ANA, low complement). Early diagnosis and treatment are crucial for preventing organ damage.',
      'clinical-pattern-recognition',
      '{"triggeringFactors":["Photosensitive facial rash","Polyarthritis (hands, wrists, knees)","Constitutional symptoms (fatigue, fever)","Positive ANA (1:320, homogeneous pattern)","Low complement levels (C3, C4)"]}'::jsonb,
      'active',
      true
    );
  END IF;
END;
$seed$ LANGUAGE plpgsql;