import type { AvatarConfig } from "@/components/Avatar";

export interface StoredProfile {
  display_name: string;
  email: string;
  avatar: AvatarConfig;
  pet: string | null;
  bubble: string | null;
  xp: number;
  coins: number;
  streak: number;
  sound_on: boolean;
  onboarded: boolean;
  isCreator: boolean;
  updated_at?: string;
}

export interface StoredAccount {
  id: string;
  email: string;
  password?: string;
  display_name: string;
  isCreator: boolean;
  created_at: string;
}

const KEY_USER = "doctorz_user";
const KEY_ACTIVE_PROFILE = "doctorz_profile";
const KEY_PROFILES_BY_EMAIL = "doctorz_profiles_by_email";
const KEY_ACCOUNTS_BY_EMAIL = "doctorz_accounts_by_email";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function getAccountsMap(): Record<string, StoredAccount> {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(KEY_ACCOUNTS_BY_EMAIL);
    return raw ? (JSON.parse(raw) as Record<string, StoredAccount>) : {};
  } catch {
    return {};
  }
}

export function saveAccount(account: StoredAccount): void {
  if (!isBrowser()) return;
  const key = normalizeEmail(account.email);
  if (!key) return;
  const map = getAccountsMap();
  map[key] = { ...account, email: key };
  localStorage.setItem(KEY_ACCOUNTS_BY_EMAIL, JSON.stringify(map));
}

export function getAccountByEmail(email: string | null | undefined): StoredAccount | null {
  const key = normalizeEmail(email);
  if (!key) return null;
  const map = getAccountsMap();
  return map[key] ?? null;
}

export function getProfilesMap(): Record<string, StoredProfile> {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(KEY_PROFILES_BY_EMAIL);
    return raw ? (JSON.parse(raw) as Record<string, StoredProfile>) : {};
  } catch {
    return {};
  }
}

export function buildDefaultProfile(email: string, displayName?: string, isCreator = false): StoredProfile {
  const normalized = normalizeEmail(email);
  const creator = isCreator || normalized === "doctorzmit@gmail.com";
  const fallbackName = displayName?.trim() || (creator ? "Doctor Z" : normalized.split("@")[0] || "Étudiant Dr. Z");
  return {
    display_name: fallbackName,
    email: normalized,
    avatar: {
      gender: "m",
      skin: 1,
      eyes: 0,
      hair: 0,
      hairColor: 0,
      hijab: 0,
      outfit: 0,
      accessory: 1,
    },
    pet: "cat",
    bubble: creator ? "Doctor Z ici! 🩺" : "Yallah! 💪",
    xp: creator ? 999999 : 150,
    coins: creator ? 999999 : 60,
    streak: 3,
    sound_on: true,
    onboarded: true,
    isCreator: creator,
    updated_at: new Date().toISOString(),
  };
}

export function getSavedProfileByEmail(email: string | null | undefined): StoredProfile | null {
  if (!isBrowser()) return null;
  const key = normalizeEmail(email);
  if (!key) return null;

  const map = getProfilesMap();
  if (map[key]) return map[key];

  // Legacy single-profile recovery if email matches
  try {
    const activeRaw = localStorage.getItem(KEY_ACTIVE_PROFILE);
    if (activeRaw) {
      const parsed = JSON.parse(activeRaw) as Partial<StoredProfile>;
      if (normalizeEmail(parsed.email) === key) {
        const merged = { ...buildDefaultProfile(key, parsed.display_name, parsed.isCreator), ...parsed, email: key };
        map[key] = merged;
        localStorage.setItem(KEY_PROFILES_BY_EMAIL, JSON.stringify(map));
        return merged;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export function saveProfileDurable(
  email: string | null | undefined,
  patch: Partial<StoredProfile>,
  fallbackDisplayName?: string,
): StoredProfile | null {
  if (!isBrowser()) return null;
  const key = normalizeEmail(email);
  const activeRaw = localStorage.getItem(KEY_ACTIVE_PROFILE);
  let activeParsed: Partial<StoredProfile> = {};
  try {
    if (activeRaw) activeParsed = JSON.parse(activeRaw) as Partial<StoredProfile>;
  } catch {
    // ignore
  }

  const resolvedEmail = key || normalizeEmail(activeParsed.email);
  if (!resolvedEmail) {
    const updated = { ...activeParsed, ...patch, updated_at: new Date().toISOString() } as StoredProfile;
    localStorage.setItem(KEY_ACTIVE_PROFILE, JSON.stringify(updated));
    return updated;
  }

  const map = getProfilesMap();
  const base =
    map[resolvedEmail] ??
    (normalizeEmail(activeParsed.email) === resolvedEmail
      ? { ...buildDefaultProfile(resolvedEmail, fallbackDisplayName, activeParsed.isCreator), ...activeParsed }
      : buildDefaultProfile(resolvedEmail, fallbackDisplayName));

  const updated: StoredProfile = {
    ...base,
    ...patch,
    email: resolvedEmail,
    updated_at: new Date().toISOString(),
  };

  map[resolvedEmail] = updated;
  localStorage.setItem(KEY_PROFILES_BY_EMAIL, JSON.stringify(map));
  localStorage.setItem(KEY_ACTIVE_PROFILE, JSON.stringify(updated));

  // Keep current user metadata in sync too
  try {
    const userRaw = localStorage.getItem(KEY_USER);
    if (userRaw) {
      const u = JSON.parse(userRaw);
      if (normalizeEmail(u.email) === resolvedEmail) {
        u.user_metadata = { ...(u.user_metadata || {}), full_name: updated.display_name };
        localStorage.setItem(KEY_USER, JSON.stringify(u));
      }
    }
  } catch {
    // ignore
  }

  return updated;
}

export function setActiveSessionUser(userObj: { id: string; email: string; user_metadata?: { full_name?: string } }) {
  if (!isBrowser()) return;
  localStorage.setItem(KEY_USER, JSON.stringify(userObj));
  const existing = getSavedProfileByEmail(userObj.email);
  const profile =
    existing ??
    buildDefaultProfile(
      userObj.email,
      userObj.user_metadata?.full_name,
      normalizeEmail(userObj.email) === "doctorzmit@gmail.com",
    );
  saveProfileDurable(userObj.email, profile, userObj.user_metadata?.full_name);
}

export function clearCurrentSession() {
  if (!isBrowser()) return;
  localStorage.removeItem(KEY_USER);
  // Remove active session pointer only; keep doctorz_profiles_by_email & doctorz_accounts_by_email intact!
  localStorage.removeItem(KEY_ACTIVE_PROFILE);
}
