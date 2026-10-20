'use client';
import * as React from 'react';
import Link from 'next/link';
import { ArrowClockwise, ChartLine, GearSix } from '@phosphor-icons/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// The clinician's menu: the same three entries as before, behind initials.
export default function AccountMenu({ tone = 'light', side = 'bottom', align = 'end' }: { tone?: 'light' | 'dark'; side?: 'top' | 'bottom' | 'right'; align?: 'start' | 'end' }) {
  const resetDemo = () => {
    try { localStorage.removeItem('hasDemoRun_v3'); } catch { /* storage blocked */ }
    window.location.href = '/';
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Account"
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-full text-[0.6875rem] font-semibold tracking-wide transition-shadow',
            tone === 'dark'
              ? 'bg-[hsl(245_40%_30%)] text-white ring-1 ring-white/15 hover:ring-white/40'
              : 'bg-iris-soft text-iris ring-1 ring-iris-line hover:ring-iris/50',
          )}
        >
          MD
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-52 p-1.5">
        <Link href="/analytics" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-well">
          <ChartLine size={16} className="text-muted-foreground" /> Analytics
        </Link>
        <Link href="/settings" className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-well">
          <GearSix size={16} className="text-muted-foreground" /> Settings
        </Link>
        <button type="button" onClick={resetDemo} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-well">
          <ArrowClockwise size={16} className="text-muted-foreground" /> Reset Demo
        </button>
      </PopoverContent>
    </Popover>
  );
}
