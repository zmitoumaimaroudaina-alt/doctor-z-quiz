import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

export const GEMINI_MODEL = "gemini-4-hydrogen";

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey: string | undefined;

export function hasGeminiApiKey(): boolean {
  return Boolean(process.env["GEMINI_API_KEY"]?.trim());
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env["GEMINI_API_KEY"]?.trim();
  if (!apiKey) {
    throw new GeminiServiceError("Clé Gemini API non configurée sur le serveur.", 503);
  }
  if (!cachedClient || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return cachedClient;
}

export class GeminiServiceError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function classifyGeminiError(err: unknown): GeminiServiceError {
  if (err instanceof GeminiServiceError) return err;
  const msg = err instanceof Error ? err.message : String(err ?? "Erreur Gemini");
  const lower = msg.toLowerCase();
  if (lower.includes("429") || lower.includes("resource_exhausted") || lower.includes("quota")) {
    return new GeminiServiceError(
      "Le service Gemini est temporairement saturé. Réessaie dans un instant.",
      429,
    );
  }
  if (lower.includes("api_key_invalid") || lower.includes("permission_denied") || lower.includes("403")) {
    return new GeminiServiceError("Configuration Gemini API invalide ou accès refusé.", 403);
  }
  if (lower.includes("not_found") || lower.includes("404")) {
    return new GeminiServiceError("Modèle Gemini introuvable.", 404);
  }
  return new GeminiServiceError("Erreur lors de la génération avec Gemini.", 502);
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const classified = classifyGeminiError(err);
      if (classified.status === 400 || classified.status === 403 || classified.status === 404) {
        throw classified;
      }
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
  }
  throw classifyGeminiError(lastErr);
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

export async function streamMedicalExplanation(params: {
  systemInstruction: string;
  messages: ChatTurn[];
  signal?: AbortSignal;
}) {
  const ai = getGeminiClient();
  const contents = (
    params.messages.length
      ? params.messages
      : [{ role: "user" as const, content: "Explique-moi cette question." }]
  ).map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  try {
    return await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: params.systemInstruction,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        ...(params.signal ? { abortSignal: params.signal } : {}),
      },
    });
  } catch (err) {
    throw classifyGeminiError(err);
  }
}

export interface GeneratedQuizQuestion {
  stem: string;
  options: { key: string; text: string }[];
  correct: string[];
  explanation: string;
}

export async function generateQuizFromPdfBytes(params: {
  pdfBase64: string;
  qtype: "QCM" | "QCS";
  count: number;
}): Promise<GeneratedQuizQuestion[]> {
  const ai = getGeminiClient();
  const rule =
    params.qtype === "QCS"
      ? "exactement UNE seule bonne réponse correcte (ex: [\"A\"])"
      : "une ou plusieurs bonnes réponses correctes (ex: [\"A\", \"C\"])";

  const promptText = `Tu es professeur de médecine à l'Université de Blida 1.
À partir UNIQUEMENT de ce cours PDF de médecine, crée exactement ${params.count} questions ${params.qtype} en français, précises et fidèles au document.
Règles strictes :
- Chaque question doit contenir exactement 5 propositions avec les clés "A", "B", "C", "D", "E".
- Chaque question doit avoir ${rule}.
- N'invente aucune information absente du PDF.
- Fournis une explication courte et claire tirée directement du cours pour chaque question.`;

  const res = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: params.pdfBase64,
            },
          },
          { text: promptText },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stem: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        key: { type: Type.STRING },
                        text: { type: Type.STRING },
                      },
                      required: ["key", "text"],
                    },
                  },
                  correct: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  explanation: { type: Type.STRING },
                },
                required: ["stem", "options", "correct", "explanation"],
              },
            },
          },
          required: ["questions"],
        },
      },
    }),
  );

  const rawText = (res.text ?? "{}").trim();
  const parsed = JSON.parse(rawText) as { questions?: GeneratedQuizQuestion[] };
  return (parsed.questions ?? [])
    .slice(0, params.count)
    .map((q) => ({
      stem: String(q.stem ?? "").trim(),
      options: (q.options ?? []).map((o) => ({
        key: String(o.key ?? "").trim().toUpperCase().slice(0, 1),
        text: String(o.text ?? "").trim(),
      })),
      correct: (q.correct ?? [])
        .map((c) => String(c).trim().toUpperCase())
        .filter((c) => /^[A-E]$/.test(c)),
      explanation: String(q.explanation ?? "").trim(),
    }))
    .filter((q) => q.stem && q.options.length >= 2 && (params.qtype === "QCM" ? q.correct.length >= 1 : q.correct.length === 1));
}

export interface AuditedQuestionItem {
  id: string;
  has_issue: boolean;
  issue: string;
  stem: string | null;
  case_text: string | null;
  options: { key: string; text: string }[] | null;
  correct: string[] | null;
  justification: string;
  confidence: "haute" | "moyenne" | "faible";
}

export async function auditMedicalBatch(params: {
  prompt: string;
  batchJson: string;
}): Promise<AuditedQuestionItem[]> {
  const ai = getGeminiClient();
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `${params.prompt}\n\n${params.batchJson}`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  has_issue: { type: Type.BOOLEAN },
                  issue: { type: Type.STRING },
                  stem: { type: Type.STRING, nullable: true },
                  case_text: { type: Type.STRING, nullable: true },
                  options: {
                    type: Type.ARRAY,
                    nullable: true,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        key: { type: Type.STRING },
                        text: { type: Type.STRING },
                      },
                      required: ["key", "text"],
                    },
                  },
                  correct: {
                    type: Type.ARRAY,
                    nullable: true,
                    items: { type: Type.STRING },
                  },
                  justification: { type: Type.STRING },
                  confidence: { type: Type.STRING },
                },
                required: [
                  "id",
                  "has_issue",
                  "issue",
                  "stem",
                  "case_text",
                  "options",
                  "correct",
                  "justification",
                  "confidence",
                ],
              },
            },
          },
          required: ["items"],
        },
      },
    }),
  );

  const rawText = (res.text ?? "{}").trim();
  const parsed = JSON.parse(rawText) as { items?: AuditedQuestionItem[] };
  return parsed.items ?? [];
}
