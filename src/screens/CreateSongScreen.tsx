import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { parseMidi, MIDIParseResult, buildNoteMap, midiToName } from '../midi/midiService';
import { importFile, newId, saveSong } from '../storage/songStore';
import { SyncStep } from '../components/SyncStep';
import { Song } from '../types';
import { colors, spacing, radius } from '../theme';
import { RootStackParamList } from '../navigation';
import audioEngine from '../audio/audioEngine';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CreateSong'>;

interface AudioFile {
  path: string;
  ext: string;
  duration: number;
  offsetMs: number;
}

const AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
  'audio/ogg',
  'audio/m4a',
  'audio/x-m4a',
  'audio/flac',
];

async function pickDocument(type?: string[]): Promise<{ uri: string; name: string; size: number } | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: type ?? undefined,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || res.assets.length === 0) return null;
  const asset = res.assets[0];
  return { uri: asset.uri, name: asset.name ?? 'file', size: asset.size ?? 0 };
}

export function CreateSongScreen() {
  const navigation = useNavigation<Nav>();
  const songId = useMemo(() => newId(), []);

  const [title, setTitle] = useState('');
  const [midiInfo, setMidiInfo] = useState<MIDIParseResult | null>(null);
  const [midiBuffer, setMidiBuffer] = useState<ArrayBuffer | null>(null);
  const [midiPath, setMidiPath] = useState<string | null>(null);
  const [backing, setBacking] = useState<AudioFile | null>(null);
  const [coach, setCoach] = useState<AudioFile | null>(null);
  const [busy, setBusy] = useState(false);

  const midiReady = midiInfo !== null && midiPath !== null;
  const backingReady = backing !== null && backing.offsetMs >= 0;
  const coachReady = coach === null || coach.offsetMs >= 0;
  const step: 0 | 1 | 2 | 3 = !midiReady ? 0 : !backingReady ? 1 : !coachReady ? 2 : 3;

  const canContinue = title.trim().length > 0 && midiReady && backingReady && coachReady;

  const handlePickMidi = async () => {
    setBusy(true);
    try {
      const doc = await pickDocument();
      if (!doc) return;
      const lower = doc.name.toLowerCase();
      if (!lower.endsWith('.mid') && !lower.endsWith('.midi')) {
        Alert.alert('Not a MIDI file', 'Please pick a .mid or .midi file.');
        return;
      }
      const buffer = await new File(doc.uri).arrayBuffer();
      const info = await parseMidi(buffer);
      const noteMap = await buildNoteMap(buffer, info.title);
      if (info.noteCount === 0 || noteMap.notes.length === 0) {
        Alert.alert('No melody notes found', 'Choose a MIDI file with notes in the supported vocal range.');
        return;
      }
      const stored = await importFile(doc.uri, songId, 'midi', 'mid');
      setMidiBuffer(buffer);
      setMidiInfo(info);
      setMidiPath(stored);
      if (!title.trim()) setTitle(info.title || 'Untitled song');
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handlePickAudio = async (kind: 'backing' | 'coach') => {
    setBusy(true);
    try {
      const doc = await pickDocument(AUDIO_TYPES);
      if (!doc) return;
      const ext = (doc.name.split('.').pop() || 'm4a').toLowerCase();
      const stored = await importFile(doc.uri, songId, kind, ext);
      const duration = await audioEngine.probeDuration(stored);
      if (duration <= 0) {
        Alert.alert('Unreadable audio', 'This file could not be decoded. Try an MP3, M4A or WAV file.');
        return;
      }
      const entry: AudioFile = { path: stored, ext, duration, offsetMs: -1 };
      if (kind === 'backing') {
        setBacking(entry);
      } else {
        setCoach(entry);
      }
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!midiBuffer || !midiPath) return;
    setBusy(true);
    try {
      const noteMap = await buildNoteMap(midiBuffer, title.trim());
      const song: Song = {
        id: songId,
        title: title.trim(),
        createdAt: Date.now(),
        midiPath,
        noteMap,
        backingPath: backing?.path ?? null,
        backingOffsetMs: backing?.offsetMs ?? 0,
        coachPath: coach?.path ?? null,
        coachOffsetMs: coach?.offsetMs ?? 0,
        attempts: [],
      };
      await saveSong(song);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create Song</Text>

      <View style={styles.stepInfo}>
        <Text style={styles.stepInfoText}>
          Step {step + 1} of 4 — {STEP_TITLES[step]}
        </Text>
      </View>

      {/* Step 0: name + MIDI */}
      <Text style={styles.section}>1 · Song name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Amazing Grace (key of G)"
        placeholderTextColor={colors.textDim}
        value={title}
        onChangeText={setTitle}
      />

      <Text style={styles.section}>2 · MIDI melody file</Text>
      <Pressable style={[styles.pickBtn, midiReady && styles.pickBtnDone]} onPress={handlePickMidi} disabled={busy}>
        <Text style={styles.pickBtnText}>{midiPath ? '✓ MIDI loaded' : 'Pick .mid file'}</Text>
      </Pressable>
      {midiInfo && (
        <View style={styles.midiSummary}>
          <Text style={styles.midiLine}>
            {midiInfo.noteCount} notes · {Math.round(midiInfo.tempo)} BPM · {midiInfo.timeSignature}
          </Text>
          <Text style={styles.midiLine}>
            Range {midiToName(midiInfo.lowNote)} → {midiToName(midiInfo.highNote)} · Key: {midiInfo.keyLabel}
          </Text>
        </View>
      )}

      {/* Step 1: backing */}
      <Text style={styles.section}>3 · Backing track</Text>
      {backing ? (
        <SyncStep
          label={`Backing: ${backing.ext.toUpperCase()}`}
          filePath={backing.path}
          duration={backing.duration}
          onOffsetChange={(ms) => setBacking((prev) => (prev ? { ...prev, offsetMs: ms } : prev))}
        />
      ) : (
        <Pressable style={styles.pickBtn} onPress={() => handlePickAudio('backing')} disabled={busy}>
          <Text style={styles.pickBtnText}>Pick backing audio (instrumental)</Text>
        </Pressable>
      )}

      {/* Step 2: coach vocal */}
      <Text style={styles.section}>4 · Coach reference vocal (optional)</Text>
      {coach ? (
        <SyncStep
          label={`Coach voice: ${coach.ext.toUpperCase()}`}
          filePath={coach.path}
          duration={coach.duration}
          onOffsetChange={(ms) => setCoach((prev) => (prev ? { ...prev, offsetMs: ms } : prev))}
        />
      ) : (
        <Pressable style={styles.pickBtn} onPress={() => handlePickAudio('coach')} disabled={busy}>
          <Text style={styles.pickBtnText}>Pick coach vocal recording (optional)</Text>
        </Pressable>
      )}

      <Pressable
        style={[styles.saveBtn, (!canContinue || busy) && styles.btnDisabled]}
        onPress={handleSave}
        disabled={!canContinue || busy}
      >
        {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>Save Song</Text>}
      </Pressable>
    </ScrollView>
  );
}

const STEP_TITLES = ['name & melody', 'backing', 'coach voice', 'review'];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 60 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', marginBottom: spacing.sm },
  stepInfo: { marginBottom: spacing.lg },
  stepInfoText: { color: colors.textDim, fontSize: 13 },
  section: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickBtn: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  pickBtnDone: { borderColor: colors.success, backgroundColor: colors.surface },
  pickBtnText: { color: colors.text, fontWeight: '600' },
  midiSummary: { backgroundColor: colors.surfaceAlt, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm },
  midiLine: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
  saveBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  saveText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
