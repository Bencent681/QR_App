
BEGIN;

-- Confirm that the existing objects we depend on are present.
DO $preflight$
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.events') IS NULL
     OR to_regclass('public.attendance') IS NULL
     OR to_regclass('public.attendance_audit_log') IS NULL THEN
    RAISE EXCEPTION
      'Expected existing QR Attendance tables are missing. No changes should be applied.';
  END IF;

  IF to_regprocedure(
    'public.admin_correct_attendance(uuid,timestamp with time zone,text)'
  ) IS NULL
     OR to_regprocedure(
    'public.admin_delete_attendance(uuid,text)'
  ) IS NULL THEN
    RAISE EXCEPTION
      'Existing attendance audit RPCs are missing. Stop and review the live database.';
  END IF;

  IF to_regprocedure('public.current_app_role()') IS NULL THEN
    RAISE EXCEPTION
      'public.current_app_role() is missing.';
  END IF;
END;
$preflight$;

-- Remove broad table-level client permissions.
-- service_role is deliberately not included.
REVOKE ALL PRIVILEGES ON TABLE public.profiles
  FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.events
  FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.attendance
  FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.attendance_audit_log
  FROM PUBLIC, anon, authenticated;

-- Remove separately granted column-level permissions too.
REVOKE ALL PRIVILEGES (
  id, email, full_name, role, created_at, updated_at,
  student_id, short_id, avatar_path
) ON TABLE public.profiles
  FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES (
  id, event_code, title, start_time, end_time, created_by, created_at
) ON TABLE public.events
  FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES (
  id, student_id, event_id, scanned_at
) ON TABLE public.attendance
  FROM PUBLIC, anon, authenticated;

-- Profiles: clients may read the fields used by the app
-- and update profile details, but cannot write the role.
GRANT SELECT (id, email, full_name, role, student_id, short_id, avatar_path)
ON TABLE public.profiles
TO authenticated;

GRANT UPDATE (full_name, avatar_path)
  ON TABLE public.profiles TO authenticated;

-- Events: authenticated users can read events.
-- Creating events requires the normal INSERT RLS policies.
GRANT SELECT (
  id, event_code, title, start_time, end_time, created_by, created_at
) ON TABLE public.events TO authenticated;

GRANT INSERT (
  event_code, title, start_time, end_time, created_by
) ON TABLE public.events TO authenticated;

GRANT UPDATE (
  event_code, title, start_time, end_time
) ON TABLE public.events TO authenticated;

-- Attendance: allow the app's normal check-in and history operations.
-- Admin corrections/deletions remain handled by the existing RPCs.
GRANT SELECT (id, student_id, event_id, scanned_at)
  ON TABLE public.attendance TO authenticated;

GRANT INSERT (student_id, event_id, scanned_at)
  ON TABLE public.attendance TO authenticated;

-- Preserve read-only access to the existing audit log.
GRANT SELECT ON TABLE public.attendance_audit_log
  TO authenticated;

-- Keep the existing permissive event-insert policy, but add a
-- restrictive policy so only teachers/admins can create events
-- for their own account.
DROP POLICY IF EXISTS events_insert_role_guard
  ON public.events;

CREATE POLICY events_insert_role_guard
  ON public.events
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_app_role() IN ('teacher', 'admin')
    AND created_by = (SELECT auth.uid())
  );

-- Verify the client roles cannot write the protected role column.
DO $verify$
BEGIN
  IF has_column_privilege(
    'anon', 'public.profiles', 'role', 'UPDATE'
  ) OR has_column_privilege(
    'authenticated', 'public.profiles', 'role', 'UPDATE'
  ) THEN
    RAISE EXCEPTION
      'Security check failed: a client role can still update profiles.role.';
  END IF;

  IF has_table_privilege(
    'anon', 'public.profiles', 'INSERT'
  ) OR has_table_privilege(
    'authenticated', 'public.profiles', 'INSERT'
  ) THEN
    RAISE EXCEPTION
      'Security check failed: a client role still has table-level profile INSERT.';
  END IF;
END;
$verify$;

COMMIT;
