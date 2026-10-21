import { supabase } from './supabase';
import { parseQRPayload } from './qr';
import { getEventByCode, type CloudEvent } from './events';

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

export type TeacherAttendee = {
  studentId: string;
  studentName: string;
  scannedAt: string;
};

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  attendeeCount: number;
  attendees: TeacherAttendee[];
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  attendeeCount: number;
};

export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  const result = parseQRPayload(rawPayload);

  // Check if the QR code is valid
  if (!result.ok) {
    return {
      success: false,
      message: result.message,
    };
  }

  // Get the actual QR payload
  const payload = result.payload;

  const now = new Date();

  // Check event start time
  if (payload.start) {
    const start = new Date(payload.start);

    if (now < start) {
      return {
        success: false,
        message: 'This event has not started yet.',
      };
    }
  }

  // Check event end time
  if (payload.end) {
    const end = new Date(payload.end);

    if (now > end) {
      return {
        success: false,
        message: 'This event has already ended.',
      };
    }
  }

  /*
   * Your QRPayload uses:
   *
   * event: string
   *
   * so we use payload.event as the event code.
   */
  let event = await getEventByCode(payload.event);

  // Students can only scan events that already exist in Supabase.
  if (!event) {
    return {
      success: false,
      message:
        'Event not found. Please ask your teacher to create or verify this event.',
    };
  }

  /*
   * TypeScript still considers event nullable.
   * Explicitly check it before using it.
   */
  if (!event) {
    return {
      success: false,
      message: 'Event could not be found.',
    };
  }

  // Check if this student already scanned this event
  const {
    data: existingAttendance,
    error: existingError,
  } = await supabase
    .from('attendance')
    .select('id')
    .eq('student_id', studentId)
    .eq('event_id', event.id)
    .maybeSingle();

  if (existingError) {
    console.log(
      'CHECK ATTENDANCE ERROR:',
      existingError
    );

    return {
      success: false,
      message: 'Unable to check attendance.',
    };
  }

  if (existingAttendance) {
    return {
      success: false,
      message:
        'You have already registered attendance for this event.',
      eventTitle: event.title,
    };
  }

  // Register attendance
  const { error: insertError } = await supabase
    .from('attendance')
    .insert({
      student_id: studentId,
      event_id: event.id,
      scanned_at: now.toISOString(),
    });

  if (insertError) {
    console.log(
      'REGISTER ATTENDANCE ERROR:',
      insertError
    );

    return {
      success: false,
      message: insertError.message,
      eventTitle: event.title,
    };
  }

  return {
    success: true,
    message: 'Attendance registered successfully.',
    eventTitle: event.title,
  };
}

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select(
      `
        id,
        scanned_at,
        event_id,
        events (
          event_code,
          title
        )
      `
    )
    .eq('student_id', studentId)
    .order('scanned_at', {
      ascending: false,
    });

  if (error || !data) {
    console.log(
      'GET ATTENDANCE HISTORY ERROR:',
      error
    );

    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    eventId:
      row.events?.event_code ??
      row.event_id,
    eventTitle:
      row.events?.title ??
      'Unknown Event',
    scannedAt: row.scanned_at,
  }));
}

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

  // Get unique student IDs
  const studentIds = [
    ...new Set(
      attendance.map(
        (row: any) => row.student_id
      )
    ),
  ];

  let profiles: any[] = [];

  // Get student names
  if (studentIds.length > 0) {
    const {
      data: profileData,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', studentIds);

    if (profileError) {
      console.log(
        'TEACHER PROFILE ERROR:',
        profileError
      );
    } else if (profileData) {
      profiles = profileData;
    }
  }

  // Create student ID → name lookup
  const studentNames: Record<string, string> = {};

  profiles.forEach((profile: any) => {
    studentNames[profile.id] =
      profile.full_name ??
      'Unknown Student';
  });

  // Build attendance information for every event
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
          studentName:
            studentNames[row.student_id] ??
            'Unknown Student',
          scannedAt: row.scanned_at,
        })
      ),
    };
  });
}

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const attendance =
    await getTeacherEventAttendance(teacherId);

  return attendance.map((event) => ({
    eventId: event.eventId,
    eventCode: event.eventCode,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    attendeeCount: event.attendeeCount,
  }));
}

export async function getTeacherDashboardData(
  teacherId: string
): Promise<{
  events: CloudEvent[] | null;
  attendanceCount: number | null;
}> {
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time, created_by, created_at')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError || !events) {
    console.log('TEACHER DASHBOARD EVENTS ERROR:', eventError);
    return { events: null, attendanceCount: null };
  }

  const teacherEvents = events as CloudEvent[];

  if (teacherEvents.length === 0) {
    return { events: teacherEvents, attendanceCount: 0 };
  }

  const { count, error: attendanceError } = await supabase
    .from('attendance')
    .select('id', { count: 'exact', head: true })
    .in(
      'event_id',
      teacherEvents.map((event) => event.id)
    );

  if (attendanceError) {
    console.log(
      'TEACHER DASHBOARD ATTENDANCE ERROR:',
      attendanceError
    );
  }

  return {
    events: teacherEvents,
    attendanceCount: attendanceError ? null : count ?? 0,
  };
}