import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Brand } from "@/components/AppShell";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Z QCM GAME" },
      { name: "description", content: "Connecte-toi ou crée ton compte Z QCM GAME." },
      { property: "og:title", content: "Connexion — Z QCM GAME" },
      { property: "og:description", content: "Connecte-toi pour jouer aux QCM médicaux de Blida 1." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) nav({ to: "/home" }); });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (s) {
        if (e === "SIGNED_IN") qc.removeQueries({ queryKey: ["me"] });
        nav({ to: "/home" });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [nav, qc]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/home" } });
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    if (mode === "up" && !res.data.session) toast.success("Vérifie ta boîte mail pour confirmer ton compte 📩");
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(String(r.error.message ?? r.error));
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card-game w-full max-w-sm p-6 animate-pop">
        <Brand />
        <h1 className="mt-6 font-display text-2xl font-bold">{mode === "in" ? "Connexion" : "Créer un compte"}</h1>
        <p className="ar text-sm text-muted-foreground">{mode === "in" ? "تسجيل الدخول" : "إنشاء حساب"}</p>
        <button onClick={google} className="mt-5 w-full rounded-xl border bg-card py-2.5 text-sm font-semibold hover:bg-muted">Continuer avec Google</button>
        <div className="my-4 text-center text-xs text-muted-foreground">ou</div>
        <form onSubmit={submit} className="space-y-3">
          <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm" />
          <input required type="password" minLength={6} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm" />
          <button disabled={busy} className="w-full rounded-xl bg-hero py-2.5 font-semibold text-primary-foreground shadow-pop disabled:opacity-60">{busy ? "…" : mode === "in" ? "Se connecter" : "S'inscrire"}</button>
        </form>
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 w-full text-center text-sm text-primary">
          {mode === "in" ? "Pas de compte ? Inscris-toi" : "Déjà inscrit ? Connecte-toi"}
        </button>
      </div>
    </div>
  );
}