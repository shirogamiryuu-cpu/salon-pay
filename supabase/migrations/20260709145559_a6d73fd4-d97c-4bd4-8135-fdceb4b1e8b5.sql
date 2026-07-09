-- app_settings table
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.app_settings (key, value) VALUES
  ('default_staff_commission_pct', '3'::jsonb),
  ('default_stylist_commission_pct', '7'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Update trigger function to use settings fallback
CREATE OR REPLACE FUNCTION public.create_commission_entries_on_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_usage_log RECORD;
  v_package RECORD;
  v_revenue NUMERIC(10,2);
  v_staff_id UUID;
  v_staff_role app_role;
  v_rule RECORD;
  v_amount NUMERIC(10,2);
  v_default_pct NUMERIC(10,2);
  v_staff_default NUMERIC(10,2);
  v_stylist_default NUMERIC(10,2);
BEGIN
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  -- Load defaults from settings
  SELECT COALESCE((value)::text::numeric, 3) INTO v_staff_default
    FROM public.app_settings WHERE key = 'default_staff_commission_pct';
  SELECT COALESCE((value)::text::numeric, 7) INTO v_stylist_default
    FROM public.app_settings WHERE key = 'default_stylist_commission_pct';
  v_staff_default := COALESCE(v_staff_default, 3);
  v_stylist_default := COALESCE(v_stylist_default, 7);

  SELECT ul.* INTO v_usage_log FROM public.usage_logs ul WHERE ul.id = NEW.usage_log_id LIMIT 1;
  IF v_usage_log.id IS NULL THEN
    SELECT ul.* INTO v_usage_log
    FROM public.usage_logs ul
    WHERE ul.customer_package_id = NEW.customer_package_id
    ORDER BY ul.used_at DESC LIMIT 1;
  END IF;

  SELECT p.* INTO v_package
  FROM public.packages p
  JOIN public.customer_packages cp ON cp.package_id = p.id
  WHERE cp.id = NEW.customer_package_id;

  IF v_package.id IS NULL THEN RETURN NEW; END IF;

  v_revenue := CASE
    WHEN COALESCE(v_package.total_sessions,0) > 0 THEN v_package.price / v_package.total_sessions
    ELSE v_package.price
  END;

  IF v_usage_log.id IS NOT NULL AND EXISTS (SELECT 1 FROM public.session_staff WHERE usage_log_id = v_usage_log.id) THEN
    FOR v_staff_id IN
      SELECT staff_user_id FROM public.session_staff WHERE usage_log_id = v_usage_log.id
    LOOP
      SELECT role INTO v_staff_role FROM public.user_roles
        WHERE user_id = v_staff_id AND role = 'stylist' LIMIT 1;
      IF v_staff_role IS NULL THEN
        SELECT role INTO v_staff_role FROM public.user_roles
          WHERE user_id = v_staff_id AND role = 'staff' LIMIT 1;
      END IF;

      SELECT * INTO v_rule FROM public.commission_rules
       WHERE is_active = true
         AND (package_id = v_package.id OR package_id IS NULL)
         AND (staff_role = v_staff_role OR staff_role IS NULL)
       ORDER BY (package_id = v_package.id) DESC,
                (staff_role = v_staff_role) DESC,
                priority DESC, created_at DESC
       LIMIT 1;

      IF v_rule.id IS NULL THEN
        v_default_pct := CASE
          WHEN v_staff_role = 'stylist' THEN v_stylist_default
          WHEN v_staff_role = 'staff' THEN v_staff_default
          ELSE 0
        END;
        v_amount := ROUND(v_revenue * v_default_pct / 100.0, 2);
        INSERT INTO public.commission_entries
          (staff_user_id, usage_log_id, session_deduction_request_id, package_id,
           commission_rule_id, session_revenue, commission_amount, commission_type, commission_value)
        VALUES (v_staff_id, v_usage_log.id, NEW.id, v_package.id,
                NULL, v_revenue, v_amount, 'percentage', v_default_pct);
      ELSE
        IF v_rule.commission_type = 'flat' THEN
          v_amount := v_rule.commission_value;
        ELSE
          v_amount := ROUND(v_revenue * v_rule.commission_value / 100.0, 2);
        END IF;
        INSERT INTO public.commission_entries
          (staff_user_id, usage_log_id, session_deduction_request_id, package_id,
           commission_rule_id, session_revenue, commission_amount, commission_type, commission_value)
        VALUES (v_staff_id, v_usage_log.id, NEW.id, v_package.id,
                v_rule.id, v_revenue, v_amount, v_rule.commission_type, v_rule.commission_value);
      END IF;
    END LOOP;
  ELSIF NEW.staff_ids IS NOT NULL THEN
    FOREACH v_staff_id IN ARRAY NEW.staff_ids LOOP
      SELECT role INTO v_staff_role FROM public.user_roles
        WHERE user_id = v_staff_id AND role = 'stylist' LIMIT 1;
      IF v_staff_role IS NULL THEN
        SELECT role INTO v_staff_role FROM public.user_roles
          WHERE user_id = v_staff_id AND role = 'staff' LIMIT 1;
      END IF;

      SELECT * INTO v_rule FROM public.commission_rules
       WHERE is_active = true
         AND (package_id = v_package.id OR package_id IS NULL)
         AND (staff_role = v_staff_role OR staff_role IS NULL)
       ORDER BY (package_id = v_package.id) DESC,
                (staff_role = v_staff_role) DESC,
                priority DESC, created_at DESC
       LIMIT 1;

      IF v_rule.id IS NULL THEN
        v_default_pct := CASE
          WHEN v_staff_role = 'stylist' THEN v_stylist_default
          WHEN v_staff_role = 'staff' THEN v_staff_default
          ELSE 0
        END;
        v_amount := ROUND(v_revenue * v_default_pct / 100.0, 2);
        INSERT INTO public.commission_entries
          (staff_user_id, usage_log_id, session_deduction_request_id, package_id,
           commission_rule_id, session_revenue, commission_amount, commission_type, commission_value)
        VALUES (v_staff_id, v_usage_log.id, NEW.id, v_package.id,
                NULL, v_revenue, v_amount, 'percentage', v_default_pct);
      ELSE
        IF v_rule.commission_type = 'flat' THEN
          v_amount := v_rule.commission_value;
        ELSE
          v_amount := ROUND(v_revenue * v_rule.commission_value / 100.0, 2);
        END IF;
        INSERT INTO public.commission_entries
          (staff_user_id, usage_log_id, session_deduction_request_id, package_id,
           commission_rule_id, session_revenue, commission_amount, commission_type, commission_value)
        VALUES (v_staff_id, v_usage_log.id, NEW.id, v_package.id,
                v_rule.id, v_revenue, v_amount, v_rule.commission_type, v_rule.commission_value);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Keep EXECUTE revoked (already done in prior migration for internal trigger fns)
REVOKE EXECUTE ON FUNCTION public.create_commission_entries_on_approval() FROM PUBLIC, anon, authenticated;
