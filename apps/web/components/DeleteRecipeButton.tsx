"use client";

import { useTransition } from "react";
import { deleteRecipe } from "@/app/(admin)/recipes/actions";
import { TrashIcon } from "./icons";

type Props = { id: string; name: string; compact?: boolean };

export function DeleteRecipeButton({ id, name, compact }: Props) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteRecipe(id);
      if (result?.error) window.alert(result.error);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={`Delete ${name}`}
      className={
        compact
          ? "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-muted transition hover:bg-danger-soft hover:text-danger disabled:opacity-60"
          : "btn-danger"
      }
    >
      <TrashIcon width={compact ? 15 : 16} height={compact ? 15 : 16} />
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
