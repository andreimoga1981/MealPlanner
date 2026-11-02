"use server";

import { revalidatePath } from "next/cache";
import readXlsxFile from "read-excel-file/node";
import { recipeInputSchema, type RecipeInput } from "@meal-planner/shared";
import { requireAdmin } from "@/lib/auth";
import { parseRecipeSheets, type ImportPreview, type Sheet } from "@/lib/recipe-import";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_RECIPES = 500;

export type PreviewResult = { error: string } | { preview: ImportPreview };

/** Reads an uploaded template and checks every recipe. Saves nothing. */
export async function previewImport(formData: FormData): Promise<PreviewResult> {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an Excel file to import." };
  if (!/\.xlsx$/i.test(file.name)) return { error: "Use an Excel .xlsx file (the downloaded template)." };
  if (file.size > MAX_FILE_BYTES) return { error: "The file is larger than 4 MB. Split it into smaller files." };

  let sheets: Sheet[];
  try {
    // The library types date cells as `typeof Date`; at runtime they are Date instances.
    sheets = (await readXlsxFile(Buffer.from(await file.arrayBuffer()))) as unknown as Sheet[];
  } catch {
    return { error: "This file couldn’t be read as an Excel workbook. Save it as .xlsx and try again." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("recipes").select("name");
  if (error) return { error: error.message };

  const preview = parseRecipeSheets(
    sheets,
    (data ?? []).map((r) => r.name as string),
  );
  if (preview.recipes.length > MAX_RECIPES) {
    return { error: `The file has ${preview.recipes.length} recipes. Import at most ${MAX_RECIPES} at a time.` };
  }
  return { preview };
}

export type ImportResult = { error: string } | { saved: { id: string; name: string }[]; failed: { name: string; error: string }[] };

/** Saves recipes checked by previewImport. Nutrition is left 'pending' for the client to calculate one by one. */
export async function importRecipes(inputs: RecipeInput[]): Promise<ImportResult> {
  await requireAdmin();
  if (!Array.isArray(inputs) || inputs.length === 0) return { error: "There are no recipes to import." };
  if (inputs.length > MAX_RECIPES) return { error: `Import at most ${MAX_RECIPES} recipes at a time.` };

  const supabase = await createClient();
  const saved: { id: string; name: string }[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const input of inputs) {
    const parsed = recipeInputSchema.safeParse(input);
    const name = typeof input?.name === "string" ? input.name : "Untitled recipe";
    if (!parsed.success) {
      failed.push({ name, error: parsed.error.issues[0]?.message ?? "Invalid recipe" });
      continue;
    }
    const { data: id, error } = await supabase.rpc("save_recipe", { payload: { ...parsed.data, id: null } });
    if (error) failed.push({ name, error: error.message });
    else saved.push({ id, name: parsed.data.name });
  }

  revalidatePath("/recipes");
  return { saved, failed };
}
