import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

export function AiExplain({ questionId, selected }: { questionId: string; selected: string[] }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(history: Msg[]) {
    setBusy(true); setErr(null);
    const { data: s } = await supabase.auth.getSession();
    const res = await fetch("/api/ai-explain", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
      body: JSON.stringify({ questionId, selected, messages: history }),
    });
    if (!res.ok || !res.body) {
      setBusy(false);
      const t = await res.text().catch(() => "");
      return setErr(res.status === 402 ? "Crédits IA épuisés." : res.status === 429 ? "Trop de demandes, réessaie dans un instant." : t || "Erreur IA");
    }
    let text = "";
    setMsgs([...history, { role: "assistant", content: "" }]);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data: ")) continue;
        try {
          const ev = JSON.parse(l.slice(6));
          if (ev.type === "response.output_text.delta") { text += ev.delta; setMsgs([...history, { role: "assistant", content: text }]); }
          if (ev.type === "error" || ev.type === "response.failed") setErr("Erreur IA");
        } catch { /* partial */ }
      }
    }
    if (!text) setErr("Aucune réponse de l'IA.");
    setBusy(false);
  }

  if (!open) return <button onClick={() => { setOpen(true); void send([]); }} className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">🤖 Expliquer avec l'IA</button>;
  return (
    <div className="mt-3 rounded-xl border bg-secondary/60 p-3">
      <div className="mb-2 text-xs font-semibold text-primary">🤖 Dr Z-Bot · la réponse officielle n'est jamais modifiée</div>
      <div className="max-h-80 space-y-2 overflow-y-auto text-sm">
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-8 rounded-xl bg-primary p-2 text-primary-foreground" : "whitespace-pre-line"}>{m.content || "…"}</div>
        ))}
        {err && <div className="text-destructive">{err}</div>}
      </div>
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!input.trim() || busy) return; const h = [...msgs, { role: "user" as const, content: input.trim().slice(0, 500) }]; setMsgs(h); setInput(""); void send(h); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder="Pose une question de suivi…" className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm" />
        <button disabled={busy} className="rounded-lg bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50">➤</button>
      </form>
    </div>
  );
}
