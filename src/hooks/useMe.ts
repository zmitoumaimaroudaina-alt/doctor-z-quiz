import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AvatarConfig } from "@/components/Avatar";

export type Me = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar: AvatarConfig;
  pet: string | null;
  bubble: string | null;
  xp: number;
  coins: number;
  streak: number;
  sound_on: boolean;
  onboarded: boolean;
  isCreator: boolean;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      let userObj: { id: string; email?: string | null } | null = null;
      try {
        const { data: u } = await supabase.auth.getUser();
        if (u?.user) userObj = u.user;
      } catch {
        // ignore
      }

      if (!userObj && typeof window !== "undefined") {
        const local = localStorage.getItem("doctorz_user");
        if (local) {
          try { userObj = JSON.parse(local); } catch { /* ignore */ }
        }
      }

      if (!userObj) return null;

      try {
        const [{ data: p }, { data: creator }] = await Promise.all([
          supabase.from("profiles").select("id, display_name, avatar, pet, bubble, xp, coins, streak, sound_on, onboarded").eq("id", userObj.id).maybeSingle(),
          supabase.rpc("is_creator"),
        ]);
        if (p) {
          return {
            ...(p as unknown as Omit<Me, "email" | "isCreator">),
            email: userObj.email ?? null,
            isCreator: creator === true || userObj.email === "doctorzmit@gmail.com",
          };
        }
      } catch {
        // ignore
      }

      // Local profile fallback
      const localProfileStr = typeof window !== "undefined" ? localStorage.getItem("doctorz_profile") : null;
      const localP = localProfileStr ? JSON.parse(localProfileStr) : null;

      const isDoctorZ = userObj.email === "doctorzmit@gmail.com";
      return {
        id: userObj.id,
        email: userObj.email ?? "etudiant@univ-blida.dz",
        display_name: localP?.display_name ?? (isDoctorZ ? "Doctor Z" : "Étudiant Dr. Z"),
        avatar: localP?.avatar ?? { gender: isDoctorZ ? "m" : "m", skin: 1, eyes: 0, hair: 0, hairColor: 0, hijab: 0, outfit: 0, accessory: 1 },
        pet: localP?.pet ?? "cat",
        bubble: localP?.bubble ?? (isDoctorZ ? "Doctor Z ici! 🩺" : "Yallah! 💪"),
        xp: localP?.xp ?? (isDoctorZ ? 999999 : 120),
        coins: localP?.coins ?? (isDoctorZ ? 999999 : 50),
        streak: localP?.streak ?? 3,
        sound_on: localP?.sound_on ?? true,
        onboarded: true,
        isCreator: isDoctorZ,
      };
    },
    staleTime: 10_000,
  });
}

export function useRefreshMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["me"] });
}
