import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/services/supabase';
import { colors } from '@/src/styles/theme';
import { DailyLog } from '@/src/types/workowork';

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 17) {
    return 'Good afternoon';
  }

  return 'Good evening';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export default function HomeScreen() {
  const { profile, session, signOut } = useAuth();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = useCallback(async () => {
    if (!session?.user.id) {
      return;
    }

    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Log load failed', error.message);
      setLogs([]);
    } else {
      setLogs((data ?? []) as DailyLog[]);
    }

    setLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [loadLogs])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  const streak = logs.length > 0 ? Math.min(logs.length, 7) : 0;
  const weeklyLogs = logs.slice(0, 7);
  const weeklyProductivity =
    weeklyLogs.length > 0
      ? Math.round(
          weeklyLogs.reduce((total, log) => total + Number(log.productivity ?? 0), 0) /
            weeklyLogs.length
        )
      : 0;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.greeting}>
            {getGreeting()}, {profile?.name || 'there'}
          </Text>
          <Text style={styles.context}>
            {profile?.role} {profile?.company ? `at ${profile.company}` : ''}
          </Text>
        </View>
        <Pressable onPress={signOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{streak}</Text>
          <Text style={styles.metricLabel}>day streak</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{weeklyProductivity || '-'}</Text>
          <Text style={styles.metricLabel}>weekly productivity</Text>
        </View>
      </View>

      <View style={styles.insightBox}>
        <Text style={styles.insightLabel}>Latest insight</Text>
        <Text style={styles.insightText}>
          {logs[0]?.task
            ? `Last log: ${logs[0].task.slice(0, 82)}${logs[0].task.length > 82 ? '...' : ''}`
            : 'Add your first log to start your timeline.'}
        </Text>
      </View>

      <Pressable onPress={() => router.push('/add-log')} style={styles.addButton}>
        <Text style={styles.addButtonText}>+ Add Daily Log</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Timeline</Text>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : (
        <FlatList
          contentContainerStyle={logs.length === 0 ? styles.emptyList : styles.list}
          data={logs}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl onRefresh={handleRefresh} refreshing={refreshing} />}
          renderItem={({ item }) => (
            <Link href={`/log/${item.id}`} asChild>
              <Pressable style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                  <Text style={styles.status}>Raw saved</Text>
                </View>
                <Text numberOfLines={2} style={styles.cardTitle}>
                  {item.task || 'Daily work log'}
                </Text>
                <Text style={styles.cardMeta}>
                  Productivity {item.productivity}/10 · Confidence {item.confidence}/10
                </Text>
              </Pressable>
            </Link>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No logs yet</Text>
              <Text style={styles.emptyText}>Open, log, and close. Your timeline will build from there.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    marginBottom: 24,
    minHeight: 58,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  card: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  cardDate: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardMeta: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 10,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 64,
  },
  context: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyTitle: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  greeting: {
    color: colors.primary,
    fontSize: 25,
    fontWeight: '800',
  },
  insightBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginBottom: 18,
    padding: 16,
  },
  insightLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  insightText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  list: {
    paddingBottom: 28,
  },
  loading: {
    marginTop: 40,
  },
  metric: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    marginTop: 24,
  },
  metricValue: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '800',
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  signOutButton: {
    paddingLeft: 12,
    paddingVertical: 8,
  },
  signOutText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  status: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
