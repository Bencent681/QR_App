import type { ReactNode } from 'react';
import { useRouter, Redirect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import type { AdminAccess } from '@/lib/useAdminAccess';

type Props = {
  access: AdminAccess;
  title: string;
  subtitle: string;
  children: ReactNode;
  showBackButton?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export default function AdminScreenFrame({
  access,
  title,
  subtitle,
  children,
  showBackButton = false,
  refreshing = false,
  onRefresh,
}: Props) {
  const router = useRouter();

  if (!access.userId) {
    return <Redirect href="/login" />;
  }

  if (access.loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.stateText}>Verifying administrator access...</Text>
      </SafeAreaView>
    );
  }

  if (access.role !== 'admin') {
    return (
      <SafeAreaView style={styles.centered}>
        <Ionicons
          name="lock-closed-outline"
          size={44}
          color={COLORS.danger}
        />
        <Text style={styles.deniedTitle}>Access Restricted</Text>
        <Text style={styles.stateText}>
          {access.error ??
            'This screen is only available to administrator accounts.'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          ) : undefined
        }
      >
        {showBackButton ? (
          <Pressable
            onPress={() => router.replace('/(tabs)/admin')}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Back to Admin Dashboard"
          >
            <Ionicons
              name="arrow-back"
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.backButtonText}>Admin Dashboard</Text>
          </Pressable>
        ) : null}
        <Header title={title} />
        <Text style={styles.subtitle}>{subtitle}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 24,
  },
  stateText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
  },
  deniedTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 18,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
