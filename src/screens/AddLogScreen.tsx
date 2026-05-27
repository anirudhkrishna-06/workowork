import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { createPendingAnalysis, processLogAnalysis } from '../services/aiAnalysis';
import { supabase } from '../services/supabase';
import { DailyLog } from '../types/workowork';
import { debugLog, errorDetails } from '../utils/debug';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const tokens = {
  bg: '#F9F8F6',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F3F0',
  primary: '#0D0D0D',
  accent: '#E8C84A',
  accentMuted: '#F5E68A',
  accentSubtle: '#FBF5D6',
  muted: '#9B9690',
  border: '#EBEBEA',
  pillInactive: '#EEEDE9',
  pillActive: '#E8C84A',
  pillActiveText: '#0D0D0D',
  pillInactiveText: '#8A8782',
  radius: 32,
  radiusSm: 20,
  radiusXs: 14,
};

type Props = NativeStackScreenProps<RootStackParamList, 'AddLog'>;

function parseLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Pill Score Selector ───────────────────────────────────────────────────────
function PillScore({
  label,
  value,
  onChange,
  hint,
  max = 10,
  displayValues,
  rounded,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  max?: number;
  displayValues?: string[];
  rounded?: boolean;
}) {
  const pills = Array.from({ length: max }, (_, i) => i + 1);
  const isEmoji = !!displayValues;

  return (
    <View style={scoreStyles.block}>
      <View style={scoreStyles.header}>
        <Text style={scoreStyles.label}>{label}</Text>
        <View style={scoreStyles.valuePill}>
          <Text style={scoreStyles.valueText}>{displayValues?.[value - 1] ?? value}</Text>
        </View>
      </View>
      {hint && <Text style={scoreStyles.hint}>{hint}</Text>}
      <View style={scoreStyles.pillRow}>
        {pills.map((n) => {
          const active = isEmoji ? n === value : n <= value;
          const basePillStyle = isEmoji ? scoreStyles.emojiPill : (rounded ? scoreStyles.roundPill : scoreStyles.pill);
          const textStyle = isEmoji ? scoreStyles.emojiPillText : scoreStyles.pillText;
          const activeStyle = isEmoji ? scoreStyles.emojiPillActive : scoreStyles.pillActive;
          const inactiveStyle = isEmoji ? scoreStyles.emojiPillInactive : scoreStyles.pillInactive;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              style={({ pressed }) => [
                basePillStyle,
                active ? activeStyle : inactiveStyle,
                pressed && scoreStyles.pillPressed,
              ]}
            >
              <Text style={[textStyle, active ? scoreStyles.pillTextActive : scoreStyles.pillTextInactive]}>
                {displayValues?.[n - 1] ?? n}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const scoreStyles = StyleSheet.create({
  block: { gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: tokens.primary, fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },
  hint: { color: tokens.muted, fontSize: 12, marginTop: -10, marginBottom: 2 },
  valuePill: {
    backgroundColor: tokens.accent,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
    minWidth: 32,
    alignItems: 'center',
  },
  valueText: { color: tokens.primary, fontSize: 12, fontWeight: '800' },
  pillRow: { flexDirection: 'row', gap: 15 },
  pill: {
    flex: 1,
    height: 32,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  pillActive: { backgroundColor: tokens.pillActive },
  pillInactive: { backgroundColor: tokens.pillInactive },
  emojiPillActive: {
    borderBottomWidth: 3,
    borderBottomColor: tokens.accent,
  },
  emojiPillInactive: {
    backgroundColor: 'transparent',
  },
  pillPressed: { opacity: 0.75 },
  pillText: { fontSize: 11, fontWeight: '700' },
  emojiPillText: { fontSize: 28 },
  pillTextActive: { color: tokens.primary },
  pillTextInactive: { color: tokens.pillInactiveText },
});

// ─── Reflection Field ──────────────────────────────────────────────────────────
function ReflectionField({
  label,
  value,
  onChange,
  placeholder,
  optional,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder: string;
  optional?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={fieldStyles.block}>
      <View style={fieldStyles.labelRow}>
        <Text style={fieldStyles.label}>{label}</Text>
      </View>
      <TextInput
        multiline
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={tokens.muted}
        style={[fieldStyles.input, focused && fieldStyles.inputFocused]}
        textAlignVertical="top"
        value={value}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  block: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: tokens.primary, fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },
  optional: {
    color: tokens.muted,
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: tokens.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 99,
  },
  input: {
    backgroundColor: tokens.surface,
    borderRadius: tokens.radiusSm,
    borderWidth: 1.5,
    borderColor: tokens.border,
    color: tokens.primary,
    fontSize: 12,
    lineHeight: 22,
    minHeight: 90,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputFocused: {
    borderColor: tokens.accent,
    backgroundColor: '#FEFDF9',
  },
});

// ─── Section Divider ──────────────────────────────────────────────────────────
function SectionDivider({ label }: { label: string }) {
  return (
    <View style={dividerStyles.row}>
      <View style={dividerStyles.line} />
      <Text style={dividerStyles.text}>{label}</Text>
      <View style={dividerStyles.line} />
    </View>
  );
}

const dividerStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  line: { flex: 1, height: 1, backgroundColor: tokens.border },
  text: { color: tokens.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function AddLogScreen({ navigation, route }: Props) {
  const { profile, session } = useAuth();
  const selectedDate = route.params?.selectedDate;
  const entryDate = selectedDate ? parseLocalDateKey(selectedDate) : new Date();
  const [task, setTask] = useState('');
  const [learning, setLearning] = useState('');
  const [challenge, setChallenge] = useState('');
  const [solution, setSolution] = useState('');
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  const [productivity, setProductivity] = useState(3);
  const [confidence, setConfidence] = useState(3);
  const [stress, setStress] = useState(3);
  const [saving, setSaving] = useState(false);

  const saveScale = useRef(new Animated.Value(1)).current;

  const animateSave = () => {
    Animated.sequence([
      Animated.timing(saveScale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(saveScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const handleSave = async () => {
    if (!session?.user.id) return;

    if (!task.trim()) {
      Alert.alert('One thing needed', 'Add at least what you worked on for this day.');
      return;
    }

    animateSave();
    setSaving(true);
    const { data, error } = await supabase
      .from('daily_logs')
      .insert({
        user_id: session.user.id,
        created_at: entryDate.toISOString(),
        task: task.trim(),
        learning: learning.trim(),
        challenge: challenge.trim(),
        solution: solution.trim(),
        productivity,
        confidence,
        stress,
        tomorrow_plan: tomorrowPlan.trim(),
      })
      .select('*')
      .single();
    setSaving(false);

    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }

    navigation.goBack();

    const savedLog = data as DailyLog;
    debugLog('AI', 'Background daily analysis scheduled after save', { logId: savedLog.id });
    createPendingAnalysis(savedLog.id)
      .then(() => processLogAnalysis(profile, savedLog))
      .catch((analysisError) => {
        debugLog('AI', 'Background daily analysis chain failed before completion', {
          logId: savedLog.id,
          error: errorDetails(analysisError),
        });
      });
  };

  // Progress indicator: how many fields are touched
  const filled = [task, learning, challenge, solution, tomorrowPlan].filter((v) => v.trim().length > 0).length;
  const progress = filled / 5;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      style={s.keyboard}
    >
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={s.container}
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerTopRow}>
            <View style={s.datePill}>
              <Text style={s.datePillText}>
                {formatDateLabel(entryDate)}
              </Text>
            </View>
            {/* Subtle progress ring */}
            <View style={s.progressWrap}>
              <View style={[s.progressBar, { width: `${Math.round(progress * 100)}%` }]} />
              <Text style={s.progressLabel}>{Math.round(progress * 100)}%</Text>
            </View>
          </View>

          <Text style={s.title}>Daily{'\n'}Reflection</Text>
          <Text style={s.subtitle}>{"You don't need perfect notes."}{'\n'}Just honest ones.</Text>
        </View>

        {/* ── Today's Work ───────────────────────────────────── */}
        <View style={s.card}>
          <ReflectionField
            label="What moved forward today?"
            value={task}
            onChange={setTask}
            placeholder="List down the tasks..."
          />
          <ReflectionField
            label="Something new you understood?"
            value={learning}
            onChange={setLearning}
            placeholder="Point out your learnings today..."
            optional
          />
        </View>

        <SectionDivider label="obstacles" />

        {/* ── Challenges ─────────────────────────────────────── */}
        <View style={s.card}>
          <ReflectionField
            label="Where did things slow down?"
            value={challenge}
            onChange={setChallenge}
            placeholder="Place your challenges here..."
            optional
          />
          <ReflectionField
            label="How did you work through it?"
            value={solution}
            onChange={setSolution}
            placeholder="That's Great! How did you tackle it?"
            optional
          />
        </View>

        <SectionDivider label="energy check" />

        {/* ── Self Reflection ─────────────────────────────────── */}
        <View style={[s.card, s.reflectionCard]}>
          <View style={s.reflectionHeader}>
            <Text style={s.reflectionTitle}>How did today feel?</Text>
            <Text style={s.reflectionSub}>Rate each from 1 - 5</Text>
          </View>

          <PillScore
            label="Productivity"
            value={productivity}
            onChange={setProductivity}
            max={5}
            rounded
            hint="How much did you actually get done?"
          />
          <View style={s.scoreDivider} />
          <PillScore
            label="Confidence"
            value={confidence}
            onChange={setConfidence}
            max={5}
            rounded
            hint="How certain did you feel in your decisions?"
          />
          <View style={s.scoreDivider} />
          <PillScore
            label="Stress"
            value={stress}
            onChange={setStress}
            max={5}
            displayValues={['😌', '🙂', '😐', '😣', '😫']}
            hint="How heavy did the day feel?"
          />
        </View>

        <SectionDivider label="looking ahead" />

        {/* ── Tomorrow ───────────────────────────────────────── */}
        <View style={s.card}>
          <ReflectionField
            label="What deserves attention tomorrow?"
            value={tomorrowPlan}
            onChange={setTomorrowPlan}
            placeholder="Continue auth testing, document API decisions, sync with team..."
            optional
          />
        </View>

        {/* ── Save ───────────────────────────────────────────── */}
        <View style={s.saveSection}>
          <Animated.View style={{ transform: [{ scale: saveScale }] }}>
            <Pressable
              disabled={saving}
              onPress={handleSave}
              style={({ pressed }) => [s.saveButton, pressed && s.saveButtonPressed]}
            >
              {saving ? (
                <ActivityIndicator color={tokens.accent} size="small" />
              ) : (
                <Text style={s.saveButtonText}>Save Reflection</Text>
              )}
            </Pressable>
          </Animated.View>
          <Text style={s.aiNote}>Insights organize automatically after saving.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  keyboard: { backgroundColor: tokens.bg, flex: 1 },
  container: {
    backgroundColor: tokens.bg,
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 48,
    gap: 18,
  },

  // Header
  header: { gap: 12, marginBottom: 6 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 56 },
  datePill: {
    backgroundColor: tokens.accentSubtle,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  datePillText: { color: '#7A6A10', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: tokens.surface,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: tokens.border,
    overflow: 'hidden',
    minWidth: 90,
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: tokens.accentMuted,
    borderRadius: 99,
  },
  progressLabel: { color: tokens.muted, fontSize: 11, fontWeight: '700', zIndex: 1, marginLeft: 4 },
  title: {
    color: tokens.primary,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.5,
    lineHeight: 48,
  },
  subtitle: {
    color: tokens.muted,
    fontSize: 14,
    lineHeight: 15,
    fontWeight: '400',
  },

  // Cards
  card: {
    backgroundColor: tokens.surface,
    borderRadius: tokens.radius,
    padding: 20,
    gap: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  reflectionCard: {
    backgroundColor: tokens.surface,
    borderWidth: 1,
    borderColor: tokens.border,
  },
  reflectionHeader: { gap: 2, marginBottom: 4 },
  reflectionTitle: { color: tokens.primary, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  reflectionSub: { color: tokens.muted, fontSize: 12, marginTop: 0 },
  scoreDivider: { height: 1, backgroundColor: tokens.border, marginVertical: 2 },

  // Save
  saveSection: { gap: 10, alignItems: 'center', marginTop: 8 },
  saveButton: {
    backgroundColor: tokens.primary,
    borderRadius: tokens.radius,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 48,
    minWidth: 240,
  },
  saveButtonPressed: { opacity: 0.85 },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
  aiNote: {
    color: tokens.muted,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});
