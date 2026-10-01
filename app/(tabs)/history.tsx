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

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          Attendance History
        </Text>

        <Text style={styles.subtitle}>
          Loading records...
        </Text>
      </View>
    );
  }

  if (role === 'teacher') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          Attendance History
        </Text>

        <Text style={styles.roleTitle}>
          Teacher View
        </Text>

        {teacherEvents.length === 0 ? (
          <Text style={styles.subtitle}>
            No events yet. Create an event to
            start recording attendance.
          </Text>
        ) : (
          <FlatList
            data={teacherEvents}
            keyExtractor={(item) => item.eventId}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.eventHeader}>
                  <Text
                    style={styles.eventTitle}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>

                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>
                      {item.attendeeCount}
                    </Text>
                  </View>
                </View>

                <Text style={styles.eventMeta}>
                  Event Code: {item.eventCode}
                </Text>

                {item.startTime && (
                  <Text style={styles.eventMeta}>
                    Start:{' '}
                    {formatDate(item.startTime)}
                  </Text>
                )}

                {item.attendees.length === 0 ? (
                  <Text style={styles.noAttendees}>
                    No students have scanned this
                    event yet.
                  </Text>
                ) : (
                  <View style={styles.attendeeSection}>
                    <Text style={styles.attendeeTitle}>
                      Students Attended
                    </Text>

                    {item.attendees.map(
                      (attendee) => (
                        <View
                          key={`${item.eventId}-${attendee.studentId}-${attendee.scannedAt}`}
                          style={styles.attendeeRow}
                        >
                          <View
                            style={
                              styles.attendeeInfo
                            }
                          >
                            <Text
                              style={styles.studentId}
                            >
                              {shortId(
                                attendee.studentId
                              )}
                            </Text>

                            <Text
                              style={styles.scanTime}
                            >
                              {formatDate(
                                attendee.scannedAt
                              )}
                            </Text>
                          </View>
                        </View>
                      )
                    )}
                  </View>
                )}
              </View>
            )}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Attendance History
      </Text>

      {studentRecords.length === 0 ? (
        <Text style={styles.subtitle}>
          No records yet. Scan a QR code to register
          your attendance.
        </Text>
      ) : (
        <FlatList
          data={studentRecords}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.eventTitle}>
                {item.eventTitle}
              </Text>

              <Text style={styles.eventMeta}>
                {item.eventId}
              </Text>

              <Text style={styles.eventMeta}>
                {formatDate(item.scannedAt)}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function shortId(id: string) {
  return id
    ? `…${id.slice(-8)}`
    : 'unknown';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  title: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  roleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 16,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 32,
  },

  list: {
    paddingBottom: 24,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  eventHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  eventTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginRight: 12,
  },

  countBadge: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    borderRadius: 17,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },

  countText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  eventMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  noAttendees: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 14,
    fontStyle: 'italic',
  },

  attendeeSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },

  attendeeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  attendeeRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  attendeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  studentId: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  scanTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
});