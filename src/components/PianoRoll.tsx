import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NoteResult, Song } from '../types';
import { colors, verdictColors } from '../theme';

const PX_PER_SECOND = 42;
const ROW_HEIGHT = 14;
const AXIS_WIDTH = 34;
const RULER_HEIGHT = 22;

interface Props {
  song: Song;
  results: NoteResult[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function PianoRoll({ song, results, selectedIndex, onSelect }: Props) {
  const { lowNote, highNote, notes, duration } = song.noteMap;
  const span = Math.max(highNote - lowNote + 1, 12);
  const height = span * ROW_HEIGHT + 12;
  const width = Math.max(duration * PX_PER_SECOND, 200);

  const secondsGuides = Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => i);

  return (
    <View style={styles.wrap}>
      <View style={styles.rulerRow}>
        <View style={[styles.axis, { height: RULER_HEIGHT }]}>
          <Text style={styles.axisLabel}>Note</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ height: RULER_HEIGHT }}>
          {secondsGuides.map((s) => (
            <View key={s} style={[styles.tick, { left: s * PX_PER_SECOND }]}>
              <Text style={styles.tickLabel}>{s}s</Text>
            </View>
          ))}
          <View style={{ width }} />
        </ScrollView>
      </View>

      <View style={styles.canvasRow}>
        <View style={[styles.axis, { height }]}>
          {Array.from({ length: span }, (_, i) => {
            const midi = highNote - i;
            return (
              <View key={midi} style={[styles.axisRow, { top: i * ROW_HEIGHT + 4 }]}>
                <Text style={styles.axisLabel}>{noteName(midi)}</Text>
              </View>
            );
          })}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ width }}>
          <View style={[styles.canvas, { height }]}>
            {/* grid lines */}
            {Array.from({ length: span + 1 }, (_, i) => (
              <View key={i} style={[styles.gridLine, { top: i * ROW_HEIGHT }]} />
            ))}
            {/* expected notes */}
            {notes.map((note, idx) => {
              const top = (highNote - note.midi) * ROW_HEIGHT + 1;
              const left = note.time * PX_PER_SECOND;
              const w = Math.max(note.duration * PX_PER_SECOND, 4);
              const result = results[idx];
              const color = result ? verdictColors[result.verdict] : colors.border;
              const selected = selectedIndex === idx;
              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.7}
                  onPress={() => onSelect(idx)}
                  style={[
                    styles.note,
                    {
                      top,
                      left,
                      width: w,
                      height: ROW_HEIGHT - 2,
                      backgroundColor: color,
                      borderColor: selected ? '#FFFFFF' : 'transparent',
                    },
                  ]}
                />
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function noteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${names[((midi % 12) + 12) % 12]}${octave}`;
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  rulerRow: { flexDirection: 'row' },
  canvasRow: { flexDirection: 'row' },
  axis: {
    width: AXIS_WIDTH,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  axisRow: { position: 'absolute', left: 4 },
  axisLabel: { color: colors.textDim, fontSize: 9 },
  tick: { position: 'absolute', top: 0 },
  tickLabel: { color: colors.textDim, fontSize: 10, paddingTop: 2 },
  canvasRowInner: { flex: 1 },
  canvas: { backgroundColor: colors.background, overflow: 'hidden', position: 'relative' },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.surfaceAlt,
  },
  note: {
    position: 'absolute',
    borderRadius: 2,
    borderWidth: 1,
  },
});