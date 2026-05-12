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
import { exportReportAsPdf, shareReportText } from '../services/reportExport';
import { generateInternshipReport } from '../services/gemini';
import { supabase } from '../services/supabase';
import { colors } from '../styles/theme';
import {
  DailyLogWithAnalysis,
  GeneratedInternshipReport,
  InternshipReport,
  WeeklyReflection,
} from '../types/workowork';

function asReportPayload(report: GeneratedInternshipReport) {
  return {
    title: report.title,
    introduction: report.introduction,
    objectives: report.objectives,
    work_completed: report.work_completed,
    challenges: report.challenges,
    learnings: report.learnings,
    growth_summary: report.growth_summary,
    conclusion: report.conclusion,
    resume_bullets: report.resume_bullets,
  };
}

export default function ReportScreen() {
  const { profile, session } = useAuth();
  const [report, setReport] = useState<InternshipReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadLatestReport = useCallback(async () => {
    if (!session?.user.id) return;

    const { data, error } = await supabase
      .from('internship_reports')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) console.log('Report load failed', error.message);
    setReport(data as InternshipReport | null);
    setLoading(false);
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      loadLatestReport();
    }, [loadLatestReport])
  );

  const handleGenerate = async () => {
    if (!session?.user.id) return;

    setGenerating(true);

    const { data: draft, error: draftError } = await supabase
      .from('internship_reports')
      .insert({
        user_id: session.user.id,
        title: `${profile?.role ?? 'Internship'} Report`,
        status: 'generating',
      })
      .select('*')
      .single();

    if (draftError) {
      setGenerating(false);
      Alert.alert('Could not start report', draftError.message);
      return;
    }

    setReport(draft as InternshipReport);

    const [{ data: logs, error: logsError }, { data: weekly, error: weeklyError }] = await Promise.all([
      supabase
        .from('daily_logs')
        .select('*, ai_analysis(*), mentor_feedback(*)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('weekly_reflections')
        .select('*')
        .eq('user_id', session.user.id)
        .order('week_number', { ascending: true }),
    ]);

    if (logsError || weeklyError) {
      await markFailed(draft.id);
      setGenerating(false);
      Alert.alert('Could not gather report data', logsError?.message ?? weeklyError?.message);
      return;
    }

    try {
      const generated = await generateInternshipReport({
        profile,
        logs: (logs ?? []) as DailyLogWithAnalysis[],
        weeklyReflections: (weekly ?? []) as WeeklyReflection[],
      });

      const { data: completed, error: updateError } = await supabase
        .from('internship_reports')
        .update({
          ...asReportPayload(generated),
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', draft.id)
        .select('*')
        .single();

      if (updateError) {
        throw updateError;
      }

      setReport(completed as InternshipReport);
    } catch (error) {
      console.log('Report generation failed', error);
      await markFailed(draft.id);
      Alert.alert('Report generation failed', 'Please try again after AI analysis has completed for your logs.');
      await loadLatestReport();
    }

    setGenerating(false);
  };

  const markFailed = async (id: string) => {
    await supabase
      .from('internship_reports')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', id);
  };

  const handleExportPdf = async () => {
    if (!report || report.status !== 'completed') return;

    setExporting(true);
    try {
      await exportReportAsPdf(report, profile);
    } catch (error) {
      console.log('PDF export failed', error);
      Alert.alert('Export failed', 'Could not export the PDF on this device.');
    }
    setExporting(false);
  };

  const handleShareText = async () => {
    if (!report || report.status !== 'completed') return;

    try {
      await shareReportText(report, profile);
    } catch (error) {
      console.log('Text share failed', error);
      Alert.alert('Share failed', 'Could not share the report text.');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Internship Report</Text>
      <Text style={styles.subtitle}>Generate a professional report from your full WorkoWork history.</Text>

      <Pressable disabled={generating} onPress={handleGenerate} style={styles.primaryButton}>
        {generating ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonText}>{report ? 'Regenerate Report' : 'Generate Internship Report'}</Text>
        )}
      </Pressable>

      {report ? <ReportPreview report={report} /> : <EmptyReport />}

      {report?.status === 'completed' && (
        <View style={styles.exportRow}>
          <Pressable disabled={exporting} onPress={handleExportPdf} style={styles.exportButton}>
            {exporting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.exportButtonText}>Export PDF</Text>}
          </Pressable>
          <Pressable onPress={handleShareText} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Share Text</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function EmptyReport() {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.bodyText}>No report generated yet.</Text>
    </View>
  );
}

function ReportPreview({ report }: { report: InternshipReport }) {
  if (report.status !== 'completed') {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.statusText}>Report {report.status}.</Text>
      </View>
    );
  }

  return (
    <View style={styles.reportBox}>
      <Text style={styles.reportTitle}>{report.title}</Text>
      <Section title="Introduction" text={report.introduction} />
      <ListSection title="Objectives" items={report.objectives} />
      <ListSection title="Work Completed" items={report.work_completed} />
      <ListSection title="Challenges" items={report.challenges} />
      <ListSection title="Learnings" items={report.learnings} />
      <Section title="Growth Summary" text={report.growth_summary} />
      <Section title="Conclusion" text={report.conclusion} />
      <ListSection title="Resume Bullets" items={report.resume_bullets} />
    </View>
  );
}

function Section({ title, text }: { title: string; text?: string | null }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.bodyText}>{text || 'Not available.'}</Text>
    </View>
  );
}

function ListSection({ title, items }: { title: string; items?: string[] | null }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items?.length ? (
        items.map((item) => (
          <Text key={item} style={styles.listItem}>
            - {item}
          </Text>
        ))
      ) : (
        <Text style={styles.bodyText}>Not available.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bodyText: { color: colors.text, fontSize: 15, lineHeight: 23 },
  center: { alignItems: 'center', backgroundColor: colors.background, flex: 1, justifyContent: 'center' },
  container: { backgroundColor: colors.background, padding: 20, paddingBottom: 36 },
  emptyBox: { backgroundColor: colors.surface, borderRadius: 12, marginTop: 20, padding: 16 },
  exportButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  exportButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  exportRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  listItem: { color: colors.text, fontSize: 15, lineHeight: 23, marginBottom: 4 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 22,
    minHeight: 54,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  reportBox: { marginTop: 22 },
  reportTitle: { color: colors.primary, fontSize: 22, fontWeight: '800', lineHeight: 29 },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButtonText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  section: { borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: 16 },
  sectionTitle: { color: colors.muted, fontSize: 13, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase' },
  statusText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 6 },
  title: { color: colors.primary, fontSize: 30, fontWeight: '800' },
});
