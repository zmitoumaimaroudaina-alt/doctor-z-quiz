import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const Body = z.object({
  questionId: z.string().uuid(),
  selected: z.array(z.string().max(2)).max(6),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(20),
});

export const Route = createFileRoute("/api/ai-explain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace("Bearer ", "");
        if (!token) return new Response("Unauthorized", { status: 401 });
        const url = process.env["SUPABASE_URL"]!;
        const pub = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const userClient = createClient(url, pub, { auth: { persistSession: false } });
        const { data: u } = await userClient.auth.getUser(token);
        if (!u.user) return new Response("Unauthorized", { status: 401 });

        const parsed = Body.safeParse(await request.json());
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const { questionId, selected, messages } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: q } = await supabaseAdmin.from("questions").select("stem, case_text, options").eq("id", questionId).single();
        const { data: k } = await supabaseAdmin.from("question_keys").select("correct, explanation, note").eq("question_id", questionId).single();
        if (!q || !k) return new Response("Not found", { status: 404 });

        const opts = (q.options as { key: string; text: string }[]).map((o) => `${o.key}. ${o.text}`).join("\n");
        const system = `Tu es Dr Z-Bot, tuteur de médecine pour des étudiants de 3e année (Faculté de Médecine de Blida 1).
RÈGLES ABSOLUES :
- La RÉPONSE OFFICIELLE ci-dessous est définitive. Ne la modifie jamais, ne la contredis jamais, ne suggère jamais qu'elle serait fausse.
- Explique pourquoi la réponse officielle est correcte et pourquoi le choix de l'étudiant ne l'est pas, de façon claire et concise (≤ 200 mots).
- Ne réécris pas la question ni les options.
- Réponds en français, tu peux ajouter une touche d'arabe dialectal algérien amicale.

${q.case_text ? `CAS CLINIQUE : ${q.case_text}\n` : ""}QUESTION : ${q.stem}
OPTIONS :
${opts}
RÉPONSE DE L'ÉTUDIANT : ${selected.length ? selected.join(", ") : "aucune réponse"}
RÉPONSE OFFICIELLE : ${k.correct.join(", ") || "non disponible"}
EXPLICATION DE LA SOURCE : ${k.explanation ?? "aucune"}
NOTE DE LA SOURCE : ${k.note ?? "aucune"}
ORIGINE : Questions de la Faculté de Médecine de l’Université de Blida.
Ne mentionne aucun nom de fichier ou de recueil.`;

        const input = [
          { role: "system", content: system },
          ...(messages.length ? messages : [{ role: "user" as const, content: "Explique-moi cette question." }]),
        ];
        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
            method: "POST",
            signal: request.signal,
            headers: { "Content-Type": "application/json", "Lovable-API-Key": process.env["LOVABLE_API_KEY"]!, "X-Lovable-AIG-SDK": "fetch" },
            body: JSON.stringify({
              model: "openai/gpt-6-astra", input, stream: true, store: false,
              reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
            }),
          });
          if (!res.ok) return new Response(await res.text(), { status: res.status });
          return new Response(res.body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
        } catch (e) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          throw e;
        }
      },
    },
  },
});
