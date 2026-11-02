import {
  ALLERGENS,
  recipeInputSchema,
  sumMinutes,
  type AllergenId,
  type Ingredient,
  type RecipeInput,
} from "@meal-planner/shared";

// Turns the sheets of a filled-in recipe-import-template.xlsx into validated recipes.
// Pure: no I/O, so the same rules apply wherever the workbook was read.

export type Cell = string | number | boolean | Date | null | undefined;
export type Sheet = { sheet: string; data: Cell[][] };

export type ImportRecipe = {
  /** The "Recipe no." from the file, as written. */
  number: string;
  name: string;
  ingredientCount: number;
  stepCount: number;
  allergens: AllergenId[];
  /** Ready-to-save input, or null when the recipe has problems. */
  input: RecipeInput | null;
  problems: string[];
  /** A recipe with this name already exists, or appears earlier in the file. */
  duplicate: boolean;
};

export type ImportPreview = {
  recipes: ImportRecipe[];
  /** Problems that aren't tied to one recipe (missing sheets, unlinked rows, …). */
  fileProblems: string[];
};

/** "Prep time (min)" → "preptimemin": headers are matched loosely so small edits don't break the import. */
const key = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const SHEETS = {
  recipes: { name: "Recipes", required: ["recipeno", "name"] },
  ingredients: { name: "Ingredients", required: ["recipeno", "ingredient"] },
  steps: { name: "Steps", required: ["recipeno", "step"] },
} as const;

const HEADER_LABELS: Record<string, string> = {
  recipeno: "Recipe no.",
  name: "Name",
  ingredient: "Ingredient",
  step: "Step",
};

const ALLERGEN_BY_HEADER = new Map<string, AllergenId>(
  ALLERGENS.flatMap((a) => [
    [key(a.label), a.id],
    [key(a.id), a.id],
  ]),
);

const YES = new Set(["yes", "y", "x", "da", "true", "1"]);

const isEmpty = (v: Cell) => v == null || (typeof v === "string" && v.trim() === "");

function text(v: Cell): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/** A number from a cell; accepts "0,5" as well as 0.5. Returns an error message for anything else. */
function number(v: Cell, label: string): { value: number | null } | { error: string } {
  if (isEmpty(v)) return { value: null };
  if (v instanceof Date) return { error: `${label} looks like a date. Type it as a number, e.g. 0.5` };
  if (typeof v === "number") return { value: v };
  const n = Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? { value: n } : { error: `${label} must be a number (found “${text(v)}”)` };
}

type Table = { rows: { line: number; get: (col: string) => Cell; cells: Cell[] }[]; columns: Map<string, number> };

function table(sheets: Sheet[], spec: { name: string; required: readonly string[] }, problems: string[]): Table | null {
  const sheet = sheets.find((s) => key(s.sheet) === key(spec.name));
  if (!sheet) {
    problems.push(`The “${spec.name}” sheet is missing. Use the template and keep its sheet names.`);
    return null;
  }
  const [header = [], ...body] = sheet.data;
  const columns = new Map<string, number>();
  header.forEach((h, i) => {
    if (!isEmpty(h) && !columns.has(key(h))) columns.set(key(h), i);
  });
  const missing = spec.required.filter((c) => !columns.has(c));
  if (missing.length) {
    problems.push(
      `The “${spec.name}” sheet has no ${missing.map((c) => `“${HEADER_LABELS[c] ?? c}”`).join(" or ")} column.`,
    );
    return null;
  }
  return {
    columns,
    rows: body
      .map((cells, i) => ({
        line: i + 2, // Excel row number: header is row 1
        cells,
        get: (col: string) => {
          const idx = columns.get(col);
          return idx == null ? null : cells[idx];
        },
      }))
      .filter((r) => r.cells.some((c) => !isEmpty(c))),
  };
}

/** Recipe numbers are compared as text, so 1 and "1" match but "1" and "01" don't. */
const recipeNo = (v: Cell) => text(typeof v === "number" ? String(v) : v);

function describeIssue(path: PropertyKey[], message: string, ingredientLines: number[], stepLines: number[]): string {
  const [field, index, sub] = path;
  if (field === "ingredients" && typeof index === "number") {
    const what = sub === "quantity" ? "quantity" : sub === "unit" ? "unit" : "ingredient";
    return `Ingredients row ${ingredientLines[index]} (${what}): ${message}`;
  }
  if (field === "steps" && typeof index === "number") return `Steps row ${stepLines[index]}: ${message}`;
  const labels: Record<string, string> = {
    name: "Name",
    description: "Description",
    image_url: "Image URL",
    prep_minutes: "Prep time",
    cook_minutes: "Cook time",
    total_minutes: "Total time",
  };
  const label = typeof field === "string" ? labels[field] : undefined;
  return label ? `${label}: ${message}` : message;
}

export function parseRecipeSheets(sheets: Sheet[], existingNames: Iterable<string> = []): ImportPreview {
  const fileProblems: string[] = [];
  const recipesTable = table(sheets, SHEETS.recipes, fileProblems);
  const ingredientsTable = table(sheets, SHEETS.ingredients, fileProblems);
  const stepsTable = table(sheets, SHEETS.steps, fileProblems);
  if (!recipesTable || !ingredientsTable || !stepsTable) return { recipes: [], fileProblems };

  type Draft = {
    number: string;
    line: number;
    problems: string[];
    fields: Omit<RecipeInput, "ingredients" | "steps">;
    ingredients: Ingredient[];
    ingredientLines: number[];
    steps: { text: string }[];
    stepLines: number[];
  };
  const drafts = new Map<string, Draft>();

  const allergenColumns = [...recipesTable.columns].flatMap(([col]) => {
    const id = ALLERGEN_BY_HEADER.get(col);
    return id ? [{ col, id, label: ALLERGENS.find((a) => a.id === id)!.label }] : [];
  });

  for (const row of recipesTable.rows) {
    const no = recipeNo(row.get("recipeno"));
    if (!no) {
      fileProblems.push(`Recipes row ${row.line}: “Recipe no.” is empty, so this recipe was skipped.`);
      continue;
    }
    if (drafts.has(no)) {
      fileProblems.push(
        `Recipes row ${row.line}: recipe no. ${no} is already used on row ${drafts.get(no)!.line}, so this row was skipped.`,
      );
      continue;
    }

    const problems: string[] = [];
    const minutes = (col: string, label: string) => {
      const r = number(row.get(col), label);
      if ("error" in r) problems.push(r.error);
      return "value" in r ? r.value : null;
    };
    const prep = minutes("preptimemin", "Prep time");
    const cook = minutes("cooktimemin", "Cook time");
    const total = minutes("totaltimemin", "Total time");

    const allergens: AllergenId[] = [];
    for (const { col, id, label } of allergenColumns) {
      const v = row.get(col);
      if (isEmpty(v) || v === false || v === 0) continue;
      if (v === true || YES.has(text(v).toLowerCase())) allergens.push(id);
      else if (!["no", "n", "nu", "false", "0"].includes(text(v).toLowerCase()))
        problems.push(`${label}: choose Yes or leave it empty (found “${text(v)}”)`);
    }

    const image = text(row.get("imageurl"));
    drafts.set(no, {
      number: no,
      line: row.line,
      problems,
      fields: {
        name: text(row.get("name")),
        description: text(row.get("description")),
        image_url: image || null,
        prep_minutes: prep,
        cook_minutes: cook,
        total_minutes: total ?? sumMinutes(prep, cook),
        allergens,
      },
      ingredients: [],
      ingredientLines: [],
      steps: [],
      stepLines: [],
    });
  }

  const unknown = (sheet: string, line: number, no: string) =>
    fileProblems.push(
      no
        ? `${sheet} row ${line}: there is no recipe no. ${no} on the Recipes sheet, so this row was skipped.`
        : `${sheet} row ${line}: “Recipe no.” is empty, so this row was skipped.`,
    );

  for (const row of ingredientsTable.rows) {
    const no = recipeNo(row.get("recipeno"));
    const draft = drafts.get(no);
    if (!draft) {
      unknown("Ingredients", row.line, no);
      continue;
    }
    const quantity = number(row.get("quantity"), `Ingredients row ${row.line}: quantity`);
    if ("error" in quantity) draft.problems.push(quantity.error);
    draft.ingredients.push({
      quantity: "value" in quantity ? quantity.value : null,
      unit: text(row.get("unit")),
      name: text(row.get("ingredient")),
    });
    draft.ingredientLines.push(row.line);
  }

  for (const row of stepsTable.rows) {
    const no = recipeNo(row.get("recipeno"));
    const draft = drafts.get(no);
    if (!draft) {
      unknown("Steps", row.line, no);
      continue;
    }
    draft.steps.push({ text: text(row.get("step")) });
    draft.stepLines.push(row.line);
  }

  const seenNames = new Set([...existingNames].map((n) => n.trim().toLowerCase()));
  const recipes = [...drafts.values()].map((d): ImportRecipe => {
    const parsed = recipeInputSchema.safeParse({ ...d.fields, ingredients: d.ingredients, steps: d.steps });
    const problems = [...d.problems];
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const msg = describeIssue(issue.path, issue.message, d.ingredientLines, d.stepLines);
        if (!problems.includes(msg)) problems.push(msg);
      }
    }
    const nameKey = d.fields.name.toLowerCase();
    const duplicate = nameKey !== "" && seenNames.has(nameKey);
    seenNames.add(nameKey);

    return {
      number: d.number,
      name: d.fields.name,
      ingredientCount: d.ingredients.length,
      stepCount: d.steps.length,
      allergens: d.fields.allergens,
      input: parsed.success && problems.length === 0 ? parsed.data : null,
      problems,
      duplicate,
    };
  });

  if (recipes.length === 0 && fileProblems.length === 0) {
    fileProblems.push("The Recipes sheet has no recipes yet.");
  }
  return { recipes, fileProblems };
}
