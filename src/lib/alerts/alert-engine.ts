// Main Alert Processing Engine
// Orchestrates the unified alert system for real-time and post-consultation analysis

import { 
  UnifiedAlert, 
  CreateAlertRequest, 
  AlertType, 
  AlertSeverity, 
  AlertStatus,
  AlertCategory,
  RealTimeAlertContext,
  PostConsultationAlertContext,
  AlertProcessor,
  AlertDeduplicator
} from '@/types/alerts';

import { 
  AIProcessingRequest, 
  AIProcessingResponse,
  AIProcessingContext 
} from '@/types/ai-models';

import { OpenAIClient } from '../ai/gpt-models';
import { getRealTimeTemplate } from '../ai/prompt-templates';
import { UnifiedAlertsService } from '../unifiedAlertsService';
import { supabaseDataService } from '../supabaseDataService';
import type { PatientDataPayload } from '../types';
import { GPT_4O_MINI, REASONING } from '../ai/gpt-models';

export class AlertEngine {
  private alertsService: UnifiedAlertsService;
  private realTimeClient: OpenAIClient | null = null;
  private postConsultationClient: OpenAIClient | null = null;
  private deduplicator: AlertDeduplicator;

  constructor() {
    this.alertsService = new UnifiedAlertsService();
    this.deduplicator = this.createDeduplicator();
    
    // Initialize AI clients with lazy loading
    this.initializeAIClients();
  }

  private async initializeAIClients(): Promise<void> {
    try {
      // Real-time client for minute-by-minute processing
      this.realTimeClient = new OpenAIClient({
        model: GPT_4O_MINI,
        maxTokens: 1500,
        temperature: 0.1,
        retryAttempts: 2,
        timeout: 15000, // 15 seconds for real-time
      });

      // Post-consultation client for comprehensive analysis. Its output budget
      // includes the reasoning, and two attempts fit inside Vercel's default
      // 300-second function limit.
      this.postConsultationClient = new OpenAIClient({
        model: REASONING,
        maxTokens: 16000,
        reasoningEffort: 'low',
        retryAttempts: 1,
        timeout: 120000,
      });
    } catch (error) {
      console.warn('AI clients not available:', error);
      // Continue in mock mode for development
    }
  }

  // ==================== REAL-TIME PROCESSING ====================

  async processRealTimeAlerts(
    patientId: string, 
    encounterId: string, 
    transcriptSegment: string,
    fullTranscript?: string
  ): Promise<UnifiedAlert[]> {
    try {
      // Build processing context
      const context = await this.buildRealTimeContext(
        patientId, 
        encounterId, 
        transcriptSegment,
        fullTranscript
      );

      if (!context) {
        console.warn('Could not build real-time context');
        return [];
      }

      // Process alerts
      const alertRequests = await this.processWithAI(context, true);
      
      // Deduplicate and create alerts
      const newAlerts: UnifiedAlert[] = [];
      for (const request of alertRequests) {
        if (!this.deduplicator(request, context.existingAlerts)) {
          continue; // Skip duplicate
        }

        const alert = await this.alertsService.createAlert({
          ...request,
          isRealTime: true,
          category: AlertCategory.REAL_TIME
        });

        if (alert) {
          newAlerts.push(alert);
        }
      }

      return newAlerts;
    } catch (error) {
      console.error('Real-time alert processing failed:', error);
      return [];
    }
  }

  // ==================== POST-CONSULTATION PROCESSING ====================

  async processPostConsultationAlerts(
    patientId: string, 
    encounterId: string
  ): Promise<UnifiedAlert[]> {
    try {
      // Build comprehensive context
      const context = await this.buildPostConsultationContext(patientId, encounterId);
      
      if (!context) {
        console.warn('Could not build post-consultation context');
        return [];
      }

      if (!context.fullTranscript.trim()) {
        console.log('[AlertEngine] No transcript saved for this consultation; nothing to review');
        return [];
      }

      // Process with comprehensive AI analysis
      const alertRequests = await this.processWithAI(context, false);
      
      // Create new alerts and refresh existing ones
      const newAlerts: UnifiedAlert[] = [];
      
      // First, mark old real-time alerts as resolved/outdated
      await this.refreshExistingAlerts(patientId, encounterId, context.realTimeAlerts);

      // Create new comprehensive alerts
      for (const request of alertRequests) {
        const alert = await this.alertsService.createAlert({
          ...request,
          isPostConsultation: true,
          category: AlertCategory.POST_CONSULTATION
        });

        if (alert) {
          newAlerts.push(alert);
        }
      }

      return newAlerts;
    } catch (error) {
      console.error('Post-consultation alert processing failed:', error);
      return [];
    }
  }

  // ==================== AI PROCESSING ====================

  private async processWithAI(
    context: RealTimeAlertContext | PostConsultationAlertContext, 
    isRealTime: boolean
  ): Promise<CreateAlertRequest[]> {
    const client = isRealTime ? this.realTimeClient : this.postConsultationClient;
    
    console.log(`[AlertEngine] Processing ${isRealTime ? 'real-time' : 'post-consultation'} alerts`, {
      patientId: context.patientId,
      encounterId: context.encounterId,
      hasClient: !!client,
      enableMockAlerts: process.env.NEXT_PUBLIC_ENABLE_MOCK_ALERTS,
      transcriptLength: context.fullTranscript?.length || 0
    });
    
    // If OpenAI client is not available we cannot process alerts.
    if (!client) {
      console.log(`[AlertEngine] No ${isRealTime ? 'real-time' : 'post-consultation'} client available, cannot process alerts`);
      return [];
    }

    try {
      const aiContext = this.buildAIProcessingContext(context);
      const request: AIProcessingRequest = {
        model: isRealTime ? GPT_4O_MINI : REASONING,
        context: aiContext,
        promptTemplate: getRealTimeTemplate(),
        isRealTime,
        maxAlerts: isRealTime ? 3 : 10,
        confidenceThreshold: isRealTime ? 0.8 : 0.7
      };

      const response = await client.processAlerts(request);
      
      if (response.success) {
        return response.alerts.map(aiAlert => ({
          patientId: context.patientId,
          encounterId: context.encounterId,
          alertType: aiAlert.type as AlertType,
          severity: aiAlert.severity as AlertSeverity,
          title: aiAlert.title,
          message: aiAlert.message,
          suggestion: aiAlert.suggestion,
          confidenceScore: aiAlert.confidence,
          sourceReasoning: aiAlert.reasoning,
          processingModel: response.model,
          relatedData: aiAlert.relatedData,
          navigationTarget: aiAlert.navigationTarget,
          proposedEdit: aiAlert.proposedEdit
        }));
      }

      return [];
    } catch (error) {
      console.error('AI processing failed:', error);
      return [];
    }
  }

  // ==================== CONTEXT BUILDING ====================

  private async buildRealTimeContext(
    patientId: string, 
    encounterId: string,
    transcriptSegment: string,
    fullTranscript?: string
  ): Promise<RealTimeAlertContext | null> {
    try {
      // Get existing alerts
      const existingAlerts = await this.alertsService.getAlerts({
        patientId,
        encounterId,
        statuses: [AlertStatus.ACTIVE]
      });

      const patientHistory = this.getPatientHistory(await this.loadPatientData(patientId));

      return {
        patientId,
        encounterId,
        transcriptSegment,
        fullTranscript: fullTranscript || transcriptSegment,
        patientHistory,
        existingAlerts: existingAlerts.alerts
      };
    } catch (error) {
      console.error('Failed to build real-time context:', error);
      return null;
    }
  }

  private async buildPostConsultationContext(
    patientId: string, 
    encounterId: string
  ): Promise<PostConsultationAlertContext | null> {
    try {
      // Get real-time alerts from this consultation
      const realTimeAlerts = await this.alertsService.getAlerts({
        patientId,
        encounterId,
        isRealTime: true
      });

      // Read the consultation back as it was just saved, not from a cached copy
      const patientData = await this.loadPatientData(patientId, true);
      const patientHistory = this.getPatientHistory(patientData);
      const consultationData = this.getConsultationData(patientData, patientId, encounterId);

      return {
        patientId,
        encounterId,
        fullTranscript: consultationData?.transcript || '',
        soapNote: consultationData?.soapNote,
        patientHistory,
        realTimeAlerts: realTimeAlerts.alerts,
        diagnosticResults: consultationData?.diagnosticResults,
        treatments: consultationData?.treatments
      };
    } catch (error) {
      console.error('Failed to build post-consultation context:', error);
      return null;
    }
  }

  private buildAIProcessingContext(
    context: RealTimeAlertContext | PostConsultationAlertContext
  ): AIProcessingContext {
    const existingAlerts = 'existingAlerts' in context 
      ? context.existingAlerts 
      : context.realTimeAlerts || [];
    
    return {
      patientId: context.patientId,
      encounterId: context.encounterId,
      patientData: {
        demographics: context.patientHistory?.demographics || {},
        conditions: context.patientHistory?.conditions || [],
        medications: context.patientHistory?.medications || [],
        labResults: context.patientHistory?.labResults || [],
        allergies: context.patientHistory?.allergies || [],
        vitals: context.patientHistory?.vitals || []
      },
      transcript: {
        full: context.fullTranscript,
        segment: 'transcriptSegment' in context ? context.transcriptSegment : undefined
      },
      existingAlerts: existingAlerts.map(alert => ({
        id: alert.id,
        type: alert.alertType,
        message: alert.message,
        createdAt: alert.createdAt
      })),
      consultationContext: 'soapNote' in context ? {
        soapNote: context.soapNote,
        diagnosticResults: context.diagnosticResults,
        treatments: Array.isArray(context.treatments) ? context.treatments : []
      } : undefined
    };
  }

  // ==================== HELPER METHODS ====================

  // The patient's chart, loaded the way the clinical engine loads it.
  private async loadPatientData(patientId: string, fresh = false): Promise<PatientDataPayload | null> {
    try {
      if (fresh) supabaseDataService.clearPatientCache(patientId);
      return await supabaseDataService.getPatientData(patientId);
    } catch (error) {
      console.error('[AlertEngine] Could not load the patient:', error);
      return null;
    }
  }

  // What the model is told about the patient: only what the chart holds.
  private getPatientHistory(patientData: PatientDataPayload | null): Record<string, any> {
    const patient = patientData?.patient;
    const encounters = patientData?.encounters ?? [];
    return {
      demographics: patient
        ? {
            gender: patient.gender,
            dateOfBirth: patient.dateOfBirth,
            race: patient.race,
            ethnicity: patient.ethnicity,
            language: patient.language
          }
        : {},
      conditions: encounters.flatMap(({ diagnoses }) =>
        diagnoses
          .filter(diagnosis => diagnosis.code || diagnosis.description)
          .map(diagnosis => ({ code: diagnosis.code, description: diagnosis.description }))
      ),
      medications: encounters.flatMap(({ encounter }) =>
        (encounter.treatments ?? []).map(treatment => ({ drug: treatment.drug, status: treatment.status }))
      ),
      labResults: encounters.flatMap(({ labResults }) =>
        labResults.map(lab => ({
          name: lab.name,
          value: lab.value,
          units: lab.units,
          dateTime: lab.dateTime,
          referenceRange: lab.referenceRange,
          flag: lab.flag
        }))
      ),
      allergies: [],
      vitals: []
    };
  }

  private getConsultationData(
    patientData: PatientDataPayload | null,
    patientId: string,
    encounterId: string
  ): Record<string, any> | null {
    // The id may come as "<patientId>_<encounterId>", as the clinical engine's does
    const id = encounterId.startsWith(`${patientId}_`) ? encounterId.slice(patientId.length + 1) : encounterId;
    const encounter = patientData?.encounters.find(
      ({ encounter }) => encounter.id === id || encounter.encounterIdentifier === id
    )?.encounter;
    if (!encounter) return null;
    return {
      transcript: encounter.transcript || '',
      soapNote: encounter.soapNote || '',
      diagnosticResults: encounter.diagnosis_rich_content?.text_content
        ? { diagnosis: encounter.diagnosis_rich_content.text_content }
        : {},
      treatments: encounter.treatments ?? []
    };
  }

  private async refreshExistingAlerts(
    patientId: string, 
    encounterId: string, 
    realTimeAlerts: UnifiedAlert[]
  ): Promise<void> {
    // Mark real-time alerts as resolved since we're doing comprehensive analysis
    for (const alert of realTimeAlerts) {
      if (alert.status === AlertStatus.ACTIVE) {
        await this.alertsService.updateAlert(alert.id, {
          status: AlertStatus.RESOLVED
        });
      }
    }
  }

  private createDeduplicator(): AlertDeduplicator {
    return (newAlert: CreateAlertRequest, existingAlerts: UnifiedAlert[]): boolean => {
      // Check for exact duplicates by message similarity
      const threshold = 0.8;
      
      for (const existing of existingAlerts) {
        if (existing.alertType === newAlert.alertType) {
          // Simple similarity check - in production, use more sophisticated comparison
          const similarity = this.calculateSimilarity(existing.message, newAlert.message);
          if (similarity > threshold) {
            return false; // Skip duplicate
          }
        }
      }
      
      return true; // Not a duplicate
    };
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity for demonstration
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private generateMockAlerts(
    context: RealTimeAlertContext | PostConsultationAlertContext,
    isRealTime: boolean
  ): CreateAlertRequest[] {
    // Generate mock alerts for development/testing based on transcript content
    const alerts: CreateAlertRequest[] = [];
    const transcript = context.fullTranscript?.toLowerCase() || '';

    console.log('[AlertEngine] Generating mock alerts for transcript:', transcript.substring(0, 200) + '...');

    if (isRealTime) {
      // Real-time alerts - look for specific patterns in the transcript
      if (transcript.includes('methotrexate') && transcript.includes('paracetamol')) {
        alerts.push({
          patientId: context.patientId,
          encounterId: context.encounterId,
          alertType: AlertType.DRUG_INTERACTION,
          severity: AlertSeverity.CRITICAL,
          title: 'Potential Drug Interaction Detected',
          message: 'Methotrexate combined with paracetamol may increase hepatotoxicity risk. Monitor liver function closely.',
          suggestion: 'Consider alternative pain management or reduce paracetamol dose. Monitor AST/ALT levels.',
          confidenceScore: 0.92,
          sourceReasoning: 'Pattern matching identified concurrent use of methotrexate and paracetamol',
          processingModel: 'mock-pattern-matcher'
        });
      }

      if (transcript.includes('fatigue') && transcript.includes('joint') && transcript.includes('pain')) {
        alerts.push({
          patientId: context.patientId,
          encounterId: context.encounterId,
          alertType: AlertType.MISSING_LAB_RESULT,
          severity: AlertSeverity.WARNING,
          title: 'Rheumatological Workup Recommended',
          message: 'Patient presents with fatigue and joint pain. Consider rheumatoid factor, anti-CCP, and inflammatory markers.',
          suggestion: 'Order RF, anti-CCP antibodies, ESR, CRP, and ANA to evaluate for autoimmune conditions.',
          confidenceScore: 0.87,
          sourceReasoning: 'Symptom pattern suggests possible rheumatological condition requiring laboratory evaluation',
          processingModel: 'mock-pattern-matcher'
        });
      }

      // Add a general mock alert if no specific patterns match
      if (alerts.length === 0 && transcript.length > 50) {
        alerts.push({
          patientId: context.patientId,
          encounterId: context.encounterId,
          alertType: AlertType.CLINICAL_GUIDELINE,
          severity: AlertSeverity.INFO,
          title: 'Real-time Clinical Monitoring',
          message: 'Mock alert system is active and monitoring consultation in real-time.',
          suggestion: 'This demonstrates the real-time alert capabilities during live consultations.',
          confidenceScore: 0.75,
          sourceReasoning: 'Mock alert for development and testing purposes',
          processingModel: 'mock-model'
        });
      }
    } else {
      // Post-consultation alerts - more comprehensive analysis
      if (transcript.includes('rheumatoid') || transcript.includes('arthritis')) {
        alerts.push({
          patientId: context.patientId,
          encounterId: context.encounterId,
          alertType: AlertType.COMORBIDITY,
          severity: AlertSeverity.WARNING,
          title: 'Rheumatoid Arthritis Management Review',
          message: 'Patient may have rheumatoid arthritis. Ensure DMARD therapy is optimized and monitoring is current.',
          suggestion: 'Review current DMARD therapy, order quarterly labs, and consider rheumatology referral if not already under care.',
          confidenceScore: 0.88,
          sourceReasoning: 'Post-consultation analysis identified possible rheumatoid arthritis requiring specialized management',
          processingModel: 'mock-comprehensive-analyzer'
        });
      }

      // Add a general post-consultation mock alert
      alerts.push({
        patientId: context.patientId,
        encounterId: context.encounterId,
        alertType: AlertType.ASSESSMENT_QUESTION,
        severity: AlertSeverity.INFO,
        title: 'Post-consultation Analysis Complete',
        message: 'Comprehensive review of consultation completed. Consider follow-up plan optimization.',
        suggestion: 'Review consultation summary and ensure all clinical issues have been addressed appropriately.',
        confidenceScore: 0.70,
        sourceReasoning: 'Mock post-consultation analysis for development purposes',
        processingModel: 'mock-comprehensive-analyzer'
      });
    }

    console.log(`[AlertEngine] Generated ${alerts.length} mock alerts:`, alerts.map(a => a.title));
    return alerts;
  }
}

// Export singleton instance
export const alertEngine = new AlertEngine();
export default alertEngine; 