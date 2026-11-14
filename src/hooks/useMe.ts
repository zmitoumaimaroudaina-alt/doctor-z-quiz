import { useQuery, useQueryClient } from "@tanstack/react-query";
import { auth, db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { AvatarConfig } from "@/components/Avatar";

export type Me = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar: AvatarConfig | null;
  pet: string | null;
  bubble: string | null;
  xp: number;
  score: number;
  sound_on: boolean;
  onboarded: boolean;
  isCreator: boolean;
};

export function useMe() {
  return useQuery({
    queryKey: ["me", auth.currentUser?.uid],
    queryFn: async (): Promise<Me | null> => {
      let currentUser = auth.currentUser;
      if (!currentUser) {
        await new Promise((resolve) => {
          const unsub = auth.onAuthStateChanged((u) => {
            unsub();
            resolve(u);
          });
        });
        currentUser = auth.currentUser;
      }

      if (!currentUser) return null;

      const uid = currentUser.uid;
      const email = currentUser.email || "";
      const isDoctorZ = email === "doctorzmit@gmail.com";

      try {
        const docRef = doc(db, "students", uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          return {
            id: uid,
            email,
            display_name: data.name || currentUser.displayName || email.split("@")[0] || "Étudiant",
            avatar: data.avatar ?? null,
            pet: data.pet ?? null,
            bubble: data.bubble ?? null,
            xp: Number(data.xp ?? 0),
            score: Number(data.score ?? 0),
            sound_on: true,
            onboarded: data.avatar != null,
            isCreator: isDoctorZ,
          };
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `students/${uid}`);
      }

      return {
        id: uid,
        email,
        display_name: currentUser.displayName || email.split("@")[0] || "Étudiant",
        avatar: null,
        pet: null,
        bubble: null,
        xp: 0,
        score: 0,
        sound_on: true,
        onboarded: false,
        isCreator: isDoctorZ,
      };
    },
    staleTime: 5000,
  });
}

export function useRefreshMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["me"] });
}
