import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
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
};

export default function AttendanceManagementScreen() {
  const access = useAdminAccess();
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');

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
        supabase.from('events').select('id, title, event_code'),
      ]);

      if (attendanceResult.error) throw attendanceResult.error;

      setRecords((attendanceResult.data ?? []) as AttendanceRow[]);

      if (eventResult.error) {
        console.error('LOAD ATTENDANCE EVENT DETAILS ERROR:', eventResult.error);
        setEvents([]);
        setEventError(
          `Event titles could not be loaded: ${eventResult.error.message}`
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
          : 'Unable to load attendance records. Check attendance-table access and try again.'
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

  const eventById = useMemo(
    () => new Map(events.map((event) => [event.id, event])),
    [events]
  );

  const eventIds = useMemo(
    () => Array.from(new Set(records.map((record) => record.event_id))),
    [records]
  );

  const filteredRecords = useMemo(() => {
    const term = search.trim().toLowerCase();

    return records
      .filter((record) => {
        const event = eventById.get(record.event_id);
        const matchesEvent =
          eventFilter === 'all' || record.event_id === eventFilter;
        const matchesSearch =
          !term ||
          record.student_id.toLowerCase().includes(term) ||
          record.event_id.toLowerCase().includes(term) ||
          record.id.toLowerCase().includes(term) ||
          record.scanned_at.toLowerCase().includes(term) ||
          (event?.title ?? '').toLowerCase().includes(term) ||
          (event?.event_code ?? '').toLowerCase().includes(term);

        return matchesEvent && matchesSearch;
      })
      .sort(
        (left, right) =>
          new Date(right.scanned_at).getTime() -
          new Date(left.scanned_at).getTime()
      );
  }, [records, eventById, search, eventFilter]);

  return (
    <AdminScreenFrame
      access={access}
      title="Attendance Management"
      subtitle="Review attendance records visible under the deployed row-level security policies."
      showBackButton
      refreshing={loading}
      onRefresh={() => void loadAttendance()}
    >
      <View style={styles.warningNotice}>
        <Ionicons
          name="shield-checkmark-outline"
          size={20}
          color={COLORS.warning}
        />
        <Text style={styles.noticeText}>
          Read-only. No correction or deletion actions are enabled. The
          checked-in policies allow users to read their own records and event
          creators to read records for their events; they do not establish
          administrator-wide visibility. This list may therefore be partial.
          Student names and audit history are not queried because the verified
          profile-read policy is owner-only and attendance_audit_log is absent
          from checked-in SQL.
        </Text>
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
          placeholder="Search student ID, event, or record ID"
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search attendance records"
        />
        {search.length > 0 ? (
          <Pressable
            onPress={() => setSearch('')}
            accessibilityRole="button"
            accessibilityLabel="Clear attendance search"
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
        {['all', ...eventIds].map((id) => {
          const active = eventFilter === id;
          const event = eventById.get(id);
          const label =
            id === 'all'
              ? 'All events'
              : event
                ? event.title
                : `Event ${id.slice(0, 8)}`;

          return (
            <Pressable
              key={id}
              onPress={() => setEventFilter(id)}
              style={[styles.filterChip, active && styles.filterChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[styles.filterText, active && styles.filterTextActive]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {eventError ? (
        <Text style={styles.inlineWarning}>{eventError}</Text>
      ) : null}

      {loading && records.length === 0 ? (
        <View style={styles.stateCard}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.stateText}>Loading attendance records...</Text>
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
      ) : filteredRecords.length === 0 ? (
        <View style={styles.stateCard}>
          <Ionicons
            name="receipt-outline"
            size={28}
            color={COLORS.textSecondary}
          />
          <Text style={styles.stateTitle}>
            {records.length === 0
              ? 'No visible records'
              : 'No matching records'}
          </Text>
          <Text style={styles.stateText}>
            {records.length === 0
              ? 'No rows are visible under the current attendance RLS policies.'
              : 'Try another search term or event filter.'}
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          <Text style={styles.resultCount}>
            {filteredRecords.length}{' '}
            {filteredRecords.length === 1 ? 'record' : 'records'}
          </Text>
          {filteredRecords.map((record) => {
            const event = eventById.get(record.event_id);

            return (
              <View key={record.id} style={styles.recordCard}>
                <View style={styles.recordHeading}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={22}
                    color={COLORS.primary}
                  />
                  <Text style={styles.eventTitle}>
                    {event?.title ?? 'Event details unavailable'}
                  </Text>
                </View>
                <Text style={styles.recordDetail}>
                  Event code: {event?.event_code ?? 'Unavailable'}
                </Text>
                <Text style={styles.recordDetail}>
                  Student account ID: {record.student_id}
                </Text>
                <Text style={styles.recordDetail}>
                  Attendance record ID: {record.id}
                </Text>
                <Text style={styles.recordDetail}>
                  Scanned: {new Date(record.scanned_at).toLocaleString()}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </AdminScreenFrame>
  );
}

const styles = StyleSheet.create({
  warningNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.warningLight,
    borderColor: COLORS.warning,
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
    maxWidth: 180,
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
  inlineWarning: {
    color: COLORS.warning,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  list: {
    gap: 10,
  },
  resultCount: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  recordCard: {
    padding: 15,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 7,
  },
  recordHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 4,
  },
  eventTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  recordDetail: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
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
});
