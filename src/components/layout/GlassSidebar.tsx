'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SidebarSimple } from '@phosphor-icons/react';
import { NAV_ITEMS, isActive } from '@/components/layout/navItems';
import { cn } from '@/lib/utils';

const KEY = 'fs_sidebar_collapsed';
const EXPANDED = '13.5rem';
const COLLAPSED = '4rem';

// The navigation rail on wide screens (the file keeps its 2025 name). It sets
// --actual-sidebar-width, which the advisor's composer uses to centre itself.
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

  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(KEY, String(!c)); } catch { /* storage blocked */ }
      return !c;
    });
  };

  return (
    <nav
      aria-label="Main"
      className={cn(
        'hidden shrink-0 flex-col border-r border-border bg-paper py-4 transition-[width] duration-200 lg:flex',
        collapsed ? 'w-16 px-2' : 'w-[13.5rem] px-3',
      )}
    >
      <ul className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? label : undefined}
                className={cn(
                  'relative flex h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-colors',
                  collapsed && 'justify-center px-0',
                  active ? 'bg-well font-medium text-ink' : 'text-ink-2 hover:bg-well/60 hover:text-ink',
                )}
              >
                {active ? <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r bg-ink" aria-hidden /> : null}
                <Icon size={18} weight={active ? 'regular' : 'light'} aria-hidden />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={toggle}
        className={cn('mt-auto flex h-9 items-center gap-3 rounded-md px-2.5 text-sm text-muted-foreground hover:bg-well hover:text-ink', collapsed && 'justify-center px-0')}
        aria-label={collapsed ? 'Expand the menu' : 'Collapse the menu'}
      >
        <SidebarSimple size={18} weight="light" aria-hidden />
        {!collapsed && <span>Collapse</span>}
      </button>
    </nav>
  );
}
