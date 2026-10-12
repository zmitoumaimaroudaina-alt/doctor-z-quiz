import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QuestionCard } from "./QuestionCard";
import { Avatar } from "./Avatar";
import { AiExplain } from "./AiExplain";
import { useMe } from "@/hooks/useMe";
import { fetchMistakesFor, type Question } from "@/lib/queries";
import { moodFrom } from "@/lib/game";
import { play } from "@/lib/sound";

type Feedback = { correct: boolean; official: string[] | null; explanation: string | null; note: string | null };

/** One-question-at-a-time practice with immediate official correction (courses + previous mistakes). */
export function Practice({ questions }: { questions: Question[] }) {
  const { data: me } = useMe();
  const [i, setI] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [streak, setStreak] = useState(0);
  const [mistakes, setMistakes] = useState<Map<string, { corrected_at: string | null }>>(new Map());
  const [score, setScore] = useState({ ok: 0, done: 0 });

  useEffect(() => { void fetchMistakesFor(questions.map((q) => q.id)).then(setMistakes); }, [questions]);
  const q = questions[i];
  if (!q) return <div className="card-game p-8 text-center">Aucune question.</div>;

  async function validate() {
    if (!sel.length) return;
    const { data } = await supabase.rpc("check_answer", { _q: q.id, _sel: sel, _record: true });
    const r = data as unknown as Feedback;
    setFb(r);
    setScore((s) => ({ ok: s.ok + (r.correct ? 1 : 0), done: s.done + 1 }));
    setStreak((s) => (r.correct ? (s > 0 ? s + 1 : 1) : s < 0 ? s - 1 : -1));
    play(r.correct ? "correct" : "wrong");
    setMistakes((m) => {
      const n = new Map(m);
      if (!r.correct) n.set(q.id, { corrected_at: null });
      else if (n.has(q.id)) n.set(q.id, { corrected_at: new Date().toISOString() });
      return n;
    });
  }
  function next(d = 1) { play("nav"); setI((x) => Math.min(questions.length - 1, Math.max(0, x + d))); setSel([]); setFb(null); }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_200px]">
      <div>
        <div className="mb-3 flex items-center justify-between text-sm">
          <span>Question {i + 1} / {questions.length}</span>
          <span className="font-semibold">✅ {score.ok} / {score.done}</span>
        </div>
        <QuestionCard q={q} index={i + 1} selected={sel} disabled={!!fb} reveal={fb?.official ?? null} mistake={mistakes.get(q.id)}
          onToggle={(k) => { play("select"); setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k].sort())); }} />
        {fb && (
          <div className={`card-game mt-3 p-4 animate-pop ${fb.correct ? "border-success" : "border-destructive"}`}>
            <p className="font-semibold">{fb.correct ? "✅ Bonne réponse !" : `❌ Réponse officielle : ${fb.official?.join(", ") || "non disponible dans la source"}`}</p>
            {!fb.correct && <p className="ar mt-2 font-semibold">⚠️ ركز! راجع درسك مليح.</p>}
            {fb.explanation && <p className="mt-2 whitespace-pre-line rounded-lg bg-secondary p-2 text-sm"><b>Explication officielle :</b> {fb.explanation}</p>}
            {!fb.correct && fb.note && <p className="ar mt-2 rounded-lg bg-warning/20 p-2 text-sm">📝 ملاحظة: {fb.note}</p>}
            {!fb.correct && <AiExplain questionId={q.id} selected={sel} />}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button onClick={() => next(-1)} disabled={i === 0} className="rounded-xl border px-4 py-2.5 disabled:opacity-40">←</button>
          {!fb ? (
            <button onClick={validate} disabled={!sel.length} className="flex-1 rounded-xl bg-hero py-2.5 font-semibold text-primary-foreground disabled:opacity-50">Valider</button>
          ) : (
            <button onClick={() => next(1)} disabled={i === questions.length - 1} className="flex-1 rounded-xl bg-primary py-2.5 font-semibold text-primary-foreground disabled:opacity-50">Suivante →</button>
          )}
          <button onClick={() => next(1)} disabled={i === questions.length - 1} className="rounded-xl border px-4 py-2.5 disabled:opacity-40">Passer</button>
        </div>
      </div>
      {me && <div className="card-game order-first flex items-center justify-center p-3 lg:order-last lg:self-start"><Avatar config={me.avatar} pet={me.pet} mood={moodFrom(streak)} size={130} /></div>}
    </div>
  );
}
