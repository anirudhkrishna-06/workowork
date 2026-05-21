import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/src/services/supabase';
import { colors } from '@/src/styles/theme';
import { DailyLog } from '@/src/types/workowork';

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{children || 'Not added'}</Text>
    </View>
  );
}

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [log, setLog] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLog = async () => {
      const { data, error } = await supabase.from('daily_logs').select('*').eq('id', id).maybeSingle();

      if (error) {
        console.log('Log detail load failed', error.message);
      }

      setLog(data as DailyLog | null);
      setLoading(false);
    };

    if (id) {
      loadLog();
    }
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!log) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Log not found</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.date}>{formatFullDate(log.created_at)}</Text>
      <Text style={styles.title}>Log Entry</Text>

      <Section title="Work Done">{log.task}</Section>
      <Section title="Learning">{log.learning}</Section>
      <Section title="Challenges">{log.challenge}</Section>
      <Section title="Solutions">{log.solution}</Section>
      <Section title="Tomorrow Plan">{log.tomorrow_plan}</Section>

      <View style={styles.scores}>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreValue}>{log.productivity}/10</Text>
          <Text style={styles.scoreLabel}>Productivity</Text>
        </View>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreValue}>{log.confidence}/10</Text>
          <Text style={styles.scoreLabel}>Confidence</Text>
        </View>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreValue}>{log.stress}/10</Text>
          <Text style={styles.scoreLabel}>Stress</Text>
        </View>
      </View>

      <View style={styles.aiPlaceholder}>
        <Text style={styles.aiTitle}>AI Analysis</Text>
        <Text style={styles.aiText}>Phase 2 will generate summaries, skills, weaknesses, and resume bullets here.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  aiPlaceholder: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginTop: 24,
    padding: 16,
  },
  aiText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  aiTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  center: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: colors.background,
    padding: 20,
    paddingBottom: 36,
  },
  date: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyTitle: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  scoreCard: {
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    padding: 12,
  },
  scoreLabel: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 5,
  },
  scores: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  scoreValue: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  section: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 16,
  },
  sectionText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
  },
});
