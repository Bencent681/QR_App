
import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  getAttendanceHistory,
  getTeacherDashboardData,
  type AttendanceRecord,
} from '@/lib/attendance';
import type { CloudEvent } from '@/lib/events';
import { getProfile, type Role } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

type StudentEvent = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
};

const STUDENT_DASHBOARD_COLORS = {
  primary: COLORS.primary,
  primaryDark: COLORS.primaryDark,
  primaryLight: COLORS.primaryLight,
  background: COLORS.background,
  card: COLORS.card,
  text: COLORS.textPrimary,
  secondaryText: COLORS.textSecondary,
  border: COLORS.border,
  success: COLORS.success,
} as const;

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

function getStudentEventStatus(
  event: StudentEvent,
  now = Date.now()
) {
  return now < new Date(event.start_time).getTime()
    ? 'Upcoming' as const
    : 'Ongoing' as const;
}

function formatStudentEventTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Time unavailable';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
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
  const [studentEvents, setStudentEvents] = useState<StudentEvent[]>([]);
  const [studentAttendance, setStudentAttendance] = useState<AttendanceRecord[]>([]);
  const [studentDashboardLoading, setStudentDashboardLoading] = useState(true);
  const [studentDashboardError, setStudentDashboardError] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [selectedStudentEvent, setSelectedStudentEvent] =
    useState<StudentEvent | null>(null);

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

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (role !== 'student' || !user) {
        setStudentEvents([]);
        setStudentAttendance([]);
        setStudentDashboardLoading(false);
        setShowAllEvents(false);
        setSelectedStudentEvent(null);

        return () => {
          active = false;
        };
      }

      const studentId = user.id;
      setStudentDashboardLoading(true);
      setStudentDashboardError(false);

      async function loadStudentDashboard() {
        try {
          const [eventsResult, attendanceRecords] = await Promise.all([
            supabase
              .from('events')
              .select('id, title, start_time, end_time')
              .not('start_time', 'is', null)
              .not('end_time', 'is', null)
              .gte('end_time', new Date().toISOString())
              .order('start_time', { ascending: true }),
            getAttendanceHistory(studentId),
          ]);

          if (!active) return;

          if (eventsResult.error) {
            console.log('STUDENT UPCOMING EVENTS ERROR:', eventsResult.error);
            setStudentEvents([]);
            setStudentDashboardError(true);
          } else {
            setStudentEvents((eventsResult.data ?? []) as StudentEvent[]);
          }

          setStudentAttendance(attendanceRecords);
        } catch (error) {
          console.log('STUDENT DASHBOARD LOAD ERROR:', error);

          if (active) {
            setStudentEvents([]);
            setStudentAttendance([]);
            setStudentDashboardError(true);
          }
        } finally {
          if (active) {
            setStudentDashboardLoading(false);
          }
        }
      }

      loadStudentDashboard();

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

  const now = Date.now();
  const upcomingCount = studentEvents.filter(
    (event) => getStudentEventStatus(event, now) === 'Upcoming'
  ).length;
  const visibleStudentEvents = showAllEvents
    ? studentEvents
    : studentEvents.slice(0, 3);

  return (
    <SafeAreaView style={styles.studentScreen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.studentContent}
      >
        <View style={styles.studentHeader}>
          <View style={styles.studentHeaderText}>
            <Text style={styles.studentTitle}>Student Dashboard</Text>
            <Text style={styles.studentWelcome}>Welcome back!</Text>
          </View>
          <View style={styles.studentHeaderIcon}>
            <Ionicons
              name="school-outline"
              size={23}
              color={STUDENT_DASHBOARD_COLORS.primary}
            />
          </View>
        </View>

        <View style={styles.studentSummaryRow}>
          <View style={styles.studentSummaryCard}>
            <View style={styles.studentSummaryIcon}>
              <Ionicons
                name="checkmark-done-outline"
                size={18}
                color={STUDENT_DASHBOARD_COLORS.primary}
              />
            </View>
            <Text style={styles.studentSummaryValue}>
              {studentDashboardLoading ? '—' : studentAttendance.length}
            </Text>
            <Text style={styles.studentSummaryLabel}>Events attended</Text>
          </View>

          <View style={styles.studentSummaryCard}>
            <View style={styles.studentSummaryIcon}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={STUDENT_DASHBOARD_COLORS.primary}
              />
            </View>
            <Text style={styles.studentSummaryValue}>
              {studentDashboardLoading || studentDashboardError
                ? '—'
                : upcomingCount}
            </Text>
            <Text style={styles.studentSummaryLabel}>Upcoming events</Text>
          </View>
        </View>

        <View style={styles.studentSection}>
          <View style={styles.studentSectionHeader}>
            <Text style={styles.studentSectionTitle}>Upcoming Events</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAllEvents((current) => !current)}
              style={styles.studentViewAll}
            >
              <Text style={styles.studentViewAllText}>
                {showAllEvents ? 'Show less' : 'View all'}
              </Text>
              <Ionicons
                name={showAllEvents ? 'chevron-up' : 'chevron-forward'}
                size={15}
                color={STUDENT_DASHBOARD_COLORS.primary}
              />
            </Pressable>
          </View>

          {studentDashboardLoading ? (
            <View style={styles.studentEmptyState}>
              <ActivityIndicator color={STUDENT_DASHBOARD_COLORS.primary} />
              <Text style={styles.studentEmptyText}>Loading events...</Text>
            </View>
          ) : studentDashboardError ? (
            <View style={styles.studentEmptyState}>
              <Text style={styles.studentEmptyText}>
                Upcoming events are unavailable right now.
              </Text>
            </View>
          ) : studentEvents.length === 0 ? (
            <View style={styles.studentEmptyState}>
              <Ionicons
                name="calendar-clear-outline"
                size={23}
                color={STUDENT_DASHBOARD_COLORS.secondaryText}
              />
              <Text style={styles.studentEmptyText}>No upcoming events</Text>
            </View>
          ) : (
            visibleStudentEvents.map((event) => {
              const status = getStudentEventStatus(event, now);

              return (
                <View key={event.id} style={styles.studentEventCard}>
                  <View style={styles.studentEventHeader}>
                    <Text style={styles.studentEventTitle} numberOfLines={2}>
                      {event.title}
                    </Text>
                    <View
                      style={[
                        styles.studentStatusBadge,
                        status === 'Ongoing'
                          ? styles.studentOngoingBadge
                          : styles.studentUpcomingBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.studentStatusText,
                          status === 'Ongoing'
                            ? styles.studentOngoingText
                            : styles.studentUpcomingText,
                        ]}
                      >
                        {status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.studentEventTimeRow}>
                    <Ionicons
                      name="time-outline"
                      size={15}
                      color={STUDENT_DASHBOARD_COLORS.secondaryText}
                    />
                    <Text style={styles.studentEventTime} numberOfLines={1}>
                      Starts {formatStudentEventTime(event.start_time)}
                    </Text>
                  </View>
                  <View style={styles.studentEventTimeRow}>
                    <Ionicons
                      name="time-outline"
                      size={15}
                      color={STUDENT_DASHBOARD_COLORS.secondaryText}
                    />
                    <Text style={styles.studentEventTime} numberOfLines={1}>
                      Ends {formatStudentEventTime(event.end_time)}
                    </Text>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSelectedStudentEvent(event)}
                    style={styles.studentDetailsButton}
                  >
                    <Text style={styles.studentDetailsText}>
                      View Event Details
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={16}
                      color={STUDENT_DASHBOARD_COLORS.primary}
                    />
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.studentSection}>
          <View style={styles.studentSectionHeader}>
            <Text style={styles.studentSectionTitle}>My Recent Attendance</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/history')}
              style={styles.studentViewAll}
            >
              <Text style={styles.studentViewAllText}>View all</Text>
              <Ionicons
                name="chevron-forward"
                size={15}
                color={STUDENT_DASHBOARD_COLORS.primary}
              />
            </Pressable>
          </View>

          {studentDashboardLoading ? (
            <View style={styles.studentEmptyState}>
              <ActivityIndicator color={STUDENT_DASHBOARD_COLORS.primary} />
              <Text style={styles.studentEmptyText}>Loading attendance...</Text>
            </View>
          ) : studentAttendance.length === 0 ? (
            <View style={styles.studentEmptyState}>
              <Ionicons
                name="receipt-outline"
                size={23}
                color={STUDENT_DASHBOARD_COLORS.secondaryText}
              />
              <Text style={styles.studentEmptyText}>
                No attendance records yet
              </Text>
            </View>
          ) : (
            studentAttendance.slice(0, 3).map((record) => (
              <View key={record.id} style={styles.studentAttendanceRow}>
                <View style={styles.studentAttendanceIcon}>
                  <Ionicons
                    name="checkmark"
                    size={17}
                    color={STUDENT_DASHBOARD_COLORS.success}
                  />
                </View>
                <View style={styles.studentAttendanceText}>
                  <Text style={styles.studentAttendanceTitle} numberOfLines={1}>
                    {record.eventTitle}
                  </Text>
                  <Text style={styles.studentAttendanceDate}>
                    {formatStudentEventTime(record.scannedAt)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={selectedStudentEvent !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedStudentEvent(null)}
      >
        <View style={styles.studentModalOverlay}>
          <View style={styles.studentModalCard}>
            <View style={styles.studentModalHeader}>
              <Text style={styles.studentModalTitle} numberOfLines={2}>
                {selectedStudentEvent?.title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close event details"
                onPress={() => setSelectedStudentEvent(null)}
                style={styles.studentModalClose}
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={STUDENT_DASHBOARD_COLORS.secondaryText}
                />
              </Pressable>
            </View>
            {selectedStudentEvent && (
              <>
                <View
                  style={[
                    styles.studentStatusBadge,
                    getStudentEventStatus(selectedStudentEvent) === 'Ongoing'
                      ? styles.studentOngoingBadge
                      : styles.studentUpcomingBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.studentStatusText,
                      getStudentEventStatus(selectedStudentEvent) === 'Ongoing'
                        ? styles.studentOngoingText
                        : styles.studentUpcomingText,
                    ]}
                  >
                    {getStudentEventStatus(selectedStudentEvent)}
                  </Text>
                </View>
                <Text style={styles.studentModalLabel}>STARTS</Text>
                <Text style={styles.studentModalValue}>
                  {formatStudentEventTime(selectedStudentEvent.start_time)}
                </Text>
                <Text style={styles.studentModalLabel}>ENDS</Text>
                <Text style={styles.studentModalValue}>
                  {formatStudentEventTime(selectedStudentEvent.end_time)}
                </Text>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  studentScreen: {
    flex: 1,
    backgroundColor: STUDENT_DASHBOARD_COLORS.background,
  },

  studentContent: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },

  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  studentHeaderText: {
    flex: 1,
    minWidth: 0,
  },

  studentTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: STUDENT_DASHBOARD_COLORS.text,
    marginBottom: 5,
  },

  studentWelcome: {
    fontSize: 14,
    color: STUDENT_DASHBOARD_COLORS.secondaryText,
  },

  studentHeaderIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: STUDENT_DASHBOARD_COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  studentSummaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 25,
  },

  studentSummaryCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 122,
    backgroundColor: STUDENT_DASHBOARD_COLORS.card,
    borderWidth: 1,
    borderColor: STUDENT_DASHBOARD_COLORS.border,
    borderRadius: 14,
    padding: 13,
  },

  studentSummaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: STUDENT_DASHBOARD_COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  studentSummaryValue: {
    fontSize: 22,
    fontWeight: '700',
    color: STUDENT_DASHBOARD_COLORS.text,
  },

  studentSummaryLabel: {
    fontSize: 11,
    color: STUDENT_DASHBOARD_COLORS.secondaryText,
    marginTop: 2,
  },

  studentSection: {
    marginBottom: 24,
  },

  studentSectionHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  studentSectionTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: STUDENT_DASHBOARD_COLORS.text,
    marginRight: 8,
  },

  studentViewAll: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
  },

  studentViewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: STUDENT_DASHBOARD_COLORS.primaryDark,
    marginRight: 3,
  },

  studentEmptyState: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: STUDENT_DASHBOARD_COLORS.card,
    borderWidth: 1,
    borderColor: STUDENT_DASHBOARD_COLORS.border,
    borderRadius: 14,
    padding: 16,
  },

  studentEmptyText: {
    fontSize: 13,
    color: STUDENT_DASHBOARD_COLORS.secondaryText,
    marginLeft: 8,
  },

  studentEventCard: {
    backgroundColor: STUDENT_DASHBOARD_COLORS.card,
    borderWidth: 1,
    borderColor: STUDENT_DASHBOARD_COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },

  studentEventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },

  studentEventTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
    color: STUDENT_DASHBOARD_COLORS.text,
    marginRight: 8,
  },

  studentStatusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },

  studentUpcomingBadge: {
    backgroundColor: STUDENT_DASHBOARD_COLORS.primaryLight,
  },

  studentOngoingBadge: {
    backgroundColor: COLORS.successLight,
  },

  studentStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },

  studentUpcomingText: {
    color: STUDENT_DASHBOARD_COLORS.primaryDark,
  },

  studentOngoingText: {
    color: STUDENT_DASHBOARD_COLORS.success,
  },

  studentEventTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },

  studentEventTime: {
    flex: 1,
    fontSize: 12,
    color: STUDENT_DASHBOARD_COLORS.secondaryText,
    marginLeft: 7,
  },

  studentDetailsButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 3,
    paddingRight: 8,
  },

  studentDetailsText: {
    fontSize: 12,
    fontWeight: '700',
    color: STUDENT_DASHBOARD_COLORS.primaryDark,
    marginRight: 6,
  },

  studentAttendanceRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: STUDENT_DASHBOARD_COLORS.card,
    borderWidth: 1,
    borderColor: STUDENT_DASHBOARD_COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },

  studentAttendanceIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLORS.successLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  studentAttendanceText: {
    flex: 1,
    minWidth: 0,
  },

  studentAttendanceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: STUDENT_DASHBOARD_COLORS.text,
    marginBottom: 4,
  },

  studentAttendanceDate: {
    fontSize: 11,
    color: STUDENT_DASHBOARD_COLORS.secondaryText,
  },

  studentModalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 20,
  },

  studentModalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: STUDENT_DASHBOARD_COLORS.card,
    borderRadius: 18,
    padding: 20,
  },

  studentModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },

  studentModalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
    color: STUDENT_DASHBOARD_COLORS.text,
    marginRight: 8,
  },

  studentModalClose: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: STUDENT_DASHBOARD_COLORS.background,
  },

  studentModalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: STUDENT_DASHBOARD_COLORS.secondaryText,
    marginTop: 17,
    marginBottom: 4,
  },

  studentModalValue: {
    fontSize: 14,
    color: STUDENT_DASHBOARD_COLORS.text,
  },

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
