import type { Recipe } from "@meal-planner/shared";
import { RecalculateNutritionButton } from "./RecalculateNutritionButton";

const MACROS = [
  { key: "carbs_g", label: "Carbohydrates" },
  { key: "fat_g", label: "Fat" },
  { key: "protein_g", label: "Protein" },
] as const;

const grams = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("en", { maximumFractionDigits: 1 })} g`);

/** Read-only nutrition calculated from the ingredients by the server. */
export function NutritionPanel({ recipe }: { recipe: Recipe }) {
  const status = recipe.nutrition_status;
  const hasValues = status === "ok" || status === "partial";

  return (
    <section className="mt-10 rounded-2xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="nutrition-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="nutrition-heading" className="font-display text-xl font-semibold">
            Nutrition
          </h2>
          <p className="mt-1 text-sm text-muted">
            Calculated automatically from the ingredients, for one person.
          </p>
        </div>
        <RecalculateNutritionButton id={recipe.id} />
      </div>

      {hasValues && (
        <table className="mt-5 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="py-2 pr-4 font-medium" scope="col">
                <span className="sr-only">Nutrient</span>
              </th>
              <th className="py-2 text-right font-medium" scope="col">
                Per person
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {MACROS.map((m) => (
              <tr key={m.key}>
                <th scope="row" className="py-2.5 pr-4 font-medium">
                  {m.label}
                </th>
                <td className="py-2.5 text-right font-semibold text-accent tabular-nums">{grams(recipe[m.key])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {status === "pending" && (
        <p className="mt-4 rounded-lg bg-leaf-soft px-4 py-3 text-sm">
          Not calculated yet. Click Recalculate to calculate it now.
        </p>
      )}

      {status === "failed" && (
        <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          Nutrition couldn’t be calculated: {recipe.nutrition_error ?? "unknown error"}.
        </p>
      )}

      {recipe.nutrition_skipped.length > 0 && (
        <div className="mt-4 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm">
          <p className="font-semibold text-danger">
            {status === "partial"
              ? "These ingredients weren’t recognised, so they’re left out of the totals:"
              : "These ingredients weren’t recognised:"}
          </p>
          <ul className="mt-1.5 list-disc pl-5">
            {recipe.nutrition_skipped.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-2 text-muted">Edit the recipe, check the spelling and quantities, then save again.</p>
        </div>
      )}
    </section>
  );
}
