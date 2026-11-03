import { createContext, useContext } from 'react';
import { LocalProfile } from '../types';

export interface ProfileContextValue {
  profile: LocalProfile | null;
  setProfile: (profile: LocalProfile | null) => Promise<void>;
}

export const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfile(): ProfileContextValue {
  const value = useContext(ProfileContext);
  if (!value) throw new Error('Profile context is not available.');
  return value;
}
