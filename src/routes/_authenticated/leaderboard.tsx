import { pageMetadata } from "@/lib/metadata";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { collection, query, orderBy, onSnapshot, doc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { AppShell, PageTitle } from "@/components/AppShell";
import { Avatar, type AvatarConfig } from "@/components/Avatar";
import { useMe } from "@/hooks/useMe";
import { useExams } from "@/lib/queries";
import { isUserTomatoHit, getUserTomatoHoursLeft, recordLocalTomatoHit } from "@/lib/game";
import { play } from "@/lib/sound";
import { seedKnownStudents } from "@/lib/studentService";

export type StudentRow = {
  uid: string;
  name: string;
  email: string;
  avatar: AvatarConfig | null;
  pet?: string | null;
  bubble?: string | null;
  score: number;
  xp: number;
  rnk: number;
  tomato_until?: string | null;
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
  const { data: exams } = useExams();
  const [mode, setMode] = useState<"overall" | "exam">("overall");
  const [examId, setExamId] = useState<string>("");
  const [flying, setFlying] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [rows, setRows] = useState<StudentRow[]>([]);
  const id = examId || exams?.[0]?.id || "";

  useEffect(() => {
    void seedKnownStudents();
    const q = query(collection(db, "students"), orderBy("score", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: StudentRow[] = [];
        let index = 1;
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const defaultAvatar: AvatarConfig = { gender: "m", skin: 1, outfit: 0, accessory: 1 };
          list.push({
            uid: docSnap.id,
            name: data.name || data.email?.split("@")[0] || "Étudiant",
            email: data.email || "",
            avatar: data.avatar || defaultAvatar,
            pet: data.pet || null,
            bubble: data.bubble || null,
            score: Number(data.score ?? 0),
            xp: Number(data.xp ?? 0),
            rnk: index++,
            tomato_until: data.tomato_until || null,
            isCreator: data.email === "doctorzmit@gmail.com",
          });
        });
        setRows(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, "students");
      },
    );

    return () => unsubscribe();
  }, []);

  const mine = rows.find((r) => r.uid === me?.id);
  const myRank = mine ? mine.rnk : 999;
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
    recordLocalTomatoHit(targetId, me?.id || "me", me?.display_name || "Top 3");

    setTimeout(() => {
      setFlying(null);
      play("hit");
      toast.success(
        `🍅 ضربة طماطم مباشرة على ${targetName}! تم إعلامه أنك أنت من ضربه وسيبقى ملطخاً لـ 12 ساعة!`,
      );
    }, 550);
  }

  async function saveBubble(text: string) {
    if (!me) return;
    const clean = text.replace(/[<>]/g, "").slice(0, 60);
    try {
      await setDoc(doc(db, "students", me.id), { bubble: clean }, { merge: true });
      toast.success("تم تحديث الرسالة بنجاح! 💬");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `students/${me.id}`);
      toast.error("تعذر حفظ الرسالة.");
    }
  }

  async function handleAddParticipant(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const studentUid = `student-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const email = `${name.toLowerCase().replace(/\s+/g, "")}@blida.dz`;

    try {
      await setDoc(doc(db, "students", studentUid), {
        uid: studentUid,
        name,
        email,
        avatar: { gender: "m", skin: 1, outfit: 0, accessory: 1 },
        score: 50,
        xp: 150,
        createdAt: new Date(),
        lastLogin: new Date(),
      });
      play("reward");
      toast.success(`✅ تمت إضافة الطالب "${name}" إلى لوحة النتائج بنجاح!`);
      setNewName("");
      setShowAddModal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `students/${studentUid}`);
      toast.error("تعذر إضافة الطالب.");
    }
  }

  const podiumSource = rows.slice(0, 5);

  return (
    <AppShell wide>
      <PageTitle
        title="🏆 Participants & Classement"
        ar="جدول المشاركين والتصنيف (Firebase)"
        sub="يظهر كل من يسجّل دخوله في جدول المشاركين الفوري عبر Firestore ويتم تصنيفه تنازلياً حسب النقاط."
      />

      {/* Mode Switch & Actions */}
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
            🏆 الترتيب العام ({rows.length} مشارك حقيقي)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {me?.isCreator && (
            <button
              type="button"
              onClick={() => {
                play("click");
                setShowAddModal(!showAddModal);
              }}
              className="rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition"
            >
              ➕ إضافة مشارك يدوياً
            </button>
          )}
        </div>
      </div>

      {/* Add Participant Modal for Creator */}
      {showAddModal && me?.isCreator && (
        <form
          onSubmit={handleAddParticipant}
          className="card-game mb-6 p-4 border-2 border-primary/30 bg-primary/5 space-y-3 animate-pop"
        >
          <div className="font-bold text-sm text-foreground flex items-center justify-between">
            <span>➕ تسجيل طالب مشارك في لوحة النتائج (مثل Aymen أو not me)</span>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="text-xs text-muted-foreground"
            >
              ✕ إغلاق
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اكتب اسم الطالب (مثال: Aymen أو not me)..."
              className="flex-1 rounded-xl border bg-background px-3.5 py-2 text-sm"
              required
            />
            <button
              type="submit"
              className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-primary-foreground shadow-sm"
            >
              إضافة فورية
            </button>
          </div>
        </form>
      )}

      {/* Top 5 Podium Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {podiumSource.map((r) => {
          const isHit = isUserTomatoHit(r.uid, r.tomato_until);
          const hoursLeft = getUserTomatoHoursLeft(r.uid, r.tomato_until);
          const isMe = r.uid === me?.id;
          const fallbackAvatar: AvatarConfig = { gender: "m", skin: 1, outfit: 0, accessory: 1 };
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
                  config={r.avatar || fallbackAvatar}
                  pet={r.pet}
                  size={86}
                  tomato={isHit}
                  tomatoHoursLeft={hoursLeft}
                  mood={isHit ? "angry" : r.rnk === 1 ? "veryHappy" : "happy"}
                />
                {flying === r.uid && (
                  <span className="animate-tomato absolute left-1/3 top-1/4 text-3xl">🍅</span>
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
              {canThrow && r.uid !== me?.id && (
                <button
                  type="button"
                  onClick={() => void throwAt(r.uid, r.name)}
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
            📋 جدول المشاركين والتصنيف الحي ({rows.length})
          </h2>
          <span className="text-xs text-muted-foreground">
            مرتب تنازلياً حسب النقاط في Firestore
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20 text-left text-xs font-bold text-muted-foreground">
                <th className="px-4 py-3">الرتبة</th>
                <th className="px-4 py-3">المشارك</th>
                <th className="px-4 py-3 text-center">النقاط (Score)</th>
                <th className="px-4 py-3 text-center">XP</th>
                <th className="px-4 py-3 text-right">تفاعل</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const isHit = isUserTomatoHit(r.uid, r.tomato_until);
                const hoursLeft = getUserTomatoHoursLeft(r.uid, r.tomato_until);
                const isMe = r.uid === me?.id;
                const rankBadge = ["🥇", "🥈", "🥉"][r.rnk - 1] ?? `#${r.rnk}`;
                const fallbackAvatar: AvatarConfig = {
                  gender: "m",
                  skin: 1,
                  outfit: 0,
                  accessory: 1,
                };

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
                      <div className="flex items-center gap-2.5 min-w-[160px]">
                        <Avatar
                          config={r.avatar || fallbackAvatar}
                          size={36}
                          tomato={isHit}
                          tomatoHoursLeft={hoursLeft}
                          mood={isHit ? "angry" : "neutral"}
                        />
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
                          <div className="text-[11px] text-muted-foreground">
                            {r.avatar ? "أفاتار مخصص ✨" : "أفاتار افتراضي · مسجّل"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-primary">
                      {r.score}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs">{r.xp}</td>
                    <td className="px-4 py-3 text-right">
                      {canThrow && !isMe ? (
                        <button
                          type="button"
                          onClick={() => void throwAt(r.uid, r.name)}
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

              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    لا يوجد مشاركون مسجلون بعد. سجّل دخولك لتظهر في الجدول!
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
