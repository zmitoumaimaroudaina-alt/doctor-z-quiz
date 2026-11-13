import { useEffect, useState } from "react";
import { normalizeEmail } from "./profileStore";

export const MAX_BASE_HEARTS = 2;
export const HEART_REGEN_SECONDS = 2 * 60 * 60; // 2 hours = 7200s
export const HEART_REGEN_MS = HEART_REGEN_SECONDS * 1000;

const KEY_HEARTS_BY_USER = "doctorz_hearts_by_user";

export type UserHeartRecord = {
  hearts: number;
  regenStartAt: number | null;
  updatedAt: number;
};

export type HeartStatus = {
  hearts: number;
  maxBase: number;
  unlimited: boolean;
  secondsToNext: number;
  canPlay: boolean;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function resolveHeartKey(email?: string | null, userId?: string | null): string {
  const cleanEmail = normalizeEmail(email);
  if (cleanEmail) return cleanEmail;
  if (userId) return userId;
  return "default-student";
}

function readAllHearts(): Record<string, UserHeartRecord> {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(KEY_HEARTS_BY_USER);
    return raw ? (JSON.parse(raw) as Record<string, UserHeartRecord>) : {};
  } catch {
    return {};
  }
}

function writeAllHearts(map: Record<string, UserHeartRecord>) {
  if (!isBrowser()) return;
  localStorage.setItem(KEY_HEARTS_BY_USER, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent("doctorz-hearts-updated"));
}

function computeNormalizedRecord(rec: UserHeartRecord | undefined, now = Date.now()): {
  record: UserHeartRecord;
  changed: boolean;
} {
  if (!rec) {
    return {
      record: { hearts: MAX_BASE_HEARTS, regenStartAt: null, updatedAt: now },
      changed: true,
    };
  }

  let hearts = Number.isFinite(rec.hearts) ? Math.max(0, Math.floor(rec.hearts)) : MAX_BASE_HEARTS;
  let regenStartAt = rec.regenStartAt;
  let changed = false;

  if (hearts < MAX_BASE_HEARTS) {
    if (!regenStartAt) {
      regenStartAt = now;
      changed = true;
    } else {
      const elapsed = now - regenStartAt;
      if (elapsed >= HEART_REGEN_MS) {
        const recovered = Math.floor(elapsed / HEART_REGEN_MS);
        hearts = Math.min(MAX_BASE_HEARTS, hearts + recovered);
        if (hearts >= MAX_BASE_HEARTS) {
          regenStartAt = null;
        } else {
          regenStartAt = regenStartAt + recovered * HEART_REGEN_MS;
        }
        changed = true;
      }
    }
  } else if (regenStartAt !== null) {
    regenStartAt = null;
    changed = true;
  }

  return {
    record: { hearts, regenStartAt, updatedAt: changed ? now : rec.updatedAt },
    changed,
  };
}

export function getHeartStatus(userKey: string, isCreator = false, now = Date.now()): HeartStatus {
  if (isCreator) {
    return {
      hearts: 999,
      maxBase: MAX_BASE_HEARTS,
      unlimited: true,
      secondsToNext: 0,
      canPlay: true,
    };
  }

  const map = readAllHearts();
  const { record, changed } = computeNormalizedRecord(map[userKey], now);
  if (changed && isBrowser()) {
    map[userKey] = record;
    writeAllHearts(map);
  }

  const secondsToNext =
    record.hearts < MAX_BASE_HEARTS && record.regenStartAt
      ? Math.max(1, Math.ceil((record.regenStartAt + HEART_REGEN_MS - now) / 1000))
      : 0;

  return {
    hearts: record.hearts,
    maxBase: MAX_BASE_HEARTS,
    unlimited: false,
    secondsToNext,
    canPlay: record.hearts > 0,
  };
}

export function consumeHeart(userKey: string, isCreator = false): { ok: boolean; status: HeartStatus } {
  if (isCreator) {
    return { ok: true, status: getHeartStatus(userKey, true) };
  }

  const now = Date.now();
  const map = readAllHearts();
  const { record } = computeNormalizedRecord(map[userKey], now);

  if (record.hearts <= 0) {
    return { ok: false, status: getHeartStatus(userKey, false, now) };
  }

  const nextHearts = record.hearts - 1;
  const nextRegenStart = nextHearts < MAX_BASE_HEARTS ? record.regenStartAt ?? now : null;

  map[userKey] = {
    hearts: nextHearts,
    regenStartAt: nextRegenStart,
    updatedAt: now,
  };
  writeAllHearts(map);

  return { ok: true, status: getHeartStatus(userKey, false, now) };
}

export function addHeartsToUser(userKey: string, amount: number): HeartStatus {
  const now = Date.now();
  const map = readAllHearts();
  const { record } = computeNormalizedRecord(map[userKey], now);
  const nextHearts = Math.max(0, record.hearts + amount);
  const nextRegenStart = nextHearts < MAX_BASE_HEARTS ? record.regenStartAt ?? now : null;

  map[userKey] = {
    hearts: nextHearts,
    regenStartAt: nextRegenStart,
    updatedAt: now,
  };
  writeAllHearts(map);
  return getHeartStatus(userKey, false, now);
}

export function restoreHeartsForUser(userKey: string): HeartStatus {
  const now = Date.now();
  const map = readAllHearts();
  const { record } = computeNormalizedRecord(map[userKey], now);
  map[userKey] = {
    hearts: Math.max(MAX_BASE_HEARTS, record.hearts),
    regenStartAt: null,
    updatedAt: now,
  };
  writeAllHearts(map);
  return getHeartStatus(userKey, false, now);
}

export function formatHeartCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

export function renderHeartsVisual(hearts: number, unlimited = false): string {
  if (unlimited) return "∞ ❤️";
  if (hearts <= 0) return "🤍🤍";
  if (hearts <= MAX_BASE_HEARTS) {
    return "❤️".repeat(hearts) + "🤍".repeat(MAX_BASE_HEARTS - hearts);
  }
  return `${"❤️".repeat(Math.min(hearts, 5))}${hearts > 5 ? ` +${hearts - 5}` : ""}`;
}

export function useHearts(email?: string | null, userId?: string | null, isCreator = false): HeartStatus {
  const userKey = resolveHeartKey(email, userId);
  const [status, setStatus] = useState<HeartStatus>(() => getHeartStatus(userKey, isCreator));

  useEffect(() => {
    const refresh = () => setStatus(getHeartStatus(userKey, isCreator));
    refresh();

    const onUpdate = () => refresh();
    window.addEventListener("doctorz-hearts-updated", onUpdate);
    window.addEventListener("storage", onUpdate);

    const timer = setInterval(refresh, 1000);
    return () => {
      window.removeEventListener("doctorz-hearts-updated", onUpdate);
      window.removeEventListener("storage", onUpdate);
      clearInterval(timer);
    };
  }, [userKey, isCreator]);

  return status;
}
