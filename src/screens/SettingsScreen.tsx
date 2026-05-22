import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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

import { getGeminiApiKey, saveGeminiApiKey } from '../services/userSettings';
import {
  acknowledgeGeminiSidebarAlert,
  dismissGeminiErrorCard,
  getVisibleGeminiErrorLog,
  subscribeToGeminiErrorChanges,
} from '../services/geminiAlerts';
import { colors } from '../styles/theme';

type VisibleError = Awaited<ReturnType<typeof getVisibleGeminiErrorLog>>;

export default function SettingsScreen() {
  const [geminiKey, setGeminiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geminiError, setGeminiError] = useState<VisibleError>(null);

  const loadGeminiError = useCallback(async () => {
    setGeminiError(await getVisibleGeminiErrorLog());
  }, []);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      setLoading(true);
      acknowledgeGeminiSidebarAlert();
      getGeminiApiKey()
        .then((key) => {
          if (mounted) setGeminiKey(key ?? '');
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
      loadGeminiError();

      return () => {
        mounted = false;
      };
    }, [loadGeminiError])
  );

  useEffect(() => {
    const unsubscribe = subscribeToGeminiErrorChanges(() => {
      loadGeminiError();
    });

    return () => {
      unsubscribe();
    };
  }, [loadGeminiError]);

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

  const handleDismissError = async () => {
    setGeminiError(null);
    await dismissGeminiErrorCard();
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

      {geminiError && (
        <View style={styles.errorCard}>
          <Pressable onPress={handleDismissError} style={({ pressed }) => [styles.errorCloseButton, pressed && styles.errorCloseButtonPressed]}>
            <Text style={styles.errorCloseText}>×</Text>
          </Pressable>
          <Text style={styles.errorTitle}>Gemini issue detected</Text>
          <Text style={styles.errorSource}>{geminiError.source === 'daily-analysis' ? 'Daily analysis' : geminiError.source === 'weekly-reflection' ? 'Weekly reflection' : 'Gemini'}</Text>
          <Text style={styles.errorMessage}>{geminiError.message}</Text>
          {geminiError.details ? <Text style={styles.errorDetails}>{geminiError.details}</Text> : null}
        </View>
      )}
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
  errorCard: {
    backgroundColor: '#FFF3F3',
    borderColor: '#E6B9B9',
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
    position: 'relative',
  },
  errorCloseButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    top: 10,
    width: 28,
  },
  errorCloseButtonPressed: {
    opacity: 0.7,
  },
  errorCloseText: {
    color: colors.primary,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 18,
  },
  errorTitle: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    paddingRight: 34,
  },
  errorSource: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    opacity: 0.72,
    textTransform: 'uppercase',
  },
  errorMessage: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  errorDetails: {
    color: colors.primary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    opacity: 0.82,
  },
  title: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: '800',
  },
});

