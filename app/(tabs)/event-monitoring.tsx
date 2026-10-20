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

type EventRow = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  created_by: string | null;
  created_at: string;
};

type EventStatus = 'Upcoming' | 'Ongoing' | 'Completed' | 'Schedule incomplete';
type EventFilter = 'All' | EventStatus;

function getEventStatus(event: EventRow, now: number): EventStatus {
  if (!event.start_time || !event.end_time) return 'Schedule incomplete';

  const start = new Date(event.start_time).getTime();
  const end = new Date(event.end_time).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 'Schedule incomplete';
  }

  if (now < start) return 'Upcoming';
  if (now > end) return 'Completed';
  return 'Ongoing';
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not set';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

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

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('events')
        .select(
          'id, event_code, title, start_time, end_time, created_by, created_at'
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
      const matchesSearch =
        !term ||
        event.title.toLowerCase().includes(term) ||
        event.event_code.toLowerCase().includes(term) ||
        (event.created_by ?? '').toLowerCase().includes(term);
      const matchesFilter =
        filter === 'All' || getEventStatus(event, now) === filter;

      return matchesSearch && matchesFilter;
    });
  }, [events, search, filter]);

  return (
    <AdminScreenFrame
      access={access}
      title="Event Monitoring"
      subtitle="Review event records using fields available in the checked-in schema."
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
          Events are read-only here. Attendance counts are omitted because the
          checked-in RLS policies do not establish administrator-wide
          attendance access. Creator names also depend on profile access; the
          verified event field is the creator account ID.
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
              style={[styles.filterChip, active && styles.filterChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[styles.filterText, active && styles.filterTextActive]}
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
          <Text style={styles.stateTitle}>Events could not be loaded</Text>
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
            name="calendar-outline"
            size={28}
            color={COLORS.textSecondary}
          />
          <Text style={styles.stateTitle}>
            {events.length === 0 ? 'No events found' : 'No matching events'}
          </Text>
          <Text style={styles.stateText}>
            {events.length === 0
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
            const status = getEventStatus(event, Date.now());

            return (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventHeading}>
                  <View style={styles.eventIcon}>
                    <Ionicons
                      name="calendar-outline"
                      size={22}
                      color={COLORS.primary}
                    />
                  </View>
                  <View style={styles.eventTitleContainer}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventCode}>
                      Code: {event.event_code}
                    </Text>
                  </View>
                  <View style={styles.statusBadge}>
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
                  <Text style={styles.detailLabel}>Creator account ID</Text>
                  <Text style={styles.detailValue}>
                    {event.created_by ?? 'Not available'}
                  </Text>
                  <Text style={styles.detailLabel}>Created</Text>
                  <Text style={styles.detailValue}>
                    {formatDateTime(event.created_at)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
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
    maxWidth: 105,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
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
    marginTop: 5,
  },
  detailValue: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
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
