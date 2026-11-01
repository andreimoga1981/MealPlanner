-- Recipes are always written for one person; the mobile app scales them to the
-- number of family members. The servings column is no longer needed.

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
    insert into public.recipes (name, description, image_url, prep_minutes, cook_minutes, total_minutes, allergens)
    values (
      payload ->> 'name',
      coalesce(payload ->> 'description', ''),
      payload ->> 'image_url',
      (payload ->> 'prep_minutes')::int,
      (payload ->> 'cook_minutes')::int,
      (payload ->> 'total_minutes')::int,
      v_allergens
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
      allergens = v_allergens
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

alter table public.recipes drop column if exists servings;
