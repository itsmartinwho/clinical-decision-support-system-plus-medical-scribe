import * as React from 'react';
import { cn } from '@/lib/utils';

// A page's title, in the editorial face, with actions at the right that wrap
// below it on a phone.
export default function PageHeader({
  title,
  aside,
  className,
}: {
  title: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  eyebrow?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <header className={cn('mb-6 flex items-center justify-between gap-4 sm:mb-8', className)}>
      <h1 className="title-display min-w-0 text-[1.85rem] sm:text-[2.6rem]">{title}</h1>
      {aside ? <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{aside}</div> : null}
    </header>
  );
}
