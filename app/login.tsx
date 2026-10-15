
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { signIn } from '@/lib/auth';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;

    setError(null);
    setLoading(true);

    try {
      const { error: authError } = await signIn(
        email.trim(),
        password
      );

      if (authError) {
        setError(authError.message);
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unexpected error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top },
      ]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : Platform.OS === 'android'
              ? 'height'
              : undefined
        }
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={
            Platform.OS === 'ios' ? 'interactive' : 'on-drag'
          }
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <View style={styles.headerContainer}>
            <Header title="QR Attendance" />
          </View>

          <Text style={styles.title}>Welcome Back</Text>

          <Text style={styles.subtitle}>
            Sign in to record your attendance
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>

            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your.email@school.edu"
              placeholderTextColor={COLORS.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!loading}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                // Keep the email field usable when submitting.
              }}
            />

            <Text style={styles.label}>Password</Text>

            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.textSecondary}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                editable={!loading}
                returnKeyType="go"
                onSubmitEditing={handleLogin}
              />
              <Pressable
                style={styles.passwordVisibilityButton}
                onPress={() => setPasswordVisible(!passwordVisible)}
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                hitSlop={8}
              >
                <Ionicons
                  name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={COLORS.textSecondary}
                />
              </Pressable>
            </View>

            {error ? (
              <Text style={styles.error}>{error}</Text>
            ) : null}

            {loading ? (
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={styles.loader}
              />
            ) : (
              <AppButton
                theme="primary"
                title="Sign In"
                icon="log-in-outline"
                onPress={handleLogin}
              />
            )}
          </View>

          <Link href="/register" style={styles.link}>
            Don't have an account? Sign Up
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  keyboardView: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  headerContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'left',
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.textSecondary,
    textAlign: 'left',
    marginBottom: 32,
  },

  form: {
    marginBottom: 24,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
    marginTop: 10,
  },

  input: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: COLORS.textPrimary,
  },

  passwordInputContainer: {
    position: 'relative',
  },

  passwordInput: {
    paddingRight: 48,
  },

  passwordVisibilityButton: {
    position: 'absolute',
    top: 0,
    right: 12,
    bottom: 0,
    justifyContent: 'center',
  },

  error: {
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'left',
    marginTop: 12,
    marginBottom: 4,
  },

  loader: {
    marginVertical: 16,
  },

  link: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
});
