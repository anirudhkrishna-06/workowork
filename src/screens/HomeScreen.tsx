import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../services/supabase';
import { colors } from '../styles/theme';
import { AiAnalysis, AiAnalysisStatus, DailyLogWithAnalysis } from '../types/workowork';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}

function formatDayOfWeek(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(value));
}

function getAnalysis(log: DailyLogWithAnalysis) {
  if (Array.isArray(log.ai_analysis)) {
    return log.ai_analysis[0] ?? null;
  }
  return log.ai_analysis ?? null;
}

function statusConfig(status?: AiAnalysisStatus): { label: string; dotColor: string } {
  switch (status) {
    case 'pending':
      return { label: 'Pending', dotColor: '#C8C8B8' };
    case 'processing':
      return { label: 'Processing', dotColor: '#E8D870' };
    case 'completed':
      return { label: 'Ready', dotColor: '#E8D870' };
    case 'failed':
      return { label: 'Failed', dotColor: '#C0A0A0' };
    default:
      return { label: 'Pending', dotColor: '#C8C8B8' };
  }
}

// Use local date (YYYY-MM-DD) to avoid UTC offset issues when grouping by day
function localDateKey(dateInput: Date | string) {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function HomeScreen({ navigation }: Props) {
  const { profile, session, signOut } = useAuth();
  const [logs, setLogs] = useState<DailyLogWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Calendar selection state (YYYY-MM-DD) — null means no filter
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Build a simple last-30-days array for the calendar heatmap
  const days = useMemo(() => {
    const out: Date[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      out.push(d);
    }
    return out;
  }, []);

  // Map of date (YYYY-MM-DD) => count of logs that day
  const countsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of logs) {
      const key = localDateKey(l.created_at);
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [logs]);

  const maxCount = useMemo(() => Math.max(1, ...Array.from(countsByDate.values(), (v) => v || 0)), [countsByDate]);

  // Logs to display in the FlatList (filtered by selectedDate when present)
  const displayedLogs = useMemo(() => {
    if (!selectedDate) return logs;
    return logs.filter((l) => localDateKey(l.created_at) === selectedDate);
  }, [logs, selectedDate]);

  const loadLogs = useCallback(async () => {
    if (!session?.user.id) return;

    const { data, error } = await supabase
      .from('daily_logs')
      .select('*, ai_analysis(*)')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Log load failed', error.message);
    }

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

  const weeklyLogs = logs.slice(0, 7);
  const weeklyProductivity = weeklyLogs.length
    ? Math.round(weeklyLogs.reduce((total, log) => total + Number(log.productivity ?? 0), 0) / weeklyLogs.length)
    : 0;
  const latestCompletedAnalysis = logs
    .map((log) => getAnalysis(log))
    .find((analysis): analysis is AiAnalysis => analysis?.status === 'completed');
  const latestInsight =
    latestCompletedAnalysis?.suggestions?.[0] ||
    latestCompletedAnalysis?.professional_summary ||
    null;

  // Build month list (past 12 months, newest last for natural scrolling)
  const months = useMemo(() => {
    const out: { year: number; month: number; label: string }[] = [];
    const today = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      out.push({ year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString(undefined, { month: 'short', year: 'numeric' }) });
    }
    return out;
  }, []);

  function getMonthMatrix(year: number, month: number) {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const matrix: (Date | null)[][] = [];
    let week: (Date | null)[] = [];
    // fill initial blanks
    for (let i = 0; i < first.getDay(); i++) week.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      week.push(new Date(year, month, d));
      if (week.length === 7) {
        matrix.push(week);
        week = [];
      }
    }
    if (week.length) {
      while (week.length < 7) week.push(null);
      matrix.push(week);
    }
    return matrix;
  }

  return (
    <View style={styles.container}>
      <FlatList
        contentContainerStyle={styles.scrollContent}
        data={displayedLogs}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            onRefresh={handleRefresh}
            refreshing={refreshing}
            tintColor="#1A1A1A"
          />
        }
        ListHeaderComponent={
          <>
            {/* ── Header ── */}
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <View style={styles.greetingBlock}>
                  <Text style={styles.greetingEyebrow}>
                    {new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
                  </Text>
                  <Text style={styles.greetingName}>
                    {getGreeting()},{'\n'}{profile?.name || 'there'}.
                  </Text>
                  {(profile?.role || profile?.company) && (
                    <Text style={styles.context}>
                      {[profile?.role, profile?.company ? `at ${profile.company}` : ''].filter(Boolean).join(' ')}
                    </Text>
                  )}
                </View>
                <Pressable onPress={signOut} style={({ pressed }) => [styles.signOutButton, pressed && styles.signOutPressed]}>
                  <Text style={styles.signOutText}>exit</Text>
                </Pressable>
              </View>
            </View>

            {/* ── Metrics ── */}
            <View style={styles.metricsRow}>
              <View style={[styles.metricCard, styles.metricCardLeft]}>
                <View style={styles.metricAccentDot} />
                <Text style={styles.metricValue}>{Math.min(logs.length, 7)}</Text>
                <Text style={styles.metricLabel}>day streak</Text>
              </View>
              <View style={styles.metricCard}>
                <View style={styles.metricAccentDot} />
                <Text style={styles.metricValue}>{weeklyProductivity || '—'}</Text>
                <Text style={styles.metricLabel}>avg. productivity</Text>
              </View>
            </View>

            {/* Insight panel moved below timeline; hidden initially */}

            {/* ── Primary CTA ── */}
            <Pressable
              onPress={() => navigation.navigate('AddLog')}
              style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
            >
              <Text style={styles.addButtonText}>+ Add Daily Log</Text>
            </Pressable>

            {/* ── Secondary action ── */}
            <Pressable
              onPress={() => navigation.navigate('Dashboard')}
              style={({ pressed }) => [styles.dashboardButton, pressed && styles.dashboardButtonPressed]}
            >
              <Text style={styles.dashboardButtonText}>View Dashboard</Text>
            </Pressable>

                {/* ── Horizontal monthly calendar (past 12 months) ── */}
                {logs.length > 0 && (
                  <View style={styles.calendarWrap}>
                    <Text style={styles.calendarLabel}>Calendar</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthsRow}>
                      {months.map((m) => {
                        const matrix = getMonthMatrix(m.year, m.month);
                        return (
                          <View key={`${m.year}-${m.month}`} style={styles.monthBlock}>
                            <Text style={styles.monthLabel}>{m.label}</Text>
                            <View style={styles.monthGrid}>
                              {matrix.map((week, wi) => (
                                <View key={wi} style={styles.weekRow}>
                                  {week.map((d, di) => {
                                    if (!d) return <View key={di} style={styles.dayEmpty} />;
                                    const key = localDateKey(d);
                                    const count = countsByDate.get(key) || 0;
                                    const intensity = Math.min(1, count / maxCount);
                                    const bg = count ? `rgba(232,216,112,${0.12 + intensity * 0.7})` : 'transparent';
                                    const isSelected = selectedDate === key;
                                    return (
                                      <Pressable
                                        key={key}
                                        onPress={() => setSelectedDate(isSelected ? null : key)}
                                        style={({ pressed }) => [
                                          styles.daySquare,
                                          { backgroundColor: bg },
                                          isSelected && styles.daySelected,
                                          pressed && styles.dayPressed,
                                        ]}
                                      >
                                        <Text style={styles.dayLabel}>{d.getDate()}</Text>
                                      </Pressable>
                                    );
                                  })}
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

            {/* ── Section header ── */}
            {logs.length > 0 && (
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Timeline</Text>
                <View style={styles.sectionDivider} />
              </View>
            )}
            {/* Insight card appears below the timeline when a date is selected */}
            {selectedDate && (
              <View style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <View style={styles.insightAccentLine} />
                  <Text style={styles.insightLabel}>Reflection</Text>
                </View>
                <Text style={styles.insightText}>
                  {displayedLogs.length
                    ? latestInsight || 'Selected day reflections.'
                    : 'No logs for this day.'}
                </Text>
              </View>
            )}
          </>
        }
        renderItem={({ item, index }) => {
          const analysis = getAnalysis(item);
          const { label: statusLabel, dotColor } = statusConfig(analysis?.status);
          const summaryText = analysis?.professional_summary || null;
          const taskText = item.task || 'Daily work log';

          return (
            <Pressable
              onPress={() => navigation.navigate('LogDetail', { id: item.id })}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              {/* Left accent bar — yellow for completed, muted otherwise */}
              <View style={[styles.cardAccentBar, analysis?.status === 'completed' && styles.cardAccentBarActive]} />

              <View style={styles.cardInner}>
                {/* Date + Status row */}
                <View style={styles.cardTopRow}>
                  <View>
                    <Text style={styles.cardDayOfWeek}>{formatDayOfWeek(item.created_at)}</Text>
                    <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                  </View>
                  <View style={styles.statusPill}>
                    <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                    <Text style={styles.statusText}>{statusLabel}</Text>
                  </View>
                </View>

                {/* Summary */}
                {selectedDate && (
                  <Text style={styles.logNumber}>Log {index + 1}</Text>
                )}
                <Text numberOfLines={2} style={[styles.cardSummary, !summaryText && styles.cardSummaryFallback]}>
                  {summaryText || taskText}
                </Text>

                {/* Scores */}
                <View style={styles.cardScores}>
                  <Text style={styles.scoreItem}>
                    <Text style={styles.scoreValue}>{item.productivity}</Text>
                    <Text style={styles.scoreSlash}>/10 </Text>
                    <Text style={styles.scoreLabel}>focus</Text>
                  </Text>
                  <View style={styles.scoreSep} />
                  <Text style={styles.scoreItem}>
                    <Text style={styles.scoreValue}>{item.confidence}</Text>
                    <Text style={styles.scoreSlash}>/10 </Text>
                    <Text style={styles.scoreLabel}>confidence</Text>
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyGlyph}>◦</Text>
              <Text style={styles.emptyTitle}>No entries yet</Text>
              <Text style={styles.emptyText}>Your timeline is waiting.{'\n'}Open, reflect, understand, close.</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading ? (
            <ActivityIndicator color="#1A1A1A" style={styles.loading} />
          ) : null
        }
      />
    </View>
  );
}

// ─── Design tokens ────────────────────────────────────────────────
const INK = '#111110';
const INK_SOFT = '#3A3A38';
const MUTED = '#8A8A82';
const BORDER = '#E4E4DC';
const SURFACE = '#F7F7F3';
const YELLOW = '#E8D870';
const YELLOW_DIM = '#F2EDA0';
const WHITE = '#FAFAF6';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WHITE,
  },
  scrollContent: {
    paddingBottom: 60,
  },

  // ── Header
  header: {
    paddingHorizontal: 24,
    paddingTop: 68,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  greetingBlock: {
    flex: 1,
    paddingRight: 12,
  },
  greetingEyebrow: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  greetingName: {
    fontSize: 36,
    fontWeight: '800',
    color: INK,
    lineHeight: 42,
    letterSpacing: -0.8,
  },
  context: {
    fontSize: 13,
    color: MUTED,
    marginTop: 6,
    fontWeight: '400',
  },
  signOutButton: {
    paddingTop: 6,
    paddingLeft: 16,
  },
  signOutPressed: {
    opacity: 0.4,
  },
  signOutText: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'lowercase',
  },

  // ── Metrics
  metricsRow: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 32,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: 32,
    padding: 20,
    paddingTop: 18,
  },
  metricCardLeft: {},
  metricAccentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: YELLOW,
    marginBottom: 14,
  },
  metricValue: {
    fontSize: 30,
    fontWeight: '800',
    color: INK,
    letterSpacing: -1,
    lineHeight: 34,
  },
  metricLabel: {
    fontSize: 12,
    color: MUTED,
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  // ── Insight
  insightCard: {
    marginHorizontal: 24,
    marginTop: 16,
    backgroundColor: SURFACE,
    borderRadius: 32,
    padding: 22,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  insightAccentLine: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: YELLOW,
  },
  insightLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  insightText: {
    fontSize: 15,
    color: INK_SOFT,
    lineHeight: 24,
    fontWeight: '400',
  },

  // ── Primary CTA
  addButton: {
    marginHorizontal: 24,
    marginTop: 20,
    backgroundColor: INK,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  addButtonPressed: {
    backgroundColor: '#2A2A28',
  },
  addButtonText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Dashboard
  dashboardButton: {
    marginHorizontal: 24,
    marginTop: 10,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  dashboardButtonPressed: {
    backgroundColor: SURFACE,
  },
  dashboardButtonText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // ── Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginTop: 36,
    marginBottom: 16,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 11,
    color: MUTED,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sectionDivider: {
    flex: 1,
    height: 1,
    backgroundColor: BORDER,
  },

  // ── Timeline card
  card: {
    marginHorizontal: 24,
    marginBottom: 10,
    backgroundColor: WHITE,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardPressed: {
    backgroundColor: SURFACE,
  },
  cardAccentBar: {
    width: 3,
    backgroundColor: BORDER,
  },
  cardAccentBarActive: {
    backgroundColor: YELLOW,
  },
  cardInner: {
    flex: 1,
    padding: 18,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardDayOfWeek: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  cardDate: {
    fontSize: 17,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.3,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: SURFACE,
    borderRadius: 20,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusText: {
    fontSize: 11,
    color: MUTED,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  cardSummary: {
    fontSize: 14,
    color: INK_SOFT,
    lineHeight: 21,
    fontWeight: '500',
    marginBottom: 14,
  },
  cardSummaryFallback: {
    color: MUTED,
    fontStyle: 'italic',
  },
  cardScores: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreItem: {},
  scoreValue: {
    fontSize: 13,
    fontWeight: '700',
    color: INK,
  },
  scoreSlash: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '400',
  },
  scoreLabel: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '400',
  },
  scoreSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: BORDER,
    marginHorizontal: 4,
  },

  // Calendar
  calendarWrap: {
    marginHorizontal: 24,
    marginTop: 18,
    marginBottom: 6,
  },
  calendarLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  calendarRow: {
    flexDirection: 'row',
    gap: 8,
  },
  monthsRow: {
    paddingVertical: 4,
    paddingRight: 12,
    alignItems: 'flex-start',
  },
  monthBlock: {
    marginRight: 16,
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 11,
    color: MUTED,
    marginBottom: 6,
    fontWeight: '600',
  },
  monthGrid: {
    flexDirection: 'column',
    gap: 6,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  dayEmpty: {
    width: 36,
    height: 36,
  },
  daySquare: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayLabel: {
    fontSize: 12,
    color: INK,
    fontWeight: '700',
  },
  daySelected: {
    borderColor: INK,
    borderWidth: 2,
  },
  dayPressed: {
    opacity: 0.8,
  },

  // ── Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  emptyGlyph: {
    fontSize: 28,
    color: YELLOW,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: INK,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 22,
  },

  logNumber: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '700',
    marginBottom: 6,
  },

  // ── Loading
  loading: {
    marginTop: 40,
  },
});