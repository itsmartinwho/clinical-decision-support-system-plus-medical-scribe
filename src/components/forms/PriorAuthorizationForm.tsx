'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, DownloadSimple, Warning, CheckCircle } from '@phosphor-icons/react';
import FHIRResourceSelector from '@/components/ui/FHIRResourceSelector';
import { EditableTextField } from '@/components/ui/editable';
import { PriorAuthService, PRIOR_AUTH_RESOURCE_TYPES } from '@/lib/forms/priorAuthService';
import { PDFGenerator } from '@/lib/forms/pdfGenerator';
import { Patient, Encounter, Diagnosis, PriorAuthFormData, FormValidationResult } from '@/lib/types';
import { toast } from '@/hooks/use-toast';

interface PriorAuthorizationFormProps {
  patient: Patient;
  encounter: Encounter;
  diagnoses: Diagnosis[];
  onSave: (data: PriorAuthFormData) => Promise<void>;
  onGeneratePDF: (data: PriorAuthFormData) => Promise<void>;
}

export default function PriorAuthorizationForm({
  patient,
  encounter,
  diagnoses,
  onSave,
  onGeneratePDF
}: PriorAuthorizationFormProps) {
  const [formData, setFormData] = useState<PriorAuthFormData>(() =>
    PriorAuthService.autoPopulateForm(patient || {} as Patient, encounter || {} as Encounter, diagnoses || [])
  );
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  useEffect(() => {
    if (patient && encounter) {
      setFormData(PriorAuthService.autoPopulateForm(patient, encounter, diagnoses || []));
    }
  }, [patient, encounter, diagnoses]);

  // Validate on form data changes
  useEffect(() => {
    const validation = PriorAuthService.validateForm(formData);
    setErrors(validation.errors);
  }, [formData]);

  // Auto-populate when resource type changes
  useEffect(() => {
    if (patient && encounter) {
      const newFormData = PriorAuthService.autoPopulateForm(patient, encounter, diagnoses, formData.resourceType);
      // Only update fields that are currently empty to avoid overriding user input
      setFormData(prev => ({
        ...prev,
        resourceType: formData.resourceType, // Always update resource type
        // Only populate patient info if it's currently empty
        patientInformation: {
          name: prev.patientInformation.name || newFormData.patientInformation.name,
          dateOfBirth: prev.patientInformation.dateOfBirth || newFormData.patientInformation.dateOfBirth,
          gender: prev.patientInformation.gender || newFormData.patientInformation.gender,
          insuranceId: prev.patientInformation.insuranceId || newFormData.patientInformation.insuranceId,
          memberId: prev.patientInformation.memberId || newFormData.patientInformation.memberId,
        },
        // Provider info is typically left as manual input
        providerInformation: prev.providerInformation,
        // Only populate service request if diagnosis/service are currently empty
        serviceRequest: {
          diagnosis: prev.serviceRequest.diagnosis || newFormData.serviceRequest.diagnosis,
          diagnosisCode: prev.serviceRequest.diagnosisCode || newFormData.serviceRequest.diagnosisCode,
          requestedService: prev.serviceRequest.requestedService || newFormData.serviceRequest.requestedService,
          serviceCode: prev.serviceRequest.serviceCode || newFormData.serviceRequest.serviceCode,
          startDate: prev.serviceRequest.startDate || newFormData.serviceRequest.startDate,
          duration: prev.serviceRequest.duration || newFormData.serviceRequest.duration,
          frequency: prev.serviceRequest.frequency || newFormData.serviceRequest.frequency,
        },
        // Only populate clinical justification if empty
        clinicalJustification: prev.clinicalJustification || newFormData.clinicalJustification,
        authorizationNumber: prev.authorizationNumber || newFormData.authorizationNumber,
        urgencyLevel: prev.urgencyLevel || newFormData.urgencyLevel,
        supportingDocumentation: prev.supportingDocumentation || newFormData.supportingDocumentation,
      }));
    }
  }, [formData.resourceType, patient, encounter, diagnoses]);

  const handleInputChange = (section: keyof PriorAuthFormData, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section] as any,
        [field]: value
      }
    }));
  };

  const handleGeneratePDF = async () => {
    const validation = PriorAuthService.validateForm(formData);
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
      const pdfData = PriorAuthService.preparePDFData(formData);
      
      // Generate HTML file using PDFGenerator
      const blob = await PDFGenerator.generatePriorAuthPDF(pdfData);
      
      // Download the HTML file
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `prior_auth_${formData.patientInformation.name.replace(/\s+/g, '_')}_${timestamp}.html`;
      PDFGenerator.downloadBlob(blob, filename);
      
      toast({
        title: "Form Downloaded Successfully", 
        description: "Prior authorization form has been downloaded as HTML file",
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
          Prior authorization
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
          resourceTypes={PRIOR_AUTH_RESOURCE_TYPES}
          placeholder="Select authorization type"
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
              <label className="block text-sm font-medium text-muted-foreground mb-1">Insurance ID</label>
              <Input
                value={formData.patientInformation.insuranceId}
                onChange={(e) => handleInputChange('patientInformation', 'insuranceId', e.target.value)}
                placeholder="Enter insurance ID"
              />
            </div>
          </div>
        </div>

        {/* Provider Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-foreground">Provider Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Provider Name
                {errors.providerName && (
                  <span className="text-flag ml-1">⚠</span>
                )}
              </label>
              <Input
                value={formData.providerInformation.name}
                onChange={(e) => handleInputChange('providerInformation', 'name', e.target.value)}
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
                value={formData.providerInformation.npi}
                onChange={(e) => handleInputChange('providerInformation', 'npi', e.target.value)}
                placeholder="Enter NPI number"
              />
              {errors.providerNPI && (
                <p className="text-xs text-flag mt-1">{errors.providerNPI}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Facility</label>
              <Input
                value={formData.providerInformation.facility}
                onChange={(e) => handleInputChange('providerInformation', 'facility', e.target.value)}
                placeholder="Enter facility name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Contact Phone</label>
              <Input
                value={formData.providerInformation.contactPhone}
                onChange={(e) => handleInputChange('providerInformation', 'contactPhone', e.target.value)}
                placeholder="Enter contact phone"
              />
            </div>
          </div>
        </div>

        {/* Service Request */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-foreground">Service Request</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Diagnosis *
              </label>
              <EditableTextField
                value={formData.serviceRequest.diagnosis}
                onSave={async (value) => Promise.resolve(handleInputChange('serviceRequest', 'diagnosis', value))}
                placeholder="Enter diagnosis"
                displayClassName={errors.diagnosis ? "text-destructive" : "text-sm"}
              />
              {errors.diagnosis && (
                <p className="text-xs text-destructive mt-1">{errors.diagnosis}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">ICD-10 Code</label>
              <Input
                value={formData.serviceRequest.diagnosisCode}
                onChange={(e) => handleInputChange('serviceRequest', 'diagnosisCode', e.target.value)}
                placeholder="Enter ICD-10 code"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Requested Service/Medication *
              </label>
              <EditableTextField
                value={formData.serviceRequest.requestedService}
                onSave={async (value) => Promise.resolve(handleInputChange('serviceRequest', 'requestedService', value))}
                placeholder="Enter requested service or medication"
                displayClassName={errors.requestedService ? "text-destructive" : "text-sm"}
              />
              {errors.requestedService && (
                <p className="text-xs text-destructive mt-1">{errors.requestedService}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Service Code
                {errors.serviceCode && (
                  <span className="text-flag ml-1">⚠</span>
                )}
              </label>
              <Input
                value={formData.serviceRequest.serviceCode}
                onChange={(e) => handleInputChange('serviceRequest', 'serviceCode', e.target.value)}
                placeholder="Enter service code"
              />
              {errors.serviceCode && (
                <p className="text-xs text-flag mt-1">{errors.serviceCode}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Urgency Level</label>
              <Select
                value={formData.urgencyLevel}
                onValueChange={(value) => setFormData(prev => ({ ...prev, urgencyLevel: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select urgency level" />
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

        {/* Clinical Justification */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-foreground">Clinical Justification</h3>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Clinical Justification *
            </label>
            <Textarea
              value={formData.clinicalJustification}
              onChange={(e) => setFormData(prev => ({ ...prev, clinicalJustification: e.target.value }))}
              placeholder="Enter clinical justification for prior authorization..."
              className={`min-h-[100px] ${errors.clinicalJustification ? "border-destructive" : ""}`}
            />
            {errors.clinicalJustification && (
              <p className="text-xs text-destructive">{errors.clinicalJustification}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              Authorization Number
            </label>
            <Input
              value={formData.authorizationNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, authorizationNumber: e.target.value }))}
              placeholder="Enter authorization number (if available)"
            />
          </div>
        </div>

        {/* Validation Summary */}
        {Object.keys(errors).length > 0 && (
          <div className="space-y-2">
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm font-medium text-destructive mb-1">Required fields missing:</p>
              <ul className="text-xs text-destructive/80 list-disc list-inside">
                {Object.values(errors).map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 