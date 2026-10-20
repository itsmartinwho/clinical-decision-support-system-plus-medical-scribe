import * as React from 'react';
import { cn } from '@/lib/utils';

// A page's title block: an optional eyebrow in small capitals, the title in
// the editorial face, an optional line under it, and a stamp or actions at
// the right that wrap below on a phone.
export default function PageHeader({
  eyebrow,
  title,
  meta,
  aside,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="label-caps mb-1.5">{eyebrow}</p> : null}
        <h1 className="title-display text-[1.875rem] sm:text-[2.25rem]">{title}</h1>
        {meta ? <div className="mt-2 text-sm text-muted-foreground">{meta}</div> : null}
      </div>
      {aside ? <div className="flex flex-wrap items-center gap-2">{aside}</div> : null}
    </header>
  );
}
