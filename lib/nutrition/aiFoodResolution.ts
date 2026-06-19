import { z } from 'zod';

import {
  resolveFoodCandidates,
  type FoodCandidate,
  type FoodResolutionIntent,
  type FoodResolutionResult,
} from '@/lib/nutrition/foodResolution';

const nullableTextSchema = z.string().trim().min(1).nullable().default(null);

const aiFoodResolutionIntentSchema = z.object({
  rawText: z.string().trim().min(1),
  searchText: z.string().trim().min(1),
  restaurant: nullableTextSchema.optional(),
  brand: nullableTextSchema.optional(),
  modifiers: z.array(z.string().trim().min(1)).default([]),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
});

export const aiFoodResolutionAssistSchema = z.object({
  intent: aiFoodResolutionIntentSchema,
  normalizedQuery: z.string().trim().min(1),
  restaurant: nullableTextSchema.optional(),
  brand: nullableTextSchema.optional(),
  productName: nullableTextSchema.optional(),
  productFamilyGuess: nullableTextSchema.optional(),
  modifiers: z.array(z.string().trim().min(1)).default([]),
  quantity: z.number().positive().nullable().optional(),
  serving: nullableTextSchema.optional(),
  candidateRankings: z.array(z.object({
    candidateId: z.string().trim().min(1),
    reason: z.string().trim().min(1),
    confidence: z.number().min(0).max(1),
  })).default([]),
  clarificationQuestion: z.string().trim().min(1).nullable().optional(),
  estimateRequest: z.object({
    reason: z.string().trim().min(1),
    label: z.enum(['Estimated', 'AI Estimated']).default('AI Estimated'),
  }).nullable().optional(),
});

export type AiFoodResolutionAssist = z.infer<typeof aiFoodResolutionAssistSchema>;

type ResolveAiFoodResolutionAssistArgs = {
  assist: AiFoodResolutionAssist;
  candidates: FoodCandidate[];
  intent?: FoodResolutionIntent;
  providersSearched?: string[];
};

function intentFromAssist(assist: AiFoodResolutionAssist): FoodResolutionIntent {
  return {
    rawText: assist.intent.rawText,
    searchText: assist.intent.searchText || assist.normalizedQuery,
    restaurant: assist.restaurant ?? assist.intent.restaurant ?? null,
    brand: assist.brand ?? assist.intent.brand ?? assist.restaurant ?? assist.intent.restaurant ?? null,
    modifiers: [...new Set([...(assist.intent.modifiers ?? []), ...assist.modifiers])],
    mealType: assist.intent.mealType,
  };
}

function selectedCandidateIdFromAssist(assist: AiFoodResolutionAssist, candidates: FoodCandidate[]) {
  const candidateIds = new Set(candidates.map((candidate) => candidate.candidateId));
  const unknownRanking = assist.candidateRankings.find((ranking) => !candidateIds.has(ranking.candidateId));
  if (unknownRanking) return unknownRanking.candidateId;

  return assist.candidateRankings.find((ranking) => candidateIds.has(ranking.candidateId))?.candidateId ?? null;
}

export function resolveAiFoodResolutionAssist(args: ResolveAiFoodResolutionAssistArgs): FoodResolutionResult {
  const intent = args.intent ?? intentFromAssist(args.assist);
  const selectedCandidateId = selectedCandidateIdFromAssist(args.assist, args.candidates);

  return resolveFoodCandidates({
    intent,
    candidates: args.candidates,
    selectedCandidateId,
    providersSearched: args.providersSearched,
    normalizedQuery: args.assist.normalizedQuery,
    aiUsed: true,
    aiRole: args.assist.estimateRequest ? 'estimator' : 'reranker',
  });
}
