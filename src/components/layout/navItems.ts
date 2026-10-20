import { House, Users, Sparkle, BellSimple, BookOpenText } from '@phosphor-icons/react';

// The navigation, in the labels the app has always used.
export const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: House },
  { href: '/patients', label: 'Patients', icon: Users },
  { href: '/advisor', label: 'Advisor', icon: Sparkle },
  { href: '/alerts', label: 'Alerts', icon: BellSimple },
  { href: '/guidelines', label: 'Guidelines', icon: BookOpenText },
] as const;

export function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}
