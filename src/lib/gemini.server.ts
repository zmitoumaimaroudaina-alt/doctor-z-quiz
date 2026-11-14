import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

export const GEMINI_MODEL = "gemini-4-hydrogen";
export const GEMINI_FALLBACK_MODEL = "gemini-3.1-flash-lite";
const FREE_TEXT_MODELS = [GEMINI_MODEL, GEMINI_FALLBACK_MODEL] as const;

let cachedClient: GoogleGenAI | null = null;
let cachedApiKey: string | undefined;

export function hasGeminiApiKey(): boolean {
  return Boolean(process.env["GEMINI_API_KEY"]?.trim());
}

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env["GEMINI_API_KEY"]?.trim();
  if (!apiKey) {
    throw new GeminiServiceError("Clé Gemini API non configurée sur le serveur.", 503, "NO_API_KEY");
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
  code: string;
  constructor(message: string, status = 500, code = "GEMINI_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getRawErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err ?? "Erreur Gemini");
  }
}

export function classifyGeminiError(err: unknown): GeminiServiceError {
  if (err instanceof GeminiServiceError) return err;
  const msg = getRawErrorMessage(err);
  const lower = msg.toLowerCase();

  if (
    lower.includes("429") ||
    lower.includes("resource_exhausted") ||
    lower.includes("rate limit") ||
    lower.includes("quota") ||
    lower.includes("too many requests")
  ) {
    return new GeminiServiceError(
      "خدمة Gemini مزدحمة مؤقتاً (حد الطلبات المجاني لمفتاح API). انتظر 20-30 ثانية ثم أعد المحاولة، أو تحقق من رصيد المفتاح في Settings > Secrets.",
      429,
      "GEMINI_RATE_LIMIT",
    );
  }
  if (lower.includes("api_key_invalid") || lower.includes("permission_denied") || lower.includes("403")) {
    return new GeminiServiceError(
      "مفتاح Gemini API غير صالح أو مرفوض الصلاحية. يرجى التحقق منه في Settings > Secrets.",
      403,
      "GEMINI_AUTH_ERROR",
    );
  }
  if (lower.includes("not_found") || lower.includes("404")) {
    return new GeminiServiceError("نموذج Gemini المطلوب غير متاح حالياً.", 404, "GEMINI_NOT_FOUND");
  }
  if (
    lower.includes("invalid_argument") ||
    lower.includes("unable to process") ||
    lower.includes("no pages") ||
    lower.includes("request payload size exceeds") ||
    lower.includes("token count exceeds")
  ) {
    return new GeminiServiceError(
      "تعذر على الذكاء الاصطناعي قراءة هذا الملف بشكله الحالي (قد يكون كبير الحجم جداً أو مشفراً). جرّب لصق نص الدرس أو تقسيم الملف.",
      422,
      "UNREADABLE_SOURCE",
    );
  }
  if (lower.includes("timeout") || lower.includes("aborted") || lower.includes("deadline")) {
    return new GeminiServiceError(
      "استغرقت قراءة الملف وقتاً طويلاً (Timeout). جرّب ملفاً أصغر أو الصق النص المهم من الدرس.",
      504,
      "GEMINI_TIMEOUT",
    );
  }
  return new GeminiServiceError(
    "حدث خطأ مؤقت أثناء التواصل مع خدمة الذكاء الاصطناعي. أعد المحاولة بعد قليل.",
    502,
    "GEMINI_UPSTREAM_ERROR",
  );
}

async function runWithModelFallback<T>(
  label: string,
  runner: (model: string) => Promise<T>,
  models: readonly string[] = FREE_TEXT_MODELS,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < models.length; i++) {
    const model = models[i]!;
    try {
      return await runner(model);
    } catch (err) {
      lastErr = err;
      const classified = classifyGeminiError(err);
      const rawMsg = getRawErrorMessage(err).slice(0, 320);
      console.error(`[gemini-error] ${label} model=${model} status=${classified.status}: ${rawMsg}`);

      // Never retry auth errors or malformed input errors
      if (classified.status === 400 || classified.status === 403) {
        throw classified;
      }

      // If more fallback models remain, wait briefly and try the next model
      if (i < models.length - 1) {
        await new Promise((r) => setTimeout(r, classified.status === 429 ? 900 : 400));
        continue;
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

  return runWithModelFallback("explain-stream", async (model) => {
    return await ai.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction: params.systemInstruction,
        ...(model === GEMINI_MODEL ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
        ...(params.signal ? { abortSignal: params.signal } : {}),
      },
    });
  });
}

export interface GeneratedQuizQuestion {
  stem: string;
  options: { key: string; text: string }[];
  correct: string[];
  explanation: string;
}

const QUIZ_RESPONSE_SCHEMA = {
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
};

function extractJsonObjectText(rawText: string): string {
  const trimmed = rawText.trim();
  const withoutFences = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (withoutFences.startsWith("{")) return withoutFences;
  const firstBrace = withoutFences.indexOf("{");
  const lastBrace = withoutFences.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return withoutFences.slice(firstBrace, lastBrace + 1);
  }
  return "{}";
}

function normalizeGeneratedQuestions(
  rawText: string,
  qtype: "QCM" | "QCS",
  count: number,
): GeneratedQuizQuestion[] {
  let parsed: { questions?: GeneratedQuizQuestion[] } = {};
  try {
    parsed = JSON.parse(extractJsonObjectText(rawText)) as {
      questions?: GeneratedQuizQuestion[];
    };
  } catch {
    return [];
  }

  const FALLBACK_KEYS = ["A", "B", "C", "D", "E"];

  return (parsed.questions ?? [])
    .slice(0, count)
    .map((q) => {
      const rawOptions = Array.isArray(q.options) ? q.options : [];
      const options = rawOptions
        .slice(0, 5)
        .map((o, idx) => {
          const matchedKey = String(o?.key ?? "")
            .toUpperCase()
            .match(/[A-E]/)?.[0];
          const text = String(o?.text ?? "").trim();
          return {
            key: matchedKey || FALLBACK_KEYS[idx] || String(idx + 1),
            text,
          };
        })
        .filter((o) => o.text.length > 0);

      const validOptionKeys = new Set(options.map((o) => o.key));
      const rawCorrect = Array.isArray(q.correct) ? q.correct : [String(q.correct ?? "")];
      const extractedLetters: string[] = [];
      for (const item of rawCorrect) {
        const matches = String(item ?? "")
          .toUpperCase()
          .match(/[A-E]/g);
        if (matches) {
          for (const letter of matches) {
            if (validOptionKeys.has(letter) && !extractedLetters.includes(letter)) {
              extractedLetters.push(letter);
            }
          }
        }
      }

      const normalizedCorrect =
        qtype === "QCS" && extractedLetters.length > 1
          ? [extractedLetters[0]!]
          : extractedLetters;

      return {
        stem: String(q.stem ?? "").trim(),
        options,
        correct: normalizedCorrect,
        explanation:
          String(q.explanation ?? "").trim() ||
          "Explication basée sur le contenu du document fourni.",
      };
    })
    .filter((q) => q.stem.length >= 6 && q.options.length >= 2 && q.correct.length >= 1);
}

export async function extractPdfTextLocally(bytes: Uint8Array): Promise<string> {
  try {
    const { extractText } = await import("unpdf");
    const result = await extractText(new Uint8Array(bytes), { mergePages: true });
    const raw = Array.isArray(result.text) ? result.text.join("\n") : String(result.text ?? "");
    return raw
      .split("\0")
      .join(" ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch (err) {
    console.warn("[pdf-extract] Local PDF extraction failed, will use multimodal fallback:", getRawErrorMessage(err));
    return "";
  }
}

export async function generateQuizFromPdfBytes(params: {
  pdfBase64?: string;
  pdfBytes?: Uint8Array;
  qtype: "QCM" | "QCS";
  count: number;
  title?: string;
  notes?: string;
}): Promise<{ questions: GeneratedQuizQuestion[]; method: "pdf-text" | "pdf-ocr" }> {
  const bytes =
    params.pdfBytes ??
    (params.pdfBase64 ? new Uint8Array(Buffer.from(params.pdfBase64, "base64")) : new Uint8Array());

  if (bytes.byteLength === 0) {
    throw new GeminiServiceError("ملف PDF فارغ أو تالف.", 422, "UNREADABLE_SOURCE");
  }

  // 1. Fast & low-token local text extraction first (works cleanly even for 20MB+ multi-page PDFs)
  const extractedText = await extractPdfTextLocally(bytes);
  const meaningfulChars = extractedText.replace(/\s+/g, "").length;
  if (meaningfulChars >= 150) {
    const questions = await generateQuizFromContent({
      contentText: extractedText,
      ...(params.title ? { title: params.title } : {}),
      ...(params.notes ? { notes: params.notes } : {}),
      qtype: params.qtype,
      count: params.count,
    });
    if (questions.length > 0) {
      return { questions, method: "pdf-text" };
    }
  }

  // 2. Multimodal fallback for scanned / image-based PDFs
  const ai = getGeminiClient();
  const rule =
    params.qtype === "QCS"
      ? 'exactement UNE seule bonne réponse correcte (ex: ["A"])'
      : 'une ou plusieurs bonnes réponses correctes (ex: ["A", "C"])';

  const focusNote = params.notes?.trim()
    ? `\nConsignes / points clés demandés par l'étudiant : ${params.notes.trim()}`
    : "";

  const promptText = `Tu es professeur de médecine à l'Université de Blida 1.
Lis attentivement les pages (texte et images/schémas scannés) de ce cours PDF de médecine${params.title ? ` ("${params.title}")` : ""}, puis crée exactement ${params.count} questions ${params.qtype} originales, précises et fidèles au document.
Règles strictes :
- Chaque question doit tester un concept concret et spécifique tiré directement du PDF fourni.
- Chaque question doit contenir exactement 5 propositions avec les clés "A", "B", "C", "D", "E".
- Chaque question doit avoir ${rule}.
- Fournis une explication courte et précise tirée directement du cours pour chaque question.${focusNote}`;

  // Use Files API for large scanned PDFs (> 8 MB), inlineData for smaller scanned PDFs
  if (bytes.byteLength > 8 * 1024 * 1024) {
    let uploadedName: string | undefined;
    try {
      const uploaded = await ai.files.upload({
        file: new Blob([bytes], { type: "application/pdf" }),
        config: { mimeType: "application/pdf" },
      });
      uploadedName = uploaded.name;

      const res = await runWithModelFallback("pdf-files-api", (model) =>
        ai.models.generateContent({
          model,
          contents: [
            ...(uploaded.uri
              ? [{ fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType ?? "application/pdf" } }]
              : []),
            { text: promptText },
          ],
          config: {
            ...(model === GEMINI_MODEL ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
            responseMimeType: "application/json",
            responseSchema: QUIZ_RESPONSE_SCHEMA,
            abortSignal: AbortSignal.timeout(55000),
          },
        }),
      );
      return {
        questions: normalizeGeneratedQuestions((res.text ?? "{}").trim(), params.qtype, params.count),
        method: "pdf-ocr",
      };
    } finally {
      if (uploadedName) {
        await ai.files.delete({ name: uploadedName }).catch(() => {});
      }
    }
  }

  const pdfBase64 = params.pdfBase64 ?? Buffer.from(bytes).toString("base64");
  const res = await runWithModelFallback("pdf-inline", (model) =>
    ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
          { text: promptText },
        ],
      },
      config: {
        ...(model === GEMINI_MODEL ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
        responseMimeType: "application/json",
        responseSchema: QUIZ_RESPONSE_SCHEMA,
        abortSignal: AbortSignal.timeout(55000),
      },
    }),
  );

  return {
    questions: normalizeGeneratedQuestions((res.text ?? "{}").trim(), params.qtype, params.count),
    method: "pdf-ocr",
  };
}

export async function generateQuizFromImageBytes(params: {
  base64: string;
  mimeType: string;
  qtype: "QCM" | "QCS";
  count: number;
  title?: string;
  notes?: string;
}): Promise<GeneratedQuizQuestion[]> {
  const ai = getGeminiClient();
  const rule =
    params.qtype === "QCS"
      ? 'exactement UNE seule bonne réponse correcte (ex: ["A"])'
      : 'une ou plusieurs bonnes réponses correctes (ex: ["A", "C"])';

  const promptText = `Tu es professeur de médecine à l'Université de Blida 1.
Lis tout le texte et les schémas médicaux présents dans cette image de cours${params.title ? ` ("${params.title}")` : ""} et génère exactement ${params.count} questions ${params.qtype} fidèles à son contenu.
Règles strictes :
- Chaque question doit contenir 5 propositions ("A", "B", "C", "D", "E") et ${rule}.
- Fournis une explication médicale claire pour chaque question.
${params.notes?.trim() ? `Notes complémentaires : ${params.notes.trim()}` : ""}`;

  const res = await runWithModelFallback("image-quiz", (model) =>
    ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: params.mimeType,
              data: params.base64,
            },
          },
          { text: promptText },
        ],
      },
      config: {
        ...(model === GEMINI_MODEL ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
        responseMimeType: "application/json",
        responseSchema: QUIZ_RESPONSE_SCHEMA,
        abortSignal: AbortSignal.timeout(45000),
      },
    }),
  );

  return normalizeGeneratedQuestions((res.text ?? "{}").trim(), params.qtype, params.count);
}

export async function generateQuizFromContent(params: {
  contentText: string;
  title?: string;
  sourceUrl?: string;
  notes?: string;
  qtype: "QCM" | "QCS";
  count: number;
}): Promise<GeneratedQuizQuestion[]> {
  const ai = getGeminiClient();
  const rule =
    params.qtype === "QCS"
      ? 'exactement UNE seule bonne réponse correcte (ex: ["A"])'
      : 'une ou plusieurs bonnes réponses correctes (ex: ["A", "C"])';

  const clippedContent = params.contentText.slice(0, 75000);
  const promptText = `Tu es professeur de médecine à l'Université Saad Dahleb – Blida 1.
Génère exactement ${params.count} questions médicales ${params.qtype} uniques et pointues à partir du contenu de cours ci-dessous.

Règles strictes :
- Chaque question doit porter sur un fait médical, mécanisme, critère diagnostique, valeur seuil ou traitement précis du contenu fourni. Interdiction absolue de générer des questions génériques ou répétitives.
- Chaque question doit contenir exactement 5 propositions avec les clés "A", "B", "C", "D", "E".
- Chaque question doit avoir ${rule}.
- Fournis une explication médicale claire justifiant les propositions vraies et les pièges pour chaque question.

Titre du cours : ${params.title || "Cours de médecine"}
${params.sourceUrl ? `Lien source : ${params.sourceUrl}\n` : ""}${params.notes ? `Points clés à couvrir : ${params.notes}\n` : ""}
CONTENU DU COURS :
${clippedContent}`;

  const res = await runWithModelFallback("content-quiz", (model) =>
    ai.models.generateContent({
      model,
      contents: promptText,
      config: {
        ...(model === GEMINI_MODEL ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
        responseMimeType: "application/json",
        responseSchema: QUIZ_RESPONSE_SCHEMA,
        abortSignal: AbortSignal.timeout(45000),
      },
    }),
  );

  return normalizeGeneratedQuestions((res.text ?? "{}").trim(), params.qtype, params.count);
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
  const res = await runWithModelFallback("audit-batch", (model) =>
    ai.models.generateContent({
      model,
      contents: `${params.prompt}\n\n${params.batchJson}`,
      config: {
        ...(model === GEMINI_MODEL ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } } : {}),
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
  const parsed = JSON.parse(extractJsonObjectText(rawText)) as { items?: AuditedQuestionItem[] };
  return parsed.items ?? [];
}
