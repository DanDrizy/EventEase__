import { Directory, File, Paths } from 'expo-file-system';
import { newId } from './songStore';
import { CoachRecording, VoicePart, VocalProject, VOICE_PARTS } from '../types';
import { deleteProjectSessions } from './practiceCalendarStore';

const PROJECTS_DIRECTORY = 'vocalcoach/projects';
const PROJECT_INDEX = 'vocalcoach/projects.json';

function projectsDirectory(): Directory {
  return new Directory(Paths.document, PROJECTS_DIRECTORY);
}

function projectDirectory(projectId: string): Directory {
  return new Directory(Paths.document, `${PROJECTS_DIRECTORY}/${projectId}`);
}

function indexFile(): File {
  return new File(Paths.document, PROJECT_INDEX);
}

function ensureDirectories(): void {
  new Directory(Paths.document, 'vocalcoach').create({ idempotent: true, intermediates: true });
  projectsDirectory().create({ idempotent: true, intermediates: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVoicePart(value: unknown): value is VoicePart {
  return VOICE_PARTS.some((part) => part === value);
}

function isCoachRecording(value: unknown): value is CoachRecording {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.singerName === 'string' &&
    isVoicePart(value.voicePart) &&
    typeof value.createdAt === 'number' &&
    typeof value.duration === 'number' &&
    typeof value.audioPath === 'string'
  );
}

function isVocalProject(value: unknown): value is VocalProject {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.createdAt === 'number' &&
    Array.isArray(value.recordings) &&
    value.recordings.every(isCoachRecording)
  );
}

export async function getProjects(): Promise<VocalProject[]> {
  try {
    const file = indexFile();
    if (!file.exists) return [];
    const parsed: unknown = JSON.parse(await file.text());
    return Array.isArray(parsed) ? parsed.filter(isVocalProject) : [];
  } catch (error) {
    console.warn('Failed to read project index', error);
    return [];
  }
}

export async function getProject(projectId: string): Promise<VocalProject | null> {
  const projects = await getProjects();
  return projects.find((project) => project.id === projectId) ?? null;
}

async function writeIndex(projects: VocalProject[]): Promise<void> {
  ensureDirectories();
  indexFile().write(JSON.stringify(projects));
}

export async function saveProject(project: VocalProject): Promise<void> {
  const projects = await getProjects();
  const index = projects.findIndex((item) => item.id === project.id);
  if (index >= 0) projects[index] = project;
  else projects.push(project);
  await writeIndex(projects);
}

export async function createProject(title: string): Promise<VocalProject> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) throw new Error('Enter a project name.');

  const project: VocalProject = {
    id: newId(),
    title: trimmedTitle,
    createdAt: Date.now(),
    recordings: [],
  };
  await saveProject(project);
  return project;
}

export async function addRecording(projectId: string, recording: CoachRecording): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error('This project could not be found.');
  project.recordings.push(recording);
  await saveProject(project);
}

export async function deleteRecording(projectId: string, recordingId: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error('This project could not be found.');
  const recording = project.recordings.find((item) => item.id === recordingId);
  if (!recording) return;

  project.recordings = project.recordings.filter((item) => item.id !== recordingId);
  await saveProject(project);
  try {
    const file = new File(recording.audioPath);
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('Failed to delete recording audio', error);
  }
}

export async function deleteProjectFiles(projectId: string): Promise<void> {
  const directory = projectDirectory(projectId);
  if (directory.exists) directory.delete();
}

export async function deleteProject(projectId: string): Promise<void> {
  const projects = await getProjects();
  await writeIndex(projects.filter((project) => project.id !== projectId));
  await deleteProjectSessions(projectId);
  await deleteProjectFiles(projectId);
}

export async function moveRecordedAudioIntoProject(
  projectId: string,
  recordingId: string,
  sourceUri: string
): Promise<string> {
  ensureDirectories();
  const directory = projectDirectory(projectId);
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(directory, `${recordingId}.m4a`);
  if (destination.exists) destination.delete();
  await new File(sourceUri).move(destination);
  return destination.uri;
}

export async function writeImportedAudio(
  projectId: string,
  recordingId: string,
  contents: Uint8Array
): Promise<string> {
  ensureDirectories();
  const directory = projectDirectory(projectId);
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(directory, `${recordingId}.m4a`);
  if (destination.exists) destination.delete();
  destination.create();
  destination.write(contents);
  return destination.uri;
}
