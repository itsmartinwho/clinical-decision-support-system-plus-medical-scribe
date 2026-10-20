import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_TIMING, planTranscript, transcriptAt } from '@/services/demo/demoTiming';
import { DemoAnimationService } from '@/services/demo/DemoAnimationService';
import { DemoDataService } from '@/services/demo/DemoDataService';
import { DemoAlertsService } from '@/services/demo/DemoAlertsService';
import { parseTranscript } from '@/lib/transcript';

const lines = DemoDataService.getTranscriptLines();
const full = lines.join('\n');

/** When the guided demo's alerts fire: the first moment each one's trigger phrase is in the transcript. */
function alertTimes(reduced = false): number[] {
  const plan = planTranscript(lines);
  const alerts = new DemoAlertsService();
  const times: number[] = [];
  for (let t = 0; t <= plan.endMs; t += 10) {
    const { text } = transcriptAt(plan, t, reduced);
    alerts.checkForAlerts(text).forEach(() => times.push(t));
  }
  return times;
}

describe('the guided demo transcript', () => {
  it('has a transcript to play', () => {
    expect(lines.length).toBeGreaterThan(10);
  });

  it('finishes in 8 to 10 seconds, and ends as the whole transcript', () => {
    const plan = planTranscript(lines);
    expect(plan.endMs).toBeGreaterThanOrEqual(8000);
    expect(plan.endMs).toBeLessThanOrEqual(10000);
    expect(plan.endMs).toBeCloseTo(DEMO_TIMING.transcriptMs, 5);

    expect(transcriptAt(plan, plan.endMs - 1, false).done).toBe(false);
    expect(transcriptAt(plan, plan.endMs, false)).toEqual({ text: full, done: true });
  });

  it('raises its first alert within 4 seconds of starting', () => {
    const [first] = alertTimes();
    expect(first).toBeDefined();
    expect(first).toBeLessThanOrEqual(4000);
  });

  it('raises both of its alerts well before the transcript ends', () => {
    const times = alertTimes();
    expect(times).toHaveLength(2);
    expect(times[1]).toBeLessThan(DEMO_TIMING.transcriptMs * 0.75);
  });

  it('only ever adds to what is shown, and arrives a few words at a time, never as a wall', () => {
    const plan = planTranscript(lines);
    let previous = '';
    let biggest = 0;
    for (let t = 0; t <= plan.endMs; t += DEMO_TIMING.frameMs) {
      const { text } = transcriptAt(plan, t, false);
      expect(text.startsWith(previous)).toBe(true);
      biggest = Math.max(biggest, text.length - previous.length);
      previous = text;
    }
    // The longest turn is about 280 characters; a frame shows a fraction of one
    expect(biggest).toBeLessThan(120);
    expect(previous).toBe(full);
  });

  it('starts at once, on the first word of the first turn', () => {
    const first = transcriptAt(planTranscript(lines), 0, false).text;
    expect(first.length).toBeGreaterThan(0);
    expect(lines[0].startsWith(first)).toBe(true);
    expect(transcriptAt(planTranscript([]), 0, false)).toEqual({ text: '', done: true });
  });

  it('never lets a turn in progress spill into the one before it', () => {
    // Shown a word at a time, "Dr." would sit on the end of the last turn until its colon arrived
    const plan = planTranscript(lines);
    const final = parseTranscript(full);
    for (let t = 0; t <= plan.endMs; t += 10) {
      // Each turn shown is the start of its final self: nothing of a later turn is in it
      parseTranscript(transcriptAt(plan, t, false).text).forEach((turn, i) => expect(final[i].text.startsWith(turn.text)).toBe(true));
    }
  });

  it('plays the physical examination as one turn, as the view shows it', () => {
    const plan = planTranscript(lines);
    expect(plan.turns).toHaveLength(parseTranscript(full).length);
    expect(plan.turns.some((turn) => turn.startsWith('[Physical Examination]\nGeneral:'))).toBe(true);
  });

  it('with reduced motion shows each turn whole, in the same order and at the same moments', () => {
    const plan = planTranscript(lines);
    const seen: string[] = [];
    for (let t = 0; t <= plan.endMs; t += 10) {
      const { text } = transcriptAt(plan, t, true);
      if (seen[seen.length - 1] !== text) seen.push(text);
    }
    // One step per turn, each the turns so far, whole
    expect(seen).toEqual(plan.turns.map((_, i) => plan.turns.slice(0, i + 1).join('\n')));
    expect(seen[seen.length - 1]).toBe(full);

    // The alerts come at the same moments as in the typed version, or sooner
    const typed = alertTimes(false);
    const whole = alertTimes(true);
    expect(whole).toHaveLength(typed.length);
    whole.forEach((t, i) => expect(t).toBeLessThanOrEqual(typed[i]));
  });

  it('scales with its one setting', () => {
    const slow = planTranscript(lines, { ...DEMO_TIMING, transcriptMs: 17000 });
    expect(slow.endMs).toBeCloseTo(17000, 5);
  });
});

describe('DemoAnimationService', () => {
  beforeEach(() => {
    // The animation reads performance.now(), so the clock fakes it too
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
  });
  afterEach(() => {
    DemoAnimationService.clearAllAnimations();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('plays the transcript and completes once, on schedule', () => {
    const updates: string[] = [];
    const onComplete = vi.fn();
    DemoAnimationService.startTranscriptAnimation(lines, (t) => updates.push(t), onComplete);
    expect(DemoAnimationService.isTranscriptAnimating()).toBe(true);

    vi.advanceTimersByTime(DEMO_TIMING.transcriptMs - 200);
    expect(onComplete).not.toHaveBeenCalled();
    expect(updates[updates.length - 1]).not.toBe(full);

    vi.advanceTimersByTime(400);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(updates[updates.length - 1]).toBe(full);
    expect(DemoAnimationService.isTranscriptAnimating()).toBe(false);

    vi.advanceTimersByTime(5000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('shows whole turns only with reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }));
    const updates: string[] = [];
    DemoAnimationService.startTranscriptAnimation(lines, (t) => updates.push(t), () => {});
    vi.advanceTimersByTime(DEMO_TIMING.transcriptMs + 100);
    const { turns } = planTranscript(lines);
    expect(updates).toHaveLength(turns.length);
    updates.forEach((text, i) => expect(text).toBe(turns.slice(0, i + 1).join('\n')));
  });

  it('stops when cleared', () => {
    const onComplete = vi.fn();
    DemoAnimationService.startTranscriptAnimation(lines, () => {}, onComplete);
    DemoAnimationService.clearAllAnimations();
    vi.advanceTimersByTime(DEMO_TIMING.transcriptMs * 2);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('brings the notes and plan a short beat after the transcript', () => {
    const onComplete = vi.fn();
    DemoAnimationService.startClinicalPlanSimulation(onComplete);
    expect(DemoAnimationService.isClinicalPlanSimulating()).toBe(true);
    vi.advanceTimersByTime(DEMO_TIMING.planBeatMs - 1);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(DEMO_TIMING.planBeatMs).toBeLessThanOrEqual(1000);
  });
});
