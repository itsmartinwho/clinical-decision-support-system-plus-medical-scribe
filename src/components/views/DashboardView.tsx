'use client';
import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { Stethoscope, ClipboardText, PaperPlaneTilt, Eye, Play, CaretRight, ArrowRight } from '@phosphor-icons/react';
import { Button } from "@/components/ui/button";
import { supabaseDataService } from "@/lib/supabaseDataService";
import type { Patient, Encounter, ComplexCaseAlert } from "@/lib/types";
import NewConsultationModal from '../modals/NewConsultationModal';
import ContentSurface from '@/components/layout/ContentSurface';
import PageHeader from '@/components/layout/PageHeader';
import PatientAvatar from '@/components/ui/PatientAvatar';
import NotificationBell from '@/components/ui/NotificationBell';
import AlertSidePanel from '@/components/ui/AlertSidePanel';
import { EmptyState, ErrorState, LoadingState, SectionHeading } from '@/components/ui/states';
import MarkLoader from '@/components/brand/MarkLoader';
import { useDemo } from "@/contexts/DemoContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useModalManager } from "@/components/ui/modal-manager";
import FormCreationModal from '@/components/modals/FormCreationModal';
import PatientDataModal from '@/components/modals/PatientDataModal';
import { encounterReason, encounterWhen, formatDate, formatTime, patientName, severityTone } from '@/lib/format';
import { PRODUCT_NAME } from '@/lib/brand';

type Entry = { patient: Patient; encounter: Encounter };

interface DashboardViewProps {
  onAlertClick: (patientId: string) => void;
  allAlerts: Array<ComplexCaseAlert & { patientName?: string }>;
}

export default function DashboardView({ onAlertClick, allAlerts }: DashboardViewProps) {
  const router = useRouter();
  const [upcoming, setUpcoming] = useState<Entry[]>([]);
  const [past, setPast] = useState<Entry[]>([]);
  const [pastCount, setPastCount] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isAlertPanelOpen, setIsAlertPanelOpen] = useState(false);
  const [showNewConsultModal, setShowNewConsultModal] = useState(false);
  const [showPriorAuthModal, setShowPriorAuthModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [selectedPatientForData, setSelectedPatientForData] = useState<Patient | null>(null);

  const { isDemoModalOpen, demoStage, startDemo, skipDemo, setDemoModalOpen } = useDemo();
  const startButtonRef = React.useRef<HTMLButtonElement>(null);

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
      const pastAll = supabaseDataService.getPastConsultations() as Entry[];
      setUpcoming(supabaseDataService.getUpcomingConsultations() as Entry[]);
      setPast(pastAll.slice(0, 6));
      setPastCount(pastAll.length);
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

  const critical = useMemo(() => allAlerts.some((a) => severityTone(a.severity, a.likelihood) === 'critical'), [allAlerts]);

  return (
    <ContentSurface>
      <PageHeader
        title="Upcoming Consultations"
        aside={<NotificationBell count={allAlerts.length} critical={critical} onClick={() => setIsAlertPanelOpen(true)} />}
      />

      {status === 'loading' ? <LoadingState /> : null}
      {status === 'error' ? <ErrorState message={error} onRetry={() => load()} /> : null}

      {status === 'ready' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-8">
          <div className="min-w-0 space-y-6">
            <section className="rounded-[var(--radius-lg)] border border-hairline bg-card shadow-card" aria-label="Upcoming Consultations">
              {upcoming.length === 0 ? (
                <EmptyState title="No upcoming consultations scheduled." />
              ) : (
                <ul className="rise-in-stagger divide-y divide-hairline">
                  {upcoming.map(({ patient, encounter }) => (
                    <li key={`${patient.id}_${encounter.id}`} className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
                      <div className="w-16 shrink-0">
                        <div className="data-mono text-lg leading-none text-ink">{formatTime(encounter.scheduledStart)}</div>
                        <div className="data-mono mt-1 text-xs text-muted-foreground">{formatDate(encounter.scheduledStart)}</div>
                      </div>
                      <Link href={`/patients/${patient.id}?tab=consultation&encounterId=${encounter.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        <PatientAvatar patient={patient} size={38} />
                        <span className="min-w-0">
                          <span className="block truncate font-display text-[1.15rem] leading-tight text-ink">{patientName(patient)}</span>
                          <span className="block truncate text-sm text-muted-foreground">{encounterReason(encounter)}</span>
                        </span>
                      </Link>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" iconLeft={<Eye />} onClick={() => setSelectedPatientForData(patient)}>Prepare</Button>
                        <Button size="sm" iconLeft={<Play weight="fill" />} onClick={() => router.push(`/patients/${patient.id}?tab=consultation&encounterId=${encounter.id}&autoStartTranscription=true`)}>Start</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {past.length > 0 ? (
              <section className="rounded-[var(--radius-lg)] border border-hairline bg-card shadow-card">
                <SectionHeading className="px-5 pb-2 pt-5" count={pastCount}>Past Consultations</SectionHeading>
                <ul className="rise-in-stagger px-2 pb-2">
                  {past.map(({ patient, encounter }) => (
                    <li key={`${patient.id}_${encounter.id}`}>
                      <Link
                        href={`/patients/${patient.id}?tab=consultation&encounterId=${encounter.id}`}
                        className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 rounded-xl px-3 py-3 transition-colors hover:bg-well"
                      >
                        <PatientAvatar patient={patient} size={34} />
                        <span className="min-w-0">
                          <span className="block truncate text-[0.9375rem] font-medium text-ink">{encounterReason(encounter)}</span>
                          <span className="mt-0.5 flex items-center gap-2 truncate text-sm text-muted-foreground">
                            <span className="truncate">{patientName(patient)}</span>
                            <span className="h-1 w-1 shrink-0 rounded-full bg-input/50" aria-hidden />
                            <span className="data-mono shrink-0 text-xs">{formatDate(encounterWhen(encounter))}</span>
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          {encounter.reasonCode ? (
                            <span className="data-mono hidden rounded-md bg-well px-2 py-0.5 text-xs text-ink-2 ring-1 ring-hairline sm:inline">{encounter.reasonCode}</span>
                          ) : null}
                          <CaretRight size={14} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="rise-in-stagger order-first grid grid-cols-2 gap-3 self-start lg:order-none lg:grid-cols-1">
            <button
              type="button"
              onClick={() => setShowNewConsultModal(true)}
              className="group relative isolate col-span-2 flex min-h-[8.5rem] flex-col justify-between overflow-hidden rounded-[var(--radius-lg)] bg-iris p-5 text-left text-white shadow-[0_14px_32px_-14px_hsl(var(--blue)/0.7)] transition-transform hover:-translate-y-0.5 lg:col-span-1 lg:min-h-[11rem]"
            >
              <MeterMotif />
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <Stethoscope size={21} weight="bold" aria-hidden />
              </span>
              <span className="flex items-end justify-between gap-3">
                <span className="font-display text-[1.45rem] leading-tight">New Consultation</span>
                <ArrowRight size={18} className="mb-1 transition-transform group-hover:translate-x-1" aria-hidden />
              </span>
            </button>
            <ActionTile icon={<ClipboardText size={20} aria-hidden />} label="Prior Authorization" onClick={() => setShowPriorAuthModal(true)} />
            <ActionTile icon={<PaperPlaneTilt size={20} aria-hidden />} label="Referral" onClick={() => setShowReferralModal(true)} />
          </aside>
        </div>
      ) : null}

      <AlertSidePanel isOpen={isAlertPanelOpen} onClose={() => setIsAlertPanelOpen(false)} alerts={allAlerts} onAlertClick={onAlertClick} />
      <NewConsultationModal
        open={showNewConsultModal}
        onOpenChange={setShowNewConsultModal}
        draggable={false}
        allowDragging={false}
        draggableConfig={{ id: 'new-consultation-dashboard', title: 'Start New Consultation', persistent: false }}
      />
      <FormCreationModal open={showPriorAuthModal} onOpenChange={setShowPriorAuthModal} formType="priorAuth" />
      <FormCreationModal open={showReferralModal} onOpenChange={setShowReferralModal} formType="referral" />
      <PatientDataModal isOpen={!!selectedPatientForData} onClose={() => setSelectedPatientForData(null)} patient={selectedPatientForData} />

      {demoStage === 'introModal' && isDemoModalOpen ? (
        <Dialog open={isDemoModalOpen} onOpenChange={setDemoModalOpen}>
          <DialogContent
            className="intro-dialog max-w-[34rem] gap-0 overflow-hidden p-0 sm:min-w-0 sm:p-0"
            onOpenAutoFocus={(e) => { e.preventDefault(); startButtonRef.current?.focus(); }}
          >
            <div className="relative isolate flex h-56 items-center justify-center overflow-hidden bg-rail">
              <WaveField />
              <span className="relative inline-flex h-20 w-20 items-center justify-center rounded-[1.4rem] bg-white/[0.08] ring-1 ring-white/15">
                <MarkLoader size={44} className="text-white" />
              </span>
            </div>
            <div className="px-7 pb-7 pt-6">
              <DialogHeader>
                <DialogTitle className="text-center text-[1.9rem] leading-[1.15]">See {PRODUCT_NAME} in Action</DialogTitle>
              </DialogHeader>
              <DialogFooter className="mt-7 flex-col-reverse gap-2 sm:flex-row sm:justify-center">
                <Button variant="secondary" size="lg" onClick={skipDemo} className="sm:min-w-[8rem]">Skip</Button>
                <Button ref={startButtonRef} size="lg" onClick={startDemo} iconLeft={<Play weight="fill" />} className="sm:min-w-[10rem]">Start Demo</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </ContentSurface>
  );
}

function ActionTile({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-hairline bg-card p-4 text-left shadow-card transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-float lg:flex-row lg:items-center lg:gap-4"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-iris-soft text-iris ring-1 ring-iris-line">{icon}</span>
      <span className="min-w-0 flex-1 text-[0.9375rem] font-medium leading-snug text-ink">{label}</span>
      <ArrowRight size={16} className="hidden text-muted-foreground transition-transform group-hover:translate-x-1 lg:block" aria-hidden />
    </button>
  );
}

/** The mark's level meter, large and faint, behind the New Consultation tile. */
function MeterMotif() {
  const bars = [0.35, 0.6, 0.9, 0.55, 1, 0.7, 0.4, 0.8, 0.5, 0.3];
  return (
    <svg className="pointer-events-none absolute -right-6 bottom-0 -z-10 h-full w-48 opacity-[0.16]" viewBox="0 0 200 160" preserveAspectRatio="xMaxYMax meet" aria-hidden>
      {bars.map((h, i) => (
        <rect key={i} x={i * 20 + 4} y={160 - h * 150} width={11} height={h * 150} rx={5.5} fill="white" />
      ))}
    </svg>
  );
}

/** Behind the intro's mark: a field of bars rising and falling, like voices in a room. */
function WaveField() {
  const n = 34;
  return (
    <div className="absolute inset-0 -z-10 flex items-center justify-center gap-[7px]" aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const d = Math.abs(i - (n - 1) / 2) / ((n - 1) / 2);
        const h = 18 + (1 - d) * 120 * (0.55 + 0.45 * Math.sin(i * 1.7));
        return (
          <span
            key={i}
            className="wave-bar w-[5px] rounded-full bg-gradient-to-b from-[hsl(245_90%_78%)] to-[hsl(245_66%_55%)]"
            style={{ height: `${Math.max(10, h)}px`, animationDelay: `${(i % 9) * -0.17}s`, opacity: 0.18 + (1 - d) * 0.5 }}
          />
        );
      })}
    </div>
  );
}
