
import { Redirect, Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';

import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { initializeAuth, useAuth } from '@/lib/auth';

export default function RootLayout() {
  const { session, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    console.log('ROOT LAYOUT: Initializing authentication');

    const cleanup = initializeAuth();

    return () => {
      console.log('ROOT LAYOUT: Cleaning up authentication');
      cleanup();
    };
  }, []);

  useEffect(() => {
    console.log('ROOT DEBUG: Auth loading:', loading);
    console.log('ROOT DEBUG: Session exists:', !!session);
    console.log('ROOT DEBUG: Current route:', segments);
  }, [loading, session, segments]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
      </View>
    );
  }

  const path = segments?.[0];

  const inAuthGroup =
    path === 'login' || path === 'register';

  const inTabsGroup = path === '(tabs)';

  if (!session && inTabsGroup) {
    console.log('ROOT DEBUG: Redirecting to login');

    return <Redirect href="/login" />;
  }

  if (session && inAuthGroup) {
    console.log('ROOT DEBUG: Redirecting to tabs');

    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
});