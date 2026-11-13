import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  questionId: z.string().uuid(),
  selected: z.array(z.string().max(2)).max(6),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(20),
});

function sseEvent(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function streamLocalSse(text: string, quota?: unknown): Response {
  const chunks = [sseEvent({ type: "response.output_text.delta", delta: text })];
  if (quota) chunks.push(sseEvent({ type: "quota", quota }));
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return new Response(out, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/ai-explain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json());
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const { questionId, selected, messages } = parsed.data;

        const {
          authenticateStudentRequest,
          consumeStudentQuota,
          getCachedExplanation,
          setCachedExplanation,
        } = await import("@/lib/ai-quota.server");
        const {
          classifyGeminiError,
          hasGeminiApiKey,
          streamMedicalExplanation,
        } = await import("@/lib/gemini.server");

        const student = await authenticateStudentRequest(request);
        if (!student) {
          return new Response("Connexion requise.", { status: 401 });
        }

        const url = process.env["SUPABASE_URL"];
        const pub = process.env["SUPABASE_PUBLISHABLE_KEY"];

        let q: { stem: string; case_text: string | null; options: { key: string; text: string }[] } | null = null;
        let k: { correct: string[]; explanation: string | null; note: string | null } | null = null;

        if (url && pub) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const qRes = await supabaseAdmin
            .from("questions")
            .select("stem, case_text, options")
            .eq("id", questionId)
            .single();
          const kRes = await supabaseAdmin
            .from("question_keys")
            .select("correct, explanation, note")
            .eq("question_id", questionId)
            .single();
          if (qRes.data && kRes.data) {
            q = {
              stem: qRes.data.stem,
              case_text: qRes.data.case_text,
              options: qRes.data.options as { key: string; text: string }[],
            };
            k = {
              correct: kRes.data.correct,
              explanation: kRes.data.explanation,
              note: kRes.data.note,
            };
          }
        } else {
          const { loadSeedData } = await import("@/lib/seed-loader.server");
          const seed = await loadSeedData();
          const foundQ = seed.questions.find((x) => x.id === questionId);
          const foundK = seed.question_keys.find((x) => x.question_id === questionId);
          if (foundQ && foundK) {
            q = { stem: foundQ.stem, case_text: foundQ.case_text, options: foundQ.options };
            k = { correct: foundK.correct, explanation: foundK.explanation, note: foundK.note };
          }
        }

        if (!q || !k) return new Response("Not found", { status: 404 });

        if (!hasGeminiApiKey()) {
          const officialText = k.correct.length ? k.correct.join(", ") : "non disponible";
          const selText = selected.length ? selected.join(", ") : "aucune réponse";
          const parts = [
            `Réponse officielle : ${officialText} (ta réponse : ${selText}).`,
            k.explanation ? `Explication de la source : ${k.explanation}` : null,
            k.note ? `Note : ${k.note}` : null,
            !k.explanation && !k.note
              ? "Revois les propositions de l'énoncé et compare chaque item avec le cours de la Faculté de Médecine de Blida 1."
              : null,
          ].filter(Boolean);
          return streamLocalSse(parts.join("\n\n"));
        }

        const sortedSel = [...selected].sort().join(",") || "none";
        const isInitial = messages.length === 0;
        const cacheKey = `${questionId}:${sortedSel}`;
        const dedupeKey = isInitial ? `init:${cacheKey}` : undefined;

        const quotaCheck = await consumeStudentQuota({
          userId: student.userId,
          kind: "explain",
          isCreator: student.isCreator,
          ...(dedupeKey ? { dedupeKey } : {}),
        });

        if (!quotaCheck.allowed) {
          return new Response(
            `Limite quotidienne atteinte (${quotaCheck.status.explain.limit} explications IA/jour). Renouvellement demain à 00h.`,
            { status: 429 },
          );
        }

        if (isInitial) {
          const cached = await getCachedExplanation(cacheKey);
          if (cached) {
            return streamLocalSse(cached, quotaCheck.status);
          }
        }

        const opts = q.options.map((o) => `${o.key}. ${o.text}`).join("\n");
        const systemInstruction = `Tu es Dr Z-Bot, tuteur de médecine précis et rigoureux pour des étudiants de 3e année (Faculté de Médecine de Blida 1).
RÈGLES ABSOLUES :
- La RÉPONSE OFFICIELLE ci-dessous est définitive. Ne la modifie jamais, ne la contredis jamais, ne suggère jamais qu'elle serait fausse.
- Explique clairement la physiopathologie ou le mécanisme médical qui justifie chaque item vrai et pourquoi les autres items (ou le choix de l'étudiant) sont faux, de façon structurée et concise (≤ 220 mots).
- Ne réécris pas l'énoncé complet ni la liste brute des options.
- Réponds en français médical précis, avec éventuellement une courte touche chaleureuse d'arabe dialectal algérien.

${q.case_text ? `CAS CLINIQUE : ${q.case_text}\n` : ""}QUESTION : ${q.stem}
OPTIONS :
${opts}
RÉPONSE DE L'ÉTUDIANT : ${selected.length ? selected.join(", ") : "aucune réponse"}
RÉPONSE OFFICIELLE : ${k.correct.join(", ") || "non disponible"}
EXPLICATION DE LA SOURCE : ${k.explanation ?? "aucune"}
NOTE DE LA SOURCE : ${k.note ?? "aucune"}
ORIGINE : Questions de la Faculté de Médecine de l’Université de Blida.
Ne mentionne aucun nom de fichier ou de recueil.`;

        try {
          const geminiStream = await streamMedicalExplanation({
            systemInstruction,
            messages,
            signal: request.signal,
          });

          const stream = new ReadableStream({
            async start(controller) {
              let fullText = "";
              try {
                controller.enqueue(sseEvent({ type: "quota", quota: quotaCheck.status }));
                for await (const chunk of geminiStream) {
                  const delta = chunk.text ?? "";
                  if (delta) {
                    fullText += delta;
                    controller.enqueue(
                      sseEvent({ type: "response.output_text.delta", delta }),
                    );
                  }
                }
                if (isInitial && fullText.trim()) {
                  await setCachedExplanation(cacheKey, fullText);
                }
                controller.close();
              } catch (err) {
                if (!request.signal.aborted) {
                  const gErr = classifyGeminiError(err);
                  controller.enqueue(sseEvent({ type: "error", message: gErr.message }));
                }
                controller.close();
              }
            },
          });

          return new Response(stream, {
            headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
          });
        } catch (err) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          const gErr = classifyGeminiError(err);
          return new Response(gErr.message, { status: gErr.status });
        }
      },
    },
  },
});
