import OpenAI from 'openai';

import { MACROMESH_SYSTEM_PROMPT } from './prompt';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_BATCH_SIZE = 15;

const model = process.env.OPENAI_FOOD_MATCH_MODEL ?? 'gpt-4o-mini';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MacroSnapshot {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface SystemSignal {
  type:
    | "SYNONYM_SUGGESTION"
    | "SERVING_SIZE_GAP"
    | "CATEGORY_MISMATCH"
    | "MACRO_ANOMALY"
    | "BRAND_GAP"
    | "PARSE_ERROR";
  input_term: string | null;
  suggested_canonical: string | null;
  confidence: number;
  raw_output?: string | null;
}

// source_type values:
// "usda" — matched from USDA FoodData Central
// "branded" — matched from branded product catalog
// "user" — user-created entry
// "llm_confirmed"— LLM matched at confidence >= 0.72 (prohibition enforced below)
// "parse_error" — fallback only, never a real match
interface MatchResult {
  match_id: string | null;
  match_name: string | null;
  confidence: number;
  confidence_label: "Verified" | "Estimated" | "Low Confidence";
  source_type: "usda" | "branded" | "user" | "llm_confirmed" | "parse_error";
  serving_used: string | null;
  serving_grams: number | null;
  serving_approximated: boolean;
  preparation_assumed: string;
  flag:
    | "LOW_CONFIDENCE"
    | "AMBIGUOUS_PREPARATION"
    | "IMPLAUSIBLE_MACROS"
    | "NO_MATCH"
    | "SERVING_APPROXIMATED"
    | "USER_CONFIRMED"
    | null;
  flag_reason: string | null;
  macro_snapshot: MacroSnapshot;
  system_signal: SystemSignal | null;
}

interface BatchResponse {
  results: MatchResult[];
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

function buildSafeNoMatch(reason: string, rawOutput?: string): MatchResult {
  return {
    match_id: null,
    match_name: null,
    confidence: 0,
    confidence_label: "Low Confidence",
    source_type: "parse_error",
    serving_used: null,
    serving_grams: null,
    serving_approximated: false,
    preparation_assumed: "unknown",
    flag: "NO_MATCH",
    flag_reason: reason,
    macro_snapshot: {
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
    },
    system_signal: {
      type: "PARSE_ERROR",
      input_term: null,
      suggested_canonical: null,
      confidence: 0,
      raw_output: rawOutput?.slice(0, 200) ?? null,
    },
  };
}

// ─── Core match call ──────────────────────────────────────────────────────────

async function runMatch(payload: unknown): Promise<MatchResult | BatchResponse> {
  let rawOutput = "";

  try {
    if (!process.env.OPENAI_API_KEY) {
      return buildSafeNoMatch('Missing OPENAI_API_KEY');
    }

    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: MACROMESH_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    });

    rawOutput = completion.choices[0]?.message?.content ?? '';

    const cleaned = rawOutput
      .replace(/^```(?:json)?\n?/i, "")
      .replace(/\n?```$/i, "")
      .trim();

    return JSON.parse(cleaned) as MatchResult | BatchResponse;
  } catch (err) {
    console.error("[food-match] runMatch error:", err, "\nRaw output:", rawOutput);
    return buildSafeNoMatch("LLM output parse failure", rawOutput);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  try {
    const payload = await req.json();

    const isBatch = Array.isArray(payload?.batch) && payload.batch.length > 0;

    if (isBatch && payload.batch.length > MAX_BATCH_SIZE) {
      const chunks: unknown[][] = [];
      for (let i = 0; i < payload.batch.length; i += MAX_BATCH_SIZE) {
        chunks.push(payload.batch.slice(i, i + MAX_BATCH_SIZE));
      }

      const allResults: MatchResult[] = [];

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunkPayload = { ...payload, batch: chunks[chunkIndex] };
        const chunkResult = await runMatch(chunkPayload);

        const chunkResults: MatchResult[] =
          "results" in chunkResult
            ? chunkResult.results
            : [chunkResult as MatchResult];

        if (chunkIndex === 0 && chunkResults.length > 0) {
          chunkResults[0] = {
            ...chunkResults[0],
            system_signal: {
              type: "PARSE_ERROR",
              input_term: "batch_size",
              suggested_canonical: null,
              confidence: 0,
              raw_output: `Batch exceeded ${MAX_BATCH_SIZE} items (${payload.batch.length} received). Chunked automatically.`,
            },
          };
        }

        allResults.push(...chunkResults);
      }

      return Response.json({ results: allResults });
    }

    const result = await runMatch(payload);
    return Response.json(result);
  } catch (err) {
    console.error("[food-match] route handler error:", err);
    return Response.json(buildSafeNoMatch("Route handler error"), {
      status: 500,
    });
  }
}
