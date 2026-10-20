'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import EnhancedSearch from '@/components/ui/EnhancedSearch';
import Mark from '@/components/brand/Mark';
import AccountMenu from '@/components/layout/AccountMenu';
import { NAV_ITEMS, isActive } from '@/components/layout/navItems';
import { PRODUCT_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

const SEARCH_INPUT =
  'h-10 w-full rounded-xl border border-hairline bg-card pl-10 pr-9 text-sm text-foreground shadow-card placeholder:text-muted-foreground transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 unified-search-input';
const PLACEHOLDER = 'Search patients, guidelines, conditions...';

// The top bar (the file keeps its 2025 name). On wide screens: search and
// nothing else, over the canvas. On a phone: the mark, search and the
// account in ink, with the navigation as a row of icons.
export default function GlassHeader() {
  const pathname = usePathname() ?? '/';
  const [searchOpen, setSearchOpen] = React.useState(false);
  React.useEffect(() => setSearchOpen(false), [pathname]);

  return (
    <header className="relative z-40 shrink-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>

      {/* Wide screens */}
      <div className="hidden h-16 items-center gap-4 px-8 lg:flex xl:px-10">
        <div className="w-full max-w-xl">
          <EnhancedSearch portal inputClassName={SEARCH_INPUT} placeholder={PLACEHOLDER} />
        </div>
      </div>

      {/* Phones and tablets */}
      <div className="bg-rail text-white lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/" aria-label={PRODUCT_NAME} className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[0.6rem] bg-white/[0.07] ring-1 ring-white/10">
              <Mark size={17} />
            </span>
            <span className="truncate font-display text-[1.15rem] leading-none tracking-[-0.01em]">{PRODUCT_NAME}</span>
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rail-ink hover:bg-white/[0.06] hover:text-white"
              aria-label="Search"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((v) => !v)}
            >
              {searchOpen ? <X size={18} /> : <MagnifyingGlass size={18} />}
            </button>
            <AccountMenu tone="dark" />
          </div>
        </div>
        {searchOpen ? (
          <div className="px-4 pb-3">
            <EnhancedSearch inputClassName={SEARCH_INPUT} placeholder={PLACEHOLDER} />
          </div>
        ) : null}
        <nav aria-label="Main" className="grid grid-cols-5 px-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                aria-label={label}
                className={cn(
                  'relative flex h-11 items-center justify-center transition-colors',
                  active ? 'text-white' : 'text-rail-muted hover:text-rail-ink',
                )}
              >
                <Icon size={21} weight={active ? 'fill' : 'regular'} aria-hidden />
                <span className={cn('absolute bottom-0 h-[3px] w-6 rounded-t-full transition-colors', active ? 'bg-iris' : 'bg-transparent')} aria-hidden />
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
