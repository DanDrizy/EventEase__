export interface MIDIParseResult {
  title: string;
  tempo: number;
  timeSignature: string;
  duration: number;
  noteCount: number;
  lowNote: number;
  highNote: number;
  keyLabel: string;
}

export function midiNoteToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToNote(freq: number): string {
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  return midiToName(midi);
}

export function midiToName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[((midi % 12) + 12) % 12]}${octave}`;
}

const MODE_PATTERNS: { name: string; offsets: number[] }[] = [
  { name: 'major', offsets: [0, 2, 4, 5, 7, 9, 11] },
  { name: 'minor', offsets: [0, 2, 3, 5, 7, 8, 10] },
];

function guessKey(notes: { midi: number }[]): string {
  if (notes.length === 0) return 'Unknown';
  const pitchClasses = new Set(notes.map((n) => ((n.midi % 12) + 12) % 12));
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  let best: { score: number; label: string } = { score: -1, label: 'Unknown' };
  for (let root = 0; root < 12; root++) {
    for (const mode of MODE_PATTERNS) {
      let score = 0;
      for (const offset of mode.offsets) {
        if (pitchClasses.has((root + offset) % 12)) score++;
      }
      if (score > best.score) best = { score, label: `${names[root]} ${mode.name}` };
    }
  }
  return best.label;
}

export function parseMidi(arrayBuffer: ArrayBuffer): Promise<MIDIParseResult> {
  return import('@tonejs/midi').then(({ Midi }) => {
    const midi = new Midi(arrayBuffer);
    const midiNotes: { midi: number }[] = [];

    for (const track of midi.tracks) {
      for (const note of track.notes) midiNotes.push({ midi: note.midi });
    }

    const tempos = midi.header.tempos;
    const tempo = tempos.length > 0 ? tempos[0].bpm : 120;
    const ts = midi.header.timeSignatures;
    const timeSignature =
      ts.length > 0 && ts[0].timeSignature && ts[0].timeSignature.length >= 2
        ? `${ts[0].timeSignature[0]}/${ts[0].timeSignature[1]}`
        : '4/4';

    const low = midiNotes.reduce((min, n) => Math.min(min, n.midi), 127);
    const high = midiNotes.reduce((max, n) => Math.max(max, n.midi), 0);

    return {
      title: midi.name || 'Untitled',
      tempo,
      timeSignature,
      duration: midi.duration,
      noteCount: midiNotes.length,
      lowNote: low,
      highNote: high,
      keyLabel: guessKey(midiNotes),
    };
  });
}

export function buildNoteMap(
  arrayBuffer: ArrayBuffer,
  fallbackTitle: string
): Promise<import('../types').NoteMap> {
  return import('@tonejs/midi').then(({ Midi }) => {
    const midi = new Midi(arrayBuffer);
    const notes: import('../types').MidiNote[] = [];

    for (const track of midi.tracks) {
      for (const note of track.notes) {
        if (note.midi < 21 || note.midi > 108) continue;
        notes.push({
          midi: note.midi,
          name: note.name,
          freq: midiNoteToFreq(note.midi),
          time: note.time,
          duration: note.duration,
        });
      }
    }

    notes.sort((a, b) => a.time - b.time);

    const tempos = midi.header.tempos;
    const tempo = tempos.length > 0 ? tempos[0].bpm : 120;
    const low = notes.reduce((min, n) => Math.min(min, n.midi), 127);
    const high = notes.reduce((max, n) => Math.max(max, n.midi), 0);

    return {
      title: midi.name || fallbackTitle || 'Untitled',
      notes,
      duration: Math.max(...notes.map((n) => n.time + n.duration), midi.duration, 0),
      tempo,
      noteCount: notes.length,
      lowNote: low,
      highNote: high,
    };
  });
}