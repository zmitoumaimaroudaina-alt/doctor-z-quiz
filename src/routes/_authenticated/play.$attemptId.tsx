import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { QuestionCard } from "@/components/QuestionCard";
import { useMe } from "@/hooks/useMe";
import { fetchMistakesFor, type Question } from "@/lib/queries";
import { fmtTime, moodFrom } from "@/lib/game";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/play/$attemptId")({
  component: Play,
});

const LIMIT = 3600;

function Play() {
  const { attemptId } = Route.useParams();
  const nav = useNavigate();
  const { data: me } = useMe();
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
      const { data: a, error: aErr } = await supabase
        .from("attempts")
        .select("*")
        .eq("id", attemptId)
        .maybeSingle();

      if (aErr || !a) throw new Error("Tentative introuvable");

      const [{ data: qs }, { data: exam }] = await Promise.all([
        supabase.from("questions").select("*").eq("exam_id", a.exam_id!).order("pos"),
        supabase.from("exams").select("title").eq("id", a.exam_id!).maybeSingle(),
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

      return { a, qs: (qs ?? []) as unknown as Question[], exam, mistakes };
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
      const { error } = await supabase.rpc("submit_attempt", {
        _attempt: attemptId,
        _answers: cur,
      });
      if (error) {
        submitted.current = false;
        setSubmitting(false);
        { toast.error(error.message); return; }
      }
      localStorage.removeItem(storeKey);
      if (auto) toast("⏰ Temps écoulé — copie soumise automatiquement");
      nav({ to: "/results/$attemptId", params: { attemptId } });
    },
    [attemptId, nav, storeKey]
  );

  useEffect(() => {
    if (!data?.a?.started_at) return;
    const end = new Date(data.a.started_at).getTime() + LIMIT * 1000;
    const t = setInterval(() => {
      const l = Math.max(0, Math.round((end - Date.now()) / 1000));
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

    if (!next.length) return;
    try {
      const { data: r } = await supabase.rpc("check_answer", {
        _q: q.id,
        _sel: next,
        _record: false,
      });
      const ok = !!(r as { correct?: boolean } | null)?.correct;
      const prev = verdicts.current[q.id];
      verdicts.current[q.id] = ok;
      if (prev === ok) return;
      setStreak((s) => (ok ? (s > 0 ? s + 1 : 1) : s < 0 ? s - 1 : -1));
      play(ok ? "happy" : "sad");
    } catch (e) {
      console.warn("Check answer failed:", e);
    }
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
          <div><h1 className="font-display font-bold">{data.exam?.title}</h1><p className="text-xs text-muted-foreground">{answered}/{data.qs.length} réponses</p></div>
          <div className="flex items-center gap-2"><Avatar config={me?.avatar} mood={mood} size={48} /><div><strong className={left < 300 ? "text-destructive" : "text-primary"}>{fmtTime(left)}</strong><p className="text-xs">{moodText}</p></div></div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {data.qs.map((q, i) => <QuestionCard key={q.id} q={q} index={i + 1} selected={answers[q.id] ?? []} onToggle={(k) => void toggle(q, k)} />)}
        <Button disabled={submitting} onClick={() => void submit()} className="w-full">{submitting ? "Enregistrement…" : "Terminer et enregistrer"}</Button>
      </main>
    </div>
  );
}