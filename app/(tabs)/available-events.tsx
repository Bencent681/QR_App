import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { getAvailableEvents, type AvailableEvent } from '@/lib/events';

type EventStatus = 'Upcoming' | 'Ongoing' | 'Completed' | 'Unavailable';

function getEventStatus(event: AvailableEvent, now: number): EventStatus {
  if (!event.start_time || !event.end_time) {
    return 'Unavailable';
  }

  const start = new Date(event.start_time).getTime();
  const end = new Date(event.end_time).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 'Unavailable';
  }

  if (now < start) return 'Upcoming';
  if (now > end) return 'Completed';
  return 'Ongoing';
}

function formatEventTime(value: string | null) {
  if (!value) return 'Not set';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getStatusColor(status: EventStatus) {
  if (status === 'Ongoing') return COLORS.success;
  if (status === 'Upcoming') return COLORS.warning;
  if (status === 'Completed') return COLORS.textSecondary;
  return COLORS.danger;
}

export default function AvailableEventsScreen() {
  const [events, setEvents] = useState<AvailableEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AvailableEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());

  const loadEvents = useCallback(async (pullToRefresh = false) => {
    if (pullToRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(false);

    try {
      setEvents(await getAvailableEvents());
    } catch (loadError) {
      console.log('AVAILABLE EVENTS LOAD ERROR:', loadError);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEvents();
    }, [loadEvents])
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const openScanner = () => {
    setSelectedEvent(null);
    router.push('/(tabs)/scan');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadEvents(true)}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.heading}>
          <View style={styles.headingText}>
            <Text style={styles.title}>Available Events</Text>
            <Text style={styles.subtitle}>School events and attendance times</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh events"
            onPress={() => void loadEvents(true)}
            style={styles.refreshButton}
          >
            <Ionicons name="refresh-outline" size={21} color={COLORS.primary} />
          </Pressable>
        </View>

        {loading && events.length === 0 ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.stateText}>Loading events...</Text>
          </View>
        ) : error && events.length === 0 ? (
          <View style={styles.stateContainer}>
            <Ionicons name="cloud-offline-outline" size={28} color={COLORS.danger} />
            <Text style={styles.stateText}>Events could not be loaded.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadEvents()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : events.length === 0 ? (
          <View style={styles.stateContainer}>
            <Ionicons name="calendar-clear-outline" size={28} color={COLORS.textSecondary} />
            <Text style={styles.stateText}>No events are available.</Text>
          </View>
        ) : (
          <View style={styles.eventList}>
            {error ? (
              <Text style={styles.inlineError}>Refresh failed. Pull down to retry.</Text>
            ) : null}
            {events.map((event) => {
              const status = getEventStatus(event, now);
              const statusColor = getStatusColor(status);

              return (
                <View key={event.id} style={styles.eventCard}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View details for ${event.title}`}
                    onPress={() => setSelectedEvent(event)}
                  >
                    <View style={styles.eventHeading}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <View style={[styles.statusBadge, { borderColor: statusColor }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {status}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.eventCode}>Code: {event.event_code}</Text>
                    <View style={styles.timeRow}>
                      <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
                      <Text style={styles.timeText}>Starts {formatEventTime(event.start_time)}</Text>
                    </View>
                    <View style={styles.timeRow}>
                      <Ionicons name="time-outline" size={16} color={COLORS.textSecondary} />
                      <Text style={styles.timeText}>Ends {formatEventTime(event.end_time)}</Text>
                    </View>
                    <Text style={styles.detailsLink}>View details</Text>
                  </Pressable>

                  {status === 'Ongoing' ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={openScanner}
                      style={styles.scanButton}
                    >
                      <Ionicons name="qr-code-outline" size={19} color={COLORS.textOnPrimary} />
                      <Text style={styles.scanButtonText}>Scan QR Code</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={selectedEvent !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeading}>
              <Text style={styles.modalTitle}>{selectedEvent?.title}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close event details"
                onPress={() => setSelectedEvent(null)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={22} color={COLORS.textSecondary} />
              </Pressable>
            </View>
            {selectedEvent ? (
              <>
                <Text style={styles.modalLabel}>EVENT CODE</Text>
                <Text style={styles.modalValue}>{selectedEvent.event_code}</Text>
                <Text style={styles.modalLabel}>STATUS</Text>
                <Text style={[styles.modalValue, { color: getStatusColor(getEventStatus(selectedEvent, now)) }]}>
                  {getEventStatus(selectedEvent, now)}
                </Text>
                <Text style={styles.modalLabel}>STARTS</Text>
                <Text style={styles.modalValue}>{formatEventTime(selectedEvent.start_time)}</Text>
                <Text style={styles.modalLabel}>ENDS</Text>
                <Text style={styles.modalValue}>{formatEventTime(selectedEvent.end_time)}</Text>
                {getEventStatus(selectedEvent, now) === 'Ongoing' ? (
                  <Pressable onPress={openScanner} style={styles.scanButton}>
                    <Ionicons name="qr-code-outline" size={19} color={COLORS.textOnPrimary} />
                    <Text style={styles.scanButtonText}>Scan QR Code</Text>
                  </Pressable>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 32,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headingText: {
    flex: 1,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 5,
  },
  refreshButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.card,
  },
  stateContainer: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stateText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  retryText: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
  },
  inlineError: {
    color: COLORS.danger,
    marginBottom: 12,
  },
  eventList: {
    gap: 12,
  },
  eventCard: {
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card,
  },
  eventHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  eventTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  eventCode: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 8,
    marginBottom: 10,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  timeText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  detailsLink: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  scanButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  scanButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 14,
    backgroundColor: COLORS.card,
  },
  modalHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  modalLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 12,
  },
  modalValue: {
    color: COLORS.textPrimary,
    fontSize: 15,
    marginTop: 4,
  },
});