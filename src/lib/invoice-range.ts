import { format } from "date-fns";

export type RangeMode = "day" | "month" | "custom" | "session";

export type Resolved = {
  mode: RangeMode;
  from: Date;
  to: Date; // exclusive upper bound
  label: string;
  session?: string;
  invoiceNo: string;
};

export function resolveRange(params: {
  search: URLSearchParams;
  legacyYearMonth?: string;
  userIdForNo?: string;
}): Resolved {
  const { search, legacyYearMonth, userIdForNo = "" } = params;
  const session = search.get("session") ?? undefined;
  const mode = (search.get("mode") as RangeMode | null) ?? undefined;
  const fromStr = search.get("from") ?? undefined;
  const toStr = search.get("to") ?? undefined;

  const shortUser = userIdForNo.slice(0, 4).toUpperCase();

  if (session) {
    return {
      mode: "session",
      from: new Date(0),
      to: new Date(8640000000000000),
      label: "Single session",
      session,
      invoiceNo: `S-${session.slice(0, 6).toUpperCase()}-${shortUser}`,
    };
  }

  // Legacy /yyyy-MM path
  if (!mode && !fromStr && !toStr && legacyYearMonth && /^\d{4}-\d{2}$/.test(legacyYearMonth)) {
    const [y, m] = legacyYearMonth.split("-").map(Number);
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 1);
    return {
      mode: "month",
      from,
      to,
      label: format(from, "MMMM yyyy"),
      invoiceNo: `${legacyYearMonth.replace("-", "")}-${shortUser}`,
    };
  }

  if (mode === "day" && fromStr) {
    const from = parseDay(fromStr);
    const to = addDays(from, 1);
    return {
      mode: "day",
      from,
      to,
      label: format(from, "MMM d, yyyy"),
      invoiceNo: `D${format(from, "yyyyMMdd")}-${shortUser}`,
    };
  }

  if (mode === "month" && fromStr && /^\d{4}-\d{2}$/.test(fromStr)) {
    const [y, m] = fromStr.split("-").map(Number);
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 1);
    return {
      mode: "month",
      from,
      to,
      label: format(from, "MMMM yyyy"),
      invoiceNo: `${fromStr.replace("-", "")}-${shortUser}`,
    };
  }

  if (fromStr && toStr) {
    const from = parseDay(fromStr);
    const to = addDays(parseDay(toStr), 1);
    return {
      mode: "custom",
      from,
      to,
      label: `${format(from, "MMM d, yyyy")} – ${format(parseDay(toStr), "MMM d, yyyy")}`,
      invoiceNo: `R${format(from, "yyyyMMdd")}-${format(parseDay(toStr), "yyyyMMdd")}-${shortUser}`,
    };
  }

  // default: current month
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    mode: "month",
    from,
    to,
    label: format(from, "MMMM yyyy"),
    invoiceNo: `${format(from, "yyyyMM")}-${shortUser}`,
  };
}

function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
