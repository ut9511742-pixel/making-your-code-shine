import { createFileRoute } from "@tanstack/react-router";
import { EligibilityPage } from "@/components/donation-guidance";

export const Route = createFileRoute("/eligibility")({
  head: () => ({
    meta: [
      { title: "Blood donation eligibility — BloodConnect" },
      { name: "description", content: "Read general Indian whole-blood donation criteria, donation intervals and preparation guidance. Final eligibility is assessed by a blood centre." },
      { property: "og:title", content: "Blood donation eligibility — BloodConnect" },
      { property: "og:description", content: "Check age, weight, health and donation intervals before volunteering to donate blood." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EligibilityPage,
});