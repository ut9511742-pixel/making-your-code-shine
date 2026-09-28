import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/bloodconnect";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BloodConnect — Community blood response network" },
      { name: "description", content: "Connect urgent blood needs with compatible nearby donors through a private community response network." },
      { property: "og:title", content: "BloodConnect — Community blood response network" },
      { property: "og:description", content: "Connect urgent blood needs with compatible nearby donors through a private community response network." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});