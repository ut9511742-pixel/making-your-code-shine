import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/components/bloodconnect";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My donor profile — BloodConnect" },
      { name: "description", content: "Manage your private BloodConnect donor profile, availability, and location details." },
      { property: "og:title", content: "My donor profile — BloodConnect" },
      { property: "og:description", content: "Manage your private BloodConnect donor profile, availability, and location details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});