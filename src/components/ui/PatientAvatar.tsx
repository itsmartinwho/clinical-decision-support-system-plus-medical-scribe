import * as React from 'react';
import type { Patient } from '@/lib/types';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

// Initials on a well, never a photo: the records are synthetic, and a
// stock face would pretend otherwise.
export default function PatientAvatar({ patient, size = 32, className }: { patient?: Partial<Patient> | null; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-well font-medium text-ink-2', className)}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }}
    >
      {initials(patient)}
    </span>
  );
}
