import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { colors } from '../styles/theme';
import { useEntranceMotion } from '../utils/useEntranceMotion';

export default function OnboardingScreen() {
  const { session, refreshProfile } = useAuth();
  const pageMotion = useEntranceMotion(80, 22);
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [duration, setDuration] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [department, setDepartment] = useState('');
  const [manager, setManager] = useState('');
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!session?.user.id) return;

    if (!role.trim() || !company.trim() || !goal.trim()) {
      Alert.alert('A little context helps', 'Add your role, company, and main goal.');
      return;
    }

    const normalizedStartDate = normalizeDateInput(startDate, 'start date');
    const normalizedEndDate = normalizeDateInput(endDate, 'end date');

    if (normalizedStartDate === false || normalizedEndDate === false) {
      return;
    }

    if (normalizedStartDate && normalizedEndDate && normalizedEndDate < normalizedStartDate) {
      Alert.alert('Check your dates', 'End date should be after the start date.');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        role: role.trim(),
        company: company.trim(),
        duration: duration.trim() || null,
        internship_start_date: normalizedStartDate,
        internship_end_date: normalizedEndDate,
        department: department.trim() || null,
        reporting_manager: manager.trim() || null,
        goal: goal.trim(),
      })
      .eq('id', session.user.id);

    if (error) {
      setLoading(false);
      Alert.alert('Could not save profile', error.message);
      return;
    }

    await refreshProfile();
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
      <Animated.ScrollView style={pageMotion} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Set Your Internship Context</Text>
          <Text style={styles.subtitle}>Only once. WorkoWork uses this to keep your logs meaningful.</Text>
        </View>

        <TextInput onChangeText={setRole} placeholder="Role" style={styles.input} value={role} />
        <TextInput onChangeText={setCompany} placeholder="Company" style={styles.input} value={company} />
        <TextInput onChangeText={setDepartment} placeholder="Department" style={styles.input} value={department} />
        <TextInput onChangeText={setManager} placeholder="Reporting manager" style={styles.input} value={manager} />
        <TextInput onChangeText={setStartDate} placeholder="Start date (YYYY-MM-DD)" style={styles.input} value={startDate} />
        <TextInput onChangeText={setEndDate} placeholder="End date (YYYY-MM-DD)" style={styles.input} value={endDate} />
        <TextInput onChangeText={setDuration} placeholder="Duration" style={styles.input} value={duration} />
        <TextInput multiline onChangeText={setGoal} placeholder="Goal" style={[styles.input, styles.textArea]} textAlignVertical="top" value={goal} />

        <Pressable disabled={loading} onPress={handleSave} style={styles.primaryButton}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Continue</Text>}
        </Pressable>
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
}

function normalizeDateInput(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    Alert.alert('Use YYYY-MM-DD', `Enter the ${label} like 2026-05-17.`);
    return false;
  }

  const [year, month, day] = trimmed.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const isValid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isValid) {
    Alert.alert('Check your date', `Enter a valid ${label}.`);
    return false;
  }

  return trimmed;
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { marginBottom: 28 },
  input: { borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.text, fontSize: 16, marginBottom: 14, paddingHorizontal: 14, paddingVertical: 14 },
  keyboard: { backgroundColor: colors.background, flex: 1 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 10, justifyContent: 'center', marginTop: 6, minHeight: 52 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 8 },
  textArea: { minHeight: 116 },
  title: { color: colors.primary, fontSize: 28, fontWeight: '800' },
});
