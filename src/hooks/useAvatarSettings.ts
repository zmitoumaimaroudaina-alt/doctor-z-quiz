import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AvatarDisabled = Partial<Record<"hair" | "hijabStyle" | "outfit" | "beard" | "moustache" | "glasses" | "accessory", number[]>>;

/** Creator-controlled list of avatar items hidden from students. */
export function useAvatarSettings() {
  return useQuery({
    queryKey: ["avatar-settings"],
    queryFn: async () => ((await supabase.from("avatar_settings").select("disabled").eq("id", 1).maybeSingle()).data?.disabled ?? {}) as AvatarDisabled,
  });
}
