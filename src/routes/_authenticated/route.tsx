import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { signOut } from "firebase/auth";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import {
  isGoogleAuthUser,
  isLegacyPasswordOnlyUser,
  LEGACY_MIGRATION_MESSAGE,
} from "@/lib/studentService";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
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
    if (!currentUser) {
      throw redirect({ to: "/auth" });
    }
    if (isLegacyPasswordOnlyUser(currentUser) || !isGoogleAuthUser(currentUser)) {
      try {
        await signOut(auth);
      } catch {
        // ignore
      }
      toast.error(LEGACY_MIGRATION_MESSAGE);
      throw redirect({ to: "/auth", search: { reason: "legacy_migrated" } as never });
    }
    return { user: currentUser };
  },
  component: () => <Outlet />,
});
