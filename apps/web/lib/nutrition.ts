import "server-only";
import type { NutritionStatus } from "@meal-planner/shared";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
// Tried in order; free-tier models are sometimes overloaded, so a busy model falls through to the next.
const DEFAULT_MODELS = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"];
const TIMEOUT_MS = 20_000;

export type NutritionResult = {
  carbs_g: number | null;
  fat_g: number | null;
  protein_g: number | null;
  status: Exclude<NutritionStatus, "pending">;
  skipped: string[];
  error: string | null;
};

type LineEstimate = {
  index: number;
  recognised: boolean;
  carbs_g: number;
  fat_g: number;
  protein_g: number;
};

class GeminiError extends Error {}
/** The model is busy, rate-limited or unavailable; another model may still work. */
class RetryableError extends GeminiError {}

function models(): string[] {
  const configured = (process.env.GEMINI_MODEL ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_MODELS;
}

const PROMPT = `You are a nutrition database. For each numbered ingredient line of a recipe, estimate the
carbohydrates, fat and protein in grams for the full quantity given, using standard food composition data
(e.g. USDA). Lines may be in any language. Assume raw/uncooked weight unless the line says otherwise, and a
typical size when a count is given (e.g. "2 eggs"). Set recognised to false, with zeros, when the line is not
a food you can identify or has no usable quantity. Return exactly one entry per line, using its index.`;

// Gemini's OpenAPI-style schema for structured output.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    ingredients: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          index: { type: "INTEGER" },
          recognised: { type: "BOOLEAN" },
          carbs_g: { type: "NUMBER" },
          fat_g: { type: "NUMBER" },
          protein_g: { type: "NUMBER" },
        },
        required: ["index", "recognised", "carbs_g", "fat_g", "protein_g"],
      },
    },
  },
  required: ["ingredients"],
};

async function estimateLines(model: string, title: string, lines: string[], apiKey: string): Promise<LineEstimate[]> {
  const numbered = lines.map((line, i) => `${i}. ${line}`).join("\n");

  const res = await fetch(`${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [{ text: `Recipe: ${title}\nIngredients:\n${numbered}` }],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  }).catch((err: unknown) => {
    if (err instanceof Error && err.name === "TimeoutError") throw new RetryableError("Gemini did not respond in time");
    throw err;
  });
  if (res.status === 400 || res.status === 403) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    const message = body?.error?.message ?? "";
    if (/api key/i.test(message)) throw new GeminiError("Gemini rejected the API key");
    throw new GeminiError(`Gemini returned ${res.status}${message ? `: ${message}` : ""}`);
  }
  if (res.status === 404) throw new RetryableError(`Gemini model "${model}" was not found`);
  if (res.status === 429) throw new RetryableError("Gemini request limit reached, try again later");
  if (res.status >= 500) throw new RetryableError("Gemini is busy, try again later");
  if (!res.ok) throw new GeminiError(`Gemini returned ${res.status}`);

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new GeminiError("Gemini returned no answer");
  try {
    return (JSON.parse(text) as { ingredients: LineEstimate[] }).ingredients ?? [];
  } catch {
    throw new GeminiError("Gemini returned an unreadable answer");
  }
}

async function estimateWithFallback(title: string, lines: string[], apiKey: string): Promise<LineEstimate[]> {
  let lastError: GeminiError | null = null;
  for (const model of models()) {
    try {
      return await estimateLines(model, title, lines, apiKey);
    } catch (err) {
      if (!(err instanceof RetryableError)) throw err;
      lastError = err;
    }
  }
  throw lastError!;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const grams = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

/** Whole-recipe carbs, fat and protein (grams) for the given ingredient lines. Never throws. */
export async function calculateNutrition(title: string, lines: string[]): Promise<NutritionResult> {
  const failed = (error: string): NutritionResult => ({
    carbs_g: null,
    fat_g: null,
    protein_g: null,
    status: "failed",
    skipped: [],
    error,
  });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return failed("Gemini is not configured (GEMINI_API_KEY)");
  if (lines.length === 0) return failed("The recipe has no ingredients");

  try {
    const estimates = await estimateWithFallback(title, lines, apiKey);
    const byIndex = new Map(estimates.map((e) => [e.index, e]));
    const totals = { carbs: 0, fat: 0, protein: 0 };
    const skipped: string[] = [];

    lines.forEach((line, i) => {
      const e = byIndex.get(i);
      if (!e?.recognised) {
        skipped.push(line);
        return;
      }
      totals.carbs += grams(e.carbs_g);
      totals.fat += grams(e.fat_g);
      totals.protein += grams(e.protein_g);
    });

    if (skipped.length === lines.length) return { ...failed("None of the ingredients were recognised"), skipped };
    return {
      carbs_g: round1(totals.carbs),
      fat_g: round1(totals.fat),
      protein_g: round1(totals.protein),
      status: skipped.length > 0 ? "partial" : "ok",
      skipped,
      error: null,
    };
  } catch (err) {
    const message = err instanceof GeminiError ? err.message : "Could not reach Gemini";
    return failed(message);
  }
}
