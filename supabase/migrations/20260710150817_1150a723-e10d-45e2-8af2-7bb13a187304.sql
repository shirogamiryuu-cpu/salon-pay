REVOKE EXECUTE ON FUNCTION public.create_commission_entries_on_approval() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_package_promotion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

DO $$
DECLARE r RECORD; v_new_qual TEXT; v_new_check TEXT; v_cmd TEXT; v_for TEXT;
BEGIN
  FOR r IN SELECT p.schemaname, p.tablename, p.policyname, p.cmd AS pcmd, p.qual, p.with_check, p.roles
           FROM pg_policies p
           WHERE (p.qual LIKE '%has_role(%' OR p.with_check LIKE '%has_role(%')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    v_new_qual := replace(r.qual, 'has_role(', 'private.has_role(');
    v_new_check := replace(coalesce(r.with_check,''), 'has_role(', 'private.has_role(');
    v_for := CASE r.pcmd WHEN 'ALL' THEN 'ALL' ELSE r.pcmd END;
    v_cmd := format('CREATE POLICY %I ON %I.%I AS PERMISSIVE FOR %s TO %s',
                    r.policyname, r.schemaname, r.tablename, v_for,
                    array_to_string(r.roles, ','));
    IF r.qual IS NOT NULL THEN v_cmd := v_cmd || format(' USING (%s)', v_new_qual); END IF;
    IF r.with_check IS NOT NULL THEN v_cmd := v_cmd || format(' WITH CHECK (%s)', v_new_check); END IF;
    EXECUTE v_cmd;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);