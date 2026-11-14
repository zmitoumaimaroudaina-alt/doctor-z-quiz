import type { AvatarConfig } from "@/components/Avatar";
import { getAccountsMap, getProfilesMap, normalizeEmail } from "./profileStore";

export interface ChallengeRecord {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  kind: "exam" | "course" | "quiz";
  targetId: string;
  targetTitle?: string;
  score20: number;
  durationSec: number;
  correctCount: number;
  totalCount: number;
  createdAt: string;
}

export interface ParticipantStanding {
  user_id: string;
  email: string | null;
  display_name: string;
  avatar: AvatarConfig;
  pet: string | null;
  bubble: string | null;
  xp: number;
  isCreator: boolean;
  challenges_count: number;
  exams_count: number;
  courses_count: number;
  best_score: number;
  avg_score: number;
  best_time: number;
  rnk: number;
  tomato_until: string | null;
  last_active_at: string | null;
}

const STORAGE_KEY = "doctorz_challenges_v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getChallengeRecords(): ChallengeRecord[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChallengeRecord[]) : [];
  } catch {
    return [];
  }
}

export function recordChallengeParticipation(input: {
  userId: string;
  email?: string | null;
  displayName?: string | null;
  kind: "exam" | "course" | "quiz";
  targetId: string;
  targetTitle?: string;
  score20: number;
  durationSec: number;
  correctCount: number;
  totalCount: number;
}): void {
  if (!isBrowser()) return;
  const email = normalizeEmail(input.email);
  const rec: ChallengeRecord = {
    id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: input.userId,
    email,
    displayName: input.displayName?.trim() || email.split("@")[0] || "Étudiant",
    kind: input.kind,
    targetId: input.targetId,
    ...(input.targetTitle ? { targetTitle: input.targetTitle } : {}),
    score20: Math.round(input.score20 * 100) / 100,
    durationSec: Math.max(0, Math.round(input.durationSec)),
    correctCount: input.correctCount,
    totalCount: input.totalCount,
    createdAt: new Date().toISOString(),
  };

  const list = getChallengeRecords();
  list.unshift(rec);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 1000)));
  } catch {
    // ignore storage quota errors
  }
}

function getLocalTomatoUntil(userId: string): string | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem("doctorz_tomato_hits") || "{}";
    const data = JSON.parse(raw) as Record<string, number | { until?: number }>;
    const item = data[userId];
    if (!item) return null;
    const until = typeof item === "number" ? item : item.until;
    if (until && until > Date.now()) {
      return new Date(until).toISOString();
    }
  } catch {
    // ignore
  }
  return null;
}

export function buildLocalParticipantsLeaderboard(params: {
  examId?: string;
  mode: "overall" | "exam";
  currentUser?: {
    id: string;
    email: string | null;
    display_name: string | null;
    avatar: AvatarConfig;
    pet: string | null;
    bubble: string | null;
    xp: number;
    isCreator: boolean;
  } | null;
}): ParticipantStanding[] {
  const profilesMap = getProfilesMap();
  const accountsMap = getAccountsMap();
  const records = getChallengeRecords();

  const usersByKey = new Map<
    string,
    {
      user_id: string;
      email: string | null;
      display_name: string;
      avatar: AvatarConfig;
      pet: string | null;
      bubble: string | null;
      xp: number;
      isCreator: boolean;
      last_active_at: string | null;
    }
  >();

  // 1. Add all registered accounts + durable profiles
  for (const [emailKey, acc] of Object.entries(accountsMap)) {
    const prof = profilesMap[emailKey];
    usersByKey.set(emailKey, {
      user_id: acc.id,
      email: emailKey,
      display_name: prof?.display_name || acc.display_name || emailKey.split("@")[0] || "Étudiant",
      avatar: prof?.avatar || { gender: "m", skin: 1, outfit: 0, accessory: 1 },
      pet: prof?.pet ?? null,
      bubble: prof?.bubble ?? null,
      xp: prof?.xp ?? 0,
      isCreator: Boolean(prof?.isCreator || acc.isCreator || emailKey === "doctorzmit@gmail.com"),
      last_active_at: prof?.updated_at ?? acc.created_at ?? null,
    });
  }

  for (const [emailKey, prof] of Object.entries(profilesMap)) {
    if (!usersByKey.has(emailKey)) {
      usersByKey.set(emailKey, {
        user_id: `local-${emailKey}`,
        email: emailKey,
        display_name: prof.display_name || emailKey.split("@")[0] || "Étudiant",
        avatar: prof.avatar || { gender: "m", skin: 1, outfit: 0, accessory: 1 },
        pet: prof.pet ?? null,
        bubble: prof.bubble ?? null,
        xp: prof.xp ?? 0,
        isCreator: Boolean(prof.isCreator || emailKey === "doctorzmit@gmail.com"),
        last_active_at: prof.updated_at ?? null,
      });
    }
  }

  // 2. Ensure the currently logged-in user is always included
  if (params.currentUser) {
    const emailKey = normalizeEmail(params.currentUser.email);
    const key = emailKey || params.currentUser.id;
    const existing = usersByKey.get(key);
    usersByKey.set(key, {
      user_id: params.currentUser.id,
      email: params.currentUser.email,
      display_name:
        params.currentUser.display_name ||
        existing?.display_name ||
        emailKey.split("@")[0] ||
        "Étudiant",
      avatar: params.currentUser.avatar || existing?.avatar || { gender: "m", skin: 1, outfit: 0, accessory: 1 },
      pet: params.currentUser.pet ?? existing?.pet ?? null,
      bubble: params.currentUser.bubble ?? existing?.bubble ?? null,
      xp: Math.max(params.currentUser.xp ?? 0, existing?.xp ?? 0),
      isCreator: Boolean(params.currentUser.isCreator || existing?.isCreator),
      last_active_at: new Date().toISOString(),
    });
  }

  // 3. Also include any user who has challenge records even if profile wasn't found
  for (const rec of records) {
    const key = normalizeEmail(rec.email) || rec.userId;
    if (!usersByKey.has(key)) {
      usersByKey.set(key, {
        user_id: rec.userId,
        email: rec.email || null,
        display_name: rec.displayName,
        avatar: { gender: "m", skin: 1, outfit: 0, accessory: 1 },
        pet: null,
        bubble: null,
        xp: 0,
        isCreator: rec.email === "doctorzmit@gmail.com",
        last_active_at: rec.createdAt,
      });
    }
  }

  // 4. Compute stats per participant
  const standings: ParticipantStanding[] = [];
  for (const user of usersByKey.values()) {
    const userEmail = normalizeEmail(user.email);
    const userRecords = records.filter(
      (r) => r.userId === user.user_id || (userEmail && normalizeEmail(r.email) === userEmail),
    );

    const relevant =
      params.mode === "exam" && params.examId
        ? userRecords.filter((r) => r.kind === "exam" && r.targetId === params.examId)
        : userRecords;

    const examsCount = userRecords.filter((r) => r.kind === "exam").length;
    const coursesCount = userRecords.filter((r) => r.kind === "course" || r.kind === "quiz").length;
    const challengesCount = relevant.length;

    let bestScore = 0;
    let avgScore = 0;
    let bestTime = 0;

    if (relevant.length > 0) {
      let sum = 0;
      let bestItem = relevant[0]!;
      for (const r of relevant) {
        sum += r.score20;
        if (
          r.score20 > bestItem.score20 ||
          (r.score20 === bestItem.score20 && r.durationSec < bestItem.durationSec)
        ) {
          bestItem = r;
        }
      }
      bestScore = Math.round(bestItem.score20 * 100) / 100;
      avgScore = Math.round((sum / relevant.length) * 100) / 100;
      bestTime = bestItem.durationSec;
    }

    const latestRecordAt = userRecords[0]?.createdAt ?? null;

    standings.push({
      user_id: user.user_id,
      email: user.email,
      display_name: user.display_name,
      avatar: user.avatar,
      pet: user.pet,
      bubble: user.bubble,
      xp: user.xp,
      isCreator: user.isCreator,
      challenges_count: params.mode === "exam" ? relevant.length : userRecords.length,
      exams_count: examsCount,
      courses_count: coursesCount,
      best_score: bestScore,
      avg_score: avgScore,
      best_time: bestTime,
      rnk: 0,
      tomato_until: getLocalTomatoUntil(user.user_id),
      last_active_at: latestRecordAt ?? user.last_active_at,
    });
  }

  // 5. Sort by challenge participation & performance:
  //    - Active participants (challenges_count > 0) before non-participants
  //    - In "overall": higher challenges_count + best/avg score, then XP
  //    - In "exam": higher best_score, then lower best_time, then challenges_count
  standings.sort((a, b) => {
    const aActive = a.challenges_count > 0 ? 1 : 0;
    const bActive = b.challenges_count > 0 ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;

    if (params.mode === "exam") {
      if (b.best_score !== a.best_score) return b.best_score - a.best_score;
      if (aActive && bActive && a.best_time !== b.best_time) return a.best_time - b.best_time;
      if (b.challenges_count !== a.challenges_count) return b.challenges_count - a.challenges_count;
      return b.xp - a.xp;
    }

    if (b.challenges_count !== a.challenges_count) return b.challenges_count - a.challenges_count;
    if (b.avg_score !== a.avg_score) return b.avg_score - a.avg_score;
    if (b.best_score !== a.best_score) return b.best_score - a.best_score;
    return b.xp - a.xp;
  });

  return standings.map((s, idx) => ({ ...s, rnk: idx + 1 }));
}
