
-- =========================================
-- Commission Management System (additive)
-- =========================================

-- 1. commission_rules
CREATE TABLE public.commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  package_id UUID REFERENCES public.packages(id) ON DELETE CASCADE,
  staff_role app_role,
  commission_type TEXT NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage','flat')),
  commission_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage commission rules" ON public.commission_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Staff view commission rules" ON public.commission_rules
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'stylist'));

-- 2. commission_entries
CREATE TABLE public.commission_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  usage_log_id UUID REFERENCES public.usage_logs(id) ON DELETE SET NULL,
  session_deduction_request_id UUID REFERENCES public.session_deduction_requests(id) ON DELETE SET NULL,
  package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  commission_rule_id UUID REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  session_revenue NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_type TEXT NOT NULL DEFAULT 'percentage',
  commission_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','included','paid','cancelled')),
  payroll_item_id UUID,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_commission_entries_staff ON public.commission_entries(staff_user_id);
CREATE INDEX idx_commission_entries_status ON public.commission_entries(status);
CREATE INDEX idx_commission_entries_earned_at ON public.commission_entries(earned_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_entries TO authenticated;
GRANT ALL ON public.commission_entries TO service_role;
ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage commission entries" ON public.commission_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Staff view own commission entries" ON public.commission_entries
  FOR SELECT TO authenticated
  USING (staff_user_id = auth.uid());

-- 3. payroll_runs
CREATE TABLE public.payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','paid','cancelled')),
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payroll runs" ON public.payroll_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 4. payroll_items
CREATE TABLE public.payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  staff_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entries_count INT NOT NULL DEFAULT 0,
  gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  adjustments NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payroll_items_run ON public.payroll_items(payroll_run_id);
CREATE INDEX idx_payroll_items_staff ON public.payroll_items(staff_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_items TO authenticated;
GRANT ALL ON public.payroll_items TO service_role;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payroll items" ON public.payroll_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Staff view own payroll items" ON public.payroll_items
  FOR SELECT TO authenticated
  USING (staff_user_id = auth.uid());

-- 5. staff_payment_history
CREATE TABLE public.staff_payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
  payroll_item_id UUID REFERENCES public.payroll_items(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT,
  reference TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_history_staff ON public.staff_payment_history(staff_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_payment_history TO authenticated;
GRANT ALL ON public.staff_payment_history TO service_role;
ALTER TABLE public.staff_payment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage payment history" ON public.staff_payment_history
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Staff view own payment history" ON public.staff_payment_history
  FOR SELECT TO authenticated
  USING (staff_user_id = auth.uid());

-- FK for payroll_item_id (added after payroll_items exists)
ALTER TABLE public.commission_entries
  ADD CONSTRAINT commission_entries_payroll_item_fk
  FOREIGN KEY (payroll_item_id) REFERENCES public.payroll_items(id) ON DELETE SET NULL;

-- updated_at triggers
CREATE TRIGGER trg_commission_rules_updated BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_commission_entries_updated BEFORE UPDATE ON public.commission_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_payroll_runs_updated BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_payroll_items_updated BEFORE UPDATE ON public.payroll_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- Auto-create commission entries on approval
-- =========================================
CREATE OR REPLACE FUNCTION public.create_commission_entries_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usage_log RECORD;
  v_package RECORD;
  v_revenue NUMERIC(10,2);
  v_staff_id UUID;
  v_staff_role app_role;
  v_rule RECORD;
  v_amount NUMERIC(10,2);
BEGIN
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  -- Find usage log (linked or most recent for the customer_package around approval time)
  SELECT ul.* INTO v_usage_log
  FROM public.usage_logs ul
  WHERE ul.id = NEW.usage_log_id
  LIMIT 1;

  IF v_usage_log.id IS NULL THEN
    SELECT ul.* INTO v_usage_log
    FROM public.usage_logs ul
    WHERE ul.customer_package_id = NEW.customer_package_id
    ORDER BY ul.used_at DESC
    LIMIT 1;
  END IF;

  -- Compute per-session revenue from package
  SELECT p.* INTO v_package
  FROM public.packages p
  JOIN public.customer_packages cp ON cp.package_id = p.id
  WHERE cp.id = NEW.customer_package_id;

  IF v_package.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_revenue := CASE
    WHEN COALESCE(v_package.total_sessions,0) > 0 THEN v_package.price / v_package.total_sessions
    ELSE v_package.price
  END;

  -- Iterate staff: prefer session_staff for the usage log; fallback to NEW.staff_ids
  IF v_usage_log.id IS NOT NULL AND EXISTS (SELECT 1 FROM public.session_staff WHERE usage_log_id = v_usage_log.id) THEN
    FOR v_staff_id IN
      SELECT staff_user_id FROM public.session_staff WHERE usage_log_id = v_usage_log.id
    LOOP
      -- resolve preferred role
      SELECT role INTO v_staff_role FROM public.user_roles
        WHERE user_id = v_staff_id AND role = 'stylist' LIMIT 1;
      IF v_staff_role IS NULL THEN
        SELECT role INTO v_staff_role FROM public.user_roles
          WHERE user_id = v_staff_id AND role = 'staff' LIMIT 1;
      END IF;

      -- match rule
      SELECT * INTO v_rule FROM public.commission_rules
       WHERE is_active = true
         AND (package_id = v_package.id OR package_id IS NULL)
         AND (staff_role = v_staff_role OR staff_role IS NULL)
       ORDER BY (package_id = v_package.id) DESC,
                (staff_role = v_staff_role) DESC,
                priority DESC, created_at DESC
       LIMIT 1;

      IF v_rule.id IS NULL THEN
        v_amount := 0;
        INSERT INTO public.commission_entries
          (staff_user_id, usage_log_id, session_deduction_request_id, package_id,
           commission_rule_id, session_revenue, commission_amount, commission_type, commission_value)
        VALUES (v_staff_id, v_usage_log.id, NEW.id, v_package.id,
                NULL, v_revenue, 0, 'percentage', 0);
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
        INSERT INTO public.commission_entries
          (staff_user_id, usage_log_id, session_deduction_request_id, package_id,
           commission_rule_id, session_revenue, commission_amount, commission_type, commission_value)
        VALUES (v_staff_id, v_usage_log.id, NEW.id, v_package.id,
                NULL, v_revenue, 0, 'percentage', 0);
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
$$;

CREATE TRIGGER trg_session_deduction_approved
AFTER UPDATE OF status ON public.session_deduction_requests
FOR EACH ROW
EXECUTE FUNCTION public.create_commission_entries_on_approval();
