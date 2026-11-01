import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { RecipeInput } from "@meal-planner/shared";
import { requireAdmin } from "@/lib/auth";
import { getRecipe } from "@/lib/recipes";
import { RecipeForm } from "@/components/RecipeForm";

export const metadata: Metadata = { title: "Edit recipe" };

export default async function EditRecipePage({ params }: PageProps<"/recipes/[id]/edit">) {
  await requireAdmin();
  const recipe = await getRecipe((await params).id);
  if (!recipe) notFound();

  const input: RecipeInput = {
    name: recipe.name,
    description: recipe.description,
    image_url: recipe.image_url,
    prep_minutes: recipe.prep_minutes,
    cook_minutes: recipe.cook_minutes,
    total_minutes: recipe.total_minutes,
    allergens: recipe.allergens,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 border-b border-line pb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Edit recipe</h1>
        <p className="mt-1.5 text-muted">Changes appear in the Meal Planner app as soon as you save.</p>
      </header>
      <RecipeForm id={recipe.id} initial={input} />
    </div>
  );
}
