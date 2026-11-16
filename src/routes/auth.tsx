import { pageMetadata } from "@/lib/metadata";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import { Brand } from "@/components/AppShell";
import {
  ensureStudentOnLogin,
  isGoogleAuthUser,
  isLegacyPasswordOnlyUser,
  LEGACY_MIGRATION_MESSAGE,
} from "@/lib/studentService";

export const Route = createFileRoute("/auth")({
  head: () =>
    pageMetadata(
      "Connexion Google",
      "Connexion sécurisée via Google à Doctor Z QCM GAME (Blida 1).",
    ),
  component: AuthPage,
});

export function AuthPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reason") === "legacy_migrated") {
        return LEGACY_MIGRATION_MESSAGE;
      }
    }
    return null;
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      if (isLegacyPasswordOnlyUser(user) || !isGoogleAuthUser(user)) {
        try {
          await signOut(auth);
        } catch {
          // ignore
        }
        setMigrationNotice(LEGACY_MIGRATION_MESSAGE);
        toast.error(LEGACY_MIGRATION_MESSAGE);
        return;
      }

      const res = await ensureStudentOnLogin(user);
      if (!res.ok) {
        toast.error("تعذر تسجيل الدخول. يرجى المحاولة بحساب Google مرة أخرى.");
        return;
      }
      if (res.migratedFromLegacy) {
        toast.success("تم ربط حسابك القديم ونقل نقاطك وإحصائياتك بنجاح! 🎉");
      }
      await qc.invalidateQueries({ queryKey: ["me"] });
      if (!res.hasAvatar) {
        nav({ to: "/onboarding" });
      } else {
        nav({ to: "/home" });
      }
    });
    return () => unsub();
  }, [nav, qc]);

  async function signInGoogle() {
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth, provider);
      const user = cred.user;
      if (user) {
        const res = await ensureStudentOnLogin(user);
        if (!res.ok) {
          toast.error(LEGACY_MIGRATION_MESSAGE);
          setBusy(false);
          return;
        }
        if (res.migratedFromLegacy) {
          toast.success("تم ربط حسابك القديم ونقل نقاطك وإحصائياتك إلى حساب Google! 🎉");
        } else {
          toast.success("تم تسجيل الدخول بحساب Google بنجاح! 🎉");
        }
        await qc.invalidateQueries({ queryKey: ["me"] });
        if (!res.hasAvatar) {
          nav({ to: "/onboarding" });
        } else {
          nav({ to: "/home" });
        }
      }
    } catch (error: unknown) {
      console.error("Google sign-in error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      if (!msg.includes("popup-closed-by-user")) {
        toast.error("خطأ أثناء تسجيل الدخول عبر Google: " + msg);
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
          <h1 className="font-display text-2xl font-bold text-foreground">Connexion à Doctor Z</h1>
          <p className="ar text-sm text-muted-foreground mt-1">
            تسجيل الدخول السريع والآمن عبر حساب Google فقط
          </p>
        </div>

        {migrationNotice && (
          <div
            dir="rtl"
            className="mt-5 rounded-2xl border-2 border-amber-400/70 bg-amber-50 p-4 text-center text-sm font-bold text-amber-900 shadow-sm"
          >
            ⚠️ {migrationNotice}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <button
            type="button"
            onClick={() => void signInGoogle()}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-hero py-3.5 px-4 text-sm font-bold text-primary-foreground shadow-pop hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-60"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white shadow-xs">
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
            </span>
            <span className="ar">
              {busy ? "جاري تسجيل الدخول..." : "تسجيل الدخول بحساب Google"}
            </span>
          </button>

          <div
            dir="rtl"
            className="rounded-2xl border border-border/70 bg-muted/40 p-3.5 text-xs text-muted-foreground space-y-1.5"
          >
            <p className="font-semibold text-foreground">
              ✨ حسابات الطلبة القدامى محفوظة تلقائياً:
            </p>
            <p>
              إذا كان لديك حساب سابق بنفس بريد Google، سيتم نقل نقاطك وأفاتارك وإحصائياتك تلقائياً
              عند أول دخول.
            </p>
          </div>
        </div>

        <p className="ar mt-5 text-center text-[11px] text-muted-foreground">
          🔒 تُحفظ معلوماتك وصورتك وقلوبك ونقاطك على قاعدة بيانات Firebase بأمان تام
        </p>
      </div>
    </div>
  );
}
