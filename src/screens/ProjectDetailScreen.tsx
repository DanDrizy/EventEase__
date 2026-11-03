import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { deleteRecording, getProject } from '../storage/projectStore';
import { shareProject } from '../storage/projectTransfer';
import { colors, radius, spacing } from '../theme';
import { CoachRecording, VocalProject } from '../types';
import audioEngine from '../audio/audioEngine';
import { useProfile } from '../auth/ProfileContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProjectDetail'>;

export function ProjectDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProjectDetail'>>();
  const { projectId } = route.params;
  const { profile } = useProfile();
  const isCoach = profile?.role === 'coach';
  const [project, setProject] = useState<VocalProject | null>(null);
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const activeIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    setProject(await getProject(projectId));
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(
    () => () => {
      activeIdRef.current = null;
      audioEngine.stopFile();
    },
    []
  );

  const handlePlayback = async (recording: CoachRecording) => {
    if (activeIdRef.current === recording.id) {
      activeIdRef.current = null;
      audioEngine.stopFile();
      setActiveRecordingId(null);
      return;
    }

    activeIdRef.current = recording.id;
    setActiveRecordingId(recording.id);
    try {
      await audioEngine.playFile(recording.audioPath, () => {
        if (activeIdRef.current === recording.id) {
          activeIdRef.current = null;
          setActiveRecordingId(null);
        }
      });
    } catch (error) {
      activeIdRef.current = null;
      setActiveRecordingId(null);
      Alert.alert('Could not play recording', (error as Error).message);
    }
  };

  const handleDeleteRecording = (recording: CoachRecording) => {
    Alert.alert('Delete recording', `Delete ${recording.singerName}’s recording?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (activeIdRef.current === recording.id) {
              activeIdRef.current = null;
              audioEngine.stopFile();
              setActiveRecordingId(null);
            }
            await deleteRecording(projectId, recording.id);
            await refresh();
          } catch (error) {
            Alert.alert('Could not delete recording', (error as Error).message);
          }
        },
      },
    ]);
  };

  const handleShare = async () => {
    if (!project) return;
    setBusy(true);
    try {
      await shareProject(project);
    } catch (error) {
      Alert.alert('Could not send project', (error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const recordings = project ? [...project.recordings].sort((a, b) => b.createdAt - a.createdAt) : [];

  return (
    <View style={styles.container}>
      <FlatList
        data={recordings}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>{project?.title ?? 'Project not found'}</Text>
            <Text style={styles.subtitle}>
              {project
                ? `${project.recordings.length} ${project.recordings.length === 1 ? 'coach recording' : 'coach recordings'}`
                : 'Go back and select another project.'}
            </Text>
            {project?.recordings.length ? (
              <Text style={styles.practiceHint}>Tap Practice to hear a vocal and sing along.</Text>
            ) : null}
            <Text style={styles.section}>Recordings</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            {project ? 'No recordings yet. Add a singer’s name and voice part when you record.' : ''}
          </Text>
        }
        renderItem={({ item }) => {
          const isPlaying = activeRecordingId === item.id;
          return (
            <View style={styles.card}>
              <View style={styles.recordingInfo}>
                <Text style={styles.singerName}>{item.singerName}</Text>
                <Text style={styles.voicePart}>{item.voicePart}</Text>
                <Text style={styles.duration}>{formatDuration(item.duration)}</Text>
              </View>
              <View style={styles.cardActions}>
                <Pressable style={styles.playButton} onPress={() => handlePlayback(item)}>
                  <Text style={styles.playText}>{isPlaying ? 'Stop' : 'Practice'}</Text>
                </Pressable>
                {isCoach ? (
                  <Pressable
                    accessibilityLabel={`Delete ${item.singerName} recording`}
                    hitSlop={8}
                    onPress={() => handleDeleteRecording(item)}
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      {isCoach ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.recordButton, !project && styles.disabled]}
            onPress={() => project && navigation.navigate('CoachRecording', { projectId })}
            disabled={!project}
          >
            <Text style={styles.recordText}>+ Record Vocal</Text>
          </Pressable>
          <Pressable
            style={[styles.shareButton, (!project || busy || project.recordings.length === 0) && styles.disabled]}
            onPress={handleShare}
            disabled={!project || busy || project.recordings.length === 0}
          >
            <Text style={styles.shareText}>{busy ? 'Preparing…' : 'Send Project'}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, paddingBottom: 8, flexGrow: 1 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.lg },
  practiceHint: { color: colors.textDim, fontSize: 13, marginTop: -spacing.md, marginBottom: spacing.md },
  section: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing.sm },
  empty: { color: colors.textDim, fontSize: 14, lineHeight: 21, paddingVertical: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' },
  recordingInfo: { flex: 1 },
  singerName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  voicePart: { color: colors.primaryLight, fontSize: 14, fontWeight: '600', marginTop: 3 },
  duration: { color: colors.textDim, fontSize: 12, marginTop: 3 },
  cardActions: { alignItems: 'flex-end', gap: spacing.sm, marginLeft: spacing.sm },
  playButton: { backgroundColor: colors.success, borderRadius: radius.pill, minWidth: 72, paddingVertical: spacing.xs, alignItems: 'center' },
  playText: { color: '#10241A', fontSize: 13, fontWeight: '800' },
  deleteButton: { padding: spacing.xs },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  actions: { padding: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  recordButton: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center' },
  recordText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  shareButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center' },
  shareText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
