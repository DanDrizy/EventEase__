import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { deletePracticeSession, addPracticeSession, getPracticeSessions } from '../storage/practiceCalendarStore';
import { getProjects } from '../storage/projectStore';
import { colors, radius, spacing } from '../theme';
import { PracticeSession, VocalProject } from '../types';
import { toDateKey } from './HomeScreen';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarScreen() {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const [projects, setProjects] = useState<VocalProject[]>([]);
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [note, setNote] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [nextProjects, nextSessions] = await Promise.all([getProjects(), getPracticeSessions()]);
      setProjects(nextProjects);
      setSessions(nextSessions);
      setSelectedProjectId((current) =>
        nextProjects.some((project) => project.id === current) ? current : (nextProjects[0]?.id ?? '')
      );
    } catch (error) {
      Alert.alert('Could not load calendar', (error as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const calendarDays = useMemo(() => {
    const firstWeekday = month.getDay();
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(month.getFullYear(), month.getMonth(), index - firstWeekday + 1);
      return { date, key: toDateKey(date), inMonth: date.getMonth() === month.getMonth() };
    });
  }, [month]);

  const sessionDates = useMemo(() => new Set(sessions.map((session) => session.scheduledDate)), [sessions]);
  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.title])), [projects]);
  const selectedSessions = sessions
    .filter((session) => session.scheduledDate === selectedDate)
    .sort((a, b) => a.createdAt - b.createdAt);

  const shiftMonth = (amount: number) => {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  };

  const chooseDay = (day: (typeof calendarDays)[number]) => {
    setSelectedDate(day.key);
    if (!day.inMonth) setMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1));
  };

  const handleAddSession = async () => {
    if (!selectedProjectId) {
      Alert.alert('No project selected', 'Import a coach project or create one before scheduling practice.');
      return;
    }
    try {
      const session = await addPracticeSession(selectedProjectId, selectedDate, note);
      setSessions((current) => [...current, session]);
      setNote('');
    } catch (error) {
      Alert.alert('Could not schedule practice', (error as Error).message);
    }
  };

  const handleDeleteSession = (session: PracticeSession) => {
    Alert.alert('Remove practice session', 'Remove this scheduled practice?', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePracticeSession(session.id);
            setSessions((current) => current.filter((item) => item.id !== session.id));
          } catch (error) {
            Alert.alert('Could not remove session', (error as Error).message);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Practice Calendar</Text>
      <Text style={styles.subtitle}>Choose a day to plan a practice session.</Text>

      <View style={styles.calendar}>
        <View style={styles.monthHeader}>
          <Pressable accessibilityLabel="Previous month" onPress={() => shiftMonth(-1)} style={styles.monthArrow}>
            <Text style={styles.arrowText}>‹</Text>
          </Pressable>
          <Text style={styles.monthTitle}>
            {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </Text>
          <Pressable accessibilityLabel="Next month" onPress={() => shiftMonth(1)} style={styles.monthArrow}>
            <Text style={styles.arrowText}>›</Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          {WEEKDAYS.map((day, index) => (
            <View key={`${day}-${index}`} style={styles.dayCell}>
              <Text style={styles.weekday}>{day}</Text>
            </View>
          ))}
          {calendarDays.map((day) => {
            const selected = day.key === selectedDate;
            const today = day.key === toDateKey(new Date());
            return (
              <Pressable
                key={day.key}
                accessibilityRole="button"
                accessibilityLabel={`${day.date.toLocaleDateString()}${sessionDates.has(day.key) ? ', practice planned' : ''}`}
                onPress={() => chooseDay(day)}
                style={styles.dayCell}
              >
                <View style={[styles.dayNumber, selected && styles.daySelected, today && !selected && styles.dayToday]}>
                  <Text style={[styles.dayText, !day.inMonth && styles.outsideMonth, selected && styles.selectedText]}>
                    {day.date.getDate()}
                  </Text>
                </View>
                <View style={[styles.dayDot, sessionDates.has(day.key) && styles.dayHasSession]} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{formatSelectedDate(selectedDate)}</Text>
        {selectedSessions.length === 0 ? (
          <Text style={styles.emptyText}>Nothing planned for this day.</Text>
        ) : (
          selectedSessions.map((session) => (
            <View key={session.id} style={styles.sessionCard}>
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionProject}>{projectNames.get(session.projectId) ?? 'Project removed'}</Text>
                {session.note ? <Text style={styles.sessionNote}>{session.note}</Text> : null}
              </View>
              <Pressable hitSlop={8} onPress={() => handleDeleteSession(session)}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Schedule practice</Text>
        {projects.length === 0 ? (
          <Text style={styles.emptyText}>Add a project from the Coaching tab first.</Text>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectChoices}>
              {projects.map((project) => {
                const chosen = project.id === selectedProjectId;
                return (
                  <Pressable
                    key={project.id}
                    onPress={() => setSelectedProjectId(project.id)}
                    style={[styles.projectChip, chosen && styles.projectChipSelected]}
                  >
                    <Text style={[styles.projectChipText, chosen && styles.projectChipTextSelected]} numberOfLines={1}>
                      {project.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Optional note"
              placeholderTextColor={colors.textDim}
              maxLength={100}
              style={styles.input}
            />
            <Pressable style={styles.addButton} onPress={() => void handleAddSession()}>
              <Text style={styles.addButtonText}>Add Practice Session</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function formatSelectedDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.md },
  calendar: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.sm },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, marginBottom: spacing.xs },
  monthArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  arrowText: { color: colors.text, fontSize: 28, lineHeight: 32 },
  monthTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
  weekday: { color: colors.textDim, fontSize: 12, fontWeight: '700' },
  dayNumber: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  daySelected: { backgroundColor: colors.primary },
  dayToday: { borderWidth: 1, borderColor: colors.primaryLight },
  dayText: { color: colors.text, fontSize: 13 },
  selectedText: { color: '#FFFFFF', fontWeight: '800' },
  outsideMonth: { color: '#626275' },
  dayDot: { position: 'absolute', bottom: 1, width: 4, height: 4, borderRadius: 2 },
  dayHasSession: { backgroundColor: colors.primaryLight },
  section: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  emptyText: { color: colors.textDim, fontSize: 13, lineHeight: 20 },
  sessionCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  sessionInfo: { flex: 1 },
  sessionProject: { color: colors.text, fontSize: 14, fontWeight: '600' },
  sessionNote: { color: colors.textDim, fontSize: 12, marginTop: 3 },
  removeText: { color: colors.danger, fontSize: 12, fontWeight: '600', padding: spacing.xs },
  projectChoices: { gap: spacing.sm, paddingBottom: spacing.sm },
  projectChip: { maxWidth: 190, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  projectChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  projectChipText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  projectChipTextSelected: { color: '#FFFFFF' },
  input: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, color: colors.text, padding: spacing.md, fontSize: 14, marginTop: spacing.xs },
  addButton: { backgroundColor: colors.primary, borderRadius: radius.pill, alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.md },
  addButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
