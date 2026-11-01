# Meal Planner

Monorepo for the Meal Planner:

| Path | What |
|---|---|
| `apps/web` | Web admin (Next.js 16): log in, list, add, edit and delete recipes |
| `packages/shared` | Recipe schema (zod) and types, shared with the future iPhone app |
| `supabase/` | Database migration (tables, admin role, RLS, image bucket) and sample data |

The iPhone app (Expo) will be added later as `apps/mobile` and will read the same Supabase data.

## First-time setup

1. **Create a Supabase project** at <https://supabase.com> (the free tier is fine).
2. **Create the database:** open *SQL Editor*, then paste and run `supabase/migrations/0001_init.sql`, then `0002_grants.sql`, `0003_allergens_nutrition.sql` and `0004_drop_servings.sql` (all in `supabase/migrations/`, in that order).
   Optionally run `supabase/seed.sql` to add two sample recipes.
3. **Create your admin user:** go to *Authentication → Users → Add user → Create new user*, enter an email and password, and tick *Auto Confirm User*.
   Then run this in the SQL Editor:
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'you@example.com');
   ```
4. **Turn off public sign-ups** (recommended): *Authentication → Sign In / Providers → Allow new users to sign up* → off.
5. **Configure the web app:**
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   # fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
   # (Project Settings → API Keys), and GEMINI_API_KEY
   # (aistudio.google.com/apikey → Create API key; free tier)
   ```
6. **Run it:**
   ```bash
   npm install
   npm run dev       # http://localhost:3000
   ```

## How it works

- **Login:** Supabase Auth with email and password. `apps/web/proxy.ts` sends signed-out visitors to `/login`, and every page and server action calls `requireAdmin()` (`apps/web/lib/auth.ts`). Accounts without `is_admin` are rejected.
- **Saving a recipe:** the form validates with the shared zod schema, uploads a photo (if one was chosen) straight to the `recipe-images` storage bucket, then calls the `saveRecipe` server action. That action validates again and calls the `save_recipe` Postgres function, which writes the recipe, ingredients and steps in a single transaction.
- **Security:** row-level security lets any signed-in user read recipes (for the phone app later), but only admins can insert, update or delete them. The same rule applies to photo uploads.
- **Allergens:** each recipe is tagged with any of the EU 14 allergens. The "Free from" filter on My recipes hides recipes that contain the selected allergens; the mobile app will use the same query.
- **Nutrition:** carbohydrates, fat and protein are never typed in. When a recipe is saved with new or changed ingredients, the server sends the ingredient lines to Google Gemini, which estimates each line, and stores whole-recipe totals. Values are AI estimates, not lab data. Lines Gemini can't recognise are listed on the recipe page, and **Recalculate** re-runs the calculation. Recipes are written for **one person**; the mobile app scales ingredients and macros to the number of family members (`scaleIngredients` / `macrosForPeople` / `sumMacros` in `packages/shared`).
- **Photos:** a photo can be uploaded from your computer (up to 5 MB) or pasted as a URL. Uploaded photos are deleted from storage when the recipe is deleted or its photo is replaced.

## Scripts

```bash
npm run dev     # start the web admin
npm run build   # production build
npm run lint
```
