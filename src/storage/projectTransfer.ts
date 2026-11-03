import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { CoachRecording, VoicePart, VocalProject, VOICE_PARTS } from '../types';
import { newId } from './songStore';
import { deleteProjectFiles, saveProject, writeImportedAudio } from './projectStore';

const PROJECT_FORMAT = 'vocal-coach-project';
const PROJECT_VERSION = 1;
const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_PROJECT_AUDIO_BYTES = 90 * 1024 * 1024;
const MAX_RECORDINGS = 200;

interface TransferRecording {
  id: string;
  singerName: string;
  voicePart: VoicePart;
  createdAt: number;
  duration: number;
}

interface TransferManifest {
  format: typeof PROJECT_FORMAT;
  version: typeof PROJECT_VERSION;
  title: string;
  createdAt: number;
  recordings: TransferRecording[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isVoicePart(value: unknown): value is VoicePart {
  return VOICE_PARTS.some((part) => part === value);
}

function isTransferRecording(value: unknown): value is TransferRecording {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    /^[a-z0-9]+$/i.test(value.id) &&
    typeof value.singerName === 'string' &&
    value.singerName.trim().length > 0 &&
    isVoicePart(value.voicePart) &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt) &&
    typeof value.duration === 'number' &&
    Number.isFinite(value.duration) &&
    value.duration > 0
  );
}

function isTransferManifest(value: unknown): value is TransferManifest {
  return (
    isRecord(value) &&
    value.format === PROJECT_FORMAT &&
    value.version === PROJECT_VERSION &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt) &&
    Array.isArray(value.recordings) &&
    value.recordings.length > 0 &&
    value.recordings.length <= MAX_RECORDINGS &&
    value.recordings.every(isTransferRecording)
  );
}

function safeFileName(title: string): string {
  return title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 60) || 'vocal-project';
}

export async function shareProject(project: VocalProject): Promise<void> {
  if (project.recordings.length === 0) {
    throw new Error('Add at least one coach recording before sending this project.');
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('File sharing is not available on this device.');
  }

  const archiveFiles: Record<string, Uint8Array> = {};
  const manifest: TransferManifest = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    title: project.title,
    createdAt: project.createdAt,
    recordings: project.recordings.map(({ id, singerName, voicePart, createdAt, duration }) => ({
      id,
      singerName,
      voicePart,
      createdAt,
      duration,
    })),
  };
  archiveFiles['project.json'] = strToU8(JSON.stringify(manifest));

  let totalAudioBytes = 0;
  for (const recording of project.recordings) {
    if (!/^[a-z0-9]+$/i.test(recording.id)) {
      throw new Error('A recording in this project has an invalid ID.');
    }
    const audio = new File(recording.audioPath);
    if (!audio.exists) {
      throw new Error(`The recording for ${recording.singerName} is missing from this device.`);
    }
    const bytes = await audio.bytes();
    totalAudioBytes += bytes.length;
    if (totalAudioBytes > MAX_PROJECT_AUDIO_BYTES) {
      throw new Error('This project is too large to send (maximum audio size is 90 MB).');
    }
    archiveFiles[`recordings/${recording.id}.m4a`] = bytes;
  }

  const archive = new File(Paths.cache, `${safeFileName(project.title)}.zip`);
  if (archive.exists) archive.delete();
  archive.create();
  archive.write(zipSync(archiveFiles, { level: 0 }));
  await Sharing.shareAsync(archive.uri, {
    dialogTitle: `Send ${project.title}`,
    mimeType: 'application/zip',
  });
}

export async function pickAndImportProject(): Promise<VocalProject | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const archiveFile = new File(result.assets[0].uri);
  const archiveSize = archiveFile.info().size;
  if (archiveSize && archiveSize > MAX_ARCHIVE_BYTES) {
    throw new Error('This project file is too large to import (maximum 100 MB).');
  }

  let contents: Record<string, Uint8Array>;
  try {
    contents = unzipSync(await archiveFile.bytes());
  } catch {
    throw new Error('This file is not a valid Vocal Coach project archive.');
  }

  const manifestFile = contents['project.json'];
  if (!manifestFile) throw new Error('The project archive is missing its project details.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(manifestFile));
  } catch {
    throw new Error('The project details could not be read.');
  }
  if (!isTransferManifest(parsed)) {
    throw new Error('This project file is incomplete or uses an unsupported format.');
  }

  const usedIds = new Set<string>();
  const sourceRecordings: Array<{ recording: TransferRecording; audio: Uint8Array }> = [];
  let totalAudioBytes = 0;
  for (const recording of parsed.recordings) {
    if (usedIds.has(recording.id)) throw new Error('The project contains duplicate recording entries.');
    usedIds.add(recording.id);
    const audio = contents[`recordings/${recording.id}.m4a`];
    if (!audio || audio.length === 0) {
      throw new Error(`The audio for ${recording.singerName} is missing from the project file.`);
    }
    totalAudioBytes += audio.length;
    if (totalAudioBytes > MAX_PROJECT_AUDIO_BYTES) {
      throw new Error('The project audio is too large to import (maximum 90 MB).');
    }
    sourceRecordings.push({ recording, audio });
  }

  const projectId = newId();
  const importedRecordings: CoachRecording[] = [];
  try {
    for (const { recording, audio } of sourceRecordings) {
      const id = newId();
      const audioPath = await writeImportedAudio(projectId, id, audio);
      importedRecordings.push({
        id,
        singerName: recording.singerName,
        voicePart: recording.voicePart,
        createdAt: recording.createdAt,
        duration: recording.duration,
        audioPath,
      });
    }

    const project: VocalProject = {
      id: projectId,
      title: parsed.title,
      createdAt: parsed.createdAt,
      recordings: importedRecordings,
    };
    await saveProject(project);
    return project;
  } catch (error) {
    try {
      await deleteProjectFiles(projectId);
    } catch (cleanupError) {
      console.warn('Failed to clean up an incomplete imported project', cleanupError);
    }
    throw error;
  }
}
