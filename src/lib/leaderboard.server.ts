import { promises as fs } from "node:fs";
import path from "node:path";
import type { AvatarConfig } from "@/components/Avatar";
import type { ChallengeRecord, ParticipantStanding } from "./leaderboardStore";

interface ServerLeaderboardStore {
  profiles: Record<
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
      updated_at: string;
    }
  >;
  records: ChallengeRecord[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(DATA_DIR, "leaderboard-store.json");

let memoryStore: ServerLeaderboardStore | null = null;

function isDummyProfile(nameOrId: string): boolean {
  const lower = nameOrId.toLowerCase();
  return (
    lower.includes("test") ||
    lower.includes("dummy") ||
    lower.includes("mock") ||
    lower.includes("étudiant test")
  );
}

export async function readServerLeaderboardStore(): Promise<ServerLeaderboardStore> {
  if (memoryStore) return memoryStore;
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<ServerLeaderboardStore>;
    const cleanProfiles: ServerLeaderboardStore["profiles"] = {};
    for (const [k, p] of Object.entries(parsed.profiles ?? {})) {
      if (p && !isDummyProfile(p.display_name) && !isDummyProfile(p.user_id)) {
        cleanProfiles[k] = p;
      }
    }
    const cleanRecords = (Array.isArray(parsed.records) ? parsed.records : []).filter(
      (r) => !isDummyProfile(r.displayName) && !isDummyProfile(r.userId),
    );

    memoryStore = {
      profiles: cleanProfiles,
      records: cleanRecords,
    };
    return memoryStore;
  } catch {
    memoryStore = { profiles: {}, records: [] };
    return memoryStore;
  }
}

async function writeServerLeaderboardStore(store: ServerLeaderboardStore): Promise<void> {
  memoryStore = store;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_FILE, JSON.stringify(store), "utf8");
  } catch {
    // ignore read-only FS errors
  }
}

export async function upsertServerProfile(profile: {
  user_id: string;
  email?: string | null;
  display_name: string;
  avatar: AvatarConfig;
  pet?: string | null;
  bubble?: string | null;
  xp?: number;
  isCreator?: boolean;
}): Promise<void> {
  if (isDummyProfile(profile.display_name) || isDummyProfile(profile.user_id)) return;
  const store = await readServerLeaderboardStore();
  const key = (profile.email || profile.user_id).trim().toLowerCase();
  const existing = store.profiles[key] || store.profiles[profile.user_id];
  const merged = {
    user_id: profile.user_id,
    email: profile.email ?? existing?.email ?? null,
    display_name: profile.display_name || existing?.display_name || "Étudiant",
    avatar: profile.avatar || existing?.avatar || { gender: "m", skin: 1, outfit: 0, accessory: 1 },
    pet: profile.pet !== undefined ? profile.pet : (existing?.pet ?? null),
    bubble: profile.bubble !== undefined ? profile.bubble : (existing?.bubble ?? null),
    xp: Math.max(profile.xp ?? 0, existing?.xp ?? 0),
    isCreator: Boolean(
      profile.isCreator || existing?.isCreator || profile.email === "doctorzmit@gmail.com",
    ),
    updated_at: new Date().toISOString(),
  };
  store.profiles[key] = merged;
  store.profiles[profile.user_id] = merged;
  await writeServerLeaderboardStore(store);
}

export async function recordServerChallenge(record: ChallengeRecord): Promise<void> {
  if (isDummyProfile(record.displayName) || isDummyProfile(record.userId)) return;
  const store = await readServerLeaderboardStore();
  const exists = store.records.some(
    (r) =>
      r.userId === record.userId &&
      r.targetId === record.targetId &&
      Math.abs(new Date(r.createdAt).getTime() - new Date(record.createdAt).getTime()) < 3000,
  );
  if (!exists) {
    store.records.unshift(record);
    if (store.records.length > 2000) {
      store.records = store.records.slice(0, 2000);
    }
  }

  const key = (record.email || record.userId).trim().toLowerCase();
  if (!store.profiles[key] && !store.profiles[record.userId]) {
    store.profiles[key] = {
      user_id: record.userId,
      email: record.email || null,
      display_name: record.displayName || "Étudiant",
      avatar: { gender: "m", skin: 1, outfit: 0, accessory: 1 },
      pet: null,
      bubble: null,
      xp: 0,
      isCreator: record.email === "doctorzmit@gmail.com",
      updated_at: new Date().toISOString(),
    };
  }

  await writeServerLeaderboardStore(store);
}

export async function getServerStandings(examId?: string): Promise<ParticipantStanding[]> {
  const store = await readServerLeaderboardStore();

  try {
    const url = process.env["SUPABASE_URL"];
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (url && serviceKey) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: remoteProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, avatar, pet, bubble, xp, updated_at, created_at");
      for (const rp of remoteProfiles ?? []) {
        if (rp.id && !isDummyProfile(rp.display_name ?? "")) {
          store.profiles[rp.id] = {
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
            updated_at: rp.updated_at ?? rp.created_at ?? new Date().toISOString(),
          };
        }
      }
    }
  } catch {
    // ignore
  }

  const participantsMap = new Map<string, ParticipantStanding>();

  for (const p of Object.values(store.profiles)) {
    if (!p || !p.user_id || isDummyProfile(p.display_name)) continue;
    participantsMap.set(p.user_id, {
      user_id: p.user_id,
      email: p.email,
      display_name: p.display_name,
      avatar: p.avatar,
      pet: p.pet,
      bubble: p.bubble,
      xp: p.xp,
      isCreator: p.isCreator,
      challenges_count: 0,
      exams_count: 0,
      courses_count: 0,
      best_score: 0,
      avg_score: 0,
      best_time: 0,
      rnk: 0,
      tomato_until: null,
      last_active_at: p.updated_at,
    });
  }

  for (const r of store.records) {
    if (isDummyProfile(r.displayName)) continue;
    let p = participantsMap.get(r.userId);
    if (!p) {
      const emailKey = (r.email || r.userId).trim().toLowerCase();
      p = {
        user_id: r.userId,
        email: r.email || null,
        display_name: r.displayName || "Étudiant",
        avatar: { gender: "m", skin: 1, outfit: 0, accessory: 1 },
        pet: null,
        bubble: null,
        xp: 0,
        isCreator: r.email === "doctorzmit@gmail.com",
        challenges_count: 0,
        exams_count: 0,
        courses_count: 0,
        best_score: 0,
        avg_score: 0,
        best_time: 0,
        rnk: 0,
        tomato_until: null,
        last_active_at: r.createdAt,
      };
      participantsMap.set(r.userId, p);
    }
  }

  for (const [uid, p] of participantsMap.entries()) {
    const userRecords = store.records.filter(
      (r) =>
        r.userId === uid || (p.email && r.email && r.email.toLowerCase() === p.email.toLowerCase()),
    );

    const relevant = examId
      ? userRecords.filter((r) => r.kind === "exam" && r.targetId === examId)
      : userRecords;

    p.exams_count = userRecords.filter((r) => r.kind === "exam").length;
    p.courses_count = userRecords.filter((r) => r.kind === "course" || r.kind === "quiz").length;
    p.challenges_count = relevant.length;

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
      p.best_score = Math.round(bestItem.score20 * 100) / 100;
      p.avg_score = Math.round((sum / relevant.length) * 100) / 100;
      p.best_time = bestItem.durationSec;
    }

    const latestAt = userRecords[0]?.createdAt;
    if (latestAt && (!p.last_active_at || latestAt > p.last_active_at)) {
      p.last_active_at = latestAt;
    }
  }

  const list = [...participantsMap.values()];
  list.sort((a, b) => {
    const aActive = a.challenges_count > 0 ? 1 : 0;
    const bActive = b.challenges_count > 0 ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;

    if (examId) {
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

  return list.map((item, idx) => ({ ...item, rnk: idx + 1 }));
}
