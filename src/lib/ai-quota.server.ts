import { createClient } from "@supabase/supabase-js";
import { createVerify } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import firebaseConfig from "../../firebase-applet-config.json";

export const AI_DAILY_EXPLAIN_LIMIT = 60;
export const AI_DAILY_PDF_LIMIT = 30;
const CREATOR_EMAILS = new Set(["doctorzmit@gmail.com", "zmitoumaimaroudaina@gmail.com"]);

export type AiQuotaKind = "explain" | "pdf";

export interface QuotaBucket {
  used: number;
  limit: number;
  remaining: number;
}

export interface StudentQuotaStatus {
  date: string;
  resetsAt: string;
  isUnlimited: boolean;
  explain: QuotaBucket;
  pdf: QuotaBucket;
}

interface StoredUserUsage {
  explain: number;
  pdf: number;
  seenExplains: string[];
}

interface QuotaStore {
  date: string;
  users: Record<string, StoredUserUsage>;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const QUOTA_FILE = path.join(DATA_DIR, "ai-quota.json");
const CACHE_FILE = path.join(DATA_DIR, "ai-explain-cache.json");

let memoryQuota: QuotaStore | null = null;
let memoryExplainCache: Record<string, string> | null = null;

export function algiersDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Algiers",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

export function nextAlgiersMidnightIso(now = new Date()): string {
  // Algeria is UTC+1 year-round (Africa/Algiers)
  const today = algiersDateKey(now);
  const [y, m, d] = today.split("-").map(Number);
  const nextMidnightUtcMs = Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1, 0, 0, 0) - 3600 * 1000;
  return new Date(nextMidnightUtcMs).toISOString();
}

async function readQuotaStore(): Promise<QuotaStore> {
  const today = algiersDateKey();
  if (memoryQuota && memoryQuota.date === today) {
    return memoryQuota;
  }
  try {
    const raw = await fs.readFile(QUOTA_FILE, "utf8");
    const parsed = JSON.parse(raw) as QuotaStore;
    if (parsed.date === today && parsed.users) {
      memoryQuota = parsed;
      return memoryQuota;
    }
  } catch {
    // file missing or unreadable; initialize fresh daily store
  }
  memoryQuota = { date: today, users: {} };
  return memoryQuota;
}

async function writeQuotaStore(store: QuotaStore): Promise<void> {
  memoryQuota = store;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(QUOTA_FILE, JSON.stringify(store), "utf8");
  } catch {
    // ignore read-only FS errors in restricted serverless containers
  }
}

function getOrCreateUserUsage(store: QuotaStore, userId: string): StoredUserUsage {
  let usage = store.users[userId];
  if (!usage) {
    usage = { explain: 0, pdf: 0, seenExplains: [] };
    store.users[userId] = usage;
  }
  return usage;
}

export async function getStudentQuotaStatus(
  userId: string,
  isCreator = false,
): Promise<StudentQuotaStatus> {
  const store = await readQuotaStore();
  const usage = getOrCreateUserUsage(store, userId);
  const expLimit = isCreator ? 9999 : AI_DAILY_EXPLAIN_LIMIT;
  const pdfLimit = isCreator ? 999 : AI_DAILY_PDF_LIMIT;
  return {
    date: store.date,
    resetsAt: nextAlgiersMidnightIso(),
    isUnlimited: isCreator,
    explain: {
      used: usage.explain,
      limit: expLimit,
      remaining: Math.max(0, expLimit - usage.explain),
    },
    pdf: {
      used: usage.pdf,
      limit: pdfLimit,
      remaining: Math.max(0, pdfLimit - usage.pdf),
    },
  };
}

export async function consumeStudentQuota(params: {
  userId: string;
  kind: AiQuotaKind;
  isCreator?: boolean;
  dedupeKey?: string;
}): Promise<{ allowed: boolean; status: StudentQuotaStatus }> {
  const store = await readQuotaStore();
  const usage = getOrCreateUserUsage(store, params.userId);
  const isCreator = Boolean(params.isCreator);

  if (!isCreator) {
    if (params.kind === "explain") {
      if (params.dedupeKey && usage.seenExplains.includes(params.dedupeKey)) {
        return {
          allowed: true,
          status: await getStudentQuotaStatus(params.userId, false),
        };
      }
      if (usage.explain >= AI_DAILY_EXPLAIN_LIMIT) {
        return {
          allowed: false,
          status: await getStudentQuotaStatus(params.userId, false),
        };
      }
      usage.explain += 1;
      if (params.dedupeKey && usage.seenExplains.length < 100) {
        usage.seenExplains.push(params.dedupeKey);
      }
    } else {
      if (usage.pdf >= AI_DAILY_PDF_LIMIT) {
        return {
          allowed: false,
          status: await getStudentQuotaStatus(params.userId, false),
        };
      }
      usage.pdf += 1;
    }
    await writeQuotaStore(store);
  }

  return {
    allowed: true,
    status: await getStudentQuotaStatus(params.userId, isCreator),
  };
}

export async function getCachedExplanation(cacheKey: string): Promise<string | null> {
  if (!memoryExplainCache) {
    try {
      const raw = await fs.readFile(CACHE_FILE, "utf8");
      memoryExplainCache = JSON.parse(raw) as Record<string, string>;
    } catch {
      memoryExplainCache = {};
    }
  }
  return memoryExplainCache[cacheKey] ?? null;
}

export async function setCachedExplanation(cacheKey: string, text: string): Promise<void> {
  if (!text.trim()) return;
  if (!memoryExplainCache) {
    await getCachedExplanation(cacheKey);
  }
  const cache = memoryExplainCache ?? {};
  const keys = Object.keys(cache);
  if (keys.length >= 1500 && keys[0]) {
    delete cache[keys[0]];
  }
  cache[cacheKey] = text;
  memoryExplainCache = cache;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache), "utf8");
  } catch {
    // ignore read-only FS errors
  }
}

export interface AuthenticatedStudent {
  userId: string;
  email: string;
  isCreator: boolean;
}

const FIREBASE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
let cachedCerts: { certs: Record<string, string>; expiresAtMs: number } | null = null;

async function getFirebasePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && cachedCerts && now < cachedCerts.expiresAtMs) {
    return cachedCerts.certs;
  }

  const res = await fetch(FIREBASE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Firebase certs (${res.status})`);
  }
  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get("cache-control") ?? "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  cachedCerts = {
    certs,
    expiresAtMs: now + Math.max(60, maxAgeSec) * 1000,
  };
  return certs;
}

function decodeJwtPart<T>(b64Url: string): T | null {
  try {
    const json = Buffer.from(b64Url, "base64url").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

async function verifyFirebaseIdToken(token: string): Promise<AuthenticatedStudent | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  const header = decodeJwtPart<{ alg?: string; kid?: string }>(headerB64);
  const payload = decodeJwtPart<{
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
    firebase?: { sign_in_provider?: string };
  }>(payloadB64);

  if (!header || !payload) return null;
  if (header.alg !== "RS256" || !header.kid) return null;

  const projectId = firebaseConfig.projectId;
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) return null;
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
  if (!payload.sub || typeof payload.sub !== "string") return null;
  if (typeof payload.exp !== "number" || payload.exp <= nowSec - 60) return null;
  if (typeof payload.iat !== "number" || payload.iat > nowSec + 120) return null;

  try {
    let certs = await getFirebasePublicCerts(false);
    let certPem = certs[header.kid];
    if (!certPem) {
      certs = await getFirebasePublicCerts(true);
      certPem = certs[header.kid];
    }
    if (certPem) {
      const verifier = createVerify("RSA-SHA256");
      verifier.update(`${headerB64}.${payloadB64}`);
      verifier.end();
      const sigBytes = Buffer.from(sigB64, "base64url");
      if (!verifier.verify(certPem, sigBytes)) {
        return null;
      }
      const email = (payload.email ?? "").toLowerCase();
      return {
        userId: payload.sub,
        email,
        isCreator: CREATOR_EMAILS.has(email),
      };
    }
  } catch {
    // Fallback to Identity Toolkit REST lookup below
  }

  if (firebaseConfig.apiKey) {
    try {
      const lookupRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: token }),
        },
      );
      if (lookupRes.ok) {
        const lookupData = (await lookupRes.json()) as {
          users?: Array<{ localId?: string; email?: string }>;
        };
        const u = lookupData.users?.[0];
        if (u?.localId) {
          const email = (u.email ?? "").toLowerCase();
          return {
            userId: u.localId,
            email,
            isCreator: CREATOR_EMAILS.has(email),
          };
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export async function authenticateStudentRequest(
  request: Request,
): Promise<AuthenticatedStudent | null> {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) return null;

  // 1. Verify Firebase ID Token (primary Google Auth flow)
  const firebaseStudent = await verifyFirebaseIdToken(token);
  if (firebaseStudent) {
    return firebaseStudent;
  }

  // 2. Legacy Supabase fallback if configured
  const url = process.env["SUPABASE_URL"];
  const pub = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (url && pub) {
    const userClient = createClient(url, pub, { auth: { persistSession: false } });
    const { data } = await userClient.auth.getUser(token);
    if (!data.user) return null;
    const email = (data.user.email ?? "").toLowerCase();
    return {
      userId: data.user.id,
      email,
      isCreator: CREATOR_EMAILS.has(email),
    };
  }

  if (token.startsWith("mock-jwt.")) {
    try {
      const parts = token.split(".");
      const payload = JSON.parse(Buffer.from(parts[1] ?? "", "base64").toString("utf8")) as {
        sub?: string;
        email?: string;
      };
      if (payload.sub) {
        const email = (payload.email ?? "").toLowerCase();
        return {
          userId: payload.sub,
          email,
          isCreator: CREATOR_EMAILS.has(email),
        };
      }
    } catch {
      return null;
    }
  }

  return null;
}
