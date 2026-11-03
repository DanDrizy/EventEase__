import { Directory, File, Paths } from 'expo-file-system';
import { LocalProfile } from '../types';

const PROFILE_FILE = 'vocalcoach/profile.json';

function profileFile(): File {
  return new File(Paths.document, PROFILE_FILE);
}

export async function getProfile(): Promise<LocalProfile | null> {
  const file = profileFile();
  if (!file.exists) return null;
  const value: unknown = JSON.parse(await file.text());
  if (
    typeof value !== 'object' ||
    value === null ||
    !('name' in value) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    !('role' in value) ||
    (value.role !== 'coach' && value.role !== 'singer')
  ) {
    throw new Error('The saved profile is invalid. Log in again to continue.');
  }
  return { name: value.name, role: value.role };
}

export async function saveProfile(profile: LocalProfile): Promise<void> {
  new Directory(Paths.document, 'vocalcoach').create({ intermediates: true, idempotent: true });
  profileFile().write(JSON.stringify(profile));
}

export async function clearProfile(): Promise<void> {
  const file = profileFile();
  if (file.exists) file.delete();
}
