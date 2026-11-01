import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { LogoMark } from "@/components/icons";
import { SUPABASE_CONFIGURED } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const notice = error === "not-admin" ? "This account does not have admin access." : undefined;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-leaf-soft p-12 lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-lg font-semibold tracking-tight">Meal Planner</span>
        </div>

        <div className="relative z-10 mt-auto max-w-md">
          <h1 className="font-display text-5xl leading-[1.05] font-semibold tracking-tight">
            Every recipe your planner serves starts here.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Add recipes with photos, ingredients and steps. They appear in the Meal Planner app as soon as you
            save them.
          </p>
        </div>

        {/* Large leaf outline in the corner of the panel */}
        <svg
          viewBox="0 0 400 400"
          className="pointer-events-none absolute -top-24 -right-24 h-[460px] w-[460px] text-leaf"
          aria-hidden
        >
          <path d="M60 340C60 170 170 60 340 60c0 170-100 280-270 280" fill="currentColor" />
          <path d="M70 330 230 170" stroke="var(--leaf-soft)" strokeWidth="10" strokeLinecap="round" />
          <path d="M150 250h70M190 210v-60" stroke="var(--leaf-soft)" strokeWidth="6" strokeLinecap="round" />
        </svg>
      </section>

      <main className="flex items-center justify-center px-4 py-16 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LogoMark />
            <span className="font-display text-lg font-semibold tracking-tight">Meal Planner</span>
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Log in</h2>
          <p className="mt-2 text-muted">Use your admin email and password.</p>
          {!SUPABASE_CONFIGURED && (
            <div className="mt-6 rounded-xl border border-leaf bg-leaf-soft px-4 py-3 text-sm leading-relaxed">
              <p className="font-semibold">Supabase is not connected yet</p>
              <p className="mt-1 text-muted">
                Copy <code className="font-mono text-foreground">apps/web/.env.example</code> to{" "}
                <code className="font-mono text-foreground">.env.local</code>, add your project URL and key, then
                restart the dev server. The full steps are in README.md.
              </p>
            </div>
          )}
          <LoginForm notice={notice} />
        </div>
      </main>
    </div>
  );
}
