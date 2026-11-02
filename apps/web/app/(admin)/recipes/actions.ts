"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ingredientLine, recipeInputSchema, type NutritionStatus, type RecipeInput } from "@meal-planner/shared";
import { requireAdmin } from "@/lib/auth";
import { calculateNutrition } from "@/lib/nutrition";
import { getRecipe } from "@/lib/recipes";
import { createClient } from "@/lib/supabase/server";
import { RECIPE_IMAGES_BUCKET, storagePathFromUrl } from "@/lib/supabase/env";

export type SaveResult = { error: string } | undefined;

async function removeStoredImage(url: string | null | undefined) {
  const path = storagePathFromUrl(url);
  if (!path) return;
  const supabase = await createClient();
  await supabase.storage.from(RECIPE_IMAGES_BUCKET).remove([path]);
}

export async function saveRecipe(id: string | null, input: RecipeInput): Promise<SaveResult> {
  await requireAdmin();

  const parsed = recipeInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid recipe" };
  }

  const supabase = await createClient();

  let previousImage: string | null = null;
  if (id) {
    const { data } = await supabase.from("recipes").select("image_url").eq("id", id).maybeSingle();
    if (!data) return { error: "Recipe not found" };
    previousImage = data.image_url;
  }

  const { data: savedId, error } = await supabase.rpc("save_recipe", {
    payload: { ...parsed.data, id },
  });
  if (error) return { error: error.message };

  if (previousImage && previousImage !== parsed.data.image_url) {
    await removeStoredImage(previousImage);
  }

  // save_recipe resets nutrition to 'pending' for new recipes and changed ingredients.
  const { data: saved } = await supabase.from("recipes").select("nutrition_status").eq("id", savedId).single();
  if (saved?.nutrition_status === "pending") {
    await updateNutrition(savedId, parsed.data.name, parsed.data.ingredients.map(ingredientLine));
  }

  revalidatePath("/recipes");
  redirect(`/recipes/${savedId}`);
}

/** Calls the nutrition API and stores the result. Failures are stored on the recipe, never thrown. */
async function updateNutrition(id: string, title: string, lines: string[]): Promise<NutritionStatus> {
  const result = await calculateNutrition(title, lines);
  const supabase = await createClient();
  await supabase
    .from("recipes")
    .update({
      carbs_g: result.carbs_g,
      fat_g: result.fat_g,
      protein_g: result.protein_g,
      nutrition_status: result.status,
      nutrition_skipped: result.skipped,
      nutrition_error: result.error,
      nutrition_updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  return result.status;
}

export async function recalculateNutrition(id: string): Promise<{ error?: string; status?: NutritionStatus }> {
  await requireAdmin();
  const recipe = await getRecipe(id);
  if (!recipe) return { error: "Recipe not found" };

  const status = await updateNutrition(id, recipe.name, recipe.ingredients.map(ingredientLine));
  revalidatePath(`/recipes/${id}`);
  return { status };
}

export async function deleteRecipe(id: string): Promise<SaveResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recipes")
    .delete()
    .eq("id", id)
    .select("image_url")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Recipe not found" };

  await removeStoredImage(data.image_url);

  revalidatePath("/recipes");
  redirect("/recipes");
}
