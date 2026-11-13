import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import type {
  SeedCourse,
  SeedData,
  SeedExam,
  SeedExamSubject,
  SeedQuestion,
  SeedQuestionKey,
  SeedSubject,
} from "@/lib/seed-loader.server";

type Row = Record<string, unknown>;

interface MockUser {
  id: string;
  email: string;
  aud: string;
  role: string;
  created_at: string;
}

interface MockSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: MockUser;
}

interface MockDb {
  users: Record<string, MockUser>;
  profiles: Row[];
  user_roles: Row[];
  attempts: Row[];
  practice_attempts: Row[];
  exam_hearts: Row[];
  question_mistakes: Row[];
  tomatoes: Row[];
  mission_claims: Row[];
  discussion_messages: Row[];
  discussion_reactions: Row[];
  lesson_quizzes: Row[];
  question_corrections: Row[];
  avatar_settings: Row[];
  question_overrides: Record<string, Partial<SeedQuestion>>;
  key_overrides: Record<string, Partial<SeedQuestionKey>>;
}

const STORAGE_DB_KEY = "zqcm_mock_db_v1";
const STORAGE_SESSION_KEY = "zqcm_mock_session_v1";
const CREATOR_EMAIL = "doctorzmit@gmail.com";

const DEFAULT_AVATAR = {
  gender: "m",
  skin: 1,
  eyes: 0,
  hair: 0,
  hairColor: 0,
  hijab: 0,
  outfit: 0,
  accessory: 1,
};

function makeUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function deterministicUuid(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ch, 0x85ebca6b) >>> 0;
  }
  const hex = (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).repeat(2);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function emptyDb(): MockDb {
  return {
    users: {},
    profiles: [],
    user_roles: [],
    attempts: [],
    practice_attempts: [],
    exam_hearts: [],
    question_mistakes: [],
    tomatoes: [],
    mission_claims: [],
    discussion_messages: [],
    discussion_reactions: [],
    lesson_quizzes: [],
    question_corrections: [],
    avatar_settings: [{ id: 1, disabled: {}, updated_at: new Date().toISOString() }],
    question_overrides: {},
    key_overrides: {},
  };
}

let memoryDb: MockDb = emptyDb();
let memorySession: MockSession | null = null;
let seedPromise: Promise<SeedData> | null = null;
let cachedSeed: SeedData | null = null;
const storageFiles = new Map<string, Blob>();

function loadDb(): MockDb {
  if (typeof window === "undefined") return memoryDb;
  try {
    const raw = localStorage.getItem(STORAGE_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MockDb>;
      memoryDb = { ...emptyDb(), ...parsed };
    }
  } catch {
    // ignore storage errors
  }
  return memoryDb;
}

function saveDb(db: MockDb): void {
  memoryDb = db;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_DB_KEY, JSON.stringify(db));
    } catch {
      // ignore storage quota errors
    }
  }
}

function loadSession(): MockSession | null {
  if (typeof window === "undefined") return memorySession;
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (raw) {
      memorySession = JSON.parse(raw) as MockSession;
      return memorySession;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveSession(session: MockSession | null): void {
  memorySession = session;
  if (typeof window !== "undefined") {
    try {
      if (session) {
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
        localStorage.setItem("doctorz_user", JSON.stringify(session.user));
      } else {
        localStorage.removeItem(STORAGE_SESSION_KEY);
        localStorage.removeItem("doctorz_user");
      }
    } catch {
      // ignore
    }
  }
}

async function getSeed(): Promise<SeedData> {
  if (cachedSeed) return cachedSeed;
  if (typeof window === "undefined") {
    return {
      subjects: [],
      courses: [],
      exams: [],
      exam_subjects: [],
      questions: [],
      question_keys: [],
    };
  }
  if (!seedPromise) {
    seedPromise = (async () => {
      const res = await fetch("/api/seed-data");
      if (!res.ok) throw new Error("Impossible de charger les questions.");
      cachedSeed = (await res.json()) as SeedData;
      return cachedSeed;
    })();
  }
  return seedPromise;
}

type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED" | "INITIAL_SESSION";
type AuthListener = (event: AuthEvent, session: MockSession | null) => void;
const authListeners = new Set<AuthListener>();

function emitAuth(event: AuthEvent, session: MockSession | null): void {
  for (const cb of authListeners) {
    try {
      cb(event, session);
    } catch {
      // ignore listener errors
    }
  }
}

type RealtimeRegistration = {
  table: string;
  callback: (payload: { eventType: string; new: Row; old: Row }) => void;
};
const realtimeChannels = new Set<RealtimeRegistration>();

function emitRealtime(table: string, eventType: "INSERT" | "UPDATE" | "DELETE", row: Row): void {
  for (const reg of realtimeChannels) {
    if (reg.table === table) {
      try {
        reg.callback({ eventType, new: row, old: row });
      } catch {
        // ignore
      }
    }
  }
}

function algiersDateStr(d = new Date()): string {
  return new Date(d.toLocaleString("en-US", { timeZone: "Africa/Algiers" })).toISOString().slice(0, 10);
}

function isoWeekKey(d = new Date()): string {
  const dt = new Date(d.toLocaleString("en-US", { timeZone: "Africa/Algiers" }));
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() + 3 - ((dt.getDay() + 6) % 7));
  const week1 = new Date(dt.getFullYear(), 0, 4);
  const wk =
    1 + Math.round(((dt.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${dt.getFullYear()}-${String(wk).padStart(2, "0")}`;
}

function ensureUserRecords(emailRaw: string): MockSession {
  const email = emailRaw.trim().toLowerCase() || "etudiant@univ-blida.dz";
  const db = loadDb();
  let user = db.users[email];
  const now = new Date().toISOString();
  const isCreator = email === CREATOR_EMAIL;

  if (!user) {
    const id = deterministicUuid(email);
    user = { id, email, aud: "authenticated", role: "authenticated", created_at: now };
    db.users[email] = user;
  }

  if (!db.profiles.some((p) => p["id"] === user.id)) {
    const baseName = email.split("@")[0] ?? "Étudiant";
    db.profiles.push({
      id: user.id,
      email,
      display_name: isCreator ? "Doctor Z" : baseName,
      avatar: DEFAULT_AVATAR,
      pet: isCreator ? "cat" : null,
      bubble: isCreator ? "Doctor Z ici! 🩺" : null,
      xp: isCreator ? 999999 : 0,
      coins: isCreator ? 999999 : 0,
      streak: 0,
      last_active_date: null,
      sound_on: true,
      onboarded: isCreator,
      created_at: now,
    });
  }

  if (!db.user_roles.some((r) => r["user_id"] === user.id && r["role"] === "user")) {
    db.user_roles.push({ id: makeUuid(), user_id: user.id, role: "user" });
  }
  if (isCreator && !db.user_roles.some((r) => r["user_id"] === user.id && r["role"] === "admin")) {
    db.user_roles.push({ id: makeUuid(), user_id: user.id, role: "admin" });
  }

  saveDb(db);
  const session: MockSession = {
    access_token: `mock-jwt.${btoa(JSON.stringify({ sub: user.id, email }))}.sig`,
    refresh_token: `mock-refresh-${user.id}`,
    token_type: "bearer",
    expires_in: 86400,
    user,
  };
  saveSession(session);
  return session;
}

function isCorrectSelection(key: SeedQuestionKey | undefined, sel: string[]): boolean {
  if (!key || !key.correct.length) return false;
  const a = [...key.correct].sort().join(",");
  const b = [...sel].sort().join(",");
  return a === b;
}

function getEffectiveQuestions(seed: SeedData, db: MockDb): SeedQuestion[] {
  return seed.questions.map((q) => {
    const ov = db.question_overrides[q.id];
    return ov ? { ...q, ...ov } : q;
  });
}

function getEffectiveKeys(seed: SeedData, db: MockDb): Map<string, SeedQuestionKey> {
  const m = new Map<string, SeedQuestionKey>();
  for (const k of seed.question_keys) {
    const ov = db.key_overrides[k.question_id];
    m.set(k.question_id, ov ? { ...k, ...ov } : k);
  }
  return m;
}

function grantXp(db: MockDb, uid: string, xp: number, coins: number): void {
  const p = db.profiles.find((x) => x["id"] === uid);
  if (!p) return;
  const today = algiersDateStr();
  const yesterday = algiersDateStr(new Date(Date.now() - 86400000));
  const last = p["last_active_date"] as string | null;
  let streak = Number(p["streak"] ?? 0);
  if (last === today) {
    // unchanged
  } else if (last === yesterday) {
    streak += 1;
  } else {
    streak = 1;
  }
  p["xp"] = Number(p["xp"] ?? 0) + xp;
  p["coins"] = Number(p["coins"] ?? 0) + coins;
  p["streak"] = streak;
  p["last_active_date"] = today;
}

function recordMistake(db: MockDb, uid: string, qid: string, ok: boolean): void {
  const existing = db.question_mistakes.find(
    (m) => m["user_id"] === uid && m["question_id"] === qid,
  );
  const now = new Date().toISOString();
  if (ok) {
    if (existing && !existing["corrected_at"]) {
      existing["corrected_at"] = now;
    }
  } else if (existing) {
    existing["wrong_count"] = Number(existing["wrong_count"] ?? 1) + 1;
    existing["last_wrong_at"] = now;
    existing["corrected_at"] = null;
  } else {
    db.question_mistakes.push({
      user_id: uid,
      question_id: qid,
      wrong_count: 1,
      first_wrong_at: now,
      last_wrong_at: now,
      corrected_at: null,
    });
  }
}

function isCreatorUser(db: MockDb, uid: string | undefined): boolean {
  if (!uid) return false;
  return db.user_roles.some((r) => r["user_id"] === uid && r["role"] === "admin");
}

function hydrateRows(table: string, rows: Row[], selectCols: string, seed: SeedData, db: MockDb): Row[] {
  const subjectsMap = new Map<number, SeedSubject>(seed.subjects.map((s) => [s.id, s]));
  const coursesMap = new Map<string, SeedCourse>(seed.courses.map((c) => [c.id, c]));
  const examsMap = new Map<string, SeedExam>(seed.exams.map((e) => [e.id, e]));
  const keysMap = getEffectiveKeys(seed, db);
  const questionsMap = new Map<string, SeedQuestion>(
    getEffectiveQuestions(seed, db).map((q) => [q.id, q]),
  );

  return rows.map((row) => {
    const out: Row = { ...row };
    if (table === "exams" && selectCols.includes("exam_subjects")) {
      out["exam_subjects"] = seed.exam_subjects
        .filter((es: SeedExamSubject) => es.exam_id === row["id"])
        .map((es) => ({ subject_id: es.subject_id }));
    }
    if (table === "courses" && selectCols.includes("subjects")) {
      const s = subjectsMap.get(Number(row["subject_id"]));
      out["subjects"] = s ? { name: s.name } : null;
    }
    if (table === "questions") {
      if (selectCols.includes("courses")) {
        const c = row["course_id"] ? coursesMap.get(String(row["course_id"])) : undefined;
        const s = c ? subjectsMap.get(c.subject_id) : undefined;
        out["courses"] = c ? { title: c.title, subjects: s ? { name: s.name } : null } : null;
      }
      if (selectCols.includes("exams")) {
        const e = row["exam_id"] ? examsMap.get(String(row["exam_id"])) : undefined;
        out["exams"] = e ? { title: e.title, year: e.year } : null;
      }
      if (selectCols.includes("question_keys")) {
        const k = keysMap.get(String(row["id"]));
        out["question_keys"] = k ?? null;
      }
    }
    if (table === "discussion_messages" && selectCols.includes("profiles")) {
      const p = db.profiles.find((x) => x["id"] === row["user_id"]);
      out["profiles"] = p ? { display_name: p["display_name"] ?? "Étudiant" } : { display_name: "Étudiant" };
    }
    if (table === "question_corrections" && selectCols.includes("questions")) {
      const q = questionsMap.get(String(row["question_id"]));
      const k = q ? keysMap.get(q.id) : undefined;
      out["questions"] = q
        ? {
            stem: q.stem,
            case_text: q.case_text,
            options: q.options,
            question_keys: k ? { correct: k.correct } : null,
          }
        : null;
    }
    return out;
  });
}

type QueryFilter = (row: Row) => boolean;

function createQueryBuilder(table: string) {
  let op: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  let selectCols = "*";
  let countOnly = false;
  let wantCount = false;
  let payload: Row | Row[] | null = null;
  let onConflictCol: string | undefined;
  const filters: QueryFilter[] = [];
  const orders: { col: string; ascending: boolean }[] = [];
  let maxLimit: number | null = null;
  let mode: "many" | "single" | "maybeSingle" = "many";

  async function exec(): Promise<{ data: unknown; error: { message: string } | null; count?: number }> {
    const seed = await getSeed();
    const db = loadDb();
    const session = loadSession();
    const uid = session?.user.id;

    const getTableRef = (): { rows: Row[]; readonly: boolean } => {
      switch (table) {
        case "subjects":
          return { rows: seed.subjects as unknown as Row[], readonly: true };
        case "courses":
          return { rows: seed.courses as unknown as Row[], readonly: true };
        case "exams":
          return { rows: seed.exams as unknown as Row[], readonly: true };
        case "exam_subjects":
          return { rows: seed.exam_subjects as unknown as Row[], readonly: true };
        case "questions":
          return { rows: getEffectiveQuestions(seed, db) as unknown as Row[], readonly: false };
        case "question_keys":
          return { rows: [...getEffectiveKeys(seed, db).values()] as unknown as Row[], readonly: false };
        case "profiles":
          return { rows: db.profiles, readonly: false };
        case "user_roles":
          return { rows: db.user_roles, readonly: false };
        case "attempts":
          return { rows: db.attempts, readonly: false };
        case "practice_attempts":
          return { rows: db.practice_attempts, readonly: false };
        case "exam_hearts":
          return { rows: db.exam_hearts, readonly: false };
        case "question_mistakes":
          return { rows: db.question_mistakes, readonly: false };
        case "tomatoes":
          return { rows: db.tomatoes, readonly: false };
        case "mission_claims":
          return { rows: db.mission_claims, readonly: false };
        case "discussion_messages":
          return { rows: db.discussion_messages, readonly: false };
        case "discussion_reactions":
          return { rows: db.discussion_reactions, readonly: false };
        case "lesson_quizzes":
          return { rows: db.lesson_quizzes, readonly: false };
        case "question_corrections":
          return { rows: db.question_corrections, readonly: false };
        case "avatar_settings":
          return { rows: db.avatar_settings, readonly: false };
        default:
          return { rows: [], readonly: true };
      }
    };

    const userScopedTables = new Set([
      "attempts",
      "practice_attempts",
      "exam_hearts",
      "question_mistakes",
      "mission_claims",
      "lesson_quizzes",
    ]);

    if (op === "select") {
      const { rows } = getTableRef();
      let list = [...rows];
      if (uid && userScopedTables.has(table) && !isCreatorUser(db, uid)) {
        list = list.filter((r) => r["user_id"] === uid);
      }
      for (const f of filters) list = list.filter(f);
      if (orders.length) {
        list.sort((a, b) => {
          for (const o of orders) {
            const av = a[o.col];
            const bv = b[o.col];
            if (av === bv) continue;
            if (av == null) return o.ascending ? 1 : -1;
            if (bv == null) return o.ascending ? -1 : 1;
            const cmp = av < bv ? -1 : 1;
            return o.ascending ? cmp : -cmp;
          }
          return 0;
        });
      }
      const totalCount = list.length;
      if (maxLimit !== null) list = list.slice(0, maxLimit);
      const hydrated = countOnly ? [] : hydrateRows(table, list, selectCols, seed, db);

      if (mode === "single") {
        if (!hydrated.length) return { data: null, error: { message: "Row not found" } };
        return { data: hydrated[0], error: null, ...(wantCount ? { count: totalCount } : {}) };
      }
      if (mode === "maybeSingle") {
        return { data: hydrated[0] ?? null, error: null, ...(wantCount ? { count: totalCount } : {}) };
      }
      return {
        data: countOnly ? null : hydrated,
        error: null,
        ...(wantCount ? { count: totalCount } : {}),
      };
    }

    if (op === "insert") {
      const items = Array.isArray(payload) ? payload : payload ? [payload] : [];
      const { rows } = getTableRef();
      const inserted: Row[] = [];
      for (const item of items) {
        const rec: Row = {
          id: makeUuid(),
          created_at: new Date().toISOString(),
          ...(uid && !item["user_id"] ? { user_id: uid } : {}),
          ...item,
        };
        rows.push(rec);
        inserted.push(rec);
        emitRealtime(table, "INSERT", rec);
      }
      saveDb(db);
      if (mode === "single" || mode === "maybeSingle") {
        return { data: inserted[0] ?? null, error: null };
      }
      return { data: inserted, error: null };
    }

    if (op === "update") {
      const patch = (Array.isArray(payload) ? payload[0] : payload) ?? {};
      if (table === "questions") {
        const matched = getEffectiveQuestions(seed, db).filter((r) =>
          filters.every((f) => f(r as unknown as Row)),
        );
        for (const q of matched) {
          db.question_overrides[q.id] = { ...(db.question_overrides[q.id] ?? {}), ...(patch as Partial<SeedQuestion>) };
        }
        saveDb(db);
        return { data: matched, error: null };
      }
      const { rows } = getTableRef();
      const updated: Row[] = [];
      for (const r of rows) {
        if (filters.every((f) => f(r))) {
          Object.assign(r, patch);
          updated.push(r);
          emitRealtime(table, "UPDATE", r);
        }
      }
      saveDb(db);
      return { data: mode === "single" || mode === "maybeSingle" ? (updated[0] ?? null) : updated, error: null };
    }

    if (op === "upsert") {
      const items = Array.isArray(payload) ? payload : payload ? [payload] : [];
      if (table === "question_keys") {
        for (const item of items) {
          const qid = String(item["question_id"]);
          db.key_overrides[qid] = { ...(db.key_overrides[qid] ?? {}), ...(item as Partial<SeedQuestionKey>) };
        }
        saveDb(db);
        return { data: items, error: null };
      }
      const { rows } = getTableRef();
      const keyCol = onConflictCol ?? "id";
      for (const item of items) {
        const idx = rows.findIndex((r) => r[keyCol] !== undefined && r[keyCol] === item[keyCol]);
        if (idx >= 0) {
          Object.assign(rows[idx]!, item);
        } else {
          rows.push({ id: makeUuid(), created_at: new Date().toISOString(), ...item });
        }
      }
      saveDb(db);
      return { data: items, error: null };
    }

    if (op === "delete") {
      const { rows } = getTableRef();
      for (let idx = rows.length - 1; idx >= 0; idx--) {
        if (filters.every((f) => f(rows[idx]!))) {
          const [removed] = rows.splice(idx, 1);
          if (removed) emitRealtime(table, "DELETE", removed);
        }
      }
      saveDb(db);
      return { data: null, error: null };
    }

    return { data: null, error: null };
  }

  const builder = {
    select(cols = "*", opts?: { count?: "exact" | "planned" | "estimated"; head?: boolean }) {
      if (op === "select") {
        selectCols = cols;
        if (opts?.count) wantCount = true;
        if (opts?.head) countOnly = true;
      }
      return builder;
    },
    insert(data: Row | Row[]) {
      op = "insert";
      payload = data;
      return builder;
    },
    update(data: Row) {
      op = "update";
      payload = data;
      return builder;
    },
    upsert(data: Row | Row[], opts?: { onConflict?: string }) {
      op = "upsert";
      payload = data;
      onConflictCol = opts?.onConflict;
      return builder;
    },
    delete() {
      op = "delete";
      return builder;
    },
    eq(col: string, val: unknown) {
      filters.push((r) => r[col] === val);
      return builder;
    },
    neq(col: string, val: unknown) {
      filters.push((r) => r[col] !== val);
      return builder;
    },
    in(col: string, vals: unknown[]) {
      const set = new Set(vals);
      filters.push((r) => set.has(r[col]));
      return builder;
    },
    not(col: string, operator: string, val: unknown) {
      if (operator === "is" && val === null) {
        filters.push((r) => r[col] !== null && r[col] !== undefined);
      } else {
        filters.push((r) => r[col] !== val);
      }
      return builder;
    },
    gte(col: string, val: string | number) {
      filters.push((r) => {
        const rv = r[col];
        if (rv == null) return false;
        return String(rv) >= String(val);
      });
      return builder;
    },
    ilike(col: string, pattern: string) {
      const needle = pattern.replace(/%/g, "").toLowerCase();
      filters.push((r) => String(r[col] ?? "").toLowerCase().includes(needle));
      return builder;
    },
    or(expr: string) {
      const parts = expr.split(",");
      filters.push((r) =>
        parts.some((p) => {
          const [c, opName, v] = p.split(".");
          if (!c || !opName) return false;
          if (opName === "eq") return String(r[c]) === v;
          if (opName === "neq") return String(r[c] ?? "") !== v;
          return false;
        }),
      );
      return builder;
    },
    order(col: string, opts?: { ascending?: boolean }) {
      orders.push({ col, ascending: opts?.ascending ?? true });
      return builder;
    },
    limit(n: number) {
      maxLimit = n;
      return builder;
    },
    single() {
      mode = "single";
      return builder;
    },
    maybeSingle() {
      mode = "maybeSingle";
      return builder;
    },
    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown; error: { message: string } | null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return exec().then(onfulfilled, onrejected);
    },
  };

  return builder;
}

async function handleRpc(fn: string, args: Row = {}): Promise<{ data: unknown; error: { message: string } | null }> {
  const seed = await getSeed();
  const db = loadDb();
  const session = loadSession();
  const uid = session?.user.id;
  const keysMap = getEffectiveKeys(seed, db);
  const questionsList = getEffectiveQuestions(seed, db);
  const questionsMap = new Map(questionsList.map((q) => [q.id, q]));

  switch (fn) {
    case "is_creator":
      return { data: isCreatorUser(db, uid), error: null };

    case "has_role":
      return {
        data: db.user_roles.some((r) => r["user_id"] === args["_user_id"] && r["role"] === args["_role"]),
        error: null,
      };

    case "creator_ids":
      return {
        data: db.user_roles.filter((r) => r["role"] === "admin").map((r) => r["user_id"]),
        error: null,
      };

    case "my_course_counts": {
      const counts = new Map<string, number>();
      for (const q of questionsList) {
        if (q.course_id) counts.set(q.course_id, (counts.get(q.course_id) ?? 0) + 1);
      }
      return {
        data: [...counts.entries()].map(([course_id, n]) => ({ course_id, n })),
        error: null,
      };
    }

    case "exam_status": {
      if (!uid) return { data: [], error: { message: "auth required" } };
      if (isCreatorUser(db, uid)) {
        return { data: [{ hearts_left: 999, locked_until: null, unlimited: true }], error: null };
      }
      const examId = String(args["_exam"]);
      const h = db.exam_hearts.find((x) => x["user_id"] === uid && x["exam_id"] === examId);
      if (!h) return { data: [{ hearts_left: 2, locked_until: null, unlimited: false }], error: null };
      if (h["locked_until"] && new Date(String(h["locked_until"])).getTime() <= Date.now()) {
        h["used"] = 0;
        h["locked_until"] = null;
        saveDb(db);
        return { data: [{ hearts_left: 2, locked_until: null, unlimited: false }], error: null };
      }
      const left = Math.max(0, 2 - Number(h["used"] ?? 0));
      return {
        data: [{ hearts_left: left, locked_until: h["locked_until"] ?? null, unlimited: false }],
        error: null,
      };
    }

    case "start_attempt": {
      if (!uid) return { data: null, error: { message: "auth required" } };
      const examId = String(args["_exam"]);
      const existing = db.attempts.find(
        (a) => a["user_id"] === uid && a["exam_id"] === examId && !a["submitted_at"],
      );
      if (existing) return { data: existing["id"], error: null };

      const stRes = await handleRpc("exam_status", { _exam: examId });
      const st = (stRes.data as { hearts_left: number; locked_until: string | null; unlimited: boolean }[])[0];
      if (
        st &&
        !st.unlimited &&
        (st.hearts_left <= 0 || (st.locked_until && new Date(st.locked_until).getTime() > Date.now()))
      ) {
        return { data: null, error: { message: "EXAM_LOCKED" } };
      }
      const id = makeUuid();
      db.attempts.push({
        id,
        user_id: uid,
        exam_id: examId,
        started_at: new Date().toISOString(),
        submitted_at: null,
        duration_sec: null,
        answers: {},
        total: null,
        correct_count: null,
        wrong_count: null,
        unanswered_count: null,
        score20: null,
        attempt_number: null,
      });
      saveDb(db);
      return { data: id, error: null };
    }

    case "save_exam_answers": {
      if (!uid) return { data: null, error: { message: "auth required" } };
      const a = db.attempts.find((x) => x["id"] === args["_attempt"] && x["user_id"] === uid);
      if (!a) return { data: null, error: { message: "not found" } };
      if (a["submitted_at"]) return { data: null, error: { message: "EXAM_EXPIRED" } };
      a["answers"] = (args["_answers"] as Row) ?? {};
      saveDb(db);
      return { data: null, error: null };
    }

    case "check_answer": {
      if (!uid) return { data: null, error: { message: "auth required" } };
      const qid = String(args["_q"]);
      const sel = (args["_sel"] as string[]) ?? [];
      const record = Boolean(args["_record"]);
      const k = keysMap.get(qid);
      const ok = isCorrectSelection(k, sel);
      if (!record) return { data: { correct: ok }, error: null };
      recordMistake(db, uid, qid, ok);
      saveDb(db);
      return {
        data: {
          correct: ok,
          official: k?.correct ?? [],
          explanation: k?.explanation ?? null,
          note: k?.note ?? null,
        },
        error: null,
      };
    }

    case "submit_attempt": {
      if (!uid) return { data: null, error: { message: "auth required" } };
      const attemptId = String(args["_attempt"]);
      const a = db.attempts.find((x) => x["id"] === attemptId && x["user_id"] === uid);
      if (!a) return { data: null, error: { message: "not found" } };
      if (a["submitted_at"]) return { data: { attempt_id: a["id"] }, error: null };

      const answers = (args["_answers"] as Record<string, string[]>) ?? {};
      const qs = questionsList.filter((q) => q.exam_id === a["exam_id"]);
      let tot = 0;
      let c = 0;
      let w = 0;
      let u = 0;
      for (const q of qs) {
        tot++;
        const sel = answers[q.id] ?? [];
        if (!sel.length) {
          u++;
          recordMistake(db, uid, q.id, false);
        } else {
          const ok = isCorrectSelection(keysMap.get(q.id), sel);
          if (ok) c++;
          else w++;
          recordMistake(db, uid, q.id, ok);
        }
      }
      const dur = Math.min(
        3600,
        Math.max(0, Math.round((Date.now() - new Date(String(a["started_at"])).getTime()) / 1000)),
      );
      const prevCount = db.attempts.filter(
        (x) => x["user_id"] === uid && x["exam_id"] === a["exam_id"] && x["submitted_at"],
      ).length;
      const sc = tot === 0 ? 0 : Math.round(((c * 20) / tot) * 100) / 100;

      a["submitted_at"] = new Date().toISOString();
      a["duration_sec"] = dur;
      a["answers"] = answers;
      a["total"] = tot;
      a["correct_count"] = c;
      a["wrong_count"] = w;
      a["unanswered_count"] = u;
      a["score20"] = sc;
      a["attempt_number"] = prevCount + 1;

      if (!isCreatorUser(db, uid)) {
        let h = db.exam_hearts.find((x) => x["user_id"] === uid && x["exam_id"] === a["exam_id"]);
        if (!h) {
          h = { user_id: uid, exam_id: a["exam_id"], used: 0, locked_until: null };
          db.exam_hearts.push(h);
        }
        h["used"] = Number(h["used"] ?? 0) + 1;
        if (Number(h["used"]) >= 2) {
          h["locked_until"] = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        }
      }
      grantXp(db, uid, 20 + c * 2, 5 + c);
      saveDb(db);
      emitRealtime("attempts", "UPDATE", a);
      return { data: { attempt_id: attemptId }, error: null };
    }

    case "attempt_review": {
      if (!uid) return { data: [], error: { message: "auth required" } };
      const a = db.attempts.find(
        (x) =>
          x["id"] === args["_attempt"] &&
          x["submitted_at"] &&
          (x["user_id"] === uid || isCreatorUser(db, uid)),
      );
      if (!a) return { data: [], error: null };
      const answers = (a["answers"] as Record<string, string[]>) ?? {};
      const qs = questionsList
        .filter((q) => q.exam_id === a["exam_id"])
        .sort((x, y) => x.pos - y.pos);
      const rows = qs.map((q) => {
        const sel = answers[q.id] ?? [];
        const k = keysMap.get(q.id);
        return {
          question_id: q.id,
          pos: q.pos,
          case_text: q.case_text,
          stem: q.stem,
          options: q.options,
          selected: sel,
          official: k?.correct ?? [],
          explanation: k?.explanation ?? null,
          note: k?.note ?? null,
          source_file: q.source_file,
          source_page: q.source_page,
          ok: isCorrectSelection(k, sel),
        };
      });
      return { data: rows, error: null };
    }

    case "leaderboard": {
      const examId = String(args["_exam"]);
      const bestByUser = new Map<string, { score: number; time: number }>();
      for (const a of db.attempts) {
        if (a["exam_id"] !== examId || !a["submitted_at"]) continue;
        const u = String(a["user_id"]);
        const sc = Number(a["score20"] ?? 0);
        const tm = Number(a["duration_sec"] ?? 0);
        const cur = bestByUser.get(u);
        if (!cur || sc > cur.score || (sc === cur.score && tm < cur.time)) {
          bestByUser.set(u, { score: sc, time: tm });
        }
      }
      const nowMs = Date.now();
      const sorted = [...bestByUser.entries()].sort(
        (x, y) => y[1].score - x[1].score || x[1].time - y[1].time,
      );
      const rows = sorted.map(([u, b], i) => {
        const p = db.profiles.find((x) => x["id"] === u);
        const activeTomatoes = db.tomatoes
          .filter((t) => t["target_id"] === u && new Date(String(t["expires_at"])).getTime() > nowMs)
          .map((t) => String(t["expires_at"]))
          .sort();
        return {
          user_id: u,
          display_name: p?.["display_name"] ?? "Étudiant",
          avatar: p?.["avatar"] ?? DEFAULT_AVATAR,
          pet: p?.["pet"] ?? null,
          bubble: p?.["bubble"] ?? null,
          best_score: b.score,
          best_time: b.time,
          rnk: i + 1,
          tomato_until: activeTomatoes[activeTomatoes.length - 1] ?? null,
        };
      });
      return { data: rows, error: null };
    }

    case "throw_tomato": {
      if (!uid) return { data: null, error: { message: "auth required" } };
      const examId = String(args["_exam"]);
      const target = String(args["_target"]);
      if (target === uid) return { data: null, error: { message: "NO_SELF" } };
      const hasTarget = db.attempts.some(
        (a) => a["exam_id"] === examId && a["user_id"] === target && a["submitted_at"],
      );
      if (!hasTarget) return { data: null, error: { message: "TARGET_NOT_IN_BOARD" } };
      if (!isCreatorUser(db, uid)) {
        const lbRes = await handleRpc("leaderboard", { _exam: examId });
        const lb = (lbRes.data as { user_id: string; rnk: number }[]) ?? [];
        const mine = lb.find((x) => x.user_id === uid);
        if (!mine || mine.rnk > 5) return { data: null, error: { message: "TOP5_ONLY" } };
        const tenMinAgo = Date.now() - 10 * 60 * 1000;
        if (db.tomatoes.some((t) => t["thrower_id"] === uid && new Date(String(t["created_at"])).getTime() > tenMinAgo)) {
          return { data: null, error: { message: "COOLDOWN" } };
        }
        const dayAgo = Date.now() - 24 * 3600 * 1000;
        if (
          db.tomatoes.some(
            (t) =>
              t["thrower_id"] === uid &&
              t["target_id"] === target &&
              new Date(String(t["created_at"])).getTime() > dayAgo,
          )
        ) {
          return { data: null, error: { message: "ALREADY_HIT" } };
        }
      }
      const tRow = {
        id: makeUuid(),
        thrower_id: uid,
        target_id: target,
        exam_id: examId,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      };
      db.tomatoes.push(tRow);
      saveDb(db);
      emitRealtime("tomatoes", "INSERT", tRow);
      return { data: { ok: true }, error: null };
    }

    case "claim_mission": {
      if (!uid) return { data: null, error: { message: "auth required" } };
      const key = String(args["_key"]);
      const today = algiersDateStr();
      const wk = isoWeekKey();
      const rewards: Record<string, { period: string; xp: number; coins: number }> = {
        daily_exam: { period: today, xp: 30, coins: 10 },
        daily_review: { period: today, xp: 40, coins: 15 },
        weekly_exams: { period: wk, xp: 150, coins: 60 },
        weekly_streak: { period: wk, xp: 120, coins: 50 },
      };
      const r = rewards[key];
      if (!r) return { data: null, error: { message: "unknown" } };
      if (db.mission_claims.some((c) => c["user_id"] === uid && c["mission_key"] === key && c["period_key"] === r.period)) {
        return { data: null, error: { message: "Already claimed" } };
      }
      db.mission_claims.push({
        user_id: uid,
        mission_key: key,
        period_key: r.period,
        claimed_at: new Date().toISOString(),
      });
      grantXp(db, uid, r.xp, r.coins);
      saveDb(db);
      return { data: { xp: r.xp, coins: r.coins }, error: null };
    }

    case "start_practice": {
      if (!uid) return { data: null, error: { message: "auth required" } };
      const qids = (args["_questions"] as string[]) ?? [];
      if (!qids.length) return { data: null, error: { message: "invalid questions" } };
      const sig = qids.join(",");
      const existing = db.practice_attempts.find(
        (pa) =>
          pa["user_id"] === uid &&
          !pa["submitted_at"] &&
          ((pa["question_ids"] as string[]) ?? []).join(",") === sig,
      );
      if (existing) return { data: existing["id"], error: null };
      const id = makeUuid();
      db.practice_attempts.push({
        id,
        user_id: uid,
        question_ids: qids,
        answers: {},
        started_at: new Date().toISOString(),
        submitted_at: null,
        total: null,
        correct_count: null,
        wrong_count: null,
        unanswered_count: null,
        score20: null,
      });
      saveDb(db);
      return { data: id, error: null };
    }

    case "answer_practice": {
      if (!uid) return { data: null, error: { message: "auth required" } };
      const a = db.practice_attempts.find(
        (x) => x["id"] === args["_attempt"] && x["user_id"] === uid && !x["submitted_at"],
      );
      if (!a) return { data: null, error: { message: "invalid attempt" } };
      const qid = String(args["_q"]);
      const sel = (args["_sel"] as string[]) ?? [];
      const k = keysMap.get(qid);
      const ok = isCorrectSelection(k, sel);
      const answers = (a["answers"] as Record<string, string[]>) ?? {};
      if (!(qid in answers)) {
        recordMistake(db, uid, qid, ok);
      }
      answers[qid] = sel;
      a["answers"] = answers;
      saveDb(db);
      return {
        data: {
          correct: ok,
          official: k?.correct ?? [],
          explanation: k?.explanation ?? null,
          note: k?.note ?? null,
        },
        error: null,
      };
    }

    case "finish_practice": {
      if (!uid) return { data: null, error: { message: "auth required" } };
      const a = db.practice_attempts.find((x) => x["id"] === args["_attempt"] && x["user_id"] === uid);
      if (!a) return { data: null, error: { message: "not found" } };
      const qids = (a["question_ids"] as string[]) ?? [];
      const answers = (a["answers"] as Record<string, string[]>) ?? {};
      let c = 0;
      let w = 0;
      let u = 0;
      const errors: string[] = [];
      for (const qid of qids) {
        const sel = answers[qid] ?? [];
        if (!sel.length) {
          u++;
          errors.push(qid);
          if (!a["submitted_at"]) recordMistake(db, uid, qid, false);
        } else if (isCorrectSelection(keysMap.get(qid), sel)) {
          c++;
        } else {
          w++;
          errors.push(qid);
        }
      }
      const sc = qids.length === 0 ? 0 : Math.round(((c * 20) / qids.length) * 100) / 100;
      if (!a["submitted_at"]) {
        a["submitted_at"] = new Date().toISOString();
        a["total"] = qids.length;
        a["correct_count"] = c;
        a["wrong_count"] = w;
        a["unanswered_count"] = u;
        a["score20"] = sc;
        saveDb(db);
      }
      return {
        data: {
          id: a["id"],
          total: qids.length,
          correct: c,
          wrong: w,
          unanswered: u,
          score20: sc,
          errors,
        },
        error: null,
      };
    }

    case "admin_student_stats": {
      if (!isCreatorUser(db, uid)) return { data: null, error: { message: "forbidden" } };
      const stats = db.profiles.map((p) => {
        const pid = String(p["id"]);
        const doneAttempts = db.attempts.filter((a) => a["user_id"] === pid && a["submitted_at"]);
        const scores = doneAttempts.map((a) => Number(a["score20"] ?? 0));
        const avg = scores.length ? Math.round((scores.reduce((s, x) => s + x, 0) / scores.length) * 100) / 100 : null;
        const best = scores.length ? Math.max(...scores) : null;
        const pDone = db.practice_attempts.filter((pa) => pa["user_id"] === pid && pa["submitted_at"]).length;
        const openM = db.question_mistakes.filter((m) => m["user_id"] === pid && !m["corrected_at"]).length;
        return {
          user_id: pid,
          display_name: p["display_name"] ?? null,
          avatar: p["avatar"] ?? DEFAULT_AVATAR,
          xp: Number(p["xp"] ?? 0),
          coins: Number(p["coins"] ?? 0),
          streak: Number(p["streak"] ?? 0),
          created_at: p["created_at"],
          exams_done: doneAttempts.length,
          avg_score: avg,
          best_score: best,
          practice_done: pDone,
          mistakes_open: openM,
          last_active: p["last_active_date"] ?? p["created_at"],
        };
      });
      return { data: stats, error: null };
    }

    case "apply_question_correction": {
      if (!isCreatorUser(db, uid)) return { data: null, error: { message: "forbidden" } };
      const c = db.question_corrections.find(
        (x) => x["id"] === args["_id"] && x["status"] === "pending",
      );
      if (!c) return { data: null, error: { message: "not pending" } };
      if (!args["_accept"]) {
        c["status"] = "rejected";
        c["reviewed_at"] = new Date().toISOString();
        saveDb(db);
        return { data: null, error: null };
      }
      const qid = String(c["question_id"]);
      const q = questionsMap.get(qid);
      const k = keysMap.get(qid);
      c["status"] = "applied";
      c["reviewed_at"] = new Date().toISOString();
      c["original"] = q ? { stem: q.stem, case_text: q.case_text, options: q.options, correct: k?.correct ?? [] } : null;
      if (q) {
        db.question_overrides[qid] = {
          ...(db.question_overrides[qid] ?? {}),
          stem: (c["proposed_stem"] as string | null) ?? q.stem,
          case_text: (c["proposed_case_text"] as string | null) ?? q.case_text,
          options: (c["proposed_options"] as SeedQuestion["options"] | null) ?? q.options,
          needs_review: false,
          review_reason: null,
        };
      }
      const propCorrect = c["proposed_correct"] as string[] | null;
      if (propCorrect && propCorrect.length) {
        db.key_overrides[qid] = { ...(db.key_overrides[qid] ?? {}), correct: propCorrect };
      }
      saveDb(db);
      return { data: null, error: null };
    }

    default:
      return { data: null, error: null };
  }
}

export function createMockSupabaseClient(): SupabaseClient<Database> {
  const client = {
    auth: {
      async getSession() {
        return { data: { session: loadSession() }, error: null };
      },
      async getUser() {
        const s = loadSession();
        return { data: { user: s?.user ?? null }, error: s ? null : { message: "Not authenticated" } };
      },
      onAuthStateChange(cb: AuthListener) {
        authListeners.add(cb);
        return {
          data: {
            subscription: {
              unsubscribe: () => {
                authListeners.delete(cb);
              },
            },
          },
        };
      },
      async signInWithPassword({ email }: { email: string; password: string }) {
        const session = ensureUserRecords(email);
        emitAuth("SIGNED_IN", session);
        return { data: { user: session.user, session }, error: null };
      },
      async signUp({ email }: { email: string; password: string }) {
        const session = ensureUserRecords(email);
        emitAuth("SIGNED_IN", session);
        return { data: { user: session.user, session }, error: null };
      },
      async signOut() {
        saveSession(null);
        emitAuth("SIGNED_OUT", null);
        return { error: null };
      },
      async setSession(tokens: { access_token: string; refresh_token: string }) {
        void tokens;
        return { data: { session: loadSession(), user: loadSession()?.user ?? null }, error: null };
      },
    },
    from(table: string) {
      return createQueryBuilder(table);
    },
    rpc(fn: string, args?: Row) {
      return handleRpc(fn, args);
    },
    channel(_name: string) {
      const regs: RealtimeRegistration[] = [];
      const ch = {
        on(
          _type: string,
          filter: { table?: string },
          callback: (payload: { eventType: string; new: Row; old: Row }) => void,
        ) {
          if (filter.table) {
            const reg = { table: filter.table, callback };
            regs.push(reg);
            realtimeChannels.add(reg);
          }
          return ch;
        },
        subscribe() {
          return ch;
        },
        _regs: regs,
      };
      return ch;
    },
    async removeChannel(ch: { _regs?: RealtimeRegistration[] }) {
      for (const r of ch?._regs ?? []) realtimeChannels.delete(r);
      return "ok";
    },
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, file: Blob) {
            storageFiles.set(`${bucket}/${path}`, file);
            return { data: { path }, error: null };
          },
          async download(path: string) {
            const file = storageFiles.get(`${bucket}/${path}`);
            return file ? { data: file, error: null } : { data: null, error: { message: "Not found" } };
          },
        };
      },
    },
  };

  return client as unknown as SupabaseClient<Database>;
}
