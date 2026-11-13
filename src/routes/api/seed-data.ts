import { createFileRoute } from "@tanstack/react-router";
import { loadSeedData } from "@/lib/seed-loader.server";

export const Route = createFileRoute("/api/seed-data")({
  server: {
    handlers: {
      GET: async () => {
        const seed = await loadSeedData();
        return Response.json(seed, {
          headers: { "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
