"use client";

import { useTransition } from "react";
import { recalculateNutrition } from "@/app/(admin)/recipes/actions";

export function RecalculateNutritionButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await recalculateNutrition(id);
      if (result?.error) window.alert(result.error);
    });
  }

  return (
    <button type="button" onClick={onClick} disabled={pending} className="btn-secondary">
      {pending ? "Calculating…" : "Recalculate"}
    </button>
  );
}
