import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  path: z.string().min(5).max(300),
  title: z.string().trim().min(1).max(120),
  qtype: z.enum(["QCM", "QCS"]),
  count: z.number().int().min(1).max(40),
});

export const generateLessonQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`${context.userId}/`) || !data.path.endsWith(".pdf")) {
      throw new Error("Fichier invalide");
    }
    const { consumeStudentQuota } = await import("@/lib/ai-quota.server");
    const { generateQuizFromPdfBytes } = await import("@/lib/gemini.server");
    const quota = await consumeStudentQuota({ userId: context.userId, kind: "pdf" });
    if (!quota.allowed) {
      throw new Error(`Limite quotidienne atteinte (${quota.status.pdf.limit} quiz PDF/jour).`);
    }

    const { data: file, error } = await context.supabase.storage.from("lesson-pdfs").download(data.path);
    if (error || !file) throw new Error("Fichier introuvable");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdfBase64 = Buffer.from(bytes).toString("base64");
    const { questions } = await generateQuizFromPdfBytes({
      pdfBase64,
      pdfBytes: bytes,
      qtype: data.qtype,
      count: data.count,
      title: data.title,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: e2 } = await supabaseAdmin
      .from("lesson_quizzes")
      .insert({
        user_id: context.userId,
        title: data.title,
        qtype: data.qtype,
        questions: questions as unknown as import("@/integrations/supabase/types").Json,
      })
      .select("id")
      .single();
    if (e2) throw new Error("Enregistrement impossible");
    return { id: row.id, count: questions.length };
  });
