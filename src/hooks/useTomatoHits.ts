import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { toast } from "sonner";
import { auth, db, logFirestoreError, OperationType } from "@/lib/firebase";
import { getRemainingHoursFromTimestamp, TOMATO_DURATION_MS } from "@/lib/game";
import { isGoogleAuthUser } from "@/lib/studentService";
import { play } from "@/lib/sound";

export type StudentTomatoState = {
  count: number;
  isHit: boolean;
  hoursLeft: number;
  expiresAtMs: number;
  latestThrowerName?: string;
};

export type TomatoHitDoc = {
  id: string;
  fromUid: string;
  fromName: string;
  toUid: string;
  toName: string;
  createdAtMs: number;
  expiresAtMs: number;
};

export function useTomatoHits(myUid?: string | null) {
  const [hits, setHits] = useState<TomatoHitDoc[]>([]);
  const [flyingTargetUid, setFlyingTargetUid] = useState<string | null>(null);
  const initialLoadDone = useRef(false);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !isGoogleAuthUser(user)) return;

    const q = query(collection(db, "tomato_hits"), orderBy("createdAt", "desc"), limit(300));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: TomatoHitDoc[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as {
            createdAt?: { toMillis?: () => number };
            expiresAt?: { toMillis?: () => number };
            fromUid?: unknown;
            fromName?: unknown;
            toUid?: unknown;
            toName?: unknown;
          };
          const createdAtMs =
            typeof data.createdAt?.toMillis === "function" ? data.createdAt.toMillis() : Date.now();
          const expiresAtMs =
            typeof data.expiresAt?.toMillis === "function"
              ? data.expiresAt.toMillis()
              : createdAtMs + TOMATO_DURATION_MS;

          list.push({
            id: docSnap.id,
            fromUid: String(data.fromUid || ""),
            fromName: String(data.fromName || "طالب"),
            toUid: String(data.toUid || ""),
            toName: String(data.toName || "طالب"),
            createdAtMs,
            expiresAtMs,
          });
        });

        if (initialLoadDone.current) {
          for (const change of snapshot.docChanges()) {
            if (change.type === "added" && !seenIds.current.has(change.doc.id)) {
              const d = change.doc.data() as {
                toUid?: unknown;
                fromName?: unknown;
                createdAt?: { toMillis?: () => number };
              };
              const toUid = String(d.toUid || "");
              const fromName = String(d.fromName || "أحد زملائك");
              const createdAtMs =
                typeof d.createdAt?.toMillis === "function" ? d.createdAt.toMillis() : Date.now();
              const isFresh = Date.now() - createdAtMs < 15000;

              if (toUid && isFresh) {
                setFlyingTargetUid(toUid);
                play("hit");
                setTimeout(() => {
                  setFlyingTargetUid((curr) => (curr === toUid ? null : curr));
                }, 1200);

                if (myUid && toUid === myUid) {
                  toast.warning(`🍅 ألقى ${fromName} طماطم عليك الآن!`);
                }
              }
            }
          }
        }

        snapshot.forEach((docSnap) => seenIds.current.add(docSnap.id));
        initialLoadDone.current = true;
        setHits(list);
      },
      (error) => {
        logFirestoreError(error, OperationType.LIST, "tomato_hits");
      },
    );

    return () => unsubscribe();
  }, [myUid]);

  const now = Date.now();
  const statsByUid: Record<string, StudentTomatoState> = {};

  for (const h of hits) {
    if (!h.toUid) continue;
    const prev = statsByUid[h.toUid] || {
      count: 0,
      isHit: false,
      hoursLeft: 0,
      expiresAtMs: 0,
    };
    const nextCount = prev.count + 1;
    const maxExpires = Math.max(prev.expiresAtMs, h.expiresAtMs);
    const active = maxExpires > now;
    const hoursLeft = active ? getRemainingHoursFromTimestamp(maxExpires) : 0;

    statsByUid[h.toUid] = {
      count: nextCount,
      isHit: active,
      hoursLeft,
      expiresAtMs: maxExpires,
      latestThrowerName: prev.latestThrowerName || h.fromName,
    };
  }

  return {
    hits,
    statsByUid,
    flyingTargetUid,
  };
}
