import type { Metadata } from "next";
import Link from "next/link";
import { allergenLabel, formatMinutes, isAllergenId, type AllergenId } from "@meal-planner/shared";
import { requireAdmin } from "@/lib/auth";
import { listRecipes } from "@/lib/recipes";
import { RecipeImage } from "@/components/RecipeImage";
import { DeleteRecipeButton } from "@/components/DeleteRecipeButton";
import { RecipeFilters } from "@/components/RecipeFilters";
import { ClockIcon, PencilIcon, PlusIcon, UploadIcon } from "@/components/icons";

export const metadata: Metadata = { title: "My recipes" };

export default async function RecipesPage({ searchParams }: PageProps<"/recipes">) {
  await requireAdmin();
  const { q, free } = await searchParams;
  const search = typeof q === "string" ? q : "";
  const freeFrom = [...new Set([free ?? []].flat())].filter(isAllergenId);
  const recipes = await listRecipes(search, freeFrom);
  const filtered = Boolean(search || freeFrom.length);

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">My recipes</h1>
          <p className="mt-1.5 text-muted">{resultSummary(recipes.length, search, freeFrom)}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/recipes/import" className="btn-secondary whitespace-nowrap">
            <UploadIcon />
            Import
          </Link>
          <Link href="/recipes/new" className="btn-primary whitespace-nowrap">
            <PlusIcon />
            Add recipe
          </Link>
        </div>
      </header>

      <RecipeFilters search={search} freeFrom={freeFrom} />

      {recipes.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-leaf bg-leaf-soft/50 px-6 py-20 text-center">
          <h2 className="font-display text-xl font-semibold">
            {filtered ? "No recipes match these filters" : "Your collection is empty"}
          </h2>
          <p className="mt-2 max-w-sm text-muted">
            {filtered
              ? "Try fewer allergens or a shorter search."
              : "Add your first recipe and it will show up in the Meal Planner app."}
          </p>
          {filtered ? (
            <Link href="/recipes" className="btn-secondary mt-6">
              Clear filters
            </Link>
          ) : (
            <Link href="/recipes/new" className="btn-primary mt-6">
              <PlusIcon />
              Add recipe
            </Link>
          )}
        </div>
      ) : (
        <ul className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {recipes.map((recipe) => (
            <li key={recipe.id} className="flex flex-col">
              <Link href={`/recipes/${recipe.id}`} className="group block rounded-2xl">
                <div className="overflow-hidden rounded-2xl border border-line">
                  <RecipeImage
                    src={recipe.image_url}
                    alt=""
                    className="aspect-[4/3] w-full transition duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="mt-3.5 px-0.5">
                  <h2 className="font-display text-lg leading-snug font-semibold group-hover:text-accent">
                    {recipe.name}
                  </h2>
                  {recipe.description && (
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{recipe.description}</p>
                  )}
                  {recipe.allergens.length > 0 && (
                    <p className="mt-2 text-xs text-muted">
                      Contains{" "}
                      <span className="font-medium text-foreground">
                        {recipe.allergens.slice(0, 3).map(allergenLabel).join(", ")}
                        {recipe.allergens.length > 3 && ` +${recipe.allergens.length - 3}`}
                      </span>
                    </p>
                  )}
                </div>
              </Link>
              <div className="mt-auto flex items-center justify-between gap-2 px-0.5 pt-3">
                <p className="inline-flex items-center gap-1.5 rounded-full bg-leaf-soft px-2.5 py-1 text-xs font-semibold text-accent">
                  <ClockIcon width={14} height={14} />
                  {formatMinutes(recipe.total_minutes)}
                </p>
                <div className="flex gap-1">
                  <Link
                    href={`/recipes/${recipe.id}/edit`}
                    aria-label={`Edit ${recipe.name}`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-muted transition hover:bg-leaf-soft hover:text-foreground"
                  >
                    <PencilIcon width={15} height={15} />
                    Edit
                  </Link>
                  <DeleteRecipeButton id={recipe.id} name={recipe.name} compact />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function resultSummary(count: number, search: string, freeFrom: AllergenId[]): string {
  const noun = count === 1 ? "recipe" : "recipes";
  if (!search && !freeFrom.length) return `${count} ${noun} in your collection`;
  const parts = [`${count} ${noun}`];
  if (search) parts.push(`matching “${search}”`);
  if (freeFrom.length) {
    const labels = freeFrom.map((id) => allergenLabel(id).toLowerCase());
    const list = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : labels[0];
    parts.push(`free from ${list}`);
  }
  return parts.join(" ");
}
