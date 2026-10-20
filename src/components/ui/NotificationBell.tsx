'use client';
import React from 'react';
import { BellSimple } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

// The alerts bell: a dot when there is something to see, a breathing one when
// it is critical.
export default function NotificationBell({ count, onClick, critical = false }: { count: number; onClick: () => void; critical?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={count > 0 ? `Alerts: ${count}` : 'Alerts'}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-card text-ink shadow-card transition-colors hover:bg-well"
    >
      <BellSimple size={19} aria-hidden />
      {count > 0 ? (
        <span
          className={cn(
            'absolute right-2 top-2 h-2.5 w-2.5 rounded-full ring-2 ring-card',
            critical ? 'dot-live bg-critical' : 'bg-flag-line',
          )}
          aria-hidden
        />
      ) : null}
    </button>
  );
}
