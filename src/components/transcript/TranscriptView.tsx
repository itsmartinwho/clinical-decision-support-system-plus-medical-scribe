'use client';
import * as React from 'react';
import { formatClock, highlightClinical, parseTranscript, TranscriptTurn, Span } from '@/lib/transcript';
import MarkLoader from '@/components/brand/MarkLoader';
import { cn } from '@/lib/utils';

// A transcript as a conversation: one turn per speaker, with when it was said,
// who said it, and the clinical terms in it lightly marked. While a
// consultation is live the newest turn stays in view, unless the reader has
// scrolled up to read something earlier.

export interface TranscriptViewProps {
  transcript: string | null | undefined;
  /** The consultation is being transcribed now. */
  live?: boolean;
  /** Clinical terms worth marking: the encounter's diagnoses, treatments, labs. */
  terms?: string[];
  /** Terms the chart's alerts are about, marked as flags. */
  flags?: string[];
  emptyText?: string;
  className?: string;
  /** Keep the newest turn in view as turns arrive (on by default while live). */
  followNewest?: boolean;
}

const ROLE_STYLE: Record<TranscriptTurn['role'], { rule: string; name: string }> = {
  clinician: { rule: 'border-l-ink/60', name: 'text-ink' },
  patient: { rule: 'border-l-iris/60', name: 'text-iris' },
  speaker: { rule: 'border-l-input/50', name: 'text-ink-2' },
  note: { rule: 'border-l-transparent', name: 'text-muted-foreground' },
};

function Marked({ spans }: { spans: Span[] }) {
  return (
    <>
      {spans.map((s, i) => {
        if (s.kind === 'text') return <React.Fragment key={i}>{s.text}</React.Fragment>;
        if (s.kind === 'measure') return <span key={i} className="data-mono text-[0.9em] text-ink underline decoration-iris/30 decoration-2 underline-offset-[3px]">{s.text}</span>;
        if (s.kind === 'term') return <mark key={i} className="rounded-[4px] bg-iris-soft px-0.5 text-ink">{s.text}</mark>;
        return <mark key={i} className="rounded-[4px] bg-flag-soft px-0.5 text-flag">{s.text}</mark>;
      })}
    </>
  );
}

export default function TranscriptView({
  transcript, live = false, terms, flags, emptyText = 'Transcription will appear here...', className, followNewest,
}: TranscriptViewProps) {
  const turns = React.useMemo(() => parseTranscript(transcript), [transcript]);
  const scroller = React.useRef<HTMLDivElement>(null);
  const pinned = React.useRef(true);
  const follow = followNewest ?? live;

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  React.useEffect(() => {
    const el = scroller.current;
    if (!el || !follow || !pinned.current) return;
    const reduced = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
  }, [turns.length, transcript, follow]);

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div
        ref={scroller}
        onScroll={onScroll}
        role="log"
        aria-live={live ? 'polite' : 'off'}
        aria-label="Transcript"
        className="min-h-0 flex-1 overflow-y-auto pr-1"
      >
        {turns.length === 0 ? (
          <div className="py-6 text-sm text-muted-foreground">
            {live ? <span role="status" aria-label="Listening"><MarkLoader size={22} className="text-iris" /></span> : emptyText}
          </div>
        ) : (
          <ol className="space-y-3">
            {turns.map((turn, i) => {
              const style = ROLE_STYLE[turn.role];
              const newest = live && i === turns.length - 1;
              if (turn.role === 'note') {
                return (
                  <li key={turn.index} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3">
                    <span aria-hidden />
                    <div className="rounded-md border border-border bg-well/50 px-3 py-2">
                      <p className="label-caps">{turn.speaker}</p>
                      {turn.text ? (
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-2">
                          <Marked spans={highlightClinical(turn.text, { terms, flags })} />
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              }
              return (
                <li key={turn.index} className={cn('grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3', newest && 'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-300')}>
                  <time className="data-mono pt-[0.2rem] text-xs text-muted-foreground" title={turn.estimated ? 'Estimated from the pace of speech' : undefined}>
                    {formatClock(turn.at)}
                  </time>
                  <div className={cn('border-l-2 pl-3', style.rule)}>
                    <p className="flex flex-wrap items-center gap-x-2">
                      <span className={cn('label-caps', style.name)}>{turn.speaker}</span>
                      {newest ? <span className="dot-live h-1.5 w-1.5 rounded-full bg-critical" aria-hidden /> : null}
                      {turn.aside ? <span className="text-xs italic text-muted-foreground">{turn.aside}</span> : null}
                    </p>
                    <p className="mt-0.5 text-[0.9375rem] leading-relaxed text-ink">
                      <Marked spans={highlightClinical(turn.text, { terms, flags })} />
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
