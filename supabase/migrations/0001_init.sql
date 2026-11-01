-- Meal Planner: recipes schema, admin role, RLS and image storage.

-- ---------------------------------------------------------------------------
-- Profiles & admin role
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile. Nobody can change is_admin through the API;
-- it is set by a developer in the SQL editor.
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = auth.uid());

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- Recipes
-- ---------------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  description text not null default '',
  image_url text,
  prep_minutes int check (prep_minutes >= 0),
  cook_minutes int check (cook_minutes >= 0),
  total_minutes int check (total_minutes >= 0),
  created_by uuid references auth.users (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_created_at_idx on public.recipes (created_at desc);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position int not null,
  quantity numeric check (quantity > 0),
  unit text not null default '',
  name text not null check (char_length(name) >= 1)
);

create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);

create table public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  position int not null,
  text text not null check (char_length(text) >= 1)
);

create index recipe_steps_recipe_idx on public.recipe_steps (recipe_id, position);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

-- RLS: any signed-in user can read (the phone app), only admins can write.
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;

create policy "recipes: read" on public.recipes
  for select to authenticated using (true);
create policy "recipes: admin write" on public.recipes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "ingredients: read" on public.recipe_ingredients
  for select to authenticated using (true);
create policy "ingredients: admin write" on public.recipe_ingredients
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "steps: read" on public.recipe_steps
  for select to authenticated using (true);
create policy "steps: admin write" on public.recipe_steps
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- save_recipe: create or update a recipe with its ingredients and steps in
-- one transaction. Runs as the caller, so the RLS policies above still apply.
-- ---------------------------------------------------------------------------
create function public.save_recipe(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can save recipes' using errcode = '42501';
  end if;

  if v_id is null then
    insert into public.recipes (name, description, image_url, prep_minutes, cook_minutes, total_minutes)
    values (
      payload ->> 'name',
      coalesce(payload ->> 'description', ''),
      payload ->> 'image_url',
      (payload ->> 'prep_minutes')::int,
      (payload ->> 'cook_minutes')::int,
      (payload ->> 'total_minutes')::int
    )
    returning id into v_id;
  else
    update public.recipes set
      name = payload ->> 'name',
      description = coalesce(payload ->> 'description', ''),
      image_url = payload ->> 'image_url',
      prep_minutes = (payload ->> 'prep_minutes')::int,
      cook_minutes = (payload ->> 'cook_minutes')::int,
      total_minutes = (payload ->> 'total_minutes')::int
    where id = v_id;

    if not found then
      raise exception 'Recipe % not found', v_id using errcode = 'P0002';
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

revoke execute on function public.save_recipe(jsonb) from anon, public;
grant execute on function public.save_recipe(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: public-read bucket for recipe photos, admin-only writes.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recipe-images',
  'recipe-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
);

create policy "recipe-images: admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipe-images' and public.is_admin());
create policy "recipe-images: admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'recipe-images' and public.is_admin());
create policy "recipe-images: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recipe-images' and public.is_admin());
