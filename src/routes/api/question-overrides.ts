import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const SaveSchema = z.object({
  questionId: z.string().min(1).max(160),
  question: z
    .object({
      stem: z.string().optional(),
      case_text: z.string().nullable().optional(),
      options: z.array(z.object({ key: z.string(), text: z.string() })).optional(),
      needs_review: z.boolean().optional(),
      review_reason: z.string().nullable().optional(),
    })
    .default({}),
  key: z.object({
    correct: z.array(z.string().max(4)).min(1),
    explanation: z.string().nullable().optional(),
    note: z.string().nullable().optional(),
  }),
});

export const Route = createFileRoute("/api/question-overrides")({
  server: {
    handlers: {
      GET: async () => {
        const { readServerOverrides } = await import("@/lib/questionOverrides.server");
        const store = await readServerOverrides();
        return Response.json(store, {
          headers: { "Cache-Control": "no-store" },
        });
      },
      POST: async ({ request }) => {
        const { authenticateStudentRequest } = await import("@/lib/ai-quota.server");
        const { upsertServerOverride } = await import("@/lib/questionOverrides.server");

        const student = await authenticateStudentRequest(request);
        if (!student) {
          return Response.json({ error: "Connexion requise." }, { status: 401 });
        }
        if (!student.isCreator) {
          return Response.json({ error: "Accès réservé au créateur." }, { status: 403 });
        }

        const body = await request.json().catch(() => null);
        const parsed = SaveSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Données invalides." }, { status: 400 });
        }

        const { questionId, question, key } = parsed.data;
        const cleanCorrect = [
          ...new Set(key.correct.map((c) => c.trim().toUpperCase()).filter((c) => /^[A-E]$/.test(c))),
        ].sort();

        if (!cleanCorrect.length) {
          return Response.json({ error: "Au moins une clé A-E est requise." }, { status: 400 });
        }

        const store = await upsertServerOverride(
          questionId,
          {
            ...(question.stem !== undefined ? { stem: question.stem } : {}),
            ...(question.case_text !== undefined ? { case_text: question.case_text } : {}),
            ...(question.options !== undefined ? { options: question.options } : {}),
            ...(question.needs_review !== undefined ? { needs_review: question.needs_review } : {}),
            ...(question.review_reason !== undefined ? { review_reason: question.review_reason } : {}),
          },
          {
            correct: cleanCorrect,
            ...(key.explanation !== undefined ? { explanation: key.explanation } : {}),
            ...(key.note !== undefined ? { note: key.note } : {}),
          },
        );

        return Response.json({ ok: true, store });
      },
      DELETE: async ({ request }) => {
        const { authenticateStudentRequest } = await import("@/lib/ai-quota.server");
        const { deleteServerOverride } = await import("@/lib/questionOverrides.server");

        const student = await authenticateStudentRequest(request);
        if (!student) {
          return Response.json({ error: "Connexion requise." }, { status: 401 });
        }
        if (!student.isCreator) {
          return Response.json({ error: "Accès réservé au créateur." }, { status: 403 });
        }

        const url = new URL(request.url);
        const questionId = url.searchParams.get("questionId")?.trim();
        if (!questionId) {
          return Response.json({ error: "questionId requis." }, { status: 400 });
        }

        const store = await deleteServerOverride(questionId);
        return Response.json({ ok: true, store });
      },
    },
  },
});
