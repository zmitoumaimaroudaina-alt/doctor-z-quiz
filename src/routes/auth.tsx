import { pageMetadata } from "@/lib/metadata";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { auth, handleFirestoreError, OperationType } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
} from "firebase/auth";
import { Brand } from "@/components/AppShell";
import { ensureStudentOnLogin } from "@/lib/studentService";

export const Route = createFileRoute("/auth")({
  head: () =>
    pageMetadata(
      "Connexion",
      "Connexion et inscription par email et mot de passe à Doctor Z Quiz.",
    ),
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
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const hasAvatar = await ensureStudentOnLogin(
          user.uid,
          user.email || "",
          user.displayName || name,
        );
        qc.removeQueries({ queryKey: ["me"] });
        if (!hasAvatar) {
          nav({ to: "/onboarding" });
        } else {
          nav({ to: "/home" });
        }
      }
    });
    return () => unsub();
  }, [nav, qc, name]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Veuillez saisir une adresse email · أدخل بريدك الإلكتروني");
      return;
    }
    if (!password || password.length < 6) {
      toast.error(
        "Le mot de passe doit contenir au moins 6 caractères · كلمة السر 6 أحرف على الأقل",
      );
      return;
    }

    setBusy(true);
    const chosenName = name.trim() || cleanEmail.split("@")[0] || "Étudiant";

    try {
      let userCred;
      if (mode === "in") {
        userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      } else {
        userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      }

      const user = userCred.user;
      if (user) {
        const hasAvatar = await ensureStudentOnLogin(user.uid, cleanEmail, chosenName);
        toast.success(mode === "in" ? "Connexion réussية !" : "Compte créé avec succès !");
        qc.removeQueries({ queryKey: ["me"] });
        if (!hasAvatar) {
          nav({ to: "/onboarding" });
        } else {
          nav({ to: "/home" });
        }
      }
    } catch (error: unknown) {
      console.error("Auth error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("user-not-found") || msg.includes("invalid-credential")) {
        toast.error("Email ou mot de passe incorrect. · البريد أو كلمة السر غير صحيحة");
      } else if (msg.includes("email-already-in-use")) {
        toast.error("Cet email est déjà utilisé. Connectez-vous. · هذا البريد مستخدم مسبقاً");
        setMode("in");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function signInGoogle() {
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const user = res.user;
      if (user) {
        const hasAvatar = await ensureStudentOnLogin(
          user.uid,
          user.email || "",
          user.displayName || name,
        );
        toast.success("Connexion réussie avec Google ! 🎉");
        qc.removeQueries({ queryKey: ["me"] });
        if (!hasAvatar) {
          nav({ to: "/onboarding" });
        } else {
          nav({ to: "/home" });
        }
      }
    } catch (error: unknown) {
      console.error("Google sign-in error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      if (!msg.includes("popup-closed-by-user")) {
        toast.error("Erreur Google Auth: " + msg);
      }
    } finally {
      setBusy(false);
    }
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
              ? "تسجيل الدخول بالبريد الإلكتروني وكلمة السر (Firebase)"
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
            {busy
              ? "Patientez..."
              : mode === "in"
                ? "Se connecter · دخول"
                : "Créer mon compte · إنشاء حساب"}
          </button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">ou · أو</span>
          </div>
        </div>

        <button
          type="button"
          onClick={signInGoogle}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border border-input bg-card py-2.5 text-xs font-bold text-foreground shadow-sm hover:bg-muted active:scale-[0.99] transition disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Continuer avec Google · الدخول بحساب جوجل
        </button>

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
          🔒 تُحفظ معلوماتك وأفاتارك على قاعدة بيانات Firebase بأمان تام
        </p>
      </div>
    </div>
  );
}
