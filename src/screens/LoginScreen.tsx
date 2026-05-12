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

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      Alert.alert('Login failed', error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Top decorative rule */}
      <View style={styles.topRule} />

      <View style={styles.inner}>
        {/* Brand Section */}
        <View style={styles.brand}>
          <Text style={styles.logo}>WorkoWork</Text>
          <View style={styles.taglineRow}>
            <Text style={styles.subtitle}>Reflect. Improve. Document.</Text>
          </View>
        </View>

        {/* Form Section */}
        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              placeholder="you@example.com"
              placeholderTextColor={design.placeholder}
              style={[styles.input, emailFocused && styles.inputFocused]}
              value={email}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              autoCapitalize="none"
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              placeholder="••••••••"
              placeholderTextColor={design.placeholder}
              secureTextEntry
              style={[styles.input, passwordFocused && styles.inputFocused]}
              value={password}
            />
          </View>

          <View style={styles.buttonStack}>
            <Pressable
              disabled={loading}
              onPress={handleLogin}
              style={({ pressed }) => [
                styles.primaryButton,
                loading && styles.primaryButtonLoading,
                pressed && !loading && styles.primaryButtonPressed,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign in</Text>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              onPress={() => navigation.navigate('Signup')}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonPressed,
              ]}
            >
              <Text style={styles.secondaryText}>Create an account</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Bottom mark */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Your private work journal</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

// Design tokens — kept separate for clarity
const design = {
  bg: '#FAFAF8',           // warm off-white
  surface: '#FFFFFF',
  ink: '#111111',          // near-black for headings / button
  inkMid: '#444444',       // body text
  inkMuted: '#999999',     // labels, hints
  placeholder: '#BBBBBB',
  border: '#E4E3DF',       // warm-neutral border
  borderFocus: '#111111',  // sharp focus ring
  accent: '#555555',       // secondary action text
  rule: '#E4E3DF',
  logoFont: Platform.OS === 'ios' ? 'Georgia' : 'serif',
};

const styles = StyleSheet.create({
  // ─── Shell ─────────────────────────────────────────────────────────────────
  container: {
    backgroundColor: design.bg,
    flex: 1,
  },
  topRule: {
    backgroundColor: design.ink,
    height: 3,
    width: 40,
    marginTop: 56,
    marginLeft: 32,
    borderRadius: 2,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 32,
  },

  // ─── Brand ─────────────────────────────────────────────────────────────────
  brand: {
    marginBottom: 32,
  },
  logo: {
    color: design.ink,
    fontFamily: design.logoFont,
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 44,
    alignContent: 'center',
    margin: 0
  },
  taglineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 2,
    gap: 10,
  },
  taglineDash: {
    backgroundColor: design.inkMuted,
    height: 1,
    width: 18,
  },
  subtitle: {
    color: design.inkMuted,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // ─── Form ──────────────────────────────────────────────────────────────────
  form: {
    gap: 0,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    color: design.inkMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: design.surface,
    borderColor: design.border,
    borderRadius: 32,
    borderWidth: 1.5,
    color: design.ink,
    fontSize: 14,
    fontWeight: '400',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputFocused: {
    borderColor: design.borderFocus,
    // Subtle shadow for depth on focus
    shadowColor: design.ink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // ─── Buttons ───────────────────────────────────────────────────────────────
  buttonStack: {
    gap: 0,
    marginTop: 8,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: design.ink,
    borderRadius: 32,
    justifyContent: 'center',
    minHeight: 44,
    marginBottom: 0,
  },
  primaryButtonLoading: {
    opacity: 0.55,
  },
  primaryButtonPressed: {
    opacity: 0.82,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: {
    backgroundColor: design.rule,
    flex: 1,
    height: 1,
  },
  dividerText: {
    color: design.inkMuted,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  secondaryButton: {
    alignItems: 'center',
    borderColor: design.border,
    borderRadius: 32,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 44,
  },
  secondaryButtonPressed: {
    backgroundColor: '#F5F5F2',
  },
  secondaryText: {
    color: design.inkMid,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  // ─── Footer ────────────────────────────────────────────────────────────────
  footer: {
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingTop: 8,
  },
  footerText: {
    color: design.rule,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});