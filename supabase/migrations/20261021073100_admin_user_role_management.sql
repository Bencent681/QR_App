BEGIN;

CREATE OR REPLACE FUNCTION public.admin_change_user_role(
  p_target_user_id pg_catalog.uuid,
  p_new_role pg_catalog.text
)
RETURNS pg_catalog.void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $function$
DECLARE
  v_actor_id pg_catalog.uuid;
  v_actor_role pg_catalog.text;
  v_target_role pg_catalog.text;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING ERRCODE = '28000';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'A target user ID is required.'
      USING ERRCODE = '22023';
  END IF;

  IF p_new_role IS NULL
     OR p_new_role NOT IN ('student', 'teacher') THEN
    RAISE EXCEPTION 'The requested role is invalid.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(20261020, 15001);

  SELECT profile.role
    INTO v_actor_role
    FROM public.profiles AS profile
    WHERE profile.id = v_actor_id
    FOR UPDATE;

  IF v_actor_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Administrator access is required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id = v_actor_id THEN
    RAISE EXCEPTION 'Administrators cannot change their own role.'
      USING ERRCODE = '42501';
  END IF;

  SELECT profile.role
    INTO v_target_role
    FROM public.profiles AS profile
    WHERE profile.id = p_target_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The target profile does not exist.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_target_role = 'admin' THEN
    RAISE EXCEPTION 'Administrator roles cannot be changed.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles AS profile
    SET role = p_new_role
    WHERE profile.id = p_target_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id pg_catalog.uuid,
  full_name pg_catalog.text,
  email pg_catalog.text,
  role pg_catalog.text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET row_security = off
AS $function$
DECLARE
  v_actor_id pg_catalog.uuid;
  v_actor_role pg_catalog.text;
BEGIN
  v_actor_id := auth.uid();

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.'
      USING ERRCODE = '28000';
  END IF;

  SELECT profile.role
    INTO v_actor_role
    FROM public.profiles AS profile
    WHERE profile.id = v_actor_id
    FOR SHARE;

  IF v_actor_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Administrator access is required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT profile.id, profile.full_name, profile.email, profile.role
      FROM public.profiles AS profile
      ORDER BY profile.full_name ASC NULLS LAST, profile.email ASC;
END;
$function$;

DO $admin_user_function_owner_check$
DECLARE
  v_role_function_owner pg_catalog.oid;
  v_role_owner_name pg_catalog.name;
  v_role_owner_bypasses_rls boolean;
  v_list_function_owner pg_catalog.oid;
  v_list_owner_name pg_catalog.name;
  v_list_owner_bypasses_rls boolean;
  v_profiles_owner pg_catalog.oid;
  v_profiles_rls_enabled boolean;
  v_profiles_force_rls boolean;
BEGIN
  SELECT function_row.proowner, owner_role.rolname, owner_role.rolbypassrls
    INTO v_role_function_owner, v_role_owner_name,
         v_role_owner_bypasses_rls
    FROM pg_catalog.pg_proc AS function_row
    JOIN pg_catalog.pg_roles AS owner_role
      ON owner_role.oid = function_row.proowner
    WHERE function_row.oid =
      'public.admin_change_user_role(pg_catalog.uuid,pg_catalog.text)'::pg_catalog.regprocedure;

  SELECT function_row.proowner, owner_role.rolname, owner_role.rolbypassrls
    INTO v_list_function_owner, v_list_owner_name,
         v_list_owner_bypasses_rls
    FROM pg_catalog.pg_proc AS function_row
    JOIN pg_catalog.pg_roles AS owner_role
      ON owner_role.oid = function_row.proowner
    WHERE function_row.oid =
      'public.admin_list_users()'::pg_catalog.regprocedure;

  IF v_role_function_owner IS NULL
     OR v_list_function_owner IS NULL
     OR NOT pg_catalog.has_column_privilege(
       v_role_owner_name, 'public.profiles', 'id', 'SELECT'
     )
     OR NOT pg_catalog.has_column_privilege(
       v_role_owner_name, 'public.profiles', 'role', 'SELECT'
     )
     OR NOT pg_catalog.has_column_privilege(
       v_role_owner_name, 'public.profiles', 'role', 'UPDATE'
     ) THEN
    RAISE EXCEPTION
      'The role-change function owner must be able to read profile IDs and roles and update the role column.';
  END IF;

  SELECT relation.relowner, relation.relrowsecurity, relation.relforcerowsecurity
    INTO v_profiles_owner, v_profiles_rls_enabled, v_profiles_force_rls
    FROM pg_catalog.pg_class AS relation
    WHERE relation.oid = 'public.profiles'::pg_catalog.regclass;

  IF v_profiles_rls_enabled
     AND (v_profiles_force_rls OR v_role_function_owner IS DISTINCT FROM v_profiles_owner)
     AND NOT v_role_owner_bypasses_rls THEN
    RAISE EXCEPTION
      'The role-change function owner must bypass profiles RLS when row_security is disabled.';
  END IF;

  IF NOT pg_catalog.has_column_privilege(
    v_list_owner_name, 'public.profiles', 'id', 'SELECT'
  ) OR NOT pg_catalog.has_column_privilege(
    v_list_owner_name, 'public.profiles', 'role', 'SELECT'
  ) OR NOT pg_catalog.has_column_privilege(
    v_list_owner_name, 'public.profiles', 'full_name', 'SELECT'
  ) OR NOT pg_catalog.has_column_privilege(
    v_list_owner_name, 'public.profiles', 'email', 'SELECT'
  ) THEN
    RAISE EXCEPTION
      'The admin-list function owner must be able to read profile names and email addresses.';
  END IF;

  IF v_profiles_rls_enabled
     AND (v_profiles_force_rls OR v_list_function_owner IS DISTINCT FROM v_profiles_owner)
     AND NOT v_list_owner_bypasses_rls THEN
    RAISE EXCEPTION
      'The admin-list function owner must bypass profiles RLS when row_security is disabled.';
  END IF;
END;
$admin_user_function_owner_check$;

REVOKE ALL PRIVILEGES
  ON FUNCTION public.admin_change_user_role(pg_catalog.uuid, pg_catalog.text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES
  ON FUNCTION public.admin_list_users()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION public.admin_change_user_role(pg_catalog.uuid, pg_catalog.text)
  TO authenticated;
GRANT EXECUTE
  ON FUNCTION public.admin_list_users()
  TO authenticated;

COMMIT;
