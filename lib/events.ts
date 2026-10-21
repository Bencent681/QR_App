import { supabase } from './supabase';

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
};

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  created_by: string | null;
  created_at: string;
};

export type AvailableEvent = Pick<
  CloudEvent,
  'id' | 'event_code' | 'title' | 'start_time' | 'end_time'
>;

export async function createEvent(
  event: Event
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

const { error } = await supabase.from('events').insert({
  event_code: event.eventId,
  title: event.title,
  start_time: event.start || null,
  end_time: event.end || null,
  created_by: user?.id ?? null,
});

  return {
    error: error?.message ?? null,
  };
}

export async function getEventsByTeacher(
  teacherId: string
): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time, created_by, created_at')
    .eq('created_by', teacherId)
    .order('created_at', {
      ascending: false,
    });

  if (error || !data) {
    return [];
  }

  return data as CloudEvent[];
}

export async function getAvailableEvents(): Promise<AvailableEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time')
    .order('start_time', { ascending: true, nullsFirst: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as AvailableEvent[];
}

export async function getEventByCode(
  code: string
): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time, created_by, created_at')
    .eq('event_code', code)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as CloudEvent;
}