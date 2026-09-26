import { createFileRoute } from "@tanstack/react-router";
import { NewRequestPage } from "@/components/bloodconnect";

export const Route = createFileRoute("/new-request")({
  head: () => ({
    meta: [
      { title: "Create an emergency request — BloodConnect" },
      { name: "description", content: "Create an emergency blood request and notify compatible, eligible donors in your selected area." },
      { property: "og:title", content: "Create an emergency request — BloodConnect" },
      { property: "og:description", content: "Create an emergency blood request and notify compatible, eligible donors in your selected area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewRequestPage,
});