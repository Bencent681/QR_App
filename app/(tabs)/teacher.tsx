import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import QRCode from 'react-native-qrcode-svg';
import Ionicons from '@expo/vector-icons/Ionicons';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';
import {
  createEvent,
  getEventsByTeacher,
  type CloudEvent,
} from '@/lib/events';
import {
  getTeacherEventAttendance,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import { buildQRPayload } from '@/lib/qr';

function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

function formatDateDisplay(isoString: string) {
  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return isoString;
  }

  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEventDate(
  start: string | null,
  end: string | null
) {
  if (!start) {
    return 'No start time';
  }

  const startDate = new Date(start);

  if (Number.isNaN(startDate.getTime())) {
    return start;
  }

  const startText = startDate.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (!end) {
    return startText;
  }

  const endDate = new Date(end);

  if (Number.isNaN(endDate.getTime())) {
    return startText;
  }

  const endText = endDate.toLocaleString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${startText} – ${endText}`;
}

function getEventStatus(
  start: string | null,
  end: string | null
) {
  if (!start) {
    return null;
  }

  const startTime = new Date(start).getTime();

  if (Number.isNaN(startTime)) {
    return null;
  }

  const now = Date.now();

  if (now < startTime) {
    return 'Upcoming' as const;
  }

  if (!end) {
    return null;
  }

  const endTime = new Date(end).getTime();

  if (Number.isNaN(endTime)) {
    return null;
  }

  return now <= endTime ? 'Ongoing' as const : 'Completed' as const;
}

function formatScanTime(scannedAt: string) {
  const date = new Date(scannedAt);

  if (Number.isNaN(date.getTime())) {
    return scannedAt;
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TeacherScreen() {
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');

  const [start, setStart] = useState(
    toLocalISO(new Date())
  );

  const [end, setEnd] = useState(
    toLocalISO(
      new Date(Date.now() + 60 * 60 * 1000)
    )
  );

  const [payload, setPayload] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  const [events, setEvents] =
    useState<CloudEvent[]>([]);

  const [eventsLoading, setEventsLoading] =
    useState(false);

  /* Attendance */

  const [attendance, setAttendance] =
    useState<TeacherEventAttendance[]>([]);

  const [attendanceLoading, setAttendanceLoading] =
    useState(false);

  const [selectedAttendance, setSelectedAttendance] =
    useState<TeacherEventAttendance | null>(null);

  /*
   * Date/time picker state
   *
   * On Android we use the native picker directly.
   * On iOS we use the custom modal.
   */
  const [activePicker, setActivePicker] =
    useState<'start' | 'end' | null>(null);

  const [tempDate, setTempDate] =
    useState<Date>(new Date());

  const [androidPickerMode, setAndroidPickerMode] =
    useState<'date' | 'time'>('date');

  /*
   * Load teacher role, events, and attendance.
   */
  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (!user) {
        setRole(null);
        setRoleLoading(false);
        setEvents([]);
        setAttendance([]);

        return () => {
          active = false;
        };
      }

      setRoleLoading(true);
      setEventsLoading(true);
      setAttendanceLoading(true);

      Promise.all([
        getProfile(user.id),
        getEventsByTeacher(user.id),
        getTeacherEventAttendance(user.id),
      ]).then(
        ([profile, teacherEvents, teacherAttendance]) => {
          if (!active) {
            return;
          }

          setRole(profile?.role ?? 'student');
          setRoleLoading(false);

          setEvents(teacherEvents);
          setEventsLoading(false);

          setAttendance(teacherAttendance);
          setAttendanceLoading(false);
        }
      );

      return () => {
        active = false;
      };
    }, [user])
  );

  /*
   * Open date/time picker.
   */
  const openPicker = (
    target: 'start' | 'end'
  ) => {
    const rawValue =
      target === 'start' ? start : end;

    const parsedDate = new Date(rawValue);

    const validDate =
      Number.isNaN(parsedDate.getTime())
        ? new Date()
        : parsedDate;

    /*
     * Android:
     * Open the native date picker directly.
     */
    if (Platform.OS === 'android') {
      setTempDate(validDate);
      setActivePicker(target);
      setAndroidPickerMode('date');
      return;
    }

    /*
     * iOS:
     * Open our modal.
     */
    setTempDate(validDate);
    setActivePicker(target);
  };

  /*
   * Android native picker handler.
   *
   * First choose the date.
   * Then choose the time.
   */
  const handleAndroidPickerChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    /*
     * User pressed Cancel.
     */
    if (event.type === 'dismissed') {
      setActivePicker(null);
      setAndroidPickerMode('date');
      return;
    }

    if (!selectedDate) {
      return;
    }

    /*
     * Date selected.
     *
     * Keep the original time while changing
     * only the date.
     */
    if (androidPickerMode === 'date') {
      const currentValue =
        activePicker === 'start'
          ? new Date(start)
          : new Date(end);

      const newDate = new Date(
        selectedDate
      );

      newDate.setHours(
        currentValue.getHours()
      );

      newDate.setMinutes(
        currentValue.getMinutes()
      );

      newDate.setSeconds(0);
      newDate.setMilliseconds(0);

      setTempDate(newDate);

      /*
       * Now open the native time picker.
       */
      setAndroidPickerMode('time');

      return;
    }

    /*
     * Time selected.
     *
     * Keep the selected date and update
     * only the time.
     */
    const finalDate = new Date(tempDate);

    finalDate.setHours(
      selectedDate.getHours()
    );

    finalDate.setMinutes(
      selectedDate.getMinutes()
    );

    finalDate.setSeconds(0);
    finalDate.setMilliseconds(0);

    const formatted =
      toLocalISO(finalDate);

    if (activePicker === 'start') {
      setStart(formatted);
    }

    if (activePicker === 'end') {
      setEnd(formatted);
    }

    setTempDate(finalDate);
    setActivePicker(null);
    setAndroidPickerMode('date');
  };

  /*
   * iOS picker handler.
   */
  const handleIOSDateChange = (
    _event: DateTimePickerEvent,
    selectedDate?: Date
  ) => {
    if (selectedDate) {
      setTempDate(selectedDate);
    }
  };

  /*
   * Confirm iOS picker.
   */
  const confirmIOSPicker = () => {
    const formatted =
      toLocalISO(tempDate);

    if (activePicker === 'start') {
      setStart(formatted);
    }

    if (activePicker === 'end') {
      setEnd(formatted);
    }

    setActivePicker(null);
  };

  /*
   * Close picker.
   */
  const closePicker = () => {
    setActivePicker(null);
    setAndroidPickerMode('date');
  };

  /*
   * Create event.
   */
  const handleCreateEvent = async () => {
    setMessage(null);

    if (!user?.id) {
      setMessage('You must be signed in to create an event.');
      return;
    }

    const event = {
      eventId: eventId.trim(),
      title: title.trim(),
      start: start.trim(),
      end: end.trim(),
    };

    if (
      !event.eventId ||
      !event.title ||
      !event.start ||
      !event.end
    ) {
      setMessage('All fields are required.');
      return;
    }

    const startTime =
      new Date(event.start).getTime();

    const endTime =
      new Date(event.end).getTime();

    if (
      Number.isNaN(startTime) ||
      Number.isNaN(endTime)
    ) {
      setMessage('Invalid date format.');
      return;
    }

    if (startTime >= endTime) {
      setMessage(
        'Start time must be before end time.'
      );
      return;
    }

    const { error } =
      await createEvent(event);

    if (error) {
      console.log(
        'CREATE EVENT ERROR:',
        error
      );

      setMessage(
        'Failed to save event. Please try again.'
      );

      return;
    }

    setMessage(
      'Event saved! Scan the QR with the Scan tab to test it.'
    );

    setPayload(
      buildQRPayload(event)
    );

    /*
     * Refresh events and attendance.
     */
    if (user) {
      const updatedEvents =
        await getEventsByTeacher(
          user.id
        );

      setEvents(updatedEvents);

      const updatedAttendance =
        await getTeacherEventAttendance(
          user.id
        );

      setAttendance(
        updatedAttendance
      );
    }
  };

  /*
   * Show QR for existing event.
   */
  const handleShowQR = (
    event: CloudEvent
  ) => {
    const eventData = {
      eventId: event.event_code,
      title: event.title,
      start: event.start_time ?? '',
      end: event.end_time ?? '',
    };

    setPayload(
      buildQRPayload(eventData)
    );

    setMessage(
      `QR code loaded for "${event.title}".`
    );
  };

  /*
   * Open attendance for one event.
   */
  const handleViewAttendance = (
    event: CloudEvent
  ) => {
    const eventAttendance =
      attendance.find(
        (item) =>
          item.eventId === event.id
      );

    if (eventAttendance) {
      setSelectedAttendance(
        eventAttendance
      );
    } else {
      setSelectedAttendance({
        eventId: event.id,
        eventCode: event.event_code,
        title: event.title,
        startTime: event.start_time,
        endTime: event.end_time,
        attendeeCount: 0,
        attendees: [],
      });
    }
  };

  /*
   * Refresh attendance from Supabase.
   */
  const handleRefreshAttendance =
    async () => {
      if (!user) {
        return;
      }

      setAttendanceLoading(true);

      const updatedAttendance =
        await getTeacherEventAttendance(
          user.id
        );

      setAttendance(
        updatedAttendance
      );

      if (selectedAttendance) {
        const updatedSelected =
          updatedAttendance.find(
            (item) =>
              item.eventId ===
              selectedAttendance.eventId
          );

        if (updatedSelected) {
          setSelectedAttendance(
            updatedSelected
          );
        }
      }

      setAttendanceLoading(false);
    };

  const closeAttendance = () => {
    setSelectedAttendance(null);
  };

  /*
   * Loading state.
   */
  if (roleLoading) {
    return (
      <View
        style={styles.lockedContainer}
      >
        <View
          style={styles.lockIconCircle}
        >
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />
        </View>

        <Text
          style={styles.lockedTitle}
        >
          Checking your account...
        </Text>

        <Text
          style={styles.lockedSubtitle}
        >
          Please wait while we verify your account.
        </Text>
      </View>
    );
  }

  /*
   * Teacher-only protection.
   */
  if (role !== 'teacher') {
    return (
      <View
        style={styles.lockedContainer}
      >
        <View
          style={styles.lockIconCircle}
        >
          <Ionicons
            name="lock-closed-outline"
            size={30}
            color={COLORS.primary}
          />
        </View>

        <Text
          style={styles.lockedTitle}
        >
          Teachers Only
        </Text>

        <Text
          style={styles.lockedSubtitle}
        >
          Only teacher accounts can create events.
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}

        <View
          style={styles.pageHeader}
        >
          <View
            style={styles.headerIcon}
          >
            <Ionicons
              name="school-outline"
              size={24}
              color={COLORS.primary}
            />
          </View>

          <View
            style={
              styles.headerTextContainer
            }
          >
            <Text
              style={styles.title}
            >
              My Events
            </Text>

            <Text
              style={styles.subtitle}
            >
              Create activities, generate QR codes, and monitor attendance.
            </Text>
          </View>
        </View>

        {/* Event Details Card */}

        <View
          style={styles.sectionCard}
        >
          <View
            style={styles.sectionHeader}
          >
            <View
              style={styles.sectionIcon}
            >
              <Ionicons
                name="calendar-outline"
                size={19}
                color={COLORS.primary}
              />
            </View>

            <View>
              <Text
                style={styles.sectionTitle}
              >
                Event Details
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                Enter the information for your event.
              </Text>
            </View>
          </View>

          {/* Event Title */}

          <View
            style={styles.fieldContainer}
          >
            <Text
              style={styles.label}
            >
              Event Title
            </Text>

            <View
              style={styles.inputWrapper}
            >
              <Ionicons
                name="text-outline"
                size={18}
                color={
                  COLORS.textSecondary
                }
                style={styles.inputIcon}
              />

              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Founders Day Assembly"
                placeholderTextColor={
                  COLORS.textSecondary
                }
              />
            </View>
          </View>

          {/* Event Code */}

          <View
            style={styles.fieldContainer}
          >
            <Text
              style={styles.label}
            >
              Event Code
            </Text>

            <View
              style={styles.inputWrapper}
            >
              <Ionicons
                name="key-outline"
                size={18}
                color={
                  COLORS.textSecondary
                }
                style={styles.inputIcon}
              />

              <TextInput
                style={styles.input}
                value={eventId}
                onChangeText={setEventId}
                placeholder="e.g. EVT-2026-0002"
                placeholderTextColor={
                  COLORS.textSecondary
                }
                autoCapitalize="characters"
              />
            </View>

            <Text
              style={styles.helperText}
            >
              Use a unique code to identify this event.
            </Text>
          </View>

          {/* Start Time */}

          <View
            style={styles.fieldContainer}
          >
            <Text
              style={styles.label}
            >
              Start Time
            </Text>

            <Pressable
              style={styles.dateSelector}
              onPress={() =>
                openPicker('start')
              }
            >
              <View
                style={styles.dateLeft}
              >
                <View
                  style={styles.dateIcon}
                >
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={
                      COLORS.primary
                    }
                  />
                </View>

                <View
                  style={
                    styles.dateTextContainer
                  }
                >
                  <Text
                    style={styles.dateLabel}
                  >
                    Event starts
                  </Text>

                  <Text
                    style={styles.dateText}
                  >
                    {formatDateDisplay(
                      start
                    )}
                  </Text>
                </View>
              </View>

              <View
                style={styles.selectBadge}
              >
                <Text
                  style={styles.selectText}
                >
                  Select
                </Text>
              </View>
            </Pressable>
          </View>

          {/* End Time */}

          <View
            style={styles.fieldContainer}
          >
            <Text
              style={styles.label}
            >
              End Time
            </Text>

            <Pressable
              style={styles.dateSelector}
              onPress={() =>
                openPicker('end')
              }
            >
              <View
                style={styles.dateLeft}
              >
                <View
                  style={styles.dateIcon}
                >
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={
                      COLORS.primary
                    }
                  />
                </View>

                <View
                  style={
                    styles.dateTextContainer
                  }
                >
                  <Text
                    style={styles.dateLabel}
                  >
                    Event ends
                  </Text>

                  <Text
                    style={styles.dateText}
                  >
                    {formatDateDisplay(
                      end
                    )}
                  </Text>
                </View>
              </View>

              <View
                style={styles.selectBadge}
              >
                <Text
                  style={styles.selectText}
                >
                  Select
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Android Native Date Picker */}

        {Platform.OS === 'android' &&
          activePicker !== null && (
            <DateTimePicker
              value={tempDate}
              mode={androidPickerMode}
              display="default"
              onChange={
                handleAndroidPickerChange
              }
            />
          )}

        {/* iOS Date/Time Picker Modal */}

        {Platform.OS === 'ios' && (
          <Modal
            visible={
              activePicker !== null
            }
            transparent
            animationType="slide"
            onRequestClose={
              closePicker
            }
          >
            <View
              style={styles.modalOverlay}
            >
              <View
                style={styles.modalCard}
              >
                <View
                  style={styles.modalHeader}
                >
                  <Pressable
                    onPress={
                      closePicker
                    }
                    style={
                      styles.modalAction
                    }
                  >
                    <Text
                      style={
                        styles.cancelButton
                      }
                    >
                      Cancel
                    </Text>
                  </Pressable>

                  <Text
                    style={
                      styles.modalTitle
                    }
                  >
                    Select{' '}
                    {activePicker ===
                    'start'
                      ? 'Start'
                      : 'End'}{' '}
                    Time
                  </Text>

                  <Pressable
                    onPress={
                      confirmIOSPicker
                    }
                    style={
                      styles.modalAction
                    }
                  >
                    <Text
                      style={
                        styles.doneButton
                      }
                    >
                      Done
                    </Text>
                  </Pressable>
                </View>

                <DateTimePicker
                  value={tempDate}
                  mode="datetime"
                  display="spinner"
                  onChange={
                    handleIOSDateChange
                  }
                  textColor={
                    COLORS.textPrimary
                  }
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Status Message */}

        {message && (
          <View
            style={styles.messageCard}
          >
            <View
              style={styles.messageIcon}
            >
              <Ionicons
                name={
                  message.startsWith(
                    'Event saved'
                  ) ||
                  message.startsWith(
                    'QR code loaded'
                  )
                    ? 'checkmark-circle-outline'
                    : 'alert-circle-outline'
                }
                size={21}
                color={COLORS.primary}
              />
            </View>

            <Text
              style={styles.message}
            >
              {message}
            </Text>
          </View>
        )}

        {/* Create Button */}

        <View
          style={
            styles.createButtonContainer
          }
        >
          <AppButton
            theme="primary"
            title="Create Event"
            icon="add-circle-outline"
            onPress={
              handleCreateEvent
            }
          />
        </View>

        {/* QR Result */}

        {payload && (
          <View
            style={styles.qrSection}
          >
            <View
              style={
                styles.qrSectionHeader
              }
            >
              <View
                style={styles.qrHeaderIcon}
              >
                <Ionicons
                  name="qr-code-outline"
                  size={22}
                  color={
                    COLORS.primary
                  }
                />
              </View>

              <View
                style={
                  styles.qrHeaderText
                }
              >
                <Text
                  style={
                    styles.qrSectionTitle
                  }
                >
                  Event QR Code
                </Text>

                <Text
                  style={
                    styles.qrSectionSubtitle
                  }
                >
                  Students can scan this code to record attendance.
                </Text>
              </View>
            </View>

            <View
              style={styles.qrBox}
            >
              <QRCode
                value={payload}
                size={200}
              />
            </View>

            <View
              style={styles.scanHint}
            >
              <Ionicons
                name="scan-outline"
                size={17}
                color={
                  COLORS.primary
                }
              />

              <Text
                style={styles.scanHintText}
              >
                Open the Scan tab and point the camera at this QR code.
              </Text>
            </View>

            <View
              style={
                styles.payloadContainer
              }
            >
              <Text
                style={styles.payloadLabel}
              >
                QR Payload
              </Text>

              <Text
                style={styles.payloadText}
              >
                {payload}
              </Text>
            </View>
          </View>
        )}

        {/* My Events */}

        <View
          style={styles.eventsSection}
        >
          <View
            style={styles.eventsHeader}
          >
            <View
              style={styles.eventsTitleRow}
            >
              <View
                style={styles.eventsIcon}
              >
                <Ionicons
                  name="albums-outline"
                  size={21}
                  color={
                    COLORS.primary
                  }
                />
              </View>

              <View
                style={
                  styles.eventsHeaderText
                }
              >
                <Text
                  style={styles.eventsTitle}
                >
                  My Events
                </Text>

                <Text
                  style={
                    styles.eventsSubtitle
                  }
                >
                  Events you have created.
                </Text>
              </View>
            </View>

            <View
              style={
                styles.eventCountBadge
              }
            >
              <Text
                style={
                  styles.eventCountText
                }
              >
                {events.length}
              </Text>
            </View>
          </View>

          {eventsLoading ? (
            <View
              style={styles.eventsLoading}
            >
              <ActivityIndicator
                size="small"
                color={
                  COLORS.primary
                }
              />

              <Text
                style={
                  styles.eventsLoadingText
                }
              >
                Loading your events...
              </Text>
            </View>
          ) : events.length === 0 ? (
            <View
              style={styles.emptyEvents}
            >
              <View
                style={
                  styles.emptyEventsIcon
                }
              >
                <Ionicons
                  name="calendar-clear-outline"
                  size={28}
                  color={
                    COLORS.textSecondary
                  }
                />
              </View>

              <Text
                style={
                  styles.emptyEventsTitle
                }
              >
                No events yet
              </Text>

              <Text
                style={
                  styles.emptyEventsText
                }
              >
                Create your first attendance event above.
              </Text>
            </View>
          ) : (
            events.map((event) => {
              const eventStatus = getEventStatus(
                event.start_time,
                event.end_time
              );
              const eventAttendance =
                attendance.find(
                  (item) =>
                    item.eventId ===
                    event.id
                );

              const attendeeCount =
                eventAttendance?.attendeeCount ??
                0;

              return (
                <View
                  key={event.id}
                  style={
                    styles.eventCard
                  }
                >
                  <View
                    style={
                      styles.eventCardTop
                    }
                  >
                    <View
                      style={
                        styles.eventCalendarIcon
                      }
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color={
                          COLORS.primary
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.eventMainInfo
                      }
                    >
                      <Text
                        style={
                          styles.eventTitle
                        }
                        numberOfLines={2}
                      >
                        {event.title}
                      </Text>

                      <View
                        style={
                          styles.eventCodeRow
                        }
                      >
                        <Ionicons
                          name="key-outline"
                          size={12}
                          color={
                            COLORS.textSecondary
                          }
                        />

                        <Text
                          style={
                            styles.eventCode
                          }
                        >
                          {event.event_code}
                        </Text>
                      </View>

                      {eventStatus && (
                        <View
                          style={[
                            styles.eventStatusBadge,
                            eventStatus === 'Upcoming'
                              ? styles.eventStatusUpcoming
                              : eventStatus === 'Ongoing'
                                ? styles.eventStatusOngoing
                                : styles.eventStatusCompleted,
                          ]}
                        >
                          <Text
                            style={[
                              styles.eventStatusText,
                              eventStatus === 'Upcoming'
                                ? styles.eventStatusUpcomingText
                                : eventStatus === 'Ongoing'
                                  ? styles.eventStatusOngoingText
                                  : styles.eventStatusCompletedText,
                            ]}
                          >
                            {eventStatus}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View
                    style={
                      styles.eventDivider
                    }
                  />

                  <View
                    style={
                      styles.eventInfoRow
                    }
                  >
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color={
                        COLORS.textSecondary
                      }
                    />

                    <Text
                      style={
                        styles.eventDate
                      }
                    >
                      {formatEventDate(
                        event.start_time,
                        event.end_time
                      )}
                    </Text>
                  </View>

                  {/* Attendance Count */}

                  <View
                    style={
                      styles.attendanceSummary
                    }
                  >
                    <View
                      style={
                        styles.attendanceSummaryLeft
                      }
                    >
                      <View
                        style={
                          styles.attendanceIcon
                        }
                      >
                        <Ionicons
                          name="people-outline"
                          size={17}
                          color={
                            COLORS.primary
                          }
                        />
                      </View>

                      <View>
                        <Text
                          style={
                            styles.attendanceLabel
                          }
                        >
                          Attendance
                        </Text>

                        <Text
                          style={
                            styles.attendanceCount
                          }
                        >
                          {attendeeCount}{' '}
                          {attendeeCount ===
                          1
                            ? 'student'
                            : 'students'}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={
                        styles.attendanceBadge
                      }
                    >
                      <Text
                        style={
                          styles.attendanceBadgeText
                        }
                      >
                        {attendeeCount}
                      </Text>
                    </View>
                  </View>

                  {/* Event Actions */}

                  <View
                    style={
                      styles.eventActions
                    }
                  >
                    <Pressable
                      style={
                        styles.showQrButton
                      }
                      onPress={() =>
                        handleShowQR(
                          event
                        )
                      }
                    >
                      <Ionicons
                        name="qr-code-outline"
                        size={17}
                        color={
                          COLORS.primary
                        }
                      />

                      <Text
                        style={
                          styles.showQrText
                        }
                      >
                        Show QR
                      </Text>
                    </Pressable>

                    <Pressable
                      style={
                        styles.viewAttendanceButton
                      }
                      onPress={() =>
                        handleViewAttendance(
                          event
                        )
                      }
                    >
                      <Ionicons
                        name="people-outline"
                        size={17}
                        color={
                          COLORS.textOnPrimary
                        }
                      />

                      <Text
                        style={
                          styles.viewAttendanceText
                        }
                      >
                        View Attendance
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Attendance Modal */}

      <Modal
        visible={
          selectedAttendance !== null
        }
        transparent
        animationType="slide"
        onRequestClose={
          closeAttendance
        }
      >
        <View
          style={
            styles.attendanceModalOverlay
          }
        >
          <View
            style={
              styles.attendanceModalCard
            }
          >
            {/* Modal Header */}

            <View
              style={
                styles.attendanceModalHeader
              }
            >
              <View
                style={
                  styles.attendanceModalTitleRow
                }
              >
                <View
                  style={
                    styles.attendanceModalIcon
                  }
                >
                  <Ionicons
                    name="people-outline"
                    size={22}
                    color={
                      COLORS.primary
                    }
                  />
                </View>

                <View
                  style={
                    styles.attendanceModalTitleContainer
                  }
                >
                  <Text
                    style={
                      styles.attendanceModalTitle
                    }
                    numberOfLines={2}
                  >
                    Attendance
                  </Text>

                  <Text
                    style={
                      styles.attendanceModalSubtitle
                    }
                    numberOfLines={2}
                  >
                    {selectedAttendance?.title}
                  </Text>
                </View>
              </View>

              <Pressable
                style={
                  styles.closeAttendanceButton
                }
                onPress={
                  closeAttendance
                }
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={
                    COLORS.textSecondary
                  }
                />
              </Pressable>
            </View>

            {/* Attendance Summary */}

            <View
              style={
                styles.attendanceTotalCard
              }
            >
              <View
                style={
                  styles.attendanceTotalIcon
                }
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={25}
                  color={
                    COLORS.primary
                  }
                />
              </View>

              <View
                style={
                  styles.attendanceTotalText
                }
              >
                <Text
                  style={
                    styles.attendanceTotalNumber
                  }
                >
                  {
                    selectedAttendance?.attendeeCount ??
                    0
                  }
                </Text>

                <Text
                  style={
                    styles.attendanceTotalLabel
                  }
                >
                  Total Attendees
                </Text>
              </View>

              <View
                style={
                  styles.attendanceEventCode
                }
              >
                <Text
                  style={
                    styles.attendanceEventCodeLabel
                  }
                >
                  EVENT CODE
                </Text>

                <Text
                  style={
                    styles.attendanceEventCodeText
                  }
                >
                  {
                    selectedAttendance?.eventCode
                  }
                </Text>
              </View>
            </View>

            {/* Attendee List */}

            <ScrollView
              style={
                styles.attendeeList
              }
              contentContainerStyle={
                styles.attendeeListContent
              }
              showsVerticalScrollIndicator={
                false
              }
            >
              {attendanceLoading ? (
                <View
                  style={
                    styles.attendanceLoading
                  }
                >
                  <ActivityIndicator
                    size="large"
                    color={
                      COLORS.primary
                    }
                  />

                  <Text
                    style={
                      styles.attendanceLoadingText
                    }
                  >
                    Loading attendance...
                  </Text>
                </View>
              ) : selectedAttendance
                  ?.attendees.length ===
                0 ? (
                <View
                  style={
                    styles.noAttendance
                  }
                >
                  <View
                    style={
                      styles.noAttendanceIcon
                    }
                  >
                    <Ionicons
                      name="people-outline"
                      size={30}
                      color={
                        COLORS.textSecondary
                      }
                    />
                  </View>

                  <Text
                    style={
                      styles.noAttendanceTitle
                    }
                  >
                    No attendance yet
                  </Text>

                  <Text
                    style={
                      styles.noAttendanceText
                    }
                  >
                    Students who scan this event's QR code will appear here.
                  </Text>
                </View>
              ) : (
                selectedAttendance?.attendees.map(
                  (
                    attendee,
                    index
                  ) => (
                    <View
                      key={`${attendee.studentId}-${attendee.scannedAt}-${index}`}
                      style={
                        styles.attendeeCard
                      }
                    >
                      <View
                        style={
                          styles.attendeeNumber
                        }
                      >
                        <Text
                          style={
                            styles.attendeeNumberText
                          }
                        >
                          {index + 1}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.attendeeIcon
                        }
                      >
                        <Ionicons
                          name="person-outline"
                          size={19}
                          color={
                            COLORS.primary
                          }
                        />
                      </View>

                      <View
                        style={
                          styles.attendeeInfo
                        }
                      >
                        <Text
                          style={
                            styles.attendeeName
                          }
                          numberOfLines={1}
                        >
                          {
                            attendee.studentName
                          }
                        </Text>

                        <Text
                          style={
                            styles.studentId
                          }
                          numberOfLines={1}
                        >
                          Student ID:{' '}
                          {
                            attendee.studentId
                          }
                        </Text>

                        <View
                          style={
                            styles.scannedRow
                          }
                        >
                          <Ionicons
                            name="time-outline"
                            size={13}
                            color={
                              COLORS.textSecondary
                            }
                          />

                          <Text
                            style={
                              styles.scannedTime
                            }
                          >
                            Scanned{' '}
                            {formatScanTime(
                              attendee.scannedAt
                            )}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={
                          styles.presentBadge
                        }
                      >
                        <Ionicons
                          name="checkmark"
                          size={13}
                          color={
                            COLORS.success
                          }
                        />

                        <Text
                          style={
                            styles.presentText
                          }
                        >
                          Present
                        </Text>
                      </View>
                    </View>
                  )
                )
              )}
            </ScrollView>

            {/* Modal Actions */}

            <View
              style={
                styles.attendanceModalActions
              }
            >
              <Pressable
                style={
                  styles.refreshAttendanceButton
                }
                onPress={
                  handleRefreshAttendance
                }
                disabled={
                  attendanceLoading
                }
              >
                <Ionicons
                  name="refresh-outline"
                  size={18}
                  color={
                    COLORS.primary
                  }
                />

                <Text
                  style={
                    styles.refreshAttendanceText
                  }
                >
                  Refresh Attendance
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.closeAttendanceAction
                }
                onPress={
                  closeAttendance
                }
              >
                <Text
                  style={
                    styles.closeAttendanceText
                  }
                >
                  Close
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 40,
  },

  /* Header */

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor:
      'rgba(255, 211, 61, 0.12)',
    borderWidth: 1,
    borderColor:
      'rgba(255, 211, 61, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  headerTextContainer: {
    flex: 1,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },

  /* Event Details */

  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 16,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor:
      'rgba(255, 211, 61, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  /* Fields */

  fieldContainer: {
    marginBottom: 15,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 7,
  },

  inputWrapper: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171A1D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 13,
  },

  inputIcon: {
    marginRight: 9,
  },

  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: 12,
  },

  helperText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 6,
  },

  /* Date selectors */

  dateSelector: {
    minHeight: 65,
    backgroundColor: '#171A1D',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  dateLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  dateIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor:
      'rgba(255, 211, 61, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  dateTextContainer: {
    flex: 1,
  },

  dateLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },

  dateText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },

  selectBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor:
      'rgba(255, 211, 61, 0.10)',
  },

  selectText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },

  /* iOS Picker Modal */

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor:
      'rgba(0, 0, 0, 0.60)',
  },

  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
    paddingHorizontal: 16,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 17,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  modalAction: {
    minWidth: 60,
  },

  modalTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  cancelButton: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  doneButton: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'right',
  },

  /* Message */

  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:
      'rgba(255, 211, 61, 0.08)',
    borderWidth: 1,
    borderColor:
      'rgba(255, 211, 61, 0.20)',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 14,
  },

  messageIcon: {
    marginRight: 9,
  },

  message: {
    flex: 1,
    fontSize: 13,
    color: COLORS.primary,
    lineHeight: 18,
  },

  /* Create Button */

  createButtonContainer: {
    marginBottom: 4,
  },

  /* QR Section */

  qrSection: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginTop: 16,
    alignItems: 'center',
  },

  qrSectionHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  qrHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor:
      'rgba(255, 211, 61, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  qrHeaderText: {
    flex: 1,
  },

  qrSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },

  qrSectionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },

  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 18,
    marginBottom: 15,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.20,
    shadowRadius: 6,
    elevation: 5,
  },

  scanHint: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      'rgba(255, 211, 61, 0.07)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },

  scanHintText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginLeft: 8,
  },

  payloadContainer: {
    width: '100%',
    backgroundColor: '#171A1D',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },

  payloadLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  payloadText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },

  /* My Events */

  eventsSection: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginTop: 16,
  },

  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  eventsTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  eventsIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor:
      'rgba(255, 211, 61, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  eventsHeaderText: {
    flex: 1,
  },

  eventsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },

  eventsSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  eventCountBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor:
      'rgba(255, 211, 61, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  eventCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },

  eventsLoading: {
    minHeight: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eventsLoadingText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  emptyEvents: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 15,
  },

  emptyEventsIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#171A1D',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  emptyEventsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },

  emptyEventsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  eventCard: {
    backgroundColor: '#171A1D',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },

  eventCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  eventCalendarIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor:
      'rgba(255, 211, 61, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  eventMainInfo: {
    flex: 1,
  },

  eventStatusBadge: {
    flexShrink: 0,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginLeft: 8,
  },

  eventStatusUpcoming: {
    backgroundColor: COLORS.warningLight,
  },

  eventStatusOngoing: {
    backgroundColor: COLORS.successLight,
  },

  eventStatusCompleted: {
    backgroundColor: COLORS.surface,
  },

  eventStatusText: {
    fontSize: 9,
    fontWeight: '700',
  },

  eventStatusUpcomingText: {
    color: COLORS.warning,
  },

  eventStatusOngoingText: {
    color: COLORS.success,
  },

  eventStatusCompletedText: {
    color: COLORS.textSecondary,
  },

  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 19,
    marginBottom: 5,
  },

  eventCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  eventCode: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginLeft: 5,
    fontWeight: '600',
  },

  eventDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },

  eventInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  eventDate: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textSecondary,
    marginLeft: 7,
    lineHeight: 16,
  },

  /* Attendance Summary */

  attendanceSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor:
      'rgba(255, 211, 61, 0.06)',
    borderWidth: 1,
    borderColor:
      'rgba(255, 211, 61, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 11,
  },

  attendanceSummaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  attendanceIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor:
      'rgba(255, 211, 61, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  attendanceLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },

  attendanceCount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  attendanceBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor:
      'rgba(255, 211, 61, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  attendanceBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  /* Event Actions */

  eventActions: {
    flexDirection: 'row',
    gap: 8,
  },

  showQrButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor:
      'rgba(255, 211, 61, 0.10)',
    borderWidth: 1,
    borderColor:
      'rgba(255, 211, 61, 0.20)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },

  showQrText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 6,
  },

  viewAttendanceButton: {
    flex: 1.35,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },

  viewAttendanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textOnPrimary,
    marginLeft: 6,
  },

  /* Attendance Modal */

  attendanceModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor:
      'rgba(0, 0, 0, 0.65)',
  },

  attendanceModalCard: {
    maxHeight: '88%',
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },

  attendanceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  attendanceModalTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  attendanceModalIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor:
      'rgba(255, 211, 61, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  attendanceModalTitleContainer: {
    flex: 1,
  },

  attendanceModalTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },

  attendanceModalSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  closeAttendanceButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#171A1D',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  /* Attendance Total */

  attendanceTotalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor:
      'rgba(255, 211, 61, 0.07)',
    borderWidth: 1,
    borderColor:
      'rgba(255, 211, 61, 0.16)',
    borderRadius: 16,
    padding: 13,
    marginBottom: 13,
  },

  attendanceTotalIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor:
      'rgba(255, 211, 61, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  attendanceTotalText: {
    flex: 1,
  },

  attendanceTotalNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  attendanceTotalLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 1,
  },

  attendanceEventCode: {
    alignItems: 'flex-end',
    maxWidth: 105,
  },

  attendanceEventCodeLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 3,
  },

  attendanceEventCodeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'right',
  },

  /* Attendee List */

  attendeeList: {
    maxHeight: 360,
  },

  attendeeListContent: {
    paddingBottom: 4,
  },

  attendanceLoading: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },

  attendanceLoadingText: {
    marginTop: 10,
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  noAttendance: {
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 25,
  },

  noAttendanceIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#171A1D',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 13,
  },

  noAttendanceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },

  noAttendanceText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },

  attendeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171A1D',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },

  attendeeNumber: {
    width: 25,
    height: 25,
    borderRadius: 8,
    backgroundColor:
      'rgba(255, 211, 61, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },

  attendeeNumberText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },

  attendeeIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor:
      'rgba(255, 211, 61, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  attendeeInfo: {
    flex: 1,
    minWidth: 0,
  },

  attendeeName: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 3,
  },

  studentId: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },

  scannedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  scannedTime: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },

  presentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 5,
    marginLeft: 5,
  },

  presentText: {
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.success,
    marginLeft: 3,
  },

  /* Attendance Modal Actions */

  attendanceModalActions: {
    marginTop: 12,
    gap: 8,
  },

  refreshAttendanceButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor:
      'rgba(255, 211, 61, 0.10)',
    borderWidth: 1,
    borderColor:
      'rgba(255, 211, 61, 0.20)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  refreshAttendanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    marginLeft: 7,
  },

  closeAttendanceAction: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: '#171A1D',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeAttendanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },

  /* Locked states */

  lockedContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  lockIconCircle: {
    width: 78,
    height: 78,
    borderRadius: 26,
    backgroundColor:
      'rgba(255, 211, 61, 0.10)',
    borderWidth: 1,
    borderColor:
      'rgba(255, 211, 61, 0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  lockedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 7,
    textAlign: 'center',
  },

  lockedSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
});