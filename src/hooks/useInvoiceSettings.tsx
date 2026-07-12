import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InvoiceSettings = {
  salon_name: string;
  address: string;
  phone: string;
  footer: string;
  currency: string;
  show_rate: boolean;
  show_status: boolean;
  paper: "a4" | "letter" | "receipt80";
};

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettings = {
  salon_name: "Charme Salon",
  address: "",
  phone: "",
  footer: "Thank you for your work this month.",
  currency: "$",
  show_rate: true,
  show_status: true,
  paper: "a4",
};

export const INVOICE_KEYS = [
  "invoice_salon_name",
  "invoice_address",
  "invoice_phone",
  "invoice_footer",
  "invoice_currency",
  "invoice_show_rate",
  "invoice_show_status",
  "invoice_paper",
] as const;

function coerce(rows: Array<{ key: string; value: unknown }>): InvoiceSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const s = (k: string, d: string) => {
    const v = map.get(k);
    return typeof v === "string" ? v : v == null ? d : String(v);
  };
  const b = (k: string, d: boolean) => {
    const v = map.get(k);
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v === "true";
    return d;
  };
  const paper = s("invoice_paper", DEFAULT_INVOICE_SETTINGS.paper);
  return {
    salon_name: s("invoice_salon_name", DEFAULT_INVOICE_SETTINGS.salon_name),
    address: s("invoice_address", DEFAULT_INVOICE_SETTINGS.address),
    phone: s("invoice_phone", DEFAULT_INVOICE_SETTINGS.phone),
    footer: s("invoice_footer", DEFAULT_INVOICE_SETTINGS.footer),
    currency: s("invoice_currency", DEFAULT_INVOICE_SETTINGS.currency),
    show_rate: b("invoice_show_rate", DEFAULT_INVOICE_SETTINGS.show_rate),
    show_status: b("invoice_show_status", DEFAULT_INVOICE_SETTINGS.show_status),
    paper: (paper === "letter" || paper === "receipt80" ? paper : "a4") as InvoiceSettings["paper"],
  };
}

export function useInvoiceSettings() {
  return useQuery({
    queryKey: ["invoice_settings"],
    queryFn: async (): Promise<InvoiceSettings> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key,value")
        .in("key", INVOICE_KEYS as unknown as string[]);
      if (error) throw error;
      return coerce((data ?? []) as Array<{ key: string; value: unknown }>);
    },
  });
}

export function paperPrintCss(paper: InvoiceSettings["paper"]): string {
  if (paper === "receipt80") {
    return `@page { size: 80mm auto; margin: 4mm; }
      @media print { .invoice-sheet { width: 72mm !important; box-shadow: none !important; border: 0 !important; }
        .invoice-sheet .invoice-body { padding: 8px !important; font-size: 11px !important; }
        .invoice-sheet h1 { font-size: 16px !important; }
        .invoice-sheet table { font-size: 10px !important; }
      }`;
  }
  const size = paper === "letter" ? "letter" : "A4";
  return `@page { size: ${size}; margin: 14mm; }`;
}
