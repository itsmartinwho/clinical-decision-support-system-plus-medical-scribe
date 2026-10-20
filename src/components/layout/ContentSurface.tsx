import React from 'react';
import { cn } from '@/lib/utils';

interface ContentSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Fill the main area edge to edge (the advisor's chat) instead of the page column. */
  fullBleed?: boolean;
}

// The page column every route sits in: one width, one gutter.
export default function ContentSurface({ children, className, fullBleed = false, ...rest }: ContentSurfaceProps) {
  if (fullBleed) {
    return (
      <div className={cn('flex min-h-0 flex-1 flex-col', className)} {...rest}>
        {children}
      </div>
    );
  }
  return (
    <div className={cn('rise-in mx-auto w-full max-w-[1280px] px-4 pb-20 pt-6 sm:px-6 lg:px-10 lg:pt-4', className)} {...rest}>
      {children}
    </div>
  );
}
