'use client';
import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, CaretRight, ClipboardText, PaperPlaneTilt, Plus } from '@phosphor-icons/react';
import { supabaseDataService } from "@/lib/supabaseDataService";
import type { Patient, Encounter } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import NewConsultationModal from '../modals/NewConsultationModal';
import ContentSurface from '@/components/layout/ContentSurface';
import PatientAvatar from '@/components/ui/PatientAvatar';
import { EmptyState, ErrorState, LoadingState, SectionHeading } from '@/components/ui/states';
import { useModalManager } from '@/components/ui/modal-manager';
import FormCreationModal from '@/components/modals/FormCreationModal';
import { ageFrom, encounterReason, encounterWhen, formatDate, formatTime, patientName, sexLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

interface PatientsListViewProps {
  onSelect: (patient: Patient) => void;
}

type Row = { patient: Patient; encounters: Encounter[] };
type Entry = { patient: Patient; encounter: Encounter };
type SortKey = 'name' | 'gender' | 'born' | 'language' | 'encounters';

export default function PatientsListView({ onSelect }: PatientsListViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [upcoming, setUpcoming] = useState<Entry[]>([]);
  const [past, setPast] = useState<Entry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [tab, setTab] = useState<'allPatients' | 'allConsultations'>(searchParams?.get('view') === 'consultations' ? 'allConsultations' : 'allPatients');
  const [showNewConsultModal, setShowNewConsultModal] = useState(false);
  const [showPriorAuthModal, setShowPriorAuthModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);

  const { getModalState } = useModalManager();
  const pendingRestoredPatientsModal = getModalState('new-consultation-patients');
  useEffect(() => {
    if (pendingRestoredPatientsModal && !pendingRestoredPatientsModal.isMinimized && !pendingRestoredPatientsModal.isVisible) {
      setShowNewConsultModal(true);
    }
  }, [pendingRestoredPatientsModal]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setStatus('loading');
    setError(null);
    try {
      await supabaseDataService.loadPatientData();
      setRows(supabaseDataService.getAllPatients().map((patient) => ({
        patient,
        encounters: [...(supabaseDataService.getPatientEncounters(patient.id) || [])]
          .sort((a, b) => new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime()),
      })));
      setUpcoming(supabaseDataService.getUpcomingConsultations() as Entry[]);
      setPast(supabaseDataService.getPastConsultations() as Entry[]);
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

  const visible = useMemo(() => {
    if (!sort) return rows;
    const value = (r: Row): string | number => {
      switch (sort.key) {
        case 'name': return patientName(r.patient).toLowerCase();
        case 'gender': return (r.patient.gender ?? '').toLowerCase();
        case 'born': return r.patient.dateOfBirth ?? '';
        case 'language': return (r.patient.language ?? '').toLowerCase();
        default: return r.encounters.length;
      }
    };
    return [...rows].sort((a, b) => (value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : 0) * sort.dir);
  }, [rows, sort]);

  const sortBy = (key: SortKey) =>
    setSort((s) => (s?.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  const Head = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th scope="col" aria-sort={sort?.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={cn('px-4 pb-3 pt-4 text-left align-bottom', className)}>
      <button type="button" onClick={() => sortBy(k)} className="label-caps inline-flex items-center gap-1 rounded-sm hover:!text-ink">
        {children}
        {sort?.key === k ? (sort.dir === 1 ? <ArrowUp size={11} weight="bold" /> : <ArrowDown size={11} weight="bold" />) : null}
      </button>
    </th>
  );

  const openEncounter = (e: Entry) => router.push(`/patients/${e.patient.id}?tab=consultation&encounterId=${e.encounter.id}`);

  return (
    <ContentSurface>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <TabsList className="h-12 rounded-2xl p-1.5">
            <TabsTrigger value="allPatients" className="h-9 rounded-xl px-4 text-[0.9375rem]">All Patients</TabsTrigger>
            <TabsTrigger value="allConsultations" className="h-9 rounded-xl px-4 text-[0.9375rem]">All Consultations</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button iconLeft={<Plus weight="bold" />} onClick={() => setShowNewConsultModal(true)}>New Consultation</Button>
            <Button variant="secondary" size="icon" aria-label="Prior Authorization" title="Prior Authorization" onClick={() => setShowPriorAuthModal(true)}><ClipboardText /></Button>
            <Button variant="secondary" size="icon" aria-label="Referral" title="Referral" onClick={() => setShowReferralModal(true)}><PaperPlaneTilt /></Button>
          </div>
        </header>

        {status === 'loading' ? <LoadingState /> : null}
        {status === 'error' ? <ErrorState message={error} onRetry={() => load()} /> : null}

        {status === 'ready' ? (
          <>
            <TabsContent value="allPatients" className="mt-0">
              <section className="overflow-hidden rounded-[var(--radius-lg)] border border-hairline bg-card shadow-card" aria-label="All Patients">
                {visible.length === 0 ? (
                  <EmptyState title="No patients found." />
                ) : (
                  <>
                    <table className="hidden w-full border-collapse text-sm md:table">
                      <thead>
                        <tr className="border-b border-hairline">
                          <Head k="name" className="pl-6">Patient</Head>
                          <Head k="gender">Gender</Head>
                          <Head k="born">Date of Birth</Head>
                          <Head k="language">Language</Head>
                          <Head k="encounters">Consultations</Head>
                          <th className="w-10" aria-hidden />
                        </tr>
                      </thead>
                      <tbody className="rise-in-stagger">
                        {visible.map(({ patient, encounters }) => {
                          const age = ageFrom(patient.dateOfBirth);
                          const flagged = (patient.alerts?.length ?? 0) > 0;
                          return (
                            <tr key={patient.id} className="group cursor-pointer border-b border-hairline/70 transition-colors last:border-0 hover:bg-well" onClick={() => onSelect(patient)}>
                              <td className="py-3 pl-6 pr-4">
                                <Link href={`/patients/${patient.id}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-3.5 rounded-md">
                                  <span className="relative">
                                    <PatientAvatar patient={patient} size={36} />
                                    {flagged ? <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-flag-line ring-2 ring-card" aria-label="Flagged" /> : null}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate font-display text-[1.1rem] leading-tight text-ink">{patientName(patient)}</span>
                                    <span className="data-mono block max-w-[15rem] truncate text-[0.7rem] text-muted-foreground" title={patient.id}>{patient.id}</span>
                                  </span>
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-ink-2">{sexLabel(patient.gender)}</td>
                              <td className="px-4 py-3">
                                <span className="data-mono text-ink">{formatDate(patient.dateOfBirth)}</span>
                                {age !== null ? <span className="ml-2 text-xs text-muted-foreground">{age}</span> : null}
                              </td>
                              <td className="px-4 py-3 text-ink-2">{patient.language || '—'}</td>
                              <td className="px-4 py-3">
                                <span className="flex flex-wrap items-center gap-1.5">
                                  {encounters.slice(0, 2).map((e) => (
                                    <button
                                      key={e.id}
                                      type="button"
                                      onClick={(ev) => { ev.stopPropagation(); openEncounter({ patient, encounter: e }); }}
                                      className="data-mono rounded-md bg-well px-2 py-0.5 text-xs text-ink-2 ring-1 ring-hairline transition-colors hover:bg-iris-soft hover:text-iris hover:ring-iris-line"
                                      title={encounterReason(e)}
                                    >
                                      {formatDate(e.scheduledStart)}
                                    </button>
                                  ))}
                                  {encounters.length > 2 ? <span className="data-mono text-xs text-muted-foreground">+{encounters.length - 2}</span> : null}
                                </span>
                              </td>
                              <td className="pr-5 text-muted-foreground"><CaretRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    <ul className="rise-in-stagger divide-y divide-hairline md:hidden">
                      {visible.map(({ patient, encounters }) => {
                        const flagged = (patient.alerts?.length ?? 0) > 0;
                        return (
                          <li key={patient.id}>
                            <Link href={`/patients/${patient.id}`} className="flex items-center gap-3.5 px-4 py-3.5 active:bg-well">
                              <span className="relative">
                                <PatientAvatar patient={patient} size={40} />
                                {flagged ? <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-flag-line ring-2 ring-card" aria-label="Flagged" /> : null}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-display text-[1.15rem] leading-tight text-ink">{patientName(patient)}</span>
                                <span className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
                                  {sexLabel(patient.gender)}
                                  <span className="h-1 w-1 rounded-full bg-input/50" aria-hidden />
                                  <span className="data-mono text-xs">{formatDate(patient.dateOfBirth)}</span>
                                </span>
                              </span>
                              <span className="data-mono inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-well px-2 text-xs text-ink-2 ring-1 ring-hairline">{encounters.length}</span>
                              <CaretRight size={14} className="text-muted-foreground" aria-hidden />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </section>
            </TabsContent>

            <TabsContent value="allConsultations" className="mt-0 space-y-6">
              <ConsultationList title="Upcoming Consultations" entries={upcoming} onOpen={openEncounter} />
              <ConsultationList title="Past Consultations" entries={past} onOpen={openEncounter} />
            </TabsContent>
          </>
        ) : null}
      </Tabs>

      <NewConsultationModal
        open={showNewConsultModal}
        onOpenChange={setShowNewConsultModal}
        onConsultationCreated={(patient, encounter) => {
          if (patient && encounter) onSelect(patient);
          else load(true);
        }}
        draggable={false}
        allowDragging={false}
        draggableConfig={{ id: 'new-consultation-patients', title: 'Start New Consultation', persistent: false }}
      />
      <FormCreationModal open={showPriorAuthModal} onOpenChange={setShowPriorAuthModal} formType="priorAuth" />
      <FormCreationModal open={showReferralModal} onOpenChange={setShowReferralModal} formType="referral" />
    </ContentSurface>
  );
}

function ConsultationList({ title, entries, onOpen }: { title: string; entries: Entry[]; onOpen: (e: Entry) => void }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-hairline bg-card shadow-card">
      <SectionHeading as="h3" className="px-5 pb-2 pt-5" count={entries.length}>{title}</SectionHeading>
      {entries.length === 0 ? (
        <EmptyState className="py-10" title={`No ${title.toLowerCase()} scheduled.`} />
      ) : (
        <ul className="rise-in-stagger px-2 pb-2">
          {entries.map((entry) => {
            const when = encounterWhen(entry.encounter);
            return (
              <li key={`${entry.patient.id}_${entry.encounter.id}`}>
                <button
                  type="button"
                  onClick={() => onOpen(entry)}
                  className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 rounded-xl px-3 py-3 text-left transition-colors hover:bg-well sm:grid-cols-[6.5rem_auto_minmax(0,1fr)_auto]"
                >
                  <span className="data-mono hidden text-sm leading-tight text-ink sm:block">
                    {formatDate(when)}
                    <span className="block text-xs text-muted-foreground">{formatTime(when)}</span>
                  </span>
                  <PatientAvatar patient={entry.patient} size={34} />
                  <span className="min-w-0">
                    <span className="block truncate text-[0.9375rem] font-medium text-ink">{encounterReason(entry.encounter)}</span>
                    <span className="mt-0.5 flex items-center gap-2 truncate text-sm text-muted-foreground">
                      <span className="truncate">{patientName(entry.patient)}</span>
                      <span className="data-mono shrink-0 text-xs sm:hidden">{formatDate(when)}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    {entry.encounter.reasonCode ? (
                      <span className="data-mono hidden rounded-md bg-well px-2 py-0.5 text-xs text-ink-2 ring-1 ring-hairline md:inline">{entry.encounter.reasonCode}</span>
                    ) : null}
                    <CaretRight size={14} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
