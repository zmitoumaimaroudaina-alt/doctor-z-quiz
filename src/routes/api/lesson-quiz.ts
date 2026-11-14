import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

const MetaSchema = z.object({
  title: z.string().trim().min(1).max(160),
  qtype: z.enum(["QCM", "QCS"]),
  count: z.coerce.number().int().min(1).max(40),
  courseUrl: z.string().trim().max(1500).optional(),
  notes: z.string().trim().max(40000).optional(),
});

function isSafePublicHttpUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.endsWith(".local")
    ) {
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

function extractGoogleDriveFileId(u: URL): string | null {
  const href = u.toString();
  const fileMatch = href.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (fileMatch?.[1]) return fileMatch[1];
  if (
    (u.hostname.includes("drive.google.com") || u.hostname.includes("drive.usercontent.google.com")) &&
    u.searchParams.get("id")
  ) {
    return u.searchParams.get("id");
  }
  return null;
}

function normalizeFetchCandidates(u: URL): string[] {
  const href = u.toString();
  const driveId = extractGoogleDriveFileId(u);
  if (driveId) {
    return [
      `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`,
      `https://drive.google.com/uc?export=download&confirm=t&id=${driveId}`,
    ];
  }
  const docsMatch = href.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/i);
  if (docsMatch?.[1]) {
    return [`https://docs.google.com/document/d/${docsMatch[1]}/export?format=pdf`];
  }
  const slidesMatch = href.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/i);
  if (slidesMatch?.[1]) {
    return [`https://docs.google.com/presentation/d/${slidesMatch[1]}/export/pdf`];
  }
  if (u.hostname.includes("dropbox.com")) {
    const copy = new URL(href);
    copy.searchParams.set("dl", "1");
    return [copy.toString()];
  }
  return [href];
}

function parseGoogleDriveConfirmUrl(html: string, baseUrl: string): string | null {
  // Match Drive virus-scan warning form: <form id="download-form" action="..." method="get">
  const formMatch = html.match(/<form[^>]*action=["']([^"']+)["'][^>]*>([\s\S]*?)<\/form>/i);
  if (formMatch?.[1]) {
    try {
      const actionUrl = new URL(formMatch[1].replace(/&amp;/g, "&"), baseUrl);
      const inputs = [...(formMatch[2] ?? "").matchAll(/<input[^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["'][^>]*>/gi)];
      for (const inp of inputs) {
        if (inp[1]) actionUrl.searchParams.set(inp[1], inp[2] ?? "");
      }
      if (actionUrl.searchParams.has("confirm") || actionUrl.searchParams.has("uuid")) {
        return actionUrl.toString();
      }
    } catch {
      // ignore invalid URL
    }
  }
  const linkMatch = html.match(/href=["']([^"']*confirm=[^"']+)["']/i);
  if (linkMatch?.[1]) {
    try {
      return new URL(linkMatch[1].replace(/&amp;/g, "&"), baseUrl).toString();
    } catch {
      return null;
    }
  }
  return null;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPdfHeader(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length - 5, 1024);
  for (let i = 0; i <= limit; i++) {
    if (
      bytes[i] === 0x25 && // %
      bytes[i + 1] === 0x50 && // P
      bytes[i + 2] === 0x44 && // D
      bytes[i + 3] === 0x46 && // F
      bytes[i + 4] === 0x2d // -
    ) {
      return true;
    }
  }
  return false;
}

function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

async function fetchWithTimeout(url: string) {
  return fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; DoctorZQuiz/1.0)",
      Accept: "application/pdf,image/*,text/html,text/plain;q=0.9,*/*;q=0.8",
    },
  });
}

async function fetchCourseSource(rawUrl: string): Promise<
  | { kind: "pdf"; bytes: Uint8Array }
  | { kind: "image"; bytes: Uint8Array; mimeType: string }
  | { kind: "text"; text: string }
  | { kind: "error"; message: string }
> {
  const parsedUrl = isSafePublicHttpUrl(rawUrl);
  if (!parsedUrl) {
    return { kind: "error", message: "الرابط غير صالح. يرجى إدخال رابط http:// أو https:// صحيح." };
  }

  const candidates = normalizeFetchCandidates(parsedUrl);
  let lastStatus = 0;

  for (const candidateUrl of candidates) {
    try {
      let res = await fetchWithTimeout(candidateUrl);
      lastStatus = res.status;
      if (!res.ok) continue;

      let arrayBuf = await res.arrayBuffer();
      if (arrayBuf.byteLength <= 0) continue;
      if (arrayBuf.byteLength > MAX_FILE_BYTES) {
        return { kind: "error", message: "حجم الملف يتجاوز 25 ميغابايت." };
      }

      let bytes = new Uint8Array(arrayBuf);
      let contentType = (res.headers.get("content-type") ?? "").toLowerCase();

      if (contentType.includes("application/pdf") || hasPdfHeader(bytes)) {
        return { kind: "pdf", bytes };
      }

      const imgMime = detectImageMime(bytes);
      if (imgMime) {
        return { kind: "image", bytes, mimeType: imgMime };
      }

      const rawText = new TextDecoder("utf-8", { fatal: false }).decode(bytes);

      // Handle Google Drive HTML virus-scan confirmation screen automatically
      if (contentType.includes("html") && /drive\.google\.com|googleusercontent\.com/i.test(candidateUrl)) {
        const confirmUrl = parseGoogleDriveConfirmUrl(rawText, res.url || candidateUrl);
        if (confirmUrl) {
          res = await fetchWithTimeout(confirmUrl);
          lastStatus = res.status;
          if (res.ok) {
            arrayBuf = await res.arrayBuffer();
            if (arrayBuf.byteLength > 0 && arrayBuf.byteLength <= MAX_FILE_BYTES) {
              bytes = new Uint8Array(arrayBuf);
              contentType = (res.headers.get("content-type") ?? "").toLowerCase();
              if (contentType.includes("application/pdf") || hasPdfHeader(bytes)) {
                return { kind: "pdf", bytes };
              }
            }
          }
        }
      }

      if (/accounts\.google\.com|ServiceLogin|you need access|request access/i.test(rawText)) {
        return {
          kind: "error",
          message:
            "رابط Google Drive خاص (مقفل). افتح إعدادات المشاركة واجعل الملف متاحاً لـ «أي شخص لديه الرابط» أو ارفع ملف PDF مباشرة.",
        };
      }

      const cleanText = contentType.includes("html") ? stripHtmlToText(rawText) : rawText.trim();
      if (cleanText.length >= 100 && !/google drive - virus scan/i.test(cleanText)) {
        return { kind: "text", text: cleanText };
      }
    } catch {
      // try next candidate
    }
  }

  if (lastStatus === 401 || lastStatus === 403) {
    return {
      kind: "error",
      message: "الوصول إلى الرابط مرفوض (403/401). تأكد أن الملف عام (Public) أو ارفع ملف PDF مباشرة.",
    };
  }
  if (lastStatus === 404) {
    return {
      kind: "error",
      message: "الرابط غير موجود (404). تحقق من صحة الرابط أو ارفع ملف PDF مباشرة.",
    };
  }
  return {
    kind: "error",
    message: "تعذر استخراج ملف PDF أو نص مباشر من هذا الرابط. جرب رفع ملف PDF مباشرة من جهازك.",
  };
}

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
          generateQuizFromContent,
          generateQuizFromImageBytes,
          generateQuizFromPdfBytes,
          hasGeminiApiKey,
        } = await import("@/lib/gemini.server");

        const student = await authenticateStudentRequest(request);
        if (!student) {
          return Response.json({ error: "يرجى تسجيل الدخول أولاً." }, { status: 401 });
        }

        if (!hasGeminiApiKey()) {
          return Response.json(
            { error: "مفتاح Gemini API غير مهيأ على الخادم." },
            { status: 503 },
          );
        }

        let fileEntry: File | null = null;
        let rawTitle = "";
        let rawQtype = "QCM";
        let rawCount: unknown = 5;
        let rawCourseUrl = "";
        let rawNotes = "";

        const reqContentType = request.headers.get("content-type") ?? "";
        if (reqContentType.includes("application/json")) {
          try {
            const body = (await request.json()) as Record<string, unknown>;
            rawTitle = String(body["title"] ?? "");
            rawQtype = String(body["qtype"] ?? "QCM");
            rawCount = body["count"] ?? 5;
            rawCourseUrl = String(body["courseUrl"] ?? "");
            rawNotes = String(body["notes"] ?? "");
          } catch {
            return Response.json({ error: "تنسيق الطلب غير صالح." }, { status: 400 });
          }
        } else {
          let form: FormData;
          try {
            form = await request.formData();
          } catch {
            return Response.json({ error: "تعذر قراءة بيانات الملف المرسل." }, { status: 400 });
          }
          const f = form.get("file");
          if (f instanceof File && f.size > 0) {
            fileEntry = f;
          }
          rawTitle = String(form.get("title") ?? "");
          rawQtype = String(form.get("qtype") ?? "QCM");
          rawCount = form.get("count") ?? 5;
          rawCourseUrl = String(form.get("courseUrl") ?? "");
          rawNotes = String(form.get("notes") ?? "");
        }

        const fallbackTitle =
          fileEntry?.name.replace(/\.(pdf|txt|md|png|jpe?g|webp)$/i, "") ||
          (rawCourseUrl ? rawCourseUrl.split("/").filter(Boolean).pop()?.slice(0, 80) : "") ||
          "Mon cours";

        const parsed = MetaSchema.safeParse({
          title: rawTitle.trim() || fallbackTitle,
          qtype: rawQtype || "QCM",
          count: rawCount || 5,
          courseUrl: rawCourseUrl || undefined,
          notes: rawNotes || undefined,
        });

        if (!parsed.success) {
          return Response.json({ error: "معطيات الطلب غير صالحة." }, { status: 400 });
        }

        if (fileEntry && fileEntry.size > MAX_FILE_BYTES) {
          return Response.json(
            { error: "حجم الملف يتجاوز 25 ميغابايت. اختر ملفاً أصغر." },
            { status: 400 },
          );
        }

        const hasUrl = Boolean(parsed.data.courseUrl);
        const hasNotes = Boolean(parsed.data.notes && parsed.data.notes.length >= 15);
        const hasTitle = Boolean(rawTitle.trim().length >= 3);
        if (!fileEntry && !hasUrl && !hasNotes && !hasTitle) {
          return Response.json(
            { error: "أضف ملف PDF، صورة درس، رابطاً عاماً أو مقتطفاً نصياً لتوليد الأسئلة." },
            { status: 400 },
          );
        }

        const preQuota = await getStudentQuotaStatus(student.userId, student.isCreator);
        if (!student.isCreator && preQuota.pdf.remaining <= 0) {
          return Response.json(
            {
              error: `بلغت الحد اليومي المحلي (${preQuota.pdf.limit} كويزات/يوم). يتجدد تلقائياً غداً منتصف الليل.`,
              errorCode: "DAILY_QUOTA_EXCEEDED",
              quota: preQuota,
            },
            { status: 429 },
          );
        }

        try {
          let questions: Awaited<ReturnType<typeof generateQuizFromContent>> = [];
          let usedSourceMode = "topic";

          if (fileEntry) {
            const bytes = new Uint8Array(await fileEntry.arrayBuffer());
            const lowerName = fileEntry.name.toLowerCase();
            const isTextFile =
              fileEntry.type.startsWith("text/") ||
              lowerName.endsWith(".txt") ||
              lowerName.endsWith(".md") ||
              lowerName.endsWith(".csv");
            const imgMime =
              detectImageMime(bytes) ||
              (fileEntry.type.startsWith("image/") ? fileEntry.type : null);

            if (hasPdfHeader(bytes) || fileEntry.type === "application/pdf" || lowerName.endsWith(".pdf")) {
              if (!hasPdfHeader(bytes)) {
                return Response.json(
                  {
                    error: "هذا الملف لا يبدو بصيغة PDF صالحة (قد يكون تالفاً أو بصيغة Word/PowerPoint). احفظه كـ PDF حقيقي أو انسخ نصه.",
                    errorCode: "UNREADABLE_SOURCE",
                  },
                  { status: 422 },
                );
              }
              const res = await generateQuizFromPdfBytes({
                pdfBytes: bytes,
                qtype: parsed.data.qtype,
                count: parsed.data.count,
                title: parsed.data.title,
                ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
              });
              questions = res.questions;
              usedSourceMode = res.method;
            } else if (imgMime) {
              questions = await generateQuizFromImageBytes({
                base64: Buffer.from(bytes).toString("base64"),
                mimeType: imgMime,
                qtype: parsed.data.qtype,
                count: parsed.data.count,
                title: parsed.data.title,
                ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
              });
              usedSourceMode = "image";
            } else if (isTextFile) {
              const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
              if (text.length < 40) {
                return Response.json(
                  { error: "الملف النصي قصير جداً أو فارغ.", errorCode: "UNREADABLE_SOURCE" },
                  { status: 422 },
                );
              }
              questions = await generateQuizFromContent({
                contentText: text,
                title: parsed.data.title,
                ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
                qtype: parsed.data.qtype,
                count: parsed.data.count,
              });
              usedSourceMode = "text-file";
            } else {
              return Response.json(
                {
                  error: "صيغة الملف غير مدعومة. الصيغ المدعومة: PDF، صور (PNG/JPG/WEBP)، أو ملفات نصية (.txt/.md).",
                  errorCode: "UNREADABLE_SOURCE",
                },
                { status: 400 },
              );
            }
          } else if (parsed.data.courseUrl) {
            const fetched = await fetchCourseSource(parsed.data.courseUrl);
            if (fetched.kind === "pdf") {
              const res = await generateQuizFromPdfBytes({
                pdfBytes: fetched.bytes,
                qtype: parsed.data.qtype,
                count: parsed.data.count,
                title: parsed.data.title,
                ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
              });
              questions = res.questions;
              usedSourceMode = res.method === "pdf-text" ? "url-pdf" : "pdf-ocr";
            } else if (fetched.kind === "image") {
              questions = await generateQuizFromImageBytes({
                base64: Buffer.from(fetched.bytes).toString("base64"),
                mimeType: fetched.mimeType,
                qtype: parsed.data.qtype,
                count: parsed.data.count,
                title: parsed.data.title,
                ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
              });
              usedSourceMode = "image";
            } else if (fetched.kind === "text") {
              questions = await generateQuizFromContent({
                contentText: fetched.text,
                title: parsed.data.title,
                sourceUrl: parsed.data.courseUrl,
                ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
                qtype: parsed.data.qtype,
                count: parsed.data.count,
              });
              usedSourceMode = "url-text";
            } else if (hasNotes) {
              questions = await generateQuizFromContent({
                contentText: parsed.data.notes!,
                title: parsed.data.title,
                sourceUrl: parsed.data.courseUrl,
                qtype: parsed.data.qtype,
                count: parsed.data.count,
              });
              usedSourceMode = "notes-fallback";
            } else {
              return Response.json(
                { error: fetched.message, errorCode: "UNREADABLE_SOURCE" },
                { status: 422 },
              );
            }
          } else {
            questions = await generateQuizFromContent({
              contentText: parsed.data.notes || parsed.data.title,
              title: parsed.data.title,
              ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
              qtype: parsed.data.qtype,
              count: parsed.data.count,
            });
          }

          if (!questions.length) {
            return Response.json(
              {
                error:
                  "لم يتمكن الذكاء الاصطناعي من استخراج أسئلة من هذا الملف (قد يكون عبارة عن صور بدون نص واضح أو محمياً). جرب لصق جزء من نص الدرس.",
                errorCode: "UNREADABLE_SOURCE",
              },
              { status: 422 },
            );
          }

          const quotaCheck = await consumeStudentQuota({
            userId: student.userId,
            kind: "pdf",
            isCreator: student.isCreator,
          });

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
              title: parsed.data.title,
              qtype: parsed.data.qtype,
              count: questions.length,
              questions,
              usedSourceMode,
              savedToServer: true,
              quota: quotaCheck.status,
            });
          }

          return Response.json({
            id: `quiz-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
            title: parsed.data.title,
            qtype: parsed.data.qtype,
            count: questions.length,
            questions,
            usedSourceMode,
            savedToServer: false,
            quota: quotaCheck.status,
          });
        } catch (err) {
          const gErr = classifyGeminiError(err);
          const status = await getStudentQuotaStatus(student.userId, student.isCreator);
          return Response.json(
            { error: gErr.message, errorCode: gErr.code, quota: status },
            { status: gErr.status },
          );
        }
      },
    },
  },
});
