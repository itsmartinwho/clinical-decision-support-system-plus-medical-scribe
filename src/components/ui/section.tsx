'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CaretUp as ChevronUp } from '@phosphor-icons/react';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  headerClassName?: string;
  contentClassName?: string;
  collapsedSummary?: string;
}

export default function Section({
  title,
  children,
  className,
  collapsible = false,
  defaultOpen = true,
  headerClassName,
  contentClassName,
  collapsedSummary,
}: SectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  if (!collapsible) {
    return (
      <section className={cn("mb-8 last:mb-0", className)}>
        <h2 className={cn("mb-5 font-display text-xl text-ink [line-height:1.25]", headerClassName)}>
          {title}
        </h2>
        <div className={cn("space-y-4", contentClassName)}>
          {children}
        </div>
      </section>
    );
  }

  // Collapsible: a card whose header row opens it.
  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={cn("mb-8 rounded-[var(--radius-lg)] border border-border bg-card shadow-card last:mb-0", className)}
    >
      <CollapsibleTrigger className={cn(
        "group flex w-full cursor-pointer items-center justify-between gap-4 rounded-[var(--radius-lg)] p-5 text-left transition-colors hover:bg-well/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35 sm:px-6",
        headerClassName
      )}>
        <div className="min-w-0">
          <h2 className="font-display text-xl text-ink [line-height:1.25]">
            {title}
          </h2>
          {!isOpen && collapsedSummary && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {collapsedSummary}
            </p>
          )}
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-well text-ink-2 ring-1 ring-hairline transition-colors group-hover:text-iris">
          <ChevronUp
            className={cn(
              "h-4 w-4 transition-transform duration-300 ease-in-out",
              isOpen ? "rotate-0" : "rotate-180"
            )}
          />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
        <div className={cn("space-y-4 px-5 pb-5 sm:px-6 sm:pb-6", contentClassName)}>
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
