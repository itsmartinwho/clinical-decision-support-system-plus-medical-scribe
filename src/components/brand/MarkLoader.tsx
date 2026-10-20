import * as React from 'react';
import { cn } from '@/lib/utils';
import { MARK_BARS } from './Mark';

// The loader is the mark listening: the four short bars rise and fall like a
// level meter while the tall bar holds still. CSS only (mark-loader in
// globals.css); with prefers-reduced-motion the bars stand still and the
// label carries the state.
export function MarkLoader({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="currentColor"
      aria-hidden
      className={cn('mark-loader shrink-0', className)}
    >
      {MARK_BARS.map((b, i) => (
        <rect
          key={b.x}
          x={b.x}
          y={b.y}
          width={4}
          height={b.h}
          rx={2}
          className={i === 2 ? undefined : `mark-loader-bar mark-loader-bar-${i}`}
        />
      ))}
    </svg>
  );
}

export default MarkLoader;
