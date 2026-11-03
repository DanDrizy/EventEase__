import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TouchableHighlight, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSong } from '../storage/songStore';
import { midiToName } from '../midi/midiService';
import { colors, spacing, radius, verdictColors } from '../theme';
import { RootStackParamList } from '../navigation';
import { useFocusEffect } from '@react-navigation/native';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SongDetail'>;

export function SongDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<RootStackParamList, 'SongDetail'>>();
  const { songId } = route.params;
  const [song, setSong] = useState(() => null as Awaited<ReturnType<typeof getSong>>);

  useFocusEffect(
    React.useCallback(() => {
      getSong(songId).then(setSong);
    }, [songId])
  );

  if (!song) {
    return <View style={styles.container} />;
  }

  const attempts = [...song.attempts].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{song.title}</Text>
      <View style={styles.meta}>
        <Text style={styles.metaText}>
          {song.noteMap.noteCount} notes · {Math.round(song.noteMap.tempo)} BPM
        </Text>
        <Text style={styles.metaText}>
          Range {midiToName(song.noteMap.lowNote)} → {midiToName(song.noteMap.highNote)}
        </Text>
        <Text style={styles.metaText}>
          Backing {song.backingPath ? '✓' : '✕'} · Coach vocal {song.coachPath ? '✓' : '✕'}
        </Text>
      </View>

      <Text style={styles.section}>Attempts</Text>
      {attempts.length === 0 ? (
        <Text style={styles.empty}>No practice attempts yet. Hit Practice to start!</Text>
      ) : (
        <FlatList
          data={attempts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const acc = item.accuracy;
            const accent = acc >= 85 ? colors.success : acc >= 60 ? colors.warning : colors.danger;
            return (
              <TouchableHighlight
                underlayColor={colors.surfaceAlt}
                style={styles.attemptCard}
                onPress={() => navigation.navigate('Results', { songId, attemptId: item.id })}
              >
                <View>
                  <View style={styles.attemptRow}>
                    <Text style={styles.attemptDate}>
                      {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={[styles.attemptAcc, { color: accent }]}>{acc}%</Text>
                  </View>
                  <View style={styles.legendRow}>
                    <Legend color={verdictColors.correct} label={`${item.hitCount} hit`} />
                    <Legend color={verdictColors.flat} label={`${item.flatCount} flat`} />
                    <Legend color={verdictColors.sharp} label={`${item.sharpCount} sharp`} />
                    <Legend color={verdictColors.missed} label={`${item.missedCount} missed`} />
                  </View>
                  {item.coachComment ? <Text style={styles.comment}>Coach: {item.coachComment}</Text> : null}
                </View>
              </TouchableHighlight>
            );
          }}
        />
      )}

      <Pressable
        style={styles.practiceBtn}
        onPress={() => navigation.navigate('Practice', { songId })}
      >
        <Text style={styles.practiceText}>▶ Start Practicing</Text>
      </Pressable>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  meta: { marginTop: spacing.sm, marginBottom: spacing.md },
  metaText: { color: colors.textDim, fontSize: 13, lineHeight: 20 },
  section: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing.sm },
  empty: { color: colors.textDim, fontSize: 14, paddingVertical: spacing.md },
  list: { paddingBottom: 120 },
  attemptCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  attemptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  attemptDate: { color: colors.textDim, fontSize: 13 },
  attemptAcc: { fontSize: 20, fontWeight: '800' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: colors.textDim, fontSize: 12 },
  comment: { color: colors.info, fontSize: 12, marginTop: spacing.sm, fontStyle: 'italic' },
  practiceBtn: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  practiceText: { color: '#10241A', fontSize: 17, fontWeight: '800' },
});