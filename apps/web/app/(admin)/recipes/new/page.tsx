import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { RecipeForm } from "@/components/RecipeForm";

export const metadata: Metadata = { title: "Add recipe" };

export default async function NewRecipePage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 border-b border-line pb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Add recipe</h1>
        <p className="mt-1.5 text-muted">Fill in the details below. Fields marked with * are required.</p>
      </header>
      <RecipeForm />
    </div>
  );
}
