import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';

import { getGeminiApiKey, saveGeminiApiKey } from '../services/userSettings';
import { colors } from '../styles/theme';

export default function SettingsScreen() {
  const [geminiKey, setGeminiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      setLoading(true);
      getGeminiApiKey()
        .then((key) => {
          if (mounted) setGeminiKey(key ?? '');
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });

      return () => {
        mounted = false;
      };
    }, [])
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveGeminiApiKey(geminiKey);
      Alert.alert('Saved', geminiKey.trim() ? 'Gemini API key saved.' : 'Gemini API key removed.');
    } catch (error) {
      console.log('Gemini key save failed', error);
      Alert.alert('Save failed', 'Could not save the Gemini API key on this device.');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <ScrollView contentContainerStyle={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.label}>Gemini API Key</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setGeminiKey}
        placeholder="Paste your Gemini API key"
        secureTextEntry
        style={styles.input}
        value={geminiKey}
      />
      <Pressable disabled={saving} onPress={handleSave} style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}>
        {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Save</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    padding: 20,
    paddingBottom: 36,
    paddingTop: 92,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 32,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    marginTop: 8,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  label: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 28,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 30,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 50,
  },
  saveButtonPressed: {
    opacity: 0.82,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  title: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: '800',
  },
});
