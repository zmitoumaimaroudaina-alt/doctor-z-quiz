import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { Practice } from "@/components/Practice";
import type { Question } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/mes-erreurs")({
  head: () => ({ meta: [{ title: "QCM أخطائي السابقة — Z QCM GAME" }, { name: "description", content: "Rejoue les questions que tu as ratées." }] }),
  component: MesErreurs,
});

function MesErreurs() {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const { data } = useQuery({
    queryKey: ["my-mistakes"],
    queryFn: async () => {
      const { data: m } = await supabase.from("question_mistakes").select("question_id, corrected_at, wrong_count").order("last_wrong_at", { ascending: false }).limit(500);
      const ids = (m ?? []).map((x) => x.question_id);
      const { data: qs } = ids.length ? await supabase.from("questions").select("*").in("id", ids) : { data: [] };
      const byId = new Map((qs ?? []).map((q) => [q.id, q]));
      return (m ?? []).map((x) => ({ ...x, q: byId.get(x.question_id) as unknown as Question })).filter((x) => x.q);
    },
  });
  const list = (data ?? []).filter((x) => filter === "all" || !x.corrected_at);
  const open = (data ?? []).filter((x) => !x.corrected_at).length;
  return (
    <AppShell wide>
      <PageTitle title="📚 QCM أخطائي السابقة" sub={`${open} erreur(s) à corriger · ${(data?.length ?? 0) - open} corrigée(s). N'affecte ni score, ni rang, ni cœurs.`} />
      <div className="mb-4 flex gap-2">
        {(["open", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-4 py-1.5 text-sm ${filter === f ? "bg-primary text-primary-foreground" : "bg-card border"}`}>{f === "open" ? "❌ À corriger" : "Historique complet"}</button>
        ))}
      </div>
      {data && (list.length ? <Practice key={filter} questions={list.map((x) => x.q)} /> : <div className="card-game p-8 text-center">Aucune erreur ici 🎉</div>)}
    </AppShell>
  );
}
