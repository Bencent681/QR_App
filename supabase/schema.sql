-- ============================================================
-- QR ATTENDANCE APP
-- Phase 3 - Supabase Database Schema
-- ============================================================

-- ============================================================
-- 1. PROFILES
-- Stores additional information about Supabase users.
-- Each profile belongs to exactly one auth.users account.
-- ============================================================

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  avatar_path text,
  role       text not null default 'student'
             check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists avatar_path text;


-- ============================================================
-- 2. EVENTS
-- Stores attendance events represented by QR codes.
-- ============================================================

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  event_code  text not null unique,
  title       text not null,
  start_time  timestamptz,
  end_time    timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);


-- ============================================================
-- 3. ATTENDANCE
-- Stores student attendance records.
-- One student can only register once for the same event.
-- ============================================================

create table if not exists public.attendance (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references auth.users (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade,
  scanned_at  timestamptz not null default now(),

  -- Prevent duplicate attendance for the same student/event
  unique (student_id, event_id)
);


-- ============================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.attendance enable row level security;


-- ============================================================
-- 5. PROFILES POLICIES
-- ============================================================

drop policy if exists "Profiles are viewable by owner"
on public.profiles;

create policy "Profiles are viewable by owner"
on public.profiles
for select
using (auth.uid() = id);


drop policy if exists "Users can insert their own profile"
on public.profiles;

create policy "Users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = id);


drop policy if exists "Users can update their own profile"
on public.profiles;

create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);


-- ============================================================
-- 5A. PRIVATE PROFILE PHOTO STORAGE
-- Each object is stored under the owning auth user's UUID.
-- ============================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-photos',
  'profile-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can view their own profile photos"
on storage.objects;

create policy "Users can view their own profile photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload their own profile photos"
on storage.objects;

create policy "Users can upload their own profile photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can replace their own profile photos"
on storage.objects;

create policy "Users can replace their own profile photos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their own profile photos"
on storage.objects;

create policy "Users can delete their own profile photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- ============================================================
-- 6. EVENTS POLICIES
-- ============================================================

drop policy if exists "Events are readable by authenticated users"
on public.events;

create policy "Events are readable by authenticated users"
on public.events
for select
to authenticated
using (true);


drop policy if exists "Authenticated users can create events"
on public.events;

create policy "Authenticated users can create events"
on public.events
for insert
to authenticated
with check (auth.uid() = created_by);


drop policy if exists "Users can update their own events"
on public.events;

create policy "Users can update their own events"
on public.events
for update
to authenticated
using (auth.uid() = created_by)
with check (auth.uid() = created_by);


-- ============================================================
-- 7. ATTENDANCE POLICIES
-- ============================================================

drop policy if exists "Students can view their own attendance"
on public.attendance;

create policy "Students can view their own attendance"
on public.attendance
for select
to authenticated
using (auth.uid() = student_id);


drop policy if exists "Students can insert their own attendance"
on public.attendance;

create policy "Students can insert their own attendance"
on public.attendance
for insert
to authenticated
with check (auth.uid() = student_id);


-- ============================================================
-- 8. TEACHERS CAN VIEW ATTENDANCE FOR THEIR EVENTS
-- ============================================================

drop policy if exists "Teachers can view attendance for their events"
on public.attendance;

create policy "Teachers can view attendance for their events"
on public.attendance
for select
to authenticated
using (
  exists (
    select 1
    from public.events
    where public.events.id = attendance.event_id
      and public.events.created_by = auth.uid()
  )
);


-- ============================================================
-- 9. AUTOMATIC PROFILE CREATION
-- When a user signs up, automatically create a profile.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);

  return new;
end;
$$;


-- ============================================================
-- 10. USER SIGNUP TRIGGER
-- ============================================================

drop trigger if exists on_auth_user_created
on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();


-- ============================================================
-- 11. UPDATED_AT FUNCTION
-- Automatically updates profiles.updated_at when changed.
-- ============================================================

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- 12. UPDATED_AT TRIGGER
-- ============================================================

drop trigger if exists update_profiles_updated_at
on public.profiles;

create trigger update_profiles_updated_at
before update on public.profiles
for each row
execute procedure public.update_updated_at_column();


-- ============================================================
-- PHASE 3 COMPLETE
-- Tables:
--   profiles
--   events
--   attendance
--
-- Security:
--   Row Level Security enabled
--
-- Automation:
--   New auth users automatically receive a profile
-- ============================================================