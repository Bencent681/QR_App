import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AdminScreenFrame from '@/components/AdminScreenFrame';
import { COLORS } from '@/constants/colors';
import { useAdminAccess } from '@/lib/useAdminAccess';

const managementLinks = [
  {
    title: 'Manage Users',
    description: 'Search profile names, emails, and roles.',
    icon: 'people-outline' as const,
    route: '/(tabs)/manage-users' as const,
  },
  {
    title: 'Event Monitoring',
    description: 'Review event codes, schedules, and creator IDs.',
    icon: 'calendar-outline' as const,
    route: '/(tabs)/event-monitoring' as const,
  },
  {
    title: 'Attendance Management',
    description: 'Review attendance rows visible to this account.',
    icon: 'clipboard-outline' as const,
    route: '/(tabs)/attendance-management' as const,
  },
];

export default function AdminScreen() {
  const access = useAdminAccess();
  const router = useRouter();

  return (
    <AdminScreenFrame
      access={access}
      title="Admin Dashboard"
      subtitle="Read-only administration tools"
    >
      <View style={styles.introCard}>
        <Ionicons
          name="shield-checkmark-outline"
          size={24}
          color={COLORS.primary}
        />
        <View style={styles.introTextContainer}>
          <Text style={styles.introTitle}>Repository-backed views</Text>
          <Text style={styles.introText}>
            Screen access is checked in the app, while Supabase RLS controls
            which records can actually be read.
          </Text>
        </View>
      </View>

      <View style={styles.links}>
        {managementLinks.map((item) => (
          <Pressable
            key={item.title}
            onPress={() => router.push(item.route)}
            style={({ pressed }) => [
              styles.linkCard,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.title}`}
          >
            <View style={styles.linkIcon}>
              <Ionicons
                name={item.icon}
                size={24}
                color={COLORS.primary}
              />
            </View>
            <View style={styles.linkText}>
              <Text style={styles.linkTitle}>{item.title}</Text>
              <Text style={styles.linkDescription}>{item.description}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.textMuted}
            />
          </Pressable>
        ))}
      </View>

      <View style={styles.securityNote}>
        <Text style={styles.securityTitle}>Privileged actions are disabled</Text>
        <Text style={styles.securityText}>
          Role changes require a verified server-side operation. Attendance
          correction and deletion remain disabled because their RPC definitions,
          grants, and authorization checks are not present in the repository.
        </Text>
      </View>
    </AdminScreenFrame>
  );
}

const styles = StyleSheet.create({
  introCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 18,
  },
  introTextContainer: {
    flex: 1,
    gap: 5,
  },
  introTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  introText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  links: {
    gap: 11,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
  },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  linkText: {
    flex: 1,
    gap: 4,
  },
  linkTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  linkDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  securityNote: {
    borderRadius: 12,
    backgroundColor: COLORS.warningLight,
    borderWidth: 1,
    borderColor: COLORS.warning,
    padding: 14,
    marginTop: 18,
  },
  securityTitle: {
    color: COLORS.warning,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 5,
  },
  securityText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.72,
  },
});
