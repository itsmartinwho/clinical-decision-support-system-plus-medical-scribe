// The guided demo's clock. Every wait in the scripted demo is set here, so
// tuning its pace is a change to one object.
//
// The demo is not a real transcription, so it does not run at the speed of
// speech: the whole consultation plays through in a few seconds, turn by turn,
// so the parts worth showing (the alerts, the notes, the clinical plan) arrive
// while the audience is still looking. Live mode does not use any of this.

import { parseTranscript } from '@/lib/transcript';

export interface DemoTiming {
  /** After the demo opens the consultation panel, how long it gets to render before the transcript starts. */
  panelSettleMs: number;
  /** Debounce before a stage's animation starts, so a re-render in the same tick cannot start it twice. */
  stageDebounceMs: number;
  /** The whole transcript: from its first turn appearing to its last turn complete. */
  transcriptMs: number;
  /**
   * A turn's share of that time is its words plus this many, so a short
   * "Okay." still gets a beat and a long turn does not get all the time.
   */
  turnBaseWords: number;
  /** The part of a turn's share spent typing it in; the rest is the beat before the next turn. */
  typeShare: number;
  /** How often the typing is redrawn. */
  frameMs: number;
  /** From the last turn to the notes and the clinical plan: a short beat, not a wait. */
  planBeatMs: number;
}

export const DEMO_TIMING: DemoTiming = {
  panelSettleMs: 300,
  stageDebounceMs: 50,
  transcriptMs: 8500,
  turnBaseWords: 10,
  typeShare: 0.65,
  frameMs: 50,
  planBeatMs: 400,
};

/** Whether the reader asked for less motion: turns then appear whole, with no typing. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

interface TurnSlot {
  /** The turn's words, each with the space after it. */
  chunks: string[];
  /** How many of them must show before the turn is drawn at all: its speaker and a first word. */
  lead: number;
  /** When the turn begins, in ms from the transcript's start. */
  start: number;
  /** How long it takes to type in. */
  typeMs: number;
}

export interface TranscriptPlan {
  /** The transcript's turns, each with its raw lines: what the view will show as one turn. */
  turns: string[];
  slots: TurnSlot[];
  /** When the last turn is complete: `timing.transcriptMs`. */
  endMs: number;
}

/**
 * Groups the transcript's lines into the turns the view shows (a section such
 * as the physical examination is one turn of several lines), by asking the
 * view's own parser where each turn begins.
 */
function groupTurns(lines: string[]): string[] {
  const turns: string[] = [];
  let seen = 0;
  lines.forEach((line, i) => {
    const count = parseTranscript(lines.slice(0, i + 1).join('\n')).length;
    if (i === 0 || count > seen) turns.push(line);
    else turns[turns.length - 1] += '\n' + line;
    seen = count;
  });
  return turns;
}

// A turn's speaker, or its section's name, and its first word. Shown any
// sooner, "Dr." would sit on the end of the turn before until the colon came.
const LEAD = /^\s*(?:\[[^\]\n]*\]|[^:\n]{1,40}:\s*\S)/;

function leadChunks(chunks: string[]): number {
  let text = '';
  for (let n = 1; n <= chunks.length; n++) {
    text += chunks[n - 1];
    if (LEAD.test(text)) return n;
  }
  return 1;
}

/**
 * Lays the transcript out in time, a turn at a time. Pure: the animation reads
 * it with the elapsed time, so the transcript finishes on schedule however the
 * timer behaves (a tab in the background throttles it to once a second).
 */
export function planTranscript(lines: string[], timing: DemoTiming = DEMO_TIMING): TranscriptPlan {
  const turns = groupTurns(lines);
  const chunks = turns.map((turn) => turn.match(/\s*\S+\s*/g) ?? [turn]);
  const weights = chunks.map((c) => timing.turnBaseWords + c.length);
  const last = turns.length - 1;
  // The last turn needs no beat after it, so its share counts only its typing
  const total = weights.reduce((sum, w, i) => sum + (i === last ? w * timing.typeShare : w), 0);
  const unit = total > 0 ? timing.transcriptMs / total : 0;

  let at = 0;
  const slots = chunks.map((c, i) => {
    const slot = { chunks: c, lead: leadChunks(c), start: at * unit, typeMs: weights[i] * timing.typeShare * unit };
    at += weights[i];
    return slot;
  });
  return { turns, slots, endMs: last >= 0 ? slots[last].start + slots[last].typeMs : 0 };
}

/**
 * The transcript as it stands `elapsedMs` in: the turns before the current one
 * whole, the current one typed in as far as its time allows (whole once it
 * begins, with reduced motion).
 */
export function transcriptAt(
  plan: TranscriptPlan,
  elapsedMs: number,
  reduced: boolean,
): { text: string; done: boolean } {
  if (plan.turns.length === 0 || elapsedMs >= plan.endMs) {
    return { text: plan.turns.join('\n'), done: true };
  }
  let current = -1;
  for (let i = 0; i < plan.slots.length && plan.slots[i].start <= elapsedMs; i++) current = i;
  if (current < 0) return { text: '', done: false };

  const slot = plan.slots[current];
  const shown = reduced || slot.typeMs <= 0
    ? slot.chunks.length
    : Math.max(slot.lead, Math.ceil(Math.min(1, (elapsedMs - slot.start) / slot.typeMs) * slot.chunks.length));
  const partial = shown >= slot.chunks.length ? plan.turns[current] : slot.chunks.slice(0, shown).join('').trimEnd();
  return { text: [...plan.turns.slice(0, current), partial].join('\n'), done: false };
}
