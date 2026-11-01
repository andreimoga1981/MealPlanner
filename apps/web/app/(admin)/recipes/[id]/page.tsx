import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allergenLabel, formatMinutes } from "@meal-planner/shared";
import { NutritionPanel } from "@/components/NutritionPanel";
import { requireAdmin } from "@/lib/auth";
import { getRecipe } from "@/lib/recipes";
import { RecipeImage } from "@/components/RecipeImage";
import { DeleteRecipeButton } from "@/components/DeleteRecipeButton";
import { ChevronLeftIcon, PencilIcon } from "@/components/icons";

export async function generateMetadata({ params }: PageProps<"/recipes/[id]">): Promise<Metadata> {
  const recipe = await getRecipe((await params).id);
  return { title: recipe?.name ?? "Recipe" };
}

export default async function RecipePage({ params }: PageProps<"/recipes/[id]">) {
  await requireAdmin();
  const recipe = await getRecipe((await params).id);
  if (!recipe) notFound();

  const times = [
    { label: "Prep", value: formatMinutes(recipe.prep_minutes) },
    { label: "Cook", value: formatMinutes(recipe.cook_minutes) },
    { label: "Total", value: formatMinutes(recipe.total_minutes) },
  ];

  return (
    <article className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/recipes"
          className="-ml-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-muted hover:text-foreground"
        >
          <ChevronLeftIcon width={16} height={16} />
          My recipes
        </Link>
        <div className="flex gap-2">
          <Link href={`/recipes/${recipe.id}/edit`} className="btn-secondary">
            <PencilIcon width={16} height={16} />
            Edit
          </Link>
          <DeleteRecipeButton id={recipe.id} name={recipe.name} />
        </div>
      </div>

      <div className="mt-6 grid items-center gap-8 md:grid-cols-[1.15fr_1fr] md:gap-12">
        <RecipeImage
          src={recipe.image_url}
          alt={recipe.name}
          className="aspect-[4/3] w-full rounded-2xl border border-line"
        />
        <div>
          <h1 className="font-display text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
            {recipe.name}
          </h1>
          {recipe.description && (
            <p className="mt-4 text-lg leading-relaxed whitespace-pre-line text-muted">{recipe.description}</p>
          )}
          <dl className="mt-7 grid grid-cols-2 gap-y-4 rounded-2xl bg-leaf-soft py-4 sm:flex sm:divide-x sm:divide-leaf">
            {times.map((t) => (
              <div key={t.label} className="flex-1 px-5">
                <dt className="text-sm text-muted">{t.label}</dt>
                <dd className="font-display mt-0.5 text-xl font-semibold">{t.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6">
            <h2 className="text-sm text-muted">Contains</h2>
            {recipe.allergens.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {recipe.allergens.map((id) => (
                  <li
                    key={id}
                    className="rounded-full border border-danger/25 bg-danger-soft px-3 py-1 text-sm font-medium text-danger"
                  >
                    {allergenLabel(id)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm">No allergens marked</p>
            )}
          </div>
        </div>
      </div>

      <NutritionPanel recipe={recipe} />

      <div className="mt-14 grid gap-12 border-t border-line pt-10 md:grid-cols-[1fr_1.5fr]">
        <section>
          <h2 className="font-display text-2xl font-semibold">Ingredients</h2>
          <ul className="mt-5 divide-y divide-line border-y border-line">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex gap-4 py-3">
                <span className="w-20 shrink-0 font-semibold text-accent tabular-nums">
                  {[ing.quantity, ing.unit].filter((v) => v != null && v !== "").join(" ")}
                </span>
                <span>{ing.name}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl font-semibold">Instructions</h2>
          <ol className="mt-5 space-y-6">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-leaf text-sm font-bold">
                  {i + 1}
                </span>
                <p className="pt-1 leading-relaxed whitespace-pre-line">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  );
}
