import { Directory, File, Paths } from 'expo-file-system';
import { PracticeSession } from '../types';
import { newId } from './songStore';

const CALENDAR_FILE = 'vocalcoach/practice-sessions.json';

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function calendarFile(): File {
  return new File(Paths.document, CALENDAR_FILE);
}

function isPracticeSession(value: unknown): value is PracticeSession {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'projectId' in value &&
    typeof value.projectId === 'string' &&
    'scheduledDate' in value &&
    typeof value.scheduledDate === 'string' &&
    isDateKey(value.scheduledDate) &&
    'note' in value &&
    typeof value.note === 'string' &&
    'createdAt' in value &&
    typeof value.createdAt === 'number'
  );
}

export async function getPracticeSessions(): Promise<PracticeSession[]> {
  const file = calendarFile();
  if (!file.exists) return [];
  const parsed: unknown = JSON.parse(await file.text());
  if (!Array.isArray(parsed)) throw new Error('The practice calendar data is invalid.');
  return parsed.filter(isPracticeSession);
}

async function saveSessions(sessions: PracticeSession[]): Promise<void> {
  new Directory(Paths.document, 'vocalcoach').create({ intermediates: true, idempotent: true });
  calendarFile().write(JSON.stringify(sessions));
}

export async function addPracticeSession(
  projectId: string,
  scheduledDate: string,
  note: string
): Promise<PracticeSession> {
  if (!isDateKey(scheduledDate)) {
    throw new Error('Choose a valid practice date.');
  }
  const session: PracticeSession = {
    id: newId(),
    projectId,
    scheduledDate,
    note: note.trim(),
    createdAt: Date.now(),
  };
  await saveSessions([...(await getPracticeSessions()), session]);
  return session;
}

export async function deletePracticeSession(sessionId: string): Promise<void> {
  const sessions = await getPracticeSessions();
  await saveSessions(sessions.filter((session) => session.id !== sessionId));
}

export async function deleteProjectSessions(projectId: string): Promise<void> {
  const sessions = await getPracticeSessions();
  await saveSessions(sessions.filter((session) => session.projectId !== projectId));
}
