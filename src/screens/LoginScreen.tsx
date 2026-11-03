import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useProfile } from '../auth/ProfileContext';
import { colors, radius, spacing } from '../theme';
import { UserRole } from '../types';

export function LoginScreen() {
  const { setProfile } = useProfile();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const continueAs = async (role: UserRole) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Enter your name to continue.');
      return;
    }

    setBusy(true);
    try {
      await setProfile({ name: trimmedName, role });
    } catch (error) {
      Alert.alert('Could not save your profile', (error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>VOCAL COACH</Text>
      <Text style={styles.title}>Welcome</Text>
      <Text style={styles.subtitle}>Choose how you’ll use Vocal Coach on this phone.</Text>
      <Text style={styles.label}>Your name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Enter your name"
        placeholderTextColor={colors.textDim}
        style={styles.input}
        autoCapitalize="words"
        maxLength={60}
        editable={!busy}
      />
      <Pressable style={[styles.roleButton, busy && styles.disabled]} onPress={() => void continueAs('coach')} disabled={busy}>
        <Text style={styles.roleTitle}>Continue as Coach</Text>
        <Text style={styles.roleSubtitle}>Create projects, record vocal parts, and share them.</Text>
      </Pressable>
      <Pressable style={[styles.singerButton, busy && styles.disabled]} onPress={() => void continueAs('singer')} disabled={busy}>
        <Text style={styles.roleTitle}>Continue as Singer</Text>
        <Text style={styles.roleSubtitle}>Import your coach’s projects and practice with recordings.</Text>
      </Pressable>
      <Text style={styles.notice}>
        This is an offline profile saved on this phone. It has no password and is not an online account.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: colors.background, padding: spacing.lg },
  brand: { color: colors.primaryLight, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: colors.text, fontSize: 32, fontWeight: '800', marginTop: spacing.sm },
  subtitle: { color: colors.textDim, fontSize: 15, lineHeight: 22, marginTop: spacing.xs, marginBottom: spacing.lg },
  label: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: spacing.xs },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.text, borderRadius: radius.sm, padding: spacing.md, fontSize: 16 },
  roleButton: { backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
  singerButton: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  roleTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  roleSubtitle: { color: '#D5D0FA', fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  notice: { color: colors.textDim, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing.lg },
  disabled: { opacity: 0.6 },
});
