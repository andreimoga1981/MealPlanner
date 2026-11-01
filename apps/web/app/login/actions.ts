"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/env";

export type LoginState = { error: string; email: string } | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };
  if (!SUPABASE_CONFIGURED) return { error: "Supabase is not connected yet. See the setup note above.", email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error?.code === "invalid_credentials") return { error: "Wrong email or password.", email };
  if (error?.code === "email_not_confirmed") return { error: "This email address hasn’t been confirmed yet.", email };
  if (error || !data.user) {
    // Anything else is a setup or connection problem (wrong Supabase URL or key, network), not a bad password.
    console.error("Sign-in failed:", error?.code, error?.message);
    return { error: `Couldn’t sign in: ${error?.message ?? "no user returned"}. Check the Supabase settings.`, email };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    await supabase.auth.signOut();
    return { error: "This account does not have admin access.", email };
  }

  redirect("/recipes");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
