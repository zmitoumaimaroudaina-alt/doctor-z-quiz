import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import { auth, db, logFirestoreError, OperationType } from "@/lib/firebase";
import type { AvatarConfig } from "@/components/Avatar";
import {
  INITIAL_HEARTS,
  isGoogleAuthUser,
  isLegacyPasswordOnlyUser,
  LEGACY_MIGRATION_MESSAGE,
  type DhikrCountsMap,
} from "@/lib/studentService";

export type Me = {
  id: string;
  email: string | null;
  display_name: string | null;
  photoURL: string | null;
  avatar: AvatarConfig | null;
  pet: string | null;
  bubble: string | null;
  xp: number;
  score: number;
  coins: number;
  streak: number;
  hearts: number;
  dhikrCounts: DhikrCountsMap;
  lastDhikrAtMs: number | null;
  sound_on: boolean;
  onboarded: boolean;
  isCreator: boolean;
};

type StudentRawDoc = {
  name?: unknown;
  photoURL?: unknown;
  avatar?: unknown;
  pet?: unknown;
  bubble?: unknown;
  xp?: unknown;
  score?: unknown;
  hearts?: unknown;
  dhikrCounts?: unknown;
  lastDhikrAt?: { toMillis?: () => number } | null;
};

function mapUserAndDoc(currentUser: User, data?: StudentRawDoc): Me {
  const uid = currentUser.uid;
  const email = (currentUser.email || "").toLowerCase();
  const isDoctorZ = email === "doctorzmit@gmail.com";
  const xp = Number(data?.xp ?? 0);
  const score = Number(data?.score ?? 0);
  const heartsRaw = data?.hearts;
  const hearts =
    typeof heartsRaw === "number" && Number.isFinite(heartsRaw)
      ? Math.max(0, Math.floor(heartsRaw))
      : INITIAL_HEARTS;

  const lastDhikrObj = data?.lastDhikrAt;
  const lastDhikrAtMs =
    lastDhikrObj && typeof lastDhikrObj.toMillis === "function" ? lastDhikrObj.toMillis() : null;

  return {
    id: uid,
    email: currentUser.email || null,
    display_name:
      (typeof data?.name === "string" && data.name) ||
      currentUser.displayName ||
      email.split("@")[0] ||
      "طالب طب",
    photoURL: (typeof data?.photoURL === "string" && data.photoURL) || currentUser.photoURL || null,
    avatar: (data?.avatar as AvatarConfig | null | undefined) ?? null,
    pet: (typeof data?.pet === "string" && data.pet) || null,
    bubble: (typeof data?.bubble === "string" && data.bubble) || null,
    xp,
    score,
    coins: Math.floor(xp / 10),
    streak: 1,
    hearts: isDoctorZ ? 999 : hearts,
    dhikrCounts: (data?.dhikrCounts as DhikrCountsMap | undefined) || {},
    lastDhikrAtMs,
    sound_on: true,
    onboarded: data?.avatar != null && typeof data.avatar === "object",
    isCreator: isDoctorZ,
  };
}

export function useMe() {
  const qc = useQueryClient();
  const [authUser, setAuthUser] = useState<User | null>(() => auth.currentUser);
  const [authReady, setAuthReady] = useState<boolean>(() => auth.currentUser !== null);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (u && isLegacyPasswordOnlyUser(u)) {
        try {
          await signOut(auth);
        } catch {
          // ignore
        }
        toast.error(LEGACY_MIGRATION_MESSAGE);
        setAuthUser(null);
        setAuthReady(true);
        qc.setQueryData(["me"], null);
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
          window.location.href = "/auth?reason=legacy_migrated";
        }
        return;
      }

      if (u && !isGoogleAuthUser(u)) {
        setAuthUser(null);
        setAuthReady(true);
        qc.setQueryData(["me"], null);
        return;
      }

      setAuthUser(u);
      setAuthReady(true);
      if (!u) {
        qc.setQueryData(["me"], null);
      }
    });
    return () => unsubAuth();
  }, [qc]);

  useEffect(() => {
    if (!authUser || !isGoogleAuthUser(authUser)) return;
    const docRef = doc(db, "students", authUser.uid);
    const unsubDoc = onSnapshot(
      docRef,
      (snap) => {
        const mapped = mapUserAndDoc(authUser, snap.exists() ? snap.data() : undefined);
        qc.setQueryData(["me"], mapped);
      },
      (error) => {
        logFirestoreError(error, OperationType.GET, `students/${authUser.uid}`);
      },
    );
    return () => unsubDoc();
  }, [authUser, qc]);

  const queryRes = useQuery<Me | null>({
    queryKey: ["me"],
    enabled: authReady,
    queryFn: async () => {
      const currentUser = auth.currentUser;
      if (!currentUser || !isGoogleAuthUser(currentUser)) return null;
      const existing = qc.getQueryData<Me | null>(["me"]);
      if (existing && existing.id === currentUser.uid) return existing;
      return mapUserAndDoc(currentUser);
    },
    staleTime: Infinity,
  });

  return {
    ...queryRes,
    isLoading: !authReady || queryRes.isLoading,
  };
}

export function useRefreshMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["me"] });
}
