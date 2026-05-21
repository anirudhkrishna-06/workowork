import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { retryLogAnalysis } from '../services/aiAnalysis';
import { supabase } from '../services/supabase';
import { AiAnalysis, DailyLogWithAnalysis, MentorFeedback } from '../types/workowork';
import { scoreToPercent } from '../utils/scores';

type Props = NativeStackScreenProps<RootStackParamList, 'LogDetail'>;

// ─── Design tokens ─────────────────────────────────────────────────
const INK = '#111110';
const INK_SOFT = '#3A3A38';
const MUTED = '#8A8A82';
const BORDER = '#E4E4DC';
const SURFACE = '#F2F2EE';
const YELLOW = '#E8D870';
const WHITE = '#FAFAF6';
const DANGER_MUTED = '#C0A0A0';

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(value)
  );
}

function getAnalysis(log: DailyLogWithAnalysis | null) {
  if (Array.isArray(log?.ai_analysis)) return log.ai_analysis[0] ?? null;
  return log?.ai_analysis ?? null;
}

function getMentorFeedback(log: DailyLogWithAnalysis | null): MentorFeedback[] {
  if (Array.isArray(log?.mentor_feedback)) return log.mentor_feedback;
  return log?.mentor_feedback ? [log.mentor_feedback] : [];
}

// ─── Sub-components ────────────────────────────────────────────────

function EntryField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.entryField}>
      <Text style={styles.entryLabel}>{label}</Text>
      <Text style={styles.entryValue}>{value}</Text>
    </View>
  );
}

function AnalysisField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.analysisField}>
      <Text style={styles.analysisLabel}>{label}</Text>
      <Text style={styles.analysisValue}>{value}</Text>
    </View>
  );
}

function AnalysisList({ label, items }: { label: string; items?: string[] | null }) {
  if (!items?.length) return null;
  return (
    <View style={styles.analysisField}>
      <Text style={styles.analysisLabel}>{label}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.listRow}>
          <View style={styles.listBullet} />
          <Text style={styles.listValue}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function ScorePill({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.scorePill}>
      <Text style={styles.scorePillValue}>{scoreToPercent(value)}</Text>
      <Text style={styles.scorePillSlash}>%</Text>
      <Text style={styles.scorePillLabel}>{label}</Text>
    </View>
  );
}

function AiAnalysisContent({
  analysis,
  retrying,
  onRetry,
}: {
  analysis: AiAnalysis | null;
  retrying: boolean;
  onRetry: () => void;
}) {
  if (!analysis || analysis.status === 'pending' || analysis.status === 'processing') {
    return (
      <View style={styles.aiWaiting}>
        <View style={styles.aiWaitingDot} />
        <Text style={styles.aiWaitingText}>
          {analysis?.status === 'processing'
            ? 'Processing your entry…'
            : 'Analysis pending. Check back shortly.'}
        </Text>
      </View>
    );
  }

  if (analysis.status === 'failed') {
    return (
      <View>
        <View style={styles.aiWaiting}>
          <View style={[styles.aiWaitingDot, { backgroundColor: DANGER_MUTED }]} />
          <Text style={styles.aiWaitingText}>Analysis could not be completed.</Text>
        </View>
        <Pressable
          disabled={retrying}
          onPress={onRetry}
          style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
        >
          {retrying ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <Text style={styles.retryButtonText}>Retry Analysis</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <AnalysisField label="Summary" value={analysis.professional_summary} />
      <AnalysisList label="Skills demonstrated" items={analysis.skills} />
      <AnalysisList label="Areas to grow" items={analysis.weaknesses} />
      <AnalysisList label="Suggestions" items={analysis.suggestions} />
      <AnalysisField label="Resume bullet" value={analysis.resume_bullet} />
    </View>
  );
}

function MentorFeedbackList({ feedback }: { feedback: MentorFeedback[] }) {
  if (!feedback.length) {
    return (
      <Text style={styles.emptyFeedbackText}>No mentor notes added yet.</Text>
    );
  }
  return (
    <View style={styles.feedbackList}>
      {feedback.map((item) => (
        <View key={item.id} style={styles.feedbackItem}>
          <Text style={styles.feedbackText}>{item.feedback}</Text>
          <Text style={styles.feedbackDate}>{formatShortDate(item.created_at)}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────

export default function LogDetailScreen({ navigation, route }: Props) {
  const { profile } = useAuth();
  const [log, setLog] = useState<DailyLogWithAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [savingFeedback, setSavingFeedback] = useState(false);

  const loadLog = useCallback(async () => {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*, ai_analysis(*), mentor_feedback(*)')
      .eq('id', route.params.id)
      .maybeSingle();

    if (error) console.log('Log detail load failed', error.message);
    setLog(data as DailyLogWithAnalysis | null);
    setLoading(false);
  }, [route.params.id]);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  const handleRetry = async () => {
    if (!log) return;
    setRetrying(true);
    await retryLogAnalysis(profile, log);
    await loadLog();
    setRetrying(false);
  };

  const handleSaveFeedback = async () => {
    if (!log || !feedback.trim()) {
      Alert.alert('Add feedback', 'Write the mentor feedback before saving.');
      return;
    }
    setSavingFeedback(true);
    const { error } = await supabase
      .from('mentor_feedback')
      .insert({ log_id: log.id, feedback: feedback.trim() });
    setSavingFeedback(false);
    if (error) {
      Alert.alert('Could not save feedback', error.message);
      return;
    }
    setFeedback('');
    await loadLog();
  };

  const handleDeleteLog = () => {
    if (!log) return;
    Alert.alert(
      'Delete log?',
      'This will also delete AI analysis and mentor feedback for this log.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { data, error } = await supabase
              .from('daily_logs')
              .delete()
              .eq('id', log.id)
              .select('id')
              .maybeSingle();
            if (error) {
              Alert.alert('Could not delete log', error.message);
              return;
            }
            if (!data) {
              Alert.alert(
                'Log was not deleted',
                'Supabase blocked the delete. Run the delete policy SQL, then try again.'
              );
              return;
            }
            navigation.goBack();
          },
        },
      ]
    );
  };

  const analysis = getAnalysis(log);
  const mentorFeedback = getMentorFeedback(log);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={INK} />
      </View>
    );
  }

  if (!log) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>Entry not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Back nav ── */}
      <Pressable
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.5 }]}
      >
        <Text style={styles.backText}>← Back</Text>
      </Pressable>

      {/* ── Date + heading ── */}
      <View style={styles.headerBlock}>
        <Text style={styles.dateLabel}>{formatFullDate(log.created_at)}</Text>
        <Text style={styles.pageTitle}>Daily Entry</Text>
      </View>

      {/* ── Score strip ── */}
      <View style={styles.scoreStrip}>
        <ScorePill value={log.productivity} label="focus" />
        <View style={styles.scoreSep} />
        <ScorePill value={log.confidence} label="confidence" />
        <View style={styles.scoreSep} />
        <ScorePill value={log.stress} label="stress" />
      </View>

      {/* ── Raw entry card ── */}
      <View style={styles.card}>
        <View style={styles.cardAccentBar} />
        <View style={styles.cardBody}>
          <Text style={styles.cardSectionLabel}>Log Entry</Text>
          <EntryField label="Work done" value={log.task} />
          <EntryField label="Learning" value={log.learning} />
          <EntryField label="Challenges" value={log.challenge} />
          <EntryField label="Solutions" value={log.solution} />
          <EntryField label="Tomorrow" value={log.tomorrow_plan} />
        </View>
      </View>

      {/* ── AI analysis card ── */}
      <View style={[styles.card, styles.cardAI]}>
        <View style={styles.cardBody}>
          <View style={styles.aiHeaderRow}>
            <View style={styles.aiHeaderLeft}>
            </View>
            <Text
              style={[
                styles.aiStatusLabel,
                analysis?.status === 'completed' && styles.aiStatusCompleted,
                analysis?.status === 'failed' && styles.aiStatusFailed,
              ]}
            >
              {analysis?.status === 'completed'
                ? 'Ready'
                : analysis?.status === 'processing'
                ? 'Processing'
                : analysis?.status === 'failed'
                ? 'Failed'
                : 'Pending'}
            </Text>
          </View>
          <AiAnalysisContent
            analysis={analysis}
            retrying={retrying}
            onRetry={handleRetry}
          />
        </View>
      </View>

      {/* ── Mentor feedback card ── */}
      <View style={styles.card}>
        <View style={styles.cardBody}>
          <Text style={styles.cardSectionLabel}>Mentor Notes</Text>
          <MentorFeedbackList feedback={mentorFeedback} />

          <TextInput
            multiline
            onChangeText={setFeedback}
            placeholder="Write a mentor note…"
            placeholderTextColor={MUTED}
            style={styles.feedbackInput}
            textAlignVertical="top"
            value={feedback}
          />
          <Pressable
            disabled={savingFeedback}
            onPress={handleSaveFeedback}
            style={({ pressed }) => [styles.addFeedbackBtn, pressed && styles.addFeedbackBtnPressed]}
          >
            {savingFeedback ? (
              <ActivityIndicator color={WHITE} />
            ) : (
              <Text style={styles.addFeedbackBtnText}>Save Note</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* ── Delete ── */}
      <Pressable
        onPress={handleDeleteLog}
        style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.5 }]}
      >
        <Text style={styles.deleteText}>Delete this entry</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: WHITE, flex: 1 },
  container: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 56 },
  center: {
    flex: 1,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: { fontSize: 18, fontWeight: '700', color: INK },

  // Back
  backButton: { marginBottom: 24, alignSelf: 'flex-start' },
  backText: { fontSize: 14, color: MUTED, fontWeight: '600', letterSpacing: 0.2 },

  // Header
  headerBlock: { marginBottom: 24, paddingRight: 56 },
  dateLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: '500',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: INK,
    letterSpacing: -0.8,
    lineHeight: 40,
  },

  // Score strip
  scoreStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 32,
    paddingVertical: 14,
    paddingHorizontal: 22,
    marginBottom: 16,
  },
  scorePill: { flex: 1, alignItems: 'center' },
  scorePillValue: { fontSize: 22, fontWeight: '800', color: INK, letterSpacing: -0.5 },
  scorePillSlash: { fontSize: 11, color: MUTED, marginTop: 1 },
  scorePillLabel: { fontSize: 11, color: MUTED, marginTop: 3, fontWeight: '500', letterSpacing: 0.2 },
  scoreSep: { width: 1, height: 32, backgroundColor: BORDER },

  // Cards
  card: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 32,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardAI: { backgroundColor: SURFACE, borderColor: SURFACE },
  cardAccentBar: { width: 3, backgroundColor: YELLOW },
  cardBody: { flex: 1, padding: 22 },
  cardSectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 18,
  },

  // Entry fields
  entryField: { marginBottom: 18 },
  entryLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  entryValue: {
    fontSize: 15,
    color: INK_SOFT,
    lineHeight: 24,
    fontWeight: '400',
  },

  // AI section
  aiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  aiHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  insightAccent: { width: 3, height: 13, backgroundColor: YELLOW, borderRadius: 2 },
  aiStatusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: WHITE,
    borderRadius: 20,
    overflow: 'hidden',
  },
  aiStatusCompleted: { color: '#8A7A30', backgroundColor: '#F5EDA0' },
  aiStatusFailed: { color: DANGER_MUTED, backgroundColor: '#F5ECEA' },

  aiWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  aiWaitingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: YELLOW,
  },
  aiWaitingText: { fontSize: 14, color: MUTED, fontWeight: '400' },

  // Analysis fields
  analysisField: { marginBottom: 18 },
  analysisLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  analysisValue: { fontSize: 15, color: INK_SOFT, lineHeight: 24, fontWeight: '400' },
  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  listBullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: YELLOW,
    marginTop: 8,
    flexShrink: 0,
  },
  listValue: { flex: 1, fontSize: 15, color: INK_SOFT, lineHeight: 24, fontWeight: '400' },

  // Retry
  retryButton: {
    backgroundColor: INK,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 14,
  },
  retryButtonPressed: { backgroundColor: '#2A2A28' },
  retryButtonText: { color: WHITE, fontSize: 14, fontWeight: '700' },

  // Mentor feedback
  emptyFeedbackText: { fontSize: 14, color: MUTED, marginBottom: 16, fontWeight: '400' },
  feedbackList: { marginBottom: 16 },
  feedbackItem: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 14,
  },
  feedbackText: { fontSize: 14, color: INK_SOFT, lineHeight: 22, fontWeight: '400' },
  feedbackDate: { fontSize: 11, color: MUTED, marginTop: 6, fontWeight: '500' },
  feedbackInput: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    fontSize: 15,
    color: INK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 90,
    marginBottom: 10,
  },
  addFeedbackBtn: {
    backgroundColor: INK,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  addFeedbackBtnPressed: { backgroundColor: '#2A2A28' },
  addFeedbackBtnText: { color: WHITE, fontSize: 14, fontWeight: '700' },

  // Delete
  deleteButton: { alignItems: 'center', marginTop: 8, paddingVertical: 16 },
  deleteText: {
    fontSize: 13,
    color: DANGER_MUTED,
    fontWeight: '600',
    letterSpacing: 0.3,
    textDecorationLine: 'underline',
  },

  divider: { height: 1, backgroundColor: BORDER, marginVertical: 8 },
});
