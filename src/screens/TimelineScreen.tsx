import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../services/supabase';
import { AiAnalysisStatus, DailyLogWithAnalysis } from '../types/workowork';
import { scoreToPercent } from '../utils/scores';
import { useEntranceMotion } from '../utils/useEntranceMotion';

type Props = NativeStackScreenProps<RootStackParamList, 'Timeline'>;

const INK = '#111110';
const INK_SOFT = '#3A3A38';
const MUTED = '#8A8A82';
const BORDER = '#E4E4DC';
const SURFACE = '#F7F7F3';
const YELLOW = '#E8D870';
const WHITE = '#FAFAF6';

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatDayOfWeek(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(value));
}

function localDateKey(dateInput: Date | string) {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getAnalysis(log: DailyLogWithAnalysis) {
  if (Array.isArray(log.ai_analysis)) return log.ai_analysis[0] ?? null;
  return log.ai_analysis ?? null;
}

function statusConfig(status?: AiAnalysisStatus): { label: string; dotColor: string } {
  switch (status) {
    case 'processing':
      return { label: 'Processing', dotColor: YELLOW };
    case 'completed':
      return { label: 'Ready', dotColor: YELLOW };
    case 'failed':
      return { label: 'Failed', dotColor: '#C0A0A0' };
    default:
      return { label: 'Pending', dotColor: '#C8C8B8' };
  }
}

export default function TimelineScreen({ navigation }: Props) {
  const { session } = useAuth();
  const pageMotion = useEntranceMotion();
  const [logs, setLogs] = useState<DailyLogWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const groupedLogs = useMemo(() => logs, [logs]);

  const loadLogs = useCallback(async () => {
    if (!session?.user.id) return;

    const { data, error } = await supabase
      .from('daily_logs')
      .select('*, ai_analysis(*)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) console.log('Timeline load failed', error.message);
    setLogs(error ? [] : ((data ?? []) as DailyLogWithAnalysis[]));
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

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.listMotion, pageMotion]}>
        <FlatList
          contentContainerStyle={styles.container}
          data={groupedLogs}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={INK} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.eyebrow}>All entries</Text>
              <Text style={styles.title}>Timeline</Text>
              <Text style={styles.subtitle}>Every daily reflection, separated from your Home flow.</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const analysis = getAnalysis(item);
            const { label, dotColor } = statusConfig(analysis?.status);
            const previous = groupedLogs[index - 1];
            const showDateGroup = !previous || localDateKey(previous.created_at) !== localDateKey(item.created_at);

            return (
              <View>
                {showDateGroup && <Text style={styles.groupLabel}>{formatDayOfWeek(item.created_at)} / {formatDate(item.created_at)}</Text>}
                <Pressable
                  onPress={() => navigation.navigate('LogDetail', { id: item.id })}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                >
                  <View style={[styles.cardAccentBar, analysis?.status === 'completed' && styles.cardAccentBarActive]} />
                  <View style={styles.cardInner}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                      <View style={styles.statusPill}>
                        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                        <Text style={styles.statusText}>{label}</Text>
                      </View>
                    </View>
                    <Text numberOfLines={3} style={[styles.cardSummary, !analysis?.professional_summary && styles.cardSummaryFallback]}>
                      {analysis?.professional_summary || item.task || 'Daily work log'}
                    </Text>
                    <View style={styles.cardScores}>
                      <Text style={styles.scoreItem}>
                        <Text style={styles.scoreValue}>{scoreToPercent(item.productivity)}</Text>
                        <Text style={styles.scoreSlash}>% </Text>
                        <Text style={styles.scoreLabel}>focus</Text>
                      </Text>
                      <View style={styles.scoreSep} />
                      <Text style={styles.scoreItem}>
                        <Text style={styles.scoreValue}>{scoreToPercent(item.confidence)}</Text>
                        <Text style={styles.scoreSlash}>% </Text>
                        <Text style={styles.scoreLabel}>confidence</Text>
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator color={INK} style={styles.loading} />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No entries yet</Text>
                <Text style={styles.emptyText}>Create a reflection and it will appear here.</Text>
              </View>
            )
          }
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WHITE },
  listMotion: { flex: 1 },
  container: { paddingHorizontal: 24, paddingTop: 86, paddingBottom: 56 },
  header: { paddingRight: 56, marginBottom: 30 },
  eyebrow: { color: MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 },
  title: { color: INK, fontSize: 42, fontWeight: '800', letterSpacing: -1.2 },
  subtitle: { color: MUTED, fontSize: 14, lineHeight: 22, marginTop: 6 },
  groupLabel: { color: MUTED, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 10, marginTop: 12 },
  card: {
    marginBottom: 12,
    backgroundColor: WHITE,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardPressed: { backgroundColor: SURFACE },
  cardAccentBar: { width: 3, backgroundColor: BORDER },
  cardAccentBarActive: { backgroundColor: YELLOW },
  cardInner: { flex: 1, padding: 18 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardDate: { fontSize: 17, fontWeight: '800', color: INK, letterSpacing: -0.3 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: SURFACE, borderRadius: 20 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusText: { fontSize: 11, color: MUTED, fontWeight: '600', letterSpacing: 0.4 },
  cardSummary: { fontSize: 14, color: INK_SOFT, lineHeight: 21, fontWeight: '500', marginBottom: 14 },
  cardSummaryFallback: { color: MUTED, fontStyle: 'italic' },
  cardScores: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreItem: {},
  scoreValue: { fontSize: 13, fontWeight: '700', color: INK },
  scoreSlash: { fontSize: 12, color: MUTED, fontWeight: '400' },
  scoreLabel: { fontSize: 12, color: MUTED, fontWeight: '400' },
  scoreSep: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: BORDER, marginHorizontal: 4 },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: INK, marginBottom: 8 },
  emptyText: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 22 },
  loading: { marginTop: 40 },
});
