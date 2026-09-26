import { createFileRoute } from "@tanstack/react-router";
import { DonorDesk } from "@/components/bloodconnect";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BloodConnect — Find compatible donors" },
      { name: "description", content: "Find eligible blood donors nearby and coordinate emergency requests with privacy in mind." },
      { property: "og:title", content: "BloodConnect — Find compatible donors" },
      { property: "og:description", content: "Find eligible blood donors nearby and coordinate emergency requests with privacy in mind." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DonorDesk,
});