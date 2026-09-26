import { createFileRoute } from "@tanstack/react-router";
import { RequestsPage } from "@/components/bloodconnect";

export const Route = createFileRoute("/requests")({
  head: () => ({
    meta: [
      { title: "My blood requests — BloodConnect" },
      { name: "description", content: "Review the emergency blood requests you sent and requests where you may be able to help." },
      { property: "og:title", content: "My blood requests — BloodConnect" },
      { property: "og:description", content: "Review the emergency blood requests you sent and requests where you may be able to help." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RequestsPage,
});