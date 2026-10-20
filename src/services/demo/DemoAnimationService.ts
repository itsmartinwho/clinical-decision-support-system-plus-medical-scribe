// Demo Animation Service - Plays the guided demo's scripted consultation.
// Every timing comes from DEMO_TIMING (demoTiming.ts).
import { DEMO_TIMING, planTranscript, prefersReducedMotion, transcriptAt } from './demoTiming';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export class DemoAnimationService {
  private static transcriptIntervalId: NodeJS.Timeout | null = null;
  private static clinicalPlanTimeoutId: NodeJS.Timeout | null = null;

  /**
   * Plays the transcript back turn by turn, each typed in fast, so the
   * conversation builds rather than appearing as a block, and the whole of it
   * is over in a few seconds (DEMO_TIMING.transcriptMs). A scripted replay: no
   * microphone, no transcription service, no keys. With reduced motion each
   * turn appears whole, at the same moment and in the same order.
   */
  static startTranscriptAnimation(
    transcriptLines: string[],
    onLineUpdate: (animatedTranscript: string) => void,
    onComplete: () => void,
    timing = DEMO_TIMING
  ): void {
    if (transcriptLines.length === 0) {
      onComplete();
      return;
    }
    this.clearTranscriptAnimation();

    const reduced = prefersReducedMotion();
    const plan = planTranscript(transcriptLines, timing);
    const began = now();
    let shown = '';

    const step = () => {
      // Read off the clock, not counted in ticks, so a throttled timer only skips frames
      const { text, done } = transcriptAt(plan, now() - began, reduced);
      if (text !== shown) {
        shown = text;
        onLineUpdate(text);
      }
      if (done) {
        this.clearTranscriptAnimation();
        onComplete();
      }
    };

    this.transcriptIntervalId = setInterval(step, timing.frameMs);
    step();
  }

  static startClinicalPlanSimulation(onComplete: () => void, timing = DEMO_TIMING): void {
    this.clearClinicalPlanSimulation();

    this.clinicalPlanTimeoutId = setTimeout(() => {
      this.clinicalPlanTimeoutId = null;
      onComplete();
    }, timing.planBeatMs);
  }

  static clearTranscriptAnimation(): void {
    if (this.transcriptIntervalId) {
      clearInterval(this.transcriptIntervalId);
      this.transcriptIntervalId = null;
    }
  }

  static clearClinicalPlanSimulation(): void {
    if (this.clinicalPlanTimeoutId) {
      clearTimeout(this.clinicalPlanTimeoutId);
      this.clinicalPlanTimeoutId = null;
    }
  }

  static clearAllAnimations(): void {
    this.clearTranscriptAnimation();
    this.clearClinicalPlanSimulation();
  }

  static isTranscriptAnimating(): boolean {
    return this.transcriptIntervalId !== null;
  }

  static isClinicalPlanSimulating(): boolean {
    return this.clinicalPlanTimeoutId !== null;
  }
}
