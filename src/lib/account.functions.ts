import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CREATOR = "doctorzmit@gmail.com";

/** Permanently deletes the caller's account; cascades remove all their game data. */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isCreator } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (isCreator) throw new Error("Le compte Creator ne peut pas être supprimé.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (u.user?.email?.toLowerCase() === CREATOR) throw new Error("Le compte Creator ne peut pas être supprimé.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Creator-only: delete a student account. */
export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: isCreator } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isCreator) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId);
    if (target?.some((r) => r.role === "admin")) throw new Error("Impossible de supprimer le Creator.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
