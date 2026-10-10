import { createFileRoute } from "@tanstack/react-router";
import { DonorProfilePage } from "@/components/bloodconnect";
import { BLOOD_GROUPS } from "@/lib/bloodconnect";

export const Route = createFileRoute("/donors/$donorReference")({
  validateSearch: (search: Record<string, unknown>) => ({
    group: BLOOD_GROUPS.includes(search.group as (typeof BLOOD_GROUPS)[number]) ? search.group as (typeof BLOOD_GROUPS)[number] : "O+",
    radius: [5, 10, 20, 50].includes(Number(search.radius)) ? Number(search.radius) : 10,
  }),
  head: () => ({
    meta: [
      { title: "Donor profile — BloodConnect" },
      { name: "description", content: "Review a compatible BloodConnect donor profile and request approval." },
    ],
  }),
  component: DonorProfileRoute,
});

function DonorProfileRoute() {
  const { donorReference } = Route.useParams();
  const { group, radius } = Route.useSearch();
  return <DonorProfilePage donorReference={donorReference} group={group} radius={radius} />;
}
