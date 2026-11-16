import { pageMetadata } from "@/lib/metadata";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { collection, query, orderBy, onSnapshot, doc, setDoc } from "firebase/firestore";
import { auth, db, logFirestoreError, OperationType } from "@/lib/firebase";
import { AppShell, PageTitle } from "@/components/AppShell";
import { Avatar, type AvatarConfig } from "@/components/Avatar";
import { useMe } from "@/hooks/useMe";
import { useTomatoHits } from "@/hooks/useTomatoHits";
import { isGoogleAuthUser, throwTomatoHit } from "@/lib/studentService";
import { play } from "@/lib/sound";

export type StudentRow = {
  uid: string;
  name: string;
  email: string;
  photoURL?: string | null;
  avatar: AvatarConfig | null;
  pet?: string | null;
  bubble?: string | null;
  score: number;
  xp: number;
  rnk: number;
  isCreator?: boolean;
};

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () =>
    pageMetadata(
      "Participants & Classement",
      "Tableau des participants inscrits et classement selon les scores et points enregistrés dans Firebase.",
    ),
  component: Leaderboard,
});

function Leaderboard() {
  const { data: me } = useMe();
  const { statsByUid, flyingTargetUid } = useTomatoHits(me?.id);
  const [localFlying, setLocalFlying] = useState<string | null>(null);
  const [throwingId, setThrowingId] = useState<string | null>(null);
  const [rows, setRows] = useState<StudentRow[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !isGoogleAuthUser(user)) return;

    const q = query(collection(db, "students"), orderBy("score", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: StudentRow[] = [];
        let index = 1;
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as {
            migrated?: boolean;
            uid?: unknown;
            name?: unknown;
            email?: unknown;
            avatar?: unknown;
            photoURL?: unknown;
            pet?: unknown;
            bubble?: unknown;
            score?: unknown;
            xp?: unknown;
          };
          if (data.migrated === true) return;
          const uid = typeof data.uid === "string" ? data.uid.trim() : "";
          const name = typeof data.name === "string" ? data.name.trim() : "";
          const hasAvatar = data.avatar != null && typeof data.avatar === "object";
          const photoURL =
            typeof data.photoURL === "string" && data.photoURL.trim() ? data.photoURL : null;

          // Ignore incomplete records without valid uid, name, or visual identity
          if (!uid || !name || (!hasAvatar && !photoURL)) return;

          list.push({
            uid: docSnap.id,
            name,
            email: typeof data.email === "string" ? data.email : "",
            photoURL,
            avatar: hasAvatar ? (data.avatar as AvatarConfig) : null,
            pet: typeof data.pet === "string" ? data.pet : null,
            bubble: typeof data.bubble === "string" ? data.bubble : null,
            score: Number(data.score ?? 0),
            xp: Number(data.xp ?? 0),
            rnk: index++,
            isCreator: String(data.email || "").toLowerCase() === "doctorzmit@gmail.com",
          });
        });
        setRows(list);
      },
      (error) => {
        logFirestoreError(error, OperationType.LIST, "students");
      },
    );

    return () => unsubscribe();
  }, [me?.id]);

  const mine = rows.find((r) => r.uid === me?.id);
  const myRank = mine?.rnk ?? null;
  const canThrowTomato = Boolean(me?.isCreator || (myRank !== null && myRank <= 5));

  async function throwAt(targetId: string, targetName: string) {
    if (!me) return;
    if (!canThrowTomato) {
      toast.error("عذراً! رمي الطماطم متاح فقط للـ 5 الأوائل في النقاط والمصمم 👑");
      return;
    }
    if (targetId === me.id) {
      toast.error("لا يمكنك رمي الطماطم على نفسك 😅");
      return;
    }
    if (throwingId) return;

    setThrowingId(targetId);
    play("throw");
    setLocalFlying(targetId);

    try {
      await throwTomatoHit(
        me.id,
        me.display_name || "طالب",
        targetId,
        targetName,
        Boolean(me.isCreator),
      );
      setTimeout(() => {
        setLocalFlying((curr) => (curr === targetId ? null : curr));
        play("hit");
        toast.success(`🍅 أصبت ${targetName} بطماطم مباشرة! سيظهر الأثر للجميع فوراً لمدة 12 ساعة.`);
      }, 500);
    } catch (error) {
      setLocalFlying(null);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("NOT_TOP5_OR_CREATOR")) {
        toast.error("عذراً! رمي الطماطم متاح فقط للـ 5 الأوائل في النقاط والمصمم 👑");
      } else {
        console.error("Failed to throw tomato:", error);
        toast.error("تعذر إرسال ضربة الطماطم. حاول مجدداً.");
      }
    } finally {
      setTimeout(() => setThrowingId(null), 1000);
    }
  }

  async function saveBubble(text: string) {
    if (!me) return;
    const clean = text.replace(/[<>]/g, "").slice(0, 60);
    try {
      await setDoc(doc(db, "students", me.id), { bubble: clean }, { merge: true });
      toast.success("تم تحديث الرسالة بنجاح! 💬");
    } catch (error) {
      logFirestoreError(error, OperationType.WRITE, `students/${me.id}`);
      toast.error("تعذر حفظ الرسالة.");
    }
  }

  const podiumSource = rows.slice(0, 5);

  return (
    <AppShell wide>
      <PageTitle
        title="🏆 Participants & Classement"
        ar="جدول المشاركين والتصنيف المباشر"
        sub="يظهر كل طالب مسجّل بحساب Google في الترتيب الفوري، مع رمي الطماطم وتحديث البقعة والعداد لحظياً للجميع."
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full bg-hero px-4 py-2 text-xs sm:text-sm font-bold text-primary-foreground shadow-pop">
            🏆 الترتيب العام ({rows.length} مشارك مسجّل)
          </div>
          <div
            className={`rounded-full border px-3.5 py-2 text-xs font-bold ${
              canThrowTomato
                ? "border-tomato/40 bg-tomato/10 text-tomato"
                : "border-border bg-muted/60 text-muted-foreground"
            }`}
          >
            {canThrowTomato
              ? me?.isCreator
                ? "🍅 صلاحية رمي الطماطم: المصمم 👑"
                : `🍅 صلاحية رمي الطماطم مفعّلة (المركز #${myRank} ضمن الـ 5 الأوائل)`
              : `🔒 رمي الطماطم للـ 5 الأوائل والمصمم فقط${myRank ? ` (مركزك: #${myRank})` : ""}`}
          </div>
        </div>
      </div>

      {/* Top 5 Podium Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {podiumSource.map((r) => {
          const tomatoState = statsByUid[r.uid];
          const isHit = !!tomatoState?.isHit;
          const hoursLeft = tomatoState?.hoursLeft ?? 0;
          const tomatoCount = tomatoState?.count ?? 0;
          const isMe = r.uid === me?.id;
          const isFlyingHere = flyingTargetUid === r.uid || localFlying === r.uid;

          return (
            <div
              key={r.uid}
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
                  photoURL={r.photoURL}
                  pet={r.pet}
                  size={86}
                  tomato={isHit}
                  tomatoHoursLeft={hoursLeft}
                  mood={isHit ? "angry" : r.rnk === 1 ? "veryHappy" : "happy"}
                />
                {isFlyingHere && (
                  <span className="animate-tomato absolute left-1/3 top-1/4 text-3xl z-20">🍅</span>
                )}
              </div>
              <div className="mt-1 text-lg">
                {["🥇", "🥈", "🥉", "4️⃣", "5️⃣"][r.rnk - 1] ?? `#${r.rnk}`}
              </div>
              <div className="w-full truncate font-semibold text-sm">
                {r.name} {isMe && <span className="text-xs text-primary">(أنت)</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                <b className="text-foreground">{r.score}</b> نقطة · <b>{r.xp}</b> XP
              </div>
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-tomato/10 px-2 py-0.5 text-[11px] font-bold text-tomato">
                <span>🍅</span>
                <span>{tomatoCount}</span>
              </div>
              {!isMe &&
                (canThrowTomato ? (
                  <button
                    type="button"
                    disabled={throwingId !== null}
                    onClick={() => void throwAt(r.uid, r.name)}
                    className="mt-2 rounded-lg bg-tomato/15 px-2.5 py-1 text-xs font-bold text-tomato hover:bg-tomato/25 transition-colors disabled:opacity-50"
                  >
                    🍅 ارمي طماطم
                  </button>
                ) : (
                  <span className="mt-2 rounded-lg bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                    🔒 للـ 5 الأوائل
                  </span>
                ))}
            </div>
          );
        })}
      </div>

      {mine && <BubbleEditor initial={mine.bubble ?? ""} onSave={saveBubble} />}

      {/* Full Participants Ranking Table */}
      <section className="card-game mt-6 overflow-hidden border border-border/80">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
          <h2 className="font-display text-base font-bold">
            📋 جدول المشاركين والتصنيف الحي ({rows.length})
          </h2>
          <span className="text-xs text-muted-foreground">
            مرتب تنازلياً حسب النقاط · تحديث فوري via Firestore
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20 text-left text-xs font-bold text-muted-foreground">
                <th className="px-4 py-3">الرتبة</th>
                <th className="px-4 py-3">المشارك</th>
                <th className="px-4 py-3 text-center">النقاط</th>
                <th className="px-4 py-3 text-center">الطماطم 🍅</th>
                <th className="px-4 py-3 text-right">تفاعل</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const tomatoState = statsByUid[r.uid];
                const isHit = !!tomatoState?.isHit;
                const hoursLeft = tomatoState?.hoursLeft ?? 0;
                const tomatoCount = tomatoState?.count ?? 0;
                const isMe = r.uid === me?.id;
                const isFlyingHere = flyingTargetUid === r.uid || localFlying === r.uid;
                const rankBadge = ["🥇", "🥈", "🥉"][r.rnk - 1] ?? `#${r.rnk}`;

                return (
                  <tr
                    key={r.uid}
                    className={`transition-colors ${
                      isMe ? "bg-primary/5 font-semibold" : "hover:bg-muted/30"
                    }`}
                  >
                    <td className="px-4 py-3 font-display font-bold whitespace-nowrap">
                      {rankBadge}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 min-w-[170px] relative">
                        <div className="relative shrink-0">
                          <Avatar
                            config={r.avatar}
                            photoURL={r.photoURL}
                            size={40}
                            tomato={isHit}
                            tomatoHoursLeft={hoursLeft}
                            mood={isHit ? "angry" : "neutral"}
                          />
                          {isFlyingHere && (
                            <span className="animate-tomato absolute -top-2 left-0 text-2xl z-20">
                              🍅
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-foreground flex items-center gap-1.5">
                            <span>{r.name}</span>
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
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <span>{r.xp} XP</span>
                            {isHit && (
                              <span className="text-tomato font-semibold">
                                · ملطخ ({hoursLeft}س)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-primary">
                      {r.score}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full bg-tomato/10 px-2.5 py-0.5 text-xs font-bold text-tomato">
                        🍅 {tomatoCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isMe ? (
                        canThrowTomato ? (
                          <button
                            type="button"
                            disabled={throwingId !== null}
                            onClick={() => void throwAt(r.uid, r.name)}
                            aria-label="Lancer une tomate"
                            className="rounded-lg bg-tomato/15 px-2.5 py-1 text-xs font-bold text-tomato hover:bg-tomato/25 transition disabled:opacity-50"
                          >
                            🍅 ارمي
                          </button>
                        ) : (
                          <span
                            title="متاح فقط لأصحاب المراكز الـ 5 الأولى والمصمم"
                            className="inline-block rounded-lg bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
                          >
                            🔒 للـ 5 الأوائل
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    لا يوجد مشاركون مسجلون بعد. سجّل دخولك بحساب Google لتظهر هنا!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
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
