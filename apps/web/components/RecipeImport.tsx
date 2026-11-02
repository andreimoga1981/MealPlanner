"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { allergenLabel, type NutritionStatus } from "@meal-planner/shared";
import type { ImportPreview, ImportRecipe } from "@/lib/recipe-import";
import { importRecipes, previewImport } from "@/app/(admin)/recipes/import/actions";
import { recalculateNutrition } from "@/app/(admin)/recipes/actions";
import { UploadIcon } from "./icons";

type Saved = { id: string; name: string; nutrition?: NutritionStatus | "error" };
type Stage =
  | { kind: "choose"; error?: string }
  | { kind: "preview"; fileName: string; preview: ImportPreview }
  | { kind: "done"; saved: Saved[]; failed: { name: string; error: string }[] };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function RecipeImport() {
  const [stage, setStage] = useState<Stage>({ kind: "choose" });
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [checking, startChecking] = useTransition();
  const [importing, startImporting] = useTransition();
  const [calculating, setCalculating] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function check(file: File | undefined) {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    startChecking(async () => {
      const result = await previewImport(form);
      if ("error" in result) setStage({ kind: "choose", error: result.error });
      else setStage({ kind: "preview", fileName: file.name, preview: result.preview });
    });
  }

  function reset() {
    setStage({ kind: "choose" });
    setIncludeDuplicates(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function calculateNutrition(saved: Saved[]) {
    setCalculating(true);
    // One at a time: each call is a short request, and it stays within Gemini's free-tier rate limit.
    for (const { id } of saved) {
      let nutrition: Saved["nutrition"];
      try {
        nutrition = (await recalculateNutrition(id)).status ?? "error";
      } catch {
        nutrition = "error";
      }
      setStage((s) =>
        s.kind === "done" ? { ...s, saved: s.saved.map((r) => (r.id === id ? { ...r, nutrition } : r)) } : s,
      );
    }
    setCalculating(false);
  }

  function runImport(recipes: ImportRecipe[]) {
    const inputs = recipes.flatMap((r) => (r.input ? [r.input] : []));
    startImporting(async () => {
      const result = await importRecipes(inputs);
      if ("error" in result) {
        setStage({ kind: "choose", error: result.error });
        return;
      }
      setStage({ kind: "done", saved: result.saved, failed: result.failed });
      if (result.saved.length) void calculateNutrition(result.saved);
    });
  }

  if (stage.kind === "done") return <ImportDone stage={stage} calculating={calculating} onAgain={reset} />;

  if (stage.kind === "preview") {
    const { recipes, fileProblems } = stage.preview;
    const ready = recipes.filter((r) => r.input && (includeDuplicates || !r.duplicate));
    const withProblems = recipes.filter((r) => !r.input).length;
    const duplicates = recipes.filter((r) => r.input && r.duplicate).length;

    return (
      <div>
        <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="font-semibold">{stage.fileName}</p>
            <p className="mt-0.5 text-sm text-muted">
              {plural(recipes.length, "recipe")} found · {ready.length} ready to import
              {withProblems > 0 && ` · ${withProblems} with problems`}
              {duplicates > 0 && ` · ${plural(duplicates, "name")} already in your recipes`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={reset} className="btn-secondary" disabled={importing}>
              Choose another file
            </button>
            <button
              type="button"
              onClick={() => runImport(ready)}
              className="btn-primary"
              disabled={importing || ready.length === 0}
            >
              {importing ? "Importing…" : `Import ${plural(ready.length, "recipe")}`}
            </button>
          </div>
        </div>

        {fileProblems.length > 0 && (
          <div role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger-soft px-5 py-4 text-sm">
            <p className="font-semibold text-danger">Fix these in the file, then upload it again:</p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
              {fileProblems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        {duplicates > 0 && (
          <label className="mt-4 flex items-start gap-3 rounded-xl bg-leaf-soft px-5 py-4 text-sm">
            <input
              type="checkbox"
              checked={includeDuplicates}
              onChange={(e) => setIncludeDuplicates(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />
            <span>
              <span className="font-semibold">Also import recipes whose name already exists.</span>{" "}
              <span className="text-muted">They are skipped by default so the same file can’t be imported twice.</span>
            </span>
          </label>
        )}

        {recipes.length > 0 && (
          <ul className="panel mt-4 divide-y divide-line">
            {recipes.map((r) => (
              <PreviewRow key={r.number} recipe={r} skipped={Boolean(r.input && r.duplicate && !includeDuplicates)} />
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="import-file"
        className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-leaf bg-leaf-soft/50 px-6 py-16 text-center transition hover:border-accent ${
          checking ? "pointer-events-none opacity-70" : ""
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          check(e.dataTransfer.files[0]);
        }}
      >
        <span className="text-accent">
          <UploadIcon width={32} height={32} />
        </span>
        <span className="mt-3 font-display text-xl font-semibold">
          {checking ? "Checking the file…" : "Choose the filled-in template"}
        </span>
        <span className="mt-1 text-sm text-muted">or drop it here · Excel .xlsx, up to 4 MB</span>
        <input
          ref={fileInput}
          id="import-file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => check(e.target.files?.[0])}
        />
      </label>
      {stage.error && (
        <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger-soft px-5 py-4 text-sm text-danger">
          {stage.error}
        </p>
      )}
      <p className="mt-4 text-sm text-muted">
        Nothing is saved until you confirm. Nutrition is calculated automatically after the import.
      </p>
    </div>
  );
}

function PreviewRow({ recipe: r, skipped }: { recipe: ImportRecipe; skipped: boolean }) {
  const status = !r.input
    ? { text: "Needs fixing", className: "bg-danger-soft text-danger" }
    : skipped
      ? { text: "Already exists", className: "bg-background text-muted" }
      : { text: "Ready", className: "bg-leaf text-foreground" };

  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-4">
      <span className="w-10 shrink-0 pt-0.5 text-sm text-muted tabular-nums">#{r.number}</span>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${skipped ? "text-muted" : ""}`}>{r.name || "Untitled recipe"}</p>
        <p className="mt-0.5 text-sm text-muted">
          {plural(r.ingredientCount, "ingredient")}, {plural(r.stepCount, "step")}
          {r.allergens.length > 0 && ` · Contains ${r.allergens.map(allergenLabel).join(", ")}`}
        </p>
        {r.problems.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-danger">
            {r.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>{status.text}</span>
    </li>
  );
}

function ImportDone({
  stage,
  calculating,
  onAgain,
}: {
  stage: Extract<Stage, { kind: "done" }>;
  calculating: boolean;
  onAgain: () => void;
}) {
  const { saved, failed } = stage;
  const finished = saved.filter((s) => s.nutrition).length;
  const nutritionProblems = saved.filter((s) => s.nutrition === "failed" || s.nutrition === "error").length;

  return (
    <div>
      <div className="panel p-6">
        <h2 className="font-display text-2xl font-semibold">
          {saved.length ? `Imported ${plural(saved.length, "recipe")}` : "No recipes were imported"}
        </h2>
        {saved.length > 0 && (
          <div className="mt-4" aria-live="polite">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {calculating ? "Calculating nutrition…" : "Nutrition calculated"}
              </span>
              <span className="text-muted tabular-nums">
                {finished} of {saved.length}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-leaf-soft">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${(finished / saved.length) * 100}%` }}
              />
            </div>
            {calculating && (
              <p className="mt-2 text-sm text-muted">
                Keep this page open until it finishes. If you leave, open a recipe and click Recalculate.
              </p>
            )}
            {!calculating && nutritionProblems > 0 && (
              <p className="mt-2 text-sm text-danger">
                Nutrition couldn’t be calculated for {plural(nutritionProblems, "recipe")}. Open it to see why, then
                click Recalculate.
              </p>
            )}
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/recipes" className="btn-primary">
            Go to My recipes
          </Link>
          <button type="button" onClick={onAgain} className="btn-secondary">
            Import another file
          </button>
        </div>
      </div>

      {failed.length > 0 && (
        <div role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger-soft px-5 py-4 text-sm">
          <p className="font-semibold text-danger">These recipes couldn’t be saved:</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {failed.map((f, i) => (
              <li key={i}>
                {f.name}: {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {saved.length > 0 && (
        <ul className="panel mt-4 divide-y divide-line">
          {saved.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <Link href={`/recipes/${s.id}`} className="font-medium hover:text-accent hover:underline">
                {s.name}
              </Link>
              <span className="text-sm text-muted">
                {s.nutrition === "ok"
                  ? "Nutrition ready"
                  : s.nutrition === "partial"
                    ? "Some ingredients not recognised"
                    : s.nutrition === "failed" || s.nutrition === "error"
                      ? "Nutrition failed"
                      : "Waiting…"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
