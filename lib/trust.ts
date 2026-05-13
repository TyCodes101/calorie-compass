import type { ParsedFoodItem } from '@/lib/ai/types';

type TrustItemLike = Pick<
  ParsedFoodItem,
  'is_trusted' | 'source_type' | 'source_name' | 'food_name'
>;

export function isTrustedItem(item: TrustItemLike) {
  return Boolean(item.is_trusted) && item.source_type !== 'AI_ESTIMATE';
}

export function getItemSourceLabel(item: TrustItemLike) {
  if (item.source_type === 'OFFICIAL_RESTAURANT') {
    return item.source_name || 'Official nutrition';
  }

  if (item.source_type === 'GENERIC_REFERENCE') {
    return item.source_name === 'Generic nutrition reference' ? 'Generic reference' : item.source_name || 'Generic reference';
  }

  return 'Generic estimate';
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
