-- Migration: Unified Alerts System
-- Description: Creates a new alerts table to replace the JSONB alerts field in patients table
-- This supports both existing complex case alerts and new copilot alerts in a unified structure

-- Create the unified alerts table
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
    
    -- Alert identification and classification
    alert_type TEXT NOT NULL, -- DRUG_INTERACTION, MISSING_LAB_RESULT, COMORBIDITY, ASSESSMENT_QUESTION, DIAGNOSTIC_GAP, COMPLEX_CONDITION, etc.
    severity TEXT NOT NULL DEFAULT 'INFO', -- INFO, WARNING, CRITICAL
    category TEXT, -- For grouping: 'copilot', 'complex_case', 'clinical_engine', etc.
    
    -- Alert content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    suggestion TEXT, -- Recommended action
    
    -- AI and processing metadata
    confidence_score NUMERIC(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1), -- 0.0 to 1.0
    source_reasoning TEXT, -- AI reasoning for generating this alert
    processing_model TEXT, -- Which AI model generated this alert (e.g., 'gpt-4.1-mini', 'gpt-o3')
    context_data JSONB, -- Additional context used to generate the alert
    
    -- Alert lifecycle and state
    status TEXT DEFAULT 'active', -- active, accepted, dismissed, resolved
    is_real_time BOOLEAN DEFAULT false, -- Whether this was a real-time alert
    is_post_consultation BOOLEAN DEFAULT false, -- Whether this was generated post-consultation
    
    -- User interaction tracking
    acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by TEXT, -- User ID or identifier
    dismissed_at TIMESTAMPTZ,
    dismissed_by TEXT,
    accepted_at TIMESTAMPTZ,
    accepted_by TEXT,
    action_taken TEXT, -- Description of action taken when accepted
    
    -- Related data and references
    related_data JSONB, -- Flexible field for alert-specific data (drug names, lab names, etc.)
    related_patient_data_refs JSONB, -- References to specific patient data that triggered this alert
    navigation_target TEXT, -- Where to navigate when alert is clicked/accepted
    proposed_edit JSONB, -- Suggested changes for one-click editing
    
    -- Legacy support for existing alerts
    legacy_alert_data JSONB, -- For migrating existing complex case alerts
    migrated_from_patient_alerts BOOLEAN DEFAULT false,
    
    -- Audit and metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ, -- Optional expiration for time-sensitive alerts
    tags TEXT[], -- Flexible tagging system
    extra_data JSONB -- For future extensions
);

-- Add comments for documentation
COMMENT ON TABLE public.alerts IS 'Unified alerts system for all patient alerts including copilot, complex case, and clinical engine alerts';
COMMENT ON COLUMN public.alerts.alert_type IS 'Type of alert: DRUG_INTERACTION, COMORBIDITY, ASSESSMENT_QUESTION, DIAGNOSTIC_GAP, COMPLEX_CONDITION, etc.';
COMMENT ON COLUMN public.alerts.severity IS 'Alert severity level: INFO, WARNING, CRITICAL';
COMMENT ON COLUMN public.alerts.category IS 'Alert category for grouping: copilot, complex_case, clinical_engine';
COMMENT ON COLUMN public.alerts.confidence_score IS 'AI confidence score from 0.0 to 1.0';
COMMENT ON COLUMN public.alerts.source_reasoning IS 'AI explanation for why this alert was generated';
COMMENT ON COLUMN public.alerts.context_data IS 'Context data used to generate the alert (patient history, transcript snippets, etc.)';
COMMENT ON COLUMN public.alerts.related_data IS 'Alert-specific data like drug names, lab names, diagnostic information';
COMMENT ON COLUMN public.alerts.navigation_target IS 'UI route/section to navigate to when alert is clicked';
COMMENT ON COLUMN public.alerts.proposed_edit IS 'Suggested changes for one-click editing functionality';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_alerts_patient_id ON public.alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_alerts_encounter_id ON public.alerts(encounter_id);
CREATE INDEX IF NOT EXISTS idx_alerts_alert_type ON public.alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON public.alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_category ON public.alerts(category);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_real_time ON public.alerts(is_real_time);
CREATE INDEX IF NOT EXISTS idx_alerts_active_alerts ON public.alerts(patient_id, status) WHERE status = 'active';

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_alerts_patient_status_created ON public.alerts(patient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_encounter_type ON public.alerts(encounter_id, alert_type) WHERE encounter_id IS NOT NULL;

-- Add trigger for updated_at (the base schema may have made it already)
DROP TRIGGER IF EXISTS set_alerts_updated_at ON public.alerts;
CREATE TRIGGER set_alerts_updated_at
    BEFORE UPDATE ON public.alerts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Create a function to migrate existing patient alerts
CREATE OR REPLACE FUNCTION migrate_patient_alerts_to_unified_system()
RETURNS INTEGER AS $$
DECLARE
    patient_record RECORD;
    alert_record RECORD;
    alerts_data JSONB;
    migrated_count INTEGER := 0;
BEGIN
    -- Loop through all patients with alerts
    FOR patient_record IN 
        SELECT id, patient_id, alerts 
        FROM public.patients 
        WHERE alerts IS NOT NULL AND alerts != 'null'::jsonb AND alerts != '[]'::jsonb
    LOOP
        alerts_data := patient_record.alerts;
        
        -- Handle array of alerts
        IF jsonb_typeof(alerts_data) = 'array' THEN
            FOR alert_record IN 
                SELECT * FROM jsonb_array_elements(alerts_data)
            LOOP
                INSERT INTO public.alerts (
                    patient_id,
                    alert_type,
                    severity,
                    category,
                    title,
                    message,
                    suggestion,
                    confidence_score,
                    legacy_alert_data,
                    migrated_from_patient_alerts,
                    created_at
                ) VALUES (
                    patient_record.id,
                    COALESCE((alert_record.value->>'type')::TEXT, 'COMPLEX_CONDITION'),
                    COALESCE((alert_record.value->>'severity')::TEXT, 'INFO'),
                    'complex_case',
                    COALESCE((alert_record.value->>'type')::TEXT, 'Complex Case Alert'),
                    COALESCE((alert_record.value->>'msg')::TEXT, 'Complex case alert migrated from legacy system'),
                    COALESCE(
                        CASE 
                            WHEN (alert_record.value->>'suggestedActions') IS NOT NULL 
                            THEN array_to_string(
                                ARRAY(SELECT jsonb_array_elements_text(alert_record.value->'suggestedActions')), 
                                '; '
                            )
                            ELSE NULL
                        END
                    ),
                    COALESCE((alert_record.value->>'confidence')::NUMERIC, (alert_record.value->>'likelihood')::NUMERIC, 0.5),
                    alert_record.value,
                    true,
                    COALESCE(
                        (alert_record.value->>'createdAt')::TIMESTAMPTZ,
                        (alert_record.value->>'date')::TIMESTAMPTZ,
                        NOW()
                    )
                );
                migrated_count := migrated_count + 1;
            END LOOP;
        END IF;
    END LOOP;
    
    RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;

-- Create a view for easy querying of active alerts
CREATE OR REPLACE VIEW active_patient_alerts AS
SELECT 
    a.*,
    p.patient_id as patient_identifier,
    p.first_name,
    p.last_name,
    e.encounter_id as encounter_identifier,
    e.status as encounter_status
FROM public.alerts a
JOIN public.patients p ON a.patient_id = p.id
LEFT JOIN public.encounters e ON a.encounter_id = e.id
WHERE a.status = 'active' AND (a.expires_at IS NULL OR a.expires_at > NOW())
ORDER BY a.severity DESC, a.created_at DESC;

-- Create a function to clean up expired alerts
CREATE OR REPLACE FUNCTION cleanup_expired_alerts()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE public.alerts 
    SET status = 'expired', updated_at = NOW()
    WHERE expires_at IS NOT NULL 
    AND expires_at <= NOW() 
    AND status = 'active';
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Add a check constraint for valid alert types
ALTER TABLE public.alerts ADD CONSTRAINT valid_alert_types 
CHECK (alert_type IN (
    'DRUG_INTERACTION', 
    'MISSING_LAB_RESULT', 
    'CLINICAL_GUIDELINE', 
    'ABNORMAL_VITAL', 
    'COMORBIDITY', 
    'ASSESSMENT_QUESTION', 
    'DIAGNOSTIC_GAP', 
    'COMPLEX_CONDITION',
    'COMORBIDITY_REMINDER'
));

-- Add a check constraint for valid severities
ALTER TABLE public.alerts ADD CONSTRAINT valid_severities 
CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL'));

-- Add a check constraint for valid statuses
ALTER TABLE public.alerts ADD CONSTRAINT valid_statuses 
CHECK (status IN ('active', 'accepted', 'dismissed', 'resolved', 'expired')); 