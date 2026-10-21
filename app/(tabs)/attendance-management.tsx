import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AdminScreenFrame from '@/components/AdminScreenFrame';
import { COLORS } from '@/constants/colors';
import { supabase } from '@/lib/supabase';
import { useAdminAccess } from '@/lib/useAdminAccess';

type AttendanceRow = {
  id: string;
  student_id: string;
  event_id: string;
  scanned_at: string;
};

type EventSummary = {
  id: string;
  title: string;
  event_code: string;
  start_time: string | null;
  end_time: string | null;
};

type StudentProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  student_id: string | null;
  short_id: string | null;
};

type Attendee = AttendanceRow & {
  profile?: StudentProfile;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not available';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Not available';

  return date.toLocaleString();
}

export default function AttendanceManagementScreen() {
  const access = useAdminAccess();

  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [selectedEvent, setSelectedEvent] =
    useState<EventSummary | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [attendeesError, setAttendeesError] = useState<string | null>(null);
  const [profileWarning, setProfileWarning] = useState<string | null>(null);
  const [attendeeSearch, setAttendeeSearch] = useState('');

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEventError(null);

    try {
      const [attendanceResult, eventResult] = await Promise.all([
        supabase
          .from('attendance')
          .select('id, student_id, event_id, scanned_at')
          .order('scanned_at', { ascending: false }),

        supabase
          .from('events')
          .select('id, title, event_code, start_time, end_time')
          .order('start_time', { ascending: false }),
      ]);

      if (attendanceResult.error) {
        throw attendanceResult.error;
      }

      setRecords((attendanceResult.data ?? []) as AttendanceRow[]);

      if (eventResult.error) {
        console.error(
          'LOAD ATTENDANCE EVENT DETAILS ERROR:',
          eventResult.error
        );

        setEvents([]);
        setEventError(
          `Event details could not be loaded: ${eventResult.error.message}`
        );
      } else {
        setEvents((eventResult.data ?? []) as EventSummary[]);
      }
    } catch (loadError) {
      console.error('LOAD ADMIN ATTENDANCE ERROR:', loadError);

      setRecords([]);
      setError(
        loadError instanceof Error
          ? `Unable to load attendance records: ${loadError.message}`
          : 'Unable to load attendance records. Check access and try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (access.role === 'admin') {
        void loadAttendance();
      }
    }, [access.role, loadAttendance])
  );

  const attendanceCountByEvent = useMemo(() => {
    const counts = new Map<string, number>();

    for (const record of records) {
      counts.set(
        record.event_id,
        (counts.get(record.event_id) ?? 0) + 1
      );
    }

    return counts;
  }, [records]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();

    return events.filter((event) => {
      if (!term) return true;

      return (
        event.title.toLowerCase().includes(term) ||
        event.event_code.toLowerCase().includes(term) ||
        event.id.toLowerCase().includes(term)
      );
    });
  }, [events, search]);

  const openAttendees = useCallback(
    async (event: EventSummary) => {
      setSelectedEvent(event);
      setAttendees([]);
      setAttendeesError(null);
      setProfileWarning(null);
      setAttendeeSearch('');
      setAttendeesLoading(true);

      try {
        const eventRecords = records
          .filter((record) => record.event_id === event.id)
          .sort(
            (left, right) =>
              new Date(right.scanned_at).getTime() -
              new Date(left.scanned_at).getTime()
          );

        if (eventRecords.length === 0) {
          setAttendees([]);
          return;
        }

        const studentIds = Array.from(
          new Set(eventRecords.map((record) => record.student_id))
        );

        const profileResult = await supabase
          .from('profiles')
          .select('id, full_name, email, student_id, short_id')
          .in('id', studentIds);

        if (profileResult.error) {
          console.error(
            'LOAD ATTENDANCE STUDENT PROFILES ERROR:',
            profileResult.error
          );

          setAttendees(eventRecords);
          setProfileWarning(
            'Student profile details could not be loaded. Account UIDs are shown instead.'
          );
          return;
        }

        const profiles = (profileResult.data ?? []) as StudentProfile[];
        const profileById = new Map(
          profiles.map((profile) => [profile.id, profile])
        );

        setAttendees(
          eventRecords.map((record) => ({
            ...record,
            profile: profileById.get(record.student_id),
          }))
        );
      } catch (loadError) {
        console.error('LOAD EVENT ATTENDEES ERROR:', loadError);

        setAttendeesError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load this event’s attendees.'
        );
      } finally {
        setAttendeesLoading(false);
      }
    },
    [records]
  );

  const closeAttendees = useCallback(() => {
    setSelectedEvent(null);
    setAttendees([]);
    setAttendeesError(null);
    setProfileWarning(null);
    setAttendeeSearch('');
  }, []);

  const filteredAttendees = useMemo(() => {
    const term = attendeeSearch.trim().toLowerCase();

    if (!term) return attendees;

    return attendees.filter((attendee) => {
      const profile = attendee.profile;

      return (
        attendee.student_id.toLowerCase().includes(term) ||
        attendee.id.toLowerCase().includes(term) ||
        (profile?.full_name ?? '').toLowerCase().includes(term) ||
        (profile?.email ?? '').toLowerCase().includes(term) ||
        (profile?.student_id ?? '').toLowerCase().includes(term) ||
        (profile?.short_id ?? '').toLowerCase().includes(term)
      );
    });
  }, [attendees, attendeeSearch]);

  return (
    <AdminScreenFrame
      access={access}
      title="Attendance Management"
      subtitle="Select an event to view its attendance records."
      showBackButton
      refreshing={loading}
      onRefresh={() => void loadAttendance()}
    >
      <View style={styles.infoNotice}>
        <Ionicons
          name="shield-checkmark-outline"
          size={20}
          color={COLORS.primary}
        />

        <Text style={styles.noticeText}>
          Attendance records are read-only. Open an event to see its
          attendees, student details, and QR scan times.
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons
              name="calendar-outline"
              size={21}
              color={COLORS.primary}
            />
          </View>

          <Text style={styles.summaryLabel}>Events</Text>
          <Text style={styles.summaryValue}>{events.length}</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons
              name="people-outline"
              size={21}
              color={COLORS.primary}
            />
          </View>

          <Text style={styles.summaryLabel}>Visible records</Text>
          <Text style={styles.summaryValue}>{records.length}</Text>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons
          name="search-outline"
          size={20}
          color={COLORS.textSecondary}
        />

        <TextInput
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          placeholder="Search event title or event code"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search events"
        />

        {search.length > 0 ? (
          <Pressable
            onPress={() => setSearch('')}
            accessibilityRole="button"
            accessibilityLabel="Clear event search"
          >
            <Ionicons
              name="close-circle"
              size={20}
              color={COLORS.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>

      {eventError ? (
        <Text style={styles.inlineWarning}>{eventError}</Text>
      ) : null}

      {loading && events.length === 0 ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.stateText}>Loading events...</Text>
        </View>
      ) : error ? (
        <View style={styles.stateCard}>
          <Ionicons
            name="alert-circle-outline"
            size={28}
            color={COLORS.danger}
          />

          <Text style={styles.stateTitle}>
            Attendance could not be loaded
          </Text>

          <Text style={styles.stateText}>{error}</Text>

          <Pressable
            onPress={() => void loadAttendance()}
            style={styles.retryButton}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : filteredEvents.length === 0 ? (
        <View style={styles.stateCard}>
          <Ionicons
            name="calendar-outline"
            size={28}
            color={COLORS.textSecondary}
          />

          <Text style={styles.stateTitle}>
            {events.length === 0 ? 'No events found' : 'No matching events'}
          </Text>

          <Text style={styles.stateText}>
            {events.length === 0
              ? 'Events could not be displayed. Refresh to try again.'
              : 'Try another event title or event code.'}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          <Text style={styles.resultCount}>
            {filteredEvents.length}{' '}
            {filteredEvents.length === 1 ? 'event' : 'events'}
          </Text>

          {filteredEvents.map((event) => {
            const attendeeCount =
              attendanceCountByEvent.get(event.id) ?? 0;

            return (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventHeading}>
                  <View style={styles.eventIcon}>
                    <Ionicons
                      name="calendar"
                      size={22}
                      color={COLORS.primary}
                    />
                  </View>

                  <View style={styles.eventHeadingText}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventCode}>
                      Event code: {event.event_code}
                    </Text>
                  </View>
                </View>

                <View style={styles.scheduleRow}>
                  <Ionicons
                    name="time-outline"
                    size={16}
                    color={COLORS.textSecondary}
                  />

                  <Text style={styles.recordDetail}>
                    Starts: {formatDateTime(event.start_time)}
                  </Text>
                </View>

                <View style={styles.scheduleRow}>
                  <Ionicons
                    name="flag-outline"
                    size={16}
                    color={COLORS.textSecondary}
                  />

                  <Text style={styles.recordDetail}>
                    Ends: {formatDateTime(event.end_time)}
                  </Text>
                </View>

                <View style={styles.cardFooter}>
                  <View style={styles.attendeeCount}>
                    <Ionicons
                      name="people-outline"
                      size={17}
                      color={COLORS.primary}
                    />

                    <Text style={styles.attendeeCountText}>
                      {attendeeCount}{' '}
                      {attendeeCount === 1 ? 'attendee' : 'attendees'}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => void openAttendees(event)}
                    style={styles.viewButton}
                    accessibilityRole="button"
                    accessibilityLabel={`View attendees for ${event.title}`}
                  >
                    <Text style={styles.viewButtonText}>
                      View Attendees
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={17}
                      color={COLORS.textOnPrimary}
                    />
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Modal
        visible={selectedEvent !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeAttendees}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeadingText}>
              <Text style={styles.modalTitle}>Event Attendees</Text>

              <Text style={styles.modalSubtitle} numberOfLines={2}>
                {selectedEvent?.title ?? ''}
              </Text>
            </View>

            <Pressable
              onPress={closeAttendees}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close attendees"
            >
              <Ionicons
                name="close"
                size={24}
                color={COLORS.textPrimary}
              />
            </Pressable>
          </View>

          {selectedEvent ? (
            <View style={styles.modalEventInfo}>
              <Text style={styles.modalEventCode}>
                Event code: {selectedEvent.event_code}
              </Text>

              <Text style={styles.modalEventTime}>
                Starts: {formatDateTime(selectedEvent.start_time)}
              </Text>

              <Text style={styles.modalEventTime}>
                Ends: {formatDateTime(selectedEvent.end_time)}
              </Text>

              <Text style={styles.modalEventTime}>
                {attendees.length}{' '}
                {attendees.length === 1 ? 'attendee' : 'attendees'}
              </Text>
            </View>
          ) : null}

          {!attendeesLoading &&
          !attendeesError &&
          attendees.length > 0 ? (
            <View style={styles.attendeeSearchBox}>
              <Ionicons
                name="search-outline"
                size={19}
                color={COLORS.textSecondary}
              />

              <TextInput
                value={attendeeSearch}
                onChangeText={setAttendeeSearch}
                style={styles.searchInput}
                placeholder="Search name, student ID, or email"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search event attendees"
              />

              {attendeeSearch.length > 0 ? (
                <Pressable
                  onPress={() => setAttendeeSearch('')}
                  accessibilityRole="button"
                  accessibilityLabel="Clear attendee search"
                >
                  <Ionicons
                    name="close-circle"
                    size={19}
                    color={COLORS.textSecondary}
                  />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {profileWarning ? (
            <Text style={styles.inlineWarning}>{profileWarning}</Text>
          ) : null}

          {attendeesLoading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.stateText}>
                Loading attendees and student details...
              </Text>
            </View>
          ) : attendeesError ? (
            <View style={styles.stateCard}>
              <Ionicons
                name="alert-circle-outline"
                size={28}
                color={COLORS.danger}
              />

              <Text style={styles.stateTitle}>
                Attendees could not be loaded
              </Text>

              <Text style={styles.stateText}>{attendeesError}</Text>

              <Pressable
                onPress={() => {
                  if (selectedEvent) {
                    void openAttendees(selectedEvent);
                  }
                }}
                style={styles.retryButton}
                accessibilityRole="button"
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : attendees.length === 0 ? (
            <View style={styles.stateCard}>
              <Ionicons
                name="people-outline"
                size={28}
                color={COLORS.textSecondary}
              />

              <Text style={styles.stateTitle}>No attendees yet</Text>

              <Text style={styles.stateText}>
                No attendance records are currently visible for this event.
              </Text>
            </View>
          ) : filteredAttendees.length === 0 ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>No matching students</Text>

              <Text style={styles.stateText}>
                Try another name, student ID, or email.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.attendeeList}
              contentContainerStyle={styles.attendeeListContent}
              showsVerticalScrollIndicator
            >
              <Text style={styles.resultCount}>
                Showing {filteredAttendees.length} of {attendees.length}{' '}
                {attendees.length === 1 ? 'attendee' : 'attendees'}
              </Text>

              {filteredAttendees.map((attendee, index) => {
                const profile = attendee.profile;

                const displayName =
                  profile?.full_name?.trim() ||
                  profile?.student_id ||
                  profile?.short_id ||
                  `Student ${index + 1}`;

                return (
                  <View key={attendee.id} style={styles.attendeeCard}>
                    <View style={styles.attendeeHeading}>
                      <View style={styles.studentIcon}>
                        <Ionicons
                          name="person-outline"
                          size={20}
                          color={COLORS.primary}
                        />
                      </View>

                      <View style={styles.attendeeNameContainer}>
                        <Text style={styles.attendeeName}>
                          {displayName}
                        </Text>

                        {profile?.email ? (
                          <Text style={styles.attendeeEmail}>
                            {profile.email}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <Text style={styles.attendeeDetail}>
                      Student ID: {profile?.student_id || 'Not available'}
                    </Text>

                    <Text style={styles.attendeeDetail}>
                      Short ID: {profile?.short_id || 'Not available'}
                    </Text>

                    <Text style={styles.attendeeDetail}>
                      Account UID: {attendee.student_id}
                    </Text>

                    <Text style={styles.attendeeDetail}>
                      Attendance record ID: {attendee.id}
                    </Text>

                    <View style={styles.scanTimeRow}>
                      <Ionicons
                        name="time-outline"
                        size={16}
                        color={COLORS.success}
                      />

                      <Text style={styles.scanTimeText}>
                        Scanned: {formatDateTime(attendee.scanned_at)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>
    </AdminScreenFrame>
  );
}

const styles = StyleSheet.create({
  infoNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
    lineHeight: 19,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    gap: 5,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  summaryValue: {
    color: COLORS.textPrimary,
    fontSize: 23,
    fontWeight: '800',
  },
  searchBox: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    paddingVertical: 11,
  },
  inlineWarning: {
    color: COLORS.warning,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  list: {
    gap: 12,
  },
  resultCount: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 2,
  },
  eventCard: {
    padding: 15,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 11,
  },
  eventHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  eventIcon: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventHeadingText: {
    flex: 1,
    gap: 4,
  },
  eventTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  eventCode: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  recordDetail: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    marginTop: 2,
  },
  attendeeCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attendeeCountText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  viewButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  stateCard: {
    alignItems: 'center',
    padding: 22,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  stateTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    marginTop: 4,
  },
  retryText: {
    color: COLORS.textOnPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  modalHeadingText: {
    flex: 1,
    gap: 4,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 21,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalEventInfo: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 13,
    gap: 6,
    marginBottom: 14,
  },
  modalEventCode: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  modalEventTime: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  attendeeSearchBox: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 14,
  },
  attendeeList: {
    flex: 1,
  },
  attendeeListContent: {
    gap: 10,
    paddingBottom: 24,
  },
  attendeeCard: {
    padding: 13,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 7,
  },
  attendeeHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 3,
  },
  studentIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeNameContainer: {
    flex: 1,
    gap: 3,
  },
  attendeeName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  attendeeEmail: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  attendeeDetail: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 17,
  },
  scanTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 9,
    marginTop: 3,
  },
  scanTimeText: {
    flex: 1,
    color: COLORS.success,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
});