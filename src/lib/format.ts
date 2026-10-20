// Dates, ages and names as the views print them. Dates are day month year
// ("23 Jan 2025"), unambiguous in any locale; times are 24-hour.
import type { Encounter, Patient } from './types';

const valid = (d: Date) => !Number.isNaN(d.getTime());

export function formatDate(value?: string | null, opts: { weekday?: boolean } = {}): string {
  if (!value) return '—';
  const d = new Date(value);
  if (!valid(d)) return '—';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', ...(opts.weekday ? { weekday: 'short' } : {}),
  });
}

export function formatTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (!valid(d)) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function ageFrom(dateOfBirth?: string | null, at: Date = new Date()): number | null {
  if (!dateOfBirth) return null;
  const b = new Date(dateOfBirth);
  if (!valid(b)) return null;
  let age = at.getFullYear() - b.getFullYear();
  const m = at.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < b.getDate())) age--;
  return age;
}

export function patientName(p?: Partial<Patient> | null): string {
  if (!p) return 'Unknown patient';
  return p.name || [p.firstName, p.lastName].filter(Boolean).join(' ') || p.id || 'Unknown patient';
}

export function initials(p?: Partial<Patient> | null): string {
  const name = patientName(p);
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '·';
}

export function sexLabel(gender?: string | null): string {
  if (!gender) return '—';
  const g = gender.toLowerCase();
  if (g.startsWith('f')) return 'Female';
  if (g.startsWith('m')) return 'Male';
  return gender;
}

export function encounterWhen(e: Encounter): string | undefined {
  return e.actualStart || e.scheduledStart || undefined;
}

export function encounterReason(e: Encounter): string {
  return e.reasonDisplayText || e.reasonCode || 'Consultation';
}

/** Severity words from the data, on the three semantic colours. */
export function severityTone(severity?: string | null, likelihood?: number): 'critical' | 'flag' | 'info' {
  const s = (severity ?? '').toLowerCase();
  if (s === 'critical' || s === 'high' || (likelihood ?? 0) >= 4) return 'critical';
  if (s === 'warning' || s === 'moderate' || s === 'medium' || (likelihood ?? 0) >= 3) return 'flag';
  return 'info';
}
