// Demo Animation Service - Handles all demo animations and timings
export const TRANSCRIPT_ANIMATION_INTERVAL = 110; // ms per tick
export const TRANSCRIPT_WORDS_PER_TICK = 3; // words (each with its following space) per tick
export const TRANSCRIPT_PAUSE_TICKS = 4; // ticks of silence between turns
export const CLINICAL_PLAN_SIMULATION_DELAY = 200; 

export class DemoAnimationService {
  private static transcriptIntervalId: NodeJS.Timeout | null = null;
  private static clinicalPlanTimeoutId: NodeJS.Timeout | null = null;

  /**
   * Plays the transcript back as live transcription arrives: a few words at a
   * time, a pause between turns, so the conversation builds turn by turn
   * rather than appearing as a block. A scripted replay: no microphone, no
   * transcription service, no keys.
   */
  static startTranscriptAnimation(
    transcriptLines: string[],
    onLineUpdate: (animatedTranscript: string) => void,
    onComplete: () => void
  ): void {
    if (transcriptLines.length === 0) {
      onComplete();
      return;
    }
    this.clearTranscriptAnimation();

    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let line = 0;
    let word = 0;
    let done: string[] = [];
    let pauseTicks = 0;
    const words = transcriptLines.map((l) => l.split(/(\s+)/).filter((w) => w.length));

    this.transcriptIntervalId = setInterval(() => {
      if (pauseTicks > 0) { pauseTicks--; return; }
      if (line >= words.length) {
        this.clearTranscriptAnimation();
        onComplete();
        return;
      }
      const current = words[line];
      // A whole line at once with reduced motion; otherwise a short phrase per tick.
      word = reduced ? current.length : Math.min(current.length, word + TRANSCRIPT_WORDS_PER_TICK * 2);
      const partial = current.slice(0, word).join('');
      onLineUpdate([...done, partial].join('\n'));
      if (word >= current.length) {
        done = [...done, partial];
        line++;
        word = 0;
        pauseTicks = TRANSCRIPT_PAUSE_TICKS;
      }
    }, TRANSCRIPT_ANIMATION_INTERVAL);
  }

  static startClinicalPlanSimulation(onComplete: () => void): void {
    this.clearClinicalPlanSimulation();
    
    this.clinicalPlanTimeoutId = setTimeout(() => {
      this.clinicalPlanTimeoutId = null;
      onComplete();
    }, CLINICAL_PLAN_SIMULATION_DELAY);
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