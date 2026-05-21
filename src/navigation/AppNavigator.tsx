import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { colors } from '../styles/theme';
import { RootStackParamList } from './types';
import HomeScreen from '../screens/HomeScreen';
import AddLogScreen from '../screens/AddLogScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LogDetailScreen from '../screens/LogDetailScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ReportScreen from '../screens/ReportScreen';
import AppSidebar from '../components/AppSidebar';
import TimelineScreen from '../screens/TimelineScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TaskScreen from '../screens/TaskScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { loading, session, profile } = useAuth();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const needsOnboarding = session && (!profile?.role || !profile?.company || !profile?.goal);

  return (
    <Stack.Navigator
      screenOptions={{
        animation: 'slide_from_right',
        animationDuration: 260,
      }}
    >
      {!session ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
        </>
      ) : needsOnboarding ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Home" options={{ headerShown: false }}>
            {(props) => (
              <AppSidebar>
                <HomeScreen {...props} />
              </AppSidebar>
            )}
          </Stack.Screen>
          <Stack.Screen name="AddLog" options={{ title: 'Add Daily Log', headerShown: false }}>
            {(props) => (
              <AppSidebar>
                <AddLogScreen {...props} />
              </AppSidebar>
            )}
          </Stack.Screen>
          <Stack.Screen name="Dashboard" options={{ title: 'Dashboard', headerShown: false }}>
            {(props) => (
              <AppSidebar>
                <DashboardScreen {...props} />
              </AppSidebar>
            )}
          </Stack.Screen>
          <Stack.Screen name="Report" options={{ title: 'Internship Report', headerShown: false }}>
            {() => (
              <AppSidebar>
                <ReportScreen />
              </AppSidebar>
            )}
          </Stack.Screen>
          <Stack.Screen name="Tasks" options={{ title: 'Tasks', headerShown: false }}>
            {() => (
              <AppSidebar>
                <TaskScreen />
              </AppSidebar>
            )}
          </Stack.Screen>
          <Stack.Screen name="Timeline" options={{ title: 'Timeline', headerShown: false }}>
            {(props) => (
              <AppSidebar>
                <TimelineScreen {...props} />
              </AppSidebar>
            )}
          </Stack.Screen>
          <Stack.Screen name="Settings" options={{ title: 'Settings', headerShown: false }}>
            {() => (
              <AppSidebar>
                <SettingsScreen />
              </AppSidebar>
            )}
          </Stack.Screen>
          <Stack.Screen name="LogDetail" options={{ title: 'Daily Log', headerShown: false }}>
            {(props) => (
              <AppSidebar>
                <LogDetailScreen {...props} />
              </AppSidebar>
            )}
          </Stack.Screen>
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
});
