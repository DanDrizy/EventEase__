import { NoteMap, PitchSample, NoteResult, Verdict } from '../types';

export interface AnalysisOptions {
  toleranceCents: number;
  minConfidence: number;
  minVolume: number;
  preTolerance: number;
  postTolerance: number;
}

export const DEFAULT_ANALYSIS: AnalysisOptions = {
  toleranceCents: 50,
  minConfidence: 0.55,
  minVolume: 0.003,
  preTolerance: 0.15,
  postTolerance: 0.2,
};

export function centsBetween(aFreq: number, bFreq: number): number {
  return 1200 * Math.log2(aFreq / bFreq);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function pitchLikelyVoiced(sample: PitchSample, opts: AnalysisOptions): boolean {
  return sample.freq != null && sample.confidence >= opts.minConfidence && sample.volume >= opts.minVolume;
}

export function analyzeAttempt(noteMap: NoteMap, pitchTrack: PitchSample[], opts?: Partial<AnalysisOptions>): NoteResult[] {
  const options: AnalysisOptions = { ...DEFAULT_ANALYSIS, ...opts };
  const results: NoteResult[] = [];

  for (const note of noteMap.notes) {
    const winStart = note.time - options.preTolerance;
    const winEnd = note.time + note.duration + options.postTolerance;
    const samples = pitchTrack.filter((s) => s.time >= winStart && s.time <= winEnd && pitchLikelyVoiced(s, options));

    const sungFreq = samples.length > 0 ? median(samples.map((s) => s.freq as number)) : null;
    const deviationCents = sungFreq ? centsBetween(sungFreq, note.freq) : null;

    let verdict: Verdict = 'missed';
    let confidence = 0;
    if (sungFreq != null && deviationCents != null) {
      confidence = samples.reduce((acc, s) => acc + s.confidence, 0) / samples.length;
      if (Math.abs(deviationCents) <= options.toleranceCents) {
        verdict = 'correct';
      } else if (deviationCents > 0) {
        verdict = 'sharp';
      } else {
        verdict = 'flat';
      }
    }

    results.push({
      startTime: note.time,
      endTime: note.time + note.duration,
      expectedName: note.name,
      expectedMidi: note.midi,
      expectedFreq: note.freq,
      sungFreq,
      deviationCents: deviationCents != null ? Math.round(deviationCents) : null,
      verdict,
      confidence,
    });
  }

  return results;
}

export function summarize(results: NoteResult[]) {
  const total = results.length;
  const hit = results.filter((r) => r.verdict === 'correct').length;
  const flat = results.filter((r) => r.verdict === 'flat').length;
  const sharp = results.filter((r) => r.verdict === 'sharp').length;
  const missed = results.filter((r) => r.verdict === 'missed').length;
  const mistakes = flat + sharp + missed;
  return {
    total,
    hit,
    flat,
    sharp,
    missed,
    mistakes,
    accuracy: total === 0 ? 0 : Math.round((hit / total) * 1000) / 10,
  };
}