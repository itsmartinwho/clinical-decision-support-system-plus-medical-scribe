'use client';

import React from 'react';
import './globals.css';
import dynamic from 'next/dynamic';
import Script from 'next/script';

import GlassHeader from '@/components/layout/GlassHeader';
import GlassSidebar from '@/components/layout/GlassSidebar';
import MotionWrapper from '../components/MotionWrapper';
import { ModalManagerProvider } from '@/components/ui/modal-manager';
import { MinimizedModalBar } from '@/components/ui/minimized-modal-bar';
import { Toaster } from '@/components/ui/toaster';
import { LoadingState } from '@/components/ui/states';
import { displayFont, monoFont, sansFont } from './fonts';
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from '@/lib/brand';

const DynamicDemoProvider = dynamic(
  () => import('@/contexts/DemoContext').then((mod) => mod.DemoProvider),
  { ssr: false, loading: () => <LoadingState /> },
);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${displayFont.variable} ${sansFont.variable} ${monoFont.variable}`}
    >
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/mark.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#14161B" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{PRODUCT_NAME}</title>
        <meta name="description" content={PRODUCT_DESCRIPTION} />
        <meta property="og:title" content={PRODUCT_NAME} />
        <meta property="og:description" content={PRODUCT_DESCRIPTION} />
        <meta property="og:image" content="/og.png" />
        <meta name="twitter:card" content="summary_large_image" />

        {/* Pyodide, for the advisor's Python charts */}
        <Script
          src="https://cdn.jsdelivr.net/pyodide/v0.27.6/full/pyodide.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>
        <DynamicDemoProvider>
          <ModalManagerProvider>
            <div className="flex h-[100svh]">
              <GlassSidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <GlassHeader />
                <main id="main" className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
                  <React.Suspense fallback={<LoadingState />}>
                    <MotionWrapper>{children}</MotionWrapper>
                  </React.Suspense>
                </main>
              </div>
            </div>
            <MinimizedModalBar />
            <Toaster />
          </ModalManagerProvider>
        </DynamicDemoProvider>
      </body>
    </html>
  );
}
