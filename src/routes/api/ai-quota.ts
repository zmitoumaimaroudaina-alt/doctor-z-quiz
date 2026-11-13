import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/ai-quota")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { authenticateStudentRequest, getStudentQuotaStatus } = await import(
          "@/lib/ai-quota.server"
        );
        const { hasGeminiApiKey } = await import("@/lib/gemini.server");
        const student = await authenticateStudentRequest(request);
        if (!student) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const status = await getStudentQuotaStatus(student.userId, student.isCreator);
        return Response.json(
          {
            ...status,
            aiEnabled: hasGeminiApiKey(),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
