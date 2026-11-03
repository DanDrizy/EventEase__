import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import audioEngine from '../audio/audioEngine';
import { colors, spacing, radius } from '../theme';

interface Props {
  label: string;
  filePath: string;
  duration: number;
  onOffsetChange: (offsetMs: number) => void;
}

export function SyncStep({ label, filePath, duration, onOffsetChange }: Props) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [offset, setOffset] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTick = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTick();
      audioEngine.stopBacking();
    };
  }, [stopTick]);

  const play = async () => {
    if (!filePath) return;
    stopTick();
    setPosition(0);
    setPlaying(true);
    await audioEngine.playBacking(filePath, 0);
    timerRef.current = setInterval(() => {
      const pos = audioEngine.getPlaybackElapsed();
      setPosition(pos);
      if (pos >= duration) {
        stopTick();
        audioEngine.stopBacking();
        setPlaying(false);
      }
    }, 100);
  };

  const stop = () => {
    stopTick();
    audioEngine.stopBacking();
    setPlaying(false);
  };

  const syncAtCurrent = () => {
    const ms = Math.max(0, Math.round(position * 1000));
    setOffset(ms);
    onOffsetChange(ms);
  };

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1).padStart(4, '0');
    return `${m}:${s}`;
  };

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${duration > 0 ? Math.min((position / duration) * 100, 100) : 0}%` },
          ]}
        />
      </View>
      <View style={styles.timeRow}>
        <Text style={styles.time}>{fmt(position)}</Text>
        <Text style={styles.time}>{offset != null ? `Synced at ${(offset / 1000).toFixed(2)}s` : 'Not synced yet'}</Text>
        <Text style={styles.time}>{fmt(duration)}</Text>
      </View>

      <View style={styles.btnRow}>
        {playing ? (
          <Pressable style={[styles.btn, styles.btnSecondary]} onPress={stop}>
            <Text style={styles.btnTextSecondary}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.btn, styles.btnSecondary]} onPress={play}>
            <Text style={styles.btnTextSecondary}>Play</Text>
          </Pressable>
        )}
        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={syncAtCurrent} disabled={!playing}>
          <Text style={styles.btnText}>Tap to Sync</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        Press play, then tap <Text style={styles.hintBold}>Tap to Sync</Text> at the moment you hear the first note
        of the song (matching note #1 in the MIDI). Everything else is aligned automatically.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  label: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  progressTrack: { height: 6, backgroundColor: colors.surfaceAlt, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs, marginBottom: spacing.md },
  time: { color: colors.textDim, fontSize: 12, fontVariant: ['tabular-nums'] },
  btnRow: { flexDirection: 'row', gap: spacing.sm },
  btn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: { backgroundColor: colors.surfaceAlt },
  btnText: { color: '#FFF', fontWeight: '700' },
  btnTextSecondary: { color: colors.text },
  hint: { color: colors.textDim, fontSize: 12, lineHeight: 17, marginTop: spacing.md },
  hintBold: { color: colors.text, fontWeight: '700' },
});