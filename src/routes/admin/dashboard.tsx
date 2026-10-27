import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboardPage } from "@/components/admin-dashboard";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboardPage,
});
