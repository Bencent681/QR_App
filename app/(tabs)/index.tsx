
import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getTeacherDashboardData } from '@/lib/attendance';
import type { CloudEvent } from '@/lib/events';
import { getProfile, type Role } from '@/lib/profiles';

function formatEventDate(value: string | null) {
  if (!value) {
    return 'Date not set';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Index() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [teacherEvents, setTeacherEvents] = useState<CloudEvent[]>([]);
  const [attendanceCount, setAttendanceCount] = useState<number | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkUserRole() {
      if (!user) {
        setRole(null);
        return;
      }

      try {
        const profile = await getProfile(user.id);

        if (active) {
          setRole(profile?.role ?? null);

          if (profile?.role === 'admin') {
            router.replace('/(tabs)/admin');
          }
        }
      } catch (error) {
        console.log('HOME ROLE CHECK ERROR:', error);
      }
    }

    checkUserRole();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (role !== 'teacher' || !user) {
        setTeacherEvents([]);
        setAttendanceCount(null);
        setDashboardLoading(false);

        return () => {
          active = false;
        };
      }

      setDashboardLoading(true);
      setDashboardError(false);

      getTeacherDashboardData(user.id)
        .then((dashboardData) => {
          if (!active) {
            return;
          }

          setTeacherEvents(dashboardData.events ?? []);
          setDashboardError(dashboardData.events === null);
          setAttendanceCount(dashboardData.attendanceCount);
        })
        .catch((error) => {
          console.log('TEACHER DASHBOARD LOAD ERROR:', error);

          if (active) {
            setTeacherEvents([]);
            setAttendanceCount(null);
            setDashboardError(true);
          }
        })
        .finally(() => {
          if (active) {
            setDashboardLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, [role, user?.id])
  );

  if (role === 'teacher') {
    const openMyEvents = () => router.push('/teacher');
    const statValue = (value: number | null) =>
      dashboardLoading || dashboardError || value === null
        ? '—'
        : String(value);

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.teacherContent}
        >
          <View style={styles.teacherHeader}>
            <View style={styles.teacherHeaderText}>
              <Text style={styles.teacherTitle}>Teacher Dashboard</Text>
              <Text style={styles.teacherSubtitle}>
                Manage your school activities
              </Text>
            </View>
            <View style={styles.teacherIcon}>
              <Ionicons name="school-outline" size={24} color={COLORS.primary} />
            </View>
          </View>

          <View style={styles.manageCard}>
            <View style={styles.manageCardHeading}>
              <View style={styles.manageIcon}>
                <Ionicons
                  name="calendar-outline"
                  size={21}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.manageTitle}>Manage Your Events</Text>
            </View>
            <Text style={styles.manageDescription}>
              Create activities, generate QR codes, and monitor student attendance.
            </Text>
            <AppButton
              theme="primary"
              title="Create New Event"
              icon="add-circle-outline"
              onPress={openMyEvents}
            />
          </View>

          <View style={styles.dashboardSection}>
            <Text style={styles.dashboardSectionTitle}>Overview</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>TOTAL EVENTS</Text>
                <Text style={styles.statValue}>
                  {statValue(dashboardError ? null : teacherEvents.length)}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>ATTENDANCE RECORDS</Text>
                <Text style={styles.statValue}>
                  {statValue(attendanceCount)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.dashboardSection}>
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.dashboardSectionTitle}>My Events</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View all events"
                onPress={openMyEvents}
                style={styles.viewAllButton}
              >
                <Text style={styles.viewAllText}>View All</Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={COLORS.primary}
                />
              </Pressable>
            </View>

            {dashboardLoading ? (
              <View style={styles.dashboardState}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.dashboardStateText}>Loading your events...</Text>
              </View>
            ) : dashboardError ? (
              <View style={styles.dashboardState}>
                <Text style={styles.dashboardStateText}>
                  Events are temporarily unavailable.
                </Text>
              </View>
            ) : teacherEvents.length === 0 ? (
              <View style={styles.emptyPreview}>
                <Text style={styles.emptyPreviewText}>No events yet</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={openMyEvents}
                  style={styles.emptyAction}
                >
                  <Text style={styles.emptyActionText}>Create your first event</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={15}
                    color={COLORS.primary}
                  />
                </Pressable>
              </View>
            ) : (
              teacherEvents.slice(0, 2).map((event) => (
                <Pressable
                  key={event.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open event ${event.title}`}
                  onPress={openMyEvents}
                  style={styles.eventPreview}
                >
                  <View style={styles.previewIcon}>
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={COLORS.primary}
                    />
                  </View>
                  <View style={styles.previewText}>
                    <Text style={styles.previewTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text style={styles.previewDate}>
                      {formatEventDate(event.start_time)}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={COLORS.textSecondary}
                  />
                </Pressable>
              ))
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={openMyEvents}
            style={styles.qrShortcut}
          >
            <View style={styles.qrShortcutIcon}>
              <Ionicons
                name="qr-code-outline"
                size={20}
                color={COLORS.primary}
              />
            </View>
            <View style={styles.qrShortcutText}>
              <Text style={styles.qrShortcutTitle}>QR codes & attendance</Text>
              <Text style={styles.qrShortcutSubtitle}>
                Open your event management tools
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.textSecondary}
            />
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Header title="QR Attendance" />

        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>Welcome back 👋</Text>
          <Text style={styles.welcomeSubtext}>
            Manage your school attendance easily.
          </Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.bodyContainer}>
        {/* Attendance Card */}
        <View style={styles.attendanceCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardLabel}>ATTENDANCE</Text>
              <Text style={styles.cardTitle}>School Activities</Text>
            </View>

            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>ACTIVE</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <Text style={styles.mainTitle}>Record your attendance</Text>

          <Text style={styles.description}>
            Scan the QR code provided by your instructor to record your
            attendance during school activities.
          </Text>
        </View>

      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  teacherContent: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 32,
  },

  teacherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  teacherHeaderText: {
    flex: 1,
  },

  teacherTitle: {
    fontSize: 23,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  teacherSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  teacherIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 211, 61, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 211, 61, 0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  manageCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 22,
  },

  manageCardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 11,
  },

  manageIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 211, 61, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  manageTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  manageDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    marginBottom: 14,
  },

  dashboardSection: {
    marginBottom: 22,
  },

  dashboardSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  statsRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 11,
  },

  statItem: {
    flex: 1,
  },

  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 5,
  },

  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.border,
    marginHorizontal: 13,
  },

  sectionHeadingRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  viewAllButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
  },

  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: 2,
  },

  dashboardState: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    padding: 14,
  },

  dashboardStateText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 9,
  },

  emptyPreview: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },

  emptyPreviewText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  emptyAction: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
  },

  emptyActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: 7,
  },

  eventPreview: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },

  previewIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 211, 61, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  previewText: {
    flex: 1,
    minWidth: 0,
  },

  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  previewDate: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  qrShortcut: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },

  qrShortcutIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 211, 61, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  qrShortcutText: {
    flex: 1,
    minWidth: 0,
  },

  qrShortcutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },

  qrShortcutSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  headerContainer: {
    paddingTop: 8,
  },

  welcomeContainer: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 10,
  },

  welcomeText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },

  welcomeSubtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  bodyContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 14,
  },

  attendanceCard: {
    backgroundColor: '#1C1F22',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2E33',
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: COLORS.textSecondary,
    marginBottom: 5,
  },

  cardTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#2B2E25',
  },

  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFD33D',
    letterSpacing: 0.8,
  },

  cardDivider: {
    height: 1,
    backgroundColor: '#2A2E33',
    marginVertical: 18,
  },

  mainTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  description: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
  },

});
