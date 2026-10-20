import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from 'next/font/google';

// Three faces, one job each.
// - Newsreader: names and page titles. An editorial serif, set large and never bold.
// - IBM Plex Sans: everything read or typed: data, forms, transcripts, labels.
// - IBM Plex Mono: codes, ids, doses and money, where characters must line up.
export const displayFont = Newsreader({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
  adjustFontFallback: false, // next/font has no fallback metrics for Newsreader
});

export const sansFont = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

export const monoFont = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});
