import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSong, addAttempt, newId } from '../storage/songStore';
import audioEngine from '../audio/audioEngine';
import { analyzeAttempt, summarize } from '../pitch/analysis';
import { freqToNote } from '../midi/midiService';
import { AttemptResult, PitchSample } from '../types';
import { colors, spacing, radius } from '../theme';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Practice'>;

type Phase = 'ready' | 'countdown' | 'recording' | 'analyzing';

export function PracticeScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Practice'>>();
  const { songId } = route.params;

  const [phase, setPhase] = useState<Phase>('ready');
  const [count, setCount] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [live, setLive] = useState<PitchSample | null>(null);
  const [song, setSong] = useState<Awaited<ReturnType<typeof getSong>>>(null);
  const playbackStopRef = useRef(false);
  const mountedRef = useRef(true);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelCountdownRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    getSong(songId).then(setSong);
    return () => {
      mountedRef.current = false;
      if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
      cancelCountdownRef.current?.();
      cancelCountdownRef.current = null;
      audioEngine.stopBacking();
      if (playbackStopRef.current === false) {
        audioEngine.stopRecording().catch(() => {});
      }
    };
  }, [songId]);

  const handleStart = async () => {
    if (!song) return;
    setPhase('countdown');
    setCount(3);
    audioEngine.stopBacking();
    for (let i = 3; i >= 0; i--) {
      if (!mountedRef.current) return;
      setCount(i);
      if (i === 0) break;
      await new Promise<void>((resolve) => {
        cancelCountdownRef.current = resolve;
        countdownTimerRef.current = setTimeout(() => {
          countdownTimerRef.current = null;
          cancelCountdownRef.current = null;
          resolve();
        }, 1000);
      });
    }
    if (!mountedRef.current) return;
    await beginRecording();
  };

  const beginRecording = async () => {
    if (!song) return;
    setLive(null);
    setElapsed(0);
    playbackStopRef.current = false;
    try {
      await audioEngine.startRecording(
        `take_${Date.now()}.m4a`,
        (samples) => {
          if (mountedRef.current) setLive(samples[samples.length - 1]);
        }
      );
      if (!mountedRef.current) {
        await audioEngine.stopRecording();
        return;
      }
      if (song.backingPath) {
        await audioEngine.playBacking(song.backingPath, song.backingOffsetMs / 1000);
      }
      if (!mountedRef.current) {
        audioEngine.stopBacking();
        await audioEngine.stopRecording();
        return;
      }
      setPhase('recording');
    } catch (e) {
      audioEngine.stopBacking();
      await audioEngine.stopRecording().catch(() => {});
      if (mountedRef.current) setPhase('ready');
      if (mountedRef.current) Alert.alert('Recording failed', (e as Error).message);
    }
  };

  useEffect(() => {
    if (phase !== 'recording') {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((s) => s + 0.1), 100);
    return () => clearInterval(t);
  }, [phase]);

  const handleStop = async () => {
    if (!song) return;
    setPhase('analyzing');
    playbackStopRef.current = true;
    audioEngine.stopBacking();
    let recorded;
    try {
      recorded = await audioEngine.stopRecording();
    } catch (e) {
      Alert.alert('Error stopping recording', (e as Error).message);
      setPhase('ready');
      return;
    }

    try {
      const results = analyzeAttempt(song.noteMap, recorded.pitchTrack);
      const summary = summarize(results);

      const attempt: AttemptResult = {
        id: newId(),
        songId: song.id,
        createdAt: Date.now(),
        recordingPath: recorded.path,
        recordingDuration: recorded.duration,
        pitchTrack: recorded.pitchTrack,
        results,
        accuracy: summary.accuracy,
        hitCount: summary.hit,
        flatCount: summary.flat,
        sharpCount: summary.sharp,
        missedCount: summary.missed,
        totalNotes: summary.total,
      };

      await addAttempt(song.id, attempt);
      if (!mountedRef.current) return;
      setPhase('ready');
      navigation.replace('Results', { songId: song.id, attemptId: attempt.id });
    } catch (e) {
      Alert.alert('Could not save practice results', (e as Error).message);
      if (mountedRef.current) setPhase('ready');
    }
  };

  if (!song) return <View style={styles.container} />;

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{song.title}</Text>

      {phase === 'ready' && (
        <View style={styles.center}>
          <View style={styles.reminder}>
            <Text style={styles.reminderTitle}>🎧 Use headphones</Text>
            <Text style={styles.reminderBody}>
              Put on headphones so the app records ONLY your voice. The backing track plays through the
              headphones while the microphone captures your singing.
            </Text>
          </View>
          <Text style={styles.readyHint}>
            When you start, a 3-second countdown plays, then the backing track begins. Sing along!
          </Text>
          <Pressable style={styles.recordBtn} onPress={handleStart}>
            <Text style={styles.recordBtnText}>● Start Recording</Text>
          </Pressable>
        </View>
      )}

      {phase === 'countdown' && (
        <View style={styles.center}>
          <Text style={styles.countdownNumber}>{count > 0 ? count : 'GO!'}</Text>
          <Text style={styles.countdownHint}>Get ready…</Text>
        </View>
      )}

      {(phase === 'recording' || phase === 'analyzing') && (
        <View style={styles.center}>
          <View style={styles.recBadge}>
            <View style={[styles.recDot, phase === 'recording' && styles.recDotActive]} />
            <Text style={styles.recText}>{phase === 'analyzing' ? 'Analyzing…' : 'REC'}</Text>
          </View>
          <Text style={styles.timer}>{fmt(elapsed)}</Text>

          {live && (
            <View style={styles.liveBox}>
              <Text style={styles.liveFreq}>
                {live.freq ? `${freqToNote(live.freq)} (${live.freq.toFixed(1)} Hz)` : '—'}
              </Text>
              <View style={styles.meterTrack}>
                <View
                  style={[
                    styles.meterFill,
                    { width: `${Math.min(live.volume * 40, 100)}%`, opacity: live.freq ? 1 : 0.4 },
                  ]}
                />
              </View>
            </View>
          )}

          {phase === 'recording' && song.noteMap.duration > 0 && (
            <Text style={styles.songLen}>Song length ≈ {fmt(song.noteMap.duration)}</Text>
          )}

          {phase === 'recording' && (
            <Pressable style={styles.stopBtn} onPress={handleStop}>
              <Text style={styles.stopBtnText}>■ Stop</Text>
            </Pressable>
          )}
        </View>
      )}

      {phase === 'analyzing' && (
        <View style={styles.center}>
          <Text style={styles.analyzingText}>Comparing your voice against the MIDI notes…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.lg, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  reminder: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignSelf: 'stretch',
  },
  reminderTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing.sm },
  reminderBody: { color: colors.textDim, fontSize: 14, lineHeight: 21 },
  readyHint: { color: colors.textDim, fontSize: 13, textAlign: 'center', marginBottom: spacing.xl, paddingHorizontal: spacing.lg, lineHeight: 19 },
  recordBtn: {
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  recordBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  countdownNumber: { color: colors.text, fontSize: 80, fontWeight: '900' },
  countdownHint: { color: colors.textDim, fontSize: 16, marginTop: spacing.md },
  recBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.textDim },
  recDotActive: { backgroundColor: colors.danger },
  recText: { color: colors.text, fontSize: 20, fontWeight: '800' },
  timer: { color: colors.text, fontSize: 64, fontWeight: '800', fontVariant: ['tabular-nums'] },
  liveBox: { marginTop: spacing.lg, alignSelf: 'stretch', paddingHorizontal: spacing.lg },
  liveFreq: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: spacing.sm },
  meterTrack: { height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: 'hidden' },
  meterFill: { height: 8, backgroundColor: colors.primary, borderRadius: 4 },
  songLen: { color: colors.textDim, fontSize: 13, marginTop: spacing.lg },
  stopBtn: {
    marginTop: spacing.xl,
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  stopBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  analyzingText: { color: colors.textDim, fontSize: 15 },
});
