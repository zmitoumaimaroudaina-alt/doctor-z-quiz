import { useEffect, useState } from "react";
import { getClientAuthToken } from "@/lib/authToken";
import { generateClinicalExplanation } from "@/lib/medicalExplainer";
import { getBundledKey, getBundledQuestion } from "@/lib/medicalData";
import { getKeyOverride, getQuestionOverride } from "@/lib/questionOverrides";
import { play } from "@/lib/sound";
import type { Question } from "@/lib/queries";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "لماذا الخيار الصحيح هو المؤكد سريرياً؟",
  "ما هو الفخ الشائع في هذا السؤال؟",
  "اشرح لي الآلية المرضية (Physiopathologie)",
  "كيف أميز بين هذه الحالة والحالات المشابهة؟",
];

export function AiExplain({
  questionId,
  selected = [],
  question,
  official,
}: {
  questionId: string;
  selected?: string[];
  question?: Question;
  official?: { correct: string[]; explanation: string; note: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function resolveAuthoritativeContext() {
    const qOv = getQuestionOverride(questionId);
    const kOv = getKeyOverride(questionId);
    const baseQ = question || getBundledQuestion(questionId);
    const baseK = official || getBundledKey(questionId);

    const effectiveQ: Question | undefined = baseQ
      ? {
          ...baseQ,
          ...(qOv?.stem !== undefined ? { stem: qOv.stem } : {}),
          ...(qOv?.case_text !== undefined ? { case_text: qOv.case_text } : {}),
          ...(qOv?.options !== undefined ? { options: qOv.options } : {}),
        }
      : undefined;

    const effectiveOfficial = {
      correct: (kOv?.correct && kOv.correct.length > 0 ? kOv.correct : baseK.correct) ?? [],
      explanation:
        kOv?.explanation !== undefined ? (kOv.explanation ?? "") : (baseK.explanation ?? ""),
      note: kOv?.note !== undefined ? kOv.note : (baseK.note ?? null),
    };

    return { effectiveQ, effectiveOfficial, isCreatorEdited: Boolean(kOv || qOv) };
  }

  const { effectiveOfficial, isCreatorEdited } = resolveAuthoritativeContext();
  const officialKeyLabel = effectiveOfficial.correct.join(", ") || "—";
  const officialKeySig = `${officialKeyLabel}|${effectiveOfficial.explanation.slice(0, 60)}`;

  // Reset conversation whenever the displayed question or its official key changes
  useEffect(() => {
    setOpen(false);
    setMsgs([]);
    setInput("");
    setBusy(false);
    setNotice(null);
  }, [questionId, officialKeySig]);

  async function send(history: Msg[]) {
    setBusy(true);
    setNotice(null);
    play("click");

    const latestUserPrompt = history.filter((m) => m.role === "user").pop()?.content;
    const { effectiveQ, effectiveOfficial: authOfficial } = resolveAuthoritativeContext();

    try {
      const token = await getClientAuthToken();
      if (token) {
        const res = await fetch("/api/ai-explain", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            questionId,
            selected,
            messages: history,
            ...(effectiveQ
              ? {
                  question: {
                    id: effectiveQ.id,
                    stem: effectiveQ.stem,
                    case_text: effectiveQ.case_text,
                    options: effectiveQ.options,
                  },
                }
              : {}),
            official: authOfficial,
          }),
        });

        if (res.ok && res.body) {
          let text = "";
          let sseError: string | null = null;
          setMsgs([...history, { role: "assistant", content: "" }]);
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const l of lines) {
              if (!l.startsWith("data: ")) continue;
              try {
                const ev = JSON.parse(l.slice(6)) as {
                  type?: string;
                  delta?: string;
                  message?: string;
                };
                if (ev.type === "response.output_text.delta" && ev.delta) {
                  text += ev.delta;
                  setMsgs([...history, { role: "assistant", content: text }]);
                } else if (ev.type === "error" && ev.message) {
                  sseError = ev.message;
                }
              } catch {
                // partial json
              }
            }
          }

          if (text.trim().length > 0) {
            setBusy(false);
            play("reward");
            return;
          }

          if (sseError) {
            setNotice(sseError);
          }
        } else if (!res.ok) {
          const errText = await res.text().catch(() => "");
          if (errText.trim()) {
            setNotice(errText.trim());
          }
        }
      }
    } catch {
      // network fallback below
    }

    // Question-specific clinical reasoning fallback (strictly anchored to effective official key)
    const explanation = generateClinicalExplanation(
      questionId,
      selected,
      latestUserPrompt,
      effectiveQ,
      authOfficial,
    );
    setMsgs([...history, { role: "assistant", content: explanation }]);
    setBusy(false);
    play("reward");
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void send([]);
        }}
        className="mt-3.5 flex items-center gap-2 rounded-2xl bg-hero px-4 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground shadow-pop hover:brightness-105 active:scale-95 transition-all"
      >
        <span>🤖</span>
        <span>Expliquer avec l'IA · شرح وتفسير سريري بالذكاء الاصطناعي</span>
      </button>
    );
  }

  return (
    <div className="mt-3.5 rounded-2xl border-2 border-primary/30 bg-card p-4 sm:p-5 shadow-md animate-pop">
      <div className="mb-3.5 flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-xl text-primary">
            🤖
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-primary flex flex-wrap items-center gap-1.5">
              <span>Dr Z-Bot · المساعد السريري الذكي</span>
              <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success">
                🎯 الحل الرسمي: [{officialKeyLabel}]
              </span>
              {isCreatorEdited && (
                <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                  ✏️ مصحّح من المصمم
                </span>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              شرح دقيق ملتزم تماماً بالحل الرسمي المعتمد للخيار الصحيح والخيارات المستبعدة
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl p-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
          title="إغلاق التفسير"
        >
          ✕
        </button>
      </div>

      {notice && (
        <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          ⚠️ {notice}
        </div>
      )}

      {/* Messages Feed */}
      <div className="max-h-[420px] space-y-3 overflow-y-auto text-sm pr-1">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-6 sm:ml-12 bg-primary text-primary-foreground font-semibold shadow-xs"
                : "bg-muted/40 border border-border/50 whitespace-pre-line text-foreground"
            }`}
          >
            {m.content || "جاري كتابة الشرح والتحليل السريري للخيارات… ⏳"}
          </div>
        ))}
      </div>

      {/* Quick Prompt Chips */}
      <div className="mt-3 flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
        <span className="text-[11px] font-semibold text-muted-foreground self-center">أسئلة مقترحة:</span>
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp}
            type="button"
            disabled={busy}
            onClick={() => {
              const h = [...msgs, { role: "user" as const, content: qp }];
              setMsgs(h);
              void send(h);
            }}
            className="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/15 transition-all"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Custom Follow-up Input */}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || busy) return;
          const h = [...msgs, { role: "user" as const, content: input.trim().slice(0, 500) }];
          setMsgs(h);
          setInput("");
          void send(h);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder="اطرح سؤالاً إضافياً على Dr Z-Bot (مثال: لماذا الخيار B فخ؟)..."
          className="flex-1 rounded-xl border border-input bg-background px-3.5 py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-xl bg-hero px-4 py-2 text-xs sm:text-sm font-bold text-primary-foreground hover:brightness-105 disabled:opacity-50 transition-all shadow-sm"
        >
          إرسال ➤
        </button>
      </form>
    </div>
  );
}
