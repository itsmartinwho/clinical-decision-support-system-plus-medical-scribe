'use client';
import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { Plus, Eye, Play, CaretRight } from '@phosphor-icons/react';
import { Button } from "@/components/ui/button";
import { supabaseDataService } from "@/lib/supabaseDataService";
import type { Patient, Encounter, ComplexCaseAlert } from "@/lib/types";
import NewConsultationModal from '../modals/NewConsultationModal';
import ContentSurface from '@/components/layout/ContentSurface';
import PageHeader from '@/components/layout/PageHeader';
import PatientAvatar from '@/components/ui/PatientAvatar';
import { EmptyState, ErrorState, LoadingState, SectionHeading } from '@/components/ui/states';
import MarkLoader from '@/components/brand/MarkLoader';
import { useDemo } from "@/contexts/DemoContext";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useModalManager } from "@/components/ui/modal-manager";
import FormCreationModal from '@/components/modals/FormCreationModal';
import PatientDataModal from '@/components/modals/PatientDataModal';
import { encounterReason, encounterWhen, formatDate, formatTime, patientName, severityTone } from '@/lib/format';
import { PRODUCT_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

type Entry = { patient: Patient; encounter: Encounter };

interface DashboardViewProps {
  onAlertClick: (patientId: string) => void;
  allAlerts: Array<ComplexCaseAlert & { patientName?: string }>;
}

const TONE_RULE = { critical: 'before:bg-critical', flag: 'before:bg-flag', info: 'before:bg-info' } as const;
const TONE_TEXT = { critical: 'text-critical', flag: 'text-flag', info: 'text-info' } as const;

export default function DashboardView({ onAlertClick, allAlerts }: DashboardViewProps) {
  const router = useRouter();
  const [upcoming, setUpcoming] = useState<Entry[]>([]);
  const [recent, setRecent] = useState<Entry[]>([]);
  const [counts, setCounts] = useState({ patients: 0, encounters: 0 });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [showNewConsultModal, setShowNewConsultModal] = useState(false);
  const [showPriorAuthModal, setShowPriorAuthModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [selectedPatientForData, setSelectedPatientForData] = useState<Patient | null>(null);

  const { isDemoModalOpen, demoStage, startDemo, skipDemo, setDemoModalOpen } = useDemo();

  // Reopen the New Consultation modal when it was restored from another page.
  const { getModalState } = useModalManager();
  const pendingRestoredDashboardModal = getModalState('new-consultation-dashboard');
  useEffect(() => {
    if (pendingRestoredDashboardModal && !pendingRestoredDashboardModal.isMinimized && !pendingRestoredDashboardModal.isVisible) {
      setShowNewConsultModal(true);
    }
  }, [pendingRestoredDashboardModal]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setStatus('loading');
    setError(null);
    try {
      await supabaseDataService.loadPatientData();
      const patients = supabaseDataService.getAllPatients();
      const past = supabaseDataService.getPastConsultations() as Entry[];
      const next = supabaseDataService.getUpcomingConsultations() as Entry[];
      setUpcoming(next);
      setRecent(past.slice(0, 5));
      setCounts({ patients: patients.length, encounters: past.length + next.length });
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
    const refresh = () => { load(true); };
    supabaseDataService.subscribe(refresh);
    return () => supabaseDataService.unsubscribe(refresh);
  }, [load]);

  const flags = useMemo(
    () => [...allAlerts].sort((a, b) => (b.likelihood ?? 0) - (a.likelihood ?? 0)),
    [allAlerts],
  );

  const today = useMemo(
    () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    [],
  );

  return (
    <ContentSurface>
      <PageHeader
        eyebrow={today}
        title="Today"
        aside={
          <>
            <Button iconLeft={<Plus />} onClick={() => setShowNewConsultModal(true)}>New consultation</Button>
            <Button variant="secondary" onClick={() => setShowPriorAuthModal(true)}>Prior authorization</Button>
            <Button variant="secondary" onClick={() => setShowReferralModal(true)}>Referral</Button>
          </>
        }
      />

      {status === 'loading' ? <LoadingState label="Loading the schedule" /> : null}
      {status === 'error' ? (
        <ErrorState title="The schedule did not load" message={error} onRetry={() => load()} />
      ) : null}

      {status === 'ready' ? (
        <>
          <dl className="mb-8 grid grid-cols-2 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card sm:grid-cols-4">
            <Stat label="Patients" value={counts.patients} />
            <Stat label="Encounters" value={counts.encounters} />
            <Stat label="Upcoming" value={upcoming.length} />
            <Stat label="Flags" value={flags.length} tone={flags.length ? 'flag' : undefined} />
          </dl>

          <div className="grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="min-w-0 space-y-10">
              <section aria-labelledby="upcoming-heading">
                <SectionHeading id="upcoming-heading" count={upcoming.length}>Upcoming consultations</SectionHeading>
                {upcoming.length === 0 ? (
                  <EmptyState
                    className="border-t-0"
                    title="Nothing scheduled"
                    message="No consultations are booked from now on. Start one now, or open a recent consultation below."
                    action={<Button size="sm" variant="secondary" iconLeft={<Plus />} onClick={() => setShowNewConsultModal(true)}>New consultation</Button>}
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {upcoming.map(({ patient, encounter }) => (
                      <li key={`${patient.id}_${encounter.id}`} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]">
                        <div className="data-mono text-sm text-ink">
                          {formatTime(encounter.scheduledStart)}
                          <div className="text-xs text-muted-foreground">{formatDate(encounter.scheduledStart)}</div>
                        </div>
                        <Link href={`/patients/${patient.id}?tab=consultation&encounterId=${encounter.id}`} className="min-w-0 rounded-sm">
                          <span className="block truncate font-display text-lg leading-tight text-ink">{patientName(patient)}</span>
                          <span className="block truncate text-sm text-muted-foreground">{encounterReason(encounter)}</span>
                        </Link>
                        <div className="col-span-2 flex gap-2 sm:col-span-1">
                          <Button size="sm" variant="secondary" iconLeft={<Eye />} onClick={() => setSelectedPatientForData(patient)}>Prepare</Button>
                          <Button size="sm" iconLeft={<Play />} onClick={() => router.push(`/patients/${patient.id}?tab=consultation&encounterId=${encounter.id}&autoStartTranscription=true`)}>Start</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="recent-heading">
                <SectionHeading
                  id="recent-heading"
                  count={recent.length}
                  action={<Link href="/patients?view=consultations" className="text-sm text-info underline-offset-4 hover:underline">All consultations</Link>}
                >
                  Recent consultations
                </SectionHeading>
                {recent.length === 0 ? (
                  <EmptyState className="border-t-0" title="No consultations yet" message="Finished consultations will be listed here." />
                ) : (
                  <ul className="divide-y divide-border">
                    {recent.map(({ patient, encounter }) => (
                      <li key={`${patient.id}_${encounter.id}`}>
                        <Link
                          href={`/patients/${patient.id}?tab=consultation&encounterId=${encounter.id}`}
                          className="row-link grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-1 py-3 sm:grid-cols-[7rem_minmax(0,1fr)_auto]"
                        >
                          <span className="data-mono hidden text-sm text-muted-foreground sm:block">{formatDate(encounterWhen(encounter))}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink">{encounterReason(encounter)}</span>
                            <span className="block truncate text-sm text-muted-foreground">
                              {patientName(patient)}
                              <span className="data-mono sm:hidden"> · {formatDate(encounterWhen(encounter))}</span>
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            {encounter.reasonCode ? (
                              <span className="data-mono hidden rounded border border-border px-1.5 text-xs text-ink-2 sm:inline">{encounter.reasonCode}</span>
                            ) : null}
                            <CaretRight size={14} className="text-muted-foreground" aria-hidden />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <aside aria-labelledby="flags-heading" className="min-w-0">
              <SectionHeading id="flags-heading" count={flags.length}>Flags</SectionHeading>
              {flags.length === 0 ? (
                <EmptyState className="border-t-0" title="Nothing flagged" message="Complex-case flags on any chart appear here." />
              ) : (
                <ul className="mt-3 space-y-2">
                  {flags.map((alert) => {
                    const tone = severityTone(alert.severity, alert.likelihood);
                    return (
                      <li key={alert.id}>
                        <button
                          type="button"
                          onClick={() => onAlertClick(alert.patientId)}
                          className={cn(
                            'relative w-full overflow-hidden rounded-md border border-border bg-card py-3 pl-4 pr-3 text-left transition-colors hover:bg-well/50',
                            "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
                            TONE_RULE[tone],
                          )}
                        >
                          <span className={cn('label-caps', TONE_TEXT[tone])}>
                            {alert.conditionType || alert.type || 'Complex case'}{alert.severity ? ` · ${alert.severity}` : ''}
                          </span>
                          <span className="mt-1 block text-sm text-ink">{alert.msg}</span>
                          <span className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <PatientAvatar patient={{ name: alert.patientName }} size={18} />
                            {alert.patientName}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>
          </div>
        </>
      ) : null}

      <NewConsultationModal
        open={showNewConsultModal}
        onOpenChange={setShowNewConsultModal}
        draggable={false}
        allowDragging={false}
        draggableConfig={{ id: 'new-consultation-dashboard', title: 'Start a consultation', persistent: false }}
      />
      <FormCreationModal open={showPriorAuthModal} onOpenChange={setShowPriorAuthModal} formType="priorAuth" />
      <FormCreationModal open={showReferralModal} onOpenChange={setShowReferralModal} formType="referral" />
      <PatientDataModal
        isOpen={!!selectedPatientForData}
        onClose={() => setSelectedPatientForData(null)}
        patient={selectedPatientForData}
      />

      {demoStage === 'introModal' && isDemoModalOpen ? (
        <Dialog open={isDemoModalOpen} onOpenChange={setDemoModalOpen}>
          <DialogContent className="max-w-[40rem] gap-0 p-0 sm:min-w-0">
            <div className="flex items-center gap-4 border-b border-border px-6 py-5 sm:px-8">
              <MarkLoader size={40} className="text-ink" />
              <p className="label-caps">Guided demo · about two minutes</p>
            </div>
            <div className="px-6 py-6 sm:px-8">
              <DialogHeader className="space-y-3">
                <DialogTitle className="text-[1.875rem] sm:text-[2.125rem]">See a consultation turn into a note</DialogTitle>
                <DialogDescription className="text-[0.9375rem] leading-relaxed text-ink-2">
                  {PRODUCT_NAME} listens to a visit with Dorothy Robinson, a synthetic patient, writes the transcript as
                  the two of them speak, then drafts the differential, the diagnosis, the plan and the note.
                </DialogDescription>
              </DialogHeader>
              <ol className="mt-6 grid gap-x-6 gap-y-3 border-t border-border pt-5 sm:grid-cols-2">
                {[
                  ['Transcript', 'Clinician and patient, turn by turn'],
                  ['Differential', 'Ranked by likelihood, with the evidence'],
                  ['Plan and note', 'Diagnosis, treatment and a SOAP note'],
                  ['Flags', 'Interactions and gaps, as they come up'],
                ].map(([title, line], i) => (
                  <li key={title} className="flex gap-3">
                    <span className="data-mono pt-px text-xs text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                    <span>
                      <span className="block text-sm font-medium text-ink">{title}</span>
                      <span className="block text-sm text-muted-foreground">{line}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <DialogFooter className="border-t border-border px-6 py-4 sm:px-8">
              <Button variant="ghost" onClick={skipDemo}>Skip</Button>
              <Button onClick={startDemo} iconLeft={<Play />}>Start the demo</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </ContentSurface>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'flag' }) {
  return (
    <div className="relative border-b border-r border-border px-4 py-3 last:border-r-0 sm:border-b-0 [&:nth-child(2)]:border-r-0 sm:[&:nth-child(2)]:border-r">
      <span className={cn('absolute inset-x-0 top-0 h-[2px]', tone === 'flag' ? 'bg-flag-line' : 'bg-transparent')} aria-hidden />
      <dt className="label-caps">{label}</dt>
      <dd className={cn('mt-1 font-display text-[2rem] leading-none', tone === 'flag' ? 'text-flag' : 'text-ink')}>{value}</dd>
    </div>
  );
}
