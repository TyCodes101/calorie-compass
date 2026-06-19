import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import type { FoodIdentitySourceTrust } from '@/lib/nutrition/identity';
import {
  detectProductFamilies,
  getProductFamily,
  inferProductFamilyId,
  normalizeProductFamilyText,
} from '@/lib/nutrition/productFamilies';

export type FoodResolutionStatus = 'resolved' | 'needs_clarification' | 'needs_manual_entry' | 'unsupported';
export type FoodIdentityDecision = 'approved' | 'clarify' | 'reject';
export type FoodResolutionConfidence = 'high' | 'medium' | 'low';
export type FoodResolutionAiRole = 'none' | 'parser' | 'reranker' | 'estimator' | 'clarification';

export type FoodResolutionIntent = {
  rawText: string;
  searchText: string;
  restaurant?: string | null;
  brand?: string | null;
  modifiers?: string[];
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
};

export type FoodCandidate = {
  candidateId: string;
  provider: string;
  source: string;
  sourceTrust: FoodIdentitySourceTrust;
  restaurant?: string | null;
  brand?: string | null;
  productFamilyId?: string | null;
  canonicalName: string;
  displayName: string;
  sourceName?: string | null;
  serving: {
    quantity: number;
    unit: string;
  };
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  modifiersSupported: boolean;
  verified: boolean;
  estimated: boolean;
  lastReviewedAt?: string | null;
  catalogVersion?: string | null;
  rawSource?: unknown;
};

export type FoodCandidateProvider = {
  name: string;
  sourceTrust: FoodIdentitySourceTrust;
  supports: (intent: FoodResolutionIntent) => boolean;
  search: (intent: FoodResolutionIntent) => Promise<FoodCandidate[]> | FoodCandidate[];
};

export type FoodIdentityValidationResult = {
  decision: FoodIdentityDecision;
  reasons: string[];
  confidence: FoodResolutionConfidence;
  identityScore: number;
};

export type FoodResolutionProvenance = {
  provider: string;
  source: string;
  sourceName: string | null;
  sourceTrust: FoodIdentitySourceTrust;
  verified: boolean;
  estimated: boolean;
};

export type FoodResolutionDebugTrace = {
  parsedIntent: FoodResolutionIntent;
  providersSearched: string[];
  candidateCount: number;
  rejectedCandidateIds: string[];
  rejectionReasons: string[];
  selectedCandidateId: string | null;
  identityScore: number | null;
  sourceTrust: FoodIdentitySourceTrust | null;
  finalStatus: FoodResolutionStatus;
  llmUsed: boolean;
  llmResultAccepted: boolean;
  normalizedQuery: string;
  aiUsed: boolean;
  aiRole: FoodResolutionAiRole;
  aiResultAccepted: boolean;
};

export type FoodResolutionResult = {
  status: FoodResolutionStatus;
  intent: FoodResolutionIntent;
  normalizedQuery: string;
  candidates: FoodCandidate[];
  selectedCandidate: FoodCandidate | null;
  rejectedCandidates: FoodCandidate[];
  rejectionReasons: string[];
  confidence: FoodResolutionConfidence;
  sourceTrust: FoodIdentitySourceTrust | null;
  provenance: FoodResolutionProvenance | null;
  aiUsed: boolean;
  aiRole: FoodResolutionAiRole;
  debugTrace?: FoodResolutionDebugTrace;
};

type ResolveFoodCandidatesArgs = {
  intent: FoodResolutionIntent;
  candidates: FoodCandidate[];
  selectedCandidateId?: string | null;
  providersSearched?: string[];
  normalizedQuery?: string | null;
  aiUsed?: boolean;
  aiRole?: FoodResolutionAiRole;
  llmUsed?: boolean;
};

const trustScore: Record<FoodIdentitySourceTrust, number> = {
  official_restaurant: 100,
  manufacturer_label: 96,
  curated_brand: 92,
  usda_generic: 86,
  curated_generic: 82,
  commercial_verified: 78,
  usda_branded: 76,
  community: 52,
  ai_estimate: 28,
};

function normalized(value: string | null | undefined) {
  return normalizeProductFamilyText(value);
}

function sameIdentity(left: string | null | undefined, right: string | null | undefined) {
  const leftValue = normalized(left);
  const rightValue = normalized(right);
  return Boolean(leftValue && rightValue && leftValue === rightValue);
}

function candidateText(candidate: FoodCandidate) {
  return [
    candidate.canonicalName,
    candidate.displayName,
    candidate.sourceName,
    candidate.restaurant,
    candidate.brand,
    candidate.productFamilyId,
  ].filter(Boolean).join(' ');
}

function candidateFamily(candidate: FoodCandidate) {
  return getProductFamily(candidate.productFamilyId)
    ?? getProductFamily(inferProductFamilyId(candidate.canonicalName, candidate.displayName, candidate.sourceName ?? ''));
}

function intentFamilies(intent: FoodResolutionIntent) {
  return detectProductFamilies([
    intent.rawText,
    intent.searchText,
    intent.restaurant,
    intent.brand,
  ].filter(Boolean).join(' '));
}

function includesRequiredToken(text: string, token: string) {
  const normalizedText = normalized(text);
  const normalizedToken = normalized(token);
  if (!normalizedToken) return true;
  return normalizedText.split(' ').includes(normalizedToken);
}

function sourceTrustConfidence(candidate: FoodCandidate): FoodResolutionConfidence {
  const score = trustScore[candidate.sourceTrust] ?? 0;
  if (candidate.verified && score >= 86) return 'high';
  if (candidate.estimated || score < 70) return 'low';
  return 'medium';
}

function confidenceScore(confidence: FoodResolutionConfidence) {
  if (confidence === 'high') return 95;
  if (confidence === 'medium') return 78;
  return 45;
}

function mergeDecision(current: FoodIdentityDecision, next: FoodIdentityDecision) {
  if (current === 'reject' || next === 'reject') return 'reject';
  if (current === 'clarify' || next === 'clarify') return 'clarify';
  return 'approved';
}

export function validateFoodIdentity(
  intent: FoodResolutionIntent,
  selectedCandidate: FoodCandidate | null,
  candidateSet: FoodCandidate[],
): FoodIdentityValidationResult {
  const reasons: string[] = [];
  let decision: FoodIdentityDecision = 'approved';

  if (!selectedCandidate) {
    return {
      decision: candidateSet.length ? 'clarify' : 'reject',
      reasons: [candidateSet.length ? 'no_selected_candidate' : 'empty_candidate_set'],
      confidence: 'low',
      identityScore: 0,
    };
  }

  if (!candidateSet.some((candidate) => candidate.candidateId === selectedCandidate.candidateId)) {
    reasons.push('selected_candidate_not_in_candidate_set');
    decision = 'reject';
  }

  const intentRestaurant = intent.restaurant ?? null;
  const intentBrand = intent.brand ?? null;
  if (intentRestaurant && selectedCandidate.restaurant && !sameIdentity(intentRestaurant, selectedCandidate.restaurant)) {
    reasons.push('restaurant_conflict');
    decision = 'reject';
  }

  if (intentBrand && selectedCandidate.brand && !sameIdentity(intentBrand, selectedCandidate.brand)) {
    reasons.push('brand_conflict');
    decision = 'reject';
  }

  const protectedFamilies = intentFamilies(intent);
  const selectedFamily = candidateFamily(selectedCandidate);
  const selectedText = candidateText(selectedCandidate);

  for (const queryFamily of protectedFamilies) {
    if (!selectedFamily) {
      reasons.push(`missing_product_family:${queryFamily.id}`);
      decision = mergeDecision(decision, 'clarify');
      continue;
    }

    const familyMismatch = selectedFamily.id !== queryFamily.id;
    const explicitlyIncompatible = queryFamily.incompatibleFamilies.includes(selectedFamily.id)
      || selectedFamily.incompatibleFamilies.includes(queryFamily.id);

    if (familyMismatch && explicitlyIncompatible) {
      reasons.push('product_family_conflict');
      decision = 'reject';
    } else if (familyMismatch) {
      reasons.push('protected_product_family_mismatch');
      decision = mergeDecision(decision, 'clarify');
    }

    for (const requiredToken of queryFamily.requiredTokens) {
      if (!includesRequiredToken(selectedText, requiredToken)) {
        reasons.push(`missing_protected_product_token:${requiredToken}`);
        decision = familyMismatch ? 'reject' : mergeDecision(decision, 'clarify');
      }
    }
  }

  const normalizedModifiers = (intent.modifiers ?? []).map(normalized).filter(Boolean);
  if (normalizedModifiers.length && !selectedCandidate.modifiersSupported) {
    reasons.push('modifier_not_supported');
    decision = mergeDecision(decision, 'clarify');
  }

  const hasNoCheese = normalizedModifiers.some((modifier) => modifier === 'no cheese' || modifier === 'without cheese');
  if (hasNoCheese && selectedFamily?.id === 'mcdonalds_mcchicken') {
    reasons.push('modifier_applied_to_wrong_family');
    decision = 'reject';
  }

  if ((intentRestaurant || intentBrand) && selectedCandidate.estimated && selectedCandidate.sourceTrust === 'ai_estimate') {
    reasons.push('unverified_branded_or_restaurant_estimate');
    decision = mergeDecision(decision, 'clarify');
  }

  const confidence = sourceTrustConfidence(selectedCandidate);
  if (confidence === 'low') {
    reasons.push('low_confidence');
    if (decision === 'approved') {
      decision = 'clarify';
    }
  }

  return {
    decision,
    reasons: [...new Set(reasons)],
    confidence,
    identityScore: decision === 'approved' ? confidenceScore(confidence) : 0,
  };
}

function makeProvenance(candidate: FoodCandidate): FoodResolutionProvenance {
  return {
    provider: candidate.provider,
    source: candidate.source,
    sourceName: candidate.sourceName ?? null,
    sourceTrust: candidate.sourceTrust,
    verified: candidate.verified,
    estimated: candidate.estimated,
  };
}

function includeDebugTrace() {
  return process.env.NODE_ENV !== 'production';
}

function makeDebugTrace(args: {
  intent: FoodResolutionIntent;
  providersSearched: string[];
  candidates: FoodCandidate[];
  rejectedCandidates: FoodCandidate[];
  rejectionReasons: string[];
  selectedCandidate: FoodCandidate | null;
  validation: FoodIdentityValidationResult | null;
  status: FoodResolutionStatus;
  llmUsed: boolean;
  llmResultAccepted: boolean;
  normalizedQuery: string;
  aiUsed: boolean;
  aiRole: FoodResolutionAiRole;
}): FoodResolutionDebugTrace {
  return {
    parsedIntent: args.intent,
    providersSearched: args.providersSearched,
    candidateCount: args.candidates.length,
    rejectedCandidateIds: args.rejectedCandidates.map((candidate) => candidate.candidateId),
    rejectionReasons: args.rejectionReasons,
    selectedCandidateId: args.selectedCandidate?.candidateId ?? null,
    identityScore: args.validation?.identityScore ?? null,
    sourceTrust: args.selectedCandidate?.sourceTrust ?? null,
    finalStatus: args.status,
    llmUsed: args.llmUsed,
    llmResultAccepted: args.llmResultAccepted,
    normalizedQuery: args.normalizedQuery,
    aiUsed: args.aiUsed,
    aiRole: args.aiRole,
    aiResultAccepted: args.aiUsed ? args.llmResultAccepted : false,
  };
}

export function resolveFoodCandidates(args: ResolveFoodCandidatesArgs): FoodResolutionResult {
  const providersSearched = args.providersSearched ?? [...new Set(args.candidates.map((candidate) => candidate.provider))];
  const aiUsed = args.aiUsed ?? args.llmUsed ?? false;
  const llmUsed = aiUsed;
  const aiRole = args.aiRole ?? (aiUsed ? 'parser' : 'none');
  const normalizedQuery = args.normalizedQuery?.trim()
    || args.intent.searchText
    || args.intent.rawText;

  if (!args.candidates.length) {
    const status: FoodResolutionStatus = args.intent.restaurant || args.intent.brand ? 'needs_clarification' : 'needs_manual_entry';
    const result: FoodResolutionResult = {
      status,
      intent: args.intent,
      normalizedQuery,
      candidates: [],
      selectedCandidate: null,
      rejectedCandidates: [],
      rejectionReasons: ['empty_candidate_set'],
      confidence: 'low',
      sourceTrust: null,
      provenance: null,
      aiUsed,
      aiRole,
    };

    if (includeDebugTrace()) {
      result.debugTrace = makeDebugTrace({
        intent: args.intent,
        providersSearched,
        candidates: [],
        rejectedCandidates: [],
        rejectionReasons: result.rejectionReasons,
        selectedCandidate: null,
        validation: null,
        status,
        llmUsed,
        llmResultAccepted: false,
        normalizedQuery,
        aiUsed,
        aiRole,
      });
    }

    return result;
  }

  const selectedCandidate = args.selectedCandidateId
    ? args.candidates.find((candidate) => candidate.candidateId === args.selectedCandidateId) ?? null
    : args.candidates[0] ?? null;
  const aiSelectedUnknown = Boolean(aiUsed && args.selectedCandidateId && !selectedCandidate);
  const syntheticSelectedCandidate = selectedCandidate ?? (
    args.selectedCandidateId
      ? {
          ...args.candidates[0],
          candidateId: args.selectedCandidateId,
        }
      : null
  );

  const selectedValidation = validateFoodIdentity(args.intent, syntheticSelectedCandidate, args.candidates);
  const selectedAccepted = Boolean(selectedCandidate && selectedValidation.decision === 'approved');
  const candidateValidations = args.candidates.map((candidate) => ({
    candidate,
    validation: validateFoodIdentity(args.intent, candidate, args.candidates),
  }));

  const fallbackApproved = !aiUsed
    ? candidateValidations.find((entry) => entry.validation.decision === 'approved')
    : null;
  const resolvedCandidate = selectedAccepted
    ? selectedCandidate
    : fallbackApproved?.candidate ?? null;
  const resolvedValidation = selectedAccepted
    ? selectedValidation
    : fallbackApproved?.validation ?? null;
  const rejectedCandidates = candidateValidations
    .filter((entry) => entry.validation.decision !== 'approved' && entry.candidate.candidateId !== resolvedCandidate?.candidateId)
    .map((entry) => entry.candidate);
  const rejectionReasons = [
    ...(aiSelectedUnknown ? ['ai_candidate_not_in_candidate_set'] : []),
    ...selectedValidation.reasons,
    ...candidateValidations.flatMap((entry) => entry.validation.reasons),
  ];

  const status: FoodResolutionStatus = resolvedCandidate ? 'resolved' : 'needs_clarification';
  const result: FoodResolutionResult = {
    status,
    intent: args.intent,
    normalizedQuery,
    candidates: args.candidates,
    selectedCandidate: resolvedCandidate,
    rejectedCandidates,
    rejectionReasons: [...new Set(rejectionReasons)],
    confidence: resolvedValidation?.confidence ?? 'low',
    sourceTrust: resolvedCandidate?.sourceTrust ?? null,
    provenance: resolvedCandidate ? makeProvenance(resolvedCandidate) : null,
    aiUsed,
    aiRole,
  };

  if (includeDebugTrace()) {
    result.debugTrace = makeDebugTrace({
      intent: args.intent,
      providersSearched,
      candidates: args.candidates,
      rejectedCandidates,
      rejectionReasons: result.rejectionReasons,
      selectedCandidate: resolvedCandidate,
      validation: resolvedValidation,
      status,
      llmUsed,
      llmResultAccepted: llmUsed ? selectedAccepted : false,
      normalizedQuery,
      aiUsed,
      aiRole,
    });
  }

  return result;
}

export function parsedFoodItemToFoodCandidate(item: ParsedFoodItem, provider: string): FoodCandidate {
  const itemMetadata = item as ParsedFoodItem & {
    lastReviewedAt?: string | null;
    last_reviewed_at?: string | null;
    catalogVersion?: string | null;
    catalog_version?: string | null;
  };
  const sourceTrust: FoodIdentitySourceTrust = item.source_type === 'OFFICIAL_RESTAURANT'
    ? 'official_restaurant'
    : item.source_type === 'AI_ESTIMATE'
      ? 'ai_estimate'
      : item.source_name?.toLowerCase().includes('usda')
        ? 'usda_generic'
        : item.is_trusted
          ? 'curated_generic'
          : 'community';
  const familyId = inferProductFamilyId(
    item.catalog_food_id ?? '',
    item.canonical_name ?? '',
    item.display_name ?? '',
    item.food_name,
    item.source_name ?? '',
    item.matched_query ?? '',
  );

  return {
    candidateId: item.catalog_food_id ? `catalog:${item.catalog_food_id}` : `${provider}:${normalizeProductFamilyText(item.food_name)}`,
    provider,
    source: item.source_type ?? 'UNKNOWN',
    sourceTrust,
    restaurant: item.source_type === 'OFFICIAL_RESTAURANT' ? item.source_name?.replace(/\s+official nutrition$/i, '') ?? null : null,
    brand: item.source_type === 'OFFICIAL_RESTAURANT' ? item.source_name?.replace(/\s+official nutrition$/i, '') ?? null : null,
    productFamilyId: familyId,
    canonicalName: item.canonical_name ?? item.food_name,
    displayName: item.display_name ?? item.food_name,
    sourceName: item.source_name ?? null,
    serving: {
      quantity: item.quantity,
      unit: item.unit,
    },
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    modifiersSupported: true,
    verified: Boolean(item.is_trusted && item.source_type !== 'AI_ESTIMATE'),
    estimated: Boolean(item.used_ai_fallback || item.source_type === 'AI_ESTIMATE' || item.confidence_label === 'Estimated'),
    lastReviewedAt: itemMetadata.lastReviewedAt ?? itemMetadata.last_reviewed_at ?? null,
    catalogVersion: itemMetadata.catalogVersion ?? itemMetadata.catalog_version ?? null,
    rawSource: item,
  };
}

export function parsedMealResponseToFoodCandidates(response: ParsedMealResponse, provider: string) {
  return response.items.map((item) => parsedFoodItemToFoodCandidate(item, provider));
}
