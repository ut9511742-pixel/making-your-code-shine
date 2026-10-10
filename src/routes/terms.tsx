import { createFileRoute } from "@tanstack/react-router";
import { TermsPage } from "@/components/donation-guidance";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions — BloodConnect" },
      { name: "description", content: "Review BloodConnect’s draft participation terms covering responsible use, donor privacy, location consent and medical limitations." },
      { property: "og:title", content: "Terms and Conditions — BloodConnect" },
      { property: "og:description", content: "Read the proposed terms for respectful participation and safe blood-request coordination." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});