// Reading a consultation transcript as a conversation. Transcripts arrive as
// plain text in a few shapes: the seed's "Clinician (Dr. Ibarra): ..." and
// "Patient: ..." paragraphs, live transcription's "Speaker 0: ..." lines, and
// bracketed sections such as "[Physical Examination]" followed by findings.
// parseTranscript turns any of them into turns; highlightClinical marks the
// clinical terms worth a glance in each turn. Pure, so it can be tested.

export type TurnRole = 'clinician' | 'patient' | 'speaker' | 'note';

export interface TranscriptTurn {
  index: number;
  role: TurnRole;
  /** Who speaks, as the transcript names them: "Dr. Ibarra", "Patient", "Speaker 1". */
  speaker: string;
  /** What follows the name in brackets, e.g. "interpreted from Spanish". */
  aside?: string;
  text: string;
  /** Seconds from the start: given in the transcript as [mm:ss], or estimated from speech rate. */
  at: number;
  estimated: boolean;
}

const CLINICIAN = /^(dr\.?|doctor|doctora|clinician|physician|provider|resident|nurse|np|pa|m[ée]dico|attending)\b/i;
const PATIENT = /^(patient|paciente|pt)\b/i;
const SPEAKER_LINE = new RegExp(
  '^\\s*(?:\\[(\\d{1,2}):(\\d{2})\\]\\s*)?' + // optional [mm:ss]
  '(' +
    'speaker\\s*\\d+' +
    '|(?:dr\\.?|doctor|doctora)\\s+[A-ZÁÉÍÓÚÑ][\\w\'’.-]*(?:\\s+[A-ZÁÉÍÓÚÑ][\\w\'’.-]*)?' +
    '|(?:clinician|physician|provider|resident|nurse|patient|paciente|m[ée]dico|attending|interpreter)(?:\\s*\\([^)]*\\))?' +
    '|[A-ZÁÉÍÓÚÑ][\\w\'’.-]+(?:\\s+[A-ZÁÉÍÓÚÑ][\\w\'’.-]+)?\\s*\\((?:dr\\.?|doctor|clinician|patient|nurse|resident)[^)]*\\)' +
  ')\\s*:\\s*(.*)$',
  'i',
);
const SECTION_LINE = /^\s*\[([^\]]{2,60})\]\s*$/;

/** Words spoken per second, for estimating when each turn began (about 150 a minute). */
const WORDS_PER_SECOND = 2.5;
const PAUSE_BETWEEN_TURNS = 1.2;

function roleOf(label: string): TurnRole {
  const l = label.trim();
  if (/^speaker\s*\d+/i.test(l)) return 'speaker';
  if (PATIENT.test(l)) return 'patient';
  if (CLINICIAN.test(l)) return 'clinician';
  const inner = /\(([^)]*)\)/.exec(l)?.[1] ?? '';
  if (PATIENT.test(inner)) return 'patient';
  if (CLINICIAN.test(inner)) return 'clinician';
  return 'speaker';
}

/** "Clinician (Dr. Ibarra)" → Dr. Ibarra, asides kept; "Patient (interpreted...)" → Patient. */
function nameOf(label: string): { speaker: string; aside?: string } {
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(label.trim());
  if (!m) return { speaker: label.trim().replace(/\s+/g, ' ') };
  const [, outer, inner] = m;
  if (/^(dr\.?|doctor|doctora)\s/i.test(inner)) return { speaker: inner.trim() };
  return { speaker: outer.trim(), aside: inner.trim() || undefined };
}

const words = (s: string) => (s.match(/\S+/g) ?? []).length;

/** The transcript editor saves HTML; read it as lines of text. */
export function toPlainText(text: string): string {
  if (!/<(p|br|div|li)[\s>/]/i.test(text)) return text;
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function parseTranscript(input: string | null | undefined): TranscriptTurn[] {
  if (!input || !input.trim()) return [];
  const text = toPlainText(input);
  const turns: TranscriptTurn[] = [];
  let clock = 0;
  let current: TranscriptTurn | null = null;

  const push = (t: Omit<TranscriptTurn, 'index'>) => {
    current = { ...t, index: turns.length };
    turns.push(current);
  };

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const section = SECTION_LINE.exec(line);
    if (section) {
      push({ role: 'note', speaker: section[1].trim(), text: '', at: clock, estimated: true });
      continue;
    }

    const m = SPEAKER_LINE.exec(line);
    if (m && !(current && (current as TranscriptTurn).role === 'note' && !/^speaker|^(dr|doctor|patient|clinician)/i.test(m[3]))) {
      const [, mm, ss, label, rest] = m;
      const given = mm !== undefined ? Number(mm) * 60 + Number(ss) : null;
      const prev = current as TranscriptTurn | null;
      if (prev) clock = Math.max(clock, prev.at + words(prev.text) / WORDS_PER_SECOND + PAUSE_BETWEEN_TURNS);
      const at = given ?? clock;
      const { speaker, aside } = nameOf(label);
      push({ role: roleOf(label), speaker, aside, text: rest.trim(), at, estimated: given === null });
      continue;
    }

    if (current) {
      const c = current as TranscriptTurn;
      c.text = c.text ? `${c.text}${c.role === 'note' ? '\n' : ' '}${line}` : line;
    } else {
      push({ role: 'speaker', speaker: 'Transcript', text: line, at: 0, estimated: true });
    }
  }
  return turns.filter((t) => t.text || t.role === 'note');
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Highlighting. Three kinds, each drawn lightly:
//   measure  numbers with units, blood pressures, temperatures
//   term     medications and the clinical terms passed in (the encounter's
//            diagnoses and treatments)
//   flag     high-risk drugs and red-flag symptoms, and terms passed in from
//            the alerts on the chart
// ---------------------------------------------------------------------------
export type SpanKind = 'text' | 'measure' | 'term' | 'flag';
export interface Span { kind: SpanKind; text: string }

const MEDICATIONS = [
  'acetaminophen', 'paracetamol', 'ibuprofen', 'naproxen', 'aspirin', 'metformin', 'glyburide', 'glipizide', 'insulin',
  'lisinopril', 'amlodipine', 'losartan', 'atorvastatin', 'simvastatin', 'metoprolol', 'furosemide', 'hydrochlorothiazide',
  'levothyroxine', 'omeprazole', 'pantoprazole', 'sertraline', 'fluoxetine', 'amoxicillin', 'azithromycin', 'doxycycline',
  'ciprofloxacin', 'prednisone', 'hydrocodone', 'oxycodone', 'morphine', 'tramadol', 'sumatriptan', 'rizatriptan',
  'topiramate', 'propranolol', 'amitriptyline', 'docusate', 'senna', 'bisacodyl', 'polyethylene glycol', 'lactulose',
  'cytarabine', 'mercaptopurine', 'methotrexate', 'vitamin k', 'phytonadione', 'vitamin d', 'calcium',
  'citarabina', 'paracetamol', 'ibuprofeno',
];
const HIGH_RISK = [
  'warfarin', 'apixaban', 'rivaroxaban', 'dabigatran', 'heparin', 'enoxaparin', 'clopidogrel',
  'bleeding', 'nosebleed', 'bruising', 'bruises', 'hemoptysis', 'melena', 'hematochezia', 'syncope', 'fainted',
  'chest pain', 'shortness of breath', 'suicidal', 'anaphylaxis', 'sangrado', 'moretones', 'fiebre > 38',
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MEASURE = /\b\d{2,3}\/\d{2,3}\b|\b\d+(?:[.,]\d+)?\s?(?:°\s?[CF]|mg\/dL|mmol\/L|mmHg|mg|mcg|µg|g|mL|ml|L|units?|IU|bpm|\/min|%|kg|cm|lb|lbs|hours?|days?|weeks?|months?)(?![\w/])/gi;

export function highlightClinical(text: string, opts: { terms?: string[]; flags?: string[] } = {}): Span[] {
  if (!text) return [];
  type Hit = { start: number; end: number; kind: SpanKind };
  const hits: Hit[] = [];
  const add = (re: RegExp, kind: SpanKind) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      hits.push({ start: m.index, end: m.index + m[0].length, kind });
    }
  };
  const lexicon = (list: string[]) =>
    list.filter((t) => t && t.trim().length > 2).map((t) => escapeRe(t.trim().toLowerCase())).sort((a, b) => b.length - a.length);

  const flags = lexicon([...HIGH_RISK, ...(opts.flags ?? [])]);
  const terms = lexicon([...MEDICATIONS, ...(opts.terms ?? [])]);
  if (flags.length) add(new RegExp(`\\b(?:${flags.join('|')})\\b`, 'gi'), 'flag');
  if (terms.length) add(new RegExp(`\\b(?:${terms.join('|')})\\b`, 'gi'), 'term');
  add(new RegExp(MEASURE.source, 'gi'), 'measure');

  // Earlier and longer matches win; flags beat terms beat measures on a tie.
  const rank: Record<SpanKind, number> = { flag: 0, term: 1, measure: 2, text: 3 };
  hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || rank[a.kind] - rank[b.kind]);
  const spans: Span[] = [];
  let pos = 0;
  for (const h of hits) {
    if (h.start < pos) continue;
    if (h.start > pos) spans.push({ kind: 'text', text: text.slice(pos, h.start) });
    spans.push({ kind: h.kind, text: text.slice(h.start, h.end) });
    pos = h.end;
  }
  if (pos < text.length) spans.push({ kind: 'text', text: text.slice(pos) });
  return spans;
}
