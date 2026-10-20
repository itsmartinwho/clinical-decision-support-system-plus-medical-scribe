'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { UnifiedAlert, AlertType, AlertSeverity, AlertStatus, AlertCategory } from '@/types/alerts';
import { UnifiedAlertsService } from '@/lib/unifiedAlertsService';
import AlertList from './AlertList';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Funnel as Filter, 
  ArrowsClockwise as RefreshCw, 
  ChartBar as BarChart3, 
  Warning as AlertTriangle, 
  Pill, 
  Stethoscope,
  Question as FileQuestion,
  TrendUp as TrendingUp,
  Brain
} from '@phosphor-icons/react';

interface AlertDashboardProps {
  patientId?: string;
  consultationId?: string;
  onAlertAction?: (alertId: string, action: string) => void;
}

interface AlertsByType {
  [key: string]: UnifiedAlert[];
}

export const AlertDashboard: React.FC<AlertDashboardProps> = ({
  patientId,
  consultationId,
  onAlertAction
}) => {
  const [alerts, setAlerts] = useState<UnifiedAlert[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<UnifiedAlert[]>([]);
  const [alertsByType, setAlertsByType] = useState<AlertsByType>({});
  const [isLoading, setIsLoading] = useState(true);

  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'severity'>('date');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [alertsService] = useState(() => new UnifiedAlertsService());

  
  // Track fetch attempts to prevent infinite loops
  const fetchAttemptRef = useRef(0);
  const hasFetchedRef = useRef(false);
  const fetchFailedRef = useRef(false);
  const MAX_FETCH_ATTEMPTS = 3;

  const alertTypeConfig = {
    [AlertType.DRUG_INTERACTION]: {
      label: 'Drug Interactions',
      icon: Pill,
      color: 'bg-critical-soft text-critical border-critical-line'
    },
    [AlertType.COMORBIDITY]: {
      label: 'Comorbidity Analysis',
      icon: TrendingUp,
      color: 'bg-info-soft text-info border-info/30'
    },
    [AlertType.ASSESSMENT_QUESTION]: {
      label: 'Assessment Questions',
      icon: FileQuestion,
      color: 'bg-ok-soft text-ok border-ok-line'
    },
    [AlertType.DIAGNOSTIC_GAP]: {
      label: 'Diagnostic Gaps',
      icon: Brain,
      color: 'bg-info-soft text-info border-info/30'
    },
    [AlertType.COMPLEX_CONDITION]: {
      label: 'Complex Conditions',
      icon: Stethoscope,
      color: 'bg-info-soft text-info border-info/30'
    },
    [AlertType.MISSING_LAB_RESULT]: {
      label: 'Missing Lab Results',
      icon: AlertTriangle,
      color: 'bg-flag-soft text-flag border-flag-line'
    },
    [AlertType.CLINICAL_GUIDELINE]: {
      label: 'Clinical Guidelines',
      icon: FileQuestion,
      color: 'bg-info-soft text-info border-info/30'
    },
    [AlertType.ABNORMAL_VITAL]: {
      label: 'Abnormal Vitals',
      icon: AlertTriangle,
      color: 'bg-flag-soft text-flag border-flag-line'
    },
    [AlertType.COMORBIDITY_REMINDER]: {
      label: 'Comorbidity Reminders',
      icon: TrendingUp,
      color: 'bg-well text-ink border-border'
    }
  };

  // Memoize mock alerts to prevent regeneration on every render
  const mockAlerts = useMemo(() => {
    const alerts: UnifiedAlert[] = [
      {
        id: 'mock-drug-1',
        patientId: patientId || 'demo-patient',
        encounterId: consultationId,
        alertType: AlertType.DRUG_INTERACTION,
        severity: AlertSeverity.WARNING,
        status: AlertStatus.ACTIVE,
        title: 'Potential Drug Interaction Detected',
        message: 'Interaction between prescribed Warfarin and patient-reported NSAIDs may increase bleeding risk.',
        suggestion: 'Consider switching to acetaminophen for pain management or monitor INR more frequently.',
        confidenceScore: 0.89,
        sourceReasoning: 'Based on known pharmacokinetic interactions between warfarin and NSAIDs affecting platelet function and warfarin metabolism.',
        processingModel: 'gpt-o3',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        isRealTime: false,
        isPostConsultation: true,
        acknowledged: false,
        migratedFromPatientAlerts: false,
        category: AlertCategory.POST_CONSULTATION
      },
      {
        id: 'mock-lab-1',
        patientId: patientId || 'demo-patient', 
        encounterId: consultationId,
        alertType: AlertType.MISSING_LAB_RESULT,
        severity: AlertSeverity.INFO,
        status: AlertStatus.ACTIVE,
        title: 'Consider Thyroid Function Testing',
        message: 'Patient presents with fatigue and weight changes. TSH and free T4 may help rule out thyroid dysfunction.',
        suggestion: 'Order TSH, free T4, and free T3 to evaluate thyroid function.',
        confidenceScore: 0.75,
        sourceReasoning: 'Symptoms of fatigue, weight changes, and hair thinning are consistent with thyroid dysfunction.',
        processingModel: 'gpt-o3',
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        isRealTime: false,
        isPostConsultation: true,
        acknowledged: false,
        migratedFromPatientAlerts: false,
        category: AlertCategory.POST_CONSULTATION
      },
      {
        id: 'mock-comorbidity-1',
        patientId: patientId || 'demo-patient',
        encounterId: consultationId,
        alertType: AlertType.COMORBIDITY,
        severity: AlertSeverity.CRITICAL,
        status: AlertStatus.ACTIVE,
        title: 'High Risk for Cardiovascular Disease',
        message: 'Patient has multiple risk factors: hypertension, diabetes, obesity (BMI 34), and family history of MI.',
        suggestion: 'Consider cardiology referral and initiate statin therapy. Order ECG and echocardiogram.',
        confidenceScore: 0.94,
        sourceReasoning: 'Multiple established cardiovascular risk factors present with high predictive value for future events.',
        processingModel: 'gpt-o3',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        isRealTime: false,
        isPostConsultation: true,
        acknowledged: false,
        migratedFromPatientAlerts: false,
        category: AlertCategory.POST_CONSULTATION
      },
      {
        id: 'mock-diagnostic-1',
        patientId: patientId || 'demo-patient',
        encounterId: consultationId,
        alertType: AlertType.DIAGNOSTIC_GAP,
        severity: AlertSeverity.WARNING,
        status: AlertStatus.ACTIVE,
        title: 'Consider Depression Screening',
        message: 'Patient reports sleep disturbances, low energy, and decreased interest in activities for >2 weeks.',
        suggestion: 'Administer PHQ-9 questionnaire and consider mental health referral if score ≥10.',
        confidenceScore: 0.82,
        sourceReasoning: 'Symptoms duration and constellation meet criteria for major depressive episode screening.',
        processingModel: 'gpt-o3',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
        updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        isRealTime: false,
        isPostConsultation: true,
        acknowledged: false,
        migratedFromPatientAlerts: false,
        category: AlertCategory.POST_CONSULTATION
      },
      // COMPLEX CASE ALERTS
      {
        id: 'mock-complex-lupus',
        patientId: patientId || 'demo-patient',
        encounterId: consultationId,
        alertType: AlertType.COMPLEX_CONDITION,
        severity: AlertSeverity.CRITICAL,
        status: AlertStatus.ACTIVE,
        title: 'Possible Systemic Lupus Erythematosus',
        message: 'Patient presents with classic lupus triad: photosensitive malar rash, polyarthritis, and constitutional symptoms. Combined with positive ANA and low complement levels, this strongly suggests SLE requiring urgent rheumatology evaluation.',
        suggestion: 'URGENT rheumatology referral (within 1-2 weeks). Order anti-dsDNA, anti-Sm antibodies, complete urinalysis with microscopy, and monitor for renal involvement.',
        confidenceScore: 0.88,
        sourceReasoning: 'Patient meets multiple SLE criteria (malar rash, oral ulcers, arthritis, positive ANA, low complement). Early diagnosis and treatment are crucial for preventing organ damage.',
        processingModel: 'gpt-o3',
        createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 minutes ago
        updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        isRealTime: false,
        isPostConsultation: true,
        acknowledged: false,
        migratedFromPatientAlerts: false,
        category: AlertCategory.POST_CONSULTATION
      },
      {
        id: 'mock-complex-oncology',
        patientId: patientId || 'demo-patient',
        encounterId: consultationId,
        alertType: AlertType.COMPLEX_CONDITION,
        severity: AlertSeverity.CRITICAL,
        status: AlertStatus.ACTIVE,
        title: 'Lung Cancer Red Flags',
        message: 'Concerning constellation: 30-pack-year smoking history, persistent cough with hemoptysis, 15-lb weight loss over 3 months, and new-onset dyspnea. Requires urgent imaging and oncology evaluation.',
        suggestion: 'URGENT chest CT with contrast. Order CBC, CMP, LDH. Oncology referral within 1 week. Consider bronchoscopy if mass identified.',
        confidenceScore: 0.92,
        sourceReasoning: 'Heavy smoking history with hemoptysis, weight loss, and respiratory symptoms form a high-risk constellation requiring immediate evaluation.',
        processingModel: 'gpt-o3',
        createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        isRealTime: false,
        isPostConsultation: true,
        acknowledged: false,
        migratedFromPatientAlerts: false,
        category: AlertCategory.POST_CONSULTATION
      },
      {
        id: 'mock-complex-hematologic',
        patientId: patientId || 'demo-patient',
        encounterId: consultationId,
        alertType: AlertType.COMPLEX_CONDITION,
        severity: AlertSeverity.WARNING,
        status: AlertStatus.ACTIVE,
        title: 'Hematologic Malignancy Concern',
        message: 'B-symptoms triad (fever, night sweats, weight loss) with lymphadenopathy and unexplained fatigue in young adult suggests possible lymphoma. Requires prompt hematologic evaluation.',
        suggestion: 'Order CBC with differential immediately. Get comprehensive metabolic panel, LDH, uric acid levels. CT chest/abdomen/pelvis. Hematology/oncology referral.',
        confidenceScore: 0.80,
        sourceReasoning: 'B-symptoms with lymphadenopathy in appropriate age group warrants urgent evaluation for lymphoproliferative disorders.',
        processingModel: 'gpt-o3',
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        isRealTime: false,
        isPostConsultation: true,
        acknowledged: false,
        migratedFromPatientAlerts: false,
        category: AlertCategory.POST_CONSULTATION
      }
    ];

    return alerts;
  }, [patientId, consultationId]);

  const loadAlerts = useCallback(async () => {
    // Prevent multiple simultaneous fetches
    if (hasFetchedRef.current && fetchFailedRef.current) {
      console.log('Fetch already failed, not retrying');
      return;
    }
    
    // Check max attempts
    if (fetchAttemptRef.current >= MAX_FETCH_ATTEMPTS) {
      console.log('Max fetch attempts reached, stopping');
      return;
    }
    
    fetchAttemptRef.current++;
    
    try {
      setIsLoading(true);
      
      let loadedAlerts: UnifiedAlert[] = [];
      
      if (consultationId) {
        // Use encounterId filter since the service uses that field name
        const result = await alertsService.getAlerts({ encounterId: consultationId });
        loadedAlerts = result.alerts;
      } else if (patientId) {
        const result = await alertsService.getAlerts({ patientId });
        loadedAlerts = result.alerts;
      } else {
        // Load all alerts for overview
        const result = await alertsService.getAlerts();
        loadedAlerts = result.alerts;
      }
      
      // Only show post-consultation alerts (active status)
      const postConsultationAlerts = loadedAlerts.filter(alert => 
        alert.status === 'active' && !alert.isRealTime
      );
      
      // Add mock alerts if no real alerts exist (in both development and production for demo purposes)
      if (postConsultationAlerts.length === 0) {
        console.log('No alerts found, using demo alerts to populate dashboard');
        postConsultationAlerts.push(...mockAlerts);
      }
      
      setAlerts(postConsultationAlerts);
      
      // Group by type
      const grouped = postConsultationAlerts.reduce((acc, alert) => {
        const type = alert.alertType;
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(alert);
        return acc;
      }, {} as AlertsByType);
      
      setAlertsByType(grouped);
      
      // Mark as successfully fetched
      hasFetchedRef.current = true;
      fetchFailedRef.current = false;
      
    } catch (error: any) {
      console.error('Error loading alerts:', error);
      
      // Check if this is a 404 or table doesn't exist error
      if (error?.code === '42P01' || error?.message?.includes('relation') || error?.message?.includes('does not exist')) {
        console.log('Alerts table does not exist, using mock data');
        fetchFailedRef.current = true;
        
        // Use mock alerts in both development and production for demo purposes
        console.log('Using demo alerts due to database error');
        setAlerts(mockAlerts);
        
        // Group mock alerts by type
        const grouped = mockAlerts.reduce((acc, alert) => {
          const type = alert.alertType;
          if (!acc[type]) {
            acc[type] = [];
          }
          acc[type].push(alert);
          return acc;
        }, {} as AlertsByType);
        
        setAlertsByType(grouped);
      }
    } finally {
      setIsLoading(false);
    }
  }, [patientId, consultationId, alertsService, mockAlerts]);



  // Load alerts only once on mount or when key props change
  useEffect(() => {
    // Reset fetch tracking when key props change
    fetchAttemptRef.current = 0;
    hasFetchedRef.current = false;
    fetchFailedRef.current = false;
    
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, consultationId]); // Remove loadAlerts from dependencies to prevent loops

  useEffect(() => {
    let filtered = [...alerts];

    // Apply type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(alert => alert.alertType === selectedType);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
        case 'severity':
          const severityOrder = { [AlertSeverity.CRITICAL]: 3, [AlertSeverity.WARNING]: 2, [AlertSeverity.INFO]: 1 };
          comparison = severityOrder[b.severity] - severityOrder[a.severity];
          break;
        default:
          return 0;
      }
      
      // Apply sort direction
      return sortDirection === 'desc' ? comparison : -comparison;
    });

    setFilteredAlerts(filtered);
  }, [alerts, selectedType, sortBy, sortDirection]);

  const handleSortChange = (newSortBy: 'date' | 'severity') => {
    if (sortBy === newSortBy) {
      // Toggle direction if same sort type
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // Change sort type and reset to descending
      setSortBy(newSortBy);
      setSortDirection('desc');
    }
  };

  const getSortLabel = (sortType: 'date' | 'severity') => {
    const direction = sortBy === sortType ? (sortDirection === 'desc' ? '↓' : '↑') : '';
    const label = sortType === 'date' ? 'Date' : 'Severity';
    return `${label} ${direction}`;
  };

  const getAlertTypeIcon = (type: AlertType) => {
    const config = alertTypeConfig[type];
    if (!config) return AlertTriangle;
    return config.icon;
  };

  const getAlertTypeLabel = (type: AlertType) => {
    const config = alertTypeConfig[type];
    return config?.label || type.replace(/_/g, ' ');
  };

  const getAlertTypeColor = (type: AlertType) => {
    const config = alertTypeConfig[type];
    return config?.color || 'bg-well text-ink border-border';
  };

  const totalAlerts = alerts.length;
  const uniqueTypes = Object.keys(alertsByType).length;

  return (
    <div className="space-y-6">
      {/* Statistics Cards with Integrated Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 bg-iris-soft text-iris ring-iris-line" aria-hidden>
                  <BarChart3 className="h-5 w-5" />
                </span>
                <div>
                  <p className="label-caps">Total Alerts</p>
                  <p className="font-display text-3xl [line-height:1.1] text-ink">{totalAlerts}</p>
                </div>
              </div>
              <div className="shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => handleSortChange(e.target.value as 'date' | 'severity')}
                  className="h-8 rounded-lg border border-hairline bg-card px-2.5 text-xs text-ink shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="date">{getSortLabel('date')}</option>
                  <option value="severity">{getSortLabel('severity')}</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 bg-ok-soft text-ok ring-ok-line" aria-hidden>
                  <Filter className="h-5 w-5" />
                </span>
                <div>
                  <p className="label-caps">Alert Types</p>
                  <p className="font-display text-3xl [line-height:1.1] text-ink">{uniqueTypes}</p>
                </div>
              </div>
              <div className="shrink-0">
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="h-8 rounded-lg border border-hairline bg-card px-2.5 text-xs text-ink shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All Types</option>
                  {Object.entries(alertTypeConfig).map(([type, config]) => (
                    <option key={type} value={type}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>



      {/* Alert Content */}
      <Tabs value={selectedType} onValueChange={setSelectedType} className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="all" className="text-xs">
            All ({totalAlerts})
          </TabsTrigger>
          {Object.entries(alertsByType).map(([type, typeAlerts]) => {
            const config = alertTypeConfig[type as AlertType];
            const IconComponent = config?.icon || AlertTriangle;
            
            return (
              <TabsTrigger key={type} value={type} className="text-xs flex items-center gap-1">
                <IconComponent className="h-3 w-3" />
                {config?.label || type} ({typeAlerts.length})
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {selectedType === 'all' && (
            <div className="space-y-6">
              {Object.entries(alertsByType).map(([type, typeAlerts]) => {
                const config = alertTypeConfig[type as AlertType];
                const IconComponent = config?.icon || AlertTriangle;
                
                return (
                  <Card key={type}>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <IconComponent className="h-5 w-5" />
                        {config?.label || type.replace(/_/g, ' ')}
                        <span className="ml-auto inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-well px-2 font-sans text-xs font-medium text-ink-2 ring-1 ring-hairline">
                          {typeAlerts.length}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <AlertList
                        alerts={typeAlerts}
                        onAccept={(alertId) => onAlertAction?.(alertId, 'accept')}
                        onDismiss={(alertId) => onAlertAction?.(alertId, 'dismiss')}
                        showFilters={false}
                        compact={false}
                      />
                    </CardContent>
                  </Card>
                );
              })}
              
              {Object.keys(alertsByType).length === 0 && !isLoading && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No alerts found</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {Object.entries(alertsByType).map(([type, typeAlerts]) => (
          <TabsContent key={type} value={type}>
            <AlertList
              alerts={typeAlerts}
              onAccept={(alertId) => onAlertAction?.(alertId, 'accept')}
              onDismiss={(alertId) => onAlertAction?.(alertId, 'dismiss')}
              showFilters={false}
              compact={false}
            />
          </TabsContent>
        ))}
      </Tabs>

      {isLoading && (
        <Card>
          <CardContent className="py-8 text-center">
            <RefreshCw className="h-8 w-8 text-muted-foreground mx-auto mb-3 animate-spin" />
            <p className="text-muted-foreground">Loading alerts...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AlertDashboard; 