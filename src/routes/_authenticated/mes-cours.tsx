import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getClientAuthToken } from "@/lib/authToken";
import { pageMetadata } from "@/lib/metadata";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/mes-cours")({
  head: () =>
    pageMetadata(
      "Mes cours & Quiz IA",
      "Ajoutez un cours par lien URL ou fichier et générez des QCM/QCS d'entraînement personnalisés.",
    ),
  component: MyLessons,
});

export type LessonQuestion = {
  stem: string;
  options: { key: string; text: string }[];
  correct: string[];
  explanation: string;
};

export type SavedQuiz = {
  id: string;
  title: string;
  sourceUrl?: string;
  sourceName?: string;
  sourceMode?: string;
  qtype: "QCM" | "QCS";
  questions: LessonQuestion[];
  created_at: string;
};

const STORAGE_KEY = "doctorz_lesson_quizzes_v3";

const PRESET_TOPICS = [
  {
    title: "Cardiologie · Insuffisance Cardiaque Aiguë et Chronique",
    url: "",
    notes:
      "Critères de Framingham, élévation du BNP/NT-proBNP, classification fonctionnelle NYHA I à IV, dyspnée d'effort puis orthopnée, bêta-bloquants (bisoprolol, carvédilol), IEC/ARA2, antagonistes des récepteurs aux minéralocorticoïdes et diurétiques de l'anse dans la congestion.",
  },
  {
    title: "Endocrinologie · Diabète de Type 2 et Complications",
    url: "",
    notes:
      "Seuils diagnostiques : glycémie à jeun >= 1.26 g/L (7 mmol/L) à 2 reprises ou HbA1c >= 6.5%. Metformine en première intention (contre-indiquée si DFG < 30 mL/min). Complications microangiopathiques (rétinopathie, néphropathie glomérulaire, neuropathie) et macroangiopathiques.",
  },
  {
    title: "Pneumologie · Asthme et BPCO",
    url: "",
    notes:
      "Trouble ventilatoire obstructif (VEMS/CVF < 0.70). Asthme : réversibilité significative après bêta-2 mimétiques (+12% et +200 mL), corticoïdes inhalés en traitement de fond. BPCO : obstruction peu ou pas réversible liée au tabagisme, classification GOLD, sevrage tabagique prioritaire.",
  },
];

function sourceLabel(mode?: string): string {
  switch (mode) {
    case "pdf":
    case "pdf-text":
      return "📄 نص مستخرج من PDF";
    case "pdf-ocr":
      return "📄 قراءة PDF مصوّر (OCR)";
    case "image":
      return "🖼️ صورة درس";
    case "text-file":
      return "📃 ملف نصي";
    case "url-pdf":
      return "🔗 ملف PDF من الرابط";
    case "url-text":
      return "🌐 محتوى من الرابط";
    case "notes-fallback":
      return "📝 ملخص الدرس";
    default:
      return "🤖 ذكاء اصطناعي";
  }
}

export function MyLessons() {
  const [quizzes, setQuizzes] = useState<SavedQuiz[]>([]);
  const [courseUrl, setCourseUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [qtype, setQtype] = useState<"QCM" | "QCS">("QCM");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load quizzes from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setQuizzes(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
  }, []);

  function saveQuizzes(list: SavedQuiz[]) {
    setQuizzes(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
  }

  function handleSelectPreset(preset: (typeof PRESET_TOPICS)[number]) {
    play("click");
    setErrorMsg(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setTitle(preset.title);
    setCourseUrl(preset.url);
    setNotes(preset.notes);
    toast.info("تم ملء معلومات الدرس المقترح! اضغط على توليد الأسئلة.");
  }

  async function handleCreateQuiz() {
    setErrorMsg(null);
    const hasInput =
      Boolean(selectedFile) ||
      Boolean(courseUrl.trim()) ||
      Boolean(title.trim()) ||
      Boolean(notes.trim());

    if (!hasInput) {
      toast.error("يرجى رفع ملف PDF، أو وضع رابط الملف، أو إدخال عنوان/نص الدرس !");
      return;
    }

    setBusy(true);
    play("click");

    try {
      const token = await getClientAuthToken();
      if (!token) {
        throw new Error("يرجى تسجيل الدخول أولاً لاستعمال مولّد الكويزات بالذكاء الاصطناعي.");
      }

      const formData = new FormData();
      if (selectedFile) {
        formData.append("file", selectedFile);
      }
      const fallbackTitle =
        title.trim() ||
        selectedFile?.name.replace(/\.(pdf|txt|md|csv|png|jpe?g|webp)$/i, "") ||
        (courseUrl.trim() ? `Cours : ${courseUrl.trim().split("/").filter(Boolean).pop() ?? "PDF"}` : "Quiz de Révision");

      formData.append("title", fallbackTitle);
      formData.append("qtype", qtype);
      formData.append("count", String(count));
      if (courseUrl.trim()) formData.append("courseUrl", courseUrl.trim());
      if (notes.trim()) formData.append("notes", notes.trim());

      const res = await fetch("/api/lesson-quiz", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        title?: string;
        qtype?: "QCM" | "QCS";
        questions?: LessonQuestion[];
        usedSourceMode?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || `فشل توليد الأسئلة (${res.status})`);
      }

      const generated = Array.isArray(data.questions) ? data.questions : [];
      if (!generated.length) {
        throw new Error("لم يتمكن الذكاء الاصطناعي من استخراج أسئلة من هذا الملف.");
      }

      const cleanUrl = courseUrl.trim();
      const newQuiz: SavedQuiz = {
        id: data.id || `quiz-${Date.now()}`,
        title: data.title || fallbackTitle,
        ...(cleanUrl ? { sourceUrl: cleanUrl } : {}),
        ...(selectedFile ? { sourceName: selectedFile.name } : {}),
        ...(data.usedSourceMode ? { sourceMode: data.usedSourceMode } : {}),
        qtype: data.qtype || qtype,
        questions: generated,
        created_at: new Date().toISOString(),
      };

      const updated = [newQuiz, ...quizzes];
      saveQuizzes(updated);

      play("reward");
      toast.success(`🎉 تم توليد ${generated.length} أسئلة من محتوى الدرس بنجاح !`);

      // Reset fields
      setTitle("");
      setCourseUrl("");
      setNotes("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      const message = err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء توليد الكويز.";
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  function handleDeleteQuiz(id: string) {
    play("click");
    const updated = quizzes.filter((q) => q.id !== id);
    saveQuizzes(updated);
    toast.success("تم حذف الكويز بنجاح.");
  }

  return (
    <AppShell>
      <PageTitle
        title="📄 Mes cours & Quiz IA"
        ar="كويزات من دروسك برابط أو ملف"
        sub="ارفع ملف PDF أو ضع رابط الدرس (Google Drive عام أو رابط PDF مباشر) ليقرأه الذكاء الاصطناعي ويولّد أسئلة QCM حقيقية من محتواه."
      />

      {/* Preset Suggestions */}
      <div className="card-game mb-5 p-4 border border-primary/20 bg-primary/5">
        <span className="text-xs font-bold text-primary uppercase tracking-wider block mb-2">
          ⚡ دروس مقترحة بنقرة واحدة للتجربة السريعة :
        </span>
        <div className="flex flex-wrap gap-2">
          {PRESET_TOPICS.map((p) => (
            <button
              key={p.title}
              type="button"
              onClick={() => handleSelectPreset(p)}
              className="rounded-xl border border-primary/30 bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-primary-soft transition-all active:scale-95 text-left"
            >
              📖 {p.title.split("·")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Generation Form */}
      <section className="card-game space-y-4 p-5 shadow-sm border border-border/80">
        {/* PDF File Upload */}
        <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-4">
          <label className="block text-xs font-bold text-foreground mb-1.5">
            📎 رفع ملف الدرس من جهازك (PDF، صورة صفحة، أو ملف نصي — حتى 25 Mo)
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf,.txt,.md,.csv,text/plain,image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setSelectedFile(file);
                setErrorMsg(null);
                if (file && !title.trim()) {
                  setTitle(file.name.replace(/\.(pdf|txt|md|csv|png|jpe?g|webp)$/i, ""));
                }
              }}
              className="text-xs file:mr-3 file:rounded-xl file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:brightness-105 cursor-pointer"
            />
            {selectedFile && (
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="rounded-lg border px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
              >
                ✕ إزالة ({selectedFile.name})
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-foreground mb-1">
            🔗 أو رابط ملف الدرس (Lien URL / Google Drive عام / PDF)
          </label>
          <Input
            placeholder="https://drive.google.com/file/d/.../view ou https://.../cours.pdf"
            value={courseUrl}
            onChange={(e) => {
              setCourseUrl(e.target.value);
              setErrorMsg(null);
            }}
            className="rounded-xl"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            يقرأ الخادم الملف الفعلي من الرابط (يدعم روابط PDF المباشرة وروابط Google Drive/Docs العامة).
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-foreground mb-1">
            📚 عنوان الدرس أو الموضوع الطبي (Titre du cours)
          </label>
          <Input
            placeholder="مثال: Insuffisance Cardiaque, Paludisme, Appendicite Aiguë..."
            value={title}
            maxLength={140}
            onChange={(e) => {
              setTitle(e.target.value);
              setErrorMsg(null);
            }}
            className="rounded-xl"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-foreground mb-1">
            📝 نص أو مقتطف من الدرس (Optionnel - اختياري لزيادة التخصيص)
          </label>
          <Textarea
            placeholder="انسخ والصق ملخصاً أو فقرات من الدرس ليتم استخراج الأسئلة منها مباشرة..."
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setErrorMsg(null);
            }}
            className="rounded-xl text-xs min-h-[76px]"
          />
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-medium text-destructive"
          >
            ⚠️ {errorMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/60">
          <div>
            <span className="block text-xs font-semibold text-muted-foreground mb-1">
              صيغة الأسئلة :
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={qtype === "QCM" ? "default" : "outline"}
                onClick={() => {
                  play("click");
                  setQtype("QCM");
                }}
                className="rounded-xl text-xs"
              >
                QCM (متعدد الخيارات)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={qtype === "QCS" ? "default" : "outline"}
                onClick={() => {
                  play("click");
                  setQtype("QCS");
                }}
                className="rounded-xl text-xs"
              >
                QCS (خيار فردي)
              </Button>
            </div>
          </div>

          <div className="w-40">
            <span className="block text-xs font-semibold text-muted-foreground mb-1">
              عدد الأسئلة : <strong>{count}</strong>
            </span>
            <input
              className="w-full accent-primary"
              type="range"
              min={3}
              max={20}
              step={1}
              value={count}
              onChange={(e) => setCount(+e.target.value)}
            />
          </div>
        </div>

        <Button
          className="w-full rounded-2xl bg-hero py-3 text-sm font-semibold text-primary-foreground shadow-pop hover:brightness-105 active:scale-95 transition-all"
          disabled={busy || (!selectedFile && !title.trim() && !courseUrl.trim() && !notes.trim())}
          onClick={() => void handleCreateQuiz()}
        >
          {busy
            ? "جاري قراءة الملف/الدرس وتوليد الأسئلة بالذكاء الاصطناعي… 🤖"
            : "🚀 توليد أسئلة QCM من المحتوى (Générer le Quiz)"}
        </Button>
      </section>

      {/* Quizzes List */}
      <div className="mt-8">
        <h2 className="font-display text-lg font-bold mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span>📚</span>
            <span>كويزاتي المولّدة ({quizzes.length})</span>
          </span>
          {quizzes.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              اضغط على أي كويز للبدء في الحل الفوري والتصحيح
            </span>
          )}
        </h2>

        {quizzes.length === 0 ? (
          <div className="card-game p-8 text-center text-muted-foreground border-dashed">
            <span className="text-3xl block mb-2">📄</span>
            <p className="font-semibold text-sm">لم تقم بتوليد أي كويز بعد</p>
            <p className="text-xs mt-1">
              ارفع ملف PDF أو ضع رابط الدرس أعلاه لتوليد أسئلة مخصصة من محتواه في ثوانٍ !
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {quizzes.map((z) => (
              <LessonQuizCard
                key={z.id}
                quiz={z}
                onDelete={() => handleDeleteQuiz(z.id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function LessonQuizCard({ quiz, onDelete }: { quiz: SavedQuiz; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [ans, setAns] = useState<Record<number, string[]>>({});
  const [done, setDone] = useState(false);

  function toggleOption(qIdx: number, optKey: string) {
    play("select");
    setAns((prev) => {
      const current = prev[qIdx] || [];
      if (quiz.qtype === "QCS") {
        return { ...prev, [qIdx]: [optKey] };
      }
      const next = current.includes(optKey) ? current.filter((x) => x !== optKey) : [...current, optKey];
      return { ...prev, [qIdx]: next };
    });
  }

  const score = quiz.questions.filter((q, i) => {
    const selected = [...(ans[i] ?? [])].sort().join();
    const correct = [...q.correct].sort().join();
    return selected === correct;
  }).length;

  return (
    <article className="card-game p-5 shadow-sm border border-border/80 transition-all">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <button
            type="button"
            onClick={() => {
              play("click");
              setOpen(!open);
            }}
            className="text-left font-display font-bold text-base hover:text-primary transition-colors flex items-center gap-2"
          >
            <span>{open ? "▼" : "▶"}</span>
            <span>{quiz.title}</span>
          </button>
          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
            <span className="rounded bg-primary-soft text-primary font-semibold px-1.5 py-0.5">
              {quiz.qtype}
            </span>
            <span>{quiz.questions.length} أسئلة</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
              {sourceLabel(quiz.sourceMode)}
            </span>
            {quiz.sourceName && (
              <span className="text-[11px] truncate max-w-[180px]">{quiz.sourceName}</span>
            )}
            {quiz.sourceUrl && (
              <a
                href={quiz.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline truncate max-w-[200px]"
              >
                رابط المصدر ↗
              </a>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              play("click");
              setOpen(!open);
            }}
            className="rounded-xl text-xs"
          >
            {open ? "إخفاء الأسئلة" : "حل الكويز ✍️"}
          </Button>
          <button
            type="button"
            onClick={onDelete}
            title="حذف الكويز"
            className="rounded-xl p-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            🗑️
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-6 animate-pop">
          {quiz.questions.map((q, qIdx) => {
            const isQCorrect = [...(ans[qIdx] ?? [])].sort().join() === [...q.correct].sort().join();
            return (
              <div key={qIdx} className="rounded-2xl border border-border/70 p-4 bg-muted/20">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm leading-relaxed text-foreground">
                    {q.stem}
                  </p>
                  {done && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isQCorrect ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                      }`}
                    >
                      {isQCorrect ? "✅ صحيح" : "❌ خطأ"}
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-1.5">
                  {q.options.map((opt) => {
                    const isSelected = ans[qIdx]?.includes(opt.key);
                    const isCorrectOpt = q.correct.includes(opt.key);

                    let style = "border-border/70 bg-card hover:bg-muted/60";
                    if (isSelected) style = "border-primary bg-primary-soft text-primary font-bold shadow-sm";
                    if (done) {
                      if (isCorrectOpt) style = "border-success bg-success/15 text-success-foreground font-bold";
                      else if (isSelected && !isCorrectOpt) style = "border-destructive bg-destructive/15 text-destructive font-semibold";
                    }

                    return (
                      <button
                        key={opt.key}
                        disabled={done}
                        onClick={() => toggleOption(qIdx, opt.key)}
                        className={`w-full rounded-xl border p-2.5 text-left text-xs sm:text-sm transition-all flex items-center gap-2 ${style}`}
                      >
                        <span className="grid h-6 w-6 place-items-center rounded-lg bg-background border text-xs font-bold shrink-0">
                          {opt.key}
                        </span>
                        <span className="flex-1">{opt.text}</span>
                        {done && isCorrectOpt && <span className="text-success text-xs">✓ صحيح</span>}
                      </button>
                    );
                  })}
                </div>

                {done && (
                  <div className="mt-3 rounded-xl bg-card border border-border/80 p-3 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-bold text-foreground block mb-1">
                      💡 التفسير الطبي للحل (Explication) :
                    </span>
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
            {done ? (
              <div className="flex items-center gap-3">
                <span className="font-display text-2xl font-bold text-primary">
                  النتيجة : {score} / {quiz.questions.length}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({Math.round((score / quiz.questions.length) * 100)}%)
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    play("click");
                    setAns({});
                    setDone(false);
                  }}
                  className="rounded-xl text-xs ml-2"
                >
                  إعادة المحاولة 🔄
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => {
                  setDone(true);
                  play(score >= quiz.questions.length / 2 ? "best" : "reveal");
                }}
                className="rounded-xl px-6 font-semibold shadow-pop hover:brightness-105 active:scale-95"
              >
                تصحيح الإجابات (Valider mes réponses) 🎯
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
