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
  head: () => ({ meta: [{ title: "Examen en cours — Z QCM GAME" }, { name: "description", content: "Examen chronométré." }] }),
  component: Play,
});

const LIMIT = 1800;

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

  const { data } = useQuery({
    queryKey: ["play", attemptId],
    queryFn: async () => {
      const { data: a } = await supabase.from("attempts").select("*").eq("id", attemptId).single();
      if (!a) throw new Error("Tentative introuvable");
      const [{ data: qs }, { data: exam }] = await Promise.all([
        supabase.from("questions").select("*").eq("exam_id", a.exam_id!).order("pos"),
        supabase.from("exams").select("title").eq("id", a.exam_id!).single(),
      ]);
      const mistakes = await fetchMistakesFor((qs ?? []).map((q) => q.id));
      return { a, qs: (qs ?? []) as unknown as Question[], exam, mistakes };
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    const s = localStorage.getItem(storeKey);
    if (s) setAnswers(JSON.parse(s));
  }, [storeKey]);
  useEffect(() => { if (data?.a.submitted_at) nav({ to: "/results/$attemptId", params: { attemptId } }); }, [data, nav, attemptId]);

  const submit = useCallback(async (auto = false) => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    play("submit");
    const cur = JSON.parse(localStorage.getItem(storeKey) || "{}");
    const { error } = await supabase.rpc("submit_attempt", { _attempt: attemptId, _answers: cur });
    if (error) { submitted.current = false; setSubmitting(false); return toast.error(error.message); }
    localStorage.removeItem(storeKey);
    if (auto) toast("⏰ Temps écoulé — copie soumise automatiquement");
    nav({ to: "/results/$attemptId", params: { attemptId } });
  }, [attemptId, nav, storeKey]);

  useEffect(() => {
    if (!data) return;
    const end = new Date(data.a.started_at).getTime() + LIMIT * 1000;
    const t = setInterval(() => {
      const l = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(l);
      if (l === 300) play("warning");
      if (l === 60) play("finalMinute");
      if (l === 0) { clearInterval(t); void submit(true); }
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
    // Live mood: cosmetic only, never affects scoring.
    if (!next.length) return;
    const { data: r } = await supabase.rpc("check_answer", { _q: q.id, _sel: next, _record: false });
    const ok = !!(r as { correct?: boolean } | null)?.correct;
    const prev = verdicts.current[q.id];
    verdicts.current[q.id] = ok;
    if (prev === ok) return;
    setStreak((s) => (ok ? (s > 0 ? s + 1 : 1) : s < 0 ? s - 1 : -1));
    play(ok ? "happy" : "sad");
  }

  if (!data || !me) return <div className="p-8 text-center">Chargement…</div>;
  const mood = moodFrom(streak);
  const answered = Object.values(answers).filter((v) => v.length).length;
  const moodText = { neutral: "Concentré·e 🧐", happy: "Bien joué ! 😊", veryHappy: "En feu !! 🔥🤩", sad: "Hmm… 😕", angry: "Grrr ! 😤" }[mood];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0"><div className="truncate font-semibold">{data.exam?.title}</div><div className="text-xs text-muted-foreground">{answered}/{data.qs.length} répondues</div></div>
          <div className={`rounded-xl px-3 py-1.5 font-display text-xl font-bold tabular-nums ${left <= 60 ? "bg-destructive text-destructive-foreground animate-pulse" : left <= 300 ? "bg-warning text-warning-foreground" : "bg-primary-soft text-primary"}`}>⏱ {fmtTime(left)}</div>
          <button disabled={submitting} onClick={() => { if (confirm("Soumettre ta copie ?")) void submit(); }} className="rounded-xl bg-hero px-4 py-2 text-sm font-semibold text-primary-foreground">Soumettre</button>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_240px]">
        <div className="space-y-4">
          {data.qs.map((q, i) => (
            <QuestionCard key={q.id} q={q} index={i + 1} selected={answers[q.id] ?? []} onToggle={(k) => toggle(q, k)} mistake={data.mistakes.get(q.id)} />
          ))}
          <button disabled={submitting} onClick={() => void submit()} className="w-full rounded-xl bg-hero py-3 font-semibold text-primary-foreground shadow-pop">Soumettre ma copie</button>
        </div>
        <aside className="order-first lg:order-last">
          <div className="card-game sticky top-20 flex flex-row items-center gap-3 p-3 lg:flex-col lg:p-4">
            <Avatar config={me.avatar} mood={mood} pet={me.pet} size={90} className="lg:hidden" />
            <Avatar config={me.avatar} mood={mood} pet={me.pet} size={170} className="hidden lg:inline-block" />
            <div className="text-sm font-semibold">{moodText}</div>
            <div className="hidden w-full grid-cols-6 gap-1 lg:grid">
              {data.qs.map((q, i) => (
                <a key={q.id} href={`#q-${q.id}`} onClick={() => play("nav")} className={`grid h-7 place-items-center rounded-md text-[10px] font-bold ${answers[q.id]?.length ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{i + 1}</a>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
