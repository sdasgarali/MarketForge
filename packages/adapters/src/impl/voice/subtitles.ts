/**
 * Convert ElevenLabs character-level alignment into an SRT subtitle string.
 * The `with-timestamps` endpoint returns per-character start/end times; we
 * group characters into word/segment cues so the output is human-usable SRT.
 * Pure + dependency-free (unit-testable without network).
 */

export interface ElevenAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

/** One subtitle cue. */
export interface SubtitleCue {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

/**
 * Group aligned characters into cues, breaking on sentence punctuation or when a
 * cue exceeds `maxCharsPerCue`. Returns structured cues.
 */
export function alignmentToCues(a: ElevenAlignment, maxCharsPerCue = 80): SubtitleCue[] {
  const { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } = a;
  const cues: SubtitleCue[] = [];
  let buf = '';
  let cueStart: number | null = null;
  let index = 1;

  const flush = (endSec: number): void => {
    const text = buf.trim();
    if (text && cueStart !== null) {
      cues.push({
        index: index++,
        startMs: Math.round(cueStart * 1000),
        endMs: Math.round(endSec * 1000),
        text,
      });
    }
    buf = '';
    cueStart = null;
  };

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i] ?? '';
    const start = starts[i] ?? 0;
    const end = ends[i] ?? start;
    if (cueStart === null) cueStart = start;
    buf += ch;
    const isBreak = /[.!?\n]/.test(ch);
    if (isBreak || buf.length >= maxCharsPerCue) flush(end);
  }
  // Trailing text.
  if (buf.trim()) flush(ends.length ? (ends[ends.length - 1] ?? 0) : 0);
  return cues;
}

function fmtTimestamp(ms: number): string {
  const clamped = Math.max(0, ms);
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1000);
  const millis = clamped % 1000;
  const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(millis, 3)}`;
}

/** Render cues as an SRT document. */
export function cuesToSrt(cues: SubtitleCue[]): string {
  return cues
    .map((c) => `${c.index}\n${fmtTimestamp(c.startMs)} --> ${fmtTimestamp(c.endMs)}\n${c.text}`)
    .join('\n\n');
}

/** Convenience: alignment → SRT string. */
export function alignmentToSrt(a: ElevenAlignment, maxCharsPerCue = 80): string {
  return cuesToSrt(alignmentToCues(a, maxCharsPerCue));
}
