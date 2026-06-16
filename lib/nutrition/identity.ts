const ignoredTokens = new Set([
  'a', 'an', 'and', 'at', 'from', 'had', 'i', 'my', 'of', 'please', 'the',
  'with', 'without', 'no', 'hold', 'order', 'serving', 'sandwich', 'burger',
  'sub', 'footlong', 'inch', 'inches', 'cheese', 'extra', 'grilled', 'buttered',
]);

const brandTokens = new Set([
  'arbys', 'chipotle', 'mcdonalds', 'subway', 'wendys', 'chickfila',
]);

const sourceTrustPoints: Record<FoodIdentitySourceTrust, number> = {
  official_restaurant: 15,
  manufacturer_label: 15,
  curated_brand: 14,
  usda_generic: 15,
  curated_generic: 13,
  commercial_verified: 12,
  usda_branded: 11,
  community: 7,
  ai_estimate: 2,
};

export type FoodIdentitySourceTrust =
  | 'official_restaurant'
  | 'manufacturer_label'
  | 'curated_brand'
  | 'usda_generic'
  | 'curated_generic'
  | 'commercial_verified'
  | 'usda_branded'
  | 'community'
  | 'ai_estimate';

export type FoodIdentityQuery = {
  text: string;
  restaurant?: string | null;
  brand?: string | null;
  modifiers?: string[];
  servingUnit?: string | null;
};

export type FoodIdentityCandidate = {
  id: string;
  name: string;
  restaurant?: string | null;
  brand?: string | null;
  modifiers?: string[];
  servingUnit?: string | null;
  sourceTrust: FoodIdentitySourceTrust;
  personalHistoryBoost?: number;
};

export type FoodIdentityScore = {
  candidateId: string;
  eligible: boolean;
  score: number;
  reasons: string[];
  matchedProductTokens: string[];
  missingProductTokens: string[];
};

export type FoodIdentityChoice = {
  candidate: FoodIdentityCandidate | null;
  scoredCandidates: Array<{ candidate: FoodIdentityCandidate; identity: FoodIdentityScore }>;
  confidence: 'high' | 'medium' | 'low';
  margin: number;
  shouldClarify: boolean;
};

export function normalizeIdentityText(text: string) {
  return text
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/\bbaconnator\b/g, 'baconator')
    .replace(/\bmc\s*double\b/g, 'mcdouble')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => index);
  for (let column = 1; column <= right.length; column += 1) {
    let previous = rows[0];
    rows[0] = column;
    for (let row = 1; row <= left.length; row += 1) {
      const current = rows[row];
      rows[row] = Math.min(
        rows[row] + 1,
        rows[row - 1] + 1,
        previous + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return rows[left.length];
}

export function identityProductTokens(text: string) {
  return normalizeIdentityText(text)
    .split(' ')
    .filter((token) => token.length > 1 && !ignoredTokens.has(token) && !brandTokens.has(token) && !/^\d+$/.test(token));
}

function tokenMatchDistance(query: string, candidate: string) {
  if (query === candidate) return 0;
  if (query.length < 4 || candidate.length < 4) return null;
  const distance = editDistance(query, candidate);
  return distance <= 1 ? distance : null;
}

function normalizedIdentity(value: string | null | undefined) {
  return normalizeIdentityText(value ?? '');
}

function hasCategoryConflict(queryTokens: string[], candidateTokens: string[]) {
  const queryHasChicken = queryTokens.includes('chicken');
  const queryHasBeefIdentity = queryTokens.some((token) => ['baconator', 'mcdouble', 'beef', 'whopper'].includes(token));
  const candidateHasChicken = candidateTokens.includes('chicken');
  const candidateHasBeefIdentity = candidateTokens.some((token) => ['baconator', 'mcdouble', 'beef', 'whopper'].includes(token));
  const queryWantsZero = queryTokens.includes('zero') || queryTokens.includes('diet');
  const candidateIsRegularSoda = candidateTokens.some((token) => ['classic', 'regular'].includes(token));

  return (queryHasBeefIdentity && candidateHasChicken)
    || (queryHasChicken && candidateHasBeefIdentity)
    || (queryWantsZero && candidateIsRegularSoda);
}

function hardConflict(
  reason: string,
  candidate: FoodIdentityCandidate,
  matchedProductTokens: string[] = [],
  missingProductTokens: string[] = [],
): FoodIdentityScore {
  return {
    candidateId: candidate.id,
    eligible: false,
    score: 0,
    reasons: [reason],
    matchedProductTokens,
    missingProductTokens,
  };
}

export function scoreFoodIdentity(query: FoodIdentityQuery, candidate: FoodIdentityCandidate): FoodIdentityScore {
  const reasons: string[] = [];
  const queryRestaurant = normalizedIdentity(query.restaurant);
  const candidateRestaurant = normalizedIdentity(candidate.restaurant);
  const queryBrand = normalizedIdentity(query.brand);
  const candidateBrand = normalizedIdentity(candidate.brand);

  if (queryRestaurant && candidateRestaurant && queryRestaurant !== candidateRestaurant) {
    return hardConflict('restaurant_conflict', candidate);
  }
  if (queryBrand && candidateBrand && queryBrand !== candidateBrand) {
    return hardConflict('brand_conflict', candidate);
  }

  const queryTokens = identityProductTokens(query.text);
  const candidateTokens = identityProductTokens(candidate.name);
  const matchedProductTokens: string[] = [];
  const missingProductTokens: string[] = [];
  let fuzzyMatches = 0;

  for (const queryToken of queryTokens) {
    const distances = candidateTokens
      .map((candidateToken) => tokenMatchDistance(queryToken, candidateToken))
      .filter((distance): distance is number => distance !== null);
    if (!distances.length) {
      missingProductTokens.push(queryToken);
      continue;
    }

    matchedProductTokens.push(queryToken);
    if (Math.min(...distances) > 0) fuzzyMatches += 1;
  }

  const requiredCoverage = queryTokens.length <= 2 ? 1 : 0.66;
  const productCoverage = queryTokens.length ? matchedProductTokens.length / queryTokens.length : 1;
  if (productCoverage < requiredCoverage || hasCategoryConflict(queryTokens, candidateTokens)) {
    return hardConflict('product_identity_conflict', candidate, matchedProductTokens, missingProductTokens);
  }

  const queryModifiers = (query.modifiers ?? []).map(normalizedIdentity).filter(Boolean);
  const candidateModifiers = (candidate.modifiers ?? []).map(normalizedIdentity).filter(Boolean);
  const hasOpposingCheeseModifier = (
    queryModifiers.includes('no cheese') && candidateModifiers.includes('extra cheese')
  ) || (
    queryModifiers.includes('extra cheese') && candidateModifiers.includes('no cheese')
  );
  if (hasOpposingCheeseModifier) {
    return hardConflict('modifier_conflict', candidate, matchedProductTokens, missingProductTokens);
  }

  let earned = productCoverage * 30;
  let possible = 30;

  possible += 15;
  earned += sourceTrustPoints[candidate.sourceTrust];

  const normalizedProductQuery = queryTokens.join(' ');
  const normalizedProductCandidate = candidateTokens.join(' ');
  possible += 5;
  if (normalizedProductQuery === normalizedProductCandidate) earned += 5;
  else if (normalizedProductCandidate.includes(normalizedProductQuery)) earned += 4;

  if (queryRestaurant) {
    possible += 20;
    if (queryRestaurant === candidateRestaurant) earned += 20;
    else reasons.push('restaurant_missing');
  }

  if (queryBrand) {
    possible += 15;
    if (queryBrand === candidateBrand) earned += 15;
    else reasons.push('brand_missing');
  }

  if (queryModifiers.length) {
    possible += 8;
    const modifierCoverage = queryModifiers.filter((modifier) => candidateModifiers.includes(modifier)).length / queryModifiers.length;
    earned += modifierCoverage * 8;
    if (modifierCoverage < 1) reasons.push('modifier_unverified');
  }

  if (query.servingUnit) {
    possible += 5;
    if (normalizedIdentity(query.servingUnit) === normalizedIdentity(candidate.servingUnit)) earned += 5;
    else reasons.push('serving_mismatch');
  }

  if (candidate.personalHistoryBoost) {
    possible += 2;
    earned += Math.min(2, Math.max(0, candidate.personalHistoryBoost));
  }

  const typoPenalty = Math.min(12, fuzzyMatches * 6);
  const score = Math.max(0, Math.min(100, Math.round((earned / possible) * 100 - typoPenalty)));
  if (fuzzyMatches) reasons.push('typo_match');
  if (!missingProductTokens.length) reasons.push('product_tokens_match');

  return {
    candidateId: candidate.id,
    eligible: true,
    score,
    reasons,
    matchedProductTokens,
    missingProductTokens,
  };
}

export function chooseIdentityCandidate(
  query: FoodIdentityQuery,
  candidates: FoodIdentityCandidate[],
): FoodIdentityChoice {
  const scoredCandidates = candidates
    .map((candidate) => ({ candidate, identity: scoreFoodIdentity(query, candidate) }))
    .filter((entry) => entry.identity.eligible)
    .sort((left, right) => right.identity.score - left.identity.score);
  const topScore = scoredCandidates[0]?.identity.score ?? 0;
  const runnerUpScore = scoredCandidates[1]?.identity.score ?? 0;
  const margin = scoredCandidates.length > 1 ? topScore - runnerUpScore : topScore;
  const confidence = topScore >= 85 && margin >= 15
    ? 'high'
    : topScore >= 72 && margin >= 8
      ? 'medium'
      : 'low';

  return {
    candidate: scoredCandidates[0]?.candidate ?? null,
    scoredCandidates,
    confidence,
    margin,
    shouldClarify: confidence === 'low' || !scoredCandidates.length,
  };
}

export function isIdentityCompatible(query: string, candidateText: string) {
  return scoreFoodIdentity(
    { text: query },
    {
      id: candidateText,
      name: candidateText,
      sourceTrust: 'curated_generic',
    },
  ).eligible;
}
