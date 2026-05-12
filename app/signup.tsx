import { Link, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/src/services/supabase';
import { colors } from '@/src/styles/theme';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      Alert.alert('Missing details', 'Add your name, email, and a password of at least 6 characters.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: name.trim(),
        },
      },
    });

    if (error || !data.user) {
      setLoading(false);
      Alert.alert('Signup failed', error?.message ?? 'Could not create your account.');
      return;
    }

    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      name: name.trim(),
      email: email.trim(),
    });

    setLoading(false);

    if (profileError && !data.session) {
      Alert.alert('Account created', 'Confirm your email if Supabase asks, then log in.');
      router.replace('/login');
      return;
    }

    if (profileError) {
      Alert.alert('Profile setup failed', profileError.message);
      return;
    }

    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>A quiet place for your internship record.</Text>
      </View>

      <View style={styles.form}>
        <TextInput onChangeText={setName} placeholder="Name" style={styles.input} value={name} />
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          style={styles.input}
          value={email}
        />
        <TextInput
          autoCapitalize="none"
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          style={styles.input}
          value={password}
        />

        <Pressable disabled={loading} onPress={handleSignup} style={styles.primaryButton}>
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>Create Account</Text>
          )}
        </Pressable>

        <Link href="/login" style={styles.link}>
          Back to Login
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  form: {
    gap: 14,
  },
  header: {
    marginBottom: 36,
  },
  input: {
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  link: {
    alignSelf: 'center',
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
    padding: 8,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    minHeight: 52,
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    marginTop: 8,
  },
  title: {
    color: colors.primary,
    fontSize: 30,
    fontWeight: '800',
  },
});
