import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

async function waitForCurrentUser(timeoutMs = 2500): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  if (typeof window === "undefined") return null;

  return new Promise<User | null>((resolve) => {
    let settled = false;
    let unsub: (() => void) | null = null;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        unsub?.();
        resolve(auth.currentUser);
      }
    }, timeoutMs);

    unsub = onAuthStateChanged(auth, (u) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        unsub?.();
        resolve(u);
      }
    });
  });
}

export async function getClientAuthToken(): Promise<string> {
  try {
    const user = auth.currentUser ?? (await waitForCurrentUser());
    if (user) {
      const idToken = await user.getIdToken();
      if (idToken) return idToken;
    }
  } catch (err) {
    console.error("Failed to retrieve Firebase auth token:", err);
  }

  return "";
}
