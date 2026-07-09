
CREATE TRIGGER trg_commission_rules_updated_at
BEFORE UPDATE ON public.commission_rules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_commission_entries_updated_at
BEFORE UPDATE ON public.commission_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_payroll_runs_updated_at
BEFORE UPDATE ON public.payroll_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_payroll_items_updated_at
BEFORE UPDATE ON public.payroll_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
