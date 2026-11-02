import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../login/actions";
import { NavLink } from "@/components/NavLink";
import { BookIcon, LogOutIcon, LogoMark, PlusIcon, UploadIcon } from "@/components/icons";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 z-20 border-b border-line bg-leaf-soft lg:h-screen lg:border-r lg:border-b-0">
        <div className="flex h-full items-center gap-4 px-4 py-3 lg:flex-col lg:items-stretch lg:gap-8 lg:px-4 lg:py-6">
          <Link href="/recipes" className="flex items-center gap-2.5 lg:px-2">
            <LogoMark />
            <span className="font-display text-lg font-semibold tracking-tight">Meal Planner</span>
          </Link>

          <nav className="flex gap-1 lg:flex-col" aria-label="Main">
            <NavLink href="/recipes" exclude={["/recipes/new", "/recipes/import"]} icon={<BookIcon />}>
              My recipes
            </NavLink>
            <NavLink href="/recipes/new" icon={<PlusIcon />}>
              Add recipe
            </NavLink>
            <NavLink href="/recipes/import" icon={<UploadIcon />}>
              Import recipes
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:mt-auto lg:ml-0 lg:flex-col lg:items-stretch lg:border-t lg:border-leaf lg:pt-4">
            <div className="hidden min-w-0 px-2 lg:block">
              <p className="text-xs text-muted">Signed in as</p>
              <p className="truncate text-sm font-medium">{admin.email}</p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-leaf hover:text-foreground"
              >
                <LogOutIcon />
                <span className="sr-only sm:not-sr-only">Log out</span>
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 lg:py-12">{children}</main>
    </div>
  );
}
