import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { pageMetadata } from "@/lib/metadata";

export const Route = createFileRoute("/_authenticated/discussion")({
  head: () => pageMetadata("Discussion des étudiants", "Commentaires, remarques et discussion entre étudiants en médecine de Blida."),
  component: Discussion,
});

function Discussion() {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"chat" | "feedback">("chat");
  const { data } = useQuery({ queryKey: ["discussion"], queryFn: async () =>
    (await supabase.from("discussion_messages").select("id,body,kind,created_at,profiles(display_name)").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  useEffect(() => {
    const ch = supabase.channel(`discussion-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "discussion_messages" }, () => void qc.invalidateQueries({ queryKey: ["discussion"] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);
  async function send() {
    const text = body.trim();
    if (!text || text.length > 1000) return;
    const { error } = await supabase.from("discussion_messages").insert({ body: text, kind });
    if (error) return toast.error("Message non envoyé.");
    setBody("");
  }
  return <AppShell>
    <PageTitle title="Discussion" ar="تعليقات ودردشة الطلبة" />
    <div className="card-game space-y-3 p-4">
      <div className="flex gap-2"><Button variant={kind === "chat" ? "default" : "outline"} onClick={() => setKind("chat")}>💬 Discussion</Button>
        <Button variant={kind === "feedback" ? "default" : "outline"} onClick={() => setKind("feedback")}>📝 Remarque</Button></div>
      <Textarea value={body} maxLength={1000} onChange={(e) => setBody(e.target.value)} placeholder="Écrivez votre message… اكتب رسالتك" />
      <Button className="w-full" disabled={!body.trim()} onClick={() => void send()}>Envoyer</Button>
    </div>
    <div className="mt-5 space-y-3">{data?.map((m) => <div key={m.id} className="card-game p-3">
      <div className="text-xs text-muted-foreground">{m.kind === "feedback" ? "📝" : "💬"} {m.profiles?.display_name ?? "Étudiant"} · {new Date(m.created_at).toLocaleString("fr-DZ")}</div>
      <p className="mt-1 whitespace-pre-wrap">{m.body}</p></div>)}</div>
  </AppShell>;
}
