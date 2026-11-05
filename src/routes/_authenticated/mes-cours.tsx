import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { generateLessonQuiz } from "@/lib/lesson.functions";
import { pageMetadata } from "@/lib/metadata";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/mes-cours")({
  head: () => pageMetadata("Mes cours PDF", "Ajoutez un cours PDF et générez des QCM ou QCS pour réviser."),
  component: MyLessons,
});
type Q = { stem: string; options: { key: string; text: string }[]; correct: string[]; explanation: string };

function MyLessons() {
  const gen = useServerFn(generateLessonQuiz);
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [qtype, setQtype] = useState<"QCM" | "QCS">("QCM");
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const { data: quizzes } = useQuery({ queryKey: ["lesson-quizzes"], queryFn: async () => (await supabase.from("lesson_quizzes").select("*").order("created_at", { ascending: false })).data ?? [] });

  async function create() {
    if (!file || file.type !== "application/pdf" || file.size > 20e6) return toast.error("Choisissez un PDF de moins de 20 Mo.");
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const path = `${u.user!.id}/${crypto.randomUUID()}.pdf`;
      const up = await supabase.storage.from("lesson-pdfs").upload(path, file, { contentType: "application/pdf" });
      if (up.error) throw up.error;
      const r = await gen({ data: { path, title: title || file.name.replace(/\.pdf$/i, ""), qtype, count } });
      toast.success(`${r.count} questions créées`); play("reward");
      void qc.invalidateQueries({ queryKey: ["lesson-quizzes"] });
    } catch { toast.error("La création a échoué. Réessayez avec un PDF lisible."); }
    finally { setBusy(false); }
  }

  return <AppShell>
    <PageTitle title="Mes cours PDF" ar="دروسي" sub="Les questions sont générées depuis votre cours et doivent être vérifiées." />
    <section className="card-game space-y-4 p-4">
      <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Input placeholder="Titre du cours" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      <div className="flex gap-2">{(["QCM", "QCS"] as const).map((t) => <Button key={t} variant={qtype === t ? "default" : "outline"} onClick={() => setQtype(t)}>{t}</Button>)}</div>
      <label className="block text-sm">Nombre de questions : <strong>{count}</strong>
        <input className="w-full accent-primary" type="range" min={1} max={40} value={count} onChange={(e) => setCount(+e.target.value)} /></label>
      <Button className="w-full" disabled={busy || !file} onClick={() => void create()}>{busy ? "Création en cours…" : "Créer les questions"}</Button>
    </section>
    <div className="mt-6 space-y-3">{quizzes?.map((z) => <LessonQuiz key={z.id} title={z.title} qtype={z.qtype} questions={z.questions as Q[]} />)}</div>
  </AppShell>;
}

function LessonQuiz({ title, qtype, questions }: { title: string; qtype: string; questions: Q[] }) {
  const [open, setOpen] = useState(false);
  const [ans, setAns] = useState<Record<number, string[]>>({});
  const [done, setDone] = useState(false);
  const score = questions.filter((q, i) => [...(ans[i] ?? [])].sort().join() === [...q.correct].sort().join()).length;
  return <article className="card-game p-4">
    <button className="w-full text-left font-semibold" onClick={() => setOpen(!open)}>{title} · {qtype} · {questions.length} questions</button>
    {open && <div className="mt-4 space-y-5">
      {questions.map((q, i) => <div key={i}><p className="font-medium">{i + 1}. {q.stem}</p>
        {q.options.map((o) => { const s = ans[i]?.includes(o.key); const ok = q.correct.includes(o.key);
          return <button key={o.key} disabled={done} onClick={() => setAns((a) => ({ ...a, [i]: qtype === "QCS" ? [o.key] : s ? a[i]!.filter((x) => x !== o.key) : [...(a[i] ?? []), o.key] }))}
            className={`mt-1 block w-full rounded-lg border p-2 text-left text-sm ${done && ok ? "border-success bg-success/10" : s ? "border-primary bg-primary-soft" : ""}`}>{o.key}. {o.text}</button>; })}
        {done && <p className="mt-1 text-sm text-muted-foreground">{q.explanation}</p>}</div>)}
      {done ? <p className="font-display text-2xl">{score}/{questions.length}</p> : <Button onClick={() => { setDone(true); play("reveal"); }}>Corriger</Button>}
    </div>}
  </article>;
}
