export interface MidiNote {
  midi: number;
  name: string;
  freq: number;
  time: number;
  duration: number;
}

export interface NoteMap {
  title: string;
  notes: MidiNote[];
  duration: number;
  tempo: number;
  noteCount: number;
  lowNote: number;
  highNote: number;
}

export interface PitchSample {
  time: number;
  freq: number | null;
  confidence: number;
  volume: number;
}

export type Verdict = 'correct' | 'flat' | 'sharp' | 'missed';

export interface NoteResult {
  startTime: number;
  endTime: number;
  expectedName: string;
  expectedMidi: number;
  expectedFreq: number;
  sungFreq: number | null;
  deviationCents: number | null;
  verdict: Verdict;
  confidence: number;
}

export interface AttemptResult {
  id: string;
  songId: string;
  createdAt: number;
  recordingPath: string | null;
  recordingDuration: number;
  pitchTrack: PitchSample[];
  results: NoteResult[];
  accuracy: number;
  hitCount: number;
  flatCount: number;
  sharpCount: number;
  missedCount: number;
  totalNotes: number;
  coachComment?: string;
}

export interface Song {
  id: string;
  title: string;
  createdAt: number;
  midiPath: string;
  noteMap: NoteMap;
  backingPath?: string | null;
  backingOffsetMs: number;
  coachPath?: string | null;
  coachOffsetMs: number;
  attempts: AttemptResult[];
}

export const VOICE_PARTS = [
  'Soprano',
  'Soprano 1',
  'Soprano 2',
  'Alto',
  'Alto 1',
  'Alto 2',
  'Tenor',
  'Tenor 1',
  'Tenor 2',
  'Bass',
  'Bass 1',
  'Bass 2',
] as const;

export type VoicePart = (typeof VOICE_PARTS)[number];

export interface CoachRecording {
  id: string;
  singerName: string;
  voicePart: VoicePart;
  createdAt: number;
  duration: number;
  audioPath: string;
}

export interface VocalProject {
  id: string;
  title: string;
  createdAt: number;
  recordings: CoachRecording[];
}

export type UserRole = 'coach' | 'singer';

export interface LocalProfile {
  name: string;
  role: UserRole;
}

export interface PracticeSession {
  id: string;
  projectId: string;
  scheduledDate: string;
  note: string;
  createdAt: number;
}