import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { exportWeeklyReportAsPdf } from '../services/reportExport';
import { supabase } from '../services/supabase';
import { availableWeekNumbers, generateStoredWeeklyReport, nextUngeneratedWeek } from '../services/weeklyReports';
import { colors } from '../styles/theme';
import {
  DailyLogWithAnalysis,
  WeeklyReflection,
} from '../types/workowork';

export default function ReportScreen() {
  const { profile, session } = useAuth();
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReflection[]>([]);
  const [logs, setLogs] = useState<DailyLogWithAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingWeek, setGeneratingWeek] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const loadReports = useCallback(async () => {
    if (!session?.user.id) return;

    const [{ data: weeklyData, error: weeklyError }, { data: logData, error: logError }] =
      await Promise.all([
        supabase
          .from('weekly_reflections')
          .select('*')
          .eq('user_id', session.user.id)
          .order('week_number', { ascending: true }),
        supabase
          .from('daily_logs')
          .select('*, ai_analysis(*)')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: true }),
      ]);

    if (weeklyError) console.log('Weekly report load failed', weeklyError.message);
    if (logError) console.log('Report log load failed', logError.message);
    setWeeklyReports(weeklyError ? [] : ((weeklyData ?? []) as WeeklyReflection[]));
    setLogs(logError ? [] : ((logData ?? []) as DailyLogWithAnalysis[]));
    setLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      loadReports();
    }, [loadReports])
  );

  const handleGenerateWeek = async (weekNumber: number) => {
    if (!session?.user.id) return;

    setGeneratingWeek(weekNumber);
    try {
      await generateStoredWeeklyReport({
        userId: session.user.id,
        profile,
        weekNumber,
      });
      await loadReports();
    } catch (error) {
      console.log('Weekly report generation failed', error);
      Alert.alert('Weekly report failed', error instanceof Error ? error.message : 'Could not generate this weekly report.');
    }
    setGeneratingWeek(null);
  };

  const handleExportWeeklyPdf = async (weekly: WeeklyReflection) => {
    setExporting(true);
    try {
      await exportWeeklyReportAsPdf(weekly, profile);
    } catch (error) {
      console.log('Weekly PDF export failed', error);
      Alert.alert('Export failed', 'Could not export the weekly PDF on this device.');
    }
    setExporting(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const nextWeek = nextUngeneratedWeek(profile, logs, weeklyReports);
  const weeks = availableWeekNumbers(profile, logs, weeklyReports);
  const completedWeeks = new Set(weeklyReports.filter((report) => report.status === 'completed').map((report) => report.week_number));
  const weeksNeedingReports = weeks.filter((week) => !completedWeeks.has(week));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Reports</Text>

      <View style={styles.weekHeader}>
        <Text style={styles.sectionHeading}>Weekly Reports</Text>
        {nextWeek ? (
          <Pressable disabled={generatingWeek !== null} onPress={() => handleGenerateWeek(nextWeek)} style={styles.smallPrimaryButton}>
            {generatingWeek === nextWeek ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.smallPrimaryText}>Generate {ordinal(nextWeek)} Week</Text>
            )}
          </Pressable>
        ) : null}
      </View>

      {weeklyReports.length ? (
        <View style={styles.weekList}>
          {weeklyReports.map((weekly) => (
            <WeeklyReportCard
              key={weekly.id}
              exporting={exporting}
              generating={generatingWeek === weekly.week_number}
              report={weekly}
              onExport={() => handleExportWeeklyPdf(weekly)}
              onRegenerate={() => handleGenerateWeek(weekly.week_number)}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyBox}>
          <Text style={styles.bodyText}>
            {weeks.length ? 'No weekly reports generated yet. Start with the first available week.' : 'Add log entries before generating weekly reports.'}
          </Text>
        </View>
      )}

      {weeksNeedingReports.length > 0 && (
        <View style={styles.weekPicker}>
          {weeksNeedingReports.map((week) => (
            <Pressable
              key={week}
              disabled={generatingWeek !== null}
              onPress={() => handleGenerateWeek(week)}
              style={({ pressed }) => [styles.weekChip, pressed && styles.weekChipPressed]}
            >
              <Text style={styles.weekChipText}>Week {week}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function ordinal(value: number) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

function formatReportDate(value?: string | null) {
  if (!value) return 'Not available';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function WeeklyReportCard({
  report,
  generating,
  exporting,
  onRegenerate,
  onExport,
}: {
  report: WeeklyReflection;
  generating: boolean;
  exporting: boolean;
  onRegenerate: () => void;
  onExport: () => void;
}) {
  const dayCount = Array.isArray(report.day_summaries) ? report.day_summaries.length : 0;

  return (
    <View style={styles.weekCard}>
      <View style={styles.weekCardTop}>
        <View>
          <Text style={styles.weekTitle}>Week {report.week_number}</Text>
          <Text style={styles.weekDate}>{formatReportDate(report.period_start)} - {formatReportDate(report.period_end)}</Text>
        </View>
        <View style={styles.weekBadge}>
          <Text style={styles.weekBadgeText}>{report.status}</Text>
        </View>
      </View>
      <Text style={styles.bodyText}>{report.weekly_summary || 'Weekly report generated from daily entries.'}</Text>
      <Text style={styles.weekMeta}>{report.log_count} logs / {dayCount} day summaries</Text>
      <View style={styles.weekActions}>
        <Pressable disabled={generating} onPress={onRegenerate} style={styles.secondaryButton}>
          {generating ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryButtonText}>Regenerate</Text>}
        </Pressable>
        <Pressable disabled={exporting} onPress={onExport} style={styles.exportButton}>
          {exporting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.exportButtonText}>Export PDF</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bodyText: { color: colors.text, fontSize: 12, lineHeight: 18 },
  center: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center' },
  container: { backgroundColor: colors.background, padding: 20, paddingTop: 92, paddingBottom: 36 },
  emptyBox: { backgroundColor: colors.surface, borderRadius: 12, marginTop: 20, padding: 16 },
  exportButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 30,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  exportButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  sectionHeading: { color: colors.primary, fontSize: 20, fontWeight: '800', marginTop: 2 },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 30,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButtonText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  title: { color: colors.primary, fontSize: 30, fontWeight: '800' },
  smallPrimaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
  },
  smallPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  weekActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  weekBadge: { backgroundColor: colors.surface, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  weekBadgeText: { color: colors.muted, fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  weekCard: { backgroundColor: '#FFFFFF', borderColor: colors.border, borderRadius: 14, borderWidth: 1, padding: 16 },
  weekCardTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  weekChip: { borderColor: colors.border, borderRadius: 99, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  weekChipPressed: { backgroundColor: colors.surface },
  weekChipText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  weekDate: { color: colors.muted, fontSize: 12, marginTop: 3 },
  weekHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 24 },
  weekList: { gap: 12, marginTop: 14 },
  weekMeta: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 10 },
  weekPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  weekTitle: { color: colors.primary, fontSize: 18, fontWeight: '800' },
});
