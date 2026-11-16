import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db, handleFirestoreError, logFirestoreError, OperationType } from "./firebase";
import type { AvatarConfig } from "@/components/Avatar";

export const LEGACY_MIGRATION_MESSAGE =
  "تم تحديث نظام الدخول، يرجى إعادة التسجيل بحساب Google للمتابعة";

export const INITIAL_HEARTS = 2;
export const MAX_HEARTS_CAP = 5;
export const DHIKR_TARGET = 10;
export const DHIKR_COOLDOWN_MS = 100;

export const ADHKAR_LIST = [
  { key: "d0", text: "سبحان الله", sub: "التسبيح" },
  { key: "d1", text: "الحمد لله", sub: "التحميد" },
  { key: "d2", text: "الله أكبر", sub: "التكبير" },
  { key: "d3", text: "لا إله إلا الله", sub: "التهليل" },
  { key: "d4", text: "أستغفر الله", sub: "الاستغفار" },
  { key: "d5", text: "لا حول ولا قوة إلا بالله", sub: "الحوقلة" },
  { key: "d6", text: "سبحان الله وبحمده", sub: "سبحان الله وبحمده" },
  { key: "d7", text: "اللهم صلِّ على محمد", sub: "الصلاة على النبي ﷺ" },
] as const;

export type DhikrKey = (typeof ADHKAR_LIST)[number]["key"];
export type DhikrCountsMap = Partial<Record<DhikrKey, number>>;

export type StudentProfile = {
  uid: string;
  name: string;
  email: string;
  photoURL?: string | null;
  avatar: AvatarConfig | null;
  pet?: string | null;
  bubble?: string | null;
  score: number;
  xp: number;
  hearts: number;
  dhikrCounts?: DhikrCountsMap;
  lastDhikrAt?: Timestamp | null;
  migrated?: boolean;
  migratedToUid?: string | null;
  migratedFromUid?: string | null;
  createdAt?: unknown;
  lastLogin?: unknown;
};

export function isGoogleAuthUser(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.providerData.some((p) => p.providerId === "google.com");
}

export function isLegacyPasswordOnlyUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const hasPassword = user.providerData.some((p) => p.providerId === "password");
  return hasPassword && !isGoogleAuthUser(user);
}

export type LoginSyncResult = {
  ok: boolean;
  reason?: "legacy_password" | "not_google" | "error";
  hasAvatar: boolean;
  migratedFromLegacy?: boolean;
};

export async function ensureStudentOnLogin(user: User): Promise<LoginSyncResult> {
  if (isLegacyPasswordOnlyUser(user)) {
    return { ok: false, reason: "legacy_password", hasAvatar: false };
  }
  if (!isGoogleAuthUser(user)) {
    return { ok: false, reason: "not_google", hasAvatar: false };
  }

  const uid = user.uid;
  const cleanEmail = (user.email || "").trim().toLowerCase();
  const docRef = doc(db, "students", uid);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      // Search for any unmigrated legacy account with the same email
      let legacyDocId: string | null = null;
      let legacyData: Partial<StudentProfile> | null = null;

      if (cleanEmail) {
        try {
          const legacyQuery = query(collection(db, "students"), where("email", "==", cleanEmail));
          const legacySnap = await getDocs(legacyQuery);
          const candidates = legacySnap.docs
            .filter((d) => {
              const raw = d.data() as { migrated?: boolean };
              return d.id !== uid && raw.migrated !== true;
            })
            .sort((a, b) => {
              const bScore = Number((b.data() as { score?: unknown }).score ?? 0);
              const aScore = Number((a.data() as { score?: unknown }).score ?? 0);
              return bScore - aScore;
            });
          const bestLegacy = candidates[0];
          if (bestLegacy) {
            legacyDocId = bestLegacy.id;
            legacyData = bestLegacy.data() as Partial<StudentProfile>;
          }
        } catch (qErr) {
          logFirestoreError(qErr, OperationType.LIST, "students");
        }
      }

      const resolvedName =
        (typeof legacyData?.name === "string" && legacyData.name.trim()) ||
        user.displayName?.trim() ||
        cleanEmail.split("@")[0] ||
        "طالب طب";
      const resolvedAvatar =
        legacyData?.avatar && typeof legacyData.avatar === "object" ? legacyData.avatar : null;
      const resolvedHearts =
        typeof legacyData?.hearts === "number"
          ? Math.min(MAX_HEARTS_CAP, Math.max(0, Math.floor(legacyData.hearts)))
          : INITIAL_HEARTS;

      const newProfilePayload: Record<string, unknown> = {
        uid,
        name: resolvedName.slice(0, 120),
        email: cleanEmail,
        photoURL: user.photoURL || legacyData?.photoURL || null,
        avatar: resolvedAvatar,
        pet: legacyData?.pet ?? null,
        bubble: legacyData?.bubble ?? null,
        score: Math.max(0, Number(legacyData?.score ?? 0)),
        xp: Math.max(0, Number(legacyData?.xp ?? 0)),
        hearts: resolvedHearts,
        dhikrCounts: {},
        lastDhikrAt: null,
        migrated: false,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      };

      if (legacyDocId) {
        newProfilePayload["migratedFromUid"] = legacyDocId;
      }

      await setDoc(docRef, newProfilePayload);

      if (legacyDocId) {
        try {
          await updateDoc(doc(db, "students", legacyDocId), {
            migrated: true,
            migratedToUid: uid,
          });
        } catch (migErr) {
          logFirestoreError(migErr, OperationType.UPDATE, `students/${legacyDocId}`);
        }
      }

      return {
        ok: true,
        hasAvatar: resolvedAvatar != null,
        migratedFromLegacy: !!legacyDocId,
      };
    } else {
      const data = snap.data() as Partial<StudentProfile>;
      const patch: Record<string, unknown> = {
        lastLogin: serverTimestamp(),
        photoURL: user.photoURL || data.photoURL || null,
        migrated: false,
      };
      if (typeof data.hearts !== "number") {
        patch["hearts"] = INITIAL_HEARTS;
        patch["dhikrCounts"] = data.dhikrCounts || {};
      }
      await updateDoc(docRef, patch);

      const hasAvatar = data.avatar != null && typeof data.avatar === "object";
      return { ok: true, hasAvatar, migratedFromLegacy: false };
    }
  } catch (error) {
    logFirestoreError(error, OperationType.WRITE, `students/${uid}`);
    return { ok: false, reason: "error", hasAvatar: false };
  }
}

export async function saveStudentAvatar(
  uid: string,
  avatar: AvatarConfig,
  pet: string | null,
  name: string,
) {
  const docRef = doc(db, "students", uid);
  try {
    await setDoc(
      docRef,
      {
        avatar,
        pet: pet || null,
        name: name.trim().slice(0, 120) || "طالب طب",
      },
      { merge: true },
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `students/${uid}`);
  }
}

export async function addStudentScore(uid: string, addScore: number, addXp: number = 0) {
  const safeScore = Math.max(0, Math.min(200, Math.round(addScore)));
  const safeXp = Math.max(0, Math.round(addXp || safeScore * 10));
  if (safeScore === 0 && safeXp === 0) return;
  const docRef = doc(db, "students", uid);
  try {
    await updateDoc(docRef, {
      score: increment(safeScore),
      xp: increment(safeXp),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `students/${uid}`);
  }
}

export async function consumeStudentHeart(
  uid: string,
  isCreator = false,
): Promise<{ ok: boolean; hearts: number }> {
  if (isCreator) {
    return { ok: true, hearts: 999 };
  }
  const docRef = doc(db, "students", uid);
  try {
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists()) {
        return { ok: false, hearts: 0 };
      }
      const data = snap.data() as Partial<StudentProfile>;
      const current = typeof data.hearts === "number" ? data.hearts : INITIAL_HEARTS;
      if (current <= 0) {
        return { ok: false, hearts: 0 };
      }
      const next = current - 1;
      tx.update(docRef, { hearts: next });
      return { ok: true, hearts: next };
    });
    return result;
  } catch (error) {
    logFirestoreError(error, OperationType.UPDATE, `students/${uid}`);
    return { ok: false, hearts: 0 };
  }
}

export async function performDhikrStep(
  uid: string,
  dhikrKey: DhikrKey,
): Promise<{ newCount: number; newHearts: number; earnedHeart: boolean; completedTen: boolean }> {
  const docRef = doc(db, "students", uid);
  try {
    let snap;
    try {
      snap = await getDocFromServer(docRef);
    } catch {
      snap = await getDoc(docRef);
    }

    if (!snap.exists()) {
      throw new Error("STUDENT_NOT_FOUND");
    }

    const data = snap.data() as Partial<StudentProfile>;
    const currentHearts =
      typeof data.hearts === "number" && Number.isFinite(data.hearts)
        ? Math.max(0, Math.floor(data.hearts))
        : 0;
    if (currentHearts >= MAX_HEARTS_CAP) {
      throw new Error("MAX_HEARTS_REACHED");
    }

    // Check if existing dhikrCounts map already contains only valid d0..d7 keys
    const rawExisting = data.dhikrCounts;
    const isExistingValidMap =
      rawExisting != null &&
      typeof rawExisting === "object" &&
      !Array.isArray(rawExisting) &&
      Object.keys(rawExisting).every((k) => ADHKAR_LIST.some((item) => item.key === k));

    const prevRaw = isExistingValidMap
      ? (rawExisting as Record<string, unknown>)[dhikrKey]
      : undefined;
    const prevVal = Math.max(0, Math.min(9, Math.floor(Number(prevRaw ?? 0) || 0)));
    const completedTen = prevVal >= 9;
    const nextVal = completedTen ? 0 : prevVal + 1;
    const nextHearts = completedTen ? Math.min(MAX_HEARTS_CAP, currentHearts + 1) : currentHearts;

    if (isExistingValidMap) {
      await updateDoc(docRef, {
        [`dhikrCounts.${dhikrKey}`]: nextVal,
        hearts: nextHearts,
        lastDhikrAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        dhikrCounts: { [dhikrKey]: nextVal },
        hearts: nextHearts,
        lastDhikrAt: serverTimestamp(),
      });
    }

    return {
      newCount: nextVal,
      newHearts: nextHearts,
      earnedHeart: completedTen && nextHearts > currentHearts,
      completedTen,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "MAX_HEARTS_REACHED" || error.message === "STUDENT_NOT_FOUND")
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `students/${uid}`);
  }
}

export async function isEligibleTomatoThrower(uid: string, isCreator = false): Promise<boolean> {
  if (isCreator) return true;
  if (!uid) return false;
  try {
    const topQuery = query(collection(db, "students"), orderBy("score", "desc"), limit(25));
    const snap = await getDocs(topQuery);
    const activeTop5Uids: string[] = [];
    snap.forEach((docSnap) => {
      if (activeTop5Uids.length >= 5) return;
      const d = docSnap.data() as {
        migrated?: boolean;
        uid?: unknown;
        name?: unknown;
        avatar?: unknown;
        photoURL?: unknown;
      };
      if (d.migrated === true) return;
      const docUid = typeof d.uid === "string" ? d.uid.trim() : "";
      const name = typeof d.name === "string" ? d.name.trim() : "";
      const hasVisual =
        (d.avatar != null && typeof d.avatar === "object") ||
        (typeof d.photoURL === "string" && d.photoURL.trim().length > 0);
      if (!docUid || !name || !hasVisual) return;
      activeTop5Uids.push(docSnap.id);
    });
    return activeTop5Uids.includes(uid);
  } catch (error) {
    logFirestoreError(error, OperationType.LIST, "students");
    return false;
  }
}

export async function throwTomatoHit(
  fromUid: string,
  fromName: string,
  toUid: string,
  toName: string,
  isCreator = false,
): Promise<void> {
  if (!fromUid || !toUid || fromUid === toUid) {
    throw new Error("NO_SELF");
  }
  const allowed = await isEligibleTomatoThrower(fromUid, isCreator);
  if (!allowed) {
    throw new Error("NOT_TOP5_OR_CREATOR");
  }
  const hitId = `hit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const hitRef = doc(db, "tomato_hits", hitId);
  const expiresAt = Timestamp.fromMillis(Date.now() + 12 * 3600 * 1000);
  try {
    await setDoc(hitRef, {
      fromUid,
      fromName: (fromName || "طالب").slice(0, 120),
      toUid,
      toName: (toName || "طالب").slice(0, 120),
      createdAt: serverTimestamp(),
      expiresAt,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `tomato_hits/${hitId}`);
  }
}

export async function adminSetStudentHearts(targetUid: string, nextHearts: number): Promise<void> {
  const docRef = doc(db, "students", targetUid);
  try {
    await updateDoc(docRef, {
      hearts: Math.max(0, Math.min(999, Math.floor(nextHearts))),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `students/${targetUid}`);
  }
}
