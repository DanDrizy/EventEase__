import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useProfile } from '../auth/ProfileContext';
import { MainTabParamList, RootStackParamList } from '../navigation';
import { deleteProject, getProjects } from '../storage/projectStore';
import { pickAndImportProject } from '../storage/projectTransfer';
import { colors, radius, spacing } from '../theme';
import { VocalProject } from '../types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Coaching'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function CoachingScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useProfile();
  const [projects, setProjects] = useState<VocalProject[]>([]);
  const [busy, setBusy] = useState(false);
  const isCoach = profile?.role === 'coach';

  const refresh = useCallback(async () => {
    try {
      setProjects(await getProjects());
    } catch (error) {
      Alert.alert('Could not load projects', (error as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const handleImport = async () => {
    setBusy(true);
    try {
      const project = await pickAndImportProject();
      if (project) {
        await refresh();
        Alert.alert('Project imported', `"${project.title}" is ready to practice.`);
      }
    } catch (error) {
      Alert.alert('Could not import project', (error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (project: VocalProject) => {
    Alert.alert('Delete project', `Delete "${project.title}" and its recordings from this phone?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProject(project.id);
            await refresh();
          } catch (error) {
            Alert.alert('Could not delete project', (error as Error).message);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isCoach ? 'Coaching' : 'Coach’s recordings'}</Text>
      <Text style={styles.subtitle}>
        {isCoach
          ? 'Create a project, record a vocal for each singer, and send the finished project.'
          : 'Open an exercise to listen to your coach and sing along.'}
      </Text>

      <View style={styles.actions}>
        {isCoach ? (
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('CreateProject')}>
            <Text style={styles.primaryText}>+ New Project</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.primaryButton} onPress={handleImport} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? 'Opening…' : 'Import Coach Project'}</Text>
          </Pressable>
        )}
      </View>

      {projects.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{isCoach ? 'No projects yet' : 'No coach projects yet'}</Text>
          <Text style={styles.emptyText}>
            {isCoach
              ? 'Create a project to start adding coach recordings.'
              : 'Ask your coach to send a project, then import it here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(project) => project.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableHighlight
              underlayColor={colors.surfaceAlt}
              onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })}
              style={styles.card}
            >
              <View style={styles.cardRow}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSubtitle}>
                    {item.recordings.length} {item.recordings.length === 1 ? 'recording' : 'recordings'}
                  </Text>
                </View>
                <Pressable hitSlop={8} onPress={() => handleDelete(item)} style={styles.deleteButton}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </TouchableHighlight>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.xl },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', paddingHorizontal: spacing.md },
  subtitle: { color: colors.textDim, fontSize: 14, lineHeight: 20, paddingHorizontal: spacing.md, marginTop: spacing.xs },
  actions: { padding: spacing.md, paddingBottom: spacing.sm },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.pill, alignItems: 'center', paddingVertical: spacing.md },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.sm },
  emptyText: { color: colors.textDim, textAlign: 'center', fontSize: 14, lineHeight: 21 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.sm, padding: spacing.md },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  cardSubtitle: { color: colors.textDim, fontSize: 13, marginTop: spacing.xs },
  deleteButton: { marginLeft: spacing.sm, padding: spacing.xs },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: '600' },
});
