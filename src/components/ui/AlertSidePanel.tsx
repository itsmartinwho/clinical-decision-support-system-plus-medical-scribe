'use client';
import React from 'react';
import { X, WarningCircle } from '@phosphor-icons/react';
import type { ComplexCaseAlert } from "@/lib/types";
import PatientAvatar from '@/components/ui/PatientAvatar';
import { severityTone } from '@/lib/format';
import { cn } from '@/lib/utils';

interface AlertSidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: Array<ComplexCaseAlert & { patientName?: string }>;
  onAlertClick: (patientId: string) => void;
}

const TONE = {
  critical: 'bg-critical-soft text-critical ring-critical-line',
  flag: 'bg-flag-soft text-flag ring-flag-line',
  info: 'bg-iris-soft text-iris ring-iris-line',
} as const;

// The chart flags across patients, in a sheet from the right.
export default function AlertSidePanel({ isOpen, onClose, alerts, onAlertClick }: AlertSidePanelProps) {
  const sorted = [...alerts].sort((a, b) => (b.likelihood ?? 0) - (a.likelihood ?? 0));
  return (
    <>
      <div className={cn('fixed inset-0 z-40 bg-ink/20 transition-opacity', isOpen ? 'opacity-100' : 'pointer-events-none opacity-0')} onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-label="Alerts"
        className={cn(
          'fixed inset-y-2 right-2 z-50 flex w-[min(24rem,calc(100vw-1rem))] flex-col rounded-2xl border border-hairline bg-card shadow-float transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]',
          isOpen ? 'translate-x-0' : 'translate-x-[110%]',
        )}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <h3 className="font-display text-xl">Alerts</h3>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-well hover:text-ink" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <ul className="flex-1 space-y-2 overflow-y-auto px-3 pb-4">
          {sorted.map((alert) => {
            const tone = severityTone(alert.severity, alert.likelihood);
            return (
              <li key={alert.id}>
                <button
                  type="button"
                  onClick={() => { onAlertClick(alert.patientId); onClose(); }}
                  className="flex w-full gap-3 rounded-xl p-3 text-left transition-colors hover:bg-well"
                >
                  <span className={cn('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1', TONE[tone])}>
                    <WarningCircle size={17} weight="fill" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm leading-snug text-ink">{alert.msg}</span>
                    <span className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <PatientAvatar patient={{ name: alert.patientName }} size={18} />
                      {alert.patientName}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}
