
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import QRCode from 'react-native-qrcode-svg';
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
import { buildQRPayload } from '@/lib/qr';
import { supabase } from '@/lib/supabase';
import { useAdminAccess } from '@/lib/useAdminAccess';

type EventRow = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  created_by: string | null;
  created_at: string;
  archived_at: string | null;
};

type EventStatus =
  | 'Upcoming'
  | 'Ongoing'
  | 'Completed'
  | 'Schedule incomplete';

type EventFilter = 'All' | EventStatus;
type ArchiveView = 'Active' | 'Archived';
type ArchiveAction = 'archive' | 'restore';

type AttendanceRow = {
  id: string;
  student_id: string;
  scanned_at: string;
};

type StudentProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  student_id: string | null;
  short_id: string | null;
};

type EventAttendee = AttendanceRow & {
  profile?: StudentProfile;
};

function getEventStatus(event: EventRow, now: number): EventStatus {
  if (!event.start_time || !event.end_time) {
    return 'Schedule incomplete';
  }

  const start = new Date(event.start_time).getTime();
  const end = new Date(event.end_time).getTime();

  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    end < start
  ) {
    return 'Schedule incomplete';
  }

  if (now < start) return 'Upcoming';
  if (now > end) return 'Completed';

  return 'Ongoing';
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not set';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EventMonitoringScreen() {
  const access = useAdminAccess();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<EventFilter>('All');
  const [archiveView, setArchiveView] =
    useState<ArchiveView>('Active');
  const [actionEventId, setActionEventId] =
    useState<string | null>(null);

  const [confirmation, setConfirmation] = useState<{
    event: EventRow;
    action: ArchiveAction;
  } | null>(null);

  const [notice, setNotice] = useState<{
    title: string;
    message: string;
    isError: boolean;
  } | null>(null);

  const [selectedEvent, setSelectedEvent] =
    useState<EventRow | null>(null);

  // Selected event for the admin QR viewer.
  const [qrEvent, setQrEvent] = useState<EventRow | null>(null);

  // Use the same QR payload builder and event fields as the teacher screen.
  const adminQrPayload = useMemo(() => {
    if (!qrEvent) return '';

    return buildQRPayload({
      eventId: qrEvent.event_code,
      title: qrEvent.title,
      start: qrEvent.start_time ?? '',
      end: qrEvent.end_time ?? '',
    });
  }, [qrEvent]);

  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [attendeesLoaded, setAttendeesLoaded] = useState(false);
  const [attendeesError, setAttendeesError] =
    useState<string | null>(null);
  const [profileWarning, setProfileWarning] =
    useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('events')
        .select(
          'id, event_code, title, start_time, end_time, created_by, created_at, archived_at'
        )
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      setEvents((data ?? []) as EventRow[]);
    } catch (loadError) {
      console.error('LOAD ADMIN EVENTS ERROR:', loadError);
      setEvents([]);

      setError(
        loadError instanceof Error
          ? `Unable to load events: ${loadError.message}`
          : 'Unable to load events. Check event-table access and try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEventAttendees = useCallback(
    async (event: EventRow) => {
      setSelectedEvent(event);
      setAttendees([]);
      setAttendeesError(null);
      setProfileWarning(null);
      setAttendeesLoaded(false);
      setAttendeesLoading(true);

      try {
        const { data: attendanceData, error: attendanceError } =
          await supabase
            .from('attendance')
            .select('id, student_id, scanned_at')
            .eq('event_id', event.id)
            .order('scanned_at', { ascending: false });

        if (attendanceError) throw attendanceError;

        const attendanceRows = (attendanceData ??
          []) as AttendanceRow[];

        if (attendanceRows.length === 0) {
          setAttendees([]);
          setAttendeesLoaded(true);
          return;
        }

        const studentIds = [
          ...new Set(
            attendanceRows.map((record) => record.student_id)
          ),
        ];

        const { data: profileData, error: profileError } =
          await supabase
            .from('profiles')
            .select('id, full_name, email, student_id, short_id')
            .in('id', studentIds);

        if (profileError) {
          console.error(
            'LOAD EVENT ATTENDEE PROFILES ERROR:',
            profileError
          );

          setProfileWarning(
            'Student profiles could not be loaded. Attendance records are shown using account IDs.'
          );
          setAttendees(attendanceRows);
          setAttendeesLoaded(true);
          return;
        }

        const profiles = (profileData ?? []) as StudentProfile[];
        const profileById = new Map(
          profiles.map((profile) => [profile.id, profile])
        );

        setAttendees(
          attendanceRows.map((record) => ({
            ...record,
            profile: profileById.get(record.student_id),
          }))
        );

        setAttendeesLoaded(true);
      } catch (loadError) {
        console.error('LOAD EVENT ATTENDEES ERROR:', loadError);

        setAttendeesError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load this event’s attendance records.'
        );
      } finally {
        setAttendeesLoading(false);
      }
    },
    []
  );

  const closeEventDetails = useCallback(() => {
    setSelectedEvent(null);
    setAttendees([]);
    setAttendeesError(null);
    setProfileWarning(null);
    setAttendeesLoaded(false);
  }, []);

  // Perform the archive/restore operation in Supabase.
  const runArchiveRestore = useCallback(
    async (event: EventRow, action: ArchiveAction) => {
      if (actionEventId !== null) return;

      setActionEventId(event.id);

      try {
        const { error: actionError } = await supabase.rpc(
          action === 'archive'
            ? 'admin_archive_event'
            : 'admin_restore_event',
          { p_event_id: event.id }
        );

        if (actionError) throw actionError;

        const archivedAt =
          action === 'archive' ? new Date().toISOString() : null;

        const updatedEvent: EventRow = {
          ...event,
          archived_at: archivedAt,
        };

        setEvents((currentEvents) =>
          currentEvents.map((item) =>
            item.id === event.id ? updatedEvent : item
          )
        );

        setSelectedEvent((currentEvent) =>
          currentEvent?.id === event.id
            ? { ...currentEvent, archived_at: archivedAt }
            : currentEvent
        );

        setQrEvent((currentEvent) =>
          currentEvent?.id === event.id
            ? { ...currentEvent, archived_at: archivedAt }
            : currentEvent
        );

        setNotice({
          title:
            action === 'archive'
              ? 'Event archived'
              : 'Event restored',
          message:
            action === 'archive'
              ? 'The event has been moved to Archived Events. Its attendance history has been preserved.'
              : 'The event has been restored to Active Events.',
          isError: false,
        });

        void loadEvents();
      } catch (actionError) {
        console.error(
          `ADMIN ${action.toUpperCase()} EVENT ERROR:`,
          actionError
        );

        setNotice({
          title:
            action === 'archive'
              ? 'Unable to archive event'
              : 'Unable to restore event',
          message:
            actionError instanceof Error
              ? actionError.message
              : 'The action could not be completed. Please try again.',
          isError: true,
        });
      } finally {
        setActionEventId(null);
      }
    },
    [actionEventId, loadEvents]
  );

  const confirmArchiveRestore = useCallback(
    (event: EventRow) => {
      if (actionEventId !== null) return;

      setConfirmation({
        event,
        action: event.archived_at ? 'restore' : 'archive',
      });
    },
    [actionEventId]
  );

  const handleConfirmAction = useCallback(() => {
    if (!confirmation || actionEventId !== null) return;

    const pendingAction = confirmation;
    setConfirmation(null);

    void runArchiveRestore(
      pendingAction.event,
      pendingAction.action
    );
  }, [confirmation, actionEventId, runArchiveRestore]);

  useFocusEffect(
    useCallback(() => {
      if (access.role === 'admin') {
        void loadEvents();
      }
    }, [access.role, loadEvents])
  );

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = Date.now();

    return events.filter((event) => {
      const isArchived = event.archived_at !== null;

      const matchesArchiveView =
        archiveView === 'Archived' ? isArchived : !isArchived;

      const matchesSearch =
        !term ||
        event.title.toLowerCase().includes(term) ||
        event.event_code.toLowerCase().includes(term) ||
        (event.created_by ?? '').toLowerCase().includes(term);

      const matchesFilter =
        filter === 'All' ||
        getEventStatus(event, now) === filter;

      return (
        matchesArchiveView &&
        matchesSearch &&
        matchesFilter
      );
    });
  }, [events, search, filter, archiveView]);

  const activeEventCount = events.filter(
    (event) => !event.archived_at
  ).length;

  const archivedEventCount = events.filter(
    (event) => !!event.archived_at
  ).length;

  return (
    <AdminScreenFrame
      access={access}
      title="Event Monitoring"
      subtitle="Review event schedules and inspect attendance for each event."
      showBackButton
      refreshing={loading}
      onRefresh={() => void loadEvents()}
    >
      <View style={styles.infoNotice}>
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={COLORS.primary}
        />
        <Text style={styles.noticeText}>
          Select an event to review its schedule and attendance.
          Archived events retain their attendance history and can be
          restored at any time.
        </Text>
      </View>

      <View style={styles.archiveTabs}>
        <Pressable
          onPress={() => setArchiveView('Active')}
          style={[
            styles.archiveTab,
            archiveView === 'Active' && styles.archiveTabActive,
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: archiveView === 'Active' }}
        >
          <Ionicons
            name="calendar-outline"
            size={18}
            color={
              archiveView === 'Active'
                ? COLORS.textOnPrimary
                : COLORS.textSecondary
            }
          />
          <Text
            style={[
              styles.archiveTabText,
              archiveView === 'Active' &&
                styles.archiveTabTextActive,
            ]}
          >
            Active Events ({activeEventCount})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setArchiveView('Archived')}
          style={[
            styles.archiveTab,
            archiveView === 'Archived' && styles.archiveTabActive,
          ]}
          accessibilityRole="button"
          accessibilityState={{
            selected: archiveView === 'Archived',
          }}
        >
          <Ionicons
            name="archive-outline"
            size={18}
            color={
              archiveView === 'Archived'
                ? COLORS.textOnPrimary
                : COLORS.textSecondary
            }
          />
          <Text
            style={[
              styles.archiveTabText,
              archiveView === 'Archived' &&
                styles.archiveTabTextActive,
            ]}
          >
            Archived Events ({archivedEventCount})
          </Text>
        </Pressable>
      </View>

      {archiveView === 'Archived' ? (
        <View style={styles.archiveNotice}>
          <Ionicons
            name="archive-outline"
            size={18}
            color={COLORS.textSecondary}
          />
          <Text style={styles.archiveNoticeText}>
            Archived events are hidden from the active list. Their
            attendance records remain available for review.
          </Text>
        </View>
      ) : null}

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
          placeholder="Search event, code, or creator ID"
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

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {(
          [
            'All',
            'Upcoming',
            'Ongoing',
            'Completed',
            'Schedule incomplete',
          ] as EventFilter[]
        ).map((item) => {
          const active = filter === item;

          return (
            <Pressable
              key={item}
              onPress={() => setFilter(item)}
              style={[
                styles.filterChip,
                active && styles.filterChipActive,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.filterText,
                  active && styles.filterTextActive,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

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
            Events could not be loaded
          </Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable
            onPress={() => void loadEvents()}
            style={styles.retryButton}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : filteredEvents.length === 0 ? (
        <View style={styles.stateCard}>
          <Ionicons
            name={
              archiveView === 'Archived'
                ? 'archive-outline'
                : 'calendar-outline'
            }
            size={28}
            color={COLORS.textSecondary}
          />
          <Text style={styles.stateTitle}>
            {archiveView === 'Archived'
              ? 'No archived events'
              : 'No active events'}
          </Text>
          <Text style={styles.stateText}>
            {archiveView === 'Archived'
              ? 'Events you archive will appear here. You can restore them whenever needed.'
              : events.length === 0
                ? 'No event rows are visible to this signed-in account.'
                : 'Try another search term or status filter.'}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          <Text style={styles.resultCount}>
            {filteredEvents.length}{' '}
            {filteredEvents.length === 1 ? 'event' : 'events'}
          </Text>

          {filteredEvents.map((event) => {
            const status = event.archived_at
              ? 'Archived'
              : getEventStatus(event, Date.now());

            return (
              <Pressable
                key={event.id}
                onPress={() => void loadEventAttendees(event)}
                style={styles.eventCard}
                accessibilityRole="button"
                accessibilityLabel={`View details for ${event.title}`}
              >
                <View style={styles.eventHeading}>
                  <View style={styles.eventIcon}>
                    <Ionicons
                      name={
                        event.archived_at
                          ? 'archive-outline'
                          : 'calendar-outline'
                      }
                      size={22}
                      color={COLORS.primary}
                    />
                  </View>

                  <View style={styles.eventTitleContainer}>
                    <Text style={styles.eventTitle}>
                      {event.title}
                    </Text>
                    <Text style={styles.eventCode}>
                      Code: {event.event_code}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      event.archived_at &&
                        styles.archivedStatusBadge,
                    ]}
                  >
                    <Text style={styles.statusText}>{status}</Text>
                  </View>
                </View>

                <View style={styles.details}>
                  <Text style={styles.detailLabel}>Starts</Text>
                  <Text style={styles.detailValue}>
                    {formatDateTime(event.start_time)}
                  </Text>
                  <Text style={styles.detailLabel}>Ends</Text>
                  <Text style={styles.detailValue}>
                    {formatDateTime(event.end_time)}
                  </Text>

                  <View style={styles.cardAction}>
                    <Text style={styles.cardActionText}>
                      View event details and attendees
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={COLORS.primary}
                    />
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Event details and attendance modal */}
      <Modal
        visible={selectedEvent !== null}
        transparent
        animationType="slide"
        onRequestClose={closeEventDetails}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Event Details</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedEvent?.title ?? ''}
                </Text>
              </View>

              <Pressable
                onPress={closeEventDetails}
                accessibilityRole="button"
                accessibilityLabel="Close event details"
                style={styles.closeButton}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={COLORS.textPrimary}
                />
              </Pressable>
            </View>

            {selectedEvent ? (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalStatusRow}>
                  <View style={styles.eventIcon}>
                    <Ionicons
                      name={
                        selectedEvent.archived_at
                          ? 'archive-outline'
                          : 'calendar-outline'
                      }
                      size={24}
                      color={COLORS.primary}
                    />
                  </View>

                  <View style={styles.modalStatusInfo}>
                    <Text style={styles.eventTitle}>
                      {selectedEvent.title}
                    </Text>
                    <Text style={styles.eventCode}>
                      {selectedEvent.event_code}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      selectedEvent.archived_at &&
                        styles.archivedStatusBadge,
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {selectedEvent.archived_at
                        ? 'Archived'
                        : getEventStatus(selectedEvent, Date.now())}
                    </Text>
                  </View>
                </View>

                {selectedEvent.archived_at ? (
                  <View style={styles.archiveNotice}>
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color={COLORS.textSecondary}
                    />
                    <Text style={styles.archiveNoticeText}>
                      Archived on{' '}
                      {formatDateTime(selectedEvent.archived_at)}.
                      Attendance history remains available, but new
                      attendance is blocked while archived.
                    </Text>
                  </View>
                ) : null}

                <View style={styles.scheduleCard}>
                  <View style={styles.scheduleItem}>
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color={COLORS.primary}
                    />
                    <View style={styles.scheduleInfo}>
                      <Text style={styles.detailLabel}>Start time</Text>
                      <Text style={styles.scheduleValue}>
                        {formatDateTime(selectedEvent.start_time)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.scheduleDivider} />

                  <View style={styles.scheduleItem}>
                    <Ionicons
                      name="flag-outline"
                      size={20}
                      color={COLORS.primary}
                    />
                    <View style={styles.scheduleInfo}>
                      <Text style={styles.detailLabel}>End time</Text>
                      <Text style={styles.scheduleValue}>
                        {formatDateTime(selectedEvent.end_time)}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.detailLabel}>
                  Creator account ID
                </Text>
                <Text style={styles.detailValue}>
                  {selectedEvent.created_by ?? 'Not available'}
                </Text>

                <Text style={styles.detailLabel}>Event created</Text>
                <Text style={styles.detailValue}>
                  {formatDateTime(selectedEvent.created_at)}
                </Text>

                {/* New: View the QR code for this event */}
                <Pressable
                  onPress={() => setQrEvent(selectedEvent)}
                  style={styles.qrButton}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="qr-code-outline"
                    size={20}
                    color={COLORS.textOnPrimary}
                  />
                  <Text style={styles.attendeesButtonText}>
                    View Event QR Code
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void loadEventAttendees(selectedEvent)}
                  style={styles.attendeesButton}
                  accessibilityRole="button"
                  disabled={attendeesLoading}
                >
                  {attendeesLoading ? (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.textOnPrimary}
                    />
                  ) : (
                    <Ionicons
                      name="people-outline"
                      size={19}
                      color={COLORS.textOnPrimary}
                    />
                  )}
                  <Text style={styles.attendeesButtonText}>
                    {attendeesLoading
                      ? 'Loading attendees...'
                      : 'View Attendees'}
                  </Text>
                </Pressable>

                <View style={styles.attendeesSection}>
                  <View style={styles.attendeesHeadingRow}>
                    <Text style={styles.attendeesHeading}>
                      Attendees
                    </Text>
                    {attendeesLoaded && !attendeesError ? (
                      <View style={styles.attendeeCountBadge}>
                        <Text style={styles.attendeeCountText}>
                          {attendees.length}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {attendeesLoading ? (
                    <View style={styles.modalState}>
                      <ActivityIndicator
                        size="small"
                        color={COLORS.primary}
                      />
                      <Text style={styles.stateText}>
                        Loading attendance records...
                      </Text>
                    </View>
                  ) : attendeesError ? (
                    <View style={styles.modalState}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={25}
                        color={COLORS.danger}
                      />
                      <Text style={styles.stateTitle}>
                        Attendees could not be loaded
                      </Text>
                      <Text style={styles.stateText}>
                        {attendeesError}
                      </Text>
                      <Pressable
                        onPress={() =>
                          void loadEventAttendees(selectedEvent)
                        }
                        style={styles.retryButton}
                        accessibilityRole="button"
                      >
                        <Text style={styles.retryText}>Try again</Text>
                      </Pressable>
                    </View>
                  ) : !attendeesLoaded ? (
                    <View style={styles.modalState}>
                      <Ionicons
                        name="people-outline"
                        size={25}
                        color={COLORS.textSecondary}
                      />
                      <Text style={styles.stateText}>
                        Select View Attendees to load the attendance
                        records for this event.
                      </Text>
                    </View>
                  ) : attendees.length === 0 ? (
                    <View style={styles.modalState}>
                      <Ionicons
                        name="people-outline"
                        size={25}
                        color={COLORS.textSecondary}
                      />
                      <Text style={styles.stateTitle}>
                        No attendees yet
                      </Text>
                      <Text style={styles.stateText}>
                        No attendance records were found for this event.
                      </Text>
                    </View>
                  ) : (
                    <>
                      {profileWarning ? (
                        <Text style={styles.profileWarning}>
                          {profileWarning}
                        </Text>
                      ) : null}

                      <Text style={styles.resultCount}>
                        {attendees.length}{' '}
                        {attendees.length === 1
                          ? 'attendance record'
                          : 'attendance records'}
                      </Text>

                      {attendees.map((attendee) => {
                        const displayName =
                          attendee.profile?.full_name?.trim() ||
                          attendee.profile?.student_id ||
                          attendee.profile?.short_id ||
                          'Student name unavailable';

                        return (
                          <View
                            key={attendee.id}
                            style={styles.attendeeRow}
                          >
                            <View style={styles.attendeeIcon}>
                              <Ionicons
                                name="person-outline"
                                size={20}
                                color={COLORS.primary}
                              />
                            </View>

                            <View style={styles.attendeeInfo}>
                              <Text style={styles.attendeeName}>
                                {displayName}
                              </Text>
                              <Text style={styles.attendeeDetail}>
                                {attendee.profile?.student_id
                                  ? `Student ID: ${attendee.profile.student_id}`
                                  : attendee.profile?.short_id
                                    ? `Short ID: ${attendee.profile.short_id}`
                                    : `Account ID: ${attendee.student_id}`}
                              </Text>

                              {attendee.profile?.email ? (
                                <Text style={styles.attendeeDetail}>
                                  {attendee.profile.email}
                                </Text>
                              ) : null}

                              <Text style={styles.attendeeDetail}>
                                Scanned:{' '}
                                {formatDateTime(attendee.scanned_at)}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </>
                  )}
                </View>

                <Pressable
                  onPress={() =>
                    confirmArchiveRestore(selectedEvent)
                  }
                  style={[
                    styles.archiveActionButton,
                    selectedEvent.archived_at &&
                      styles.restoreActionButton,
                  ]}
                  disabled={actionEventId === selectedEvent.id}
                  accessibilityRole="button"
                >
                  {actionEventId === selectedEvent.id ? (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.textOnPrimary}
                    />
                  ) : (
                    <Ionicons
                      name={
                        selectedEvent.archived_at
                          ? 'arrow-undo-outline'
                          : 'archive-outline'
                      }
                      size={19}
                      color={COLORS.textOnPrimary}
                    />
                  )}

                  <Text style={styles.archiveActionText}>
                    {actionEventId === selectedEvent.id
                      ? 'Please wait...'
                      : selectedEvent.archived_at
                        ? 'Restore Event'
                        : 'Archive Event'}
                  </Text>
                </Pressable>

                <Text style={styles.archiveActionHint}>
                  {selectedEvent.archived_at
                    ? 'Restoring returns this event to the active list. Existing attendance records are preserved.'
                    : 'Archiving hides this event from the active list. It does not permanently delete the event or attendance records.'}
                </Text>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* New: Admin Event QR Code modal */}
      <Modal
        visible={qrEvent !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setQrEvent(null)}
        statusBarTranslucent
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.qrModalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Text style={styles.modalTitle}>Event QR Code</Text>
                <Text style={styles.modalSubtitle}>
                  {qrEvent?.title ?? ''}
                </Text>
              </View>

              <Pressable
                onPress={() => setQrEvent(null)}
                accessibilityRole="button"
                accessibilityLabel="Close QR code"
                style={styles.closeButton}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={COLORS.textPrimary}
                />
              </Pressable>
            </View>

            {qrEvent ? (
              <ScrollView
                style={styles.qrScroll}
                contentContainerStyle={styles.qrContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.qrImageContainer}>
                  {adminQrPayload ? (
                    <QRCode
                      value={adminQrPayload}
                      size={220}
                      backgroundColor="#FFFFFF"
                      color="#000000"
                    />
                  ) : (
                    <Text style={styles.stateText}>
                      Unable to generate the QR code.
                    </Text>
                  )}
                </View>

                <Text style={styles.qrEventTitle}>
                  {qrEvent.title}
                </Text>

                <Text style={styles.qrEventCode}>
                  Event code: {qrEvent.event_code}
                </Text>

                <View style={styles.scheduleCard}>
                  <View style={styles.scheduleItem}>
                    <Ionicons
                      name="time-outline"
                      size={20}
                      color={COLORS.primary}
                    />
                    <View style={styles.scheduleInfo}>
                      <Text style={styles.detailLabel}>Start time</Text>
                      <Text style={styles.scheduleValue}>
                        {formatDateTime(qrEvent.start_time)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.scheduleDivider} />

                  <View style={styles.scheduleItem}>
                    <Ionicons
                      name="flag-outline"
                      size={20}
                      color={COLORS.primary}
                    />
                    <View style={styles.scheduleInfo}>
                      <Text style={styles.detailLabel}>End time</Text>
                      <Text style={styles.scheduleValue}>
                        {formatDateTime(qrEvent.end_time)}
                      </Text>
                    </View>
                  </View>
                </View>

                {qrEvent.archived_at ? (
                  <Text style={styles.qrWarning}>
                    This event is archived. Its QR code can still be
                    displayed, but new attendance is blocked while
                    the event remains archived.
                  </Text>
                ) : (
                  <Text style={styles.qrHelpText}>
                    Students can scan this QR code using the existing
                    Scan feature in the QR Attendance app.
                  </Text>
                )}

                <Pressable
                  onPress={() => setQrEvent(null)}
                  style={styles.noticeButton}
                  accessibilityRole="button"
                >
                  <Text style={styles.confirmSubmitText}>
                    Close QR Code
                  </Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Archive / Restore confirmation dialog */}
      <Modal
        visible={confirmation !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (actionEventId === null) setConfirmation(null);
        }}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons
                name={
                  confirmation?.action === 'archive'
                    ? 'archive-outline'
                    : 'arrow-undo-outline'
                }
                size={28}
                color={COLORS.primary}
              />
            </View>

            <Text style={styles.confirmTitle}>
              {confirmation?.action === 'archive'
                ? 'Archive this event?'
                : 'Restore this event?'}
            </Text>

            <Text style={styles.confirmMessage}>
              {confirmation?.action === 'archive'
                ? `Are you sure you want to archive "${confirmation?.event.title}"? Existing attendance records will be preserved.`
                : `Are you sure you want to restore "${confirmation?.event.title}"? The event will return to Active Events.`}
            </Text>

            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setConfirmation(null)}
                style={styles.confirmCancelButton}
                accessibilityRole="button"
                disabled={actionEventId !== null}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirmAction}
                style={[
                  styles.confirmSubmitButton,
                  confirmation?.action === 'restore' &&
                    styles.restoreActionButton,
                ]}
                accessibilityRole="button"
                disabled={actionEventId !== null || !confirmation}
              >
                {actionEventId !== null ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.textOnPrimary}
                  />
                ) : (
                  <Text style={styles.confirmSubmitText}>
                    {confirmation?.action === 'archive'
                      ? 'Archive Event'
                      : 'Restore Event'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success / error dialog */}
      <Modal
        visible={notice !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setNotice(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <Ionicons
                name={
                  notice?.isError
                    ? 'alert-circle-outline'
                    : 'checkmark-circle-outline'
                }
                size={30}
                color={
                  notice?.isError
                    ? COLORS.danger
                    : COLORS.success
                }
              />
            </View>

            <Text style={styles.confirmTitle}>
              {notice?.title}
            </Text>

            <Text style={styles.confirmMessage}>
              {notice?.message}
            </Text>

            <Pressable
              onPress={() => setNotice(null)}
              style={styles.noticeButton}
              accessibilityRole="button"
            >
              <Text style={styles.confirmSubmitText}>OK</Text>
            </Pressable>
          </View>
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
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  archiveTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  archiveTab: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  archiveTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  archiveTabText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  archiveTabTextActive: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
  },
  archiveNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  archiveNoticeText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
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
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    paddingVertical: 11,
  },
  filters: {
    gap: 8,
    paddingVertical: 14,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  filterTextActive: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
  },
  list: {
    gap: 10,
  },
  resultCount: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  eventCard: {
    padding: 15,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  eventHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitleContainer: {
    flex: 1,
    minWidth: 0,
  },
  eventTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  eventCode: {
    color: COLORS.primary,
    fontSize: 12,
    marginTop: 4,
  },
  statusBadge: {
    maxWidth: 120,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  archivedStatusBadge: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  details: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 5,
  },
  detailLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  detailValue: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cardActionText: {
    color: COLORS.primary,
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '90%',
    borderRadius: 18,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalContent: {
    padding: 18,
    paddingBottom: 24,
  },
  modalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modalStatusInfo: {
    flex: 1,
    minWidth: 0,
  },
  scheduleCard: {
    marginTop: 12,
    marginBottom: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    gap: 14,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  scheduleValue: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: 4,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 18,
  },
  attendeesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  attendeesButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  attendeesSection: {
    marginTop: 22,
    gap: 12,
  },
  attendeesHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  attendeesHeading: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  attendeeCountBadge: {
    minWidth: 26,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
  },
  attendeeCountText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  modalState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 8,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  attendeeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeInfo: {
    flex: 1,
    gap: 4,
  },
  attendeeName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  attendeeDetail: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  profileWarning: {
    color: COLORS.warning,
    fontSize: 12,
    lineHeight: 18,
  },
  archiveActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: COLORS.danger,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginTop: 24,
  },
  restoreActionButton: {
    backgroundColor: COLORS.primary,
  },
  archiveActionText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  archiveActionHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 10,
  },

  // QR code modal styles
  qrModalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    borderRadius: 18,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qrScroll: {
    flexGrow: 0,
  },
  qrContent: {
    padding: 20,
    paddingBottom: 24,
    alignItems: 'center',
  },
  qrImageContainer: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 252,
    minWidth: 252,
  },
  qrEventTitle: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 18,
  },
  qrEventCode: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
  qrHelpText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 14,
  },
  qrWarning: {
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 14,
  },

  // Confirmation and result dialog styles
  confirmOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 420,
    padding: 24,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  confirmIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmMessage: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 12,
  },
  confirmActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  confirmCancelButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
  },
  confirmCancelText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  confirmSubmitButton: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 12,
  },
  confirmSubmitText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  noticeButton: {
    width: '100%',
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    marginTop: 24,
    paddingHorizontal: 12,
  },
});
