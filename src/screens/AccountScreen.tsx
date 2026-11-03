import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useProfile } from '../auth/ProfileContext';
import { colors, radius, spacing } from '../theme';

export function AccountScreen() {
  const { profile, setProfile } = useProfile();
  const [busy, setBusy] = useState(false);
  const isCoach = profile?.role === 'coach';

  const handleLogout = async () => {
    setBusy(true);
    try {
      await setProfile(null);
    } catch (error) {
      Alert.alert('Could not log out', (error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account</Text>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile?.name.slice(0, 1).toUpperCase() ?? '?'}</Text>
        </View>
        <Text style={styles.name}>{profile?.name}</Text>
        <Text style={styles.role}>{isCoach ? 'Coach · Staff' : 'Singer'}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Local profile</Text>
        <Text style={styles.infoText}>
          This profile is saved only on this phone. It has no password and does not sync. Logging out keeps this phone’s projects and calendar.
        </Text>
      </View>
      <Pressable style={[styles.logoutButton, busy && styles.disabled]} onPress={() => void handleLogout()} disabled={busy}>
        <Text style={styles.logoutText}>{busy ? 'Logging out…' : 'Log Out'}</Text>
      </Pressable>
      <Text style={styles.helpText}>To use the other role, log out and choose Coach or Singer on the welcome screen.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md, paddingTop: spacing.xl },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, alignItems: 'center', padding: spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  name: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: spacing.md },
  role: { color: colors.primaryLight, fontSize: 14, fontWeight: '700', marginTop: spacing.xs },
  infoCard: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  infoTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  infoText: { color: colors.textDim, fontSize: 13, lineHeight: 20, marginTop: spacing.xs },
  logoutButton: { backgroundColor: colors.danger, borderRadius: radius.pill, alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xl },
  logoutText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  helpText: { color: colors.textDim, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.md },
  disabled: { opacity: 0.6 },
});
