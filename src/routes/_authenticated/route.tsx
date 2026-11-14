import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { auth } from "@/lib/firebase";

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
    return { user: currentUser };
  },
  component: () => <Outlet />,
});
