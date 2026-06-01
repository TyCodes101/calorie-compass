import type { ParsedFoodItem } from '@/lib/ai/types';

const fixturePatterns = [
  /\bprod-live-[\w-]+\b/i,
  /\bqa[\s_-]+/i,
  /\btest[\s_-]*(fixture|meal|seed|user|data)\b/i,
  /\bseed(?:ed)?[\s_-]*(fixture|meal|data)\b/i,
];

const sentenceStarters = new Set(['a', 'an', 'the']);
const lowerCaseWords = new Set(['and', 'or', 'with', 'from', 'of', 'in']);
const brandOverrides: Array<[RegExp, string]> = [
  [/\bmcdonalds\b/gi, "McDonald's"],
  [/\bmcdouble\b/gi, 'McDouble'],
  [/\bwendys\b/gi, "Wendy's"],
  [/\bchipotle\b/gi, 'Chipotle'],
  [/\bfairlife\b/gi, 'Fairlife'],
  [/\busda\b/gi, 'USDA'],
  [/\bnfs\b/g, 'NFS'],
  [/\bsnickers\b/gi, 'Snickers'],
  [/\bskittles\b/gi, 'Skittles'],
];

function normalizeWhitespace(value: string) {
  return value.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function cleanFoodNameForDisplay(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value ?? '').replace(/\s+,/g, ',');
  if (!normalized) return '';

  const compact = normalized.toLowerCase();

  if (/candies,\s*mars snackfood us,\s*snickers/i.test(normalized) || /\bsnickers\b/i.test(normalized)) {
    return 'Snickers Bar';
  }

  if (/candies,\s*mars snackfood us,\s*skittles/i.test(normalized) || /\bskittles\b/i.test(normalized)) {
    return /sours?|sour/i.test(normalized) ? 'Skittles Sour Candy' : 'Skittles Candy';
  }

  if (/\bpeanut\b/i.test(normalized) && /\bm\s*(?:&|\/|\s)\s*m'?s?\b/i.test(normalized)) {
    return "Peanut M&M's";
  }

  if (/sun\s*chips/i.test(normalized) || /multigrain chips/i.test(compact)) {
    if (/sun\s*chips/i.test(normalized) || /\(sun chips\)/i.test(normalized)) {
      return 'Sun Chips Multigrain Chips';
    }
  }

  return normalized;
}

function titleCaseWord(word: string, index: number) {
  const lower = word.toLowerCase();
  if (index > 0 && lowerCaseWords.has(lower)) return lower;
  if (sentenceStarters.has(lower)) return index === 0 ? lower[0]?.toUpperCase() + lower.slice(1) : lower;
  if (/^[A-Z]{2,}$/.test(word)) return word;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function polishMealText(value: string | null | undefined) {
  const normalized = cleanFoodNameForDisplay(value);
  if (!normalized) return '';

  let polished = normalized
    .split(' ')
    .map(titleCaseWord)
    .join(' ')
    .replace(/\b(\d+(?:\.\d+)?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g, (_match, amount: string, name: string) => `${amount} ${name.toLowerCase()}`);

  for (const [pattern, replacement] of brandOverrides) {
    polished = polished.replace(pattern, replacement);
  }

  polished = polished
    .replace(/\b1\s+burger\s+(McDouble)\b/g, '$1')
    .replace(/\b(\d+(?:\.\d+)?)\s+large\s+egg\b/gi, (_match, amount: string) => `${amount} large ${amount === '1' ? 'egg' : 'eggs'}`);

  return polished.replace(/\s+,/g, ',').trim();
}

export function formatFoodItemForDisplay(item: Pick<ParsedFoodItem, 'food_name' | 'quantity' | 'unit'>) {
  const name = polishMealText(cleanFoodNameForDisplay(item.food_name));
  const quantity = Number.isFinite(item.quantity) ? item.quantity : null;
  const unit = item.unit?.trim().toLowerCase() ?? '';

  if (!quantity || quantity === 1) {
    return unit && !name.toLowerCase().includes(unit) ? `${polishMealText(unit)} ${name}` : name;
  }

  const formattedQuantity = Number.isInteger(quantity) ? `${quantity}` : `${Number(quantity.toFixed(1))}`;
  const pluralUnit = unit && quantity !== 1 && !unit.endsWith('s') ? `${unit}s` : unit;

  const lowerName = name.toLowerCase();
  const compactMetric = unit && /^(g|mg|oz|ml)$/.test(unit) ? `${formattedQuantity}${unit}` : null;

  if (pluralUnit && lowerName.includes(unit)) {
    const pluralizedName = name.replace(new RegExp(`\\b${unit}\\b`, 'i'), pluralUnit).toLowerCase();
    return compactMetric ? `${compactMetric} ${name}` : `${formattedQuantity} ${pluralizedName}`;
  }

  if (pluralUnit) {
    return compactMetric ? `${compactMetric} ${name}` : `${formattedQuantity} ${pluralUnit} ${name}`;
  }

  return `${formattedQuantity} ${name}`;
}

export function formatMealTitleForDisplay(rawText: string | null | undefined, items?: Array<Pick<ParsedFoodItem, 'food_name' | 'quantity' | 'unit'>>) {
  const raw = normalizeWhitespace(rawText ?? '');
  if (raw && !isFixtureMealText(raw)) {
    return polishMealText(raw);
  }

  const itemSummary = items?.map(formatFoodItemForDisplay).filter(Boolean).join(', ');
  return itemSummary || 'Saved meal';
}

export function isFixtureMealText(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value ?? '');
  return normalized ? fixturePatterns.some((pattern) => pattern.test(normalized)) : false;
}

export function isFixtureMealRecord(record: { rawText?: string | null; items?: Array<{ foodName?: string | null; food_name?: string | null }> }) {
  if (isFixtureMealText(record.rawText)) return true;
  return Boolean(record.items?.some((item) => isFixtureMealText(item.foodName ?? item.food_name ?? '')));
}
