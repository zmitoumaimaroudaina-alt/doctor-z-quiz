import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user) return { user: data.user };
    } catch {
      // ignore
    }
    const local = typeof window !== "undefined" ? localStorage.getItem("doctorz_user") : null;
    if (local) {
      try {
        const u = JSON.parse(local);
        return { user: u };
      } catch {
        // ignore
      }
    }
    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});

