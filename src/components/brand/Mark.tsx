import * as React from 'react';
import { cn } from '@/lib/utils';

// The mark: a plus drawn as a voice meter. The tall bar and the four short
// ones read as a clinical cross at rest, and as a level meter listening to a
// consultation when the short bars move (MarkLoader). public/mark.svg is the
// same drawing; scripts/brand/build-icons.ts makes the favicons from it.
export const MARK_BARS = [
  { x: 3, y: 12.5, h: 7 },
  { x: 8.5, y: 12.5, h: 7 },
  { x: 14, y: 3, h: 26 },
  { x: 19.5, y: 12.5, h: 7 },
  { x: 25, y: 12.5, h: 7 },
] as const;

export interface MarkProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  /** A name for screen readers; without it the mark is decorative. */
  title?: string;
}

export function Mark({ size = 24, title, className, ...rest }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="currentColor"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      className={cn('shrink-0', className)}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {MARK_BARS.map((b) => (
        <rect key={b.x} x={b.x} y={b.y} width={4} height={b.h} rx={2} />
      ))}
    </svg>
  );
}

export default Mark;
