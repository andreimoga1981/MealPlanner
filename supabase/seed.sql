-- Optional sample data. Run once in the Supabase SQL editor after the migration.
-- (The SQL editor runs as the database owner, so RLS does not block these inserts.)
-- Requires migrations 0001-0004. Quantities are for one person. Nutrition starts as 'pending': open each recipe and click Recalculate.

with r as (
  insert into public.recipes (name, description, image_url, prep_minutes, cook_minutes, total_minutes, allergens)
  values (
    'Spaghetti Aglio e Olio',
    'A quick Italian pasta with garlic, olive oil and chili.',
    'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=1200',
    5, 12, 17, '{gluten}'
  )
  returning id
),
i as (
  insert into public.recipe_ingredients (recipe_id, position, quantity, unit, name)
  select r.id, v.pos, v.qty, v.unit, v.name from r, (values
    (0, 100::numeric, 'g', 'spaghetti'),
    (1, 2, 'cloves', 'garlic, thinly sliced'),
    (2, 30, 'ml', 'extra virgin olive oil'),
    (3, 0.5, 'tsp', 'chili flakes'),
    (4, null, '', 'parsley, chopped')
  ) as v(pos, qty, unit, name)
)
insert into public.recipe_steps (recipe_id, position, text)
select r.id, v.pos, v.text from r, (values
  (0, 'Cook the spaghetti in salted boiling water until al dente.'),
  (1, 'Meanwhile, gently fry the garlic in the olive oil until golden. Add the chili flakes.'),
  (2, 'Toss the drained pasta in the oil with a splash of pasta water. Finish with parsley.')
) as v(pos, text);

with r as (
  insert into public.recipes (name, description, image_url, prep_minutes, cook_minutes, total_minutes, allergens)
  values (
    'Greek Salad',
    'Fresh tomatoes, cucumber, olives and feta.',
    'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=1200',
    15, 0, 15, '{milk}'
  )
  returning id
),
i as (
  insert into public.recipe_ingredients (recipe_id, position, quantity, unit, name)
  select r.id, v.pos, v.qty, v.unit, v.name from r, (values
    (0, 1.5::numeric, '', 'tomatoes'),
    (1, 0.5, '', 'cucumber'),
    (2, 50, 'g', 'feta'),
    (3, 6, '', 'kalamata olives'),
    (4, 1, 'tbsp', 'olive oil')
  ) as v(pos, qty, unit, name)
)
insert into public.recipe_steps (recipe_id, position, text)
select r.id, v.pos, v.text from r, (values
  (0, 'Chop the tomatoes and cucumber into chunks.'),
  (1, 'Add olives and top with a slab of feta.'),
  (2, 'Drizzle with olive oil and season with oregano, salt and pepper.')
) as v(pos, text);
