'use client';
import * as React from 'react';
import { ArrowClockwise, WarningCircle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import MarkLoader from '@/components/brand/MarkLoader';
import Mark from '@/components/brand/Mark';

// The three states of anything that loads: the mark listening while it
// loads, the error with a way to try again, and empty. No new words: the
// loader and icons carry the state, and messages come from the data.

export function LoadingState({ className, inline = false }: { label?: string; className?: string; inline?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn('flex items-center justify-center text-ink', inline ? 'py-3' : 'min-h-[50vh]', className)}
    >
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-card shadow-card ring-1 ring-hairline">
        <MarkLoader size={inline ? 20 : 28} className="text-iris" />
      </span>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-4 py-16 text-center', className)}>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-critical-soft text-critical ring-1 ring-critical-line">
        <WarningCircle size={24} weight="fill" aria-hidden />
      </span>
      <div>
        <p className="font-display text-xl text-ink">An Error Occurred</p>
        {message ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="secondary" size="icon" className="rounded-full" onClick={onRetry} aria-label="Retry">
          <ArrowClockwise />
        </Button>
      ) : null}
    </div>
  );
}

/** Empty: the mark, faint, and the sentence the view has always used. */
export function EmptyState({
  title,
  message,
  action,
  className,
}: {
  title?: string;
  message?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      <Mark size={28} className="text-hairline" />
      {title ? <p className="text-sm text-muted-foreground">{title}</p> : null}
      {message ? <p className="max-w-md text-sm text-muted-foreground">{message}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/** A card's heading row: a title in the editorial face, an optional count, an action at the right. */
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
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <Tag id={id} className="flex items-center gap-2.5 font-display text-[1.35rem] leading-tight text-ink">
        {children}
        {typeof count === 'number' ? (
          <span className="data-mono inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-well px-2 text-xs font-medium text-muted-foreground ring-1 ring-hairline">
            {count}
          </span>
        ) : null}
      </Tag>
      {action}
    </div>
  );
}
