import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  path: z.string().min(5).max(300),
  title: z.string().trim().min(1).max(120),
  qtype: z.enum(["QCM", "QCS"]),
  count: z.number().int().min(1).max(40),
});
const Generated = z.object({
  questions: z.array(z.object({
    stem: z.string(), options: z.array(z.object({ key: z.string(), text: z.string() })).min(2),
    correct: z.array(z.string()).min(1), explanation: z.string(),
  })),
});

export const generateLessonQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`${context.userId}/`) || !data.path.endsWith(".pdf")) throw new Error("Fichier invalide");
    const { data: file, error } = await context.supabase.storage.from("lesson-pdfs").download(data.path);
    if (error || !file) throw new Error("Fichier introuvable");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = ""; for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
    const { generateResponse } = await import("@lovable.dev/ai-gateway");
    const rule = data.qtype === "QCS" ? "exactement UNE réponse correcte" : "une ou plusieurs réponses correctes";
    const res = await generateResponse({
      model: "openai/gpt-6-astra",
      input: [{ role: "user", content: [
        { type: "input_text", text: `Crée exactement ${data.count} questions ${data.qtype} en français à partir UNIQUEMENT de ce cours de médecine. Chaque question a 5 options A-E et ${rule}. N'utilise aucune information absente du document. Donne une courte explication tirée du cours.` },
        { type: "input_file", filename: "cours.pdf", file_data: `data:application/pdf;base64,${btoa(bin)}` },
      ] }],
      text: { format: { type: "json_schema", name: "quiz", strict: true, schema: {
        type: "object", additionalProperties: false, required: ["questions"], properties: { questions: { type: "array", items: {
          type: "object", additionalProperties: false, required: ["stem", "options", "correct", "explanation"], properties: {
            stem: { type: "string" }, explanation: { type: "string" }, correct: { type: "array", items: { type: "string" } },
            options: { type: "array", items: { type: "object", additionalProperties: false, required: ["key", "text"], properties: { key: { type: "string" }, text: { type: "string" } } } },
          } } } },
      } } },
    });
    const text = (res as { output_text?: string }).output_text
      ?? (res.output ?? []).flatMap((o) => ("content" in o && Array.isArray(o.content) ? o.content : [])).map((c) => ("text" in c ? String(c.text) : "")).join("");
    const parsed = Generated.parse(JSON.parse(text));
    const questions = parsed.questions.slice(0, data.count).filter((q) => data.qtype === "QCM" || q.correct.length === 1);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: e2 } = await supabaseAdmin.from("lesson_quizzes")
      .insert({ user_id: context.userId, title: data.title, qtype: data.qtype, questions }).select("id").single();
    if (e2) throw new Error("Enregistrement impossible");
    return { id: row.id, count: questions.length };
  });
