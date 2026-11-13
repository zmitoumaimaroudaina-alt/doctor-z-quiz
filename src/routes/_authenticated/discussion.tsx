import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageTitle } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, type AvatarConfig } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";
import { pageMetadata } from "@/lib/metadata";
import { useMe } from "@/hooks/useMe";
import { play } from "@/lib/sound";
import { isUserTomatoHit, getUserTomatoHoursLeft } from "@/lib/game";

export const Route = createFileRoute("/_authenticated/discussion")({
  head: () =>
    pageMetadata(
      "Discussion & Entraide",
      "Commentaires, remarques et discussion entre étudiants en médecine de Blida."
    ),
  component: Discussion,
});

export type ReactionUser = {
  id: string;
  name: string;
  avatar?: AvatarConfig;
};

export type Message = {
  id: string;
  sender: string;
  senderId?: string;
  avatar?: AvatarConfig;
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

const DEFAULT_MESSAGES: Message[] = [
  {
    id: "init-1",
    sender: "Dr. Z (Creator) 👑",
    senderId: "creator-z",
    isCreator: true,
    avatar: { gender: "m", skin: 1, eyes: 2, nose: 0, mouth: 2, hair: 9, hairColor: 0, hijab: 0, outfit: 0, accessory: 1, glasses: 1, beard: 1 },
    pet: "lion",
    module: "Médecine Générale",
    body: "مرحباً بجميع أطباء المستقبل في كلية الطب بجامعة سعد دحلب (البليدة 1) ! 🩺\nهذا الفضاء مخصص لكم لمشاركة الملاحظات، مناقشة أسئلة الامتحانات السابقة وتبادل النصائح الدراسية. تم ربط كل تفاعل بالأفاتار الشخصي لصاحبه !",
    kind: "chat",
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    likes: 24,
    tomatoes: 0,
    claps: 18,
    ideas: 12,
    reactionsUsers: {
      likes: [{ id: "user-1", name: "Amine K.", avatar: { gender: "m", skin: 1, outfit: 0, hair: 0 } }],
      claps: [{ id: "user-2", name: "Sara B.", avatar: { gender: "f", skin: 1, hijab: 1, hijabStyle: 0, outfit: 0 } }],
    },
  },
  {
    id: "init-2",
    sender: "Amine K. (Major Promo)",
    senderId: "user-1",
    isCreator: false,
    avatar: { gender: "m", skin: 1, outfit: 0, hair: 0, accessory: 1 },
    pet: "lion",
    module: "Sémiologie Médicale",
    body: "في مادة السيميولوجيا (Sémiologie)، ركزوا مليح على متلازمة الارتشاح الرئوي (Syndrome de condensation pulmonaire) وعلامات الفحص السريري (Vibrations vocales et Matité)، ديما يتعاودو في أسئلة QCM !",
    kind: "tip",
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    likes: 15,
    tomatoes: 0,
    claps: 9,
    ideas: 14,
    reactionsUsers: {
      ideas: [{ id: "creator-z", name: "Dr. Z", avatar: { gender: "m", skin: 1, hair: 9, outfit: 0 } }],
    },
  },
  {
    id: "init-3",
    sender: "Sara B. (3ème Année)",
    senderId: "user-2",
    isCreator: false,
    avatar: { gender: "f", skin: 1, hijab: 1, hijabStyle: 0, outfit: 0, accessory: 1 },
    pet: "cat",
    module: "Biochimie Clinique",
    body: "امتحان الكيمياء الحيوية (Biochimie) كان فيه تركيز كبير على مسار تحلل السكر وتنظيم الأنسولين، أنصح بحل الأسئلة المكررة هنا في التطبيق مع الشرح بالذكاء الاصطناعي قبل موعد الامتحان.",
    kind: "feedback",
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    likes: 8,
    tomatoes: 0,
    claps: 6,
    ideas: 5,
    reactionsUsers: {},
  },
];

const STORAGE_KEY = "doctorz_discussion_messages_v4";

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<"chat" | "feedback" | "tip" | "question">("chat");
  const [selectedModule, setSelectedModule] = useState<string>("عام (Général)");
  const [filter, setFilter] = useState<"all" | "chat" | "feedback" | "tip" | "question">("all");
  const [search, setSearch] = useState("");
  const [userReactions, setUserReactions] = useState<Record<string, string[]>>({});

  // Load messages from localStorage + defaults
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {
      // fallback
    }
    setMessages(DEFAULT_MESSAGES);
  }, []);

  function saveMessages(newList: Message[]) {
    setMessages(newList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newList));
    } catch {
      // ignore
    }
  }

  async function handleSend() {
    const text = body.trim();
    if (!text) return;

    play("submit");

    const senderName = me?.display_name || (me?.isCreator ? "Doctor Z 👑" : "طالب طب (Blida)");
    const newMsg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender: senderName,
      senderId: me?.id || "me",
      avatar: (me?.avatar as AvatarConfig) || { gender: "m", skin: 1, outfit: 0, accessory: 1 },
      pet: me?.pet || null,
      module: selectedModule,
      isCreator: me?.isCreator,
      body: text,
      kind,
      created_at: new Date().toISOString(),
      likes: 1,
      tomatoes: 0,
      claps: 0,
      ideas: 0,
      reactionsUsers: {
        likes: [
          {
            id: me?.id || "me",
            name: senderName,
            avatar: me?.avatar as AvatarConfig,
          },
        ],
      },
    };

    const updated = [newMsg, ...messages];
    saveMessages(updated);
    setBody("");
    toast.success("تم إرسال مشاركتك وتثبيت أفاتارك الشخصي بنجاح ! ✨");

    // Also attempt remote Supabase sync if connected
    try {
      void supabase.from("discussion_messages").insert({
        body: text,
        kind: kind === "tip" ? "chat" : kind,
      });
    } catch {
      // local is preserved
    }

    // Optional friendly simulated reply if asking Doctor Z
    if (text.includes("؟") || text.includes("?") || text.toLowerCase().includes("doctor z") || text.toLowerCase().includes("دكتور")) {
      setTimeout(() => {
        const botReply: Message = {
          id: `reply-${Date.now()}`,
          sender: "Dr Z-Bot 🤖",
          senderId: "bot-z",
          isCreator: true,
          avatar: { gender: "m", skin: 1, eyes: 2, nose: 0, mouth: 2, hair: 9, outfit: 0, accessory: 1, glasses: 1, beard: 1 },
          pet: "lion",
          module: selectedModule,
          body: `شكراً على مشاركتك يا زميلنا العزيز ! 🩺 سؤال ممتاز ومهم. راجع بنك الأسئلة المرفق في التطبيق مع الشرح بالذكاء الاصطناعي (Expliquer avec l'IA) لترسيخ هذه النقطة. بالتوفيق ! 💪`,
          kind: "chat",
          created_at: new Date().toISOString(),
          likes: 2,
          tomatoes: 0,
          claps: 2,
          ideas: 1,
        };
        setMessages((prev) => {
          const next = [botReply, ...prev];
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
        play("reward");
        toast.info("💬 رد جديد من Dr Z-Bot !");
      }, 1500);
    }
  }

  function handleReaction(msgId: string, type: "likes" | "tomatoes" | "claps" | "ideas") {
    const already = userReactions[msgId]?.includes(type);

    if (type === "tomatoes") play("hit");
    else play("click");

    const currentUser: ReactionUser = {
      id: me?.id || "me",
      name: me?.display_name || "Moi",
      avatar: me?.avatar as AvatarConfig,
    };

    const updated = messages.map((m) => {
      if (m.id !== msgId) return m;
      const delta = already ? -1 : 1;
      const currentReactionsUsers = m.reactionsUsers || {};
      const list = currentReactionsUsers[type] || [];

      let updatedList = [...list];
      if (already) {
        updatedList = updatedList.filter((u) => u.id !== currentUser.id);
      } else {
        if (!updatedList.some((u) => u.id === currentUser.id)) {
          updatedList.push(currentUser);
        }
      }

      return {
        ...m,
        [type]: Math.max(0, (m[type] || 0) + delta),
        reactionsUsers: {
          ...currentReactionsUsers,
          [type]: updatedList,
        },
      };
    });

    setUserReactions((prev) => {
      const cur = prev[msgId] || [];
      const next = already ? cur.filter((x) => x !== type) : [...cur, type];
      return { ...prev, [msgId]: next };
    });

    saveMessages(updated);
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
        ar="الدردشة والنصائح الطبية المنظمة"
        sub="فضاء تفاعلي منظم بين طلبة كلية الطب بالبليدة 1 — كل تفاعل ومشاركة تظهر بأفاتار صاحبها الخاص."
      />

      {/* Top Banner & Composer */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Composer Card with My Avatar */}
        <div className="card-game md:col-span-2 space-y-3.5 p-5 shadow-sm border border-border/80">
          <div className="flex items-center gap-3 border-b border-border/40 pb-3">
            <div className="relative">
              <Avatar
                config={me?.avatar as AvatarConfig}
                pet={me?.pet}
                size={52}
                mood="happy"
              />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>{me?.display_name || "أنت (طالب طب)"}</span>
                {me?.isCreator && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">👑 Creator</span>}
              </div>
              <div className="text-xs text-muted-foreground">مشاركتك ستُنشر بأفاتارك الطبي المخصص</div>
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

            {/* Module Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-semibold">المادة :</span>
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="h-8 rounded-xl border border-input bg-card px-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MODULES.map((mod) => (
                  <option key={mod} value={mod}>{mod}</option>
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
            <span className="text-[11px] text-muted-foreground">
              {1000 - body.length} حرف متبقٍ
            </span>
            <Button
              disabled={!body.trim()}
              onClick={() => void handleSend()}
              className="rounded-xl px-5 text-sm font-semibold shadow-pop hover:brightness-105 active:scale-95 transition-all"
            >
              نشر المشاركة بأفاتاري ➤
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
              <span><b>الأفاتار الشخصي:</b> كل رسالة أو تفاعل يعرض ملامح الأفاتار الذي صممته بنفسك.</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span><b>تبادل النصائح:</b> شارك مراجع الدورات السابقة والأفخاخ الامتحانية التي تتكرر.</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="text-primary font-bold">✓</span>
              <span><b>الذكاء الاصطناعي:</b> يمكنك توجيه سؤال لـ Dr Z-Bot وسيقدم لك توجيهاً سريعاً.</span>
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

        {/* Search Input */}
        <div className="w-full sm:w-64">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالكلمة، الزميل، أو المادة..."
            className="h-9 rounded-xl text-xs bg-card"
          />
        </div>
      </div>

      {/* Messages List with Rich Avatars & Interactive Reactions */}
      <div className="mt-6 space-y-4">
        {filtered.map((m) => {
          const isMine = m.senderId === me?.id || m.sender === me?.display_name;
          const msgAvatar = isMine ? (me?.avatar as AvatarConfig) : (m.avatar as AvatarConfig);
          const isHit = isUserTomatoHit(m.senderId || m.id);
          const tomatoHours = getUserTomatoHoursLeft(m.senderId || m.id);

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
              {/* Message Header with Full Avatar */}
              <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <Avatar
                      config={msgAvatar}
                      pet={m.pet}
                      size={54}
                      tomato={isHit}
                      tomatoHoursLeft={tomatoHours}
                      mood={m.isCreator ? "veryHappy" : "happy"}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground text-sm">
                        {m.sender}
                      </span>
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

              {/* Message Content */}
              <p className="mt-3.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 font-medium">
                {m.body}
              </p>

              {/* Interactive Reaction Buttons with Avatar Stack */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleReaction(m.id, "likes")}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      userReactions[m.id]?.includes("likes")
                        ? "bg-red-100 text-red-600 ring-1 ring-red-300 scale-105"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span>❤️</span>
                    <span>{m.likes || 0}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReaction(m.id, "claps")}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      userReactions[m.id]?.includes("claps")
                        ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300 scale-105"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span>👏</span>
                    <span>{m.claps || 0}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReaction(m.id, "ideas")}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      userReactions[m.id]?.includes("ideas")
                        ? "bg-yellow-100 text-yellow-800 ring-1 ring-yellow-300 scale-105"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span>💡</span>
                    <span>{m.ideas || 0}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleReaction(m.id, "tomatoes")}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                      userReactions[m.id]?.includes("tomatoes")
                        ? "bg-tomato/20 text-tomato ring-1 ring-tomato/40 scale-105"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    }`}
                    title="رمي طماطم للمرح 🍅"
                  >
                    <span>🍅</span>
                    <span>{m.tomatoes || 0}</span>
                  </button>
                </div>

                {/* Who Reacted Avatar Avatars Preview */}
                {m.reactionsUsers && Object.values(m.reactionsUsers).some((arr) => arr && arr.length > 0) && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground font-semibold">تفاعل معها:</span>
                    <div className="flex -space-x-2 rtl:space-x-reverse items-center overflow-hidden">
                      {Array.from(
                        new Map(
                          Object.values(m.reactionsUsers)
                            .flat()
                            .filter(Boolean)
                            .map((u) => [u.id, u])
                        ).values()
                      )
                        .slice(0, 5)
                        .map((u) => (
                          <div
                            key={u.id}
                            className="inline-block rounded-full ring-2 ring-card bg-card p-0.5 shadow-xs"
                            title={u.name}
                          >
                            <Avatar config={u.avatar} size={22} />
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
            <span className="text-3xl block">🔍</span>
            <p className="font-semibold">لا توجد مشاركات مطابقة لهذا التصنيف أو البحث.</p>
            <p className="text-xs">كن أول من يشارك نصيحة أو سؤال لزملائك في الكلية !</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
