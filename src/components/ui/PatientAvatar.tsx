import * as React from 'react';
import type { Patient } from '@/lib/types';
import { initials, patientName } from '@/lib/format';
import { cn } from '@/lib/utils';

// Initials on a soft tint chosen from the name, never a photo: the records are
// synthetic, and a stock face would pretend otherwise.
const TINTS = [
  'bg-[hsl(245_71%_95%)] text-[hsl(245_55%_42%)]',
  'bg-[hsl(148_35%_92%)] text-[hsl(151_55%_26%)]',
  'bg-[hsl(38_83%_92%)] text-[hsl(34_88%_28%)]',
  'bg-[hsl(205_60%_93%)] text-[hsl(205_65%_30%)]',
  'bg-[hsl(330_55%_94%)] text-[hsl(330_50%_35%)]',
  'bg-[hsl(20_70%_93%)] text-[hsl(15_60%_35%)]',
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export default function PatientAvatar({ patient, size = 32, className }: { patient?: Partial<Patient> | null; size?: number; className?: string }) {
  const tint = TINTS[hash(patientName(patient)) % TINTS.length];
  return (
    <span
      aria-hidden
      className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-wide', tint, className)}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.34)) }}
    >
      {initials(patient)}
    </span>
  );
}
