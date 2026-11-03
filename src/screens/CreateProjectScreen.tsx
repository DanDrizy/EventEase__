import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import { createProject } from '../storage/projectStore';
import { colors, radius, spacing } from '../theme';
import { useProfile } from '../auth/ProfileContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CreateProject'>;

export function CreateProjectScreen() {
  const navigation = useNavigation<Nav>();
  const { profile } = useProfile();
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (profile?.role !== 'coach') {
      Alert.alert('Coach access only', 'Only a Coach profile can create projects.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Project name required', 'Enter a song name or a project name such as “Vocal Exercises”.');
      return;
    }
    setBusy(true);
    try {
      const project = await createProject(title);
      navigation.replace('ProjectDetail', { projectId: project.id });
    } catch (error) {
      Alert.alert('Could not create project', (error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (profile?.role !== 'coach') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Coach access only</Text>
        <Text style={styles.hint}>Log in as a Coach to create projects.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create a project</Text>
      <Text style={styles.hint}>Use a song title or a general name like “Vocal Exercises”.</Text>
      <TextInput
        style={styles.input}
        placeholder="Project name"
        placeholderTextColor={colors.textDim}
        value={title}
        onChangeText={setTitle}
        maxLength={80}
        returnKeyType="done"
        onSubmitEditing={handleCreate}
      />
      <Pressable style={[styles.button, busy && styles.disabled]} onPress={handleCreate} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? 'Creating…' : 'Create Project'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  hint: { color: colors.textDim, fontSize: 14, lineHeight: 21, marginTop: spacing.sm, marginBottom: spacing.lg },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.sm, padding: spacing.md, fontSize: 16, borderWidth: 1, borderColor: colors.border },
  button: { marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
