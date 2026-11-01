import { z } from "zod";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** The 14 allergens EU law requires food businesses to declare. Ids match the DB check constraint. */
export const ALLERGENS = [
  { id: "gluten", label: "Gluten" },
  { id: "crustaceans", label: "Crustaceans" },
  { id: "eggs", label: "Eggs" },
  { id: "fish", label: "Fish" },
  { id: "peanuts", label: "Peanuts" },
  { id: "soybeans", label: "Soy" },
  { id: "milk", label: "Milk" },
  { id: "nuts", label: "Tree nuts" },
  { id: "celery", label: "Celery" },
  { id: "mustard", label: "Mustard" },
  { id: "sesame", label: "Sesame" },
  { id: "sulphites", label: "Sulphites" },
  { id: "lupin", label: "Lupin" },
  { id: "molluscs", label: "Molluscs" },
] as const;

export type AllergenId = (typeof ALLERGENS)[number]["id"];

const ALLERGEN_IDS = ALLERGENS.map((a) => a.id) as [AllergenId, ...AllergenId[]];

export function isAllergenId(value: string): value is AllergenId {
  return (ALLERGEN_IDS as string[]).includes(value);
}

export function allergenLabel(id: AllergenId): string {
  return ALLERGENS.find((a) => a.id === id)?.label ?? id;
}

const minutes = z
  .number({ error: "Must be a number" })
  .int("Use whole minutes")
  .min(0, "Cannot be negative")
  .max(10000)
  .nullable();

export const ingredientSchema = z.object({
  quantity: z.number({ error: "Must be a number" }).positive("Must be more than 0").nullable(),
  unit: z.string().trim().max(30),
  name: z.string().trim().min(1, "Ingredient name is required").max(200),
});

export const stepSchema = z.object({
  text: z.string().trim().min(1, "Step cannot be empty").max(2000),
});

export const recipeInputSchema = z.object({
  name: z.string().trim().min(1, "Recipe name is required").max(200),
  description: z.string().trim().max(5000),
  image_url: z.url({ protocol: /^https?$/, error: "Enter a valid http(s) image URL" }).nullable(),
  prep_minutes: minutes,
  cook_minutes: minutes,
  total_minutes: minutes,
  allergens: z.array(z.enum(ALLERGEN_IDS)).transform((ids) => [...new Set(ids)]),
  ingredients: z.array(ingredientSchema).min(1, "Add at least one ingredient"),
  steps: z.array(stepSchema).min(1, "Add at least one instruction step"),
});

export type Ingredient = z.infer<typeof ingredientSchema>;
export type Step = z.infer<typeof stepSchema>;
export type RecipeInput = z.infer<typeof recipeInputSchema>;

export type NutritionStatus = "pending" | "ok" | "partial" | "failed";

/** Macros in grams for one person (a whole recipe). Calculated on the server from the ingredients, never entered by hand. */
export type Macros = { carbs_g: number; fat_g: number; protein_g: number };

export type Nutrition = {
  carbs_g: number | null;
  fat_g: number | null;
  protein_g: number | null;
  nutrition_status: NutritionStatus;
  nutrition_skipped: string[];
  nutrition_error: string | null;
};

export type Recipe = RecipeInput &
  Nutrition & {
    id: string;
    created_at: string;
    updated_at: string;
  };

export function sumMinutes(prep: number | null, cook: number | null): number | null {
  if (prep == null && cook == null) return null;
  return (prep ?? 0) + (cook ?? 0);
}

export function formatMinutes(total: number | null): string {
  if (total == null) return "—";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** The text sent to the nutrition API for one ingredient, e.g. "200 g spaghetti". */
export function ingredientLine(ing: Ingredient): string {
  return [ing.quantity, ing.unit, ing.name].filter((v) => v != null && v !== "").join(" ");
}

function wholeRecipeMacros(r: Pick<Nutrition, "carbs_g" | "fat_g" | "protein_g">): Macros | null {
  if (r.carbs_g == null || r.fat_g == null || r.protein_g == null) return null;
  return { carbs_g: r.carbs_g, fat_g: r.fat_g, protein_g: r.protein_g };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Macros for `people` portions. Recipes are written for one person, so this is a plain multiple. */
export function macrosForPeople(recipe: Pick<Nutrition, "carbs_g" | "fat_g" | "protein_g">, people: number): Macros | null {
  const perPerson = wholeRecipeMacros(recipe);
  if (!perPerson) return null;
  return {
    carbs_g: round1(perPerson.carbs_g * people),
    fat_g: round1(perPerson.fat_g * people),
    protein_g: round1(perPerson.protein_g * people),
  };
}

/** Ingredient quantities for `people` portions (lines without a quantity are unchanged). */
export function scaleIngredients(ingredients: Ingredient[], people: number): Ingredient[] {
  return ingredients.map((ing) =>
    ing.quantity == null ? ing : { ...ing, quantity: Math.round(ing.quantity * people * 100) / 100 },
  );
}

/** Totals for a meal, e.g. sumMacros(recipes.map((r) => macrosForPeople(r, familySize))). */
export function sumMacros(list: (Macros | null)[]): Macros {
  return list.reduce<Macros>(
    (sum, m) =>
      m
        ? {
            carbs_g: round1(sum.carbs_g + m.carbs_g),
            fat_g: round1(sum.fat_g + m.fat_g),
            protein_g: round1(sum.protein_g + m.protein_g),
          }
        : sum,
    { carbs_g: 0, fat_g: 0, protein_g: 0 },
  );
}
