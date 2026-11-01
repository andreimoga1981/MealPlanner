-- Newer Supabase projects don't grant table privileges to API roles by default.
-- Grant them explicitly to signed-in users; RLS policies still decide which rows
-- they can read and that only admins can write. Nothing is granted to anon.

grant usage on schema public to authenticated;

grant select on public.profiles to authenticated;

grant select, insert, update, delete on public.recipes to authenticated;
grant select, insert, update, delete on public.recipe_ingredients to authenticated;
grant select, insert, update, delete on public.recipe_steps to authenticated;

grant execute on function public.is_admin() to authenticated;
