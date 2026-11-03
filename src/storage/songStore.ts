import { Directory, File, Paths } from 'expo-file-system';
import { AttemptResult, Song } from '../types';

const APP_DIR = 'vocalcoach';
const SONGS_DIR = 'vocalcoach/songs';
const INDEX_FILE = 'vocalcoach/songs.json';

function appDirectory(): Directory {
  return new Directory(Paths.document, APP_DIR);
}

function songsDirectory(): Directory {
  return new Directory(Paths.document, SONGS_DIR);
}

function indexFile(): File {
  return new File(Paths.document, INDEX_FILE);
}

function ensureDirs(): void {
  appDirectory().create({ idempotent: true, intermediates: true });
  songsDirectory().create({ idempotent: true, intermediates: true });
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
}

export async function getSongs(): Promise<Song[]> {
  try {
    const file = indexFile();
    if (!file.exists) return [];
    const raw = await file.text();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Song[]) : [];
  } catch (e) {
    console.warn('Failed to read song index', e);
    return [];
  }
}

export async function getSong(id: string): Promise<Song | null> {
  const songs = await getSongs();
  return songs.find((s) => s.id === id) ?? null;
}

async function writeIndex(songs: Song[]): Promise<void> {
  ensureDirs();
  indexFile().write(JSON.stringify(songs));
}

export async function saveSong(song: Song): Promise<void> {
  const songs = await getSongs();
  const idx = songs.findIndex((s) => s.id === song.id);
  if (idx >= 0) songs[idx] = song;
  else songs.push(song);
  await writeIndex(songs);
}

export async function deleteSong(id: string): Promise<void> {
  const songs = await getSongs();
  const next = songs.filter((s) => s.id !== id);
  await writeIndex(next);
  try {
    new Directory(Paths.document, `${SONGS_DIR}/${id}`).delete();
  } catch (e) {
    console.warn('Failed to delete song dir', e);
  }
}

/** Copies a picked document into the app's song folder and returns the stored path. */
export async function importFile(uri: string, songId: string, kind: string, ext: string): Promise<string> {
  ensureDirs();
  const dir = new Directory(Paths.document, `${SONGS_DIR}/${songId}`);
  dir.create({ idempotent: true, intermediates: true });
  const fileName = `${kind}.${ext.replace(/^\./, '')}`;
  const source = new File(uri);
  const destination = new File(dir, fileName);
  if (destination.exists) destination.delete();
  source.copy(destination);
  return destination.uri;
}

export async function addAttempt(songId: string, attempt: AttemptResult): Promise<void> {
  const song = await getSong(songId);
  if (!song) return;
  song.attempts.push(attempt);
  await saveSong(song);
}

export async function updateAttemptComment(songId: string, attemptId: string, comment: string): Promise<void> {
  const song = await getSong(songId);
  if (!song) return;
  const attempt = song.attempts.find((a) => a.id === attemptId);
  if (attempt) {
    attempt.coachComment = comment;
    await saveSong(song);
  }
}