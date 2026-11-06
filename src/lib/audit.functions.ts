import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const opt = { type: "object", additionalProperties: false, required: ["key", "text"], properties: { key: { type: "string" }, text: { type: "string" } } };
const schema = {
  type: "object", additionalProperties: false, required: ["items"], properties: { items: { type: "array", items: {
    type: "object", additionalProperties: false,
    required: ["id", "has_issue", "issue", "stem", "case_text", "options", "correct", "justification", "confidence"],
    properties: {
      id: { type: "string" }, has_issue: { type: "boolean" }, issue: { type: "string" },
      stem: { type: ["string", "null"] }, case_text: { type: ["string", "null"] },
      options: { type: ["array", "null"], items: opt }, correct: { type: ["array", "null"], items: { type: "string" } },
      justification: { type: "string" }, confidence: { type: "string", enum: ["haute", "moyenne", "faible"] },
    } } } },
};
const PROMPT = `Tu es professeur de médecine (Faculté de Médecine de Blida). Audite chaque QCM ci-dessous (texte issu d'un OCR de PDF scannés).
Détecte: erreurs de transcription/OCR, texte coupé ou dupliqué, cas clinique (case_text) qui contient en réalité une AUTRE question ou ne correspond pas à l'énoncé, options mélangées, réponse officielle manquante ou scientifiquement fausse selon les références médicales actuelles.
Si tout est correct: has_issue=false et champs proposés à null. Sinon propose UNIQUEMENT les champs à corriger (null pour les autres), au plus près de l'original. Si le case_text appartient à une autre question, propose case_text="". Donne les lettres justes (A-E) dans correct seulement si tu es sûr. justification et issue en français, courtes.`;

type Item = { id: string; has_issue: boolean; issue: string; stem: string | null; case_text: string | null; options: { key: string; text: string }[] | null; correct: string[] | null; justification: string; confidence: string };

/** Creator-only: AI-audits the next batch of flagged / clinical-case questions and stores proposals (never applied automatically). */
export const auditNextBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: ok } = await sb.rpc("is_creator");
    if (!ok) throw new Error("Réservé au Creator");
    const { data: done } = await sb.from("question_corrections").select("question_id");
    const seen = new Set((done ?? []).map((d) => d.question_id));
    const { data: pool } = await sb.from("questions").select("id, case_text, stem, options, review_reason, question_keys(correct)")
      .or("needs_review.eq.true,case_text.neq.").order("subject_id").order("pos").limit(1000);
    const batch = (pool ?? []).filter((q) => !seen.has(q.id)).slice(0, 6);
    if (!batch.length) return { processed: 0, remaining: 0 };
    const { generateResponse } = await import("@lovable.dev/ai-gateway");
    const res = await generateResponse({
      model: "openai/gpt-6-astra",
      input: [{ role: "user", content: [{ type: "input_text", text: `${PROMPT}\n\n${JSON.stringify(batch.map((q) => ({
        id: q.id, case_text: q.case_text, stem: q.stem, options: q.options,
        reponse_officielle: (Array.isArray(q.question_keys) ? q.question_keys[0] : q.question_keys)?.correct ?? [], signalement: q.review_reason,
      })))}` }] }],
      text: { format: { type: "json_schema", name: "audit", strict: true, schema } },
    });
    const out = JSON.parse(JSON.stringify(res)) as { output_text?: string; output?: { content?: { text?: string }[] }[] };
    const text = out.output_text ?? (out.output ?? []).flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("");
    const items = (JSON.parse(text) as { items: Item[] }).items.filter((i) => batch.some((b) => b.id === i.id));
    const rows = items.map((i) => ({
      question_id: i.id, issue: i.has_issue ? i.issue : "Aucun problème détecté",
      proposed_stem: i.stem, proposed_case_text: i.case_text, proposed_options: i.options,
      proposed_correct: i.correct?.map((l) => l.toUpperCase()).filter((l) => /^[A-E]$/.test(l)) ?? null,
      justification: i.justification, confidence: i.confidence, status: i.has_issue ? "pending" : "rejected",
    }));
    const { error } = await sb.from("question_corrections").upsert(rows, { onConflict: "question_id" });
    if (error) throw new Error(error.message);
    return { processed: rows.length, remaining: (pool ?? []).filter((q) => !seen.has(q.id)).length - rows.length };
  });
