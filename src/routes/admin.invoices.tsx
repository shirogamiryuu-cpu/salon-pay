import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/invoices")({
  ssr: false,
  component: () => <Outlet />,
});
