import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const MetaSchema = z.object({
  title: z.string().trim().min(1).max(120),
  qtype: z.enum(["QCM", "QCS"]),
  count: z.coerce.number().int().min(1).max(40),
});

export const Route = createFileRoute("/api/lesson-quiz")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          authenticateStudentRequest,
          consumeStudentQuota,
          getStudentQuotaStatus,
        } = await import("@/lib/ai-quota.server");
        const {
          classifyGeminiError,
          generateQuizFromPdfBytes,
          hasGeminiApiKey,
        } = await import("@/lib/gemini.server");

        const student = await authenticateStudentRequest(request);
        if (!student) {
          return Response.json({ error: "Connexion requise." }, { status: 401 });
        }

        if (!hasGeminiApiKey()) {
          return Response.json(
            { error: "Le générateur Gemini API n'est pas encore configuré sur le serveur." },
            { status: 503 },
          );
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Requête invalide." }, { status: 400 });
        }

        const fileEntry = form.get("file");
        if (!(fileEntry instanceof File) || fileEntry.type !== "application/pdf" || fileEntry.size <= 0 || fileEntry.size > 20e6) {
          return Response.json(
            { error: "Choisissez un fichier PDF valide de moins de 20 Mo." },
            { status: 400 },
          );
        }

        const parsed = MetaSchema.safeParse({
          title: form.get("title") || fileEntry.name.replace(/\.pdf$/i, "") || "Mon cours",
          qtype: form.get("qtype") || "QCM",
          count: form.get("count") || 10,
        });
        if (!parsed.success) {
          return Response.json({ error: "Paramètres invalides." }, { status: 400 });
        }

        const quotaCheck = await consumeStudentQuota({
          userId: student.userId,
          kind: "pdf",
          isCreator: student.isCreator,
        });
        if (!quotaCheck.allowed) {
          return Response.json(
            {
              error: `Limite quotidienne atteinte (${quotaCheck.status.pdf.limit} quiz PDF/jour). Renouvellement demain à 00h.`,
              quota: quotaCheck.status,
            },
            { status: 429 },
          );
        }

        try {
          const bytes = new Uint8Array(await fileEntry.arrayBuffer());
          const pdfBase64 = Buffer.from(bytes).toString("base64");
          const questions = await generateQuizFromPdfBytes({
            pdfBase64,
            qtype: parsed.data.qtype,
            count: parsed.data.count,
          });

          if (!questions.length) {
            return Response.json(
              { error: "Impossible d'extraire des questions valides de ce PDF." },
              { status: 422 },
            );
          }

          const url = process.env["SUPABASE_URL"];
          const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
          if (url && serviceKey) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data: row, error: e2 } = await supabaseAdmin
              .from("lesson_quizzes")
              .insert({
                user_id: student.userId,
                title: parsed.data.title,
                qtype: parsed.data.qtype,
                questions: questions as unknown as import("@/integrations/supabase/types").Json,
              })
              .select("id")
              .single();
            if (e2) {
              return Response.json({ error: "Enregistrement impossible." }, { status: 500 });
            }
            return Response.json({
              id: row.id,
              count: questions.length,
              savedToServer: true,
              quota: quotaCheck.status,
            });
          }

          return Response.json({
            id: crypto.randomUUID(),
            title: parsed.data.title,
            qtype: parsed.data.qtype,
            count: questions.length,
            questions,
            savedToServer: false,
            quota: quotaCheck.status,
          });
        } catch (err) {
          const gErr = classifyGeminiError(err);
          const status = await getStudentQuotaStatus(student.userId, student.isCreator);
          return Response.json(
            { error: gErr.message, quota: status },
            { status: gErr.status },
          );
        }
      },
    },
  },
});
