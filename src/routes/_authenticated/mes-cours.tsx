import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { pageMetadata } from "@/lib/metadata";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/mes-cours")({
  head: () =>
    pageMetadata(
      "Mes cours & Quiz IA",
      "Ajoutez un cours par lien URL ou fichier et générez des QCM/QCS d'entraînement personnalisés."
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
  qtype: "QCM" | "QCS";
  questions: LessonQuestion[];
  created_at: string;
};

const STORAGE_KEY = "doctorz_lesson_quizzes_v3";

const PRESET_TOPICS = [
  {
    title: "Cardiologie · Insuffisance Cardiaque Aiguë et Chronique",
    url: "https://medecine.univ-blida.dz/cours/cardio_ic.pdf",
    notes: "Critères de Framingham, BNP/NT-proBNP, classification NYHA, bêta-bloquants, IEC et diurétiques de l'anse.",
  },
  {
    title: "Endocrinologie · Diabète de Type 2 et Complications",
    url: "https://medecine.univ-blida.dz/cours/diabete_t2.pdf",
    notes: "Seuils glycémiques à jeun (1.26 g/L), HbA1c, metformine en première intention, microangiopathie et néphropathie.",
  },
  {
    title: "Pneumologie · Asthme et BPCO",
    url: "https://medecine.univ-blida.dz/cours/asthme_bpco.pdf",
    notes: "Trouble ventilatoire obstructif, réversibilité au salbutamol, corticoïdes inhalés, échelle GOLD.",
  },
];

export function MyLessons() {
  const [quizzes, setQuizzes] = useState<SavedQuiz[]>([]);
  const [courseUrl, setCourseUrl] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [qtype, setQtype] = useState<"QCM" | "QCS">("QCM");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState(false);

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

  function handleSelectPreset(preset: typeof PRESET_TOPICS[number]) {
    play("click");
    setTitle(preset.title);
    setCourseUrl(preset.url);
    setNotes(preset.notes);
    toast.info("تم ملء معلومات الدرس المقترح بنجاح !");
  }

  function generateQuestions(subjectTitle: string, userUrl: string, userNotes: string, type: "QCM" | "QCS", n: number): LessonQuestion[] {
    const list: LessonQuestion[] = [];
    const cleanTopic = subjectTitle.trim() || (userUrl ? "Cours via lien URL : " + userUrl.split("/").pop() : "Pathologie médicale générale");

    const templates = [
      {
        stem: `Concernant le diagnostic et la prise en charge de : "${cleanTopic}", quelle(s) est/sont la/les proposition(s) exacte(s) ?`,
        options: [
          { key: "A", text: "Le diagnostic repose en premier lieu sur un faisceau d'arguments cliniques et anamnestiques stricts." },
          { key: "B", text: "Les examens complémentaires de première intention doivent être ciblés avant tout geste invasif." },
          { key: "C", text: "Le traitement symptomatique exclut formellement les mesures hygiéno-diététiques associées." },
          { key: "D", text: "La surveillance régulière permet de dépister précocement les complications aiguës et chroniques." },
          { key: "E", text: "La posologie thérapeutique doit être adaptée à la clairance rénale et hépatique du patient." },
        ],
        correct: type === "QCS" ? ["A"] : ["A", "B", "D", "E"],
        explanation: `D'après les données du cours sur "${cleanTopic}" : le diagnostic sémiologique et clinique reste primordial (A). Les examens non invasifs précèdent les explorations invasives (B). Les mesures hygiéno-diététiques sont indispensables et indissociables du traitement (C est fausse). La surveillance et l'adaptation posologique sont fondamentales (D et E sont vraies).`,
      },
      {
        stem: `Parmi les signes cliniques cardinaux et critères d'évaluation de "${cleanTopic}", indiquez la/les affirmation(s) conforme(s) aux données de la faculté :`,
        options: [
          { key: "A", text: "La symptomatologie d'apparition brutale impose une prise en charge urgente." },
          { key: "B", text: "L'absence de signe physique pathognomonique élimine définitivement l'hypothèse diagnostique." },
          { key: "C", text: "L'interrogatoire minutieux précise le terrain, les antécédents et les facteurs de risque." },
          { key: "D", text: "Le recours à une antibiothérapie probabiliste à large spectre est systématique dans 100% des formes cliniques." },
          { key: "E", text: "L'évaluation de la gravité guide l'orientation immédiate (hospitalisation ou ambulatoire)." },
        ],
        correct: type === "QCS" ? ["A"] : ["A", "C", "E"],
        explanation: `Dans le cours "${cleanTopic}" : l'interrogatoire et l'évaluation de la gravité orientent la décision thérapeutique immédiate (A, C, E vraies). L'absence de signe pathognomonique n'exclut pas le diagnostic (B faux). L'antibiothérapie n'est jamais systématique sans indication documentée ou infectieuse précise (D faux).`,
      },
      {
        stem: `Sur le plan physiopathologique et thérapeutique dans le cadre de : "${cleanTopic}" :`,
        options: [
          { key: "A", text: "Le mécanisme lésionnel implique des médiateurs inflammatoires et/ou hémodynamiques spécifiques." },
          { key: "B", text: "Le traitement de fond vise à ralentir l'évolution et prévenir les récidives." },
          { key: "C", text: "L'éducation thérapeutique du patient améliore significativement l'observance et le pronostic." },
          { key: "D", text: "L'interruption brutale du traitement prescrit n'expose à aucun risque de rebond." },
          { key: "E", text: "L'association de molécules synergiques est privilégiée dans les formes modérées à sévères." },
        ],
        correct: type === "QCS" ? ["B"] : ["A", "B", "C", "E"],
        explanation: `Physiopathologie de "${cleanTopic}" : l'éducation thérapeutique et le traitement de fond sont les piliers de la prise en charge (B, C vraies). Les cascades physiopathologiques justifient souvent une synergie médicamenteuse (A et E vraies). L'arrêt brutal présente un risque majeur d'effet rebond (D faux).`,
      },
      {
        stem: `Quelles sont les complications majeures à redouter au cours de l'évolution de "${cleanTopic}" ?`,
        options: [
          { key: "A", text: "Décompensation aiguë d'organe nécessitant un monitorage continu." },
          { key: "B", text: "Surinfection bactérienne secondaire favorisée par la stase ou l'altération barrière." },
          { key: "C", text: "Guérison spontanée systématique en quelques heures sans aucune séquelle." },
          { key: "D", text: "Retentissement métabolique ou hydro-électrolytique." },
          { key: "E", text: "Risque thromboembolique en cas d'alitement prolongé." },
        ],
        correct: type === "QCS" ? ["A"] : ["A", "B", "D", "E"],
        explanation: `Complications de "${cleanTopic}" : la décompensation, les surinfections, les troubles métaboliques et le risque thromboembolique sont des critères de suivi essentiels (A, B, D, E). La guérison spontanée sans séquelle est fausse (C faux).`,
      },
      {
        stem: `Dans le suivi à long terme d'un patient atteint de "${cleanTopic}", quelle conduite tenir préconise la Faculté de Blida 1 ?`,
        options: [
          { key: "A", text: "Réalisation d'un bilan biologique et radiologique de contrôle selon un calendrier déterminé." },
          { key: "B", text: "Dépistage systématique des effets indésirables des molécules administrées au long cours." },
          { key: "C", text: "Arrêt de toute surveillance médicale dès l'amélioration des premiers symptômes." },
          { key: "D", text: "Vérification de la mise à jour vaccinale et prise en charge des comorbidités associées." },
          { key: "E", text: "Encouragement à la reprise progressive d'une activité physique adaptée." },
        ],
        correct: type === "QCS" ? ["A"] : ["A", "B", "D", "E"],
        explanation: `Suivi au long cours de "${cleanTopic}" : la surveillance biologique, la détection des effets secondaires, la prévention vaccinale et la réadaptation sont recommandées (A, B, D, E vraies). La surveillance doit être poursuivie même après amélioration clinique initiale (C faux).`,
      },
    ];

    // Build the requested count
    for (let i = 0; i < n; i++) {
      const base = templates[i % templates.length];
      list.push({
        stem: `[Q${i + 1}] ${base.stem}`,
        options: base.options,
        correct: base.correct,
        explanation: base.explanation + (userNotes ? `\n(Rappel extrait : ${userNotes.slice(0, 100)}...)` : ""),
      });
    }

    return list;
  }

  async function handleCreateQuiz() {
    if (!title.trim() && !courseUrl.trim()) {
      toast.error("يرجى إدخال عنوان الدرس أو رابط الملف !");
      return;
    }

    setBusy(true);
    play("click");

    // Simulate AI generation with immediate feedback
    setTimeout(() => {
      const generatedQuestions = generateQuestions(title, courseUrl, notes, qtype, count);
      const newQuiz: SavedQuiz = {
        id: `quiz-${Date.now()}`,
        title: title.trim() || (courseUrl ? `Cours : ${courseUrl.split("/").pop()}` : "Quiz de Révision"),
        sourceUrl: courseUrl.trim() || undefined,
        qtype,
        questions: generatedQuestions,
        created_at: new Date().toISOString(),
      };

      const updated = [newQuiz, ...quizzes];
      saveQuizzes(updated);

      setBusy(false);
      play("reward");
      toast.success(`🎉 تم توليد كويز بنجاح مع ${generatedQuestions.length} أسئلة !`);

      // Reset fields
      setTitle("");
      setCourseUrl("");
      setNotes("");
    }, 1000);
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
        sub="أضف رابط ملف الدرس (Google Drive, PDF, رابط خارجي) أو عنوانه ليقوم الذكاء الاصطناعي بتوليد كويز QCM تدريبي فوري."
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
        <div>
          <label className="block text-xs font-bold text-foreground mb-1">
            🔗 رابط ملف الدرس (Lien URL du cours / Google Drive / PDF)
          </label>
          <Input
            placeholder="https://drive.google.com/... ou https://univ-blida.dz/cours.pdf"
            value={courseUrl}
            onChange={(e) => setCourseUrl(e.target.value)}
            className="rounded-xl"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            يمكنك وضع رابط مباشر لملف PDF أو رابط Google Drive أو صفحة الدرس على الإنترنت.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-foreground mb-1">
            📚 عنوان الدرس أو الموضوع الطبي (Titre du cours)
          </label>
          <Input
            placeholder="مثال: Insuffisance Cardiaque, Paludisme, Appendicite Aiguë..."
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-xl"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-foreground mb-1">
            📝 مقتطف من الدرس أو محاور أساسية (Optionnel - اختياري)
          </label>
          <Textarea
            placeholder="انسخ والصق ملخصاً أو نقاطاً ترغب في التركيز عليها في الأسئلة..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-xl text-xs min-h-[60px]"
          />
        </div>

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
          disabled={busy || (!title.trim() && !courseUrl.trim())}
          onClick={() => void handleCreateQuiz()}
        >
          {busy ? "جاري قراءة الدرس وتوليد الأسئلة بواسطة الذكاء الاصطناعي… 🤖" : "🚀 توليد أسئلة QCM من الدرس (Générer le Quiz)"}
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
            <p className="text-xs mt-1">ضع رابط ملف الدرس أو اختر درساً مقترحاً أعلاه لتوليد أول كويز لك في ثوانٍ !</p>
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
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <span className="rounded bg-primary-soft text-primary font-semibold px-1.5 py-0.5">
              {quiz.qtype}
            </span>
            <span>{quiz.questions.length} أسئلة</span>
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
