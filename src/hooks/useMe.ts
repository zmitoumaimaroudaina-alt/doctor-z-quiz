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
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [{ data: p }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar, pet, bubble, xp, coins, streak, sound_on, onboarded").eq("id", u.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      ]);
      if (!p) return null;
      return {
        ...(p as unknown as Omit<Me, "email" | "isCreator">),
        email: u.user.email ?? null,
        isCreator: !!roles?.some((r) => r.role === "admin"),
      };
    },
    staleTime: 30_000,
  });
}

export function useRefreshMe() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["me"] });
}
