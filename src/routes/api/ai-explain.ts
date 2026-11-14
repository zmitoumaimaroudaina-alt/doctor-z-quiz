import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";
import { z } from "zod";

const Body = z.object({
  questionId: z.string().min(1).max(160),
  selected: z.array(z.string().max(4)).max(10),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(20),
  question: z
    .object({
      id: z.string().optional(),
      stem: z.string(),
      case_text: z.string().nullable().optional(),
      options: z.array(z.object({ key: z.string(), text: z.string() })),
    })
    .optional(),
  official: z
    .object({
      correct: z.array(z.string()),
      explanation: z.string().nullable().optional(),
      note: z.string().nullable().optional(),
    })
    .optional(),
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
        const { questionId, selected, messages, question: bodyQ, official: bodyK } = parsed.data;

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
        const { readServerOverrides } = await import("@/lib/questionOverrides.server");

        const student = await authenticateStudentRequest(request);
        if (!student) {
          return new Response("Connexion requise.", { status: 401 });
        }

        const url = process.env["SUPABASE_URL"];
        const pub = process.env["SUPABASE_PUBLISHABLE_KEY"];

        let q: { stem: string; case_text: string | null; options: { key: string; text: string }[] } | null = null;
        let k: { correct: string[]; explanation: string | null; note: string | null } | null = null;

        if (bodyQ && bodyK) {
          q = {
            stem: bodyQ.stem,
            case_text: bodyQ.case_text ?? null,
            options: bodyQ.options,
          };
          k = {
            correct: bodyK.correct,
            explanation: bodyK.explanation ?? null,
            note: bodyK.note ?? null,
          };
        } else if (url && pub && /^[0-9a-f-]{36}$/i.test(questionId)) {
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
          try {
            const { loadSeedData } = await import("@/lib/seed-loader.server");
            const seed = await loadSeedData();
            const foundQ = seed.questions.find((x) => x.id === questionId);
            const foundK = seed.question_keys.find((x) => x.question_id === questionId);
            if (foundQ && foundK) {
              q = { stem: foundQ.stem, case_text: foundQ.case_text, options: foundQ.options };
              k = { correct: foundK.correct, explanation: foundK.explanation, note: foundK.note };
            }
          } catch {
            // fallback to bodyQ / bodyK below
          }
        }

        if (!q && bodyQ) {
          q = {
            stem: bodyQ.stem,
            case_text: bodyQ.case_text ?? null,
            options: bodyQ.options,
          };
        }
        if (!k && bodyK) {
          k = {
            correct: bodyK.correct,
            explanation: bodyK.explanation ?? null,
            note: bodyK.note ?? null,
          };
        }

        if (!q || !k) return new Response("Not found", { status: 404 });

        // Merge authoritative server-side creator override if present (ensures creator edits ALWAYS win when client didn't pass them or was stale)
        const serverOverrides = await readServerOverrides();
        const ovQ = serverOverrides.questions[questionId];
        const ovK = serverOverrides.keys[questionId];
        if (ovQ) {
          q = {
            stem: ovQ.stem ?? q.stem,
            case_text: ovQ.case_text !== undefined ? ovQ.case_text : q.case_text,
            options: ovQ.options ?? q.options,
          };
        }
        if (ovK && !bodyK) {
          k = {
            correct: ovK.correct && ovK.correct.length > 0 ? ovK.correct : k.correct,
            explanation: ovK.explanation !== undefined ? ovK.explanation : k.explanation,
            note: ovK.note !== undefined ? ovK.note : k.note,
          };
        } else if (ovK && bodyK && ovK.correct && ovK.correct.length > 0 && bodyK.correct.length === 0) {
          k = {
            correct: ovK.correct,
            explanation: ovK.explanation !== undefined ? ovK.explanation : k.explanation,
            note: ovK.note !== undefined ? ovK.note : k.note,
          };
        }

        const normalizedCorrect = [...new Set(k.correct.map((c) => c.trim().toUpperCase()))].sort();
        const normalizedSelected = [...new Set(selected.map((s) => s.trim().toUpperCase()))].sort();

        if (!hasGeminiApiKey()) {
          const officialText = normalizedCorrect.length ? normalizedCorrect.join(", ") : "non disponible";
          const selText = normalizedSelected.length ? normalizedSelected.join(", ") : "aucune réponse";
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

        const isInitial = messages.length === 0;
        const payloadHash = createHash("sha256")
          .update(
            JSON.stringify({
              questionId,
              selected: normalizedSelected,
              stem: q.stem,
              case_text: q.case_text,
              options: q.options,
              correct: normalizedCorrect,
              explanation: k.explanation ?? "",
              note: k.note ?? "",
            }),
          )
          .digest("hex")
          .slice(0, 24);
        const cacheKey = `v2:${questionId}:${payloadHash}`;
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

        const annotatedOptions = q.options
          .map((o) => {
            const keyUpper = o.key.trim().toUpperCase();
            const isTrue = normalizedCorrect.includes(keyUpper);
            const isChosen = normalizedSelected.includes(keyUpper);
            const verdictTag = isTrue
              ? "[✅ VRAIE — RÉPONSE OFFICIELLE RETENUE]"
              : "[❌ FAUSSE — OPTION EXCLUE]";
            const studentTag = isChosen ? " [👉 CHOIX DE L'ÉTUDIANT]" : "";
            return `${o.key}. ${o.text}  --> ${verdictTag}${studentTag}`;
          })
          .join("\n");

        const isCreatorModified = Boolean(ovK);
        const systemInstruction = `Tu es Dr Z-Bot, tuteur de médecine précis et rigoureux à la Faculté de Médecine de l'Université Saad Dahleb – Blida 1.

RÈGLES ABSOLUES ET NON NÉGOCIABLES :
1. FIDÉLITÉ STRICTE AU CORRIGÉ OFFICIEL : La clé officielle ci-dessous (${normalizedCorrect.join(", ") || "non disponible"}${isCreatorModified ? " — validée/corrigée par le créateur du module" : " — clé officielle de l'examen"}) est 100% DÉFINITIVE et FAIT FOI.
   - Ne contredis JAMAIS cette clé officielle.
   - Ne dis JAMAIS qu'une option marquée [❌ FAUSSE] pourrait être vraie, ni qu'une option marquée [✅ VRAIE] est fausse ou discutable.
   - Base toute ton explication physiopathologique et clinique sur la justification exacte de ces choix officiels (et sur l'explication/note de la source si fournie).
2. EXPLICATION PRÉCISE ET STRUCTURÉE (≤ 320 mots) :
   - Commence par confirmer clairement la réponse officielle [${normalizedCorrect.join(", ")}] et évaluer brièvement la réponse de l'étudiant [${normalizedSelected.join(", ") || "aucune"}].
   - Justifie avec précision médicale POURQUOI chaque proposition [✅ VRAIE] est exacte dans ce contexte précis.
   - Explique brièvement POURQUOI chaque proposition [❌ FAUSSE] est inexacte ou constitue un piège.
   - Ne recopie pas l'énoncé en entier ; reste direct, pédagogique et rigoureux.
3. LANGUE : Français médical précis (ou langue de la question de l'étudiant s'il écrit en arabe, tout en gardant les termes médicaux clairs).

${q.case_text ? `CAS CLINIQUE :\n${q.case_text}\n\n` : ""}QUESTION :
${q.stem}

OPTIONS ANNOTÉES SELON LA CLÉ OFFICIELLE :
${annotatedOptions}

RÉPONSE DE L'ÉTUDIANT : ${normalizedSelected.length ? normalizedSelected.join(", ") : "aucune réponse"}
RÉPONSE OFFICIELLE DÉFINITIVE : [${normalizedCorrect.join(", ") || "non disponible"}]
EXPLICATION OFFICIELLE / DU CRÉATEUR : ${k.explanation?.trim() || "aucune"}
NOTE PÉDAGOGIQUE : ${k.note?.trim() || "aucune"}
ORIGINE : Questions de la Faculté de Médecine de l’Université de Blida (ne cite aucun nom de fichier interne).`;

        const effectiveMessages =
          messages.length > 0
            ? messages
            : [
                {
                  role: "user" as const,
                  content: `Explique cette question en suivant strictement la réponse officielle [${normalizedCorrect.join(", ")}]. Justifie chaque option vraie et chaque option fausse.`,
                },
              ];

        try {
          const geminiStream = await streamMedicalExplanation({
            systemInstruction,
            messages: effectiveMessages,
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
