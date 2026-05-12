import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/src/context/AuthContext';
import { supabase } from '@/src/services/supabase';
import { colors } from '@/src/styles/theme';

type SliderLikeInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

function ScoreInput({ label, value, onChange }: SliderLikeInputProps) {
  return (
    <View style={styles.scoreBlock}>
      <View style={styles.scoreHeader}>
        <Text style={styles.scoreLabel}>{label}</Text>
        <Text style={styles.scoreValue}>{value}/10</Text>
      </View>
      <View style={styles.scoreRow}>
        {Array.from({ length: 10 }, (_, index) => {
          const score = index + 1;
          const active = score <= value;

          return (
            <Pressable
              key={score}
              onPress={() => onChange(score)}
              style={[styles.scoreDot, active && styles.scoreDotActive]}
            />
          );
        })}
      </View>
    </View>
  );
}

export default function AddLogScreen() {
  const { session } = useAuth();
  const [task, setTask] = useState('');
  const [learning, setLearning] = useState('');
  const [challenge, setChallenge] = useState('');
  const [solution, setSolution] = useState('');
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  const [productivity, setProductivity] = useState(6);
  const [confidence, setConfidence] = useState(6);
  const [stress, setStress] = useState(4);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!session?.user.id) {
      router.replace('/login');
      return;
    }

    if (!task.trim()) {
      Alert.alert('Add work done', 'Write at least what you worked on today.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('daily_logs').insert({
      user_id: session.user.id,
      task: task.trim(),
      learning: learning.trim(),
      challenge: challenge.trim(),
      solution: solution.trim(),
      productivity,
      confidence,
      stress,
      tomorrow_plan: tomorrowPlan.trim(),
    });

    setSaving(false);

    if (error) {
      Alert.alert('Could not save log', error.message);
      return;
    }

    router.replace('/home');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboard}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Daily Log</Text>
        <Text style={styles.subtitle}>Keep it plain. The structure does the heavy lifting.</Text>

        <Text style={styles.label}>What did you work on today?</Text>
        <TextInput
          multiline
          onChangeText={setTask}
          placeholder="Worked on JWT auth, API integration..."
          style={styles.textArea}
          textAlignVertical="top"
          value={task}
        />

        <Text style={styles.label}>What did you learn?</Text>
        <TextInput
          multiline
          onChangeText={setLearning}
          placeholder="Learned how session refresh works..."
          style={styles.textArea}
          textAlignVertical="top"
          value={learning}
        />

        <Text style={styles.label}>What problems did you face?</Text>
        <TextInput
          multiline
          onChangeText={setChallenge}
          placeholder="Faced async state update issues..."
          style={styles.textArea}
          textAlignVertical="top"
          value={challenge}
        />

        <Text style={styles.label}>How did you solve them?</Text>
        <TextInput
          multiline
          onChangeText={setSolution}
          placeholder="Debugged request flow and simplified state..."
          style={styles.textArea}
          textAlignVertical="top"
          value={solution}
        />

        <View style={styles.reflectionBox}>
          <Text style={styles.reflectionTitle}>Self Reflection</Text>
          <ScoreInput label="Productivity" onChange={setProductivity} value={productivity} />
          <ScoreInput label="Confidence" onChange={setConfidence} value={confidence} />
          <ScoreInput label="Stress" onChange={setStress} value={stress} />
        </View>

        <Text style={styles.label}>What will you do tomorrow?</Text>
        <TextInput
          multiline
          onChangeText={setTomorrowPlan}
          placeholder="Continue auth testing and document API decisions..."
          style={styles.textArea}
          textAlignVertical="top"
          value={tomorrowPlan}
        />

        <Pressable disabled={saving} onPress={handleSave} style={styles.saveButton}>
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Log</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    padding: 20,
    paddingBottom: 36,
  },
  keyboard: {
    backgroundColor: colors.background,
    flex: 1,
  },
  label: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 20,
  },
  reflectionBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    gap: 14,
    marginTop: 22,
    padding: 16,
  },
  reflectionTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 26,
    minHeight: 54,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  scoreBlock: {
    gap: 10,
  },
  scoreDot: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 16,
  },
  scoreDotActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  scoreHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scoreLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  scoreRow: {
    flexDirection: 'row',
    gap: 6,
  },
  scoreValue: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
  textArea: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 96,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: '800',
  },
});
