import { createFileRoute, useParams } from "@tanstack/react-router";
import { AdminDonorDetailsPage } from "@/components/admin-dashboard";

function AdminDonorDetailsRoute() {
  const { id } = useParams({ strict: false }) as { id?: string };
  return <AdminDonorDetailsPage donorId={id ?? ""} />;
}

export const Route = createFileRoute("/admin/donors/$id" as never)({
  component: AdminDonorDetailsRoute,
});
