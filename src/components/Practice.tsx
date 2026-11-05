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

type Feedback = { correct: boolean; official: string[] | null; explanation: string | null; note: string | null };
type Summary = { id: string; total: number; correct: number; wrong: number; unanswered: number; score20: number; errors: string[] };
export function Practice({ questions }: { questions: Question[] }) {
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
    let cancelled = false;
    if (!active.length) return;
    setAttempt(null);
    void (async () => {
      const { data: id, error } = await supabase.rpc("start_practice", { _questions: active.map(q => q.id) });
      if (error || !id) { toast.error("Impossible de démarrer la tentative."); return; }
      const { data: saved } = await supabase.from("practice_attempts").select("answers").eq("id", id).single();
      const m = await fetchMistakesFor(active.map(q => q.id));
      if (!cancelled) { setAttempt(id); setAnswers((saved?.answers ?? {}) as Record<string, string[]>); setMistakes(m); }
    })();
    return () => { cancelled = true; };
  }, [active]);
  const q = active[i];
  const sel = q ? answers[q.id] ?? [] : [];
  const fb = q ? feedback[q.id] : undefined;
  async function validate() {
    if (!q || !attempt || !sel.length || pending.current || fb) return;
    pending.current = true; setBusy(true);
    try {
      const { data, error } = await supabase.rpc("answer_practice", { _attempt: attempt, _q: q.id, _sel: sel });
      if (error || !data) throw new Error("La réponse n'a pas été enregistrée.");
      const r = data as unknown as Feedback;
      setFeedback(f => ({ ...f, [q.id]: r }));
      setStreak(s => r.correct ? Math.max(1, s + 1) : Math.min(-1, s - 1));
      play(r.correct ? "laugh" : streak < 0 ? "angry" : "cry");
    } catch (e) { toast.error((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }
  async function finish() {
    if (!attempt || pending.current) return;
    pending.current = true; setBusy(true);
    try {
      const { data, error } = await supabase.rpc("finish_practice", { _attempt: attempt });
      if (error || !data) throw new Error("Impossible d'enregistrer les résultats.");
      setSummary(data as unknown as Summary); play("reveal");
    } catch (e) { toast.error((e as Error).message); }
    finally { pending.current = false; setBusy(false); }
  }
  function restart(list: Question[]) {
    setActive(list); setI(0); setAnswers({}); setFeedback({}); setSummary(null); setStreak(0);
  }
  if (!q) return <p>Aucune question.</p>;
  if (summary) return <section className="space-y-5 py-6">
    <h2 className="font-display text-2xl font-bold">Résultats · نتائج المحاولة</h2>
    <p className="text-success">✓ Tentative enregistrée</p>
    <strong className="font-display text-4xl">{summary.score20.toFixed(2)}/20</strong>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="bg-muted p-3">Correctes : {summary.correct}</div><div className="bg-muted p-3">Fausses : {summary.wrong}</div>
      <div className="bg-muted p-3">Sans réponse : {summary.unanswered}</div><div className="bg-muted p-3">{Math.round(summary.correct / summary.total * 100)}%</div>
    </div>
    <div className="flex flex-wrap gap-3"><Button disabled={!summary.errors.length} onClick={() => restart(active.filter(q => summary.errors.includes(q.id)))}>Rejouer les erreurs ({summary.errors.length})</Button>
    <Button variant="outline" onClick={() => restart([...questions])}>Nouvelle tentative complète</Button></div>
  </section>;
  return <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
    <div className="min-w-0">
      <div className="mb-3 flex justify-between text-sm"><span>Question {i + 1} / {active.length}</span><span>{Object.keys(feedback).length} validées</span></div>
      <QuestionCard q={q} index={q.pos} selected={sel} disabled={busy || !!fb} reveal={fb?.official ?? null} mistake={mistakes.get(q.id)}
        onToggle={k => setAnswers(a => ({ ...a, [q.id]: sel.includes(k) ? sel.filter(x => x !== k) : [...sel, k].sort() }))} />
      {fb && <div className="mt-3 space-y-2 border-t py-3">
        <p className={fb.correct ? "text-success" : "text-destructive"}>{fb.correct ? "Bonne réponse ✓" : `Réponse officielle : ${fb.official?.join(", ") || "à vérifier"}`}</p>
        {fb.explanation && <p className="whitespace-pre-line text-sm">{fb.explanation}</p>}
        {fb.note && <p className="whitespace-pre-line text-sm">{fb.note}</p>}
        {!fb.correct && <AiExplain questionId={q.id} selected={sel} />}
      </div>}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" disabled={i === 0 || busy} aria-label="Question précédente" onClick={() => setI(i - 1)}>←</Button>
        {!fb && <Button disabled={!sel.length || busy || !attempt} onClick={() => void validate()}>Valider</Button>}
        {i < active.length - 1 && <Button variant="outline" disabled={busy} onClick={() => setI(i + 1)}>{fb ? "Suivante →" : "Passer →"}</Button>}
        <Button disabled={busy || !attempt} onClick={() => void finish()}>Terminer et enregistrer</Button>
      </div>
    </div>
    {me && <div className="order-first flex justify-center lg:order-last lg:self-start"><Avatar config={me.avatar} pet={me.pet} mood={moodFrom(streak)} size={100} /></div>}
  </div>;
}
