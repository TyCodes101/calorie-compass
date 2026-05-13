import type { ParsedFoodItem } from '@/lib/ai/types';

type TrustItemLike = Pick<
  ParsedFoodItem,
  'is_trusted' | 'source_type' | 'source_name' | 'food_name' | 'notes'
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
    return 'Nutritionix branded database';
  }

  if (textIncludes(item.source_name, ['usda'])) {
    return 'USDA food reference';
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

  if (item.source_type === 'AI_ESTIMATE' || !item.is_trusted) {
    return {
      badgeLabel: 'AI estimate',
      badgeTone: 'estimated',
      sourceLabel,
      confidenceLabel: 'Estimated, please review',
      helperText: 'Nutrition facts can vary by product and serving size.',
      trusted: false,
    };
  }

  if (
    item.source_type === 'OFFICIAL_RESTAURANT' ||
    textIncludes(item.source_name, ['user-provided nutrition label', 'open food facts']) ||
    textIncludes(item.notes, ['barcode match'])
  ) {
    return {
      badgeLabel: 'Verified product match',
      badgeTone: 'verified',
      sourceLabel,
      confidenceLabel: 'High confidence source match',
      helperText: 'Nutrition facts can vary slightly by serving size or product version.',
      trusted: true,
    };
  }

  if (
    item.source_type === 'GENERIC_REFERENCE' &&
    !textIncludes(item.source_name, ['generic nutrition reference', 'usda'])
  ) {
    return {
      badgeLabel: 'Branded food match',
      badgeTone: 'branded',
      sourceLabel,
      confidenceLabel: 'Branded database match',
      helperText: 'This is the closest branded match we found. Adjust if your product version differs.',
      trusted: true,
    };
  }

  return {
    badgeLabel: 'Generic estimate',
    badgeTone: 'generic',
    sourceLabel,
    confidenceLabel: 'Reference database match',
    helperText: 'Nutrition facts can vary by recipe and portion size.',
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
        ? `${trustedCount} of ${totalCount} foods matched trusted sources`
        : 'No foods matched yet',
    estimatedSummary:
      estimatedCount === 0
        ? 'All foods matched trusted sources'
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
