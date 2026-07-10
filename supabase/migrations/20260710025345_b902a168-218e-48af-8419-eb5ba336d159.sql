
CREATE OR REPLACE FUNCTION public.create_commission_entries_on_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_usage_log RECORD;
  v_package RECORD;
  v_cust_pkg RECORD;
  v_variant RECORD;
  v_revenue NUMERIC(10,2);
  v_staff_id UUID;
  v_staff_role app_role;
  v_rule RECORD;
  v_amount NUMERIC(10,2);
  v_default_pct NUMERIC(10,2);
  v_staff_default NUMERIC(10,2);
  v_stylist_default NUMERIC(10,2);
BEGIN
  IF NEW.status <> 'approved' THEN RETURN NEW; END IF;
  IF OLD.status = 'approved' THEN RETURN NEW; END IF;

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

  SELECT cp.* INTO v_cust_pkg FROM public.customer_packages cp WHERE cp.id = NEW.customer_package_id;
  SELECT p.*  INTO v_package  FROM public.packages p WHERE p.id = v_cust_pkg.package_id;
  IF v_package.id IS NULL THEN RETURN NEW; END IF;

  -- Resolve variant (prefer usage_log's variant, then customer_package's)
  IF v_usage_log.variant_id IS NOT NULL THEN
    SELECT * INTO v_variant FROM public.package_variants WHERE id = v_usage_log.variant_id;
  ELSIF v_cust_pkg.variant_id IS NOT NULL THEN
    SELECT * INTO v_variant FROM public.package_variants WHERE id = v_cust_pkg.variant_id;
  END IF;

  -- Revenue: actual price applied > customer_package total/sessions > first-time/variant/package price / sessions
  IF v_usage_log.price_applied IS NOT NULL AND v_usage_log.price_applied > 0 THEN
    v_revenue := v_usage_log.price_applied;
  ELSIF v_cust_pkg.total_price IS NOT NULL AND v_cust_pkg.total_price > 0
        AND COALESCE(v_cust_pkg.total_sessions, v_package.total_sessions, 0) > 0 THEN
    v_revenue := ROUND(v_cust_pkg.total_price / COALESCE(v_cust_pkg.total_sessions, v_package.total_sessions), 2);
  ELSE
    DECLARE v_base NUMERIC(10,2);
    BEGIN
      IF COALESCE(v_usage_log.was_first_time, false) THEN
        v_base := COALESCE(v_variant.first_time_price, v_package.first_time_price,
                           v_variant.price, v_package.price);
      ELSE
        v_base := COALESCE(v_variant.price, v_package.price);
      END IF;
      v_revenue := CASE
        WHEN COALESCE(v_package.total_sessions, 0) > 0 THEN ROUND(v_base / v_package.total_sessions, 2)
        ELSE v_base
      END;
    END;
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.create_commission_entries_on_approval() FROM PUBLIC, anon, authenticated;

-- Backfill pending entries with corrected revenue and amount
WITH computed AS (
  SELECT
    ce.id,
    COALESCE(
      NULLIF(ul.price_applied, 0),
      CASE WHEN cp.total_price > 0 AND COALESCE(cp.total_sessions, p.total_sessions, 0) > 0
           THEN ROUND(cp.total_price / COALESCE(cp.total_sessions, p.total_sessions), 2)
      END,
      CASE WHEN COALESCE(ul.was_first_time, false)
           THEN CASE WHEN COALESCE(p.total_sessions,0) > 0
                     THEN ROUND(COALESCE(pv.first_time_price, p.first_time_price, pv.price, p.price) / p.total_sessions, 2)
                     ELSE COALESCE(pv.first_time_price, p.first_time_price, pv.price, p.price)
                END
           ELSE CASE WHEN COALESCE(p.total_sessions,0) > 0
                     THEN ROUND(COALESCE(pv.price, p.price) / p.total_sessions, 2)
                     ELSE COALESCE(pv.price, p.price)
                END
      END
    )::numeric(10,2) AS new_revenue
  FROM public.commission_entries ce
  LEFT JOIN public.usage_logs ul ON ul.id = ce.usage_log_id
  LEFT JOIN public.customer_packages cp ON cp.id = ul.customer_package_id
  LEFT JOIN public.packages p ON p.id = ce.package_id
  LEFT JOIN public.package_variants pv ON pv.id = COALESCE(ul.variant_id, cp.variant_id)
  WHERE ce.status = 'pending'
)
UPDATE public.commission_entries ce
SET session_revenue = c.new_revenue,
    commission_amount = CASE
      WHEN ce.commission_type = 'flat' THEN ce.commission_value
      ELSE ROUND(c.new_revenue * ce.commission_value / 100.0, 2)
    END,
    updated_at = now()
FROM computed c
WHERE ce.id = c.id AND c.new_revenue IS NOT NULL;
