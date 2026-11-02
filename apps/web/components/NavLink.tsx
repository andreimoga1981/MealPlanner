"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = { href: string; exclude?: string[]; icon: React.ReactNode; children: React.ReactNode };

export function NavLink({ href, exclude, icon, children }: Props) {
  const pathname = usePathname();
  const active = pathname.startsWith(href) && !exclude?.some((path) => pathname.startsWith(path));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active ? "bg-leaf text-foreground" : "text-muted hover:bg-leaf/60 hover:text-foreground"
      }`}
    >
      <span className={active ? "text-accent" : undefined}>{icon}</span>
      <span className="sr-only sm:not-sr-only">{children}</span>
    </Link>
  );
}
