'use client';
import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, CaretRight, MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { supabaseDataService } from "@/lib/supabaseDataService";
import type { Patient, Encounter } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import NewConsultationModal from '../modals/NewConsultationModal';
import ContentSurface from '@/components/layout/ContentSurface';
import PageHeader from '@/components/layout/PageHeader';
import PatientAvatar from '@/components/ui/PatientAvatar';
import { EmptyState, ErrorState, LoadingState, SectionHeading } from '@/components/ui/states';
import { useModalManager } from '@/components/ui/modal-manager';
import FormCreationModal from '@/components/modals/FormCreationModal';
import { ageFrom, encounterReason, encounterWhen, formatDate, formatTime, patientName, sexLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

interface PatientsListViewProps {
  onSelect: (patient: Patient) => void;
}

type Row = { patient: Patient; encounters: Encounter[]; lastSeen?: string };
type Entry = { patient: Patient; encounter: Encounter };
type SortKey = 'name' | 'born' | 'lastSeen' | 'encounters';

export default function PatientsListView({ onSelect }: PatientsListViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [upcoming, setUpcoming] = useState<Entry[]>([]);
  const [past, setPast] = useState<Entry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'lastSeen', dir: -1 });
  const [tab, setTab] = useState<'patients' | 'consultations'>(searchParams?.get('view') === 'consultations' ? 'consultations' : 'patients');
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
      setRows(supabaseDataService.getAllPatients().map((patient) => {
        const encounters = supabaseDataService.getPatientEncounters(patient.id) || [];
        const lastSeen = encounters
          .map(encounterWhen)
          .filter((d): d is string => !!d && new Date(d).getTime() <= Date.now())
          .sort()
          .pop();
        return { patient, encounters, lastSeen };
      }));
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
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(({ patient }) => `${patientName(patient)} ${patient.id}`.toLowerCase().includes(q))
      : rows;
    const value = (r: Row): string | number => {
      switch (sort.key) {
        case 'name': return patientName(r.patient).toLowerCase();
        case 'born': return r.patient.dateOfBirth ?? '';
        case 'encounters': return r.encounters.length;
        default: return r.lastSeen ?? '';
      }
    };
    return [...filtered].sort((a, b) => (value(a) < value(b) ? -1 : value(a) > value(b) ? 1 : 0) * sort.dir);
  }, [rows, query, sort]);

  const sortBy = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'name' ? 1 : -1 }));

  const SortHead = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th scope="col" aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={cn('h-9 px-3 pb-2 text-left align-bottom', className)}>
      <button type="button" onClick={() => sortBy(k)} className="label-caps inline-flex items-center gap-1 rounded-sm hover:!text-ink">
        {children}
        {sort.key === k ? (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : null}
      </button>
    </th>
  );

  const open = (p: Patient) => onSelect(p);

  return (
    <ContentSurface>
      <PageHeader
        eyebrow="Records"
        title="Patients"
        meta={status === 'ready' ? `${rows.length} ${rows.length === 1 ? 'patient' : 'patients'} · ${past.length + upcoming.length} consultations` : undefined}
        aside={
          <>
            <Button iconLeft={<Plus />} onClick={() => setShowNewConsultModal(true)}>New consultation</Button>
            <Button variant="secondary" onClick={() => setShowPriorAuthModal(true)}>Prior authorization</Button>
            <Button variant="secondary" onClick={() => setShowReferralModal(true)}>Referral</Button>
          </>
        }
      />

      {status === 'loading' ? <LoadingState label="Loading patients" /> : null}
      {status === 'error' ? <ErrorState title="The patient list did not load" message={error} onRetry={() => load()} /> : null}

      {status === 'ready' ? (
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border">
            <TabsList className="border-b-0">
              <TabsTrigger value="patients">Patients</TabsTrigger>
              <TabsTrigger value="consultations">Consultations</TabsTrigger>
            </TabsList>
            {tab === 'patients' ? (
              <label className="relative mb-2 w-full sm:w-72">
                <span className="sr-only">Filter patients</span>
                <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by name or ID" className="h-8 pl-8" />
              </label>
            ) : null}
          </div>

          <TabsContent value="patients" className="mt-0">
            {visible.length === 0 ? (
              <EmptyState
                className="border-t-0"
                title={rows.length === 0 ? 'No patients yet' : 'No patient matches'}
                message={rows.length === 0 ? 'Patients appear here once a consultation is started.' : `Nothing matches “${query}”.`}
              />
            ) : (
              <>
                {/* Wide screens: a table. */}
                <table className="hidden w-full border-collapse text-sm md:table">
                  <thead>
                    <tr className="border-b border-ink/50">
                      <SortHead k="name">Patient</SortHead>
                      <th scope="col" className="label-caps h-9 px-3 pb-2 text-left align-bottom">Sex</th>
                      <SortHead k="born">Born</SortHead>
                      <th scope="col" className="label-caps h-9 px-3 pb-2 text-left align-bottom">Language</th>
                      <SortHead k="encounters" className="text-right">Encounters</SortHead>
                      <SortHead k="lastSeen">Last seen</SortHead>
                      <th scope="col" className="label-caps h-9 px-3 pb-2 text-left align-bottom">Flags</th>
                      <th className="w-8" aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(({ patient, encounters, lastSeen }) => {
                      const age = ageFrom(patient.dateOfBirth);
                      const flags = patient.alerts?.length ?? 0;
                      return (
                        <tr
                          key={patient.id}
                          className="row-link border-b border-border"
                          onClick={() => open(patient)}
                        >
                          <td className="px-3 py-2.5">
                            <Link
                              href={`/patients/${patient.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-3 rounded-sm"
                            >
                              <PatientAvatar patient={patient} size={30} />
                              <span className="min-w-0">
                                <span className="block truncate font-display text-[1.0625rem] leading-tight text-ink">{patientName(patient)}</span>
                                <span className="data-mono block max-w-[16rem] truncate text-xs text-muted-foreground" title={patient.id}>{patient.id}</span>
                              </span>
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-ink-2">{sexLabel(patient.gender)}</td>
                          <td className="px-3 py-2.5">
                            <span className="data-mono text-ink">{formatDate(patient.dateOfBirth)}</span>
                            {age !== null ? <span className="ml-2 text-muted-foreground">{age} y</span> : null}
                          </td>
                          <td className="px-3 py-2.5 text-ink-2">{patient.language || '—'}</td>
                          <td className="data-mono px-3 py-2.5 text-right text-ink">{encounters.length}</td>
                          <td className="data-mono px-3 py-2.5 text-ink-2">{formatDate(lastSeen)}</td>
                          <td className="px-3 py-2.5">
                            {flags ? (
                              <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-flag-line bg-flag-soft px-1.5 text-xs font-medium leading-5 text-flag">
                                <span className="h-1.5 w-1.5 rounded-full bg-flag" aria-hidden />{flags}
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-2 text-muted-foreground"><CaretRight size={14} aria-hidden /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Phones: one row per patient. */}
                <ul className="divide-y divide-border md:hidden">
                  {visible.map(({ patient, encounters, lastSeen }) => {
                    const age = ageFrom(patient.dateOfBirth);
                    const flags = patient.alerts?.length ?? 0;
                    return (
                      <li key={patient.id}>
                        <Link href={`/patients/${patient.id}`} className="row-link flex items-center gap-3 py-3">
                          <PatientAvatar patient={patient} size={34} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-display text-lg leading-tight text-ink">{patientName(patient)}</span>
                            <span className="block truncate text-sm text-muted-foreground">
                              {sexLabel(patient.gender)}{age !== null ? ` · ${age} y` : ''} · {encounters.length} encounters
                            </span>
                            <span className="data-mono block text-xs text-muted-foreground">Last seen {formatDate(lastSeen)}</span>
                          </span>
                          {flags ? <span className="h-2 w-2 rounded-full bg-flag" aria-label={`${flags} flags`} /> : null}
                          <CaretRight size={14} className="text-muted-foreground" aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </TabsContent>

          <TabsContent value="consultations" className="mt-6 space-y-10">
            <ConsultationList title="Upcoming" entries={upcoming} emptyText="No consultations are booked from now on." onOpen={(e) => router.push(`/patients/${e.patient.id}?tab=consultation&encounterId=${e.encounter.id}`)} />
            <ConsultationList title="Past" entries={past} emptyText="No finished consultations yet." onOpen={(e) => router.push(`/patients/${e.patient.id}?tab=consultation&encounterId=${e.encounter.id}`)} />
          </TabsContent>
        </Tabs>
      ) : null}

      <NewConsultationModal
        open={showNewConsultModal}
        onOpenChange={setShowNewConsultModal}
        onConsultationCreated={(patient, encounter) => {
          if (patient && encounter) onSelect(patient);
          else load(true);
        }}
        draggable={false}
        allowDragging={false}
        draggableConfig={{ id: 'new-consultation-patients', title: 'Start a consultation', persistent: false }}
      />
      <FormCreationModal open={showPriorAuthModal} onOpenChange={setShowPriorAuthModal} formType="priorAuth" />
      <FormCreationModal open={showReferralModal} onOpenChange={setShowReferralModal} formType="referral" />
    </ContentSurface>
  );
}

function ConsultationList({ title, entries, emptyText, onOpen }: { title: string; entries: Entry[]; emptyText: string; onOpen: (e: Entry) => void }) {
  return (
    <section>
      <SectionHeading as="h3" count={entries.length}>{title}</SectionHeading>
      {entries.length === 0 ? (
        <EmptyState className="border-t-0" title="None" message={emptyText} />
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((entry) => {
            const when = encounterWhen(entry.encounter);
            return (
              <li key={`${entry.patient.id}_${entry.encounter.id}`}>
                <button
                  type="button"
                  onClick={() => onOpen(entry)}
                  className="row-link grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-1 py-3 text-left sm:grid-cols-[8.5rem_minmax(0,1fr)_auto]"
                >
                  <span className="data-mono hidden text-sm text-ink sm:block">
                    {formatDate(when)}
                    <span className="block text-xs text-muted-foreground">{formatTime(when)}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{encounterReason(entry.encounter)}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {patientName(entry.patient)}
                      <span className="data-mono sm:hidden"> · {formatDate(when)}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {entry.encounter.reasonCode ? (
                      <span className="data-mono hidden rounded border border-border px-1.5 text-xs text-ink-2 sm:inline">{entry.encounter.reasonCode}</span>
                    ) : null}
                    <CaretRight size={14} className="text-muted-foreground" aria-hidden />
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
