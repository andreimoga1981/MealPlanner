"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ALLERGENS, recipeInputSchema, sumMinutes, type RecipeInput } from "@meal-planner/shared";
import { saveRecipe } from "@/app/(admin)/recipes/actions";
import { createClient } from "@/lib/supabase/client";
import { RECIPE_IMAGES_BUCKET } from "@/lib/supabase/env";
import { ImageInput } from "./ImageInput";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from "./icons";

const EMPTY: RecipeInput = {
  name: "",
  description: "",
  image_url: null,
  prep_minutes: null,
  cook_minutes: null,
  total_minutes: null,
  allergens: [],
  ingredients: [{ quantity: null, unit: "", name: "" }],
  steps: [{ text: "" }],
};

const UNITS = ["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "pcs", "pinch", "clove", "slice", "can"];

const toNumberOrNull = (v: unknown) => (v === "" || v == null ? null : Number(v));

async function uploadImage(file: File): Promise<{ url: string; path: string }> {
  const supabase = createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const bucket = supabase.storage.from(RECIPE_IMAGES_BUCKET);
  const { error } = await bucket.upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return { url: bucket.getPublicUrl(path).data.publicUrl, path };
}

export function RecipeForm({ id, initial }: { id?: string; initial?: RecipeInput }) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RecipeInput>({
    resolver: zodResolver(recipeInputSchema),
    defaultValues: initial ?? EMPTY,
  });

  const ingredients = useFieldArray({ control, name: "ingredients" });
  const steps = useFieldArray({ control, name: "steps" });

  const [file, setFile] = useState<File | null>(null);
  const [serverError, setServerError] = useState<string>();
  const imageUrl = useWatch({ control, name: "image_url" });

  // Total time follows prep + cook until the admin types their own value.
  const [totalIsManual, setTotalIsManual] = useState(
    () => initial != null && initial.total_minutes !== sumMinutes(initial.prep_minutes, initial.cook_minutes),
  );
  const prep = useWatch({ control, name: "prep_minutes" });
  const cook = useWatch({ control, name: "cook_minutes" });
  useEffect(() => {
    if (!totalIsManual) setValue("total_minutes", sumMinutes(prep, cook));
  }, [prep, cook, totalIsManual, setValue]);

  async function onSubmit(values: RecipeInput) {
    setServerError(undefined);
    let uploadedPath: string | null = null;
    try {
      if (file) {
        const uploaded = await uploadImage(file);
        uploadedPath = uploaded.path;
        values = { ...values, image_url: uploaded.url };
      }
      const result = await saveRecipe(id ?? null, values);
      if (result?.error) throw new Error(result.error);
    } catch (err) {
      if (uploadedPath) await createClient().storage.from(RECIPE_IMAGES_BUCKET).remove([uploadedPath]);
      setServerError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const listError = (e?: { message?: string; root?: { message?: string } }) => e?.message ?? e?.root?.message;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {serverError && (
        <p role="alert" className="mb-8 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          {serverError}
        </p>
      )}

      <div className="divide-y divide-line">
        <FormSection title="Photo" hint="Shown on the recipe card and at the top of the recipe in the app.">
          <ImageInput
            url={imageUrl}
            file={file}
            error={errors.image_url?.message}
            onFileChange={setFile}
            onUrlChange={(url) => setValue("image_url", url, { shouldValidate: true })}
          />
        </FormSection>

        <FormSection title="Details" hint="The name and description people see when choosing a meal.">
          <div className="space-y-5">
            <div>
              <label htmlFor="name" className="label">
                Recipe name <span className="text-danger">*</span>
              </label>
              <input id="name" {...register("name")} className="input" placeholder="e.g. Chicken curry" />
              {errors.name && <p className="field-error">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="description" className="label">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                {...register("description")}
                className="input"
                placeholder="A short description of the dish"
              />
              {errors.description && <p className="field-error">{errors.description.message}</p>}
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Time"
          hint="Times in minutes. Total time is prep + cook unless you change it."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["prep_minutes", "Prep time"],
                ["cook_minutes", "Cook time"],
                ["total_minutes", "Total time"],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label htmlFor={field} className="label">
                  {label}
                </label>
                <div className="relative">
                  <input
                    id={field}
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    {...register(field, {
                      setValueAs: toNumberOrNull,
                      onChange: field === "total_minutes" ? () => setTotalIsManual(true) : undefined,
                    })}
                    className={`input pr-12 ${field === "total_minutes" && !totalIsManual ? "bg-leaf-soft" : ""}`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
                    min
                  </span>
                </div>
                {field === "total_minutes" &&
                  (totalIsManual ? (
                    <button
                      type="button"
                      onClick={() => setTotalIsManual(false)}
                      className="mt-1.5 text-[13px] font-semibold text-accent hover:underline"
                    >
                      Use prep + cook
                    </button>
                  ) : (
                    <p className="mt-1.5 text-[13px] text-muted">Calculated automatically</p>
                  ))}
                {errors[field] && <p className="field-error">{errors[field]?.message}</p>}
              </div>
            ))}
          </div>
        </FormSection>

        <FormSection
          title="Ingredients"
          hint="Quantity and unit are optional, for things like “salt, to taste”. Write quantities for one person; the app scales them to the family size. Nutrition is calculated from these lines."
        >
          <datalist id="units">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <div className="mb-2 hidden gap-2 pr-[104px] text-[13px] font-semibold text-muted sm:flex">
            <span className="w-20">Quantity</span>
            <span className="w-24">Unit</span>
            <span>Ingredient</span>
          </div>
          <ul className="space-y-2">
            {ingredients.fields.map((field, i) => {
              const rowErrors = errors.ingredients?.[i];
              return (
                <li key={field.id}>
                  <div className="flex items-start gap-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      placeholder="Qty"
                      aria-label={`Ingredient ${i + 1} quantity`}
                      {...register(`ingredients.${i}.quantity`, { setValueAs: toNumberOrNull })}
                      className="input w-20 shrink-0"
                    />
                    <input
                      list="units"
                      placeholder="Unit"
                      aria-label={`Ingredient ${i + 1} unit`}
                      {...register(`ingredients.${i}.unit`)}
                      className="input w-24 shrink-0"
                    />
                    <input
                      placeholder="e.g. onion, chopped"
                      aria-label={`Ingredient ${i + 1} name`}
                      {...register(`ingredients.${i}.name`)}
                      className="input min-w-0 flex-1"
                    />
                    <RowControls
                      index={i}
                      count={ingredients.fields.length}
                      onMove={ingredients.move}
                      onRemove={ingredients.remove}
                      label="ingredient"
                    />
                  </div>
                  {(rowErrors?.quantity || rowErrors?.unit || rowErrors?.name) && (
                    <p className="field-error">
                      {rowErrors.name?.message ?? rowErrors.quantity?.message ?? rowErrors.unit?.message}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          {listError(errors.ingredients) && <p className="field-error">{listError(errors.ingredients)}</p>}
          <button
            type="button"
            onClick={() => ingredients.append({ quantity: null, unit: "", name: "" })}
            className="btn-secondary mt-4"
          >
            <PlusIcon width={16} height={16} />
            Add ingredient
          </button>
        </FormSection>

        <FormSection
          title="Allergens"
          hint="Tick everything this recipe contains. The app hides it from people who filter out these allergens."
        >
          <fieldset>
            <legend className="sr-only">Allergens in this recipe</legend>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map((a) => (
                <label
                  key={a.id}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-medium transition select-none hover:border-muted/40 has-checked:border-accent has-checked:bg-leaf has-focus-visible:ring-3 has-focus-visible:ring-leaf"
                >
                  <input type="checkbox" value={a.id} {...register("allergens")} className="peer sr-only" />
                  <span
                    aria-hidden
                    className="flex h-4 w-4 items-center justify-center rounded border border-muted/50 bg-surface text-[11px] leading-none text-transparent peer-checked:border-accent peer-checked:bg-accent peer-checked:text-on-accent"
                  >
                    ✓
                  </span>
                  {a.label}
                </label>
              ))}
            </div>
          </fieldset>
          {errors.allergens && <p className="field-error">Choose allergens from the list.</p>}
        </FormSection>

        <FormSection title="Instructions" hint="One step per box, in the order you cook them.">
          <ol className="space-y-3">
            {steps.fields.map((field, i) => (
              <li key={field.id}>
                <div className="flex items-start gap-3">
                  <span className="font-display mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-leaf text-sm font-bold">
                    {i + 1}
                  </span>
                  <textarea
                    rows={2}
                    placeholder={`Describe step ${i + 1}`}
                    aria-label={`Step ${i + 1}`}
                    {...register(`steps.${i}.text`)}
                    className="input min-w-0 flex-1"
                  />
                  <RowControls
                    index={i}
                    count={steps.fields.length}
                    onMove={steps.move}
                    onRemove={steps.remove}
                    label="step"
                  />
                </div>
                {errors.steps?.[i]?.text && <p className="field-error ml-11">{errors.steps[i]?.text?.message}</p>}
              </li>
            ))}
          </ol>
          {listError(errors.steps) && <p className="field-error">{listError(errors.steps)}</p>}
          <button type="button" onClick={() => steps.append({ text: "" })} className="btn-secondary mt-4">
            <PlusIcon width={16} height={16} />
            Add step
          </button>
        </FormSection>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-line bg-background/90 px-4 py-4 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex items-center justify-end gap-3">
          <Link href={id ? `/recipes/${id}` : "/recipes"} className="btn-secondary">
            Cancel
          </Link>
          <button type="submit" disabled={isSubmitting} className="btn-primary min-w-36">
            {isSubmitting ? "Saving…" : id ? "Save changes" : "Save recipe"}
          </button>
        </div>
      </div>
    </form>
  );
}

function FormSection({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 py-8 first:pt-0 lg:grid-cols-[220px_1fr] lg:gap-10">
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{hint}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function RowControls({
  index,
  count,
  onMove,
  onRemove,
  label,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  label: string;
}) {
  const iconBtn =
    "flex h-[42px] w-8 items-center justify-center rounded-md text-muted transition hover:bg-leaf-soft hover:text-foreground disabled:pointer-events-none disabled:opacity-30";
  return (
    <div className="flex shrink-0">
      <button
        type="button"
        className={iconBtn}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        aria-label={`Move ${label} ${index + 1} up`}
      >
        <ArrowUpIcon width={16} height={16} />
      </button>
      <button
        type="button"
        className={iconBtn}
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
        aria-label={`Move ${label} ${index + 1} down`}
      >
        <ArrowDownIcon width={16} height={16} />
      </button>
      <button
        type="button"
        className={`${iconBtn} hover:!text-danger`}
        disabled={count === 1}
        onClick={() => onRemove(index)}
        aria-label={`Remove ${label} ${index + 1}`}
      >
        <XIcon width={16} height={16} />
      </button>
    </div>
  );
}
