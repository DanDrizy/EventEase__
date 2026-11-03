import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ProfileContext } from './src/auth/ProfileContext';
import { getProfile, saveProfile, clearProfile } from './src/storage/profileStore';
import { LocalProfile } from './src/types';
import { MainTabsScreen } from './src/navigation/MainTabsScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { CreateProjectScreen } from './src/screens/CreateProjectScreen';
import { ProjectDetailScreen } from './src/screens/ProjectDetailScreen';
import { CoachRecordingScreen } from './src/screens/CoachRecordingScreen';
import { colors } from './src/theme';
import { RootStackParamList } from './src/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

export default function App() {
  const [profile, setProfileState] = React.useState<LocalProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const loadSavedProfile = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setProfileState(await getProfile());
    } catch (error) {
      setLoadError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSavedProfile();
  }, [loadSavedProfile]);

  const setProfile = React.useCallback(async (nextProfile: LocalProfile | null) => {
    if (nextProfile) await saveProfile(nextProfile);
    else await clearProfile();
    setProfileState(nextProfile);
  }, []);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primaryLight} size="large" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorTitle}>Could not load your profile</Text>
        <Text style={styles.errorText}>{loadError}</Text>
        <Pressable style={styles.retry} onPress={() => void loadSavedProfile()}>
          <Text style={styles.retryText}>Try Again</Text>
        </Pressable>
        <Pressable
          style={styles.reset}
          onPress={async () => {
            try {
              await clearProfile();
              setProfileState(null);
              setLoadError(null);
            } catch (error) {
              setLoadError((error as Error).message);
            }
          }}
        >
          <Text style={styles.resetText}>Reset local profile</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ProfileContext.Provider value={{ profile, setProfile }}>
      <NavigationContainer theme={theme} key={profile ? `${profile.role}:${profile.name}` : 'signed-out'}>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          {profile ? (
            <>
              <Stack.Screen name="MainTabs" component={MainTabsScreen} options={{ headerShown: false }} />
              <Stack.Screen name="CreateProject" component={CreateProjectScreen} options={{ title: 'New Project' }} />
              <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={{ title: 'Project' }} />
              <Stack.Screen name="CoachRecording" component={CoachRecordingScreen} options={{ title: 'Record Vocal' }} />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </ProfileContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  errorText: { color: colors.textDim, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 12 },
  retry: { marginTop: 24, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 32 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  reset: { marginTop: 16, padding: 8 },
  resetText: { color: colors.textDim, fontSize: 13 },
});