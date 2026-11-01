// Hosting dashboards make it easy to paste a value with spaces, quotes or a trailing slash.
const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();

// NEXT_PUBLIC_* values must be referenced literally so Next can inline them in the browser bundle.
export const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, "");
export const SUPABASE_KEY = clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const RECIPE_IMAGES_BUCKET = "recipe-images";

if (!SUPABASE_CONFIGURED) {
  console.warn(
    "Supabase env vars are missing. Copy apps/web/.env.example to apps/web/.env.local and fill them in.",
  );
}

/** Returns the storage path if the URL points at our recipe-images bucket, otherwise null. */
export function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${RECIPE_IMAGES_BUCKET}/`;
  return url.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
}
