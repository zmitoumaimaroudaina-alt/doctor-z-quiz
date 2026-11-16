import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, type AvatarConfig } from "@/components/Avatar";
import { pageMetadata } from "@/lib/metadata";
import { play } from "@/lib/sound";
import { useMe } from "@/hooks/useMe";
import { useTomatoHits } from "@/hooks/useTomatoHits";
import { isGoogleAuthUser } from "@/lib/studentService";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  runTransaction,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { auth, db, logFirestoreError, OperationType } from "@/lib/firebase";

export const Route = createFileRoute("/_authenticated/discussion")({
  head: () =>
    pageMetadata(
      "Discussion & Entraide",
      "Commentaires, remarques et discussion entre étudiants en médecine de Blida.",
    ),
  component: Discussion,
});

export type ReactionUser = {
  id: string;
  name: string;
  photoURL?: string | null;
  avatar?: AvatarConfig | null;
};

export type Message = {
  id: string;
  sender: string;
  senderId?: string | undefined;
  photoURL?: string | null;
  avatar?: AvatarConfig | null;
  pet?: string | null;
  module?: string;
  isCreator?: boolean;
  body: string;
  kind: "chat" | "feedback" | "tip" | "question";
  created_at: string;
  likes: number;
  tomatoes: number;
  claps: number;
  ideas: number;
  reactionsUsers?: {
    likes?: ReactionUser[];
    claps?: ReactionUser[];
    ideas?: ReactionUser[];
    tomatoes?: ReactionUser[];
  };
};

const MODULES = [
  "عام (Général)",
  "Cardiologie",
  "Pneumologie",
  "Gastro-entérologie",
  "Neurologie",
  "Pédiatrie",
  "Gynécologie-Obstétrique",
  "Maladies Infectieuses",
  "Endocrinologie",
  "Biochimie",
  "Sémiologie",
];

export function Discussion() {
  const { data: me } = useMe();
  const { statsByUid, flyingTargetUid } = useTomatoHits(me?.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [kind, setKind] = useState<"chat" | "feedback" | "tip" | "question">("chat");
  const [selectedModule, setSelectedModule] = useState<string>("عام (Général)");
  const [filter, setFilter] = useState<"all" | "chat" | "feedback" | "tip" | "question">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !isGoogleAuthUser(user)) return;

    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"), limit(150));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Message[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as {
            createdAt?: { toDate?: () => Date } | null;
            created_at?: unknown;
            sender?: unknown;
            senderId?: unknown;
            photoURL?: unknown;
            avatar?: unknown;
            pet?: unknown;
            module?: unknown;
            isCreator?: unknown;
            body?: unknown;
            kind?: unknown;
            likes?: unknown;
            tomatoes?: unknown;
            claps?: unknown;
            ideas?: unknown;
            reactionsUsers?: unknown;
          };
          let createdAtIso = new Date().toISOString();
          if (typeof data.createdAt?.toDate === "function") {
            createdAtIso = data.createdAt.toDate().toISOString();
          } else if (typeof data.created_at === "string" && data.created_at) {
            createdAtIso = data.created_at;
          }

          list.push({
            id: d.id,
            sender: String(data.sender || "طالب طب"),
            senderId: typeof data.senderId === "string" ? data.senderId : undefined,
            photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
            avatar: (data.avatar as AvatarConfig | null) ?? null,
            pet: typeof data.pet === "string" ? data.pet : null,
            module: typeof data.module === "string" ? data.module : "عام (Général)",
            isCreator: !!data.isCreator,
            body: String(data.body || ""),
            kind: (data.kind as Message["kind"]) || "chat",
            created_at: createdAtIso,
            likes: Number(data.likes || 0),
            tomatoes: Number(data.tomatoes || 0),
            claps: Number(data.claps || 0),
            ideas: Number(data.ideas || 0),
            reactionsUsers: (data.reactionsUsers as Message["reactionsUsers"]) || {},
          });
        });
        setMessages(list);
      },
      (error) => {
        logFirestoreError(error, OperationType.LIST, "messages");
        toast.error("تعذر تحميل الرسائل المباشرة. تحقق من الاتصال.");
      },
    );
    return () => unsubscribe();
  }, [me?.id]);

  async function handleSend() {
    const text = body.trim();
    if (!text || !me || sending) return;

    setSending(true);
    play("submit");

    const senderName = (
      me.display_name || (me.isCreator ? "Doctor Z 👑" : "طالب طب (Blida)")
    ).slice(0, 120);
    const newMsgId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newMsgData = {
      id: newMsgId,
      sender: senderName,
      senderId: me.id,
      photoURL: me.photoURL || null,
      avatar: me.avatar ?? null,
      pet: me.pet || null,
      module: selectedModule,
      isCreator: !!me.isCreator,
      body: text,
      kind,
      createdAt: serverTimestamp(),
      created_at: new Date().toISOString(),
      likes: 1,
      tomatoes: 0,
      claps: 0,
      ideas: 0,
      reactionsUsers: {
        likes: [
          {
            id: me.id,
            name: senderName,
            photoURL: me.photoURL || null,
            avatar: me.avatar ?? null,
          },
        ],
      },
    };

    try {
      await setDoc(doc(db, "messages", newMsgId), newMsgData);
      setBody("");
      toast.success("تم نشر مشاركتك فوراً للجميع! ✨");
    } catch (error) {
      logFirestoreError(error, OperationType.CREATE, `messages/${newMsgId}`);
      toast.error("فشل إرسال الرسالة، تحقق من اتصالك.");
    } finally {
      setSending(false);
    }
  }

  async function handleReaction(msgId: string, type: "likes" | "tomatoes" | "claps" | "ideas") {
    if (!me) return;

    if (type === "tomatoes") play("hit");
    else play("click");

    const currentUser: ReactionUser = {
      id: me.id,
      name: me.display_name || "طالب",
      photoURL: me.photoURL || null,
      avatar: me.avatar ?? null,
    };

    const msgRef = doc(db, "messages", msgId);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(msgRef);
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;
        const reactionsUsers = {
          ...((data["reactionsUsers"] as Record<string, ReactionUser[]> | undefined) || {}),
        };
        const existingList: ReactionUser[] = Array.isArray(reactionsUsers[type])
          ? [...reactionsUsers[type]]
          : [];
        const already = existingList.some((u) => u.id === currentUser.id);

        const nextList = already
          ? existingList.filter((u) => u.id !== currentUser.id)
          : [...existingList, currentUser];
        reactionsUsers[type] = nextList;

        const currentCount = Math.max(0, Number(data[type] ?? 0));
        const nextCount = already ? Math.max(0, currentCount - 1) : currentCount + 1;

        tx.update(msgRef, {
          [type]: nextCount,
          reactionsUsers,
        });
      });
    } catch (e) {
      logFirestoreError(e, OperationType.UPDATE, `messages/${msgId}`);
      toast.error("تعذر حفظ التفاعل.");
    }
  }

  const filtered = messages.filter((m) => {
    if (filter !== "all" && m.kind !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchText = m.body.toLowerCase().includes(q);
      const matchSender = m.sender.toLowerCase().includes(q);
      const matchModule = (m.module || "").toLowerCase().includes(q);
      return matchText || matchSender || matchModule;
    }
    return true;
  });

  return (
    <AppShell wide>
      <PageTitle
        title="💬 Discussion & Conseils Médicaux"
        ar="الدردشة والنصائح الطبية المباشرة"
        sub="فضاء تفاعلي فوري بين طلبة كلية الطب بالبليدة 1 — كل رسالة وتفاعل يظهر لحظياً للجميع بصورة وصوت وأفاتار صاحبه."
      />

      {/* Top Banner & Composer */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="card-game md:col-span-2 space-y-3.5 p-5 shadow-sm border border-border/80">
          <div className="flex items-center gap-3 border-b border-border/40 pb-3">
            <div className="relative">
              <Avatar
                config={me?.avatar}
                photoURL={me?.photoURL}
                pet={me?.pet}
                size={52}
                tomato={!!(me?.id && statsByUid[me.id]?.isHit)}
                tomatoHoursLeft={me?.id ? statsByUid[me.id]?.hoursLeft : undefined}
                mood="happy"
              />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>{me?.display_name || "أنت (طالب طب)"}</span>
                {me?.isCreator && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    👑 Creator
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                مشاركتك ستظهر لحظياً لجميع الطلبة المسجلين
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">التصنيف :</span>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["chat", "💬 دردشة"],
                    ["tip", "💡 نصيحة سريرية"],
                    ["feedback", "📝 ملاحظة سؤال"],
                    ["question", "❓ استفسار"],
                  ] as const
                ).map(([k, label]) => (
                  <Button
                    key={k}
                    size="sm"
                    variant={kind === k ? "default" : "outline"}
                    onClick={() => {
                      play("click");
                      setKind(k);
                    }}
                    className="h-7 rounded-xl text-xs px-2.5"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-semibold">المادة :</span>
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="h-8 rounded-xl border border-input bg-card px-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MODULES.map((mod) => (
                  <option key={mod} value={mod}>
                    {mod}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Textarea
            value={body}
            maxLength={1000}
            onChange={(e) => setBody(e.target.value)}
            placeholder="اكتب ملاحظتك، استفسارك، أو نصيحة لزملائك في كلية الطب بالبليدة... (Écris ton message ici)"
            className="min-h-[100px] rounded-2xl border-input bg-background/60 p-3.5 text-sm focus:ring-2 focus:ring-primary/40 leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-foreground">{1000 - body.length} حرف متبقٍ</span>
            <Button
              disabled={!body.trim() || sending}
              onClick={() => void handleSend()}
              className="rounded-xl px-5 text-sm font-semibold shadow-pop hover:brightness-105 active:scale-95 transition-all"
            >
              {sending ? "جاري النشر..." : "نشر المشاركة ➤"}
            </Button>
          </div>
        </div>

        {/* Community Quick Stats & Guidelines */}
        <div className="card-game p-5 space-y-4 border border-border/80">
          <div className="font-display text-sm font-bold text-foreground flex items-center gap-2">
            <span>🩺</span>
            <span>ميثاق نقاشات أطباء البليدة 1</span>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>
                <b>بث لحظي مباشر:</b> جميع الرسائل والتفاعلات تصل فوراً لكل الزملاء عبر Firestore.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>
                <b>تبادل النصائح:</b> شارك مراجع الدورات السابقة والأفخاخ الامتحانية التي تتكرر.
              </span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span>
                <b>تأثير الطماطم الحي:</b> يظهر أثر الطماطم والعداد على صورة أي مشارك تلقائياً.
              </span>
            </p>
          </div>

          <div className="rounded-xl bg-primary/10 p-3 text-xs text-primary font-medium">
            💡 نصيحة: استخدم تصنيف المادة (Module) لتسهيل فرز النصائح والأسئلة لزملائك.
          </div>
        </div>
      </div>

      {/* Search & Categories Bar */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
          {(
            [
              ["all", "جميع المشاركات"],
              ["tip", "💡 نصائح دراسية"],
              ["feedback", "📝 ملاحظات الامتحانات"],
              ["question", "❓ استفسارات طبية"],
              ["chat", "💬 دردشة عامة"],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              onClick={() => {
                play("click");
                setFilter(f);
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                filter === f
                  ? "bg-primary text-primary-foreground shadow-sm scale-102"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالكلمة، الزميل، أو المادة..."
            className="h-9 rounded-xl text-xs bg-card"
          />
        </div>
      </div>

      {/* Messages List */}
      <div className="mt-6 space-y-4">
        {filtered.map((m) => {
          const isMine = m.senderId === me?.id;
          const msgAvatar = isMine ? me?.avatar : m.avatar;
          const msgPhoto = isMine ? me?.photoURL : m.photoURL;
          const tomatoState = m.senderId ? statsByUid[m.senderId] : undefined;
          const isHit = !!tomatoState?.isHit;
          const tomatoHours = tomatoState?.hoursLeft ?? 0;
          const isFlyingHere = !!(m.senderId && flyingTargetUid === m.senderId);

          const hasLiked = !!m.reactionsUsers?.likes?.some((u) => u.id === me?.id);
          const hasClapped = !!m.reactionsUsers?.claps?.some((u) => u.id === me?.id);
          const hasIdea = !!m.reactionsUsers?.ideas?.some((u) => u.id === me?.id);
          const hasTomato = !!m.reactionsUsers?.tomatoes?.some((u) => u.id === me?.id);

          return (
            <div
              key={m.id}
              className={`card-game p-5 shadow-sm border transition-all ${
                m.isCreator
                  ? "border-primary/40 bg-primary/5"
                  : isMine
                    ? "border-blue-300/60 bg-blue-50/20"
                    : "border-border/70"
              }`}
            >
              <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <Avatar
                      config={msgAvatar}
                      photoURL={msgPhoto}
                      pet={m.pet}
                      size={54}
                      tomato={isHit}
                      tomatoHoursLeft={tomatoHours}
                      mood={m.isCreator ? "veryHappy" : "happy"}
                    />
                    {isFlyingHere && (
                      <span className="animate-tomato absolute left-1/4 top-1/4 text-2xl z-20">
                        🍅
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-foreground text-sm">{m.sender}</span>
                      {m.isCreator && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                          Creator 👑
                        </span>
                      )}
                      {isMine && (
                        <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-semibold">
                          أنت (Moi)
                        </span>
                      )}
                      {(tomatoState?.count ?? 0) > 0 && (
                        <span className="rounded-full bg-tomato/15 px-2 py-0.5 text-[10px] font-bold text-tomato">
                          🍅 {tomatoState?.count}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {m.kind === "tip"
                          ? "💡 نصيحة سريرية"
                          : m.kind === "feedback"
                            ? "📝 ملاحظة امتحانية"
                            : m.kind === "question"
                              ? "❓ استفسار"
                              : "💬 دردشة عامة"}
                      </span>
                      {m.module && (
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {m.module}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {new Date(m.created_at).toLocaleTimeString("fr-DZ", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <p className="mt-3.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 font-medium">
                {m.body}
              </p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleReaction(m.id, "likes")}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      hasLiked
                        ? "bg-red-100 text-red-600 ring-1 ring-red-300 scale-105"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span>❤️</span>
                    <span>{m.likes || 0}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleReaction(m.id, "claps")}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      hasClapped
                        ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300 scale-105"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span>👏</span>
                    <span>{m.claps || 0}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleReaction(m.id, "ideas")}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      hasIdea
                        ? "bg-yellow-100 text-yellow-800 ring-1 ring-yellow-300 scale-105"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span>💡</span>
                    <span>{m.ideas || 0}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleReaction(m.id, "tomatoes")}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      hasTomato
                        ? "bg-tomato/20 text-tomato ring-1 ring-tomato/40 scale-105"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                    title="رمي طماطم على الرسالة 🍅"
                  >
                    <span>🍅</span>
                    <span>{m.tomatoes || 0}</span>
                  </button>
                </div>

                {m.reactionsUsers &&
                  Object.values(m.reactionsUsers).some((arr) => arr && arr.length > 0) && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground font-semibold">
                        تفاعل معها:
                      </span>
                      <div className="flex -space-x-2 rtl:space-x-reverse items-center overflow-hidden">
                        {Array.from(
                          new Map(
                            Object.values(m.reactionsUsers)
                              .flat()
                              .filter(Boolean)
                              .map((u) => [u.id, u]),
                          ).values(),
                        )
                          .slice(0, 5)
                          .map((u) => (
                            <div
                              key={u.id}
                              className="inline-block rounded-full ring-2 ring-card bg-card p-0.5 shadow-xs"
                              title={u.name}
                            >
                              <Avatar config={u.avatar} photoURL={u.photoURL} size={22} />
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          );
        })}

        {!filtered.length && (
          <div className="card-game p-10 text-center text-muted-foreground space-y-2">
            <span className="text-3xl block">💬</span>
            <p className="font-semibold">لا توجد مشاركات بعد أو لا توجد نتائج مطابقة للبحث.</p>
            <p className="text-xs">كن أول من يشارك نصيحة أو سؤالاً لزملائك في الكلية!</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
