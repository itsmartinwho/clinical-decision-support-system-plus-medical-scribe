import { House, Users, ChatCircleText, BellSimple, BookOpenText } from '@phosphor-icons/react';

export const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', short: 'Today', icon: House },
  { href: '/patients', label: 'Patients', short: 'Patients', icon: Users },
  { href: '/advisor', label: 'Advisor', short: 'Advisor', icon: ChatCircleText },
  { href: '/alerts', label: 'Alerts', short: 'Alerts', icon: BellSimple },
  { href: '/guidelines', label: 'Guidelines', short: 'Guides', icon: BookOpenText },
] as const;

export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}
