import React from 'react';
import MarkLoader from '@/components/brand/MarkLoader';

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center text-ink" role="status">
      <MarkLoader size={28} />
      <span className="sr-only">Loading</span>
    </div>
  );
}
