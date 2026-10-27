import { createFileRoute } from "@tanstack/react-router";
import { DonorApprovalsPage } from "@/components/admin-dashboard";

export const Route = createFileRoute("/admin/donor-approvals" as never)({
  component: DonorApprovalsPage,
});
