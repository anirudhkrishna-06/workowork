import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/src/context/AuthContext';
import { colors } from '@/src/styles/theme';

export default function IndexScreen() {
  const { loading, session, profile } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!session) {
      router.replace('/login');
      return;
    }

    if (!profile?.role || !profile?.company || !profile?.goal) {
      router.replace('/onboarding');
      return;
    }

    router.replace('/home');
  }, [loading, profile?.company, profile?.goal, profile?.role, session]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
});
