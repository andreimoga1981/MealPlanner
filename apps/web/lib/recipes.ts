import "server-only";
import { isAllergenId, type AllergenId, type Recipe } from "@meal-planner/shared";
import { createClient } from "./supabase/server";

export type RecipeSummary = Pick<Recipe, "id" | "name" | "description" | "image_url" | "total_minutes" | "allergens">;

/** Recipes matching `search`, excluding any that contain one of the `freeFrom` allergens. */
export async function listRecipes(search: string, freeFrom: AllergenId[] = []): Promise<RecipeSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("recipes")
    .select("id, name, description, image_url, total_minutes, allergens")
    .order("created_at", { ascending: false });

  const term = search.trim();
  if (term) query = query.ilike("name", `%${term.replace(/[%_\\]/g, "\\$&")}%`);

  const exclude = freeFrom.filter(isAllergenId);
  if (exclude.length) query = query.not("allergens", "ov", `{${exclude.join(",")}}`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as RecipeSummary[];
}

type RecipeRow = Omit<Recipe, "ingredients" | "steps" | "carbs_g" | "fat_g" | "protein_g"> & {
  carbs_g: number | string | null;
  fat_g: number | string | null;
  protein_g: number | string | null;
  recipe_ingredients: { position: number; quantity: number | null; unit: string; name: string }[];
  recipe_steps: { position: number; text: string }[];
};

// Postgres numeric can arrive as a string; normalise to number | null.
const num = (v: number | string | null) => (v == null ? null : Number(v));

export async function getRecipe(id: string): Promise<Recipe | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select(
      "id, name, description, image_url, prep_minutes, cook_minutes, total_minutes, allergens, carbs_g, fat_g, protein_g, nutrition_status, nutrition_skipped, nutrition_error, created_at, updated_at, recipe_ingredients(position, quantity, unit, name), recipe_steps(position, text)",
    )
    .eq("id", id)
    .maybeSingle<RecipeRow>();

  // An id that isn't a valid uuid comes back as a Postgres error; treat it as not found.
  if (error || !data) return null;

  const { recipe_ingredients, recipe_steps, carbs_g, fat_g, protein_g, ...recipe } = data;
  return {
    ...recipe,
    carbs_g: num(carbs_g),
    fat_g: num(fat_g),
    protein_g: num(protein_g),
    ingredients: [...recipe_ingredients]
      .sort((a, b) => a.position - b.position)
      .map(({ quantity, unit, name }) => ({ quantity: num(quantity), unit, name })),
    steps: [...recipe_steps].sort((a, b) => a.position - b.position).map(({ text }) => ({ text })),
  };
}
