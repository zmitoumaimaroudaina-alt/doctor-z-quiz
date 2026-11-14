import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getAllBundledQuestions,
  getBundledCourses,
  getBundledExams,
  getBundledKey,
  getBundledSubjects,
  getRawBundledKey,
  getRawBundledQuestion,
} from "@/lib/medicalData";
import {
  clearManualQuestionCorrection,
  getOverridesStore,
  saveManualQuestionCorrection,
  syncDeleteCorrectionToServer,
  syncSaveCorrectionToServer,
} from "@/lib/questionOverrides";
import type { Option } from "@/lib/queries";
import { play } from "@/lib/sound";

export interface EditableQuestionItem {
  id: string;
  pos: number;
  stem: string;
  case_text: string | null;
  options: Option[];
  needs_review: boolean;
  review_reason: string | null;
  exam_id: string | null;
  course_id: string | null;
  source_year: string | null;
  contextLabel: string;
  correct: string[];
  explanation: string;
  note: string | null;
  isBundled: boolean;
  isModified: boolean;
}

export function CreatorQuestionEditor({
  defaultFilterMode = "all",
}: {
  defaultFilterMode?: "all" | "review" | "modified";
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "review" | "modified">(defaultFilterMode);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [limit, setLimit] = useState(35);
  const [tick, setTick] = useState(0);

  const exams = useMemo(() => getBundledExams(), []);
  const courses = useMemo(() => getBundledCourses(), []);
  const subjects = useMemo(() => getBundledSubjects(), []);

  const { data: remoteRows } = useQuery({
    queryKey: ["creator-remote-questions", tick],
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from("questions")
          .select("*, question_keys(*)")
          .order("pos")
          .limit(500);
        return data ?? [];
      } catch {
        return [];
      }
    },
  });

  const allItems = useMemo<EditableQuestionItem[]>(() => {
    const subjectById = new Map(subjects.map((s) => [s.id, s.name]));
    const examById = new Map(exams.map((e) => [e.id, e]));
    const courseById = new Map(courses.map((c) => [c.id, c]));
    const overrides = getOverridesStore();

    const byId = new Map<string, EditableQuestionItem>();

    // 1. Load all bundled questions (UEI1 2025, Cardio, Immuno, Anapath, etc.)
    for (const q of getAllBundledQuestions()) {
      const k = getBundledKey(q.id);
      const ex = q.exam_id ? examById.get(q.exam_id) : undefined;
      const cr = q.course_id ? courseById.get(q.course_id) : undefined;
      const subj = cr ? subjectById.get(cr.subject_id) : undefined;
      const parts = [
        subj,
        ex?.title || cr?.title,
        q.source_year ? `${q.source_year}` : null,
        `Q${q.pos}`,
      ].filter(Boolean);

      byId.set(q.id, {
        id: q.id,
        pos: q.pos,
        stem: q.stem,
        case_text: q.case_text,
        options: Array.isArray(q.options) ? q.options : [],
        needs_review: Boolean(q.needs_review),
        review_reason: (q as { review_reason?: string | null }).review_reason ?? null,
        exam_id: q.exam_id ?? null,
        course_id: q.course_id ?? null,
        source_year: q.source_year != null ? String(q.source_year) : null,
        contextLabel: parts.join(" · ") || `Question #${q.pos}`,
        correct: k.correct,
        explanation: k.explanation ?? "",
        note: k.note ?? null,
        isBundled: true,
        isModified: Boolean(overrides.questions[q.id] || overrides.keys[q.id]),
      });
    }

    // 2. Merge Supabase rows (if any extra or database-hosted questions exist)
    for (const row of remoteRows ?? []) {
      const rawKey = Array.isArray(row.question_keys)
        ? row.question_keys[0]
        : row.question_keys;
      const existing = byId.get(row.id);
      if (existing) {
        // Keep local manual override priority if already overridden
        if (!existing.isModified && rawKey?.correct?.length) {
          existing.correct = rawKey.correct;
          if (rawKey.explanation) existing.explanation = rawKey.explanation;
          if (rawKey.note !== undefined) existing.note = rawKey.note;
        }
        continue;
      }

      const ovQ = overrides.questions[row.id];
      const ovK = overrides.keys[row.id];
      const ex = row.exam_id ? examById.get(row.exam_id) : undefined;
      const cr = row.course_id ? courseById.get(row.course_id) : undefined;
      const subj = cr ? subjectById.get(cr.subject_id) : undefined;

      byId.set(row.id, {
        id: row.id,
        pos: row.pos ?? 1,
        stem: ovQ?.stem ?? row.stem ?? "",
        case_text: ovQ?.case_text !== undefined ? ovQ.case_text : (row.case_text ?? null),
        options: (ovQ?.options ?? row.options ?? []) as Option[],
        needs_review: ovQ?.needs_review !== undefined ? ovQ.needs_review : Boolean(row.needs_review),
        review_reason: row.review_reason ?? null,
        exam_id: row.exam_id ?? null,
        course_id: row.course_id ?? null,
        source_year: row.source_year != null ? String(row.source_year) : null,
        contextLabel:
          [subj, ex?.title || cr?.title, `Q${row.pos ?? 1}`].filter(Boolean).join(" · ") ||
          `Question #${row.pos ?? 1}`,
        correct: ovK?.correct ?? rawKey?.correct ?? [],
        explanation:
          ovK?.explanation !== undefined
            ? (ovK.explanation ?? "")
            : (rawKey?.explanation ?? ""),
        note: ovK?.note !== undefined ? ovK.note : (rawKey?.note ?? null),
        isBundled: false,
        isModified: Boolean(ovQ || ovK),
      });
    }

    return [...byId.values()].sort((a, b) => a.pos - b.pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteRows, exams, courses, subjects, tick]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((item) => {
      if (filterMode === "review" && !item.needs_review) return false;
      if (filterMode === "modified" && !item.isModified) return false;

      if (sourceFilter.startsWith("exam:")) {
        const target = sourceFilter.slice(5);
        if (item.exam_id !== target) return false;
      } else if (sourceFilter.startsWith("course:")) {
        const target = sourceFilter.slice(7);
        if (item.course_id !== target) return false;
      }

      if (!q) return true;
      const optMatch = item.options.some((o) => o.text.toLowerCase().includes(q));
      return (
        item.stem.toLowerCase().includes(q) ||
        (item.case_text ?? "").toLowerCase().includes(q) ||
        item.contextLabel.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        `q${item.pos}` === q ||
        String(item.pos) === q ||
        optMatch
      );
    });
  }, [allItems, search, filterMode, sourceFilter]);

  const visible = filtered.slice(0, limit);
  const modifiedCount = allItems.filter((x) => x.isModified).length;
  const reviewCount = allItems.filter((x) => x.needs_review).length;

  function triggerRefresh() {
    setTick((t) => t + 1);
    void qc.invalidateQueries({ queryKey: ["course"] });
    void qc.invalidateQueries({ queryKey: ["play"] });
    void qc.invalidateQueries({ queryKey: ["review"] });
    void qc.invalidateQueries({ queryKey: ["flagged-questions"] });
    void qc.invalidateQueries({ queryKey: ["admin-q"] });
  }

  return (
    <div className="space-y-4">
      {/* Search & Filters Header */}
      <div className="card-game border-2 border-primary/25 bg-primary/5 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold">
              🔍 البحث وتصحيح الحل الرسمي يدوياً ({allItems.length} سؤال)
            </h2>
            <p className="ar text-xs text-muted-foreground">
              ابحث بأي كلمة من السؤال أو الخيارات أو رقم السؤال، واضغط على أحرف الإجابة الصحيحة لتحديث الحل الرسمي فوراً.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-card border px-2.5 py-1 font-semibold">
              ✏️ معدّلة يدوياً: {modifiedCount}
            </span>
            <span className="rounded-full bg-warning/20 border border-warning/40 px-2.5 py-1 font-semibold">
              ⚠️ تحتاج مراجعة: {reviewCount}
            </span>
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-[1fr_auto]">
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(35);
            }}
            placeholder="ابحث بكلمة في السؤال، الحالة السريرية، الخيارات، أو رقم السؤال (مثال: troponine, Q12)…"
            className="w-full rounded-xl border bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />

          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value);
              setLimit(35);
            }}
            className="rounded-xl border bg-background px-3 py-2 text-xs sm:text-sm max-w-full sm:max-w-[260px]"
          >
            <option value="all">📚 كل الامتحانات والدروس</option>
            <optgroup label="📝 الامتحانات">
              {exams.map((ex) => (
                <option key={ex.id} value={`exam:${ex.id}`}>
                  {ex.title}
                </option>
              ))}
            </optgroup>
            <optgroup label="📖 الدروس">
              {courses.map((cr) => (
                <option key={cr.id} value={`course:${cr.id}`}>
                  {cr.title}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", `الكل (${allItems.length})`],
              ["review", `تحتاج مراجعة (${reviewCount})`],
              ["modified", `المعدّلة يدوياً (${modifiedCount})`],
            ] as const
          ).map(([modeKey, label]) => (
            <button
              key={modeKey}
              type="button"
              onClick={() => {
                play("click");
                setFilterMode(modeKey);
                setLimit(35);
              }}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                filterMode === modeKey
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border bg-card hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          عرض <b>{visible.length}</b> من أصل <b>{filtered.length}</b> نتيجة مطابقة
        </span>
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="text-primary font-semibold hover:underline"
          >
            مسح البحث ✕
          </button>
        )}
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {visible.map((item) => (
          <QuestionItemEditor key={`${item.id}-${tick}`} item={item} onSaved={triggerRefresh} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card-game p-8 text-center text-sm text-muted-foreground">
          لا توجد أسئلة مطابقة لبحثك. جرب كلمة مفتاحية أخرى أو أعد ضبط الفلتر.
        </div>
      )}

      {filtered.length > visible.length && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => setLimit((l) => l + 40)}
            className="rounded-2xl border bg-card px-6 py-2.5 text-sm font-semibold hover:bg-muted transition"
          >
            عرض المزيد (+40 سؤال · متبقي {filtered.length - visible.length})
          </button>
        </div>
      )}
    </div>
  );
}

function QuestionItemEditor({
  item,
  onSaved,
}: {
  item: EditableQuestionItem;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [caseText, setCaseText] = useState(item.case_text ?? "");
  const [stem, setStem] = useState(item.stem);
  const [opts, setOpts] = useState<Option[]>(item.options);
  const [correctArr, setCorrectArr] = useState<string[]>(item.correct);
  const [expl, setExpl] = useState(item.explanation);
  const [note, setNote] = useState(item.note ?? "");
  const [needsReview, setNeedsReview] = useState(item.needs_review);
  const [saving, setSaving] = useState(false);

  const availableKeys = useMemo(() => {
    const keys = opts.map((o) => o.key).filter(Boolean);
    return keys.length > 0 ? keys : ["A", "B", "C", "D", "E"];
  }, [opts]);

  function toggleAnswerKey(letter: string) {
    play("select");
    const upper = letter.toUpperCase();
    setCorrectArr((prev) =>
      prev.includes(upper) ? prev.filter((k) => k !== upper) : [...prev, upper].sort(),
    );
  }

  async function handleSave(clearFlag: boolean) {
    const cleanCorrect = [...new Set(correctArr.map((c) => c.toUpperCase()).filter((c) => /^[A-E]$/.test(c)))].sort();
    if (cleanCorrect.length === 0) {
      toast.error("يرجى تحديد حرف إجابة رسمية واحد على الأقل (A-E).");
      return;
    }

    setSaving(true);
    const nextReview = clearFlag ? false : needsReview;

    const qPatch = {
      stem: stem.trim(),
      case_text: caseText.trim() || null,
      options: opts,
      needs_review: nextReview,
      ...(clearFlag ? { review_reason: null } : {}),
    };
    const kPatch = {
      correct: cleanCorrect,
      explanation: expl.trim() || null,
      note: note.trim() || null,
    };

    // 1. Save immediately in local question overrides store (instant across all bundled exams/courses/AI)
    saveManualQuestionCorrection(item.id, qPatch, kPatch);

    // 2. Persist on server overrides store for global & AI explanation consistency
    await syncSaveCorrectionToServer(item.id, qPatch, kPatch);

    // 3. Also sync to Supabase / mockClient DB if present
    try {
      await supabase
        .from("questions")
        .update(qPatch)
        .eq("id", item.id);

      await supabase.from("question_keys").upsert({
        question_id: item.id,
        ...kPatch,
      });
    } catch {
      // local & server file overrides already saved
    }

    setSaving(false);
    play("reward");
    toast.success(`✅ تم حفظ التصحيح الرسمي: [${cleanCorrect.join(", ")}]`);
    onSaved();
  }

  async function handleReset() {
    clearManualQuestionCorrection(item.id);
    await syncDeleteCorrectionToServer(item.id);
    const rawQ = getRawBundledQuestion(item.id);
    const rawK = getRawBundledKey(item.id);
    if (rawQ) {
      setStem(rawQ.stem);
      setCaseText(rawQ.case_text ?? "");
      setOpts(rawQ.options);
      setNeedsReview(Boolean(rawQ.needs_review));
    }
    setCorrectArr(rawK.correct);
    setExpl(rawK.explanation ?? "");
    setNote(rawK.note ?? "");
    play("click");
    toast.info("تم استرجاع نص وحل السؤال الأصلي.");
    onSaved();
  }

  return (
    <div
      className={`card-game p-4 transition-all ${
        item.isModified ? "border-2 border-primary/40" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => {
          play("click");
          setOpen(!open);
        }}
        className="w-full text-left"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
          <span>
            Faculté de Médecine de Blida · {item.contextLabel}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-success/15 text-success font-bold px-2 py-0.5">
              الحل الرسمي: {correctArr.join(", ") || "—"}
            </span>
            {item.isModified && (
              <span className="rounded-md bg-primary/15 text-primary font-bold px-2 py-0.5">
                ✏️ معدّل
              </span>
            )}
            {item.needs_review && (
              <span className="rounded-md bg-warning/30 text-warning-foreground font-semibold px-2 py-0.5">
                ⚠ {item.review_reason || "À vérifier"}
              </span>
            )}
          </div>
        </div>
        <div className="line-clamp-2 font-medium text-sm text-foreground flex items-start gap-2">
          <span className="text-primary font-bold">{open ? "▼" : "▶"}</span>
          <span>{stem}</span>
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-3 border-t border-border/60 pt-4 text-sm animate-pop">
          {/* Official Answer Selector Buttons */}
          <div className="rounded-2xl border-2 border-success/30 bg-success/5 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="font-bold text-xs sm:text-sm text-foreground">
                🎯 الحل الرسمي المعتمد (اضغط لاختيار الإجابات الصحيحة) :
              </span>
              <span className="text-xs font-mono font-bold text-success">
                [{correctArr.join(", ") || "لم يتم التحديد"}]
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableKeys.map((letter) => {
                const active = correctArr.includes(letter);
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => toggleAnswerKey(letter)}
                    className={`h-10 w-12 rounded-xl border-2 font-display text-base font-bold transition-all active:scale-95 ${
                      active
                        ? "border-success bg-success text-success-foreground shadow-sm"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              📋 Cas clinique (الحالة السريرية - اختياري)
            </label>
            <textarea
              value={caseText}
              onChange={(e) => setCaseText(e.target.value)}
              rows={2}
              placeholder="نص الحالة السريرية إن وجد..."
              className="w-full rounded-xl border bg-background p-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              📝 Énoncé de la question (نص السؤال)
            </label>
            <textarea
              value={stem}
              onChange={(e) => setStem(e.target.value)}
              rows={3}
              className="w-full rounded-xl border bg-background p-2.5 text-sm font-medium"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-muted-foreground">
              🔤 Propositions (الخيارات A–E)
            </label>
            {opts.map((o, i) => {
              const isTrueOpt = correctArr.includes(o.key.toUpperCase());
              return (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleAnswerKey(o.key)}
                    title="تعيين/إلغاء كإجابة صحيحة"
                    className={`h-9 w-10 rounded-lg border font-bold text-xs shrink-0 transition ${
                      isTrueOpt
                        ? "border-success bg-success text-success-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {o.key}
                  </button>
                  <input
                    value={o.text}
                    onChange={(e) =>
                      setOpts(
                        opts.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                      )
                    }
                    className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setOpts(opts.filter((_, j) => j !== i))}
                    className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="حذف الخيار"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setOpts([...opts, { key: "ABCDE"[opts.length] ?? "E", text: "" }])
              }
              className="text-xs font-bold text-primary hover:underline"
            >
              + إضافة خيار
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                💡 Explication officielle (التعليل الطبي الرسمي)
              </label>
              <textarea
                value={expl}
                onChange={(e) => setExpl(e.target.value)}
                placeholder="شرح سبب صحة الإجابة الرسمية..."
                rows={3}
                className="w-full rounded-xl border bg-background p-2.5 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                📌 Note pédagogique (ملاحظة إضافية)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="ملاحظة للطلاب..."
                rows={3}
                className="w-full rounded-xl border bg-background p-2.5 text-xs sm:text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={needsReview}
              onChange={(e) => setNeedsReview(e.target.checked)}
              className="rounded accent-primary"
            />
            <span>تحتاج مراجعة (À vérifier)</span>
          </label>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave(false)}
              className="rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-bold text-primary-foreground shadow-sm hover:brightness-105 disabled:opacity-60"
            >
              {saving ? "جاري الحفظ…" : "💾 حفظ التصحيح الرسمي"}
            </button>

            {needsReview && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave(true)}
                className="rounded-xl bg-success px-4 py-2 text-xs sm:text-sm font-bold text-success-foreground shadow-sm hover:brightness-105 disabled:opacity-60"
              >
                ✅ حفظ واعتماد (إزالة علامة المراجعة)
              </button>
            )}

            {item.isModified && item.isBundled && (
              <button
                type="button"
                onClick={() => void handleReset()}
                className="ml-auto rounded-xl border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
              >
                ↩️ استرجاع الأصل
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
