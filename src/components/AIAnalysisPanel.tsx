'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ClinicalOutputPackage } from '@/lib/types';
import { Brain, FloppyDisk as Save, CircleNotch } from '@phosphor-icons/react';
import { Sparkle } from '@phosphor-icons/react';

interface AIAnalysisPanelProps {
  patientId: string;
  encounterId: string;
  onSave: (results: ClinicalOutputPackage) => Promise<void>;
}

export default function AIAnalysisPanel({ patientId, encounterId, onSave }: AIAnalysisPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ClinicalOutputPackage | null>(null);
  const [editedDiagnosis, setEditedDiagnosis] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleRunAnalysis = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/clinical-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, encounterId }),
      });

      if (!response.ok) {
        throw new Error('Failed to run analysis');
      }

      const result: ClinicalOutputPackage = await response.json();
      setAnalysisResult(result);
      setEditedDiagnosis(result.diagnosticResult.diagnosisName);
    } catch (error) {
      console.error('Error running analysis:', error);
      alert('Failed to run AI analysis. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePlan = async () => {
    if (!analysisResult) return;

    setIsSaving(true);
    try {
      // Update the diagnosis name with any edits
      const updatedResult = {
        ...analysisResult,
        diagnosticResult: {
          ...analysisResult.diagnosticResult,
          diagnosisName: editedDiagnosis,
        },
      };

      await onSave(updatedResult);
      alert('AI-generated plan saved successfully!');
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('Failed to save plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          AI Clinical Analysis
          {!analysisResult && (
            <Button 
              variant="default" 
              onClick={handleRunAnalysis} 
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  Generate AI Diagnosis & Plan
                </>
              )}
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      {analysisResult && (
        <CardContent className="space-y-6">
          {/* Primary Diagnosis */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Primary Diagnosis</h3>
            <div className="flex items-center gap-4">
              <Input
                value={editedDiagnosis}
                onChange={(e) => setEditedDiagnosis(e.target.value)}
                className="flex-1"
                placeholder="Diagnosis name"
              />
              {analysisResult.diagnosticResult.diagnosisCode && (
                <span className="text-sm text-ink-2">
                  Code: {analysisResult.diagnosticResult.diagnosisCode}
                </span>
              )}
              <span className="text-sm text-ink-2">
                Confidence: {(analysisResult.diagnosticResult.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Differential Diagnoses */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Differential Diagnoses</h3>
            <ul className="space-y-2">
              {analysisResult.diagnosticResult.differentialDiagnoses.map((diff, idx) => (
                <li key={idx} className="p-3 bg-well/50 rounded-lg">
                  <div className="font-medium">{diff.name}</div>
                  <div className="text-sm text-ink-2">
                    Likelihood: {diff.likelihood} | Key factors: {diff.keyFactors}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Recommended Tests */}
          {analysisResult.diagnosticResult.recommendedTests.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Recommended Tests</h3>
              <div className="p-3 bg-info-soft rounded-lg">
                {analysisResult.diagnosticResult.recommendedTests.join('; ')}
              </div>
            </div>
          )}

          {/* Treatment Plan */}
          {analysisResult.diagnosticResult.recommendedTreatments.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Recommended Treatments</h3>
              <ul className="list-disc list-inside space-y-1">
                {analysisResult.diagnosticResult.recommendedTreatments.map((treatment, idx) => (
                  <li key={idx} className="text-ink">{treatment}</li>
                ))}
              </ul>
            </div>
          )}

          {/* SOAP Note */}
          {analysisResult.soapNote && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Draft SOAP Note</h3>
              <div className="p-4 bg-well/50 rounded-lg text-sm whitespace-pre-wrap">
                <div className="mb-2"><strong>S:</strong> {analysisResult.soapNote.subjective}</div>
                <div className="mb-2"><strong>O:</strong> {analysisResult.soapNote.objective}</div>
                <div className="mb-2"><strong>A:</strong> {analysisResult.soapNote.assessment}</div>
                <div><strong>P:</strong> {analysisResult.soapNote.plan}</div>
              </div>
            </div>
          )}

          {/* Referral Document */}
          {analysisResult.referralDocument && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Specialist Referral Draft</h3>
              <Textarea
                defaultValue={JSON.stringify(analysisResult.referralDocument.generatedContent, null, 2)}
                className="font-mono text-xs"
                rows={6}
              />
            </div>
          )}

          {/* Prior Authorization */}
          {analysisResult.priorAuthDocument && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Prior Authorization Draft</h3>
              <Textarea
                defaultValue={JSON.stringify(analysisResult.priorAuthDocument.generatedContent, null, 2)}
                className="font-mono text-xs"
                rows={6}
              />
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              variant="default"
              onClick={handleSavePlan}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <CircleNotch className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Plan to Encounter
                </>
              )}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
} 