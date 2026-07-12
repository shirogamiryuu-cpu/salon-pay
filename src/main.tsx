import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "./styles.css";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";

import Index from "./routes/index";
import Auth from "./routes/auth";

import AdminLayout from "./routes/admin";
import AdminDashboard from "./routes/admin.index";
import AdminRules from "./routes/admin.rules";
import AdminEarnings from "./routes/admin.earnings";
import AdminPayroll from "./routes/admin.payroll";
import AdminSettings from "./routes/admin.settings";
import AdminStaffLayout from "./routes/admin.staff";
import AdminStaffIndex from "./routes/admin.staff.index";
import AdminStaffDetail from "./routes/admin.staff.$userId";
import AdminInvoicesLayout from "./routes/admin.invoices";
import AdminInvoicesIndex from "./routes/admin.invoices.index";
import AdminInvoiceDetail from "./routes/admin.invoices.$userId.$yearMonth";

import StaffLayout from "./routes/staff";
import StaffIndex from "./routes/staff.index";
import StaffInvoices from "./routes/staff.invoices";
import StaffInvoiceDetail from "./routes/staff.invoices.$yearMonth";

const queryClient = new QueryClient();

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <div>
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found</p>
        <a href="#/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Go home</a>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="rules" element={<AdminRules />} />
              <Route path="earnings" element={<AdminEarnings />} />
              <Route path="payroll" element={<AdminPayroll />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="staff" element={<AdminStaffLayout />}>
                <Route index element={<AdminStaffIndex />} />
                <Route path=":userId" element={<AdminStaffDetail />} />
              </Route>
              <Route path="invoices" element={<AdminInvoicesLayout />}>
                <Route index element={<AdminInvoicesIndex />} />
                <Route path=":userId" element={<AdminInvoiceDetail />} />
                <Route path=":userId/:yearMonth" element={<AdminInvoiceDetail />} />
              </Route>
            </Route>

            <Route path="/staff" element={<StaffLayout />}>
              <Route index element={<StaffIndex />} />
              <Route path="invoices" element={<StaffInvoices />} />
              <Route path="invoices/view" element={<StaffInvoiceDetail />} />
              <Route path="invoices/:yearMonth" element={<StaffInvoiceDetail />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </AuthProvider>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
);
