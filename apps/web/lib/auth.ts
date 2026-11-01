import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Admin = { id: string; email: string };

/** Verifies the session and admin flag. Call from every admin page and Server Action. */
export const requireAdmin = cache(async (): Promise<Admin> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", claims.sub)
    .maybeSingle();

  if (!profile?.is_admin) redirect("/login?error=not-admin");

  return { id: claims.sub, email: String(claims.email ?? "") };
});
