export const EXAM_DURATION_SECONDS = 3600;
export function examSecondsLeft(startedAt: string, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(startedAt).getTime() + EXAM_DURATION_SECONDS * 1000 - now) / 1000));
}

export const CREATOR_EMAIL = "doctorzmit@gmail.com";

export function levelFromXp(xp: number) {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  const cur = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return { level, progress: (xp - cur) / (next - cur), next };
}

export const PETS = [
  { id: "cat", emoji: "🐱", name: "Chat", level: 1 },
  { id: "dog", emoji: "🐶", name: "Chien", level: 2 },
  { id: "rabbit", emoji: "🐰", name: "Lapin", level: 3 },
  { id: "hamster", emoji: "🐹", name: "Hamster", level: 5 },
  { id: "fox", emoji: "🦊", name: "Renard", level: 7 },
  { id: "spider", emoji: "🕷️", name: "Araignée", level: 10 },
] as const;
export const petEmoji = (id?: string | null) => PETS.find((p) => p.id === id)?.emoji ?? "";

export type Mood = "neutral" | "happy" | "veryHappy" | "sad" | "angry";
export function moodFrom(streak: number): Mood {
  if (streak >= 3) return "veryHappy";
  if (streak >= 1) return "happy";
  if (streak <= -3) return "angry";
  if (streak <= -1) return "sad";
  return "neutral";
}

export const BUBBLES = ["Yallah! 💪", "Wech, rani hna 😎", "Révise bien!", "QCM master 🧠", "Doctor en devenir 🩺", "Ma tkhafch 😄"];

export const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export const RESOURCES = [
  { label: "Doctor Z — YouTube", href: "https://youtube.com/@doctorz-i2007?si=nZg18vbKQGGshfbu", icon: "▶️" },
  { label: "Med Support — Telegram", href: "https://t.me/+ubEdEFjoMtllYZcE8", icon: "✈️" },
  { label: "Med Support — YouTube", href: "https://youtube.com/@medisuppor1?si=YL2jAcqpSdClp0ep", icon: "▶️" },
];

export const rpcError = (e: unknown) => {
  const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  const map: Record<string, string> = {
    EXAM_LOCKED: "Examen verrouillé : plus de cœurs. Réessaie après 24 h.",
    TOP5_ONLY: "Seul le Top 5 peut lancer des tomates 🍅",
    COOLDOWN: "Doucement ! Attends 10 minutes entre deux tomates.",
    ALREADY_HIT: "Tu as déjà touché ce joueur aujourd'hui.",
    NO_SELF: "Pas sur toi-même 😅",
    NOT_DONE: "Mission pas encore terminée.",
  };
  const k = Object.keys(map).find((x) => m.includes(x));
  if (k) return map[k];
  if (m.includes("duplicate key")) return "Déjà réclamé.";
  return m;
};

// 12-Hour Tomato Splatter Rules
export const TOMATO_DURATION_HOURS = 12;
export const TOMATO_DURATION_MS = TOMATO_DURATION_HOURS * 3600 * 1000;

export type TomatoHitRecord = {
  until: number;
  throwerId?: string;
  throwerName?: string;
};

export function recordLocalTomatoHit(userId: string, throwerId?: string, throwerName?: string): number {
  if (typeof window === "undefined") return Date.now() + TOMATO_DURATION_MS;
  const until = Date.now() + TOMATO_DURATION_MS;
  try {
    const raw = localStorage.getItem("doctorz_tomato_hits") || "{}";
    const data = JSON.parse(raw);
    data[userId] = {
      until,
      throwerId: throwerId || "user-unknown",
      throwerName: throwerName || "أحد الأوائل الثلاثة (Top 3)",
    };
    localStorage.setItem("doctorz_tomato_hits", JSON.stringify(data));
  } catch {
    // ignore
  }
  return until;
}

export function getTomatoHitDetails(userId: string): { isHit: boolean; hoursLeft: number; throwerName?: string } {
  if (typeof window === "undefined") return { isHit: false, hoursLeft: 0 };
  try {
    const raw = localStorage.getItem("doctorz_tomato_hits") || "{}";
    const data = JSON.parse(raw);
    const item = data[userId];
    if (item) {
      const until = typeof item === "number" ? item : item.until;
      if (until && until > Date.now()) {
        const hoursLeft = Math.max(1, Math.ceil((until - Date.now()) / (3600 * 1000)));
        return {
          isHit: true,
          hoursLeft,
          throwerName: typeof item === "object" ? item.throwerName : "أحد المتصدرين في الترتيب",
        };
      }
    }
  } catch {
    // ignore
  }
  return { isHit: false, hoursLeft: 0 };
}

export function isUserTomatoHit(userId: string, remoteUntil?: string | null): boolean {
  if (remoteUntil && new Date(remoteUntil).getTime() > Date.now()) {
    return true;
  }
  return getTomatoHitDetails(userId).isHit;
}

export function getUserTomatoHoursLeft(userId: string, remoteUntil?: string | null): number {
  if (remoteUntil) {
    const target = new Date(remoteUntil).getTime();
    if (target > Date.now()) {
      return Math.max(1, Math.ceil((target - Date.now()) / (3600 * 1000)));
    }
  }
  return getTomatoHitDetails(userId).hoursLeft;
}

export function getUserTomatoThrower(userId: string): string {
  return getTomatoHitDetails(userId).throwerName || "أحد الأوائل الثلاثة (Top 3) 🏆";
}
