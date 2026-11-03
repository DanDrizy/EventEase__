import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { File } from 'expo-file-system';
import { RootStackParamList } from '../navigation';
import { addRecording, getProject, moveRecordedAudioIntoProject } from '../storage/projectStore';
import { newId } from '../storage/songStore';
import { colors, radius, spacing } from '../theme';
import { VoicePart, VOICE_PARTS, VocalProject } from '../types';
import audioEngine from '../audio/audioEngine';
import { useProfile } from '../auth/ProfileContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CoachRecording'>;
type Phase = 'ready' | 'starting' | 'recording' | 'saving';

export function CoachRecordingScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'CoachRecording'>>();
  const { projectId } = route.params;
  const { profile } = useProfile();
  const [project, setProject] = useState<VocalProject | null>(null);
  const [singerName, setSingerName] = useState('');
  const [voicePart, setVoicePart] = useState<VoicePart | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [elapsed, setElapsed] = useState(0);
  const recordingRef = useRef(false);
  const recordingIdRef = useRef('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    getProject(projectId)
      .then((result) => {
        if (mountedRef.current) setProject(result);
      })
      .catch((error) => {
        if (mountedRef.current) Alert.alert('Could not open project', (error as Error).message);
      });
    return () => {
      mountedRef.current = false;
      if (recordingRef.current) {
        recordingRef.current = false;
        audioEngine.stopRecording().then((recorded) => {
          if (recorded.path) {
            const file = new File(recorded.path);
            if (file.exists) file.delete();
          }
        }).catch((error) => console.warn('Could not stop unfinished coach recording', error));
      }
    };
  }, [projectId]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const handleStart = async () => {
    if (profile?.role !== 'coach') {
      Alert.alert('Coach access only', 'Only a Coach profile can record vocals.');
      return;
    }
    if (!singerName.trim() || !voicePart) {
      Alert.alert('Recording details required', 'Enter the singer’s name and choose a voice part first.');
      return;
    }
    setPhase('starting');
    recordingIdRef.current = newId();
    try {
      await audioEngine.startRecording(`coach_${recordingIdRef.current}.m4a`, undefined, false);
      if (!mountedRef.current) {
        const recorded = await audioEngine.stopRecording();
        if (recorded.path) {
          const file = new File(recorded.path);
          if (file.exists) file.delete();
        }
        return;
      }
      recordingRef.current = true;
      setElapsed(0);
      setPhase('recording');
    } catch (error) {
      recordingRef.current = false;
      await audioEngine.stopRecording().catch((stopError) => {
        console.warn('Could not clean up failed coach recording', stopError);
      });
      if (mountedRef.current) {
        setPhase('ready');
        Alert.alert('Could not start recording', (error as Error).message);
      }
    }
  };

  if (profile?.role !== 'coach') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Coach access only</Text>
        <Text style={styles.hint}>Log in as a Coach to record vocals.</Text>
      </View>
    );
  }

  const handleStop = async () => {
    const selectedVoicePart = voicePart;
    setPhase('saving');
    recordingRef.current = false;
    let savedAudioPath: string | null = null;
    try {
      const recorded = await audioEngine.stopRecording();
      if (!recorded.path || recorded.duration <= 0) {
        throw new Error('No audio was saved. Please try recording again.');
      }
      if (!project) throw new Error('This project could not be found.');
      if (!selectedVoicePart) throw new Error('Choose a voice part before recording.');

      const id = recordingIdRef.current;
      savedAudioPath = await moveRecordedAudioIntoProject(project.id, id, recorded.path);
      await addRecording(project.id, {
        id,
        singerName: singerName.trim(),
        voicePart: selectedVoicePart,
        createdAt: Date.now(),
        duration: recorded.duration,
        audioPath: savedAudioPath,
      });
      navigation.goBack();
    } catch (error) {
      if (savedAudioPath) {
        const file = new File(savedAudioPath);
        if (file.exists) file.delete();
      }
      setPhase('ready');
      Alert.alert('Could not save recording', (error as Error).message);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Record a coach vocal</Text>
      <Text style={styles.projectName}>{project?.title ?? 'Loading project…'}</Text>

      <Text style={styles.label}>Singer name</Text>
      <TextInput
        style={styles.input}
        value={singerName}
        onChangeText={setSingerName}
        placeholder="Name this recording"
        placeholderTextColor={colors.textDim}
        editable={phase === 'ready'}
        maxLength={80}
      />

      <Text style={styles.label}>Voice part</Text>
      <View style={styles.parts}>
        {VOICE_PARTS.map((part) => (
          <Pressable
            key={part}
            disabled={phase !== 'ready'}
            onPress={() => setVoicePart(part)}
            style={[styles.part, voicePart === part && styles.partSelected, phase !== 'ready' && styles.disabled]}
          >
            <Text style={[styles.partText, voicePart === part && styles.partTextSelected]}>{part}</Text>
          </Pressable>
        ))}
      </View>

      {phase === 'recording' ? (
        <View style={styles.recordingStatus}>
          <View style={styles.recordingIndicator} />
          <Text style={styles.timer}>Recording · {formatTime(elapsed)}</Text>
        </View>
      ) : (
        <Text style={styles.hint}>Record the coach vocal that this singer will practice with.</Text>
      )}

      {phase === 'recording' ? (
        <Pressable style={styles.stopButton} onPress={handleStop}>
          <Text style={styles.buttonText}>Stop and Save</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.startButton, (phase !== 'ready' || !project) && styles.disabled]}
          onPress={handleStart}
          disabled={phase !== 'ready' || !project}
        >
          <Text style={styles.buttonText}>
            {phase === 'starting' ? 'Starting…' : phase === 'saving' ? 'Saving…' : 'Start Recording'}
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  projectName: { color: colors.textDim, fontSize: 14, marginTop: spacing.xs },
  label: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.sm, padding: spacing.md, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  parts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  part: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  partSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  partText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  partTextSelected: { color: '#FFFFFF' },
  hint: { color: colors.textDim, fontSize: 14, lineHeight: 21, marginTop: spacing.xl },
  recordingStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl, gap: spacing.sm },
  recordingIndicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  timer: { color: colors.text, fontSize: 20, fontWeight: '700' },
  startButton: { backgroundColor: colors.danger, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xl },
  stopButton: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xl },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
