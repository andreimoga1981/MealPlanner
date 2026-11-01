-- Allergens (EU 14), servings, and nutrition calculated server-side from the ingredients.

alter table public.recipes
  add column allergens text[] not null default '{}'
    check (allergens <@ array[
      'gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soybeans', 'milk',
      'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'
    ]::text[]),
  add column servings int check (servings between 1 and 100),
  -- Whole-recipe totals in grams, written by the web admin after calling the nutrition API.
  add column carbs_g numeric(8, 1) check (carbs_g >= 0),
  add column fat_g numeric(8, 1) check (fat_g >= 0),
  add column protein_g numeric(8, 1) check (protein_g >= 0),
  add column nutrition_status text not null default 'pending'
    check (nutrition_status in ('pending', 'ok', 'partial', 'failed')),
  add column nutrition_skipped text[] not null default '{}',
  add column nutrition_error text,
  add column nutrition_updated_at timestamptz;

-- "Free from" filter: where not (allergens && array['milk', ...])
create index recipes_allergens_idx on public.recipes using gin (allergens);

-- save_recipe now also stores allergens and servings. Nutrition is never taken from
-- the payload: when the ingredient list changes it is reset to 'pending' and the
-- server recalculates it.
create or replace function public.save_recipe(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_allergens text[] := coalesce(
    array(select distinct jsonb_array_elements_text(coalesce(payload -> 'allergens', '[]'::jsonb))),
    '{}'
  );
  v_new_ingredients jsonb;
  v_old_ingredients jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can save recipes' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'quantity', (t.e ->> 'quantity')::numeric,
           'unit', coalesce(t.e ->> 'unit', ''),
           'name', t.e ->> 'name') order by t.ord), '[]'::jsonb)
  into v_new_ingredients
  from jsonb_array_elements(coalesce(payload -> 'ingredients', '[]'::jsonb)) with ordinality as t(e, ord);

  if v_id is null then
    insert into public.recipes (name, description, image_url, prep_minutes, cook_minutes, total_minutes, allergens, servings)
    values (
      payload ->> 'name',
      coalesce(payload ->> 'description', ''),
      payload ->> 'image_url',
      (payload ->> 'prep_minutes')::int,
      (payload ->> 'cook_minutes')::int,
      (payload ->> 'total_minutes')::int,
      v_allergens,
      (payload ->> 'servings')::int
    )
    returning id into v_id;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
             'quantity', i.quantity, 'unit', i.unit, 'name', i.name) order by i.position), '[]'::jsonb)
    into v_old_ingredients
    from public.recipe_ingredients i
    where i.recipe_id = v_id;

    update public.recipes set
      name = payload ->> 'name',
      description = coalesce(payload ->> 'description', ''),
      image_url = payload ->> 'image_url',
      prep_minutes = (payload ->> 'prep_minutes')::int,
      cook_minutes = (payload ->> 'cook_minutes')::int,
      total_minutes = (payload ->> 'total_minutes')::int,
      allergens = v_allergens,
      servings = (payload ->> 'servings')::int
    where id = v_id;

    if not found then
      raise exception 'Recipe % not found', v_id using errcode = 'P0002';
    end if;

    if v_old_ingredients is distinct from v_new_ingredients then
      update public.recipes set
        nutrition_status = 'pending',
        carbs_g = null,
        fat_g = null,
        protein_g = null,
        nutrition_skipped = '{}',
        nutrition_error = null
      where id = v_id;
    end if;

    delete from public.recipe_ingredients where recipe_id = v_id;
    delete from public.recipe_steps where recipe_id = v_id;
  end if;

  insert into public.recipe_ingredients (recipe_id, position, quantity, unit, name)
  select v_id, (t.ord - 1)::int, (t.e ->> 'quantity')::numeric, coalesce(t.e ->> 'unit', ''), t.e ->> 'name'
  from jsonb_array_elements(coalesce(payload -> 'ingredients', '[]'::jsonb)) with ordinality as t(e, ord);

  insert into public.recipe_steps (recipe_id, position, text)
  select v_id, (t.ord - 1)::int, t.e ->> 'text'
  from jsonb_array_elements(coalesce(payload -> 'steps', '[]'::jsonb)) with ordinality as t(e, ord);

  return v_id;
end;
$$;
