'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DownloadSimple, Warning, CheckCircle, Plus, X } from '@phosphor-icons/react';
import FHIRResourceSelector from '@/components/ui/FHIRResourceSelector';
import { EditableTextField } from '@/components/ui/editable';
import { ReferralService, REFERRAL_RESOURCE_TYPES, SPECIALTY_TYPES } from '@/lib/forms/referralService';
import { PDFGenerator } from '@/lib/forms/pdfGenerator';
import { Patient, Encounter, Diagnosis, LabResult, ReferralFormData, FormValidationResult } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

interface ReferralFormProps {
  patient: Patient;
  encounter: Encounter;
  diagnoses: Diagnosis[];
  labResults?: LabResult[];
  onSave: (data: ReferralFormData) => Promise<void>;
  onGeneratePDF: (data: ReferralFormData) => Promise<void>;
}

export default function ReferralForm({
  patient,
  encounter,
  diagnoses,
  labResults = [],
  onSave,
  onGeneratePDF
}: ReferralFormProps) {
  const [formData, setFormData] = useState<ReferralFormData>(() =>
    ReferralService.autoPopulateForm(patient || {} as Patient, encounter || {} as Encounter, diagnoses || [], labResults)
  );
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  useEffect(() => {
    if (patient && encounter) {
      setFormData(ReferralService.autoPopulateForm(patient, encounter, diagnoses || [], labResults));
    }
  }, [patient, encounter, diagnoses, labResults]);

  // Validate on form data changes
  useEffect(() => {
    const validation = ReferralService.validateForm(formData);
    setErrors(validation.errors);
  }, [formData]);

  const handleInputChange = (section: keyof ReferralFormData, field: string, value: any) => {
    if (section === 'requestedEvaluation') {
      setFormData(prev => ({ ...prev, requestedEvaluation: value }));
    } else if (section === 'additionalNotes') {
      setFormData(prev => ({ ...prev, additionalNotes: value }));
    } else {
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section] as any,
          [field]: value
        }
      }));
    }
  };

  const handleGeneratePDF = async () => {
    const validation = ReferralService.validateForm(formData);
    if (!validation.isValid) {
      toast({
        title: "Form Validation Failed",
        description: "Please fix the errors before downloading",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingPDF(true);
    try {
      // Prepare data for PDF generation using the same format as sections
      const pdfData = ReferralService.preparePDFData(formData);
      
      // Generate HTML file using PDFGenerator
      const blob = await PDFGenerator.generateReferralPDF(pdfData);
      
      // Download the HTML file
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `referral_${formData.patientInformation.name.replace(/\s+/g, '_')}_${timestamp}.html`;
      PDFGenerator.downloadBlob(blob, filename);
      
      toast({
        title: "Form Downloaded Successfully", 
        description: "Referral form has been downloaded as HTML file",
        variant: "default"
      });
    } catch (error) {
      console.error('Download failed:', error);
      toast({
        title: "Download Failed",
        description: "Please try again or contact support",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const addRequestedEvaluation = () => {
    const updatedEvaluations = [...formData.requestedEvaluation, ''];
    handleInputChange('requestedEvaluation', '', updatedEvaluations);
  };

  const removeRequestedEvaluation = (index: number) => {
    const updatedEvaluations = formData.requestedEvaluation.filter((_, i) => i !== index);
    handleInputChange('requestedEvaluation', '', updatedEvaluations);
  };

  const updateRequestedEvaluation = (index: number, value: string) => {
    const updatedEvaluations = [...formData.requestedEvaluation];
    updatedEvaluations[index] = value;
    handleInputChange('requestedEvaluation', '', updatedEvaluations);
  };

  const isFormValid = Object.keys(errors).length === 0;

  // Defensive null checks after hooks - return JSX with error message
  if (!patient || !encounter) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Unable to load form data. Patient or encounter information is missing.</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-foreground flex items-center justify-between">
          Referral
          <div className="flex items-center gap-2">
            {isFormValid ? (
              <CheckCircle className="h-5 w-5 text-ok" />
            ) : (
              <Warning className="h-5 w-5 text-flag" />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleGeneratePDF}
              disabled={!isFormValid || isGeneratingPDF}
              className="flex items-center gap-2"
            >
              {isGeneratingPDF ? (
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <DownloadSimple className="h-4 w-4" />
              )}
              Download
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* FHIR Resource Type Selector */}
        <FHIRResourceSelector
          value={formData.resourceType}
          onValueChange={(value) => setFormData(prev => ({ ...prev, resourceType: value }))}
          resourceTypes={REFERRAL_RESOURCE_TYPES}
          placeholder="Select referral type"
        />

        {/* Patient Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-foreground">Patient Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Patient Name *
              </label>
              <Input
                value={formData.patientInformation.name}
                onChange={(e) => handleInputChange('patientInformation', 'name', e.target.value)}
                placeholder="Enter patient name"
                className={errors.patientName ? "border-destructive" : ""}
              />
              {errors.patientName && (
                <p className="text-xs text-destructive mt-1">{errors.patientName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Date of Birth *
              </label>
              <Input
                type="date"
                value={formData.patientInformation.dateOfBirth}
                onChange={(e) => handleInputChange('patientInformation', 'dateOfBirth', e.target.value)}
                className={errors.dateOfBirth ? "border-destructive" : ""}
              />
              {errors.dateOfBirth && (
                <p className="text-xs text-destructive mt-1">{errors.dateOfBirth}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Gender</label>
              <Input
                value={formData.patientInformation.gender}
                onChange={(e) => handleInputChange('patientInformation', 'gender', e.target.value)}
                placeholder="Enter gender"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Contact Phone</label>
              <Input
                value={formData.patientInformation.contactPhone}
                onChange={(e) => handleInputChange('patientInformation', 'contactPhone', e.target.value)}
                placeholder="Enter contact phone"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Insurance</label>
              <Input
                value={formData.patientInformation.insurance}
                onChange={(e) => handleInputChange('patientInformation', 'insurance', e.target.value)}
                placeholder="Enter insurance information"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Address</label>
              <Input
                value={formData.patientInformation.address}
                onChange={(e) => handleInputChange('patientInformation', 'address', e.target.value)}
                placeholder="Enter patient address"
              />
            </div>
          </div>
        </div>

        {/* Referring Provider Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-foreground">Referring Provider Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Provider Name
                {errors.providerName && (
                  <span className="text-flag ml-1">⚠</span>
                )}
              </label>
              <Input
                value={formData.referringProvider.name}
                onChange={(e) => handleInputChange('referringProvider', 'name', e.target.value)}
                placeholder="Enter provider name"
              />
              {errors.providerName && (
                <p className="text-xs text-flag mt-1">{errors.providerName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                NPI Number
                {errors.providerNPI && (
                  <span className="text-flag ml-1">⚠</span>
                )}
              </label>
              <Input
                value={formData.referringProvider.npi}
                onChange={(e) => handleInputChange('referringProvider', 'npi', e.target.value)}
                placeholder="Enter NPI number"
              />
              {errors.providerNPI && (
                <p className="text-xs text-flag mt-1">{errors.providerNPI}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Facility</label>
              <Input
                value={formData.referringProvider.facility}
                onChange={(e) => handleInputChange('referringProvider', 'facility', e.target.value)}
                placeholder="Enter facility name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Contact Phone</label>
              <Input
                value={formData.referringProvider.contactPhone}
                onChange={(e) => handleInputChange('referringProvider', 'contactPhone', e.target.value)}
                placeholder="Enter contact phone"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Contact Email</label>
              <Input
                value={formData.referringProvider.contactEmail}
                onChange={(e) => handleInputChange('referringProvider', 'contactEmail', e.target.value)}
                placeholder="Enter contact email"
              />
            </div>
          </div>
        </div>

        {/* Specialist Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-foreground">Specialist Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Specialty Type *
              </label>
              <Select
                value={formData.specialist.type}
                onValueChange={(value) => handleInputChange('specialist', 'type', value)}
              >
                <SelectTrigger className={errors.specialtyType ? "border-destructive" : ""}>
                  <SelectValue placeholder="Select specialty" />
                </SelectTrigger>
                <SelectContent>
                  {SPECIALTY_TYPES.map((specialty) => (
                    <SelectItem key={specialty} value={specialty}>
                      {specialty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.specialtyType && (
                <p className="text-xs text-destructive mt-1">{errors.specialtyType}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Preferred Facility
                {errors.specialistFacility && (
                  <span className="text-flag ml-1">⚠</span>
                )}
              </label>
              <Input
                value={formData.specialist.facility}
                onChange={(e) => handleInputChange('specialist', 'facility', e.target.value)}
                placeholder="Enter preferred facility"
              />
              {errors.specialistFacility && (
                <p className="text-xs text-flag mt-1">{errors.specialistFacility}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Preferred Provider</label>
              <Input
                value={formData.specialist.preferredProvider}
                onChange={(e) => handleInputChange('specialist', 'preferredProvider', e.target.value)}
                placeholder="Enter preferred provider name"
              />
            </div>
          </div>
        </div>

        {/* Referral Reason */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-foreground">Referral Reason</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Primary Diagnosis *
              </label>
              <EditableTextField
                value={formData.referralReason.diagnosis}
                onSave={async (value) => Promise.resolve(handleInputChange('referralReason', 'diagnosis', value))}
                placeholder="Enter primary diagnosis"
                displayClassName={errors.diagnosis ? "text-destructive" : "text-sm"}
              />
              {errors.diagnosis && (
                <p className="text-xs text-destructive mt-1">{errors.diagnosis}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">ICD-10 Code</label>
              <Input
                value={formData.referralReason.diagnosisCode}
                onChange={(e) => handleInputChange('referralReason', 'diagnosisCode', e.target.value)}
                placeholder="Enter ICD-10 code"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Reason for Referral *
              </label>
              <EditableTextField
                value={formData.referralReason.reasonForReferral}
                onSave={async (value) => Promise.resolve(handleInputChange('referralReason', 'reasonForReferral', value))}
                placeholder="Enter detailed reason for referral..."
                multiline
                displayClassName={errors.reasonForReferral ? "text-destructive" : "text-sm"}
              />
              {errors.reasonForReferral && (
                <p className="text-xs text-destructive mt-1">{errors.reasonForReferral}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Urgency Level</label>
              <Select
                value={formData.referralReason.urgency}
                onValueChange={(value) => handleInputChange('referralReason', 'urgency', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="stat">STAT</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Clinical Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-foreground">Clinical Information</h3>
          
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              History of Present Illness
              {errors.clinicalHistory && (
                <span className="text-flag ml-1">⚠</span>
              )}
            </label>
            <EditableTextField
              value={formData.clinicalInformation.historyOfPresentIllness}
              onSave={async (value) => Promise.resolve(handleInputChange('clinicalInformation', 'historyOfPresentIllness', value))}
              placeholder="Enter history of present illness..."
              multiline
              displayClassName="text-sm"
            />
            {errors.clinicalHistory && (
              <p className="text-xs text-flag mt-1">{errors.clinicalHistory}</p>
            )}
          </div>

          {/* Current Medications */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Current Medications</label>
            <div className="flex flex-wrap gap-2 min-h-8">
              {formData.clinicalInformation.currentMedications.map((medication, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {medication}
                </Badge>
              ))}
              {formData.clinicalInformation.currentMedications.length === 0 && (
                <span className="text-sm text-muted-foreground italic">No current medications</span>
              )}
            </div>
          </div>

          {/* Allergies */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Allergies</label>
            <div className="flex flex-wrap gap-2 min-h-8">
              {formData.clinicalInformation.allergies.map((allergy, index) => (
                <Badge key={index} variant="destructive" className="text-xs">
                  {allergy}
                </Badge>
              ))}
              {formData.clinicalInformation.allergies.length === 0 && (
                <span className="text-sm text-muted-foreground italic">No known allergies</span>
              )}
            </div>
          </div>
        </div>

        {/* Requested Evaluation */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-foreground">Requested Evaluation</h3>
          <div className="space-y-2">
            {formData.requestedEvaluation.map((evaluation, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Input
                  value={evaluation}
                  onChange={(e) => updateRequestedEvaluation(index, e.target.value)}
                  placeholder="Enter requested evaluation"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeRequestedEvaluation(index)}
                  className="p-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addRequestedEvaluation}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Evaluation
            </Button>
          </div>
        </div>

        {/* Additional Notes */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-muted-foreground">Additional Notes</label>
          <EditableTextField
            value={formData.additionalNotes}
            onSave={async (value) => Promise.resolve(handleInputChange('additionalNotes', '', value))}
            placeholder="Enter any additional notes for the specialist..."
            multiline
            displayClassName="text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
} 