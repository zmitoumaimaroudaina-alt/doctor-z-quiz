import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { QuestionCard } from "./QuestionCard";
import { Avatar } from "./Avatar";
import { AiExplain } from "./AiExplain";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/useMe";
import { fetchMistakesFor, type Question } from "@/lib/queries";
import { moodFrom } from "@/lib/game";
import { play } from "@/lib/sound";
import { saveProfileDurable } from "@/lib/profileStore";
import { recordChallengeParticipation } from "@/lib/leaderboardStore";
import { getKeyOverride, getQuestionOverride } from "@/lib/questionOverrides";

type Feedback = { correct: boolean; official: string[] | null; explanation: string | null; note: string | null };
type Summary = { id: string; total: number; correct: number; wrong: number; unanswered: number; score20: number; errors: string[] };

export function Practice({
  questions,
  onRequestNewAttempt,
  challengeId,
  challengeTitle,
}: {
  questions: Question[];
  onRequestNewAttempt?: () => boolean;
  challengeId?: string;
  challengeTitle?: string;
}) {
  const { data: me } = useMe();
  const [active, setActive] = useState(questions);
  const [attempt, setAttempt] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [streak, setStreak] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [mistakes, setMistakes] = useState<Map<string, { corrected_at: string | null }>>(new Map());

  useEffect(() => {
    setActive(questions);
    setI(0);
    setAnswers({});
    setFeedback({});
    setSummary(null);
  }, [questions]);

  useEffect(() => {
    let cancelled = false;
    if (!active.length) return;
    setAttempt(null);
    void (async () => {
      let id: string | null = null;
      try {
        const { data, error } = await supabase.rpc("start_practice", { _questions: active.map((q) => q.id) });
        if (!error && data) id = data;
      } catch {
        // fallback
      }

      if (!id) {
        id = `practice_${Date.now()}`;
      }

      let savedAnswers = {};
      try {
        const { data: saved } = await supabase.from("practice_attempts").select("answers").eq("id", id).single();
        if (saved?.answers) savedAnswers = saved.answers;
      } catch {
        // ignore
      }

      let m = new Map();
      try {
        m = await fetchMistakesFor(active.map((q) => q.id));
      } catch {
        // ignore
      }

      if (!cancelled) {
        setAttempt(id);
        setAnswers(savedAnswers as Record<string, string[]>);
        setMistakes(m);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  const rawQ = active[i];
  const qOv = rawQ ? getQuestionOverride(rawQ.id) : undefined;
  const q = rawQ
    ? {
        ...rawQ,
        ...(qOv?.stem !== undefined ? { stem: qOv.stem } : {}),
        ...(qOv?.case_text !== undefined ? { case_text: qOv.case_text } : {}),
        ...(qOv?.options !== undefined ? { options: qOv.options } : {}),
      }
    : undefined;
  const sel = q ? answers[q.id] ?? [] : [];
  const fb = q ? feedback[q.id] : undefined;

  async function validate() {
    if (!q || !attempt || !sel.length || pending.current || fb) return;
    pending.current = true;
    setBusy(true);

    try {
      let r: Feedback | null = null;
      try {
        const { data, error } = await supabase.rpc("answer_practice", { _attempt: attempt, _q: q.id, _sel: sel });
        if (!error && data) r = data as unknown as Feedback;
      } catch {
        // fallback
      }

      if (!r) {
        const { evaluateQuestionAnswer, recordQuestionMistake } = await import("@/lib/medicalData");
        const ev = evaluateQuestionAnswer(q.id, sel);
        r = {
          correct: ev.correct,
          official: ev.official,
          explanation: ev.explanation,
          note: ev.note,
        };
        recordQuestionMistake(q.id, ev.correct);
      } else {
        // Always prioritize creator manual official-key overrides if any exist
        const kOv = getKeyOverride(q.id);
        if (kOv) {
          const official = kOv.correct ?? r.official ?? [];
          const sortedSel = [...sel].map((s) => s.toUpperCase()).sort().join(",");
          const sortedOff = [...official].map((s) => s.toUpperCase()).sort().join(",");
          r = {
            correct: sortedSel.length > 0 && sortedSel === sortedOff,
            official,
            explanation: kOv.explanation !== undefined ? kOv.explanation : r.explanation,
            note: kOv.note !== undefined ? kOv.note : r.note,
          };
        }
      }

      setFeedback((f) => ({ ...f, [q.id]: r! }));
      setStreak((s) => (r!.correct ? Math.max(1, s + 1) : Math.min(-1, s - 1)));
      play(r.correct ? "correct" : "wrong");
    } catch (e) {
      toast.error((e as Error).message || "Erreur de validation");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function finish() {
    if (!attempt || pending.current) return;
    pending.current = true;
    setBusy(true);

    try {
      let sum: Summary | null = null;
      try {
        const { data, error } = await supabase.rpc("finish_practice", { _attempt: attempt });
        if (!error && data) sum = data as unknown as Summary;
      } catch {
        // fallback
      }

      if (!sum) {
        const total = active.length;
        let correct = 0;
        let wrong = 0;
        const errors: string[] = [];

        for (const item of active) {
          const itemFb = feedback[item.id];
          if (itemFb) {
            if (itemFb.correct) correct++;
            else {
              wrong++;
              errors.push(item.id);
            }
          }
        }

        const unanswered = Math.max(0, total - correct - wrong);
        const score20 = total > 0 ? (correct / total) * 20 : 0;
        sum = {
          id: attempt,
          total,
          correct,
          wrong,
          unanswered,
          score20,
          errors,
        };

        // Award XP and coins durably by email
        if (me?.email && correct > 0) {
          saveProfileDurable(me.email, {
            xp: (me.xp || 120) + correct * 15,
            coins: (me.coins || 50) + correct * 2,
          });
        }
      }

      if (me && sum) {
        recordChallengeParticipation({
          userId: me.id,
          email: me.email,
          displayName: me.display_name,
          kind: "course",
          targetId: challengeId || attempt,
          ...(challengeTitle ? { targetTitle: challengeTitle } : {}),
          score20: sum.score20,
          durationSec: Math.max(1, sum.total * 30),
          correctCount: sum.correct,
          totalCount: sum.total,
        });
      }

      setSummary(sum);
      play("reveal");
      toast.success("Entraînement terminé ! 🎉");
    } catch (e) {
      toast.error((e as Error).message || "Erreur lors de l'enregistrement");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function restart(list: Question[], requireHeart = false) {
    if (requireHeart && onRequestNewAttempt && !onRequestNewAttempt()) {
      return;
    }
    setActive(list);
    setI(0);
    setAnswers({});
    setFeedback({});
    setSummary(null);
    setStreak(0);
  }

  if (!q) {
    return (
      <div className="card-game p-8 text-center text-muted-foreground">
        Aucune question disponible dans ce cours.
      </div>
    );
  }

  if (summary) {
    return (
      <section className="space-y-5 py-6 card-game p-6 animate-pop">
        <h2 className="font-display text-2xl font-bold">Résultats · نتائج المحاولة</h2>
        <p className="text-success font-semibold">✓ Tentative enregistrée avec succès</p>
        <div className="flex items-baseline gap-2">
          <strong className="font-display text-5xl font-bold text-primary">{summary.score20.toFixed(2)}</strong>
          <span className="text-2xl text-muted-foreground">/ 20</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="bg-success/10 border border-success/30 rounded-xl p-3 text-center">
            <span className="block text-xs text-muted-foreground">Correctes</span>
            <span className="font-display text-xl font-bold text-success">✅ {summary.correct}</span>
          </div>
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-center">
            <span className="block text-xs text-muted-foreground">Fausses</span>
            <span className="font-display text-xl font-bold text-destructive">❌ {summary.wrong}</span>
          </div>
          <div className="bg-muted border border-border rounded-xl p-3 text-center">
            <span className="block text-xs text-muted-foreground">Sans réponse</span>
            <span className="font-display text-xl font-bold">⏭ {summary.unanswered}</span>
          </div>
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 text-center">
            <span className="block text-xs text-muted-foreground">Taux de réussite</span>
            <span className="font-display text-xl font-bold text-primary">
              {summary.total > 0 ? Math.round((summary.correct / summary.total) * 100) : 0}%
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-3">
          {summary.errors.length > 0 && (
            <Button
              onClick={() => restart(active.filter((q) => summary.errors.includes(q.id)))}
              className="bg-destructive text-destructive-foreground font-semibold"
            >
              🔁 Rejouer mes erreurs ({summary.errors.length})
            </Button>
          )}
          <Button variant="outline" onClick={() => restart([...questions], true)}>
            🔄 Nouvelle tentative complète
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
      <div className="min-w-0">
        <div className="mb-3 flex justify-between text-sm font-medium text-muted-foreground">
          <span>
            Question {i + 1} / {active.length}
          </span>
          <span>{Object.keys(feedback).length} validées</span>
        </div>

        <QuestionCard
          q={q}
          index={q.pos || i + 1}
          selected={sel}
          disabled={busy || !!fb}
          reveal={fb?.official ?? null}
          mistake={mistakes.get(q.id)}
          onToggle={(k) =>
            setAnswers((a) => ({
              ...a,
              [q.id]: sel.includes(k) ? sel.filter((x) => x !== k) : [...sel, k].sort(),
            }))
          }
        />

        {fb && (
          <div className="mt-4 space-y-3 border-t border-border pt-4 card-game p-4">
            <div className="flex items-center gap-2">
              <span className={`text-base font-bold ${fb.correct ? "text-success" : "text-destructive"}`}>
                {fb.correct ? "✓ Bonne réponse !" : `❌ Réponse officielle : ${fb.official?.join(", ") || "A"}`}
              </span>
            </div>
            {fb.explanation && (
              <p className="whitespace-pre-line text-sm text-muted-foreground bg-muted/50 p-3 rounded-xl border border-border">
                💡 {fb.explanation}
              </p>
            )}
            {fb.note && <p className="whitespace-pre-line text-xs text-muted-foreground">📌 {fb.note}</p>}
            <AiExplain
              key={q.id}
              questionId={q.id}
              selected={sel}
              question={q}
              official={{
                correct: fb.official || [],
                explanation: fb.explanation || "",
                note: fb.note || null,
              }}
            />
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={i === 0 || busy}
            aria-label="Question précédente"
            onClick={() => {
              play("click");
              setI(i - 1);
            }}
          >
            ← Précédente
          </Button>

          {!fb && (
            <Button
              disabled={!sel.length || busy || !attempt}
              onClick={() => void validate()}
              className="bg-primary text-primary-foreground font-bold shadow-pop"
            >
              Valider (تأكيد)
            </Button>
          )}

          {i < active.length - 1 && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                play("click");
                setI(i + 1);
              }}
            >
              {fb ? "Suivante →" : "Passer →"}
            </Button>
          )}

          <Button
            variant="secondary"
            disabled={busy || !attempt}
            onClick={() => void finish()}
            className="ml-auto font-semibold"
          >
            Terminer (إنهاء)
          </Button>
        </div>
      </div>

      {me && (
        <div className="order-first flex justify-center lg:order-last lg:self-start card-game p-4">
          <Avatar config={me.avatar} pet={me.pet} mood={moodFrom(streak)} size={110} />
        </div>
      )}
    </div>
  );
}
