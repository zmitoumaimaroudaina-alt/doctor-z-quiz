import { pageMetadata } from "@/lib/metadata";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db, logFirestoreError, OperationType } from "@/lib/firebase";
import { AppShell, PageTitle } from "@/components/AppShell";
import { CreatorQuestionEditor } from "@/components/CreatorQuestionEditor";
import { useMe } from "@/hooks/useMe";
import { renderHeartsVisual } from "@/lib/heartsStore";
import { adminSetStudentHearts, INITIAL_HEARTS, MAX_HEARTS_CAP } from "@/lib/studentService";
import { play } from "@/lib/sound";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () =>
    pageMetadata(
      "Gestion Doctor Z",
      "Gestion des questions, des cœurs et des étudiants Z QCM GAME.",
    ),
  component: Admin,
});

function Admin() {
  const { data: me } = useMe();
  const [tab, setTab] = useState<"students" | "search" | "review">("students");
  if (!me) return null;
  if (!me.isCreator)
    return (
      <AppShell>
        <p>Accès réservé au Creator.</p>
      </AppShell>
    );
  return (
    <AppShell wide>
      <PageTitle
        title="👑 Panneau Creator"
        ar="لوحة تحكم المصمم"
        sub="إدارة القلوب ❤️ والطلاب الحقيقيين والبحث في الأسئلة وتصحيح الحل الرسمي يدوياً."
      />
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
  email: string;
  display_name: string;
  xp: number;
  score: number;
  hearts: number;
};

function Students() {
  const [rows, setRows] = useState<AdminStudentRow[]>([]);
  const [targetEmail, setTargetEmail] = useState("");

  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("score", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AdminStudentRow[] = [];
        snap.forEach((d) => {
          const data = d.data() as {
            migrated?: boolean;
            email?: unknown;
            uid?: unknown;
            name?: unknown;
            xp?: unknown;
            score?: unknown;
            hearts?: unknown;
          };
          if (data.migrated === true) return;
          const email = String(data.email || "").toLowerCase();
          if (email === "doctorzmit@gmail.com") return;
          if (!data.uid || !data.name) return;
          list.push({
            id: d.id,
            email,
            display_name: String(data.name),
            xp: Number(data.xp ?? 0),
            score: Number(data.score ?? 0),
            hearts: typeof data.hearts === "number" ? data.hearts : INITIAL_HEARTS,
          });
        });
        setRows(list);
      },
      (error) => {
        logFirestoreError(error, OperationType.LIST, "students");
      },
    );
    return () => unsub();
  }, []);

  async function giveHearts(student: AdminStudentRow, amount: number, resetOnly = false) {
    const nextHearts = resetOnly
      ? Math.max(INITIAL_HEARTS, student.hearts)
      : Math.min(MAX_HEARTS_CAP, student.hearts + amount);
    try {
      await adminSetStudentHearts(student.id, nextHearts);
      play("reward");
      toast.success(
        resetOnly
          ? `تمت تعبئة قلوب ${student.display_name} (${nextHearts} ❤️)`
          : `تمت إضافة قلوب لـ ${student.display_name} (الرصيد: ${nextHearts} ❤️)`,
      );
    } catch {
      toast.error("تعذر تحديث القلوب.");
    }
  }

  async function giveHeartsToAll(amount: number) {
    try {
      for (const s of rows) {
        const next = Math.min(MAX_HEARTS_CAP, s.hearts + amount);
        await adminSetStudentHearts(s.id, next);
      }
      play("reward");
      toast.success(`تمت إضافة +${amount} ❤️ لجميع الطلاب (${rows.length}) بنجاح!`);
    } catch {
      toast.error("تعذر تحديث بعض القلوب.");
    }
  }

  async function giveHeartsByEmail(e: React.FormEvent) {
    e.preventDefault();
    const clean = targetEmail.trim().toLowerCase();
    if (!clean) {
      toast.error("أدخل البريد الإلكتروني للطالب");
      return;
    }
    const found = rows.find((r) => r.email === clean);
    if (!found) {
      toast.error("لم يتم العثور على طالب نشط بهذا البريد الإلكتروني.");
      return;
    }
    await giveHearts(found, 2);
    setTargetEmail("");
  }

  return (
    <div className="space-y-4">
      <div className="card-game border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold">❤️ إضافة القلوب للطلاب (Firestore)</h2>
            <p className="ar text-xs text-muted-foreground">
              أضف قلوباً لأي طالب حقيقي مسجّل في قاعدة البيانات (الحد الأقصى 5 قلوب)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void giveHeartsToAll(1)}
              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:brightness-105"
            >
              +1 ❤️ للجميع
            </button>
            <button
              type="button"
              onClick={() => void giveHeartsToAll(2)}
              className="rounded-xl bg-hero px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-sm hover:brightness-105"
            >
              +2 ❤️❤️ للجميع
            </button>
          </div>
        </div>

        <form onSubmit={(e) => void giveHeartsByEmail(e)} className="flex flex-wrap gap-2">
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
        {rows.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 p-3.5">
            <div className="flex-1 min-w-[180px]">
              <div className="font-semibold">{s.display_name}</div>
              {s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
              <div className="mt-0.5 text-xs text-muted-foreground">
                {s.score} نقطة · {s.xp} XP
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-muted px-2.5 py-1 text-xs font-semibold">
              <span>{renderHeartsVisual(s.hearts)}</span>
              <span className="text-muted-foreground">
                ({s.hearts}/{MAX_HEARTS_CAP})
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => void giveHearts(s, 1)}
                className="rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20"
              >
                +1 ❤️
              </button>
              <button
                type="button"
                onClick={() => void giveHearts(s, 2)}
                className="rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20"
              >
                +2 ❤️❤️
              </button>
              <button
                type="button"
                onClick={() => void giveHearts(s, 2, true)}
                className="rounded-lg border px-2.5 py-1 text-xs font-medium hover:bg-muted"
              >
                تعبئة 2/2
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!confirm("Supprimer définitivement cet étudiant de Firestore ?")) return;
                  try {
                    await deleteDoc(doc(db, "students", s.id));
                    toast.success("تم حذف الطالب من لوحة النتائج.");
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
        ))}
        {!rows.length && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            لا يوجد طلاب مسجلون في Firestore بعد.
          </div>
        )}
      </div>
    </div>
  );
}
