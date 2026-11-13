import { pageMetadata } from "@/lib/metadata";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { QuestionCard } from "@/components/QuestionCard";
import { useMe, useRefreshMe } from "@/hooks/useMe";
import { fetchMistakesFor, type Question } from "@/lib/queries";
import { fmtTime, moodFrom, EXAM_DURATION_SECONDS, examSecondsLeft } from "@/lib/game";
import { evaluateQuestionAnswer, getBundledExam, normalizeExamTitle, recordQuestionMistake } from "@/lib/medicalData";
import { saveProfileDurable } from "@/lib/profileStore";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/play/$attemptId")({
  head: () => pageMetadata("Examen en cours", "Examen médical chronométré de la Faculté de Médecine de Blida."),
  component: Play,
});

const LIMIT = EXAM_DURATION_SECONDS;

function extractExamIdFromAttemptId(attemptId: string): string | null {
  if (!attemptId.startsWith("local_exam_")) return null;
  const withoutPrefix = attemptId.slice("local_exam_".length);
  const lastUnderscore = withoutPrefix.lastIndexOf("_");
  return lastUnderscore > 0 ? withoutPrefix.slice(0, lastUnderscore) : withoutPrefix;
}

function Play() {
  const { attemptId } = Route.useParams();
  const nav = useNavigate();
  const { data: me } = useMe();
  const refreshMe = useRefreshMe();
  const storeKey = `zqcm-ans-${attemptId}`;
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [left, setLeft] = useState(LIMIT);
  const [streak, setStreak] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);
  const verdicts = useRef<Record<string, boolean>>({});

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["play", attemptId],
    queryFn: async () => {
      if (!attemptId.startsWith("local_exam_")) {
        try {
          const { data: a } = await supabase
            .from("attempts")
            .select("*")
            .eq("id", attemptId)
            .maybeSingle();

          if (a && a.exam_id) {
            const [{ data: qs }, { data: exam }] = await Promise.all([
              supabase.from("questions").select("*").eq("exam_id", a.exam_id).order("pos"),
              supabase.from("exams").select("title,year,unit").eq("id", a.exam_id).maybeSingle(),
            ]);

            let mistakes = new Map();
            try {
              if (qs && qs.length > 0) {
                const res = await fetchMistakesFor(qs.map((q) => q.id));
                if (res) mistakes = res;
              }
            } catch (e) {
              console.warn("Could not fetch mistakes:", e);
            }

            setAnswers((a.answers as Record<string, string[]>) || {});
            return {
              a,
              qs: (qs ?? []) as unknown as Question[],
              exam: exam ? { title: normalizeExamTitle(exam) } : { title: "Unité 01 ; cardio 🫀 3 ème année med" },
              mistakes,
            };
          }
        } catch {
          // fallback below
        }
      }

      const localStr = localStorage.getItem(`attempt_${attemptId}`);
      let localA = localStr ? JSON.parse(localStr) : null;
      const examId = localA?.exam_id || extractExamIdFromAttemptId(attemptId) || "exam-uei1-2025";
      if (!localA) {
        localA = {
          id: attemptId,
          exam_id: examId,
          started_at: new Date().toISOString(),
          answers: {},
          duration_sec: 3600,
        };
        localStorage.setItem(`attempt_${attemptId}`, JSON.stringify(localA));
      }

      const bundled = getBundledExam(examId);
      setAnswers((localA.answers as Record<string, string[]>) || {});
      return {
        a: localA,
        qs: bundled.questions,
        exam: bundled.exam ? { title: bundled.exam.title } : { title: "Unité 01 ; cardio 🫀 3 ème année med" },
        mistakes: new Map(),
      };
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    const s = localStorage.getItem(storeKey);
    if (s) {
      try {
        setAnswers(JSON.parse(s));
      } catch {
        setAnswers({});
      }
    }
  }, [storeKey]);

  useEffect(() => {
    if (data?.a?.submitted_at) {
      nav({ to: "/results/$attemptId", params: { attemptId } });
    }
  }, [data, nav, attemptId]);

  const submit = useCallback(
    async (auto = false) => {
      if (submitted.current) return;
      submitted.current = true;
      setSubmitting(true);
      play("submit");
      const cur = JSON.parse(localStorage.getItem(storeKey) || "{}");

      if (!attemptId.startsWith("local_exam_")) {
        try {
          await supabase.rpc("submit_attempt", {
            _attempt: attemptId,
            _answers: cur,
          });
        } catch {
          // fallback
        }
      }

      const qs = data?.qs || [];
      let correctCount = 0;
      let wrongCount = 0;
      for (const item of qs) {
        const userSel = cur[item.id] || [];
        if (userSel.length) {
          const ev = evaluateQuestionAnswer(item.id, userSel);
          recordQuestionMistake(item.id, ev.correct);
          if (ev.correct) correctCount++;
          else wrongCount++;
        } else {
          recordQuestionMistake(item.id, false);
        }
      }
      const unansweredCount = Math.max(0, qs.length - correctCount - wrongCount);
      const score20 = qs.length > 0 ? (correctCount / qs.length) * 20 : 0;

      // Save updated answers in local attempt for error review
      try {
        const prevLocal = JSON.parse(localStorage.getItem(`attempt_${attemptId}`) || "{}");
        localStorage.setItem(
          `attempt_${attemptId}`,
          JSON.stringify({
            ...prevLocal,
            id: attemptId,
            exam_id: data?.a?.exam_id || prevLocal.exam_id || "exam-uei1-2025",
            answers: cur,
            submitted_at: new Date().toISOString(),
          }),
        );
      } catch {
        // ignore
      }

      const localResult = {
        id: attemptId,
        exam_id: data?.a?.exam_id || "exam-uei1-2025",
        score20,
        correct_count: correctCount,
        wrong_count: wrongCount,
        unanswered_count: unansweredCount,
        duration_sec: Math.max(1, 3600 - (left || 0)),
        attempt_number: 1,
        submitted_at: new Date().toISOString(),
      };
      localStorage.setItem(`result_${attemptId}`, JSON.stringify(localResult));

      if (me?.email && correctCount > 0) {
        saveProfileDurable(me.email, {
          xp: (me.xp || 0) + correctCount * 15,
          coins: (me.coins || 0) + correctCount * 2,
        });
        refreshMe();
      }

      localStorage.removeItem(storeKey);
      if (auto) toast("⏰ Temps écoulé — copie soumise automatiquement");
      nav({ to: "/results/$attemptId", params: { attemptId } });
    },
    [attemptId, data, left, me, nav, refreshMe, storeKey],
  );

  useEffect(() => {
    if (!data?.a?.started_at) return;
    const tick = () => {
      const l = examSecondsLeft(data.a.started_at);
      setLeft(l);
      if (l === 0) void submit(true);
    };
    tick();
    const t = setInterval(() => {
      const l = examSecondsLeft(data.a.started_at);
      setLeft(l);
      if (l === 300) play("warning");
      if (l === 60) play("finalMinute");
      if (l === 0) {
        clearInterval(t);
        void submit(true);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [data, submit]);

  async function toggle(q: Question, k: string) {
    const cur = answers[q.id] ?? [];
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k].sort();
    play(cur.length ? "change" : "select");
    const all = { ...answers, [q.id]: next };
    setAnswers(all);
    localStorage.setItem(storeKey, JSON.stringify(all));

    const isLocalAttempt = attemptId.startsWith("local_exam_");
    if (isLocalAttempt) {
      try {
        const prevLocal = JSON.parse(localStorage.getItem(`attempt_${attemptId}`) || "{}");
        localStorage.setItem(`attempt_${attemptId}`, JSON.stringify({ ...prevLocal, answers: all }));
      } catch {
        // ignore
      }
    } else {
      try {
        const { error: saveError } = await supabase.rpc("save_exam_answers", { _attempt: attemptId, _answers: all });
        if (saveError) {
          toast.error("Réponse non enregistrée : vérifie la connexion.");
          return;
        }
      } catch {
        // fallback locally
      }
    }

    if (!next.length) return;
    let ok = false;
    if (!isLocalAttempt) {
      try {
        const { data: r } = await supabase.rpc("check_answer", {
          _q: q.id,
          _sel: next,
          _record: false,
        });
        ok = !!(r as { correct?: boolean } | null)?.correct;
      } catch {
        ok = evaluateQuestionAnswer(q.id, next).correct;
      }
    } else {
      ok = evaluateQuestionAnswer(q.id, next).correct;
    }

    const prev = verdicts.current[q.id];
    verdicts.current[q.id] = ok;
    if (prev === ok) return;
    setStreak((s) => (ok ? (s > 0 ? s + 1 : 1) : s < 0 ? s - 1 : -1));
    play(ok ? "happy" : "sad");
  }

  if (isLoading) {
    return <div className="p-8 text-center font-semibold">Chargement de l'examen… ⏳</div>;
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-center text-destructive">
        Une erreur est survenue : {(error as Error)?.message || "Impossible de charger l'examen"}
      </div>
    );
  }

  const mood = moodFrom(streak);
  const answered = Object.values(answers).filter((v) => v.length).length;
  const moodText =
    {
      neutral: "Concentré·e 🧐",
      happy: "Bien joué ! 😊",
      veryHappy: "En feu !! 🔥🤩",
      sad: "Hmm… 😕",
      angry: "Grrr ! 😤",
    }[mood] || "Concentré·e 🧐";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
          <div>
            <h1 className="font-display font-bold">{data.exam?.title}</h1>
            <p className="text-xs text-muted-foreground">
              {answered}/{data.qs.length} réponses
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Avatar config={me?.avatar} mood={mood} size={48} />
            <div>
              <strong className={left < 300 ? "text-destructive" : "text-primary"}>{fmtTime(left)}</strong>
              <p className="text-xs">{moodText}</p>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {data.qs.map((q) => (
          <QuestionCard
            key={q.id}
            q={q}
            index={q.pos}
            selected={answers[q.id] ?? []}
            onToggle={(k) => void toggle(q, k)}
          />
        ))}
        <Button disabled={submitting} onClick={() => void submit()} className="w-full">
          {submitting ? "Enregistrement…" : "Terminer et enregistrer"}
        </Button>
      </main>
    </div>
  );
}