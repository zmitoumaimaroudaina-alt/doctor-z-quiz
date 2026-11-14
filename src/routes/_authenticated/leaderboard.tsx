import { pageMetadata } from "@/lib/metadata";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageTitle } from "@/components/AppShell";
import { Avatar, type AvatarConfig } from "@/components/Avatar";
import { useMe } from "@/hooks/useMe";
import { useExams } from "@/lib/queries";
import {
  fmtTime,
  isUserTomatoHit,
  getUserTomatoHoursLeft,
  recordLocalTomatoHit,
} from "@/lib/game";
import {
  buildLocalParticipantsLeaderboard,
  type ParticipantStanding,
} from "@/lib/leaderboardStore";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () =>
    pageMetadata(
      "Participants & Classement",
      "Tableau des participants inscrits et classement selon les défis et examens complétés.",
    ),
  component: Leaderboard,
});

function Leaderboard() {
  const { data: me } = useMe();
  const { data: exams } = useExams();
  const [mode, setMode] = useState<"overall" | "exam">("overall");
  const [examId, setExamId] = useState<string>("");
  const [flying, setFlying] = useState<string | null>(null);
  const qc = useQueryClient();
  const id = examId || exams?.[0]?.id || "";

  const { data: rows } = useQuery({
    queryKey: ["lb", mode, id, me?.id, me?.xp, me?.display_name],
    queryFn: async (): Promise<ParticipantStanding[]> => {
      const localRows = buildLocalParticipantsLeaderboard({
        ...(id ? { examId: id } : {}),
        mode,
        currentUser: me
          ? {
              id: me.id,
              email: me.email,
              display_name: me.display_name,
              avatar: me.avatar,
              pet: me.pet,
              bubble: me.bubble,
              xp: me.xp,
              isCreator: me.isCreator,
            }
          : null,
      });

      const mergedById = new Map<string, ParticipantStanding>();
      for (const r of localRows) {
        mergedById.set(r.user_id, r);
      }

      if (mode === "exam" && id) {
        try {
          const { data, error } = await supabase.rpc("leaderboard", { _exam: id });
          if (!error && data && data.length > 0) {
            for (const remote of data) {
              const existing = mergedById.get(remote.user_id);
              const rScore = Number(remote.best_score ?? 0);
              const rTime = Number(remote.best_time ?? 0);
              if (existing) {
                existing.best_score = Math.max(existing.best_score, rScore);
                if (existing.best_time === 0 || (rTime > 0 && rTime < existing.best_time)) {
                  existing.best_time = rTime;
                }
                existing.challenges_count = Math.max(existing.challenges_count, 1);
                if (remote.tomato_until) existing.tomato_until = remote.tomato_until;
              } else {
                mergedById.set(remote.user_id, {
                  user_id: remote.user_id,
                  email: null,
                  display_name: remote.display_name ?? "Étudiant",
                  avatar: (remote.avatar as AvatarConfig) ?? {
                    gender: "m",
                    skin: 1,
                    outfit: 0,
                    accessory: 1,
                  },
                  pet: remote.pet ?? null,
                  bubble: remote.bubble ?? null,
                  xp: 0,
                  isCreator: false,
                  challenges_count: 1,
                  exams_count: 1,
                  courses_count: 0,
                  best_score: rScore,
                  avg_score: rScore,
                  best_time: rTime,
                  rnk: Number(remote.rnk ?? 999),
                  tomato_until: remote.tomato_until ?? null,
                  last_active_at: null,
                });
              }
            }
          }
        } catch {
          // keep local rows
        }
      } else {
        // Overall mode: also include all registered Supabase profiles if connected
        try {
          const { data: remoteProfiles } = await supabase
            .from("profiles")
            .select("id, display_name, avatar, pet, bubble, xp, created_at")
            .order("xp", { ascending: false })
            .limit(200);
          for (const rp of remoteProfiles ?? []) {
            if (!mergedById.has(rp.id)) {
              mergedById.set(rp.id, {
                user_id: rp.id,
                email: null,
                display_name: rp.display_name ?? "Étudiant",
                avatar: (rp.avatar as AvatarConfig) ?? {
                  gender: "m",
                  skin: 1,
                  outfit: 0,
                  accessory: 1,
                },
                pet: rp.pet ?? null,
                bubble: rp.bubble ?? null,
                xp: Number(rp.xp ?? 0),
                isCreator: false,
                challenges_count: 0,
                exams_count: 0,
                courses_count: 0,
                best_score: 0,
                avg_score: 0,
                best_time: 0,
                rnk: 999,
                tomato_until: null,
                last_active_at: rp.created_at ?? null,
              });
            }
          }
        } catch {
          // keep local rows
        }
      }

      const list = [...mergedById.values()];
      list.sort((a, b) => {
        const aActive = a.challenges_count > 0 ? 1 : 0;
        const bActive = b.challenges_count > 0 ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;

        if (mode === "exam") {
          if (b.best_score !== a.best_score) return b.best_score - a.best_score;
          if (aActive && bActive && a.best_time !== b.best_time) return a.best_time - b.best_time;
          return b.xp - a.xp;
        }

        if (b.challenges_count !== a.challenges_count) return b.challenges_count - a.challenges_count;
        if (b.avg_score !== a.avg_score) return b.avg_score - a.avg_score;
        if (b.best_score !== a.best_score) return b.best_score - a.best_score;
        return b.xp - a.xp;
      });

      return list.map((item, idx) => ({ ...item, rnk: idx + 1 }));
    },
  });

  const { data: creators } = useQuery({
    queryKey: ["creators"],
    queryFn: async () =>
      new Set(((await supabase.rpc("creator_ids")).data ?? ["doctorzmit@gmail.com"]) as string[]),
  });

  useEffect(() => {
    if (!id || !me) return;
    const ch = supabase
      .channel(`lb-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attempts", filter: `exam_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["lb"] }),
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tomatoes" }, (p) => {
        const t = p.new as { target_id: string; thrower_id: string; thrower_name?: string };
        qc.invalidateQueries({ queryKey: ["lb"] });
        if (t.target_id === me.id) {
          play("hit");
          const senderName =
            t.thrower_name ||
            (creators?.has(t.thrower_id) ? "👑 Doctor Z" : "أحد المتصدرين في التوب 3");
          toast.error(`🍅 ضربك ${senderName} بالطماطم! ستبقى ملطخاً لـ 12 ساعة 😂`);
        }
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [id, me, qc, creators]);

  const mine = rows?.find((r) => r.user_id === me?.id);
  const myRank = mine ? Number(mine.rnk) : 999;
  const canThrow = myRank <= 3 || me?.isCreator;

  async function throwAt(targetId: string, targetName: string) {
    if (!canThrow) {
      toast.error(
        "🔒 فقط أصحاب المراكز الثلاثة الأولى (Top 3) 🥇🥈🥉 يمكنهم رمي الطماطم على بقية اللاعبين!",
      );
      return;
    }

    play("throw");
    setFlying(targetId);
    const myName = me?.display_name || "أحد المتصدرين (Top 3)";
    recordLocalTomatoHit(targetId, me?.id || "me", myName);

    try {
      await supabase.rpc("throw_tomato", { _exam: id, _target: targetId });
    } catch {
      // ignore offline
    }

    setTimeout(() => {
      setFlying(null);
      play("hit");
      toast.success(
        `🍅 ضربة طماطم مباشرة على ${targetName}! تم إعلامه أنك أنت من ضربه وسيبقى ملطخاً لـ 12 ساعة!`,
      );
      qc.invalidateQueries({ queryKey: ["lb"] });
    }, 550);
  }

  async function saveBubble(text: string) {
    if (!me) return;
    const clean = text.replace(/[<>]/g, "").slice(0, 60);
    const { error } = await supabase.from("profiles").update({ bubble: clean }).eq("id", me.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["lb"] });
  }

  const activeParticipants = (rows ?? []).filter((r) => r.challenges_count > 0);
  const podiumSource = activeParticipants.length > 0 ? activeParticipants.slice(0, 5) : (rows ?? []).slice(0, 5);

  return (
    <AppShell wide>
      <PageTitle
        title="🏆 Participants & Classement"
        ar="جدول المشاركين والتصنيف"
        sub="يظهر كل من يسجّل دخوله في جدول المشاركين ويتم تصنيفه حسب التحديات والامتحانات التي شارك فيها."
      />

      {/* Mode Switch & Exam Filter */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              play("click");
              setMode("overall");
            }}
            className={`rounded-full px-4 py-2 text-xs sm:text-sm font-bold transition ${
              mode === "overall"
                ? "bg-hero text-primary-foreground shadow-pop"
                : "border bg-card hover:bg-muted"
            }`}
          >
            🏆 الترتيب العام حسب التحديات ({rows?.length ?? 0} مشارك)
          </button>
          <button
            type="button"
            onClick={() => {
              play("click");
              setMode("exam");
            }}
            className={`rounded-full px-4 py-2 text-xs sm:text-sm font-bold transition ${
              mode === "exam"
                ? "bg-hero text-primary-foreground shadow-pop"
                : "border bg-card hover:bg-muted"
            }`}
          >
            📝 ترتيب حسب الامتحان
          </button>
        </div>

        {mode === "exam" && (
          <select
            value={id}
            onChange={(e) => setExamId(e.target.value)}
            className="w-full rounded-xl border bg-card px-3 py-2 text-sm sm:w-auto"
          >
            {exams?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Top 5 Podium Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {podiumSource.map((r) => {
          const isHit = isUserTomatoHit(r.user_id, r.tomato_until);
          const hoursLeft = getUserTomatoHoursLeft(r.user_id, r.tomato_until);
          const isMe = r.user_id === me?.id;
          return (
            <div
              key={r.user_id}
              className={`card-game relative flex flex-col items-center p-3 text-center ${
                r.rnk === 1 ? "ring-2 ring-gold" : isMe ? "ring-2 ring-primary/50" : ""
              }`}
            >
              {r.bubble && (
                <div className="mb-1 max-w-full truncate rounded-xl bg-primary-soft px-2 py-1 text-[11px]">
                  💬 {r.bubble}
                </div>
              )}
              <div className="relative">
                <Avatar
                  config={r.avatar}
                  pet={r.pet}
                  size={86}
                  tomato={isHit}
                  tomatoHoursLeft={hoursLeft}
                  mood={isHit ? "angry" : r.rnk === 1 ? "veryHappy" : "happy"}
                />
                {flying === r.user_id && (
                  <span className="animate-tomato absolute left-1/3 top-1/4 text-3xl">🍅</span>
                )}
              </div>
              <div className="mt-1 text-lg">
                {["🥇", "🥈", "🥉", "4️⃣", "5️⃣"][Number(r.rnk) - 1] ?? `#${r.rnk}`}
              </div>
              <div className="w-full truncate font-semibold text-sm">
                {r.display_name} {isMe && <span className="text-xs text-primary">(أنت)</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {r.challenges_count > 0 ? (
                  <>
                    <b className="text-foreground">{r.challenges_count}</b> تحدي ·{" "}
                    <b>{r.best_score.toFixed(2)}</b>/20
                  </>
                ) : (
                  <span>مسجّل · 0 تحدي</span>
                )}
              </div>
              {canThrow && r.user_id !== me?.id && (
                <button
                  type="button"
                  onClick={() => void throwAt(r.user_id, r.display_name)}
                  className="mt-2 rounded-lg bg-tomato/15 px-2.5 py-1 text-xs font-bold text-tomato hover:bg-tomato/25 transition-colors"
                >
                  🍅 ارمي طماطم
                </button>
              )}
            </div>
          );
        })}
      </div>

      {mine && <BubbleEditor initial={mine.bubble ?? ""} onSave={saveBubble} />}

      {/* Full Participants Ranking Table */}
      <section className="card-game mt-6 overflow-hidden border border-border/80">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
          <h2 className="font-display text-base font-bold">
            📋 جدول المشاركين والتصنيف ({rows?.length ?? 0})
          </h2>
          <span className="text-xs text-muted-foreground">
            {mode === "overall"
              ? "مرتب حسب عدد التحديات المشاركة والمعدل والنقاط"
              : "مرتب حسب أعلى علامة وأسرع وقت في الامتحان المختار"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20 text-left text-xs font-bold text-muted-foreground">
                <th className="px-4 py-3">الرتبة</th>
                <th className="px-4 py-3">المشارك</th>
                <th className="px-4 py-3 text-center">التحديات</th>
                <th className="px-4 py-3 text-center">أحسن علامة</th>
                <th className="px-4 py-3 text-center hidden sm:table-cell">المعدل</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">الوقت</th>
                <th className="px-4 py-3 text-center">XP</th>
                <th className="px-4 py-3 text-right">تفاعل</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(rows ?? []).map((r) => {
                const isHit = isUserTomatoHit(r.user_id, r.tomato_until);
                const hoursLeft = getUserTomatoHoursLeft(r.user_id, r.tomato_until);
                const isMe = r.user_id === me?.id;
                const rankBadge = ["🥇", "🥈", "🥉"][r.rnk - 1] ?? `#${r.rnk}`;

                return (
                  <tr
                    key={r.user_id}
                    className={`transition-colors ${
                      isMe ? "bg-primary/5 font-semibold" : "hover:bg-muted/30"
                    }`}
                  >
                    <td className="px-4 py-3 font-display font-bold whitespace-nowrap">
                      {rankBadge}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-[160px]">
                        <Avatar
                          config={r.avatar}
                          size={36}
                          tomato={isHit}
                          tomatoHoursLeft={hoursLeft}
                          mood={isHit ? "angry" : "neutral"}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-foreground flex items-center gap-1.5">
                            <span>{r.display_name}</span>
                            {r.isCreator && (
                              <span className="rounded bg-gold/25 px-1.5 py-0.5 text-[10px] font-bold">
                                👑
                              </span>
                            )}
                            {isMe && (
                              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                                أنت
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {r.challenges_count > 0
                              ? `📝 ${r.exams_count} امتحان · 📚 ${r.courses_count} درس`
                              : "مسجّل حديثاً · لم يشارك في تحدٍ بعد"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          r.challenges_count > 0
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.challenges_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono">
                      {r.challenges_count > 0 ? `${r.best_score.toFixed(2)}/20` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center font-mono hidden sm:table-cell">
                      {r.challenges_count > 0 ? `${r.avg_score.toFixed(2)}/20` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center font-mono hidden md:table-cell">
                      {r.best_time > 0 ? fmtTime(r.best_time) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs">{r.xp}</td>
                    <td className="px-4 py-3 text-right">
                      {canThrow && !isMe ? (
                        <button
                          type="button"
                          onClick={() => void throwAt(r.user_id, r.display_name)}
                          aria-label="Lancer une tomate"
                          className="rounded-lg bg-tomato/10 px-2 py-1 text-xs font-bold text-tomato hover:bg-tomato/25 transition"
                        >
                          🍅
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {(!rows || rows.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    لا يوجد مشاركون مسجلون بعد. سجّل دخولك أو أكمل تحدياً لتظهر في الجدول!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-4 rounded-2xl border border-tomato/30 bg-tomato/5 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-bold text-foreground flex items-center gap-2">
          <span>🍅</span>
          <span>قانون الطماطم الرسمي (Top 3 Only) :</span>
        </p>
        <p>
          • <b>من يمكنه الرمي؟</b> أصحاب المراكز الثلاثة الأولى فقط (🥇 🥈 🥉) يحق لهم استهداف
          بقية الزملاء بالطماطم مكافأةً لتفوقهم.
        </p>
        <p>
          • <b>من ضربك؟</b> عند استهداف أي لاعب، يُعرض له إشعار فوري باسم الشخص المتصدر الذي ضربه
          بالطماطم!
        </p>
        <p>
          • <b>المدة والمؤثر:</b> يبقى الأفاتار ملطخاً بآثار الطماطم لمدة 12 ساعة كاملة مع تعبير منزعج
          ويد تحاول مسح الوجه بمنديل.
        </p>
      </div>
    </AppShell>
  );
}

const PRESETS = [
  "Yallah! 💪",
  "Wech, rani hna 😎",
  "Révise bien!",
  "QCM master 🧠",
  "Doctor en devenir 🩺",
];
function BubbleEditor({ initial, onSave }: { initial: string; onSave: (t: string) => void }) {
  const [t, setT] = useState(initial);
  return (
    <div className="card-game mt-4 p-4">
      <div className="mb-2 text-sm font-semibold">💬 Ma bulle (60 caractères max)</div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setT(p);
              onSave(p);
            }}
            className="rounded-full border px-2.5 py-1 text-xs"
          >
            {p}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={t}
          maxLength={60}
          onChange={(e) => setT(e.target.value)}
          className="flex-1 rounded-lg border px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => onSave(t)}
          className="rounded-lg bg-primary px-3 text-sm text-primary-foreground"
        >
          OK
        </button>
      </div>
    </div>
  );
}
