import { pageMetadata } from "@/lib/metadata";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/AppShell";
import {
  buildDefaultProfile,
  getAccountByEmail,
  getSavedProfileByEmail,
  normalizeEmail,
  saveAccount,
  saveProfileDurable,
  setActiveSessionUser,
} from "@/lib/profileStore";

export const Route = createFileRoute("/auth")({
  head: () => pageMetadata("Connexion", "Connexion et inscription par email et mot de passe à Doctor Z Quiz."),
  component: AuthPage,
});

export function AuthPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        nav({ to: "/home" });
        return;
      }
      const local = localStorage.getItem("doctorz_user");
      if (local) {
        nav({ to: "/home" });
      }
    });

    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (s) {
        if (e === "SIGNED_IN") qc.removeQueries({ queryKey: ["me"] });
        nav({ to: "/home" });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [nav, qc]);

  function loginLocally(userEmail: string, displayName: string, isCreator = false, userId?: string) {
    const cleanEmail = normalizeEmail(userEmail);
    const existingAccount = getAccountByEmail(cleanEmail);
    const existingProfile = getSavedProfileByEmail(cleanEmail);
    const resolvedId = userId || existingAccount?.id || (isCreator ? "creator-dr-z" : `student-${cleanEmail.replace(/[^a-z0-9]/g, "").slice(0, 12)}-${Date.now().toString(36)}`);
    const resolvedName =
      existingProfile?.display_name ||
      existingAccount?.display_name ||
      displayName ||
      cleanEmail.split("@")[0] ||
      "Étudiant";

    const userObj = {
      id: resolvedId,
      email: cleanEmail,
      user_metadata: { full_name: resolvedName },
    };

    // Restore existing saved profile (avatar, pet, xp, coins, bubble) if this player already customized it!
    if (existingProfile) {
      saveProfileDurable(cleanEmail, { email: cleanEmail, isCreator: isCreator || existingProfile.isCreator });
    } else {
      const freshProfile = buildDefaultProfile(cleanEmail, resolvedName, isCreator);
      saveProfileDurable(cleanEmail, freshProfile, resolvedName);
    }

    setActiveSessionUser(userObj);
    qc.removeQueries({ queryKey: ["me"] });
    toast.success(`Bienvenue ${resolvedName} ! 🎉`);
    nav({ to: "/home" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) {
      toast.error("Veuillez saisir une adresse email · أدخل بريدك الإلكتروني");
      return;
    }
    if (!password || password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères · كلمة السر 6 أحرف على الأقل");
      return;
    }

    setBusy(true);
    const isCreator = cleanEmail === "doctorzmit@gmail.com";
    const chosenName = name.trim() || cleanEmail.split("@")[0] || "Étudiant";

    try {
      const res =
        mode === "in"
          ? await supabase.auth.signInWithPassword({ email: cleanEmail, password })
          : await supabase.auth.signUp({
              email: cleanEmail,
              password,
              options: {
                data: { full_name: chosenName },
                emailRedirectTo: window.location.origin + "/home",
              },
            });

      if (res.data?.session && res.data.user) {
        // Save local account record & ensure durable profile exists so participant appears in leaderboard immediately
        const existingProfile = getSavedProfileByEmail(cleanEmail);
        const resolvedName = existingProfile?.display_name || chosenName;
        saveAccount({
          id: res.data.user.id,
          email: cleanEmail,
          password,
          display_name: resolvedName,
          isCreator,
          created_at: new Date().toISOString(),
        });
        if (existingProfile) {
          saveProfileDurable(cleanEmail, { email: cleanEmail, isCreator: isCreator || existingProfile.isCreator });
        } else {
          saveProfileDurable(cleanEmail, buildDefaultProfile(cleanEmail, resolvedName, isCreator), resolvedName);
        }
        setActiveSessionUser({
          id: res.data.user.id,
          email: cleanEmail,
          user_metadata: { full_name: resolvedName },
        });
        toast.success(mode === "in" ? "Connexion réussie !" : "Compte créé avec succès !");
        qc.removeQueries({ queryKey: ["me"] });
        nav({ to: "/home" });
        return;
      }

      if (res.error) {
        console.warn("Supabase auth response:", res.error.message);
        handleLocalAuthFallback(cleanEmail, chosenName, isCreator);
        return;
      }

      if (mode === "up" && !res.data.session) {
        toast.success("Vérifie ta boîte mail pour confirmer ton compte 📩");
      }
    } catch {
      handleLocalAuthFallback(cleanEmail, chosenName, isCreator);
    } finally {
      setBusy(false);
    }
  }

  function handleLocalAuthFallback(cleanEmail: string, chosenName: string, isCreator: boolean) {
    const existingAcc = getAccountByEmail(cleanEmail);

    if (mode === "up") {
      if (existingAcc) {
        toast.error("Ce compte existe déjà. Connectez-vous avec votre mot de passe. · هذا البريد مسجل مسبقاً");
        setMode("in");
        return;
      }
      const newId = isCreator ? "creator-dr-z" : `student-${Date.now().toString(36)}`;
      saveAccount({
        id: newId,
        email: cleanEmail,
        password,
        display_name: chosenName,
        isCreator,
        created_at: new Date().toISOString(),
      });
      loginLocally(cleanEmail, chosenName, isCreator, newId);
      return;
    }

    // Sign-in mode
    if (existingAcc) {
      if (existingAcc.password && existingAcc.password !== password) {
        toast.error("Mot de passe incorrect · كلمة السر غير صحيحة");
        return;
      }
      loginLocally(cleanEmail, existingAcc.display_name || chosenName, isCreator || existingAcc.isCreator, existingAcc.id);
      return;
    }

    // First time on this browser for an existing user / quick local sign-in
    const newId = isCreator ? "creator-dr-z" : `student-${Date.now().toString(36)}`;
    saveAccount({
      id: newId,
      email: cleanEmail,
      password,
      display_name: chosenName,
      isCreator,
      created_at: new Date().toISOString(),
    });
    loginLocally(cleanEmail, chosenName, isCreator, newId);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50/50 via-background to-blue-100/30 px-4 py-8">
      <div className="card-game w-full max-w-md p-6 sm:p-8 animate-pop shadow-xl border border-border/80">
        <Brand />

        <div className="mt-6 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">
            {mode === "in" ? "Connexion à Doctor Z" : "Créer un compte"}
          </h1>
          <p className="ar text-sm text-muted-foreground mt-1">
            {mode === "in"
              ? "تسجيل الدخول بالبريد الإلكتروني وكلمة السر"
              : "إنشاء حساب طالب جديد بالبريد الإلكتروني وكلمة السر"}
          </p>
        </div>

        {/* Mode Switch Tabs */}
        <div className="mt-5 grid grid-cols-2 rounded-2xl bg-muted p-1">
          <button
            type="button"
            onClick={() => setMode("in")}
            className={`rounded-xl py-2 text-xs font-bold transition ${
              mode === "in" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Connexion · دخول
          </button>
          <button
            type="button"
            onClick={() => setMode("up")}
            className={`rounded-xl py-2 text-xs font-bold transition ${
              mode === "up" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            Inscription · تسجيل جديد
          </button>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === "up" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Nom complet / Prénom · الاسم الكامل
              </label>
              <input
                required
                type="text"
                placeholder="Ex. Amina, Dr. Rayane..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Adresse Email · البريد الإلكتروني
            </label>
            <input
              required
              type="email"
              placeholder="etudiant@univ-blida.dz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Mot de passe · كلمة المرور
            </label>
            <input
              required
              type="password"
              minLength={6}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-hero py-3 text-sm font-semibold text-primary-foreground shadow-pop hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-60"
          >
            {busy ? "Patientez..." : mode === "in" ? "Se connecter · دخول" : "Créer mon compte · إنشاء حساب"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
            className="text-xs font-medium text-primary hover:underline"
          >
            {mode === "in"
              ? "Pas encore de compte ? Inscris-toi avec ton email"
              : "Déjà inscrit ? Connecte-toi avec ton email"}
          </button>
        </div>

        <p className="ar mt-5 text-center text-[11px] text-muted-foreground">
          🔒 تُحفظ معلوماتك وأفاتارك تلقائياً على حسابك عند تسجيل الخروج والعودة
        </p>
      </div>
    </div>
  );
}