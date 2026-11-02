import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { RecipeImport } from "@/components/RecipeImport";
import { DownloadIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Import recipes" };

export default async function ImportRecipesPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line pb-6">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Import recipes</h1>
          <p className="mt-1.5 max-w-2xl text-muted">
            Fill in the Excel template, one person per recipe, then upload it here. You’ll see every recipe checked
            before anything is saved.
          </p>
        </div>
        <a href="/recipe-import-template.xlsx" download className="btn-secondary whitespace-nowrap">
          <DownloadIcon />
          Download template
        </a>
      </header>
      <RecipeImport />
    </div>
  );
}
