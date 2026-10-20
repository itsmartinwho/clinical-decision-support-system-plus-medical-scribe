import { describe, expect, it } from 'vitest';
import { formatClock, highlightClinical, parseTranscript } from '@/lib/transcript';

describe('parseTranscript', () => {
  it('reads the seed transcripts: named clinicians, patients with asides, paragraphs', () => {
    const turns = parseTranscript(
      'Clinician (Dr. Ibarra): Buenas tardes, Dorothy.\n\nPatient (interpretado del español): Desde hace tres días.\nTomo paracetamol.\n\nClinician (Dr. Ibarra): Entiendo.',
    );
    expect(turns.map((t) => [t.role, t.speaker])).toEqual([
      ['clinician', 'Dr. Ibarra'],
      ['patient', 'Patient'],
      ['clinician', 'Dr. Ibarra'],
    ]);
    expect(turns[1].aside).toBe('interpretado del español');
    expect(turns[1].text).toBe('Desde hace tres días. Tomo paracetamol.');
    expect(turns[1].at).toBeGreaterThan(0);
    expect(turns[2].at).toBeGreaterThan(turns[1].at);
  });

  it('reads live transcription and keeps bracketed sections as notes', () => {
    const turns = parseTranscript('Speaker 0: How are you?\nSpeaker 1: Dizzy.\n[Physical Examination]\nGeneral: Alert\nHEENT: Dry mucous membranes\nDr. Chen: We need labs.');
    expect(turns.map((t) => t.role)).toEqual(['speaker', 'speaker', 'note', 'clinician']);
    expect(turns[2].speaker).toBe('Physical Examination');
    expect(turns[2].text).toBe('General: Alert\nHEENT: Dry mucous membranes');
  });

  it('reads the HTML the transcript editor saves', () => {
    const turns = parseTranscript('<p>Speaker 0: Any allergies?</p><p>Speaker 1: Penicillin &amp; latex.</p>');
    expect(turns.map((t) => t.text)).toEqual(['Any allergies?', 'Penicillin & latex.']);
  });

  it('uses timestamps the transcript gives', () => {
    const turns = parseTranscript('[01:05] Patient: Since Monday.');
    expect(turns[0]).toMatchObject({ at: 65, estimated: false });
    expect(formatClock(65)).toBe('01:05');
  });
});

describe('highlightClinical', () => {
  it('marks measurements, medications and red flags without overlapping', () => {
    const spans = highlightClinical('BP 95/60, on warfarin and metformin 1000mg, nosebleed yesterday', { terms: ['INR'] });
    const marked = spans.filter((s) => s.kind !== 'text').map((s) => [s.kind, s.text]);
    expect(marked).toEqual([
      ['measure', '95/60'],
      ['flag', 'warfarin'],
      ['term', 'metformin'],
      ['measure', '1000mg'],
      ['flag', 'nosebleed'],
    ]);
    expect(spans.map((s) => s.text).join('')).toBe('BP 95/60, on warfarin and metformin 1000mg, nosebleed yesterday');
  });
});
