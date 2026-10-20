'use client';
import * as React from 'react';
import { ArrowClockwise } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import MarkLoader from '@/components/brand/MarkLoader';

// The three states every view that loads data shows: loading, failed (with a
// way to try again) and empty. Quiet by design: a line of type, never a
// full-screen takeover.

export function LoadingState({ label = 'Loading', className, inline = false }: { label?: string; className?: string; inline?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-center gap-3 text-muted-foreground',
        inline ? 'py-3' : 'min-h-[40vh] flex-col justify-center',
        className,
      )}
    >
      <MarkLoader size={inline ? 20 : 32} className="text-ink" />
      <span className="label-caps">{label}</span>
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  className,
}: {
  title?: string;
  message?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div role="alert" className={cn('rounded-[var(--radius-lg)] border border-critical-line border-l-[3px] border-l-critical bg-card p-5', className)}>
      <p className="label-caps !text-critical">Could not load</p>
      <p className="mt-1 font-display text-xl text-ink">{title}</p>
      {message ? <p className="mt-1 max-w-prose text-sm text-ink-2">{message}</p> : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry} iconLeft={<ArrowClockwise />}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
  className,
}: {
  title: string;
  message?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-start gap-1 border-t border-border py-6', className)}>
      <p className="text-sm font-medium text-ink">{title}</p>
      {message ? <p className="max-w-prose text-sm text-muted-foreground">{message}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** A section heading: small capitals, an optional count, an optional action at the right. */
export function SectionHeading({
  children,
  count,
  action,
  className,
  as: Tag = 'h2',
  id,
}: {
  children: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
  className?: string;
  as?: 'h2' | 'h3';
  id?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 border-b border-ink/70 pb-2', className)}>
      <Tag id={id} className="label-caps flex items-center gap-2 !text-ink">
        {children}
        {typeof count === 'number' ? (
          <span className="data-mono rounded border border-border bg-card px-1.5 text-[0.6875rem] font-medium tracking-normal text-muted-foreground">
            {count}
          </span>
        ) : null}
      </Tag>
      {action}
    </div>
  );
}
