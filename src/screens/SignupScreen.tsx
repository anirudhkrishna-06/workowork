import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
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

import { RootStackParamList } from '../navigation/types';
import { supabase } from '../services/supabase';
import { colors } from '../styles/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
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
      options: { data: { name: name.trim() } },
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
      navigation.navigate('Login');
      return;
    }

    if (profileError) {
      Alert.alert('Profile setup failed', profileError.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Create Account</Text>
      </View>

      <View style={styles.form}>
        <TextInput onChangeText={setName} placeholder="Name" style={styles.input} value={name} />
        <TextInput
          autoCapitalize="none"
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

        <Pressable onPress={() => navigation.navigate('Login')} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Back to Login</Text>
        </Pressable>
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
    borderRadius: 32,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 32,
    justifyContent: 'center',
    minHeight: 42,
    width: 220,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '400',
  },
  secondaryButton: {
    alignItems: 'center',
    padding: 8,
  },
  secondaryText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '400',
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
