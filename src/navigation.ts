import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Calendar: undefined;
  Coaching: undefined;
  Account: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  CreateProject: undefined;
  ProjectDetail: { projectId: string };
  CoachRecording: { projectId: string };
  CreateSong: undefined;
  SongDetail: { songId: string };
  Practice: { songId: string };
  Results: { songId: string; attemptId: string };
};