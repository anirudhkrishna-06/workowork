import React, { useState } from 'react';
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

import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { colors } from '../styles/theme';

export default function OnboardingScreen() {
  const { session, refreshProfile } = useAuth();
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [duration, setDuration] = useState('');
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!session?.user.id) return;

    if (!role.trim() || !company.trim() || !goal.trim()) {
      Alert.alert('A little context helps', 'Add your role, company, and main goal.');
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        role: role.trim(),
        company: company.trim(),
        duration: duration.trim() || null,
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
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Set Your Internship Context</Text>
          <Text style={styles.subtitle}>Only once. WorkoWork uses this to keep your logs meaningful.</Text>
        </View>

        <TextInput onChangeText={setRole} placeholder="Role" style={styles.input} value={role} />
        <TextInput onChangeText={setCompany} placeholder="Company" style={styles.input} value={company} />
        <TextInput onChangeText={setDuration} placeholder="Duration" style={styles.input} value={duration} />
        <TextInput multiline onChangeText={setGoal} placeholder="Goal" style={[styles.input, styles.textArea]} textAlignVertical="top" value={goal} />

        <Pressable disabled={loading} onPress={handleSave} style={styles.primaryButton}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Continue</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
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
