import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import {
  getProfile,
  type Role,
} from '@/lib/profiles';

export default function HistoryScreen() {
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);

  const [studentRecords, setStudentRecords] =
    useState<AttendanceRecord[]>([]);

  const [teacherEvents, setTeacherEvents] =
    useState<TeacherEventAttendance[]>([]);

  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    if (!user) {
      setRole(null);
      setStudentRecords([]);
      setTeacherEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const profile = await getProfile(user.id);

      const currentRole: Role =
        profile?.role ?? 'student';

      setRole(currentRole);

      if (currentRole === 'teacher') {
        const events =
          await getTeacherEventAttendance(user.id);

        setTeacherEvents(events);
        setStudentRecords([]);
      } else {
        const records =
          await getAttendanceHistory(user.id);

        setStudentRecords(records);
        setTeacherEvents([]);
      }
    } catch (error) {
      console.log(
        'HISTORY LOAD ERROR:',
        error
      );

      setStudentRecords([]);
      setTeacherEvents([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  /* =========================
     LOADING
  ========================= */

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIcon}>
            <Text style={styles.loadingIconText}>
              ↻
            </Text>
          </View>

          <Text style={styles.loadingTitle}>
            Loading attendance
          </Text>

          <Text style={styles.loadingSubtitle}>
            Please wait while we retrieve your records.
          </Text>
        </View>
      </View>
    );
  }

  /* =========================
     TEACHER VIEW
  ========================= */

  if (role === 'teacher') {
    return (
      <View style={styles.container}>
        <FlatList
          data={teacherEvents}
          keyExtractor={(item) => item.eventId}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <View style={styles.pageHeader}>
                <View>
                  <Text style={styles.pageTitle}>
                    Attendance
                  </Text>

                  <Text style={styles.pageSubtitle}>
                    Monitor attendance from your events
                  </Text>
                </View>

                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>
                    TEACHER
                  </Text>
                </View>
              </View>

              <View style={styles.summaryCard}>
                <View style={styles.summaryIcon}>
                  <Text style={styles.summaryIconText}>
                    ✓
                  </Text>
                </View>

                <View style={styles.summaryInfo}>
                  <Text style={styles.summaryLabel}>
                    EVENTS
                  </Text>

                  <Text style={styles.summaryValue}>
                    {teacherEvents.length}
                  </Text>

                  <Text style={styles.summaryDescription}>
                    Attendance events created
                  </Text>
                </View>
              </View>

              {teacherEvents.length > 0 && (
                <Text style={styles.sectionTitle}>
                  Your Events
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>
                  +
                </Text>
              </View>

              <Text style={styles.emptyTitle}>
                No events yet
              </Text>

              <Text style={styles.emptySubtitle}>
                Create an event to start recording
                student attendance.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.eventHeader}>
                <View style={styles.eventIcon}>
                  <Text style={styles.eventIconText}>
                    QR
                  </Text>
                </View>

                <View style={styles.eventTitleContainer}>
                  <Text
                    style={styles.eventTitle}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>

                  <Text style={styles.eventCode}>
                    Code: {item.eventCode}
                  </Text>
                </View>

                <View style={styles.countBadge}>
                  <Text style={styles.countText}>
                    {item.attendeeCount}
                  </Text>

                  <Text style={styles.countLabel}>
                    ATTENDED
                  </Text>
                </View>
              </View>

              {item.startTime && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>
                    START TIME
                  </Text>

                  <Text style={styles.infoValue}>
                    {formatDate(item.startTime)}
                  </Text>
                </View>
              )}

              <View style={styles.attendeeSection}>
                <Text style={styles.attendeeTitle}>
                  Students Attended
                </Text>

                {item.attendees.length === 0 ? (
                  <View style={styles.noAttendeesBox}>
                    <Text style={styles.noAttendees}>
                      No students have scanned this event yet.
                    </Text>
                  </View>
                ) : (
                  item.attendees.map(
                    (attendee) => (
                      <View
                        key={`${item.eventId}-${attendee.studentId}-${attendee.scannedAt}`}
                        style={styles.attendeeRow}
                      >
                        <View style={styles.studentAvatar}>
                          <Text style={styles.studentAvatarText}>
                            ST
                          </Text>
                        </View>

                        <View style={styles.attendeeInfo}>
                          <Text style={styles.studentId}>
                            {shortId(
                              attendee.studentId
                            )}
                          </Text>

                          <Text style={styles.scanTime}>
                            {formatDate(
                              attendee.scannedAt
                            )}
                          </Text>
                        </View>

                        <View style={styles.checkBadge}>
                          <Text style={styles.checkText}>
                            ✓
                          </Text>
                        </View>
                      </View>
                    )
                  )
                )}
              </View>
            </View>
          )}
        />
      </View>
    );
  }

  /* =========================
     STUDENT VIEW
  ========================= */

  return (
    <View style={styles.container}>
      <FlatList
        data={studentRecords}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.pageHeader}>
              <View>
                <Text style={styles.pageTitle}>
                  Attendance
                </Text>

                <Text style={styles.pageSubtitle}>
                  Keep track of your school activities
                </Text>
              </View>

              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>
                  STUDENT
                </Text>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryIcon}>
                <Text style={styles.summaryIconText}>
                  ✓
                </Text>
              </View>

              <View style={styles.summaryInfo}>
                <Text style={styles.summaryLabel}>
                  TOTAL ATTENDANCE
                </Text>

                <Text style={styles.summaryValue}>
                  {studentRecords.length}
                </Text>

                <Text style={styles.summaryDescription}>
                  Successfully recorded attendance
                </Text>
              </View>
            </View>

            {studentRecords.length > 0 && (
              <Text style={styles.sectionTitle}>
                Recent Activity
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>
                QR
              </Text>
            </View>

            <Text style={styles.emptyTitle}>
              No attendance yet
            </Text>

            <Text style={styles.emptySubtitle}>
              Scan an event QR code to register your
              attendance.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.studentCard}>
            <View style={styles.studentCardLeft}>
              <View style={styles.attendanceIcon}>
                <Text style={styles.attendanceIconText}>
                  ✓
                </Text>
              </View>

              <View style={styles.studentCardInfo}>
                <Text
                  style={styles.eventTitle}
                  numberOfLines={2}
                >
                  {item.eventTitle}
                </Text>

                <Text style={styles.eventMeta}>
                  Event ID: {item.eventId}
                </Text>

                <Text style={styles.eventMeta}>
                  {formatDate(item.scannedAt)}
                </Text>
              </View>
            </View>

            <View style={styles.presentBadge}>
              <Text style={styles.presentText}>
                PRESENT
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

/* =========================
   HELPERS
========================= */

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function shortId(id: string) {
  return id
    ? `…${id.slice(-8)}`
    : 'unknown';
}

/* =========================
   STYLES
========================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  list: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 32,
  },

  /* =========================
     PAGE HEADER
  ========================= */

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },

  pageSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  roleBadge: {
    backgroundColor: '#1C1F22',
    borderWidth: 1,
    borderColor: '#2A2E33',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },

  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#FFD33D',
  },

  /* =========================
     SUMMARY
  ========================= */

  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 26,
  },

  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#292C30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },

  summaryIconText: {
    fontSize: 25,
    fontWeight: '800',
    color: '#FFD33D',
  },

  summaryInfo: {
    flex: 1,
  },

  summaryLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },

  summaryValue: {
    fontSize: 27,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  summaryDescription: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },

  /* =========================
     STUDENT CARD
  ========================= */

  studentCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 15,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  studentCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },

  attendanceIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: '#26352A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  attendanceIconText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#6EE7A0',
  },

  studentCardInfo: {
    flex: 1,
  },

  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },

  eventMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  presentBadge: {
    backgroundColor: '#26352A',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  presentText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#6EE7A0',
  },

  /* =========================
     TEACHER EVENT CARD
  ========================= */

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 17,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  eventIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#292C30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  eventIconText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFD33D',
    letterSpacing: 0.5,
  },

  eventTitleContainer: {
    flex: 1,
    paddingTop: 2,
  },

  eventCode: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  countBadge: {
    minWidth: 58,
    backgroundColor: '#26352A',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    marginLeft: 8,
  },

  countText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#6EE7A0',
  },

  countLabel: {
    fontSize: 7,
    fontWeight: '700',
    color: '#6EE7A0',
    marginTop: 1,
  },

  infoRow: {
    marginTop: 15,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  infoLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: COLORS.textSecondary,
    marginBottom: 3,
  },

  infoValue: {
    fontSize: 12,
    color: COLORS.textPrimary,
  },

  /* =========================
     ATTENDEES
  ========================= */

  attendeeSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
  },

  attendeeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 9,
  },

  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  studentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#292C30',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  studentAvatarText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFD33D',
  },

  attendeeInfo: {
    flex: 1,
  },

  studentId: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  scanTime: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  checkBadge: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: '#26352A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6EE7A0',
  },

  noAttendeesBox: {
    backgroundColor: '#151719',
    borderRadius: 10,
    padding: 12,
  },

  noAttendees: {
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },

  /* =========================
     EMPTY STATE
  ========================= */

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingVertical: 55,
  },

  emptyIcon: {
    width: 66,
    height: 66,
    borderRadius: 20,
    backgroundColor: '#1C1F22',
    borderWidth: 1,
    borderColor: '#2A2E33',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },

  emptyIconText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFD33D',
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 7,
    textAlign: 'center',
  },

  emptySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 290,
  },

  /* =========================
     LOADING
  ========================= */

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  loadingIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#1C1F22',
    borderWidth: 1,
    borderColor: '#2A2E33',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 17,
  },

  loadingIconText: {
    fontSize: 28,
    color: '#FFD33D',
  },

  loadingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },

  loadingSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});