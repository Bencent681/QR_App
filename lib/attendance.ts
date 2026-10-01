import { supabase } from './supabase';
import { parseQRPayload } from './qr';
import { getEventByCode } from './events';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  attendeeCount: number;
  attendees: {
    studentId: string;
    scannedAt: string;
  }[];
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

/* =========================================================
   STUDENT ATTENDANCE
   ========================================================= */

export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  // 1. Decode and validate QR code
  const parsed = parseQRPayload(rawPayload);

  if (!parsed.ok) {
    return {
      success: false,
      message: parsed.message,
    };
  }

  const payload = parsed.payload;

  // 2. Check event time
  const now = Date.now();

  const start = payload.start
    ? new Date(payload.start).getTime()
    : null;

  const end = payload.end
    ? new Date(payload.end).getTime()
    : null;

  if (start && now < start) {
    return {
      success: false,
      message: 'Event has not started yet.',
    };
  }

  if (end && now > end) {
    return {
      success: false,
      message: 'Event has already ended.',
    };
  }

  // 3. Find the event using the shared events helper
  const title = payload.title ?? payload.event;

  let event: {
    id: string;
    title: string;
  } | null = null;

  const foundEvent = await getEventByCode(payload.event);

  if (foundEvent) {
    event = {
      id: foundEvent.id,
      title: foundEvent.title,
    };
  } else {
    // 4. Fallback: create event if it does not exist
    const {
      data: newEvent,
      error: insertError,
    } = await supabase
      .from('events')
      .insert([
        {
          event_code: payload.event,
          title,
          start_time: payload.start ?? null,
          end_time: payload.end ?? null,
        },
      ])
      .select('id, title')
      .single();

    if (insertError || !newEvent) {
      console.log(
        'EVENT INSERT ERROR:',
        insertError
      );

      return {
        success: false,
        message: 'Could not create event.',
      };
    }

    event = newEvent;
  }

  // 5. Record attendance
  const { error: attendanceError } =
    await supabase
      .from('attendance')
      .insert([
        {
          student_id: studentId,
          event_id: event.id,
        },
      ]);

  // 6. Handle duplicate attendance
  if (attendanceError) {
    console.log(
      'ATTENDANCE ERROR:',
      attendanceError
    );

    if (attendanceError.code === '23505') {
      return {
        success: false,
        message:
          'Already registered for this event.',
        eventTitle: event.title,
      };
    }

    return {
      success: false,
      message: attendanceError.message,
      eventTitle: event.title,
    };
  }

  return {
    success: true,
    message: 'Attendance recorded!',
    eventTitle: event.title,
  };
}

/* =========================================================
   STUDENT ATTENDANCE HISTORY
   ========================================================= */

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  const {
    data,
    error,
  } = await supabase
    .from('attendance')
    .select(`
      id,
      scanned_at,
      events (
        event_code,
        title
      )
    `)
    .eq('student_id', studentId)
    .order('scanned_at', {
      ascending: false,
    });

  if (error || !data) {
    console.log(
      'HISTORY ERROR:',
      error
    );

    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    eventId:
      row.events?.event_code ?? '',
    eventTitle:
      row.events?.title ?? '',
    scannedAt: row.scanned_at,
  }));
}

/* =========================================================
   TEACHER ATTENDANCE
   ========================================================= */

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  const {
    data: events,
    error: eventError,
  } = await supabase
    .from('events')
    .select(
      'id, event_code, title, start_time, end_time, created_at'
    )
    .eq('created_by', teacherId)
    .order('created_at', {
      ascending: false,
    });

  if (eventError || !events) {
    console.log(
      'TEACHER EVENTS ERROR:',
      eventError
    );

    return [];
  }

  const eventIds = events.map(
    (event: any) => event.id
  );

  if (eventIds.length === 0) {
    return [];
  }

  const {
    data: attendance,
    error: attendanceError,
  } = await supabase
    .from('attendance')
    .select(
      'student_id, scanned_at, event_id'
    )
    .in('event_id', eventIds)
    .order('scanned_at', {
      ascending: false,
    });

  if (attendanceError || !attendance) {
    console.log(
      'TEACHER ATTENDANCE ERROR:',
      attendanceError
    );

    return events.map((event: any) => ({
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      startTime: event.start_time,
      endTime: event.end_time,
      attendeeCount: 0,
      attendees: [],
    }));
  }

  return events.map((event: any) => {
    const rows = attendance.filter(
      (row: any) =>
        row.event_id === event.id
    );

    return {
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      startTime: event.start_time,
      endTime: event.end_time,
      attendeeCount: rows.length,
      attendees: rows.map(
        (row: any) => ({
          studentId: row.student_id,
          scannedAt: row.scanned_at,
        })
      ),
    };
  });
}

/* =========================================================
   TEACHER EVENT SUMMARY
   ========================================================= */

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  // 1. Get only the teacher's event information
  const {
    data: events,
    error: eventError,
  } = await supabase
    .from('events')
    .select(
      'id, event_code, title, created_at'
    )
    .eq('created_by', teacherId)
    .order('created_at', {
      ascending: false,
    });

  if (eventError || !events) {
    console.log(
      'TEACHER SUMMARY EVENTS ERROR:',
      eventError
    );

    return [];
  }

  // 2. Get event IDs
  const eventIds = events.map(
    (event: any) => event.id
  );

  // No events means nothing to count
  if (eventIds.length === 0) {
    return [];
  }

  // 3. Lightweight attendance query
  // Only fetch event_id, not student_id or scanned_at
  const {
    data: attRows,
    error: attError,
  } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);

  if (attError || !attRows) {
    console.log(
      'TEACHER SUMMARY ATTENDANCE ERROR:',
      attError
    );

    return events.map((event: any) => ({
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,
      attendeeCount: 0,
    }));
  }

  // 4. Count attendance rows per event
  const counts: Record<string, number> = {};

  attRows.forEach((row: any) => {
    counts[row.event_id] =
      (counts[row.event_id] ?? 0) + 1;
  });

  // 5. Build the summary
  return events.map((event: any) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    attendeeCount:
      counts[event.id] ?? 0,
  }));
}