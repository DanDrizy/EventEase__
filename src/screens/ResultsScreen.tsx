import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSong, updateAttemptComment } from '../storage/songStore';
import audioEngine from '../audio/audioEngine';
import { PianoRoll } from '../components/PianoRoll';
import { colors, spacing, radius, verdictColors } from '../theme';
import { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Results'>;

const COACH_PAD = 0.4;

export function ResultsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'Results'>>();
  const { songId, attemptId } = route.params;

  const [song, setSong] = useState<Awaited<ReturnType<typeof getSong>>>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const [comment, setComment] = useState('');
  const [playingRecording, setPlayingRecording] = useState(false);
  const [playingCoach, setPlayingCoach] = useState(false);
  const didLoad = useRef(false);

  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    getSong(songId).then((s) => {
      setSong(s);
      const attempt = s?.attempts.find((a) => a.id === attemptId);
      setComment(attempt?.coachComment ?? '');
    });
    return () => {
      audioEngine.stopSegment();
      audioEngine.stopBacking();
    };
  }, [songId, attemptId]);

  if (!song) return <View style={styles.container} />;

  const attempt = song.attempts.find((a) => a.id === attemptId);
  if (!attempt) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>Attempt not found.</Text>
      </View>
    );
  }

  if (attempt.results.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>This attempt has no note results. Try practicing again.</Text>
      </View>
    );
  }

  const selected = attempt.results[Math.max(0, selectedIndex ?? 0)];

  const handleSelect = (index: number) => setSelectedIndex(index);

  const playCoachSegment = async () => {
    if (!song.coachPath || !selected) return;
    const start = selected.startTime + song.coachOffsetMs / 1000;
    const duration = selected.endTime - selected.startTime + COACH_PAD;
    try {
      setPlayingCoach(true);
      await audioEngine.playSegment(song.coachPath, start, duration);
      setTimeout(() => setPlayingCoach(false), duration * 1000 + 400);
    } catch (e) {
      setPlayingCoach(false);
      Alert.alert('Playback error', (e as Error).message);
    }
  };

  const playMyRecording = async () => {
    if (!attempt.recordingPath) return;
    try {
      setPlayingRecording(true);
      await audioEngine.playFile(attempt.recordingPath);
      setTimeout(() => setPlayingRecording(false), attempt.recordingDuration * 1000 + 400);
    } catch (e) {
      setPlayingRecording(false);
      Alert.alert('Playback error', (e as Error).message);
    }
  };

  const saveComment = async () => {
    await updateAttemptComment(songId, attemptId, comment.trim());
    const s = await getSong(songId);
    setSong(s);
  };

  const retry = () => {
    audioEngine.stopSegment();
    navigation.navigate('Practice', { songId });
  };

  const verdictLabel = selected.verdict === 'flat' ? 'Too low' : selected.verdict === 'sharp' ? 'Too high' : selected.verdict === 'missed' ? 'Note missed' : 'In tune';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>{song.title}</Text>
          <Text style={styles.date}>{new Date(attempt.createdAt).toLocaleString()}</Text>
        </View>

        <View style={styles.scoreCard}>
          <Text style={[styles.score, { color: attempt.accuracy >= 85 ? colors.success : attempt.accuracy >= 60 ? colors.warning : colors.danger }]}>
            {attempt.accuracy}%
          </Text>
          <Text style={styles.scoreLabel}>Overall accuracy</Text>
          <View style={styles.legendRow}>
            <Legend color={verdictColors.correct} label={`${attempt.hitCount} hit`} />
            <Legend color={verdictColors.flat} label={`${attempt.flatCount} flat`} />
            <Legend color={verdictColors.sharp} label={`${attempt.sharpCount} sharp`} />
            <Legend color={verdictColors.missed} label={`${attempt.missedCount} missed`} />
          </View>
        </View>

        <Text style={styles.section}>Your performance vs the melody</Text>
        <PianoRoll song={song} results={attempt.results} selectedIndex={selectedIndex} onSelect={handleSelect} />

        {selected && (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>
              Note {selected.expectedName}
              {selected.sungFreq ? ` vs ${freqToNoteName(selected.sungFreq)}` : ''}
            </Text>
            <Text style={[styles.detailVerdict, { color: verdictColors[selected.verdict] }]}>{verdictLabel}</Text>
            <Text style={styles.detailLine}>
              Expected: {selected.expectedName} ({selected.expectedFreq.toFixed(1)} Hz)
              {selected.sungFreq ? ` · You sang: ${selected.sungFreq.toFixed(1)} Hz` : ' · No voice detected here'}
            </Text>
            {selected.deviationCents != null && selected.verdict !== 'correct' && (
              <Text style={styles.detailLine}>
                Deviation: {selected.deviationCents > 0 ? '+' : ''}
                {selected.deviationCents} cents {selected.deviationCents > 0 ? '(sharp — sing lower)' : '(flat — sing higher)'}
              </Text>
            )}
            {song.coachPath && (
              <Pressable style={styles.coachBtn} onPress={playCoachSegment} disabled={playingCoach}>
                <Text style={styles.coachBtnText}>
                  {playingCoach ? 'Playing…' : `▶ Hear how Coach sings this (${selected.startTime.toFixed(1)}s)`}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.actionRow}>
          <Pressable style={[styles.actionBtn, styles.actionSecondary]} onPress={playMyRecording} disabled={!attempt.recordingPath || playingRecording}>
            <Text style={styles.actionSecondaryText}>{playingRecording ? 'Playing…' : '▶ My Recording'}</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.actionPrimary]} onPress={retry}>
            <Text style={styles.actionPrimaryText}>↻ Try Again</Text>
          </Pressable>
        </View>

        <Text style={styles.section}>Coach's note</Text>
        <TextInput
          style={[styles.input, styles.coachInput]}
          placeholder="Leave feedback for this attempt…"
          placeholderTextColor={colors.textDim}
          value={comment}
          onChangeText={setComment}
          multiline
        />
        <Text style={[styles.detailVerdict, { color: verdictColors.correct }]}>
          {attempt.coachComment ? 'Saved ✓' : ' '}
        </Text>
        <Pressable style={styles.coachNoteBtn} onPress={saveComment}>
          <Text style={styles.coachNoteBtnText}>Save note</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function freqToNoteName(freq: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  const octave = Math.floor(midi / 12) - 1;
  return `${names[((midi % 12) + 12) % 12]}${octave}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.md, paddingBottom: 60 },
  notFound: { color: colors.textDim, padding: spacing.lg },
  header: { marginBottom: spacing.md },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  date: { color: colors.textDim, fontSize: 13, marginTop: spacing.xs },
  scoreCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
  score: { fontSize: 48, fontWeight: '900', fontVariant: ['tabular-nums'] },
  scoreLabel: { color: colors.textDim, fontSize: 13, marginBottom: spacing.sm },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: colors.textDim, fontSize: 12 },
  section: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm, marginTop: spacing.xs },
  detailCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  detailTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  detailVerdict: { fontSize: 15, fontWeight: '700', marginTop: spacing.xs },
  detailLine: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 2 },
  coachBtn: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: spacing.sm, alignItems: 'center' },
  coachBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.sm, alignItems: 'center' },
  actionSecondary: { backgroundColor: colors.surfaceAlt },
  actionPrimary: { backgroundColor: colors.success },
  actionSecondaryText: { color: colors.text, fontWeight: '700' },
  actionPrimaryText: { color: '#10241A', fontWeight: '800' },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coachInput: { minHeight: 90, textAlignVertical: 'top', marginTop: spacing.sm },
  coachNoteBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.info,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  coachNoteBtnText: { color: '#FFF', fontWeight: '700' },
});
