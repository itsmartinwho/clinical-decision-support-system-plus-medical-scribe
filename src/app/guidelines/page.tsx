'use client';

import React from 'react';
import GuidelinesTab from '@/components/guidelines/GuidelinesTab';
import LoadingAnimation from '@/components/LoadingAnimation';
import ContentSurface from '@/components/layout/ContentSurface';

export default function GuidelinesPage() {
  return (
    <React.Suspense fallback={<LoadingAnimation />}>
      <ContentSurface>
        <GuidelinesTab />
      </ContentSurface>
    </React.Suspense>
  );
} 