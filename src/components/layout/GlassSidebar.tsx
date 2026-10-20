'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarSimple } from '@phosphor-icons/react';
import Mark from '@/components/brand/Mark';
import AccountMenu from '@/components/layout/AccountMenu';
import { NAV_ITEMS, isActive } from '@/components/layout/navItems';
import { PRODUCT_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';

const KEY = 'fs_sidebar_collapsed';
const EXPANDED = '15rem';
const COLLAPSED = '4.5rem';

// The navigation rail on wide screens, in ink (the file keeps its 2025 name).
// It sets --actual-sidebar-width, which the advisor's composer centres on.
export default function GlassSidebar() {
  const pathname = usePathname() ?? '/';
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try { setCollapsed(localStorage.getItem(KEY) === 'true'); } catch { /* storage blocked */ }
  }, []);

  React.useEffect(() => {
    const root = document.documentElement;
    const lg = window.matchMedia('(min-width: 1024px)');
    const apply = () => root.style.setProperty('--actual-sidebar-width', lg.matches ? (collapsed ? COLLAPSED : EXPANDED) : '0rem');
    apply();
    lg.addEventListener('change', apply);
    return () => lg.removeEventListener('change', apply);
  }, [collapsed]);

  const toggle = () => setCollapsed((c) => {
    try { localStorage.setItem(KEY, String(!c)); } catch { /* storage blocked */ }
    return !c;
  });

  return (
    <aside
      className={cn(
        'relative hidden shrink-0 flex-col bg-rail text-rail-ink transition-[width] duration-300 ease-[cubic-bezier(.22,1,.36,1)] lg:flex',
        collapsed ? 'w-[4.5rem]' : 'w-[15rem]',
      )}
    >
      <Link
        href="/"
        aria-label={PRODUCT_NAME}
        className={cn('flex h-16 items-center gap-3 text-white', collapsed ? 'justify-center' : 'px-6')}
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[0.6rem] bg-white/[0.07] ring-1 ring-white/10">
          <Mark size={18} />
        </span>
        {!collapsed && <span className="truncate font-display text-[1.2rem] leading-none tracking-[-0.01em]">{PRODUCT_NAME}</span>}
      </Link>

      <nav aria-label="Main" className={cn('mt-4 flex-1', collapsed ? 'px-3' : 'px-4')}>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'group relative flex h-10 items-center gap-3 rounded-[0.65rem] px-3 text-[0.875rem] transition-colors duration-150',
                    collapsed && 'justify-center px-0',
                    active ? 'bg-white/[0.08] text-white' : 'text-rail-ink hover:bg-white/[0.04] hover:text-white',
                  )}
                >
                  {active ? <span className="absolute -left-4 top-2 bottom-2 w-[3px] rounded-r-full bg-iris" aria-hidden /> : null}
                  <Icon size={19} weight={active ? 'fill' : 'regular'} className={active ? 'text-[hsl(245_90%_78%)]' : 'text-rail-muted group-hover:text-rail-ink'} aria-hidden />
                  {!collapsed && <span className="truncate">{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={cn('flex items-center border-t border-white/[0.06] py-4', collapsed ? 'flex-col gap-3 px-3' : 'justify-between px-5')}>
        <AccountMenu tone="dark" side="right" align="end" />
        <button
          type="button"
          onClick={toggle}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rail-muted transition-colors hover:bg-white/[0.06] hover:text-white"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
        >
          <SidebarSimple size={18} aria-hidden />
        </button>
      </div>
    </aside>
  );
}
