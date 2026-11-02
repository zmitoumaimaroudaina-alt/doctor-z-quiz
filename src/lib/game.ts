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
