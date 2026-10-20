'use client';
import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { DataModeState, resolveDataMode } from '@/lib/dataMode';
import { hasDemoEdits, onDemoWrite, resetDemoStore } from '@/lib/demo/demoStore';
import { cn } from '@/lib/utils';

const REASON: Record<string, string> = {
  unconfigured: 'No database is configured for this deployment.',
  unreachable: 'The database could not be reached.',
  timeout: 'The database did not answer in time.',
  rejected: 'The database refused the request.',
};

// Says, in the header, when the app is on the synthetic records bundled with
// it rather than a database, and that changes made here are temporary.
export default function DataSourceIndicator({ className }: { className?: string }) {
  const [mode, setMode] = React.useState<DataModeState | null>(null);
  const [edited, setEdited] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    resolveDataMode().then((m) => { if (live) { setMode(m); setEdited(hasDemoEdits()); } });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onDemoWrite(() => {
      setEdited(true);
      setJustSaved(true);
      clearTimeout(timer);
      timer = setTimeout(() => setJustSaved(false), 3500);
    });
    return () => { live = false; off(); clearTimeout(timer); };
  }, []);

  if (mode?.source !== 'demo') return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 items-center gap-2 rounded-full border border-flag-line bg-flag-soft px-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-flag transition-colors hover:border-flag',
            className,
          )}
          aria-label="Demo data: about the data on this page"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-flag" aria-hidden />
          <span aria-live="polite">{justSaved ? 'Saved in this tab' : 'Demo data'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <p className="label-caps">Demo data</p>
        <p className="mt-1 font-display text-lg leading-snug">Synthetic records, bundled with the app</p>
        <p className="mt-2 text-sm text-ink-2">
          {REASON[mode.reason ?? ''] ?? ''} You are looking at one invented patient and her encounters,
          from the project&apos;s seed. Nothing here is a real person.
        </p>
        <p className="mt-2 text-sm text-ink-2">
          What you add or change is kept in this browser tab only, and is gone when you close it.
        </p>
        {mode.detail ? <p className="data-mono mt-3 text-xs text-muted-foreground">{mode.detail}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {edited ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => { await resetDemoStore(); window.location.reload(); }}
            >
              Reset demo data
            </Button>
          ) : null}
          {mode.reason !== 'unconfigured' ? (
            <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
              Try the database again
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
