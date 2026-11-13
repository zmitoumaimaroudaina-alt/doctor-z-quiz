import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AvatarConfig } from "@/components/Avatar";
import {
  buildDefaultProfile,
  getSavedProfileByEmail,
  normalizeEmail,
  saveProfileDurable,
} from "@/lib/profileStore";

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
      let userObj: { id: string; email?: string | null; user_metadata?: { full_name?: string } } | null = null;
      try {
        const { data: u } = await supabase.auth.getUser();
        if (u?.user) userObj = u.user;
      } catch {
        // ignore
      }

      if (!userObj && typeof window !== "undefined") {
        const local = localStorage.getItem("doctorz_user");
        if (local) {
          try {
            userObj = JSON.parse(local);
          } catch {
            /* ignore */
          }
        }
      }

      if (!userObj) return null;

      const email = normalizeEmail(userObj.email) || "etudiant@univ-blida.dz";
      const isDoctorZ = email === "doctorzmit@gmail.com";
      const savedLocal = getSavedProfileByEmail(email);

      try {
        const [{ data: p }, { data: creator }] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, display_name, avatar, pet, bubble, xp, coins, streak, sound_on, onboarded")
            .eq("id", userObj.id)
            .maybeSingle(),
          supabase.rpc("is_creator"),
        ]);
        if (p) {
          const merged: Me = {
            ...(p as unknown as Omit<Me, "email" | "isCreator">),
            // Prefer savedLocal avatar/pet/display_name if local profile has edits for this email
            display_name: savedLocal?.display_name ?? (p as { display_name?: string | null }).display_name ?? null,
            avatar: savedLocal?.avatar ?? (p as { avatar: AvatarConfig }).avatar,
            pet: savedLocal?.pet ?? (p as { pet?: string | null }).pet ?? null,
            bubble: savedLocal?.bubble ?? (p as { bubble?: string | null }).bubble ?? null,
            xp: Math.max(Number((p as { xp?: number }).xp ?? 0), Number(savedLocal?.xp ?? 0)),
            coins: Math.max(Number((p as { coins?: number }).coins ?? 0), Number(savedLocal?.coins ?? 0)),
            email,
            isCreator: creator === true || isDoctorZ,
          };
          saveProfileDurable(email, merged);
          return merged;
        }
      } catch {
        // ignore
      }

      const fallback =
        savedLocal ??
        saveProfileDurable(
          email,
          buildDefaultProfile(email, userObj.user_metadata?.full_name, isDoctorZ),
          userObj.user_metadata?.full_name,
        )!;

      return {
        id: userObj.id,
        email,
        display_name: fallback.display_name,
        avatar: fallback.avatar,
        pet: fallback.pet,
        bubble: fallback.bubble,
        xp: fallback.xp,
        coins: fallback.coins,
        streak: fallback.streak,
        sound_on: fallback.sound_on,
        onboarded: fallback.onboarded,
        isCreator: isDoctorZ || fallback.isCreator,
      };
    },
    staleTime: 10_000,
  });
}

export function useRefreshMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["me"] });
}
