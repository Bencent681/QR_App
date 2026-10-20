import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { Redirect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

type Student = {
  id: string;
  full_name: string | null;
  email: string;
  role: Role;
  student_id: string | null;
  short_id: string | null;
};

type Teacher = {
  id: string;
  full_name: string | null;
  email: string;
  short_id: string | null;
};

type SchoolEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string;
  end_time: string;
  created_by: string;
  created_at: string;
};

type AttendanceRecord = {
  id: string;
  event_id: string;
  student_id: string;
  scanned_at: string;
};

type AttendanceAuditRecord = {
  id: string;
  attendance_id: string;
  student_id: string;
  event_id: string;
  action: string;
  old_scanned_at: string | null;
  new_scanned_at: string | null;
  admin_id: string;
  reason: string;
  created_at: string;
};

type CorrectionModalState = {
  record: AttendanceRecord;
  studentName: string;
  eventTitle: string;
  newScannedAt: string;
  reason: string;
  error: string | null;
  submitting: boolean;
};

type DeleteModalState = {
  record: AttendanceRecord;
  reason: string;
  error: string | null;
  submitting: boolean;
};

type EventStatus = 'Upcoming' | 'Ongoing' | 'Completed';
type EventFilter = 'All' | EventStatus;

function getEventStatus(
  event: SchoolEvent,
  now = Date.now()
): EventStatus {
  const start = new Date(event.start_time).getTime();
  const end = new Date(event.end_time).getTime();

  if (now < start) return 'Upcoming';
  if (now > end) return 'Completed';
  return 'Ongoing';
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Not available';

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AdminScreen() {
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [attendeeProfiles, setAttendeeProfiles] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  const [studentSearch, setStudentSearch] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [accountView, setAccountView] = useState<
    'students' | 'teachers' | null
  >(null);

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [auditHistory, setAuditHistory] = useState<AttendanceAuditRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [correctionState, setCorrectionState] =
    useState<CorrectionModalState | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteModalState | null>(null);
  const correctionSubmittingRef = useRef(false);
  const deletionConfirmingRef = useRef(false);

  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const [eventSearch, setEventSearch] = useState('');
const [eventFilter, setEventFilter] = useState<EventFilter>('All');
const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

const [attendanceView, setAttendanceView] = useState(false);
const [attendanceSearch, setAttendanceSearch] = useState('');


  // Load the signed-in user's role.
  useEffect(() => {
    let active = true;

    async function loadProfile() {
      const startedAt = Date.now();
      console.log('ADMIN ROLE LOOKUP: Started', { hasUser: !!user });

      if (!user) {
        console.log('ADMIN ROLE LOOKUP: Skipped because there is no user');
        setLoading(false);
        return;
      }

      setLoading(true);
      setProfileError(null);

      try {
        const profile = await getProfile(user.id);
        console.log('ADMIN ROLE LOOKUP: Resolved', {
          durationMs: Date.now() - startedAt,
          hasProfile: !!profile,
          role: profile?.role ?? null,
        });

        if (!active) return;

        if (!profile) {
          setProfileError('Unable to load your account profile.');
          setRole(null);
        } else {
          setRole(profile.role);
        }
      } catch (error) {
        console.error('LOAD ADMIN PROFILE ERROR:', error);

        if (active) {
          setProfileError('Something went wrong loading your profile.');
        }
      } finally {
        if (active) setLoading(false);
        console.log('ADMIN ROLE LOOKUP: Finished', {
          durationMs: Date.now() - startedAt,
          active,
        });
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [user?.id]);

  // Load student accounts.
  const loadStudents = useCallback(async () => {
    setStudentsLoading(true);
    setStudentsError(null);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, student_id, short_id')
        .eq('role', 'student')
        .order('short_id', { ascending: true });

      if (error) throw error;

      setStudents((data ?? []) as Student[]);
    } catch (error) {
      console.error('LOAD STUDENTS ERROR:', error);
      setStudentsError(
        'Unable to load students. Check your Supabase permissions and try again.'
      );
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  // Load events, teachers, attendance records, and attendee profiles.
  const loadEventDashboard = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    setAttendanceError(null);

    try {
      const { data: eventData, error: eventQueryError } = await supabase
        .from('events')
        .select(
          'id, event_code, title, start_time, end_time, created_by, created_at'
        )
        .order('created_at', { ascending: false });

      if (eventQueryError) throw eventQueryError;

      setEvents((eventData ?? []) as SchoolEvent[]);

      const [teacherResult, attendanceResult, profileResult] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, email, short_id')
            .eq('role', 'teacher'),

          supabase
            .from('attendance')
            .select('id, event_id, student_id, scanned_at'),

          supabase
            .from('profiles')
            .select('id, full_name, email, role, student_id, short_id'),
        ]);

      if (teacherResult.error) {
        console.error('LOAD TEACHERS ERROR:', teacherResult.error);
        setTeachers([]);
      } else {
        setTeachers((teacherResult.data ?? []) as Teacher[]);
      }

      if (attendanceResult.error) {
        console.error('LOAD ATTENDANCE ERROR:', attendanceResult.error);
        setAttendance([]);
        setAttendanceError(
          'Attendance records could not be loaded. Check your Supabase attendance-table permissions.'
        );
      } else {
        setAttendance(
          (attendanceResult.data ?? []) as AttendanceRecord[]
        );
      }

      if (profileResult.error) {
        console.error(
          'LOAD ATTENDEE PROFILES ERROR:',
          profileResult.error
        );
        setAttendeeProfiles([]);

        setAttendanceError((previous) =>
          previous ??
          'Attendee profiles could not be loaded. Check your Supabase profile permissions.'
        );
      } else {
        setAttendeeProfiles((profileResult.data ?? []) as Student[]);
      }
    } catch (error) {
      console.error('LOAD EVENTS ERROR:', error);
      setEventsError(
        'Unable to load events. Check your Supabase events-table permissions and try again.'
      );
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const loadAttendanceAuditHistory = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);

    try {
      const { data, error } = await supabase
        .from('attendance_audit_log')
        .select(
          'id, attendance_id, student_id, event_id, action, old_scanned_at, new_scanned_at, admin_id, reason, created_at'
        )
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAuditHistory((data ?? []) as AttendanceAuditRecord[]);
    } catch (error) {
      console.error('LOAD ATTENDANCE AUDIT HISTORY ERROR:', error);
      setAuditHistory([]);
      setAuditError(
        error instanceof Error
          ? `Unable to load attendance audit history: ${error.message}`
          : 'Unable to load attendance audit history. Check your Supabase permissions and try again.'
      );
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (role === 'admin') {
      loadStudents();
      loadEventDashboard();
      loadAttendanceAuditHistory();
    }
  }, [role, loadStudents, loadEventDashboard, loadAttendanceAuditHistory]);

  const refreshAttendanceData = useCallback(async () => {
    await Promise.all([
      loadStudents(),
      loadEventDashboard(),
      loadAttendanceAuditHistory(),
    ]);
  }, [loadStudents, loadEventDashboard, loadAttendanceAuditHistory]);

  // Create quick lookups by Supabase profile ID.
  const teacherById = useMemo(() => {
    return new Map(teachers.map((teacher) => [teacher.id, teacher]));
  }, [teachers]);

  const studentById = useMemo(() => {
    const profileMap = new Map<string, Student>();

    [...students, ...attendeeProfiles].forEach((student) => {
      profileMap.set(student.id, student);
    });

    return profileMap;
  }, [students, attendeeProfiles]);

  const eventById = useMemo(
    () => new Map(events.map((event) => [event.id, event])),
    [events]
  );

  const submitAttendanceCorrection = useCallback(async () => {
    if (!correctionState || correctionSubmittingRef.current) return;

    const timestamp = correctionState.newScannedAt.trim();
    const reason = correctionState.reason.trim();
    const parsedTimestamp = new Date(timestamp);

    if (!timestamp || Number.isNaN(parsedTimestamp.getTime())) {
      setCorrectionState((current) =>
        current
          ? {
              ...current,
              error: 'Enter a valid timestamp, such as 2026-10-20T09:30:00+08:00.',
            }
          : current
      );
      return;
    }

    if (!reason) {
      setCorrectionState((current) =>
        current ? { ...current, error: 'A reason is required.' } : current
      );
      return;
    }

    setCorrectionState((current) =>
      current ? { ...current, submitting: true, error: null } : current
    );
    correctionSubmittingRef.current = true;

    try {
      const { error } = await supabase.rpc('admin_correct_attendance', {
        p_attendance_id: correctionState.record.id,
        p_new_scanned_at: parsedTimestamp.toISOString(),
        p_reason: reason,
      });

      if (error) throw error;

      correctionSubmittingRef.current = false;
      setCorrectionState(null);
      await refreshAttendanceData();
      Alert.alert('Attendance corrected', 'The attendance record was updated.');
    } catch (error) {
      console.error('CORRECT ATTENDANCE ERROR:', error);
      setCorrectionState((current) =>
        current
          ? {
              ...current,
              submitting: false,
              error:
                error instanceof Error
                  ? `Unable to correct attendance: ${error.message}`
                  : 'Unable to correct attendance. Please try again.',
            }
          : current
      );
    } finally {
      correctionSubmittingRef.current = false;
    }
  }, [correctionState, refreshAttendanceData]);

  const submitAttendanceDeletion = useCallback(
    async (record: AttendanceRecord, reason: string) => {
      setDeleteState((current) =>
        current ? { ...current, submitting: true, error: null } : current
      );

      try {
        const { error } = await supabase.rpc('admin_delete_attendance', {
          p_attendance_id: record.id,
          p_reason: reason,
        });

        if (error) throw error;

        deletionConfirmingRef.current = false;
        setDeleteState(null);
        await refreshAttendanceData();
        Alert.alert('Attendance deleted', 'The attendance record was removed.');
      } catch (error) {
        console.error('DELETE ATTENDANCE ERROR:', error);
        setDeleteState((current) =>
          current
            ? {
                ...current,
                submitting: false,
                error:
                  error instanceof Error
                    ? `Unable to delete attendance: ${error.message}`
                    : 'Unable to delete attendance. Please try again.',
              }
            : current
        );
      } finally {
        deletionConfirmingRef.current = false;
      }
    },
    [refreshAttendanceData]
  );
  // Count unique students for each event.
  const attendanceCountByEvent = useMemo(() => {
    const result = new Map<string, Set<string>>();

    attendance.forEach((record) => {
      if (!result.has(record.event_id)) {
        result.set(record.event_id, new Set<string>());
      }

      result.get(record.event_id)?.add(record.student_id);
    });

    return result;
  }, [attendance]);

  const getAttendanceCount = useCallback(
    (eventId: string) => {
      return attendanceCountByEvent.get(eventId)?.size ?? 0;
    },
    [attendanceCountByEvent]
  );

 
  // Dashboard statistics.
  const stats = useMemo(() => {
    const now = Date.now();

    return {
      students: students.length,
      teachers: teachers.length,
      events: events.length,
      attendance: attendanceError
        ? null
        : Array.from(attendanceCountByEvent.values()).reduce(
            (total, studentIds) => total + studentIds.size,
            0
          ),
      ongoing: events.filter(
        (event) => getEventStatus(event, now) === 'Ongoing'
      ).length,
      upcoming: events.filter(
        (event) => getEventStatus(event, now) === 'Upcoming'
      ).length,
      completed: events.filter(
        (event) => getEventStatus(event, now) === 'Completed'
      ).length,
    };
  }, [students, teachers, events, attendanceError, attendanceCountByEvent]);

  // Search students by Short ID, School ID, name, email, or Supabase UUID.
  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();

    if (!term) return [];

    return students.filter((student) => {
      return (
        (student.short_id ?? '').toLowerCase().includes(term) ||
        (student.student_id ?? '').toLowerCase().includes(term) ||
        (student.full_name ?? '').toLowerCase().includes(term) ||
        (student.email ?? '').toLowerCase().includes(term) ||
        student.id.toLowerCase().includes(term)
      );
    });
  }, [students, studentSearch]);

  // Search teachers by Short ID, name, email, or Supabase UUID.
  const filteredTeachers = useMemo(() => {
    const term = teacherSearch.trim().toLowerCase();

    if (!term) return [];

    return teachers.filter((teacher) => {
      return (
        (teacher.short_id ?? '').toLowerCase().includes(term) ||
        (teacher.full_name ?? '').toLowerCase().includes(term) ||
        (teacher.email ?? '').toLowerCase().includes(term) ||
        teacher.id.toLowerCase().includes(term)
      );
    });
  }, [teachers, teacherSearch]);

  // Search and filter school events.
  const filteredEvents = useMemo(() => {
    const term = eventSearch.trim().toLowerCase();
    const now = Date.now();

    return events.filter((event) => {
      const teacher = teacherById.get(event.created_by);

      const matchesSearch =
        !term ||
        event.title.toLowerCase().includes(term) ||
        event.event_code.toLowerCase().includes(term) ||
        (teacher?.full_name ?? '').toLowerCase().includes(term) ||
        (teacher?.email ?? '').toLowerCase().includes(term);

      const status = getEventStatus(event, now);
      const matchesFilter =
        eventFilter === 'All' || status === eventFilter;

      return matchesSearch && matchesFilter;
    });
  }, [events, eventSearch, eventFilter, teacherById]);

  // Attendance records for the selected event.
  const selectedAttendees = useMemo(() => {
    if (!selectedEventId) return [];

    return attendance
      .filter((record) => record.event_id === selectedEventId)
      .sort(
        (a, b) =>
          new Date(a.scanned_at).getTime() -
          new Date(b.scanned_at).getTime()
      );
  }, [attendance, selectedEventId]);

  // Require login.
  if (!user) {
    return <Redirect href="/login" />;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading Admin dashboard...</Text>
      </View>

      
    );
  }

  if (role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons
            name="lock-closed-outline"
            size={48}
            color={COLORS.danger}
          />
          <Text style={styles.deniedTitle}>Access Restricted</Text>
          <Text style={styles.deniedText}>
            This screen is only available to Admin accounts.
          </Text>
          {profileError ? (
            <Text style={styles.errorText}>{profileError}</Text>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Header title="Admin Dashboard" />

        <View style={styles.welcome}>
          <Text style={styles.eyebrow}>SCHOOL MANAGEMENT</Text>
          <Text style={styles.title}>Welcome, Admin</Text>
          <Text style={styles.subtitle}>
            Monitor school events, student participation, and attendance.
          </Text>
        </View>

        <View style={styles.notice}>
          <Ionicons
            name="shield-checkmark-outline"
            size={22}
            color={COLORS.primary}
          />
          <View style={styles.noticeTextContainer}>
            <Text style={styles.noticeTitle}>Administrator Access</Text>
            <Text style={styles.noticeText}>
              Review school events and attendance records in one place.
            </Text>
          </View>
        </View>

        {/* Dashboard statistics */}
        <Text style={styles.sectionTitle}>School Overview</Text>

        <View style={styles.statsGrid}>
          <StatCard
            icon="people-outline"
            label="Students"
            value={studentsLoading ? '…' : String(stats.students)}
            onPress={() => {
              setStudentSearch('');
              setTeacherSearch('');
              setAccountView('students');
            }}
          />

          <StatCard
            icon="person-outline"
            label="Teachers"
            value={eventsLoading ? '…' : String(stats.teachers)}
            onPress={() => {
              setStudentSearch('');
              setTeacherSearch('');
              setAccountView('teachers');
            }}
          />

          <StatCard
            icon="calendar-outline"
            label="Total Events"
            value={eventsLoading ? '…' : String(stats.events)}
          />

          <StatCard
            icon="checkmark-circle-outline"
            label="Total Attendance Records"
            value={
              eventsLoading
                ? '…'
                : stats.attendance === null
                  ? '—'
                  : String(stats.attendance)
            }
          />
        </View>

        {/* Account directory */}
        {accountView !== null && (
          <View>
            <View style={styles.sectionHeadingRow}>
              <View style={styles.headingTextContainer}>
                <Text style={styles.sectionTitleNoMargin}>
                  {accountView === 'students'
                    ? 'Student Accounts'
                    : 'Teacher Accounts'}
                </Text>
                <Text style={styles.directorySubtitle}>
                  Search by ID, name, email, or account UUID.
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  setAccountView(null);
                  setStudentSearch('');
                  setTeacherSearch('');
                }}
                style={styles.refreshButton}
                accessibilityLabel="Close account directory"
              >
                <Ionicons
                  name="close-outline"
                  size={22}
                  color={COLORS.primary}
                />
              </Pressable>
            </View>

            {/* Student search */}
            {accountView === 'students' && (
              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={COLORS.textSecondary}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search School ID, Short ID, name, or email"
                  placeholderTextColor={COLORS.textSecondary}
                  value={studentSearch}
                  onChangeText={setStudentSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  accessibilityLabel="Search student accounts"
                />
                {studentSearch.length > 0 && (
                  <Pressable
                    onPress={() => setStudentSearch('')}
                    accessibilityLabel="Clear student search"
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={COLORS.textSecondary}
                    />
                  </Pressable>
                )}
              </View>
            )}

            {/* Teacher search */}
            {accountView === 'teachers' && (
              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={COLORS.textSecondary}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search Short ID, name, or email"
                  placeholderTextColor={COLORS.textSecondary}
                  value={teacherSearch}
                  onChangeText={setTeacherSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  accessibilityLabel="Search teacher accounts"
                />
                {teacherSearch.length > 0 && (
                  <Pressable
                    onPress={() => setTeacherSearch('')}
                    accessibilityLabel="Clear teacher search"
                  >
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={COLORS.textSecondary}
                    />
                  </Pressable>
                )}
              </View>
            )}

            {/* Student search results */}
            {accountView === 'students' && (
              <>
                {studentsLoading ? (
                  <View style={styles.directoryMessage}>
                    <ActivityIndicator
                      size="small"
                      color={COLORS.primary}
                    />
                    <Text style={styles.loadingText}>
                      Loading students...
                    </Text>
                  </View>
                ) : studentsError ? (
                  <EmptyState
                    icon="alert-circle-outline"
                    title="Could not load students"
                    message={studentsError}
                    actionLabel="Try Again"
                    onAction={loadStudents}
                  />
                ) : studentSearch.trim() === '' ? (
                  <View style={styles.searchPrompt}>
                    <Ionicons
                      name="search-outline"
                      size={27}
                      color={COLORS.textSecondary}
                    />
                    <Text style={styles.emptyTitle}>
                      Search for a student
                    </Text>
                    <Text style={styles.emptyText}>
                      Enter a School ID, Short ID, name, email, or Supabase UUID
                      to see matching accounts.
                    </Text>
                  </View>
                ) : filteredStudents.length === 0 ? (
                  <EmptyState
                    icon="search-outline"
                    title="No matching students"
                    message="Try another School ID, Short ID, name, email, or UUID."
                  />
                ) : (
                  <>
                    <Text style={styles.resultCount}>
                      {filteredStudents.length}{' '}
                      {filteredStudents.length === 1
                        ? 'student found'
                        : 'students found'}
                    </Text>

                    {filteredStudents.map((student) => (
                      <View key={student.id} style={styles.studentCard}>
                        <View style={styles.studentAvatar}>
                          <Text style={styles.studentAvatarText}>
                            {(
                              student.full_name?.trim()?.charAt(0) ||
                              student.email.charAt(0) ||
                              'S'
                            ).toUpperCase()}
                          </Text>
                        </View>

                        <View style={styles.studentInfo}>
                          <Text style={styles.studentName}>
                            {student.full_name?.trim() ||
                              'Name not provided'}
                          </Text>
                          <Text style={styles.studentEmail}>
                            {student.email}
                          </Text>
                          <Text style={styles.attendeeStudentId}>
                            Short ID: {student.short_id || 'Not assigned'}
                          </Text>
                          <Text style={styles.attendeeStudentId}>
                            School ID: {student.student_id || 'Not assigned'}
                          </Text>
                        </View>

                        <View style={styles.studentBadge}>
                          <Text style={styles.studentBadgeText}>
                            STUDENT
                          </Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}

            {/* Teacher search results */}
            {accountView === 'teachers' && (
              <>
                {eventsLoading ? (
                  <View style={styles.directoryMessage}>
                    <ActivityIndicator
                      size="small"
                      color={COLORS.primary}
                    />
                    <Text style={styles.loadingText}>
                      Loading teachers...
                    </Text>
                  </View>
                ) : teacherSearch.trim() === '' ? (
                  <View style={styles.searchPrompt}>
                    <Ionicons
                      name="search-outline"
                      size={27}
                      color={COLORS.textSecondary}
                    />
                    <Text style={styles.emptyTitle}>
                      Search for a teacher
                    </Text>
                    <Text style={styles.emptyText}>
                      Enter a Short ID, name, email, or Supabase UUID to see
                      matching accounts.
                    </Text>
                  </View>
                ) : filteredTeachers.length === 0 ? (
                  <EmptyState
                    icon="search-outline"
                    title="No matching teachers"
                    message="Try another Short ID, name, email, or UUID."
                  />
                ) : (
                  <>
                    <Text style={styles.resultCount}>
                      {filteredTeachers.length}{' '}
                      {filteredTeachers.length === 1
                        ? 'teacher found'
                        : 'teachers found'}
                    </Text>

                    {filteredTeachers.map((teacher) => (
                      <View key={teacher.id} style={styles.studentCard}>
                        <View style={styles.studentAvatar}>
                          <Text style={styles.studentAvatarText}>
                            {(
                              teacher.full_name?.trim()?.charAt(0) ||
                              teacher.email.charAt(0) ||
                              'T'
                            ).toUpperCase()}
                          </Text>
                        </View>

                        <View style={styles.studentInfo}>
                          <Text style={styles.studentName}>
                            {teacher.full_name?.trim() ||
                              'Name not provided'}
                          </Text>
                          <Text style={styles.studentEmail}>
                            {teacher.email}
                          </Text>
                          <Text style={styles.attendeeStudentId}>
                            Short ID: {teacher.short_id || 'Not assigned'}
                          </Text>
                          
                        </View>

                        <View style={styles.studentBadge}>
                          <Text style={styles.studentBadgeText}>
                            TEACHER
                          </Text>
                        </View>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* Event status summary */}
        <View style={styles.statusSummary}>
          <StatusSummaryItem
            label="Ongoing"
            value={String(stats.ongoing)}
            color="#15803D"
            background="#DCFCE7"
          />
          <StatusSummaryItem
            label="Upcoming"
            value={String(stats.upcoming)}
            color="#1D4ED8"
            background="#DBEAFE"
          />
          <StatusSummaryItem
            label="Completed"
            value={String(stats.completed)}
            color="#64748B"
            background="#E2E8F0"
          />
        </View>

        {/* Event monitoring */}
        <View style={styles.sectionHeadingRow}>
          <View style={styles.headingTextContainer}>
            <Text style={styles.sectionTitleNoMargin}>Event Monitoring</Text>
            <Text style={styles.directorySubtitle}>
              Events created by your teachers.
            </Text>
          </View>

          <Pressable
            onPress={loadEventDashboard}
            disabled={eventsLoading}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.pressed,
              eventsLoading && styles.disabledButton,
            ]}
            accessibilityLabel="Refresh events and attendance"
          >
            <Ionicons
              name="refresh-outline"
              size={20}
              color={COLORS.primary}
            />
          </Pressable>
        </View>

        <View style={styles.searchBox}>
          <Ionicons
            name="search-outline"
            size={20}
            color={COLORS.textSecondary}
          />
          <TextInput
            style={styles.searchInput}
            value={eventSearch}
            onChangeText={setEventSearch}
            placeholder="Search event, code, or teacher"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search events"
          />
          {eventSearch.length > 0 && (
            <Pressable
              onPress={() => setEventSearch('')}
              accessibilityLabel="Clear event search"
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={COLORS.textSecondary}
              />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {(['All', 'Ongoing', 'Upcoming', 'Completed'] as EventFilter[]).map(
            (filter) => {
              const active = eventFilter === filter;

              return (
                <Pressable
                  key={filter}
                  onPress={() => setEventFilter(filter)}
                  style={[
                    styles.filterButton,
                    active && styles.filterButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      active && styles.filterTextActive,
                    ]}
                  >
                    {filter}
                  </Text>
                </Pressable>
              );
            }
          )}
        </ScrollView>

        {attendanceError ? (
          <View style={styles.inlineWarning}>
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={COLORS.warning}
            />
            <Text style={styles.inlineWarningText}>{attendanceError}</Text>
          </View>
        ) : null}

        {eventsLoading ? (
          <View style={styles.directoryMessage}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading school events...</Text>
          </View>
        ) : eventsError ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Could not load events"
            message={eventsError}
            actionLabel="Try Again"
            onAction={loadEventDashboard}
          />
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title={events.length === 0 ? 'No events yet' : 'No matching events'}
            message={
              events.length === 0
                ? 'Events created by teachers will appear here when available.'
                : 'Try a different search term or event status filter.'
            }
          />
        ) : (
          <>
            <Text style={styles.resultCount}>
              {filteredEvents.length}{' '}
              {filteredEvents.length === 1 ? 'event' : 'events'} found
            </Text>

            {filteredEvents.map((event) => {
              const teacher = teacherById.get(event.created_by);
              const status = getEventStatus(event);
              const attendeeCount = getAttendanceCount(event.id);
              const expanded = selectedEventId === event.id;

              return (
                <View key={event.id} style={styles.eventCard}>
                  <Pressable
                    onPress={() =>
                      setSelectedEventId(expanded ? null : event.id)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${
                      expanded ? 'Hide' : 'View'
                    } details for ${event.title}`}
                  >
                    <View style={styles.eventTopRow}>
                      <View style={styles.eventIcon}>
                        <Ionicons
                          name="calendar"
                          size={23}
                          color={COLORS.primary}
                        />
                      </View>

                      <View style={styles.eventTitleContainer}>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                        <Text style={styles.eventTeacher}>
                          {teacher?.full_name?.trim() ||
                            teacher?.email ||
                            'Teacher information unavailable'}
                        </Text>
                      </View>

                      <StatusBadge status={status} />
                    </View>

                    <View style={styles.eventCodeRow}>
                      <Ionicons
                        name="key-outline"
                        size={15}
                        color={COLORS.primary}
                      />
                      <Text style={styles.eventCodeLabel}>Event Code</Text>
                      <Text style={styles.eventCode}>{event.event_code}</Text>
                    </View>

                    <View style={styles.eventTimeRow}>
                      <View style={styles.eventTimeItem}>
                        <Ionicons
                          name="play-circle-outline"
                          size={17}
                          color={COLORS.textSecondary}
                        />
                        <View style={styles.eventTimeText}>
                          <Text style={styles.eventTimeLabel}>Starts</Text>
                          <Text style={styles.eventTimeValue}>
                            {formatDateTime(event.start_time)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.eventTimeItem}>
                        <Ionicons
                          name="stop-circle-outline"
                          size={17}
                          color={COLORS.textSecondary}
                        />
                        <View style={styles.eventTimeText}>
                          <Text style={styles.eventTimeLabel}>Closes</Text>
                          <Text style={styles.eventTimeValue}>
                            {formatDateTime(event.end_time)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.eventFooter}>
                      <View style={styles.attendanceCount}>
                        <Ionicons
                          name="people-outline"
                          size={19}
                          color={COLORS.primary}
                        />
                        <Text style={styles.attendanceCountNumber}>
                          {attendanceError ? '—' : attendeeCount}
                        </Text>
                        <Text style={styles.attendanceCountLabel}>
                          {attendeeCount === 1
                            ? 'student attended'
                            : 'students attended'}
                        </Text>
                      </View>

                      <View style={styles.viewDetails}>
                        <Text style={styles.viewDetailsText}>
                          {expanded ? 'Hide details' : 'View details'}
                        </Text>
                        <Ionicons
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={17}
                          color={COLORS.primary}
                        />
                      </View>
                    </View>
                  </Pressable>

                  {expanded && (
                    <View style={styles.attendeesSection}>
                      <View style={styles.attendeesHeading}>
                        <Text style={styles.attendeesTitle}>Attendees</Text>
                        <Text style={styles.attendeesCount}>
                          {attendanceError
                            ? 'Unavailable'
                            : `${attendeeCount} unique`}
                        </Text>
                      </View>

                      {attendanceError ? (
                        <Text style={styles.emptyText}>
                          Attendee records or profiles could not be loaded.
                          Check the error message above and your Supabase
                          permissions.
                        </Text>
                      ) : selectedAttendees.length === 0 ? (
                        <Text style={styles.emptyText}>
                          No students have recorded attendance for this event
                          yet.
                        </Text>
                      ) : (
                        selectedAttendees.map((record) => {
                          const student = studentById.get(record.student_id);

                          return (
                            <View key={record.id} style={styles.attendeeRow}>
                              <View style={styles.attendeeAvatar}>
                                <Ionicons
                                  name="person"
                                  size={17}
                                  color={COLORS.primary}
                                />
                              </View>

                              <View style={styles.attendeeInfo}>
                                <Text style={styles.attendeeName}>
                                  {student?.full_name?.trim() ||
                                    'Student name unavailable'}
                                </Text>

                                <Text style={styles.attendeeStudentId}>
                                  Short ID: {student?.short_id || 'Not assigned'}
                                </Text>

                                {student?.student_id ? (
                                  <Text style={styles.attendeeStudentId}>
                                    School ID: {student.student_id}
                                  </Text>
                                ) : null}

                                {student?.email ? (
                                  <Text style={styles.attendeeStudentId}>
                                    {student.email}
                                  </Text>
                                ) : null}
                              </View>

                              <View style={styles.scanTime}>
                                <Text style={styles.scanTimeLabel}>
                                  Scanned
                                </Text>
                                <Text style={styles.scanTimeValue}>
                                  {formatTime(record.scanned_at)}
                                </Text>
                                <Text style={styles.scanDateValue}>
                                  {new Date(
                                    record.scanned_at
                                  ).toLocaleDateString()}
                                </Text>
                              </View>

                              <View style={styles.attendeeActions}>
                                <Pressable
                                  style={styles.attendeeActionButton}
                                  onPress={() =>
                                    setCorrectionState({
                                      record,
                                      studentName:
                                        student?.full_name?.trim() ||
                                        'Student name unavailable',
                                      eventTitle: event.title,
                                      newScannedAt: record.scanned_at,
                                      reason: '',
                                      error: null,
                                      submitting: false,
                                    })
                                  }
                                  accessibilityRole="button"
                                  accessibilityLabel={`Correct attendance for ${
                                    student?.full_name || 'student'
                                  }`}
                                >
                                  <Text style={styles.correctActionText}>
                                    Correct
                                  </Text>
                                </Pressable>
                                <Pressable
                                  style={[
                                    styles.attendeeActionButton,
                                    styles.deleteActionButton,
                                  ]}
                                  onPress={() =>
                                    setDeleteState({
                                      record,
                                      reason: '',
                                      error: null,
                                      submitting: false,
                                    })
                                  }
                                  accessibilityRole="button"
                                  accessibilityLabel={`Delete attendance for ${
                                    student?.full_name || 'student'
                                  }`}
                                >
                                  <Text style={styles.deleteActionText}>
                                    Delete
                                  </Text>
                                </Pressable>
                              </View>
                            </View>
                          );
                        })
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {/* Read-only attendance audit history */}
        <View style={styles.sectionHeadingRow}>
          <View style={styles.headingTextContainer}>
            <Text style={styles.sectionTitleNoMargin}>
              Attendance Audit History
            </Text>
            <Text style={styles.directorySubtitle}>
              Review administrator changes to attendance records.
            </Text>
          </View>
          <Pressable
            onPress={loadAttendanceAuditHistory}
            disabled={auditLoading}
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.pressed,
              auditLoading && styles.disabledButton,
            ]}
            accessibilityLabel="Refresh attendance audit history"
          >
            <Ionicons
              name="refresh-outline"
              size={20}
              color={COLORS.primary}
            />
          </Pressable>
        </View>

        {auditLoading ? (
          <View style={styles.directoryMessage}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadingText}>
              Loading attendance audit history...
            </Text>
          </View>
        ) : auditError ? (
          <EmptyState
            icon="alert-circle-outline"
            title="Could not load audit history"
            message={auditError}
            actionLabel="Try Again"
            onAction={loadAttendanceAuditHistory}
          />
        ) : auditHistory.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="No attendance changes yet"
            message="Corrections and deletions will appear here."
          />
        ) : (
          auditHistory.map((audit) => {
            const student = studentById.get(audit.student_id);
            const auditedEvent = eventById.get(audit.event_id);

            return (
              <View key={audit.id} style={styles.auditCard}>
                <View style={styles.auditHeader}>
                  <Text style={styles.auditAction}>
                    {audit.action.replace(/_/g, ' ')}
                  </Text>
                  <Text style={styles.auditDate}>
                    {formatDateTime(audit.created_at)}
                  </Text>
                </View>
                <Text style={styles.auditDetail}>
                  Student: {student?.full_name?.trim() || 'Unavailable'}
                </Text>
                <Text style={styles.auditDetail}>
                  Event: {auditedEvent?.title || 'Unavailable'}
                </Text>
                <Text style={styles.auditDetail}>
                  Original timestamp:{' '}
                  {audit.old_scanned_at
                    ? formatDateTime(audit.old_scanned_at)
                    : 'Not available'}
                </Text>
                {audit.new_scanned_at ? (
                  <Text style={styles.auditDetail}>
                    New timestamp: {formatDateTime(audit.new_scanned_at)}
                  </Text>
                ) : null}
                <Text style={styles.auditDetail}>
                  Administrator ID: {audit.admin_id || 'Not available'}
                </Text>
                <Text style={styles.auditReason}>
                  Reason: {audit.reason || 'Not provided'}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={correctionState !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!correctionState?.submitting) setCorrectionState(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Correct Attendance</Text>
            {correctionState ? (
              <>
                <Text style={styles.modalContext}>
                  Student: {correctionState.studentName}
                </Text>
                <Text style={styles.modalContext}>
                  Event: {correctionState.eventTitle}
                </Text>
                <Text style={styles.modalContext}>
                  Current scan: {formatDateTime(correctionState.record.scanned_at)}
                </Text>

                <Text style={styles.modalLabel}>New timestamp</Text>
                <TextInput
                  style={styles.modalInput}
                  value={correctionState.newScannedAt}
                  onChangeText={(newScannedAt) =>
                    setCorrectionState((current) =>
                      current
                        ? { ...current, newScannedAt, error: null }
                        : current
                    )
                  }
                  placeholder="2026-10-20T09:30:00+08:00"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!correctionState.submitting}
                />
                <Text style={styles.modalLabel}>Reason (required)</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalMultilineInput]}
                  value={correctionState.reason}
                  onChangeText={(reason) =>
                    setCorrectionState((current) =>
                      current ? { ...current, reason, error: null } : current
                    )
                  }
                  placeholder="Explain why this attendance is being corrected"
                  placeholderTextColor={COLORS.textSecondary}
                  multiline
                  textAlignVertical="top"
                  editable={!correctionState.submitting}
                />
                {correctionState.error ? (
                  <Text style={styles.errorText}>
                    {correctionState.error}
                  </Text>
                ) : null}
                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.modalSecondaryButton}
                    onPress={() => setCorrectionState(null)}
                    disabled={correctionState.submitting}
                  >
                    <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.modalPrimaryButton,
                      correctionState.submitting && styles.disabledButton,
                    ]}
                    onPress={submitAttendanceCorrection}
                    disabled={correctionState.submitting}
                  >
                    {correctionState.submitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.modalPrimaryButtonText}>
                        Save correction
                      </Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteState !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleteState?.submitting) setDeleteState(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Attendance</Text>
            {deleteState ? (
              <>
                <Text style={styles.modalContext}>
                  Student:{' '}
                  {studentById.get(deleteState.record.student_id)?.full_name?.trim() ||
                    'Student name unavailable'}
                </Text>
                <Text style={styles.modalContext}>
                  Event:{' '}
                  {eventById.get(deleteState.record.event_id)?.title ||
                    'Event unavailable'}
                </Text>
                <Text style={styles.modalWarning}>
                  This removes the attendance record. Enter a reason before
                  continuing to the final confirmation.
                </Text>
                <Text style={styles.modalLabel}>Reason (required)</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalMultilineInput]}
                  value={deleteState.reason}
                  onChangeText={(reason) =>
                    setDeleteState((current) =>
                      current ? { ...current, reason, error: null } : current
                    )
                  }
                  placeholder="Explain why this attendance is being deleted"
                  placeholderTextColor={COLORS.textSecondary}
                  multiline
                  textAlignVertical="top"
                  editable={!deleteState.submitting}
                />
                {deleteState.error ? (
                  <Text style={styles.errorText}>{deleteState.error}</Text>
                ) : null}
                <View style={styles.modalActions}>
                  <Pressable
                    style={styles.modalSecondaryButton}
                    onPress={() => setDeleteState(null)}
                    disabled={deleteState.submitting}
                  >
                    <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.modalDangerButton,
                      deleteState.submitting && styles.disabledButton,
                    ]}
                    disabled={deleteState.submitting}
                    onPress={() => {
                      const reason = deleteState.reason.trim();
                      if (!reason) {
                        setDeleteState((current) =>
                          current
                            ? {
                                ...current,
                                error: 'A reason is required.',
                              }
                            : current
                        );
                        return;
                      }

                      if (deletionConfirmingRef.current) return;
                      deletionConfirmingRef.current = true;
                      setDeleteState((current) =>
                        current
                          ? { ...current, submitting: true, error: null }
                          : current
                      );
                      Alert.alert(
                        'Confirm attendance deletion',
                        'This will permanently remove the attendance record. Continue?',
                        [
                          {
                            text: 'Cancel',
                            style: 'cancel',
                            onPress: () => {
                              deletionConfirmingRef.current = false;
                              setDeleteState((current) =>
                                current
                                  ? { ...current, submitting: false }
                                  : current
                              );
                            },
                          },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () =>
                              void submitAttendanceDeletion(
                                deleteState.record,
                                reason
                              ),
                          },
                        ],
                        { cancelable: false }
                      );
                    }}
                  >
                    <Text style={styles.modalDangerButtonText}>
                      Continue
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

type StatCardProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  onPress?: () => void;
};

function StatCard({ icon, label, value, onPress }: StatCardProps) {
  return (
    <Pressable
      style={styles.statCard}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={23} color={COLORS.primary} />
      </View>

      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>

      {onPress && (
        <Text
          style={{
            color: COLORS.primary,
            fontSize: 12,
            marginTop: 5,
          }}
        >
          View accounts →
        </Text>
      )}
    </Pressable>
  );
}

function StatusSummaryItem({
  label,
  value,
  color,
  background,
}: {
  label: string;
  value: string;
  color: string;
  background: string;
}) {
  return (
    <View style={[styles.statusSummaryItem, { backgroundColor: background }]}>
      <Text style={[styles.statusSummaryValue, { color }]}>{value}</Text>
      <Text style={[styles.statusSummaryLabel, { color }]}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status: EventStatus }) {
  const config = {
    Ongoing: { background: '#DCFCE7', color: '#15803D' },
    Upcoming: { background: '#DBEAFE', color: '#1D4ED8' },
    Completed: { background: '#E2E8F0', color: '#475569' },
  }[status];

  return (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: config.background },
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: config.color }]} />
      <Text style={[styles.statusBadgeText, { color: config.color }]}>
        {status}
      </Text>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons
        name={icon}
        size={32}
        color={COLORS.textSecondary}
      />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>

      {actionLabel && onAction ? (
        <Pressable style={styles.retryButton} onPress={onAction}>
          <Text style={styles.retryButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  welcome: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
  },
  eyebrow: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 27,
    fontWeight: '800',
    marginTop: 7,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 22,
    padding: 15,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  noticeTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  noticeTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  noticeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  sectionTitle: {
    marginHorizontal: 22,
    marginTop: 26,
    marginBottom: 13,
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionTitleNoMargin: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
  },
  statCard: {
    width: '46%',
    flexGrow: 1,
    margin: '2%',
    padding: 16,
    minHeight: 137,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: 25,
    fontWeight: '800',
    marginTop: 12,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  statusSummary: {
    flexDirection: 'row',
    marginHorizontal: 22,
    marginTop: 8,
    gap: 8,
  },
  statusSummaryItem: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statusSummaryValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statusSummaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginHorizontal: 22,
    marginBottom: 13,
  },
  headingTextContainer: {
    flex: 1,
  },
  directorySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  refreshButton: {
    width: 42,
    height: 42,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pressed: {
    opacity: 0.7,
  },
  disabledButton: {
    opacity: 0.5,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 22,
    paddingHorizontal: 13,
    minHeight: 50,
    backgroundColor: COLORS.card,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 9,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  searchPrompt: {
    alignItems: 'center',
    marginHorizontal: 22,
    marginTop: 12,
    padding: 24,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterRow: {
    paddingHorizontal: 22,
    paddingVertical: 13,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  inlineWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 22,
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFFBEB',
    gap: 8,
  },
  inlineWarningText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12,
    lineHeight: 18,
  },
  directoryMessage: {
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCount: {
    marginHorizontal: 22,
    marginTop: 8,
    marginBottom: 10,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  eventCard: {
    marginHorizontal: 22,
    marginBottom: 12,
    padding: 14,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  eventTitleContainer: {
    flex: 1,
    marginHorizontal: 10,
  },
  eventTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  eventTeacher: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  eventCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    paddingVertical: 10,
    paddingHorizontal: 11,
    borderRadius: 9,
    backgroundColor: COLORS.background,
  },
  eventCodeLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginLeft: 6,
    marginRight: 8,
  },
  eventCode: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  eventTimeRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
  eventTimeItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  eventTimeText: {
    flex: 1,
    marginLeft: 6,
  },
  eventTimeLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginBottom: 4,
  },
  eventTimeValue: {
    color: COLORS.textPrimary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 14,
    paddingTop: 12,
    gap: 8,
  },
  attendanceCount: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  attendanceCountNumber: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: '800',
    marginLeft: 6,
  },
  attendanceCountLabel: {
    flexShrink: 1,
    color: COLORS.textSecondary,
    fontSize: 10,
    marginLeft: 5,
  },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewDetailsText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  attendeesSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 14,
    paddingTop: 13,
  },
  attendeesHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  attendeesTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  attendeesCount: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  attendeeAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  attendeeInfo: {
    flex: 1,
    marginLeft: 9,
    marginRight: 6,
  },
  attendeeName: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  attendeeStudentId: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },
  scanTime: {
    alignItems: 'flex-end',
  },
  scanTimeLabel: {
    color: COLORS.textSecondary,
    fontSize: 9,
  },
  scanTimeValue: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  scanDateValue: {
    color: COLORS.textSecondary,
    fontSize: 9,
    marginTop: 2,
  },
  attendeeActions: {
    marginLeft: 8,
    gap: 5,
  },
  attendeeActionButton: {
    minWidth: 58,
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: COLORS.primaryLight,
  },
  correctActionText: {
    color: COLORS.primaryDark,
    fontSize: 10,
    fontWeight: '700',
  },
  deleteActionButton: {
    backgroundColor: '#FEE2E2',
  },
  deleteActionText: {
    color: COLORS.danger,
    fontSize: 10,
    fontWeight: '700',
  },
  auditCard: {
    marginHorizontal: 22,
    marginBottom: 10,
    padding: 14,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  auditHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  auditAction: {
    flex: 1,
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  auditDate: {
    color: COLORS.textSecondary,
    fontSize: 10,
    textAlign: 'right',
  },
  auditDetail: {
    color: COLORS.textPrimary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },
  auditReason: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 7,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalCard: {
    padding: 20,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 12,
  },
  modalContext: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 5,
  },
  modalWarning: {
    color: COLORS.danger,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  modalLabel: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 13,
    marginBottom: 6,
  },
  modalInput: {
    minHeight: 46,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 13,
  },
  modalMultilineInput: {
    minHeight: 82,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 9,
    marginTop: 18,
  },
  modalSecondaryButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 9,
    backgroundColor: COLORS.background,
  },
  modalSecondaryButtonText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  modalPrimaryButton: {
    minHeight: 42,
    minWidth: 118,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
  },
  modalPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  modalDangerButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 9,
    backgroundColor: COLORS.danger,
  },
  modalDangerButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 22,
    marginBottom: 10,
    padding: 13,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  studentAvatar: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
  },
  studentAvatarText: {
    color: COLORS.primaryDark,
    fontSize: 17,
    fontWeight: '800',
  },
  studentInfo: {
    flex: 1,
    marginLeft: 11,
    marginRight: 5,
  },
  studentName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  studentEmail: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  studentIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 7,
  },
  studentIdLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginLeft: 4,
    marginRight: 5,
  },
  studentId: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  studentBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  studentBadgeText: {
    color: COLORS.primaryDark,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  emptyCard: {
    alignItems: 'center',
    marginHorizontal: 22,
    marginTop: 12,
    padding: 24,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  deniedTitle: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 14,
  },
  deniedText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  errorText: {
    color: COLORS.danger,
    textAlign: 'center',
    marginTop: 12,
  },
});