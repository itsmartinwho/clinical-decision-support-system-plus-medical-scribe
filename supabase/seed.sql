-- Seed: one synthetic patient, Dorothy Robinson, and four encounters.
-- Her id comes from EMRBots' artificial 100-patient dataset; her name and all
-- the clinical content were generated for this prototype. None of it is real.
--
-- The Supabase CLI runs this after the migrations on `supabase db reset`. In the
-- SQL editor, run it after the migrations: 20250227153000_insert_dorothy_robinson.sql
-- makes the patient row this script fills in.
--
-- The script performs the following actions:
-- 1. Updates the `patients` table with the new patient details.
-- 2. Iterates through each encounter in the JSON:
--    - Upserts the encounter data into the `encounters` table (updates if it exists, inserts if not).
--    - Upserts associated `conditions` and `lab_results`.
--    - Deletes and re-inserts `differential_diagnoses` for the encounter.
--
-- This script is transactional, meaning all changes will be applied, or none at all if an error occurs.

DO $$
DECLARE
    -- The enriched JSON data for the patient.
    -- The JSON is wrapped in dollar-quoting ($json$ ... $json$) to avoid issues with single quotes.
    enriched_data JSONB := $json$
[
  {
    "patient_complete_data": {
      "patient_id": "0681FA35-A794-4684-97BD-00B88370DB41",
      "first_name": "Dorothy",
      "last_name": "Robinson",
      "gender": "female",
      "birth_date": "1978-10-02",
      "race": "Asian",
      "ethnicity": "Not Hispanic or Latino",
      "marital_status": "Unknown",
      "language": "Spanish",
      "poverty_percentage": 19.16,
      "photo_url": "https://ui-avatars.com/api/?name=DR&background=D0F0C0&color=ffffff&size=60&rounded=true",
      "alerts": [
        {
          "id": "0681FA35-A794-4684-97BD-00B88370DB41_malignancy_history",
          "patientId": "0681FA35-A794-4684-97BD-00B88370DB41",
          "msg": "History of acute myelomonocytic leukemia in complete remission; higher risk of secondary malignancies and infection.",
          "severity": "moderate"
        }
      ],
      "encounters": [
        {
          "encounter_id": "0732cd0f-8448-42d9-b22c-8cd43032b91a",
          "encounter_business_id": "ENC-0681FA35-A794-4684-97BD-00B88370DB41-002",
          "encounter_type": "urgent-care",
          "status": "finished",
          "scheduled_start_datetime": "2025-01-23T14:11:57.063+00:00",
          "scheduled_end_datetime": "2025-01-23T15:11:57.063+00:00",
          "actual_start_datetime": "2025-01-23T14:11:57.063+00:00",
          "actual_end_datetime": "2025-01-23T14:56:57.063+00:00",
          "reason_code": "R50.9",
          "reason_display_text": "Fever, unspecified",
          "transcript": "Clinician (Dr. Ibarra): Buenas tardes, Dorothy. Veo que programó esta visita por fiebre. Cuénteme detalladamente qué ha estado sucediendo.\n\nPatient (interpretado del español): Desde hace tres días empecé con escalofríos por la noche, temperaturas de hasta 38.2 °C (100.8 °F). Tomo paracetamol y baja un poco, pero al día siguiente vuelve. No tengo tos ni dolor de garganta. Tengo dolores musculares y cierto cansancio.\n\nClinician: ¿Ha estado en contacto con alguien enfermo o ha viajado recientemente?\nPatient: No he viajado. Mi hija tuvo un resfriado leve la semana pasada. No pensé en contagiarme porque ella se recuperó rápido.\n\nClinician: ¿Ha tenido síntomas gastrointestinales o urinarios? Náuseas, vómitos, diarrea, dolor al orinar?\nPatient: Nada de eso. Orino normal y no tengo diarrea.\n\nClinician: Revisemos sus antecedentes. Sé que tuvo leucemia hace años. ¿Ha recibido quimioterapia o algún tratamiento inmunosupresor recientemente?\nPatient: No, terminé mi terapia de mantenimiento en 1998. Mi último hemograma fue en noviembre y estaba bien.\n\nClinician: Perfecto. Vamos a revisar signos vitales y hacer un examen físico.\n\n—Examen físico:\nGeneral: Paciente alerta, orientada, algo cansada, sin signos de angustia aguda.\nSignos vitales: PA 118/78 mmHg, FC 94 lpm, FR 18 rpm, SpO₂ 98% en aire ambiente, Temp oral 38.0 °C.\nHEENT: Membranas mucosas húmedas, faringe sin eritema, amígdalas sin exudado.\nCuello: Blando, sin rigidez nucal.\nTórax: Murmullo vesicular claro bilateralmente.\nCorazón: Ritmo regular, sin soplos.\nAbdomen: Blando, no doloroso a la palpación, sin masas, no organomegalia.\nPiel: Sin exantema, sin petequias.\nNeurológico: Pares craneales II-XII íntegros, no focalizaciones.\n\nClinician: Su examen es benigno. Solicitaremos hemograma completo, panel metabólico, proteína C reactiva y PCR respiratorio para influenza y COVID. Mientras tanto, hablemos del plan.\n\nPatient: Está bien.\n\nClinician: Dado que no hay foco claro de infección, probablemente sea un síndrome viral. Debido a su historia de leucemia, revisaremos resultados urgentes.\n\n—54 minutos después, resultados disponibles:\n* Hemograma: leucocitos 7.1 × 10^9/L (VN 4.0–11.0), neutrófilos 60%, linfocitos 30%.\n* PCR: Influenza A/B negativo, COVID-19 negativo.\n* Proteína C reactiva: 4 mg/L (VN <5).\n* CMP: dentro de límites normales.\n\nClinician: Dorothy, todos sus estudios salen normales. No hay indicios de infección bacteriana ni complicaciones. Mi impresión es fiebre de origen viral autolimitado.\n\nPatient: ¿Debo preocuparme por recaer en leucemia?\n\nClinician: Su conteo está estable y no hay signos de recaída. Seguiremos con medidas sintomáticas: acetaminofén 650 mg cada 6 horas según necesidad (máx 3 g/24 h), hidratación con al menos 2 L de fluidos diarios y reposo. Si la fiebre persiste más de 72 horas o aparecen dificultad para respirar, dolor torácico, sangrado o dolor intenso, regrese inmediatamente.\n\nPatient: Entendido.\n\nClinician: Programe cita con su médico de familia en una semana para un seguimiento. Si se siente peor antes, venga al servicio de urgencias.\n\nPatient: Gracias, doctor.\n\nClinician: Cuídese, Dorothy.\n",
          "soap_note": "SUBJECTIVE:\n46-year-old female presents with 3 days of intermittent fevers up to 38.2 °C, nocturnal chills, myalgias, mild headache, fatigue. Denies cough, sore throat, dyspnea, GI or urinary symptoms. Hx of AML in CR since 1998.\n\nOBJECTIVE:\nTemp 38.0 °C, BP 118/78 mmHg, HR 94 bpm, RR 18/min, SpO₂ 98% RA. HEENT clear, lungs clear bilaterally, heart RRR, abdomen benign, neuro non-focal. Lab: WBC 7.1 × 10^9/L, CRP 4 mg/L, CMP WNL, influenza and COVID PCR negative.\n\nASSESSMENT:\n1. R50.9 Fever, unspecified, likely viral etiology (e.g., viral syndrome).\n2. Z85.6 Personal history of leukemia, stable.\n\nPLAN:\n• Acetaminophen 650 mg PO q6h PRN for fever/pain, max 3 g/day.\n• Encourage oral fluids ≥ 2 L/day, rest at home.\n• Follow up with PCP in 1 week.\n• Return if fever persists >72 h, new respiratory or GI symptoms, or red-flag signs.\n• No antibiotics indicated at this time.\n\nProvider: Javier Ibarra MD  23-Jan-2025 14:55",
          "treatments": [
            {
              "treatment_type": "medication",
              "treatment_name": "Acetaminophen",
              "dosage": "650 mg orally every 6 hours as needed (max 3 g/day)",
              "prescribed_date": "2025-01-23",
              "instructions": "For fever ≥ 38 °C or myalgias"
            },
            {
              "treatment_type": "patient_education",
              "treatment_name": "Viral Syndrome Home Care",
              "instructions": "Hydration ≥ 2 L/day, rest, monitor temperature twice daily, record symptoms in diary, return if worsening",
              "prescribed_date": "2025-01-23"
            }
          ],
          "observations": [
            "Patient with history of AML in CR, currently immunocompetent.",
            "Physical exam unremarkable except low-grade fever.",
            "Lab work does not indicate bacterial infection or relapse."
          ],
          "prior_auth_justification": null,
          "insurance_status": "active",
          "conditions": [
            {
              "condition_id": "05600c7e-8130-4a20-80a8-32c41466ef34",
              "code": "R50.9",
              "description": "Fever, unspecified",
              "category": "encounter-diagnosis",
              "clinical_status": "active",
              "verification_status": "confirmed",
              "onset_date": "2025-01-20",
              "note": "Onset 3 days prior; likely viral."
            },
            {
              "condition_id": "b65a5504-9d02-4ad4-9b5c-81b0ef6bb307",
              "code": "Z85.6",
              "description": "Personal history of leukemia",
              "category": "problem-list-item",
              "clinical_status": "active",
              "verification_status": "confirmed",
              "onset_date": "1997-10-15",
              "note": "AML in CR since 1998."
            }
          ],
          "lab_results": [
            {
              "lab_id": "3ef0de48-4d0e-4c52-a9f2-1c608e35f7c9",
              "name": "White Blood Cell Count",
              "value": "7.1",
              "value_type": "numeric",
              "units": "10^9/L",
              "date_time": "2025-01-23T14:25:00+00:00",
              "reference_range": "4.0–11.0",
              "flag": null,
              "interpretation": "Normal"
            },
            {
              "lab_id": "29f2e52b-d7a7-44f7-bf87-b982b823696b",
              "name": "C-Reactive Protein",
              "value": "4",
              "value_type": "numeric",
              "units": "mg/L",
              "date_time": "2025-01-23T14:25:00+00:00",
              "reference_range": "<5",
              "flag": null,
              "interpretation": "Normal; low likelihood bacterial infection"
            },
            {
              "lab_id": "c8f49d1f-8ed1-42d9-927d-0320d514dc72",
              "name": "Comprehensive Metabolic Panel",
              "value": "All values within normal limits",
              "value_type": "report",
              "units": null,
              "date_time": "2025-01-23T14:25:00+00:00",
              "reference_range": "See report",
              "flag": null,
              "interpretation": "Normal CMP"
            }
          ],
          "differential_diagnoses": [
            {
              "diagnosis_name": "Influenza without pneumonia",
              "likelihood": 30.0,
              "rank_order": 1
            },
            {
              "diagnosis_name": "COVID-19",
              "likelihood": 20.0,
              "rank_order": 2
            },
            {
              "diagnosis_name": "Urinary tract infection",
              "likelihood": 5.0,
              "rank_order": 3
            }
          ],
          "created_at": "2025-05-27T14:11:57.593929+00:00",
          "updated_at": "2025-06-05T14:11:57.593929+00:00",
          "extra_data": null
        },
        {
          "encounter_id": "cf909cae-2c0b-4dd4-8c49-e4b7dfef62f8",
          "encounter_business_id": "ENC-0681FA35-A794-4684-97BD-00B88370DB41-003",
          "encounter_type": "inpatient",
          "status": "finished",
          "scheduled_start_datetime": "2025-05-17T14:11:57.063+00:00",
          "scheduled_end_datetime": "2025-05-17T15:11:57.063+00:00",
          "actual_start_datetime": "2025-05-17T14:11:57.063+00:00",
          "actual_end_datetime": "2025-05-17T14:56:57.063+00:00",
          "reason_code": "K59.00",
          "reason_display_text": "Constipation, unspecified",
          "transcript": "Resident (Dr. Ramos): Buenas tardes, Señorita Robinson. Usted fue admitida anoche desde urgencias por estreñimiento severo y dolor abdominal. ¿Cuándo fue su última evacuación intestinal?\n\nPatient (en español): Hace seis días. He intentado usar senna y supositorios de glicerina en casa, pero no he podido defecar.\n\nResident: ¿Ha tenido náuseas, vómitos o sangrado rectal?\nPatient: Un poco de náuseas después de comer, pero no he vomitado y no hay sangre en las heces.\n\nResident: ¿Cómo está su dieta e ingesta de líquidos últimamente?\nPatient: He estado comiendo comida rápida y solo bebo alrededor de un vaso de agua al día.\n\nResident: Entiendo. Revisemos su abdomen. (Palpa abdomen.)\n\n—Examen físico breve:\nAbdomen: Blando, distendido, ligero dolor en fosa iliaca izquierda sin rebote ni rigidez. Ruidos hidroaéreos hiporreactivos.\nSignos vitales: Temp 37.0 °C, PA 116/74 mmHg, FC 80 lpm, FR 16/min.\n\nResident: Le hicimos una radiografía abdominal en urgencias. Dr. Chen viene a verla para el plan.\n\n—Dr. Chen (turno de la mañana): Veo fecalomas en colon ascendente y transverso, sin niveles hidroaéreos ni signo de obstrucción completa. Sus electrolitos están dentro de límites normales y TSH normal.\n\nPatient: Me preocupa que sea algo más serio.\n\nDr. Chen: Dado que tuvo un breve curso de opioides tras cirugía dental hace dos semanas, sospechamos estreñimiento por disminución del tránsito intestinal inducido por medicamentos y baja ingesta de fibra.\n\nPatient: ¿Qué haremos?\n\nDr. Chen: Admitiremos para hidratación y régimen de evacuación agresivo. Le explico en español: \n• Manténgase NPO por 6 horas más, luego líquidos claros. \n• Le administraremos polietilenglicol 17 g en 240 mL cada 6 horas hasta que evacúe. \n• Docusato sodio 200 mg PO BID para ablandar heces. \n• Supositorio de glicerina PR cada 12 horas según necesidad. \n• IV suero salino 0.9% 1000 mL en 8 horas y luego evaluamos si tolera vía oral. \n• Dieta alta en fibra cuando tolere.\n• Consultaremos a nutrición para plan de 25–30 g de fibra diaria y al fisioterapeuta para movilidad.\n\nPatient: Entendido.\n\nDr. Chen: Evite medicamentos que constipen. Su hidrocodona se suspendió en urgencias. Esperamos que evacúe hoy o mañana. Si no, haremos enema.\n\nPatient: Gracias, doctor.\n",
          "soap_note": "S: 46-year-old female admitted for 6-day history of constipation and mild diffuse abdominal discomfort. Reports low fiber diet and recent short-course opioid use (hydrocodone) post-dental surgery. No fever, no hematochezia, no weight loss.\n\nO: Temp 37.0 °C, BP 116/74 mmHg, HR 80 bpm, RR 16/min. Abdomen soft, distended, mild LLQ tenderness, no rebound, hypoactive bowel sounds. Rectal exam: hard stool in vault, brown, guaiac-negative. Abdominal X-ray: diffuse colonic fecal retention, no SBO or perforation. Labs: Na 137 mmol/L, TSH 2.1 µIU/mL.\n\nA:\n1. K59.00 Functional constipation, likely opioid-induced + low-fiber diet.\n2. Z85.6 Personal history of leukemia.\n3. E86.0 Mild dehydration.\n\nP:\n• Admit for bowel regimen and hydration.\n• NPO 6 h → clear liquids → advance to high-fiber diet when BM occurs.\n• Polyethylene glycol 3350 17 g PO q6h until BM, luego 17 g nightly × 14 days.\n• Docusate sodium 200 mg PO BID.\n• Glycerin suppository PR q12h PRN si no defeca en 12 h.\n• IV 0.9% NaCl 1000 mL over 8 h, luego evaluar estado hídrico y pasar a PO.\n• Suspender hidrocodona; controlar dolor con acetaminofén.\n• Consultas: Nutrición (plan de fibra 25–30 g/día), Fisioterapia promotora de movilidad.\n• Dar de alta cuando pase 2 movimientos intestinales y tolera dieta.\n\nMD: Ana Chen MD  17-May-2025",
          "treatments": [
            {
              "treatment_type": "medication",
              "treatment_name": "Polyethylene glycol 3350",
              "dosage": "17 g in 240 mL water every 6 hours until bowel movement, then 17 g nightly × 14 days",
              "prescribed_date": "2025-05-17",
              "instructions": "Osmotic laxative"
            },
            {
              "treatment_type": "medication",
              "treatment_name": "Docusate sodium",
              "dosage": "200 mg orally twice daily",
              "prescribed_date": "2025-05-17",
              "instructions": "Stool softener"
            },
            {
              "treatment_type": "procedure",
              "treatment_name": "Glycerin suppository",
              "dosage": "1 PR every 12 hours PRN",
              "prescribed_date": "2025-05-17",
              "instructions": "Rectal stimulant if no BM within 12 hours"
            },
            {
              "treatment_type": "patient_education",
              "treatment_name": "High-fiber diet counseling",
              "instructions": "Increase intake of whole grains, fruits, vegetables; fluid ≥ 2 L/day",
              "prescribed_date": "2025-05-17"
            }
          ],
          "observations": [
            "Abdominal X-ray: fecal loading in colon without signs of obstruction.",
            "Electrolytes WNL; mild dehydration corregida con líquidos IV.",
            "Paciente evacuó en hospital day 2 y toleró dieta alta en fibra."
          ],
          "prior_auth_justification": null,
          "insurance_status": "active",
          "conditions": [
            {
              "condition_id": "c5f88e89-838f-4c0a-b4f9-f4a4b4d43e5e",
              "code": "K59.00",
              "description": "Constipation, unspecified",
              "category": "encounter-diagnosis",
              "clinical_status": "active",
              "verification_status": "confirmed",
              "onset_date": "2025-05-11",
              "note": "Likely opioid-induced + low-fiber diet."
            },
            {
              "condition_id": "ea6b77c5-931e-4a50-9456-6ab6ce34b6e5",
              "code": "Z85.6",
              "description": "Personal history of leukemia",
              "category": "problem-list-item",
              "clinical_status": "active",
              "verification_status": "confirmed",
              "onset_date": "1997-10-15",
              "note": "AML in complete remission."
            }
          ],
          "lab_results": [
            {
              "lab_id": "7962d4e3-cca5-4ee0-a8cb-148c3b0e28b8",
              "name": "Serum Sodium",
              "value": "137",
              "value_type": "numeric",
              "units": "mmol/L",
              "date_time": "2025-05-17T14:30:00+00:00",
              "reference_range": "135–145",
              "flag": null,
              "interpretation": "Normal"
            },
            {
              "lab_id": "9bfe8edc-806c-41d4-9b54-0fb3d7879786",
              "name": "TSH",
              "value": "2.1",
              "value_type": "numeric",
              "units": "µIU/mL",
              "date_time": "2025-05-17T14:30:00+00:00",
              "reference_range": "0.45–4.5",
              "flag": null,
              "interpretation": "Normal – excludes hypothyroidism"
            }
          ],
          "differential_diagnoses": [
            {
              "diagnosis_name": "Fecal impaction",
              "likelihood": 40.0,
              "rank_order": 1
            },
            {
              "diagnosis_name": "Hypothyroidism-related constipation",
              "likelihood": 10.0,
              "rank_order": 2
            },
            {
              "diagnosis_name": "Medication-induced colitis",
              "likelihood": 5.0,
              "rank_order": 3
            }
          ],
          "created_at": "2025-05-27T14:11:57.593929+00:00",
          "updated_at": "2025-06-05T14:11:57.593929+00:00",
          "extra_data": null
        },
        {
          "encounter_id": "e7709a75-3377-4a6d-ab50-e26eb166f601",
          "encounter_business_id": "ENC-0681FA35-A794-4684-97BD-00B88370DB41-004",
          "encounter_type": "inpatient",
          "status": "finished",
          "scheduled_start_datetime": "2025-01-24T14:11:57.063+00:00",
          "scheduled_end_datetime": "2025-01-24T15:11:57.063+00:00",
          "actual_start_datetime": "2025-01-24T14:11:57.063+00:00",
          "actual_end_datetime": "2025-01-24T14:56:57.063+00:00",
          "reason_code": "G43.909",
          "reason_display_text": "Migraine without aura, not intractable, without status migrainosus",
          "transcript": "Nurse Practitioner (NP López): Muy buenas, Dorothy. Fue traída esta mañana por un ataque de migraña que no responde a su tratamiento habitual. Describa el inicio de este episodio.\n\nPatient: Ayer en la tarde comencé a ver luces intermitentes en el ojo derecho, luego apareció un dolor punzante en el lado izquierdo de la cabeza, calificado 9/10. También tenía náuseas intensas y sensibilidad a la luz y al sonido. Tomé sumatriptán 50 mg en casa, pero no mejoró.\n\nNP López: ¿Algún cambio en su visión después de las luces? ¿Pérdida de visión o debilidad en algún lado?\nPatient: No, solo esas luces brillantes, luego el dolor llegó con fuerza, pero no noto debilidad ni hormigueo.\n\nNP López: ¿Ha intentado algún otro analgésico? ¿Algún vómito?\nPatient: Vomité dos veces, así que dejé de tomar otros medicamentos.\n\nNP López: Su historial de migrañas ha aumentado de 1–2 por mes a 3–4 por mes en los últimos 6 meses. Tiene antecedentes de AML en CR. Vamos a revisar signos vitales y hacer examen neurológico. Regrese en un momento con los resultados de CT de cabeza.\n\n—10 minutos después—\n\nNP López: El CT de cabeza sin contraste no muestra hemorragia ni masa. Sus signos vitales: PA 130/82, FC 86, Temp 36.8 °C.\n\nPatient: ¿Esto descarta algo serio?\n\nNP López: Descarta hemorragia aguda. Su examen neurológico está intacto. Planeamos optimizar el manejo agudo: le administraré metoclopramida 10 mg IV con diphenhidramina 25 mg para las náuseas y luego ketorolac 30 mg IV para el dolor.\n\n—Tras administración de medicamentos—\n\nNP López: ¿Cómo se siente ahora?\nPatient: El dolor bajó a 4/10 y la náusea casi desapareció.\n\nNP López: Bien. Dejaremos observación 30 minutos más. Mientras tanto, hablaremos con neurología para iniciar profilaxis.\n\n—Dr. Gupta (Neurology) llega—\n\nDr. Gupta: Dorothy, veo que su migraña ha sido cada vez más severa y resistente. Discutamos prevención: propondremos topiramato. Empiece con 25 mg PO cada noche durante 7 días, luego 25 mg BID. Haremos laboratorio basal: CMP, bicarbonato, embarazo (negativo).\n\nPatient: ¿Cuánto tarda en hacer efecto?\n\nDr. Gupta: Generalmente 6–8 semanas para la dosis completa. También necesito que lleve un diario de cefalea para identificar desencadenantes.\n\nPatient: Entiendo.\n\nDr. Gupta: Evite vino tinto, duerma al menos 7 horas por noche, desayune y almuércese sin saltarse comidas.\n\nPatient: Haré eso.\n\nDr. Gupta: Programaré seguimiento en neurología en 4 semanas. Si empeora, regrese antes.\n\nPatient: Gracias, doctor.\n",
          "soap_note": "S: 46F con historia de migrañas episódicas de 6 meses de evolución, 3–4 episodios/mes, hoy episodio refractario a sumatriptán, dolor 9/10, náuseas y fotofobia. Niega síntomas focales.\n\nO: Afebril, PA 130/82 mmHg, FC 86 bpm. Examen neurológico sin alteraciones. CT head sin contraste normal. Balaño: bicarbonato 24 mmol/L.\n\nA:\n1. G43.909 Migraine without aura, not intractable, acute refractory episode.\n2. Z85.6 Personal history of leukemia.\n\nP:\n• Agudo: Metoclopramida 10 mg IV + diphenhidramina 25 mg IV → reducción dolor a 4/10.\n• Ketorolac 30 mg IV una dosis para analgesia adicional.\n• Sumatriptán 50 mg PO al alta para rescate.\n• Profilaxis: Topiramato 25 mg PO nightly × 7 días, luego 25 mg BID; meta 50 mg BID según tolerancia.\n• Laboratorio basal: CMP y bicarbonato normales.\n• Embarazo: prueba negativa.\n• Educación: Sueño adecuado, hidratación, evitar desencadenantes (vino tinto, saltar comidas), mantener diario de cefaleas.\n• Seguimiento: Cita con neurología en 4 semanas.\n\nProvider: Rajesh Gupta MD  24-Jan-2025",
          "treatments": [
            {
              "treatment_type": "medication",
              "treatment_name": "Metoclopramide",
              "dosage": "10 mg IV once",
              "prescribed_date": "2025-01-24",
              "instructions": "Para náuseas y migraña"
            },
            {
              "treatment_type": "medication",
              "treatment_name": "Diphenhydramine",
              "dosage": "25 mg IV once",
              "prescribed_date": "2025-01-24",
              "instructions": "Prevención de efectos extrapiramidales con metoclopramida"
            },
            {
              "treatment_type": "medication",
              "treatment_name": "Ketorolac",
              "dosage": "30 mg IV once",
              "prescribed_date": "2025-01-24",
              "instructions": "NSAID para analgesia aguda"
            },
            {
              "treatment_type": "medication",
              "treatment_name": "Topiramate",
              "dosage": "25 mg PO nightly × 7 días, luego 25 mg BID, meta 50 mg BID",
              "prescribed_date": "2025-01-24",
              "instructions": "Profilaxis de migraña"
            },
            {
              "treatment_type": "patient_education",
              "treatment_name": "Headache Diary",
              "instructions": "Registrar frecuencia, intensidad, duración y posibles desencadenantes de cefaleas",
              "prescribed_date": "2025-01-24"
            }
          ],
          "observations": [
            "CT head sin hallazgos agudos; descarta etiología secundaria.",
            "Respuesta positiva a medicación aguda (dolor de 9/10 a 4/10).",
            "Paciente dispuesta a seguir profilaxis con topiramato y registro de diario de cefaleas."
          ],
          "prior_auth_justification": null,
          "insurance_status": "active",
          "conditions": [
            {
              "condition_id": "6e2d7947-41ea-4538-9dbf-9a6c319509a0",
              "code": "G43.909",
              "description": "Migraine without aura, not intractable, without status migrainosus",
              "category": "encounter-diagnosis",
              "clinical_status": "active",
              "verification_status": "confirmed",
              "onset_date": "2024-07-01",
              "note": "Frecuencia aumentada en últimos 6 meses."
            },
            {
              "condition_id": "252a97ed-d42b-4cc4-bc54-59571aeab1e0",
              "code": "Z85.6",
              "description": "Personal history of leukemia",
              "category": "problem-list-item",
              "clinical_status": "active",
              "verification_status": "confirmed",
              "onset_date": "1997-10-15",
              "note": "AML en remisión."
            }
          ],
          "lab_results": [
            {
              "lab_id": "11c5de42-1812-4da7-8f68-8c58c542a523",
              "name": "Serum Bicarbonate",
              "value": "24",
              "value_type": "numeric",
              "units": "mmol/L",
              "date_time": "2025-01-24T14:35:00+00:00",
              "reference_range": "22–29",
              "flag": null,
              "interpretation": "Baseline normal before topiramate"
            },
            {
              "lab_id": "f1bb9321-8b30-4f2e-a83b-f1dc1035802d",
              "name": "CT Head (No Contrast)",
              "value": "No acute intracranial abnormality",
              "value_type": "report",
              "units": null,
              "date_time": "2025-01-24T13:50:00+00:00",
              "reference_range": null,
              "flag": null,
              "interpretation": "Estudio normal"
            }
          ],
          "differential_diagnoses": [
            {
              "diagnosis_name": "Cluster headache",
              "likelihood": 5.0,
              "rank_order": 1
            },
            {
              "diagnosis_name": "Tension-type headache",
              "likelihood": 10.0,
              "rank_order": 2
            },
            {
              "diagnosis_name": "Trigeminal neuralgia",
              "likelihood": 5.0,
              "rank_order": 3
            }
          ],
          "created_at": "2025-05-27T14:11:57.593929+00:00",
          "updated_at": "2025-06-05T14:11:57.593929+00:00",
          "extra_data": null
        },
        {
          "encounter_id": "5e90f89c-191a-42c9-ac07-1534cfd4d878",
          "encounter_business_id": "1",
          "encounter_type": "inpatient-oncology-followup",
          "status": "finished",
          "scheduled_start_datetime": "1998-07-09T13:19:27.510+00:00",
          "scheduled_end_datetime": "1998-07-27T10:36:27.510+00:00",
          "actual_start_datetime": "1998-06-21T16:02:06.170+00:00",
          "actual_end_datetime": "1998-07-09T13:19:27.510+00:00",
          "reason_code": "C92.41",
          "reason_display_text": "Acute myelomonocytic leukemia, in remission",
          "transcript": "Clinician (Dr. Matthews): Buenos días, Dorothy. Me alegra mucho verla. Veamos cómo ha estado desde su última quimioterapia de consolidación.\n\nPatient: Doctor, me he sentido bastante bien. Al principio me cansaba con facilidad, pero en las últimas semanas he recuperado algo de energía. Aún siento un poco de fatiga por las mañanas.\n\nDr. Matthews: Excelente. Permítame revisar sus análisis y reporte de biopsia de médula ósea. (Revisa juntos los resultados.) Su hemograma muestra WBC 6.5 × 10^9/L, Hgb 12.8 g/dL, platelets 250 × 10^9/L. El aspirado de médula muestra celularidad 40%, trilineaje hematopoyético, <5% blastos, sin evidencia morfológica de leucemia.\n\nPatient: ¡Qué alivio! Tenía miedo de que reaparecieran las células malignas.\n\nDr. Matthews: Está en remisión completa. Mantendremos su plan de terapia de mantenimiento. Hablemos de dosis y seguimiento.\n\nPatient: Perfecto.\n\nDr. Matthews: De acuerdo con el protocolo, continuará con citarabina en dosis bajas cada mes, o si su oncólogo decide, un agente oral como 6-mercaptopurina. Monitorearemos CBC mensual. Haremos biopsia de médula cada 3–6 meses, o antes si hay cambios significativos en conteos.\n\nPatient: ¿Cuáles son los efectos secundarios que debo vigilar?\n\nDr. Matthews: Posible mielosupresión, cistitis hemorrágica (con citarabina a dosis altas, menos probable en dosis bajas), y riesgo de infecciones. Informe fiebre, moretones o sangrados que aparezcan.\n\nPatient: Entendido.\n\nDr. Matthews: También discutiremos vigilancia de efectos tardíos: función cardíaca, salud ósea, salud reproductiva. Recomiendo suplementos de vitamina D y calcio. ¿Alguna otra consulta?\n\nPatient: ¿Puedo retomar ejercicio leve?\n\nDr. Matthews: Sí, camine 30 minutos diarios, nada extenuante. Evite gimnasios concurridos durante quimioterapia.\n\nPatient: Está bien.\n\nDr. Matthews: Bien. Programaré su próxima visita de seguimiento dentro de un mes para revisar CBC y evaluar tolerancia. Llame si presenta fiebre > 38 °C, sangrado o dolor inusual.\n\nPatient: Gracias, doctor.\n\nDr. Matthews: Nos vemos en un mes. Cuídese.\n",
          "soap_note": "S: 19-year-old female, hx de AMML, presenta para seguimiento de remisión. Reporta fatiga leve matutina, sin fiebre, equimosis ni sangrado. Apetito normal.\n\nO: Afebril, BP 110/70 mmHg, HR 75 bpm. Sin linfadenopatía, sin hepatoesplenomegalia. Piel íntegra, mucosas húmedas. CBC: WBC 6.5 × 10^9/L, Hgb 12.8 g/dL, Plt 250 × 10^9/L, sin blastos en frotis periférico. Biopsia de médula 15-Jun-1998: celularidad 40%, trilineaje normal, <5% blastos, citogenética normal.\n\nA:\n1. C92.41 Acute myelomonocytic leukemia, in remission.\n2. Z85.6 Personal history of leukemia.\n\nP:\n• Mantenimiento: Citarabina en dosis bajas (100 mg/m² SC días 1–5 cada 28 días) o 6-mercaptopurina 50 mg/m² oral diario según protocolo final.\n• Monitoreo: CBC mensual, química sanguínea cada mes, BUN/Cr, enzimas hepáticas.\n• Biopsia de médula ósea en 3–6 meses.\n• Educación: Informar fiebre >38 °C, sangrado, moretones irregulares.\n• Suplementos: Vitamina D 2000 IU diario, calcio 500 mg BID.\n• Actividad: Caminar 30 minutos/día, evitar contacto con multitudes.\n• Seguimiento: Cita en oncología en 1 mes.\n\nProvider: Ellen Matthews MD  21-Jun-1998",
          "treatments": [
            {
              "instructions": "Continuar con protocolo de mantenimiento para AML.",
              "treatment_name": "Maintenance Chemotherapy (Cytarabine low-dose)",
              "treatment_type": "medication",
              "prescribed_date": "1998-06-21"
            },
            {
              "frequency": "Monthly",
              "instructions": "Monitorear CBC para detectar mielosupresión o recaída temprana.",
              "treatment_name": "Regular CBC Monitoring",
              "treatment_type": "diagnostic_procedure",
              "prescribed_date": "1998-06-21"
            },
            {
              "treatment_type": "supplement",
              "treatment_name": "Vitamin D",
              "dosage": "2000 IU daily",
              "prescribed_date": "1998-06-21",
              "instructions": "Prevención de osteopenia"
            },
            {
              "treatment_type": "supplement",
              "treatment_name": "Calcium",
              "dosage": "500 mg PO BID",
              "prescribed_date": "1998-06-21",
              "instructions": "Prevención de osteopenia"
            }
          ],
          "observations": [
            "Resultados de biopsia de médula concursan con remisión completa (<5% blastos).",
            "Leve alopecia residual del tratamiento previo.",
            "Sin evidencia de linfadenopatía ni hepatoesplenomegalia."
          ],
          "prior_auth_justification": "",
          "insurance_status": "Medicaid",
          "conditions": [
            {
              "condition_id": "9795a44c-7720-47cd-a755-4476096b4386",
              "code": "C92.41",
              "description": "Acute myelomonocytic leukemia, in remission",
              "category": "encounter-diagnosis",
              "clinical_status": "remission",
              "verification_status": "confirmed",
              "onset_date": "1997-10-15",
              "note": "Paciente en remisión completa tras quimioterapia."
            },
            {
              "condition_id": "164c78ac-7040-44b0-b807-bcfa5a8436a0",
              "code": "Z85.6",
              "description": "Personal history of leukemia",
              "category": "problem-list-item",
              "clinical_status": "resolved",
              "verification_status": "confirmed",
              "onset_date": "1997-10-15",
              "note": "Documentando antecedente de leucemia en remisión."
            },
            {
              "condition_id": "6b5d59cb-00bd-490f-a136-ead3ae0d8456",
              "code": "D70.9",
              "description": "Neutropenia, unspecified",
              "category": "differential",
              "clinical_status": "resolved",
              "verification_status": "refuted",
              "onset_date": "1998-06-15",
              "note": "Considerada ante conteos bajos, pero CBC normal."
            },
            {
              "condition_id": "4bf4aec9-09c7-4c88-be52-2f6dfe25b7bb",
              "code": "C92.41",
              "description": "Acute myelomonocytic leukemia, in remission",
              "category": "encounter-diagnosis",
              "clinical_status": "remission",
              "verification_status": "confirmed",
              "onset_date": "1997-10-15",
              "note": "Paciente en remisión completa."
            },
            {
              "condition_id": "d3b61225-4170-4957-8148-65b055852425",
              "code": "Z85.6",
              "description": "Personal history of leukemia",
              "category": "problem-list-item",
              "clinical_status": "resolved",
              "verification_status": "confirmed",
              "onset_date": "1997-10-15",
              "note": "Antecedente de leucemia en remisión."
            },
            {
              "condition_id": "a99605fe-4bd7-4e66-b19c-5a822efe740a",
              "code": "D70.9",
              "description": "Neutropenia, unspecified",
              "category": "differential",
              "clinical_status": "resolved",
              "verification_status": "refuted",
              "onset_date": "1998-06-15",
              "note": "CBC normal, neutropenia descartada."
            },
            {
              "condition_id": "708d6cb8-a15e-4e2a-93ae-f3626fcc917b",
              "code": "C92.41",
              "description": "Acute myelomonocytic leukemia, in remission",
              "category": "encounter-diagnosis",
              "clinical_status": "remission",
              "verification_status": "confirmed",
              "onset_date": "1997-10-15",
              "note": "Paciente en remisión."
            },
            {
              "condition_id": "4787fd16-0744-484a-95f8-e66fc8b684f1",
              "code": "Z85.6",
              "description": "Personal history of leukemia",
              "category": "problem-list-item",
              "clinical_status": "resolved",
              "verification_status": "confirmed",
              "onset_date": "1997-10-15",
              "note": "Antecedente documentado."
            },
            {
              "condition_id": "76d50d37-97c7-4df6-b751-3f457961ff96",
              "code": "D70.9",
              "description": "Neutropenia, unspecified",
              "category": "differential",
              "clinical_status": "resolved",
              "verification_status": "refuted",
              "onset_date": "1998-06-15",
              "note": "Neutropenia descartada."
            },
            {
              "condition_id": "e36d43bc-df66-43d0-913b-48979e890089",
              "code": "C92.41",
              "description": "Acute myelomonocytic leukemia, in remission",
              "category": "encounter-diagnosis",
              "clinical_status": "remission",
              "verification_status": "confirmed",
              "onset_date": "1997-10-15",
              "note": "Paciente en remisión completa."
            },
            {
              "condition_id": "9116420d-dde6-4d5d-986f-10083ec5d1e7",
              "code": "Z85.6",
              "description": "Personal history of leukemia",
              "category": "problem-list-item",
              "clinical_status": "resolved",
              "verification_status": "confirmed",
              "onset_date": "1997-10-15",
              "note": "Leucemia previa en remisión."
            },
            {
              "condition_id": "0dbc0a96-181c-47a2-bf17-a65f7b65c6b8",
              "code": "D70.9",
              "description": "Neutropenia, unspecified",
              "category": "differential",
              "clinical_status": "resolved",
              "verification_status": "refuted",
              "onset_date": "1998-06-15",
              "note": "CBC normal."
            },
            {
              "condition_id": "20cd3904-177f-45e7-84fe-d1c65dd10548",
              "code": "C92.41",
              "description": "Acute myelomonocytic leukemia, in remission",
              "category": "encounter-diagnosis",
              "clinical_status": "remission",
              "verification_status": "confirmed",
              "onset_date": "1997-10-15",
              "note": "Paciente en remisión."
            },
            {
              "condition_id": "50b8f31b-3201-4a26-ac5c-f8f027b379f9",
              "code": "Z85.6",
              "description": "Personal history of leukemia",
              "category": "problem-list-item",
              "clinical_status": "resolved",
              "verification_status": "confirmed",
              "onset_date": "1997-10-15",
              "note": "Leucemia previa."
            },
            {
              "condition_id": "10215082-d1f7-408e-ba14-3a35b2df18e5",
              "code": "D70.9",
              "description": "Neutropenia, unspecified",
              "category": "differential",
              "clinical_status": "resolved",
              "verification_status": "refuted",
              "onset_date": "1998-06-15",
              "note": "Descartada neutropenia."
            }
          ],
          "lab_results": [
            {
              "lab_id": "015b5885-cb99-4024-bf80-e3570c8ec516",
              "name": "Bone Marrow Biopsy - Blasts",
              "value": "<5",
              "value_type": "numeric",
              "units": "%",
              "date_time": "1998-06-15T11:00:00+00:00",
              "reference_range": "<5%",
              "flag": null,
              "interpretation": "No evidencia morfológica de leucemia; consistente con remisión completa."
            },
            {
              "lab_id": "94567b4e-d97c-4732-a834-9db6c048f246",
              "name": "Hemoglobin",
              "value": "12.8",
              "value_type": "numeric",
              "units": "g/dL",
              "date_time": "1998-06-21T16:30:00+00:00",
              "reference_range": "12.0-15.5",
              "flag": null,
              "interpretation": "Nivel normal."
            },
            {
              "lab_id": "5ff552b6-19fc-449a-83e4-0799c2b3cddf",
              "name": "Bone Marrow Biopsy - Blasts",
              "value": "<5",
              "value_type": "numeric",
              "units": "%",
              "date_time": "1998-06-15T11:00:00+00:00",
              "reference_range": "<5%",
              "flag": null,
              "interpretation": "Remisión completa."
            },
            {
              "lab_id": "40b52018-3d58-47a0-b859-f47c4cf02e2b",
              "name": "Hemoglobin",
              "value": "12.8",
              "value_type": "numeric",
              "units": "g/dL",
              "date_time": "1998-06-21T16:30:00+00:00",
              "reference_range": "12.0-15.5",
              "flag": null,
              "interpretation": "Normal."
            },
            {
              "lab_id": "b5301819-b03f-4d2f-bbb5-4d822c7fcbba",
              "name": "Bone Marrow Biopsy - Blasts",
              "value": "<5",
              "value_type": "numeric",
              "units": "%",
              "date_time": "1998-06-15T11:00:00+00:00",
              "reference_range": "<5%",
              "flag": null,
              "interpretation": "Remisión completa."
            },
            {
              "lab_id": "de1088e7-50c6-450c-8836-9339cbf81ab9",
              "name": "Hemoglobin",
              "value": "12.8",
              "value_type": "numeric",
              "units": "g/dL",
              "date_time": "1998-06-21T16:30:00+00:00",
              "reference_range": "12.0-15.5",
              "flag": null,
              "interpretation": "Normal."
            },
            {
              "lab_id": "61381d3d-7604-426a-9fc5-7a0a7053ae8a",
              "name": "Bone Marrow Biopsy - Blasts",
              "value": "<5",
              "value_type": "numeric",
              "units": "%",
              "date_time": "1998-06-15T11:00:00+00:00",
              "reference_range": "<5%",
              "flag": null,
              "interpretation": "Remisión completa."
            },
            {
              "lab_id": "203fb75e-3b4a-4a7c-a33c-4a9088b90547",
              "name": "Hemoglobin",
              "value": "12.8",
              "value_type": "numeric",
              "units": "g/dL",
              "date_time": "1998-06-21T16:30:00+00:00",
              "reference_range": "12.0-15.5",
              "flag": null,
              "interpretation": "Normal."
            },
            {
              "lab_id": "a74dfbf7-4d24-4822-92a2-26edb94f44bb",
              "name": "Bone Marrow Biopsy - Blasts",
              "value": "<5",
              "value_type": "numeric",
              "units": "%",
              "date_time": "1998-06-15T11:00:00+00:00",
              "reference_range": "<5%",
              "flag": null,
              "interpretation": "Remisión completa."
            },
            {
              "lab_id": "5a16c474-8410-4e25-89b9-e95d4a43c42a",
              "name": "Hemoglobin",
              "value": "12.8",
              "value_type": "numeric",
              "units": "g/dL",
              "date_time": "1998-06-21T16:30:00+00:00",
              "reference_range": "12.0-15.5",
              "flag": null,
              "interpretation": "Normal."
            }
          ],
          "differential_diagnoses": [
            {
              "diagnosis_name": "Early relapse of AML",
              "likelihood": 10.0,
              "rank_order": 1
            },
            {
              "diagnosis_name": "Reactive cytopenia",
              "likelihood": 20.0,
              "rank_order": 2
            },
            {
              "diagnosis_name": "Iron deficiency anemia",
              "likelihood": 5.0,
              "rank_order": 3
            }
          ],
          "created_at": "2025-05-15T14:21:51.242161+00:00",
          "updated_at": "2025-06-05T14:11:57.593929+00:00",
          "extra_data": {
            "soapNote": "S: Patient reports mild fatigue since consolidation therapy. No fevers, bruising, bleeding. O: Afebrile, labs WBC 6.5, Hgb 12.8, Plt 250. Bone marrow biopsy <5% blasts. A: AML in CR. P: Continue maintenance, monitor CBC monthly, supplements de vitamina D y calcio, actividad física leve.",
            "PatientID": "0681FA35-A794-4684-97BD-00B88370DB41",
            "transcript": "Clinician (Dr. Matthews): Buenos días, Dorothy. Me alegra mucho verla. Veamos cómo ha estado desde su última quimioterapia de consolidación.\n\nPatient: Doctor, me he sentido bastante bien. Al principio me cansaba con facilidad, pero en las últimas semanas he recuperado algo de energía. Aún siento un poco de fatiga por las mañanas.\n\nDr. Matthews: Excelente. Permítame revisar sus análisis y reporte de biopsia de médula ósea. (Revisa juntos los resultados.) Su hemograma muestra WBC 6.5 × 10^9/L, Hgb 12.8 g/dL, platelets 250 × 10^9/L. El aspirado de médula muestra celularidad 40%, trilineaje hematopoyético, <5% blastos, sin evidencia morfológica de leucemia.\n\nPatient: ¡Qué alivio! Tenía miedo de que reaparecieran las células malignas.\n\nDr. Matthews: Está en remisión completa. Mantendremos su plan de terapia de mantenimiento. Hablemos de dosis y seguimiento.\n\nPatient: Perfecto.\n\nDr. Matthews: De acuerdo con el protocolo, continuará con citarabina en dosis bajas cada mes, o si su oncólogo decide, un agente oral como 6-mercaptopurina. Monitorearemos CBC mensual. Haremos biopsia de médula cada 3–6 meses, o antes si hay cambios significativos en conteos.\n\nPatient: ¿Cuáles son los efectos secundarios que debo vigilar?\n\nDr. Matthews: Posible mielosupresión, cistitis hemorrágica (con citarabina a dosis altas, menos probable en dosis bajas), y riesgo de infecciones. Informe fiebre, moretones o sangrados que aparezcan.\n\nPatient: Entendido.\n\nDr. Matthews: También discutiremos vigilancia de efectos tardíos: función cardíaca, salud ósea, salud reproductiva. Recomiendo suplementos de vitamina D y calcio. ¿Alguna otra consulta?\n\nPatient: ¿Puedo retomar ejercicio leve?\n\nDr. Matthews: Sí, camine 30 minutos diarios, nada extenuante. Evite gimnasios concurridos durante quimioterapia.\n\nPatient: Está bien.\n\nDr. Matthews: Bien. Programaré su próxima visita de seguimiento dentro de un mes para revisar CBC y evaluar tolerancia. Llame si presenta fiebre > 38 °C, sangrado o dolor inusual.\n\nPatient: Gracias, doctor.\n\nDr. Matthews: Nos vemos en un mes. Cuídese.",
            "AdmissionID": "1",
            "ReasonForVisit": "Acute myelomonocytic leukemia, in remission",
            "treatmentsJSON": "\"[{\"\"medication\"\": \"\"Ibuprofen\"\", \"\"dosage\"\": \"\"200mg every 6 hours\"\"}]\"",
            "InsuranceStatus": "Medicaid",
            "ActualEndDateTime": "1998-07-09 14:19:27.510",
            "ActualStartDateTime": "1998-06-21 17:02:06.170",
            "ScheduledEndDateTime": "1998-07-27 11:36:27.510",
            "ScheduledStartDateTime": "1998-07-09 14:19:27.510",
            "priorAuthJustification": ""
          }
        }
      ],
      "created_at": "2025-05-13T15:06:27.611298+00:00",
      "updated_at": "2025-06-05T14:11:57.593929+00:00",
      "extra_data": {
        "name": "Dorothy Robinson",
        "photo": "https://ui-avatars.com/api/?name=DR&background=D0F0C0&color=ffffff&size=60&rounded=true",
        "lastName": "Robinson",
        "PatientID": "0681FA35-A794-4684-97BD-00B88370DB41",
        "firstName": "Dorothy",
        "alertsJSON": "\"[{\"\"id\"\": \"\"0681FA35-A794-4684-97BD-00B88370DB41_cancer\"\", \"\"patientId\"\": \"\"0681FA35-A794-4684-97BD-00B88370DB41\"\", \"\"msg\"\": \"\"Malignancy detected; high likelihood\"\", \"\"likelihood\"\": 5, \"\"conditionType\"\": \"\"cancer\"\"}]\"",
        "PatientRace": "Asian",
        "PatientGender": "Female",
        "PatientLanguage": "Spanish",
        "PatientDateOfBirth": "1978-10-02 21:46:05.300",
        "PatientMaritalStatus": "Unknown",
        "PatientPopulationPercentageBelowPoverty": "19.16"
      }
    }
  }
]
$json$;

    patient_data JSONB;
    patient_business_id TEXT;
    patient_supabase_id UUID;
    encounter_json JSONB;
    condition_json JSONB;
    lab_result_json JSONB;
    diff_diag_json JSONB;
    encounter_uuid UUID;

BEGIN
    -- Extract patient data object from the outer array
    patient_data := enriched_data->0->'patient_complete_data';
    patient_business_id := patient_data->>'patient_id';

    -- Get the supabase internal ID for the patient
    SELECT id INTO patient_supabase_id FROM public.patients WHERE patient_id = patient_business_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Patient with patient_id % not found', patient_business_id;
    END IF;

    -- Update patient details
    UPDATE public.patients
    SET
        first_name = patient_data->>'first_name',
        last_name = patient_data->>'last_name',
        gender = patient_data->>'gender',
        birth_date = (patient_data->>'birth_date')::DATE,
        race = patient_data->>'race',
        ethnicity = patient_data->>'ethnicity',
        marital_status = patient_data->>'marital_status',
        language = patient_data->>'language',
        poverty_percentage = (patient_data->>'poverty_percentage')::NUMERIC,
        photo_url = patient_data->>'photo_url',
        alerts = (patient_data->'alerts')::JSONB,
        updated_at = NOW(),
        extra_data = (patient_data->'extra_data')::JSONB
    WHERE id = patient_supabase_id;

    -- Loop through encounters in the JSON
    FOR encounter_json IN SELECT * FROM jsonb_array_elements(patient_data->'encounters')
    LOOP
        encounter_uuid := (encounter_json->>'encounter_id')::UUID;

        -- Upsert encounter: update if it exists, insert if not.
        INSERT INTO public.encounters (
            id, patient_supabase_id, encounter_id, encounter_type, status,
            scheduled_start_datetime, scheduled_end_datetime,
            actual_start_datetime, actual_end_datetime,
            reason_code, reason_display_text, transcript, soap_note, treatments,
            observations, prior_auth_justification, insurance_status, extra_data, updated_at
        )
        VALUES (
            encounter_uuid,
            patient_supabase_id,
            encounter_json->>'encounter_business_id',
            encounter_json->>'encounter_type',
            encounter_json->>'status',
            (encounter_json->>'scheduled_start_datetime')::TIMESTAMPTZ,
            (encounter_json->>'scheduled_end_datetime')::TIMESTAMPTZ,
            (encounter_json->>'actual_start_datetime')::TIMESTAMPTZ,
            (encounter_json->>'actual_end_datetime')::TIMESTAMPTZ,
            encounter_json->>'reason_code',
            encounter_json->>'reason_display_text',
            encounter_json->>'transcript',
            encounter_json->>'soap_note',
            (encounter_json->'treatments')::JSONB,
            ARRAY(SELECT jsonb_array_elements_text(encounter_json->'observations')),
            encounter_json->>'prior_auth_justification',
            encounter_json->>'insurance_status',
            (encounter_json->'extra_data')::JSONB,
            NOW()
        )
        -- Match on the business id: the migration may already have made this
        -- encounter under another uuid, and its children must point at that row.
        ON CONFLICT ON CONSTRAINT encounters_patient_encounter_unique DO UPDATE SET
            encounter_type = EXCLUDED.encounter_type,
            status = EXCLUDED.status,
            scheduled_start_datetime = EXCLUDED.scheduled_start_datetime,
            scheduled_end_datetime = EXCLUDED.scheduled_end_datetime,
            actual_start_datetime = EXCLUDED.actual_start_datetime,
            actual_end_datetime = EXCLUDED.actual_end_datetime,
            reason_code = EXCLUDED.reason_code,
            reason_display_text = EXCLUDED.reason_display_text,
            transcript = EXCLUDED.transcript,
            soap_note = EXCLUDED.soap_note,
            treatments = EXCLUDED.treatments,
            observations = EXCLUDED.observations,
            prior_auth_justification = EXCLUDED.prior_auth_justification,
            insurance_status = EXCLUDED.insurance_status,
            extra_data = EXCLUDED.extra_data,
            updated_at = NOW()
        RETURNING id INTO encounter_uuid;

        -- Upsert conditions for the current encounter
        IF jsonb_typeof(encounter_json->'conditions') = 'array' THEN
            FOR condition_json IN SELECT * FROM jsonb_array_elements(encounter_json->'conditions')
            LOOP
                INSERT INTO public.conditions (
                    id, patient_id, encounter_id, code, description, category,
                    clinical_status, verification_status, onset_date, note
                )
                VALUES (
                    (condition_json->>'condition_id')::UUID,
                    patient_supabase_id,
                    encounter_uuid,
                    condition_json->>'code',
                    condition_json->>'description',
                    condition_json->>'category',
                    condition_json->>'clinical_status',
                    condition_json->>'verification_status',
                    (condition_json->>'onset_date')::DATE,
                    condition_json->>'note'
                )
                ON CONFLICT (id) DO UPDATE SET
                    patient_id = EXCLUDED.patient_id,
                    encounter_id = EXCLUDED.encounter_id,
                    code = EXCLUDED.code,
                    description = EXCLUDED.description,
                    category = EXCLUDED.category,
                    clinical_status = EXCLUDED.clinical_status,
                    verification_status = EXCLUDED.verification_status,
                    onset_date = EXCLUDED.onset_date,
                    note = EXCLUDED.note,
                    updated_at = NOW();
            END LOOP;
        END IF;

        -- Upsert lab results for the current encounter
        IF jsonb_typeof(encounter_json->'lab_results') = 'array' THEN
            FOR lab_result_json IN SELECT * FROM jsonb_array_elements(encounter_json->'lab_results')
            LOOP
                INSERT INTO public.lab_results (
                    id, patient_id, encounter_id, name, value, value_type, units, date_time, reference_range, flag, interpretation
                )
                VALUES (
                    (lab_result_json->>'lab_id')::UUID,
                    patient_supabase_id,
                    encounter_uuid,
                    lab_result_json->>'name',
                    lab_result_json->>'value',
                    lab_result_json->>'value_type',
                    lab_result_json->>'units',
                    (lab_result_json->>'date_time')::TIMESTAMPTZ,
                    lab_result_json->>'reference_range',
                    lab_result_json->>'flag',
                    lab_result_json->>'interpretation'
                )
                ON CONFLICT (id) DO UPDATE SET
                    patient_id = EXCLUDED.patient_id,
                    encounter_id = EXCLUDED.encounter_id,
                    name = EXCLUDED.name,
                    value = EXCLUDED.value,
                    value_type = EXCLUDED.value_type,
                    units = EXCLUDED.units,
                    date_time = EXCLUDED.date_time,
                    reference_range = EXCLUDED.reference_range,
                    flag = EXCLUDED.flag,
                    interpretation = EXCLUDED.interpretation,
                    updated_at = NOW();
            END LOOP;
        END IF;
        
        -- Delete old differential diagnoses and insert new ones for the current encounter
        DELETE FROM public.differential_diagnoses WHERE encounter_id = encounter_uuid;
        IF jsonb_typeof(encounter_json->'differential_diagnoses') = 'array' THEN
            FOR diff_diag_json IN SELECT * FROM jsonb_array_elements(encounter_json->'differential_diagnoses')
            LOOP
                INSERT INTO public.differential_diagnoses (
                    patient_id, encounter_id, diagnosis_name, likelihood, rank_order
                )
                VALUES (
                    patient_supabase_id,
                    encounter_uuid,
                    diff_diag_json->>'diagnosis_name',
                    (diff_diag_json->>'likelihood')::NUMERIC,
                    (diff_diag_json->>'rank_order')::INTEGER
                );
            END LOOP;
        END IF;

    END LOOP;
END;
$$;