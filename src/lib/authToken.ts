import { supabase } from "@/integrations/supabase/client";

function encodeBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function getClientAuthToken(): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) {
      return data.session.access_token;
    }
  } catch {
    // ignore and try local fallback
  }

  if (typeof window !== "undefined" && !import.meta.env["VITE_SUPABASE_URL"]) {
    try {
      const raw = localStorage.getItem("doctorz_user");
      if (raw) {
        const user = JSON.parse(raw) as { id?: string; email?: string };
        if (user.id || user.email) {
          const payload = {
            sub: user.id || `local-${user.email}`,
            email: user.email || "etudiant@univ-blida.dz",
          };
          return `mock-jwt.${encodeBase64Utf8(JSON.stringify(payload))}.sig`;
        }
      }
    } catch {
      // ignore
    }
  }

  return "";
}
