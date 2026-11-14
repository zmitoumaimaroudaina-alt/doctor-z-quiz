import { pageMetadata } from "@/lib/metadata";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { CreatorQuestionEditor } from "@/components/CreatorQuestionEditor";
import { useMe } from "@/hooks/useMe";
import { deleteStudent } from "@/lib/account.functions";
import { getAccountsMap, getProfilesMap, normalizeEmail } from "@/lib/profileStore";
import {
  addHeartsToUser,
  formatHeartCountdown,
  getHeartStatus,
  renderHeartsVisual,
  resolveHeartKey,
  restoreHeartsForUser,
} from "@/lib/heartsStore";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => pageMetadata("Gestion Doctor Z", "Gestion des questions, des cœurs et des étudiants Z QCM GAME."),
  component: Admin,
});

function Admin() {
  const { data: me } = useMe();
  const [tab, setTab] = useState<"students" | "search" | "review">("students");
  if (!me) return null;
  if (!me.isCreator) return <AppShell><p>Accès réservé au Creator.</p></AppShell>;
  return (
    <AppShell wide>
      <PageTitle title="👑 Panneau Creator" ar="لوحة تحكم المصمم" sub="إدارة القلوب ❤️ والطلاب والبحث في الأسئلة وتصحيح الحل الرسمي يدوياً." />
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["students", "❤️ القلوب والطلاب (Étudiants)"],
            ["search", "🛠️ البحث وتصحيح الأسئلة يدوياً"],
            ["review", "⚠️ أسئلة تحتاج مراجعة"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              tab === k ? "bg-primary text-primary-foreground" : "border bg-card"
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === "students" ? (
        <Students />
      ) : (
        <CreatorQuestionEditor key={tab} defaultFilterMode={tab === "review" ? "review" : "all"} />
      )}
    </AppShell>
  );
}

type AdminStudentRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  xp: number;
  coins: number;
  streak: number;
  isCreator?: boolean;
};

function Students() {
  const qc = useQueryClient();
  const del = useServerFn(deleteStudent);
  const [targetEmail, setTargetEmail] = useState("");
  const [tick, setTick] = useState(0);

  const { data } = useQuery({
    queryKey: ["admin-students", tick],
    queryFn: async (): Promise<AdminStudentRow[]> => {
      const merged = new Map<string, AdminStudentRow>();

      // 1. Load local profiles & accounts
      const profilesMap = getProfilesMap();
      const accountsMap = getAccountsMap();
      for (const [emailKey, p] of Object.entries(profilesMap)) {
        if (p.isCreator || emailKey === "doctorzmit@gmail.com") continue;
        merged.set(emailKey, {
          id: accountsMap[emailKey]?.id || emailKey,
          email: emailKey,
          display_name: p.display_name,
          xp: p.xp ?? 0,
          coins: p.coins ?? 0,
          streak: p.streak ?? 0,
          isCreator: p.isCreator,
        });
      }
      for (const [emailKey, acc] of Object.entries(accountsMap)) {
        if (acc.isCreator || emailKey === "doctorzmit@gmail.com") continue;
        if (!merged.has(emailKey)) {
          merged.set(emailKey, {
            id: acc.id,
            email: emailKey,
            display_name: acc.display_name,
            xp: 150,
            coins: 60,
            streak: 3,
          });
        }
      }

      // 2. Load Supabase profiles if connected
      try {
        const remote = (
          await supabase
            .from("profiles")
            .select("id, display_name, xp, coins, streak, created_at")
            .order("created_at", { ascending: false })
        ).data;
        for (const r of remote ?? []) {
          const existingById = [...merged.values()].find((x) => x.id === r.id);
          if (!existingById) {
            merged.set(r.id, {
              id: r.id,
              email: null,
              display_name: r.display_name,
              xp: r.xp,
              coins: r.coins,
              streak: r.streak,
            });
          }
        }
      } catch {
        // offline fallback already loaded
      }

      return [...merged.values()];
    },
  });

  async function giveHearts(student: AdminStudentRow, amount: number, resetOnly = false) {
    const key = resolveHeartKey(student.email, student.id);
    if (resetOnly) {
      restoreHeartsForUser(key);
      if (student.email && student.id !== student.email) restoreHeartsForUser(student.id);
    } else {
      addHeartsToUser(key, amount);
      if (student.email && student.id !== student.email) addHeartsToUser(student.id, amount);
    }

    try {
      await supabase.from("exam_hearts").delete().eq("user_id", student.id);
    } catch {
      // ignore offline
    }

    play("reward");
    toast.success(
      resetOnly
        ? `تمت تعبئة قلوب ${student.display_name || student.email} (❤️❤️)`
        : `تمت إضافة +${amount} ❤️ إلى ${student.display_name || student.email}`,
    );
    setTick((t) => t + 1);
  }

  async function giveHeartsToAll(amount: number) {
    const list = data ?? [];
    for (const s of list) {
      const key = resolveHeartKey(s.email, s.id);
      addHeartsToUser(key, amount);
      if (s.email && s.id !== s.email) addHeartsToUser(s.id, amount);
      try {
        await supabase.from("exam_hearts").delete().eq("user_id", s.id);
      } catch {
        // ignore
      }
    }
    play("reward");
    toast.success(`تمت إضافة +${amount} ❤️ لجميع الطلاب (${list.length}) بنجاح!`);
    setTick((t) => t + 1);
  }

  function giveHeartsByEmail(e: React.FormEvent) {
    e.preventDefault();
    const clean = normalizeEmail(targetEmail);
    if (!clean) {
      toast.error("أدخل البريد الإلكتروني للطالب");
      return;
    }
    addHeartsToUser(clean, 2);
    play("reward");
    toast.success(`تمت إضافة +2 ❤️❤️ للحساب ${clean}`);
    setTargetEmail("");
    setTick((t) => t + 1);
  }

  return (
    <div className="space-y-4">
      {/* Creator Quick Heart Gift Controls */}
      <div className="card-game border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold">❤️ إضافة القلوب للطلاب</h2>
            <p className="ar text-xs text-muted-foreground">
              أضف قلوباً (+1 أو +2 أو +5) لأي طالب أو للجميع دفعة واحدة
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => giveHeartsToAll(1)}
              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:brightness-105"
            >
              +1 ❤️ للجميع
            </button>
            <button
              type="button"
              onClick={() => giveHeartsToAll(2)}
              className="rounded-xl bg-hero px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:brightness-105"
            >
              +2 ❤️❤️ للجميع
            </button>
          </div>
        </div>

        <form onSubmit={giveHeartsByEmail} className="flex flex-wrap gap-2">
          <input
            type="email"
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="أدخل إيميل طالب لإضافة +2 ❤️❤️ له مباشرة..."
            className="flex-1 min-w-[220px] rounded-xl border bg-background px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-xl bg-success px-4 py-2 text-xs font-bold text-success-foreground"
          >
            إضافة +2 ❤️❤️
          </button>
        </form>
      </div>

      <div className="card-game divide-y">
        {data?.map((s) => {
          const hs = getHeartStatus(resolveHeartKey(s.email, s.id), false);
          return (
            <div key={s.id} className="flex flex-wrap items-center gap-3 p-3.5">
              <div className="flex-1 min-w-[180px]">
                <div className="font-semibold">{s.display_name ?? "(sans nom)"}</div>
                {s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {s.xp} XP · 🪙 {s.coins} · 🔥 {s.streak}
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-muted px-2.5 py-1 text-xs font-semibold">
                <span>{renderHeartsVisual(hs.hearts)}</span>
                <span className="text-muted-foreground">({hs.hearts})</span>
                {hs.secondsToNext > 0 && (
                  <span className="font-mono text-[10px] text-amber-700">
                    ⏳ {formatHeartCountdown(hs.secondsToNext)}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => giveHearts(s, 1)}
                  className="rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20"
                >
                  +1 ❤️
                </button>
                <button
                  onClick={() => giveHearts(s, 2)}
                  className="rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20"
                >
                  +2 ❤️❤️
                </button>
                <button
                  onClick={() => giveHearts(s, 5)}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 hover:bg-amber-100"
                >
                  +5 ❤️
                </button>
                <button
                  onClick={() => giveHearts(s, 2, true)}
                  className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                >
                  تعبئة 2/2
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("Supprimer définitivement cet étudiant ?")) return;
                    try {
                      await del({ data: { userId: s.id } });
                      toast.success("Supprimé");
                      qc.invalidateQueries({ queryKey: ["admin-students"] });
                    } catch (e) {
                      toast.error((e as Error).message);
                    }
                  }}
                  className="rounded-lg bg-destructive/10 px-2 py-1 text-xs text-destructive"
                >
                  Supprimer
                </button>
              </div>
            </div>
          );
        })}
        {data && !data.length && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            لا يوجد طلاب مسجلون بعد في القائمة المحلية أو السيرفر. يمكنك إضافة قلوب مباشرة عبر البريد الإلكتروني أعلاه.
          </div>
        )}
      </div>
    </div>
  );
}
