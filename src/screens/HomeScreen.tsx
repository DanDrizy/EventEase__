import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../navigation';
import { useProfile } from '../auth/ProfileContext';
import { getProjects } from '../storage/projectStore';
import { getPracticeSessions } from '../storage/practiceCalendarStore';
import { colors, radius, spacing } from '../theme';
import { PracticeSession, VocalProject } from '../types';

type Nav = BottomTabNavigationProp<MainTabParamList, 'Home'>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useProfile();
  const [projects, setProjects] = useState<VocalProject[]>([]);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [nextProjects, nextSessions] = await Promise.all([getProjects(), getPracticeSessions()]);
      setProjects(nextProjects);
      setSessions(nextSessions);
    } catch (error) {
      Alert.alert('Could not load your home screen', (error as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const today = toDateKey(new Date());
  const upcomingSessions = sessions
    .filter((session) => session.scheduledDate >= today)
    .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))
    .slice(0, 3);
  const projectNames = new Map(projects.map((project) => [project.id, project.title]));
  const recordingCount = projects.reduce((total, project) => total + project.recordings.length, 0);
  const isCoach = profile?.role === 'coach';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>VOCAL COACH</Text>
      <Text style={styles.title}>Hello, {profile?.name}</Text>
      <Text style={styles.subtitle}>
        {isCoach ? 'Your coaching workspace is ready.' : 'Your coach’s recordings are ready to practice.'}
      </Text>

      <View style={styles.stats}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{projects.length}</Text>
          <Text style={styles.statLabel}>{isCoach ? 'Projects' : 'Exercises'}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{recordingCount}</Text>
          <Text style={styles.statLabel}>Vocal recordings</Text>
        </View>
      </View>

      <Pressable style={styles.primaryCard} onPress={() => navigation.navigate('Coaching')}>
        <Text style={styles.primaryIcon}>{isCoach ? '♫' : '▶'}</Text>
        <View style={styles.primaryInfo}>
          <Text style={styles.primaryTitle}>{isCoach ? 'Open coaching' : 'Practice a recording'}</Text>
          <Text style={styles.primarySubtitle}>
            {isCoach ? 'Create projects and record for each singer.' : 'Browse projects shared by your coach.'}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable style={styles.calendarCard} onPress={() => navigation.navigate('Calendar')}>
        <Text style={styles.sectionTitle}>Practice calendar</Text>
        <Text style={styles.calendarText}>
          {upcomingSessions.length > 0
            ? `${upcomingSessions.length} upcoming ${upcomingSessions.length === 1 ? 'session' : 'sessions'}`
            : 'Plan a practice session to stay on track.'}
        </Text>
        {upcomingSessions.map((session) => (
          <View key={session.id} style={styles.sessionRow}>
            <Text style={styles.sessionDate}>{formatDate(session.scheduledDate)}</Text>
            <Text style={styles.sessionProject} numberOfLines={1}>
              {projectNames.get(session.projectId) ?? 'Project removed'}
            </Text>
          </View>
        ))}
        <Text style={styles.linkText}>Open calendar  ›</Text>
      </Pressable>

      <Text style={styles.footnote}>
        Signed in on this phone as {isCoach ? 'Coach' : 'Singer'}. Account settings are in the Account tab.
      </Text>
    </ScrollView>
  );
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  eyebrow: { color: colors.primaryLight, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.text, fontSize: 30, fontWeight: '800', marginTop: spacing.sm },
  subtitle: { color: colors.textDim, fontSize: 15, lineHeight: 22, marginTop: spacing.xs, marginBottom: spacing.lg },
  stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  statNumber: { color: colors.text, fontSize: 24, fontWeight: '800' },
  statLabel: { color: colors.textDim, fontSize: 12, marginTop: spacing.xs },
  primaryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md },
  primaryIcon: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginRight: spacing.md },
  primaryInfo: { flex: 1 },
  primaryTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  primarySubtitle: { color: '#E4E0FF', fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  chevron: { color: '#FFFFFF', fontSize: 28, marginLeft: spacing.sm },
  calendarCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  calendarText: { color: colors.textDim, fontSize: 13, marginTop: spacing.xs },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, gap: spacing.md },
  sessionDate: { color: colors.primaryLight, fontSize: 13, fontWeight: '600' },
  sessionProject: { flex: 1, color: colors.text, fontSize: 13, textAlign: 'right' },
  linkText: { color: colors.primaryLight, fontSize: 13, fontWeight: '700', marginTop: spacing.md },
  footnote: { color: colors.textDim, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.xl },
});
