import type { ParsedFoodItem } from '@/lib/ai/types';

type TrustItemLike = Pick<
  ParsedFoodItem,
  'is_trusted' | 'source_type' | 'source_name' | 'food_name' | 'notes' | 'confidence_label' | 'matched_query'
>;

export type ItemTrustPresentation = {
  badgeLabel: string;
  badgeTone: 'verified' | 'branded' | 'generic' | 'estimated';
  sourceLabel: string;
  confidenceLabel: string;
  helperText: string;
  trusted: boolean;
};

function textIncludes(value: string | null | undefined, fragments: string[]) {
  const normalized = value?.toLowerCase() ?? '';
  return fragments.some((fragment) => normalized.includes(fragment));
}

export function isTrustedItem(item: TrustItemLike) {
  return Boolean(item.is_trusted) && item.source_type !== 'AI_ESTIMATE';
}

export function getItemSourceLabel(item: TrustItemLike) {
  const cleanedSourceName = item.source_name?.replace(/\s*·\s*high-confidence product match/i, '').trim() ?? null;

  if (textIncludes(item.source_name, ['user-provided nutrition label'])) {
    return 'User-provided nutrition label';
  }

  if (textIncludes(item.source_name, ['open food facts'])) {
    return 'Open Food Facts package match';
  }

  if (textIncludes(item.source_name, ['nutritionix'])) {
    return 'Nutritionix';
  }

  if (textIncludes(item.source_name, ['usda'])) {
    return 'USDA FoodData Central';
  }

  if (item.source_type === 'OFFICIAL_RESTAURANT') {
    return 'Official nutrition';
  }

  if (item.source_type === 'GENERIC_REFERENCE') {
    return cleanedSourceName === 'Generic nutrition reference' ? 'Generic reference' : cleanedSourceName || 'Generic reference';
  }

  return 'AI estimate';
}

export function getItemTrustPresentation(item: TrustItemLike): ItemTrustPresentation {
  const sourceLabel = getItemSourceLabel(item);

  const explicitConfidence = item.confidence_label ?? null;

  if (item.source_type === 'AI_ESTIMATE' || !item.is_trusted) {
    return {
      badgeLabel: explicitConfidence ?? 'Estimated',
      badgeTone: 'estimated',
      sourceLabel,
      confidenceLabel: 'Estimated, please review',
      helperText: 'Estimated from the best available details. Review only if the portion or product was different.',
      trusted: false,
    };
  }

  if (
    item.source_type === 'OFFICIAL_RESTAURANT' ||
    textIncludes(item.source_name, ['user-provided nutrition label', 'open food facts']) ||
    textIncludes(item.notes, ['barcode match'])
  ) {
    return {
      badgeLabel: 'Verified',
      badgeTone: 'verified',
      sourceLabel,
      confidenceLabel: explicitConfidence ?? 'Verified match',
      helperText: 'Matched to structured nutrition data. Adjust only if your serving or product version differed.',
      trusted: true,
    };
  }

  if (textIncludes(item.source_name, ['usda'])) {
    return {
      badgeLabel: 'USDA',
      badgeTone: 'generic',
      sourceLabel,
      confidenceLabel: explicitConfidence ?? 'High confidence database match',
      helperText: 'This came from USDA FoodData Central. Adjust if your portion differed.',
      trusted: true,
    };
  }

  if (textIncludes(item.source_name, ['nutritionix'])) {
    return {
      badgeLabel: 'Branded database',
      badgeTone: 'branded',
      sourceLabel,
      confidenceLabel: explicitConfidence ?? 'High confidence database match',
      helperText: 'This came from a branded food database match. Adjust if your product version differs.',
      trusted: true,
    };
  }

  if (
    item.source_type === 'GENERIC_REFERENCE' &&
    !textIncludes(item.source_name, ['generic nutrition reference'])
  ) {
    return {
      badgeLabel: 'Branded database',
      badgeTone: 'branded',
      sourceLabel,
      confidenceLabel: explicitConfidence ?? 'High confidence match',
      helperText: 'Closest structured product match. You can adjust it if your exact version differs.',
      trusted: true,
    };
  }

  return {
    badgeLabel: explicitConfidence ?? 'Verified',
    badgeTone: 'generic',
    sourceLabel,
    confidenceLabel: explicitConfidence ?? 'High confidence match',
    helperText: 'Structured reference match. Portion and recipe differences can still change totals.',
    trusted: true,
  };
}

export function summarizeParsedItems(items: TrustItemLike[]) {
  const trustedCount = items.filter(isTrustedItem).length;
  const estimatedCount = items.length - trustedCount;
  return summarizeTrustCounts(trustedCount, estimatedCount);
}

export function summarizeTrustCounts(trustedCount: number, estimatedCount: number) {
  const totalCount = trustedCount + estimatedCount;
  const coveragePercent = totalCount ? Math.round((trustedCount / totalCount) * 100) : 0;

  return {
    trustedCount,
    estimatedCount,
    totalCount,
    coveragePercent,
    coverageSummary:
      totalCount > 0
        ? estimatedCount === 0
          ? 'All foods matched structured sources'
          : `${trustedCount} of ${totalCount} foods matched structured sources`
        : 'No foods matched yet',
    estimatedSummary:
      estimatedCount === 0
        ? 'No estimated items'
        : `${estimatedCount} ${estimatedCount === 1 ? 'food' : 'foods'} estimated`,
  };
}

export function summarizeStoredItems(
  items: Array<{ nutritionSourceType: 'OFFICIAL_RESTAURANT' | 'GENERIC_REFERENCE' | 'AI_ESTIMATE' | null }>
) {
  const trustedCount = items.filter((item) => item.nutritionSourceType && item.nutritionSourceType !== 'AI_ESTIMATE').length;
  const estimatedCount = items.length - trustedCount;

  return summarizeTrustCounts(trustedCount, estimatedCount);
}

export function getConfidenceCopy(score: number) {
  if (score >= 0.85) {
    return {
      title: 'High confidence meal analysis',
      description: 'Specific details and trusted matches made this meal easier to verify quickly.',
    };
  }

  if (score >= 0.65) {
    return {
      title: 'Solid meal analysis',
      description: 'Most of this meal looks trustworthy, with a little estimation still mixed in.',
    };
  }

  return {
    title: 'More detail would help',
    description: 'A few ingredients or portions are still estimated, so a quick edit may improve accuracy.',
  };
}
