import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ParsedFoodItem } from '@/lib/ai/types';
import { runMealAssistant } from '@/lib/ai/runMealAssistant';
import type { MealAssistantState } from '@/lib/ai/mealAssistantSchema';

type BenchmarkCategory = 'branded' | 'restaurant' | 'grocery' | 'typo' | 'correction';
type ExpectedCategory = 'branded' | 'restaurant' | 'generic';

type BenchmarkCase = {
  name: string;
  category: BenchmarkCategory;
  prompt: string;
  expectedIdentity: string;
  expectedCategory: ExpectedCategory;
  turns?: string[];
};

type BenchmarkResult = {
  name: string;
  category: BenchmarkCategory;
  prompt: string;
  expectedIdentity: string;
  actualIdentity: string;
  expectedCategory: ExpectedCategory;
  actualCategory: 'branded' | 'restaurant' | 'generic' | 'estimated' | 'unknown';
  sourceUsed: string | null;
  confidenceLabel: string | null;
  matchType: 'exact' | 'fuzzy' | 'generic' | 'estimated' | 'miss';
  passed: boolean;
  notes: string;
};

const benchmarkCases: BenchmarkCase[] = [
  // 25 branded foods
  ['Quest BBQ Protein Chips', 'Quest BBQ Protein Chips'],
  ['Quest Nacho Cheese Protein Chips', 'Quest Nacho Cheese Protein Chips'],
  ['Fairlife Core Power Chocolate', 'Fairlife Core Power Chocolate'],
  ['Fairlife Nutrition Plan Chocolate', 'Fairlife Nutrition Plan Chocolate'],
  ['Premier Protein Chocolate Shake', 'Premier Protein Chocolate Shake'],
  ['David Sunflower Seeds', 'David Sunflower Seeds'],
  ['Chobani Greek Yogurt Strawberry', 'Chobani Greek Yogurt Strawberry'],
  ['Oikos Triple Zero Vanilla', 'Oikos Triple Zero Vanilla'],
  ['Kodiak Cakes Protein Pancake Mix', 'Kodiak Cakes Protein Pancake Mix'],
  ['Coke Zero', 'Coke Zero'],
  ['Dr Pepper Zero', 'Dr Pepper Zero'],
  ['Doritos Nacho Cheese', 'Doritos Nacho Cheese'],
  ['Goldfish Crackers', 'Goldfish Crackers'],
  ['Barebells Protein Bar', 'Barebells Protein Bar'],
  ['Legendary Foods Protein Pastry', 'Legendary Foods Protein Pastry'],
  ['Pure Protein Bar', 'Pure Protein Bar'],
  ['Nature Valley Granola Bar', 'Nature Valley Granola Bar'],
  ['Quaker Rice Cakes', 'Quaker Rice Cakes'],
  ['Gatorade Zero', 'Gatorade Zero'],
  ['Celsius Energy Drink', 'Celsius Energy Drink'],
  ['Pop-Tarts Frosted Strawberry', 'Pop-Tarts Frosted Strawberry'],
  ['Cheez-It Original', 'Cheez-It Original'],
  ['Clif Bar Chocolate Chip', 'Clif Bar Chocolate Chip'],
  ['RXBAR Chocolate Sea Salt', 'RXBAR Chocolate Sea Salt'],
  ['Muscle Milk Protein Shake', 'Muscle Milk Protein Shake'],
  // 25 restaurant foods
  ["McDonald's Big Mac", "McDonald's Big Mac", 'restaurant'],
  ["McDonald's McChicken", "McDonald's McChicken", 'restaurant'],
  ["McDonald's medium fries", "McDonald's Medium Fries", 'restaurant'],
  ['Chick-fil-A 12 count nuggets', 'Chick-fil-A 12 count nuggets', 'restaurant'],
  ['Chick-fil-A spicy deluxe sandwich', 'Chick-fil-A Spicy Deluxe Sandwich', 'restaurant'],
  ['Chipotle chicken bowl', 'Chipotle Chicken Bowl', 'restaurant'],
  ['Chipotle burrito with chicken', 'Chipotle Chicken Burrito', 'restaurant'],
  ['Starbucks venti iced vanilla latte', 'Starbucks Venti Iced Vanilla Latte', 'restaurant'],
  ['Starbucks grande pink drink', 'Starbucks Grande Pink Drink', 'restaurant'],
  ['Dunkin cold brew', 'Dunkin Cold Brew', 'restaurant'],
  ['Dunkin wake-up wrap', 'Dunkin Wake-Up Wrap', 'restaurant'],
  ['Taco Bell Crunchwrap Supreme', 'Taco Bell Crunchwrap Supreme', 'restaurant'],
  ['Taco Bell soft taco', 'Taco Bell Soft Taco', 'restaurant'],
  ["Wendy's Dave's Single", "Wendy's Dave's Single", 'restaurant'],
  ["Wendy's spicy chicken sandwich", "Wendy's Spicy Chicken Sandwich", 'restaurant'],
  ['Panera mac and cheese', 'Panera Mac and Cheese', 'restaurant'],
  ['Subway turkey footlong', 'Subway Turkey Footlong', 'restaurant'],
  ['Panda Express orange chicken', 'Panda Express Orange Chicken', 'restaurant'],
  ['Panda Express chow mein', 'Panda Express Chow Mein', 'restaurant'],
  ["Raising Cane's Box Combo", "Raising Cane's Box Combo", 'restaurant'],
  ['Texas Roadhouse sirloin', 'Texas Roadhouse Sirloin', 'restaurant'],
  ['KFC famous bowl', 'KFC Famous Bowl', 'restaurant'],
  ['Burger King Whopper', 'Burger King Whopper', 'restaurant'],
  ['Popeyes chicken sandwich', 'Popeyes Chicken Sandwich', 'restaurant'],
  ["Jersey Mike's turkey sub", "Jersey Mike's Turkey Sub", 'restaurant'],
].map(([prompt, expectedIdentity, expectedCategory = 'branded']) => ({
  name: String(expectedIdentity),
  category: expectedCategory === 'restaurant' ? 'restaurant' : 'branded',
  prompt: `I had ${prompt}`,
  expectedIdentity: String(expectedIdentity),
  expectedCategory: expectedCategory as ExpectedCategory,
}));

benchmarkCases.push(
  ...[
    'apple', 'banana', 'white rice', 'brown rice', 'chicken breast', 'salmon', 'eggs', 'oatmeal', 'peanut butter toast', 'Greek yogurt', 'broccoli', 'potato', 'sweet potato', 'avocado', 'strawberries', 'blueberries', 'almonds', 'whole milk', 'skim milk', 'cheddar cheese', 'ground beef', 'turkey sandwich', 'pasta', 'cereal', 'orange juice',
  ].map((food) => ({ name: food, category: 'grocery' as const, prompt: `I had ${food}`, expectedIdentity: food, expectedCategory: 'generic' as const })),
  ...[
    ['quest bbq protien chips', 'Quest BBQ Protein Chips'],
    ['fairlife choclate shake', 'Fairlife Chocolate Shake'],
    ['premeir protein', 'Premier Protein'],
    ['chick fil a nuggest', 'Chick-fil-A Nuggets'],
    ['mcdonalds bigmac', "McDonald's Big Mac"],
    ['starbuks iced vanila latte', 'Starbucks Iced Vanilla Latte'],
    ['chipoltle chicken bowl', 'Chipotle Chicken Bowl'],
    ['dorittos nacho chees', 'Doritos Nacho Cheese'],
    ['chobanni greek yogurt', 'Chobani Greek Yogurt'],
    ['oikos tripple zero', 'Oikos Triple Zero'],
    ['coke zerro', 'Coke Zero'],
    ['dr peper zero', 'Dr Pepper Zero'],
    ['panda expres orange chicken', 'Panda Express Orange Chicken'],
    ['tacobell crunch wrap', 'Taco Bell Crunchwrap'],
    ['wendys daves single', "Wendy's Dave's Single"],
    ['subway turky footlong', 'Subway Turkey Footlong'],
    ['kodiac cakes', 'Kodiak Cakes'],
    ['gold fish crackers', 'Goldfish Crackers'],
    ['cheez its', 'Cheez-It'],
    ['barebell protein bar', 'Barebells Protein Bar'],
    ['legendairy protein pastry', 'Legendary Protein Pastry'],
    ['quaker rice cake', 'Quaker Rice Cake'],
    ['celsius drink', 'Celsius'],
    ['musclemilk shake', 'Muscle Milk Shake'],
    ['poptart strawberry', 'Pop-Tarts Strawberry'],
  ].map(([prompt, expectedIdentity]) => ({ name: prompt, category: 'typo' as const, prompt: `I had ${prompt}`, expectedIdentity, expectedCategory: 'branded' as const })),
  ...[
    [['I had a banana', 'Actually make it 2 bananas'], '2 Banana'],
    [['I had Premier Protein', 'Actually it was Fairlife'], 'Fairlife'],
    [['I had Quest chips', 'Actually BBQ flavor'], 'Quest BBQ'],
    [['I had fries', 'Make them medium fries'], 'Medium Fries'],
    [['I had white rice', 'Change it to brown rice'], 'Brown Rice'],
    [['I had chicken', 'Make it 6 oz grilled chicken'], 'Grilled Chicken'],
    [['I had a Big Mac and fries', 'Remove the fries'], 'Big Mac'],
    [['I had a Starbucks latte', 'Make it venti'], 'Venti Starbucks Latte'],
    [['I had Chipotle chicken bowl', 'Add extra chicken'], 'Chipotle Chicken Bowl Extra Chicken'],
    [['I had a protein shake', 'Actually it was Fairlife Core Power'], 'Fairlife Core Power'],
    [["I had McDonald's burger", 'Actually Big Mac'], 'Big Mac'],
    [['I had 12 nuggets', 'Actually Chick-fil-A 12 count nuggets'], 'Chick-fil-A 12 count nuggets'],
    [['I had oatmeal', 'Add peanut butter'], 'Oatmeal Peanut Butter'],
    [['I had a smoothie', 'Actually homemade banana peanut butter smoothie'], 'Banana Peanut Butter Smoothie'],
    [['I had a turkey sandwich', 'Remove cheese'], 'Turkey Sandwich'],
    [['I had eggs', 'Make it 3 eggs'], '3 Eggs'],
    [['I had Coke', 'Actually Coke Zero'], 'Coke Zero'],
    [['I had Panera mac', 'Actually large mac and cheese'], 'Panera Mac and Cheese'],
    [['I had Panda Express', 'Add orange chicken and chow mein'], 'Panda Express Orange Chicken Chow Mein'],
    [['I had a burrito', 'Actually Chipotle chicken burrito'], 'Chipotle Chicken Burrito'],
    [['I had chips', 'Actually Doritos Nacho Cheese'], 'Doritos Nacho Cheese'],
    [['I had yogurt', 'Actually Chobani Greek Yogurt Strawberry'], 'Chobani Greek Yogurt Strawberry'],
    [['I had protein bar', 'Actually Barebells'], 'Barebells Protein Bar'],
    [['I had toast', 'Add peanut butter'], 'Toast Peanut Butter'],
    [['I had chicken rice broccoli', 'Double the chicken'], 'Chicken Rice Broccoli'],
  ].map(([turns, expectedIdentity]) => ({
    name: Array.isArray(turns) ? turns.join(' → ') : String(turns),
    category: 'correction' as const,
    prompt: Array.isArray(turns) ? turns.join(' → ') : String(turns),
    turns: turns as string[],
    expectedIdentity: String(expectedIdentity),
    expectedCategory: 'generic' as const,
  })),
);

function buildState(overrides?: Partial<MealAssistantState>): MealAssistantState {
  return {
    currentMealItems: [],
    pendingClarification: null,
    lastAssistantQuestion: null,
    userCorrections: [],
    saved: false,
    mealType: 'lunch',
    userName: 'Tyler Cox',
    currentMealText: null,
    confidenceScore: 0.82,
    sourceReusableMealId: null,
    editingMealId: null,
    ...overrides,
  };
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(text: string) {
  return normalize(text).split(' ').filter((token) => token.length > 1 && !['and', 'the', 'with', 'count'].includes(token));
}

function identityOf(items: ParsedFoodItem[]) {
  return items.map((item) => `${item.quantity > 1 ? `${item.quantity} ` : ''}${item.food_name}`).join(', ');
}

function actualCategory(items: ParsedFoodItem[]): BenchmarkResult['actualCategory'] {
  if (!items.length) return 'unknown';
  if (items.some((item) => item.source_type === 'AI_ESTIMATE' || item.used_ai_fallback)) return 'estimated';
  if (items.some((item) => item.source_type === 'OFFICIAL_RESTAURANT')) return 'restaurant';
  if (items.some((item) => item.is_trusted && item.source_name && !/usda|generic/i.test(item.source_name))) return 'branded';
  if (items.some((item) => item.is_trusted || item.source_type === 'GENERIC_REFERENCE')) return 'generic';
  return 'unknown';
}

function matchType(expected: string, actual: string, category: BenchmarkResult['actualCategory']): BenchmarkResult['matchType'] {
  const expectedTokens = tokens(expected);
  const actualNormalized = normalize(actual);
  const covered = expectedTokens.length ? expectedTokens.filter((token) => actualNormalized.includes(token)).length / expectedTokens.length : 0;
  if (covered >= 0.95) return 'exact';
  if (covered >= 0.6) return 'fuzzy';
  if (category === 'estimated') return 'estimated';
  if (category === 'generic') return 'generic';
  return 'miss';
}

function passes(result: Omit<BenchmarkResult, 'passed' | 'notes'>) {
  if (result.matchType === 'miss') return false;
  if (result.expectedCategory === 'restaurant') return result.actualCategory === 'restaurant' && ['exact', 'fuzzy'].includes(result.matchType);
  if (result.expectedCategory === 'branded') return ['branded', 'restaurant'].includes(result.actualCategory) && ['exact', 'fuzzy'].includes(result.matchType);
  return ['exact', 'fuzzy', 'generic'].includes(result.matchType);
}

async function runCase(testCase: BenchmarkCase): Promise<BenchmarkResult> {
  let state = buildState();
  let lastItems: ParsedFoodItem[] = [];
  const turns = testCase.turns ?? [testCase.prompt];

  for (const message of turns) {
    const response = await runMealAssistant({ message, state });
    state = response.next_state;
    lastItems = response.meal.items;
  }

  const actualIdentity = identityOf(lastItems);
  const category = actualCategory(lastItems);
  const match = matchType(testCase.expectedIdentity, actualIdentity, category);
  const sourceNames = [...new Set(lastItems.map((item) => item.source_name).filter(Boolean))].join('; ') || null;
  const confidenceLabels = [...new Set(lastItems.map((item) => item.confidence_label).filter(Boolean))].join('; ') || null;
  const base = {
    name: testCase.name,
    category: testCase.category,
    prompt: testCase.prompt,
    expectedIdentity: testCase.expectedIdentity,
    actualIdentity,
    expectedCategory: testCase.expectedCategory,
    actualCategory: category,
    sourceUsed: sourceNames,
    confidenceLabel: confidenceLabels,
    matchType: match,
  } satisfies Omit<BenchmarkResult, 'passed' | 'notes'>;
  const passed = passes(base);

  return {
    ...base,
    passed,
    notes: passed ? 'Pass under current benchmark criteria.' : `Expected ${testCase.expectedIdentity}; got ${actualIdentity || 'no items'}.`,
  };
}

function summarize(results: BenchmarkResult[]) {
  const byCategory = Object.groupBy(results, (result) => result.category) as Record<BenchmarkCategory, BenchmarkResult[]>;
  return Object.fromEntries(
    Object.entries(byCategory).map(([category, categoryResults]) => {
      const total = categoryResults.length;
      const exact = categoryResults.filter((result) => result.matchType === 'exact').length;
      const branded = categoryResults.filter((result) => result.actualCategory === 'branded').length;
      const restaurant = categoryResults.filter((result) => result.actualCategory === 'restaurant').length;
      const generic = categoryResults.filter((result) => result.actualCategory === 'generic').length;
      const passed = categoryResults.filter((result) => result.passed).length;
      return [category, {
        total,
        passed,
        failed: total - passed,
        exactMatchPercentage: Math.round((exact / total) * 100),
        brandedMatchPercentage: Math.round((branded / total) * 100),
        restaurantMatchPercentage: Math.round((restaurant / total) * 100),
        genericFallbackPercentage: Math.round((generic / total) * 100),
        correctionSuccessPercentage: category === 'correction' ? Math.round((passed / total) * 100) : null,
      }];
    }),
  );
}

function renderMarkdown(results: BenchmarkResult[]) {
  const summary = summarize(results);
  const total = results.length;
  const passed = results.filter((result) => result.passed).length;
  const confidenceDistribution = Object.entries(Object.groupBy(results, (result) => result.confidenceLabel ?? 'missing'))
    .map(([label, rows]) => `- ${label}: ${rows?.length ?? 0}`)
    .join('\n');
  const topFailures = results
    .filter((result) => !result.passed)
    .slice(0, 20)
    .map((result) => `- ${result.category}: ${result.prompt} → ${result.actualIdentity || 'no items'} (${result.notes})`)
    .join('\n') || '- None under current benchmark criteria.';

  return `# Nutrition Accuracy Benchmark\n\nGenerated: ${new Date().toISOString()}\n\nThis report measures the current deterministic nutrition pipeline against the Phase 9A baseline case set. Improvements must be interpreted as benchmark deltas, not as perfect nutrition accuracy.\n\n## Overall\n\n- Total tested: ${total}\n- Passed: ${passed}\n- Failed: ${total - passed}\n- Recognition rate: ${Math.round((results.filter((result) => result.actualIdentity).length / total) * 100)}%\n- Exact-match rate: ${Math.round((results.filter((result) => result.matchType === 'exact').length / total) * 100)}%\n- Generic fallback rate: ${Math.round((results.filter((result) => result.actualCategory === 'generic').length / total) * 100)}%\n- Obvious wrong-result rate: ${Math.round((results.filter((result) => result.matchType === 'miss').length / total) * 100)}%\n\n## Summary by category\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n\n## Confidence label distribution\n\n${confidenceDistribution}\n\n## Top failure patterns\n\n${topFailures}\n\n## Benchmark limitations\n\n- Current schema exposes only \`Verified\`, \`High confidence\`, and \`Estimated\`; the future Very High/High/Medium/Low model is not available yet.\n- Provenance is inferred from current item fields: \`source_type\`, \`source_name\`, \`confidence_label\`, \`provider_used\`, and \`used_ai_fallback\`. Fallback path and source freshness are not first-class fields yet.\n- This benchmark runs in local test mode without live OpenAI/USDA/Nutritionix calls, so it primarily measures deterministic/catalog/mock behavior. Live-provider accuracy must be measured separately when those services are enabled.\n- Pass/fail is identity/category based, not calorie-perfect. Macro/calorie conflict scoring belongs in the future sanity/conflict engine.\n- Correction scenarios are measured by final meal identity after turns, not by every intermediate assistant reply.\n\n## Results\n\n| # | Test case | Input prompt | Expected identity | Actual identity | Expected category | Actual category | Source | Confidence | Match | Pass/fail | Notes |\n|---:|---|---|---|---|---|---|---|---|---|---|---|\n${results.map((result, index) => `| ${index + 1} | ${result.name.replace(/\|/g, '\\|')} | ${result.prompt.replace(/\|/g, '\\|')} | ${result.expectedIdentity.replace(/\|/g, '\\|')} | ${(result.actualIdentity || '—').replace(/\|/g, '\\|')} | ${result.expectedCategory} | ${result.actualCategory} | ${(result.sourceUsed ?? '—').replace(/\|/g, '\\|')} | ${(result.confidenceLabel ?? '—').replace(/\|/g, '\\|')} | ${result.matchType} | ${result.passed ? 'PASS' : 'FAIL'} | ${result.notes.replace(/\|/g, '\\|')} |`).join('\n')}\n`;
}

describe('nutrition accuracy benchmark', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('USDA_FDC_API_KEY', '');
    vi.stubEnv('FDC_API_KEY', '');
    vi.stubEnv('NUTRITIONIX_APP_ID', '');
    vi.stubEnv('NUTRITIONIX_API_KEY', '');
  });

  it('measures current nutrition recognition against the baseline case set', async () => {
    expect(benchmarkCases).toHaveLength(125);
    const results = [] as BenchmarkResult[];

    for (const testCase of benchmarkCases) {
      results.push(await runCase(testCase));
    }

    const outputDir = join(process.cwd(), 'docs', 'benchmarks');
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, 'nutrition-accuracy-baseline.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), summary: summarize(results), results }, null, 2)}\n`);
    writeFileSync(join(outputDir, 'nutrition-accuracy-baseline.md'), renderMarkdown(results));

    expect(results).toHaveLength(125);
  }, 120_000);
});
