"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ALLERGENS, type AllergenId } from "@meal-planner/shared";
import { SearchIcon, XIcon } from "./icons";

type Props = { search: string; freeFrom: AllergenId[] };

export function RecipeFilters({ search, freeFrom }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function navigate(nextSearch: string, nextFree: AllergenId[]) {
    const params = new URLSearchParams();
    if (nextSearch.trim()) params.set("q", nextSearch.trim());
    // Keep the URL in list order so the same filter always has the same URL.
    ALLERGENS.filter((a) => nextFree.includes(a.id)).forEach((a) => params.append("free", a.id));
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  function toggle(id: AllergenId) {
    navigate(search, freeFrom.includes(id) ? freeFrom.filter((f) => f !== id) : [...freeFrom, id]);
  }

  return (
    <div className="mt-6 space-y-4 border-b border-line pb-6" aria-busy={pending}>
      <form
        role="search"
        className="relative sm:max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(String(new FormData(e.currentTarget).get("q") ?? ""), freeFrom);
        }}
      >
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input
          key={search}
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search by name"
          aria-label="Search recipes"
          className="input pl-10"
        />
      </form>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">
          Free from
          <span className="ml-2 font-normal text-muted">Hide recipes that contain the allergens you select</span>
        </legend>
        <div className="flex flex-wrap items-center gap-1.5">
          {ALLERGENS.map((a) => {
            const active = freeFrom.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(a.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "border-accent bg-leaf text-foreground"
                    : "border-line bg-surface text-muted hover:border-muted/40 hover:text-foreground"
                }`}
              >
                {a.label}
              </button>
            );
          })}
          {freeFrom.length > 0 && (
            <button
              type="button"
              onClick={() => navigate(search, [])}
              className="ml-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-semibold text-accent hover:underline"
            >
              <XIcon width={14} height={14} />
              Clear allergens
            </button>
          )}
        </div>
      </fieldset>
    </div>
  );
}
