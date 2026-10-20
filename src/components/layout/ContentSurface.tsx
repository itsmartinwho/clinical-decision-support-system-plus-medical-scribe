import React from 'react';
import { cn } from '@/lib/utils';

interface ContentSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Fill the main area edge to edge (the advisor's chat) instead of the page column. */
  fullBleed?: boolean;
}

// The page column every route sits in: one width, one gutter, no surface of
// its own. Sections inside it draw their own hairlines.
export default function ContentSurface({ children, className, fullBleed = false, ...rest }: ContentSurfaceProps) {
  if (fullBleed) {
    return (
      <div className={cn('flex min-h-0 flex-1 flex-col', className)} {...rest}>
        {children}
      </div>
    );
  }
  return (
    <div className={cn('mx-auto w-full max-w-[1320px] px-4 pb-16 pt-5 sm:px-6 sm:pt-7 lg:px-8', className)} {...rest}>
      {children}
    </div>
  );
}
