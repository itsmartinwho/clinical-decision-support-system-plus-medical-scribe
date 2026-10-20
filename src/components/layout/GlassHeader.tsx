'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MagnifyingGlass, UserCircle, ArrowClockwise, ChartLine, GearSix, X } from '@phosphor-icons/react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import EnhancedSearch from '@/components/ui/EnhancedSearch';
import Mark from '@/components/brand/Mark';
import DataSourceIndicator from '@/components/layout/DataSourceIndicator';
import { NAV_ITEMS, isActive } from '@/components/layout/navItems';
import { PRODUCT_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

const SEARCH_INPUT =
  'h-9 w-full rounded-md border border-input bg-card pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 unified-search-input';

// The app's header (the file keeps its 2025 name): the mark and the product
// name, search, whether the data is a demo, and the account menu. Below the
// lg breakpoint it also carries the navigation, as a row of tabs.
export default function GlassHeader() {
  const pathname = usePathname() ?? '/';
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => setSearchOpen(false), [pathname]);

  const resetGuidedDemo = () => {
    try { localStorage.removeItem('hasDemoRun_v3'); } catch { /* storage blocked */ }
    window.location.href = '/';
  };

  return (
    <header className="relative z-40 shrink-0 border-b border-border bg-paper">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
        Skip to content
      </a>
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-md text-ink" aria-label={`${PRODUCT_NAME}: dashboard`}>
          <Mark size={22} />
          <span className="truncate font-display text-[1.3rem] leading-none tracking-[-0.01em]">{PRODUCT_NAME}</span>
        </Link>

        <div className="mx-auto hidden w-full max-w-xl md:block">
          <EnhancedSearch portal inputClassName={SEARCH_INPUT} placeholder="Search patients, conditions, guidelines" />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0">
          <DataSourceIndicator />
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink hover:bg-well md:hidden"
            aria-label={searchOpen ? 'Close search' : 'Search'}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
          >
            {searchOpen ? <X size={18} /> : <MagnifyingGlass size={18} />}
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink hover:bg-well" aria-label="Account menu">
                <UserCircle size={22} weight="light" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1">
              <p className="label-caps px-2.5 pb-1 pt-2">Clinician</p>
              <Link href="/analytics" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-well">
                <ChartLine size={16} /> Analytics
              </Link>
              <Link href="/settings" className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-well">
                <GearSix size={16} /> Settings
              </Link>
              <button type="button" onClick={resetGuidedDemo} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-well">
                <ArrowClockwise size={16} /> Replay the guided demo
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {searchOpen ? (
        <div className="border-t border-border px-4 py-2 md:hidden">
          <EnhancedSearch inputClassName={SEARCH_INPUT} placeholder="Search patients, conditions, guidelines" />
        </div>
      ) : null}

      <nav aria-label="Main" className="grid grid-cols-5 border-t border-border lg:hidden">
        {NAV_ITEMS.map(({ href, short, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              className={cn(
                '-mb-px flex flex-col items-center gap-0.5 border-b-2 py-1.5 text-[0.6875rem] font-medium transition-colors',
                active ? 'border-ink text-ink' : 'border-transparent text-muted-foreground hover:text-ink',
              )}
            >
              <Icon size={18} weight={active ? 'regular' : 'light'} aria-hidden />
              {short}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
