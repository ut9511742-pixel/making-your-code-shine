import { createFileRoute } from "@tanstack/react-router";
import { DonorDesk } from "@/components/bloodconnect";

export const Route = createFileRoute("/donors")({
  head: () => ({
    meta: [
      { title: "Find compatible donors — BloodConnect" },
      { name: "description", content: "Search BloodConnect for eligible and available blood donors near your location." },
      { property: "og:title", content: "Find compatible donors — BloodConnect" },
      { property: "og:description", content: "Search BloodConnect for eligible and available blood donors near your location." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DonorDesk,
});