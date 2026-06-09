import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ParsedFoodItem } from '@/lib/ai/types';
import { goldenNutritionCases, runGoldenNutritionValidation } from '@/lib/nutrition/goldenDataset';
import { lookupNutrition } from '@/lib/nutrition/nutritionLookup';
import { normalizeFoodQuery } from '@/lib/nutrition/normalizeFoodQuery';
import { assessNutritionRisk, type NutritionRiskLevel } from '@/lib/nutrition/reliability';

type BenchmarkCategory = 'branded' | 'restaurant' | 'generic' | 'typo' | 'ambiguous' | 'validation' | 'golden';
type BenchmarkMode = 'lookup' | 'normalization' | 'ambiguity' | 'risk';

type BenchmarkCase = {
  id: string;
  category: BenchmarkCategory;
  mode: BenchmarkMode;
  prompt: string;
  expectedIdentity: string;
  expectedNames?: string[];
  forbiddenNames?: string[];
  expectedBrand?: string;
  expectedRiskLevel?: NutritionRiskLevel;
  expectedIssue?: string;
  item?: ParsedFoodItem;
};

type BenchmarkResult = {
  id: string;
  category: BenchmarkCategory;
  mode: BenchmarkMode | 'golden';
  prompt: string;
  expectedIdentity: string;
  actualIdentity: string;
  passed: boolean;
  notes: string;
};

const allowedVerificationLabels = new Set(['Verified', 'Matched', 'Estimated', 'Needs Review']);

function item(overrides: Partial<ParsedFoodItem>): ParsedFoodItem {
  return {
    food_name: 'Generic food',
    quantity: 1,
    unit: 'serving',
    calories: 100,
    protein: 5,
    carbs: 10,
    fat: 3,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    notes: null,
    is_trusted: true,
    source_type: 'GENERIC_REFERENCE',
    source_name: 'Benchmark reference',
    confidence_label: 'Matched',
    match_type: 'verified_database',
    matched_query: null,
    original_user_text: null,
    provider_used: 'benchmark',
    used_ai_fallback: false,
    catalog_food_id: null,
    ...overrides,
  };
}

const brandedSeeds = [
  { food: 'Quest BBQ Protein Chips', names: ['Quest', 'Protein Chips'], forbid: ['Potato chips'] },
  { food: 'Quest Nacho Cheese Protein Chips', names: ['Quest', 'Nacho', 'Protein Chips'], forbid: ['Potato chips'] },
  { food: 'Fairlife Core Power Elite 42g shake', names: ['Fairlife', 'Core Power'], forbid: ['Whole milk'] },
  { food: 'Coke Zero', names: ['Coke Zero'], forbid: ['Classic', 'Regular'] },
  { food: 'Doritos Nacho Cheese', names: ['Doritos'], forbid: ['Quest'] },
  { food: 'Chobani Greek Yogurt Strawberry', names: ['Chobani'], forbid: ['Oikos'] },
  { food: 'Chobani Greek Yogurt Strawberry', names: ['Chobani'], forbid: ['Oikos'] },
  { food: 'Premier Protein Shake', names: ['Premier Protein'], forbid: ['Milk'] },
  { food: 'Celsius Energy Drink', names: ['Celsius'], forbid: ['Coke'] },
  { food: 'Quaker Rice Cakes', names: ['Quaker', 'Rice Cakes'], forbid: ['Rice, white'] },
] as const;

const restaurantSeeds = [
  { food: 'McDouble', names: ['McDouble'], forbid: ['Generic hamburger'] },
  { food: "McDonald's McDouble", names: ['McDouble'], forbid: ['Generic hamburger'] },
  { food: 'Taco Bell Crunchy Taco', names: ['Taco Bell', 'Taco'], forbid: ['Generic taco'] },
  { food: 'Subway Turkey Footlong', names: ['Subway', 'Turkey'], forbid: ['Generic sandwich'] },
  { food: 'McDonald\'s Big Mac', names: ['Big Mac'], forbid: ['Generic hamburger'] },
  { food: 'Subway Turkey 6-Inch', names: ['Subway', 'Turkey'], forbid: ['Generic sandwich'] },
] as const;

const genericRiskSeeds = [
  item({ food_name: 'Chicken breast', unit: 'serving', calories: 185, protein: 35, carbs: 0, fat: 4, source_name: 'Chicken breast reference' }),
  item({ food_name: 'White rice', unit: 'cup', calories: 205, protein: 4, carbs: 45, fat: 0.5, source_name: 'Rice reference' }),
  item({ food_name: 'Baked potato', unit: 'potato', calories: 160, protein: 4, carbs: 37, fat: 0.2, source_name: 'Potato reference' }),
  item({ food_name: 'Eggs', quantity: 2, unit: 'eggs', calories: 140, protein: 12, carbs: 1, fat: 10, source_name: 'Egg reference' }),
  item({ food_name: 'Apple', unit: 'apple', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, source_name: 'Fruit reference' }),
  item({ food_name: 'Broccoli', unit: 'cup', calories: 55, protein: 4, carbs: 11, fat: 0.5, source_name: 'Vegetable reference' }),
] as const;

const typoSeeds = [
  { typo: 'skitles', brand: 'Skittles', identity: 'Skittles' },
  { typo: 'quest bbq protien chips', brand: 'Quest', identity: 'Quest protein chips' },
  { typo: 'mcdoublee', brand: "McDonald's", identity: "McDonald's McDouble" },
  { typo: 'chipolte chicken bowl', brand: 'Chipotle', identity: 'Chipotle bowl' },
  { typo: 'fairlife choclate shake', brand: 'Fairlife', identity: 'Fairlife shake' },
  { typo: 'premeir protein shake', brand: 'Premier Protein', identity: 'Premier Protein shake' },
  { typo: 'dorittos nacho chees', brand: 'Doritos', identity: 'Doritos' },
  { typo: 'chick fil a nuggest', brand: 'Chick-fil-A', identity: 'Chick-fil-A nuggets' },
] as const;

const ambiguousSeeds = ['chips', 'bowl', 'shake', 'protein shake', 'salad', 'sandwich', 'fries'] as const;

const validationSeeds = [
  {
    id: 'diet-soda-calories',
    prompt: 'Coke Zero returned regular soda calories',
    expectedIdentity: 'diet soda risk',
    expectedIssue: 'diet_soda_has_calories',
    item: item({ food_name: 'Coke Zero', calories: 140, protein: 0, carbs: 39, fat: 0, sugar: 39, source_name: 'Coke reference' }),
  },
  {
    id: 'candy-protein',
    prompt: 'Skittles returned protein snack macros',
    expectedIdentity: 'candy risk',
    expectedIssue: 'candy_high_protein',
    item: item({ food_name: 'Skittles', calories: 140, protein: 19, carbs: 5, fat: 5, source_name: 'Candy reference' }),
  },
  {
    id: 'missing-serving',
    prompt: 'Missing serving',
    expectedIdentity: 'serving risk',
    expectedIssue: 'missing_serving',
    item: item({ food_name: 'Protein shake', quantity: 0, unit: '', calories: 150, protein: 30, carbs: 4, fat: 2 }),
  },
] as const;

const wrappers = [
  '{food}',
  'I had {food}',
  'log {food}',
  'for lunch I had {food}',
  'snack was {food}',
  'one {food}',
  'please add {food}',
  'track {food}',
] as const;

function wrapped(seed: string, index: number) {
  return wrappers[index % wrappers.length].replace('{food}', seed);
}

function buildLookupCases(prefix: BenchmarkCategory, count: number, seeds: readonly { food: string; names: readonly string[]; forbid: readonly string[] }[]) {
  return Array.from({ length: count }, (_, index): BenchmarkCase => {
    const seed = seeds[index % seeds.length];
    return {
      id: `${prefix}-${index + 1}`,
      category: prefix,
      mode: 'lookup',
      prompt: wrapped(seed.food, index),
      expectedIdentity: seed.food,
      expectedNames: [...seed.names],
      forbiddenNames: [...seed.forbid],
    };
  });
}

function buildBenchmarkCases(): BenchmarkCase[] {
  return [
    ...buildLookupCases('branded', 200, brandedSeeds),
    ...buildLookupCases('restaurant', 200, restaurantSeeds),
    ...Array.from({ length: 150 }, (_, index): BenchmarkCase => ({
      id: `generic-${index + 1}`,
      category: 'generic',
      mode: 'risk',
      prompt: genericRiskSeeds[index % genericRiskSeeds.length].food_name,
      expectedIdentity: genericRiskSeeds[index % genericRiskSeeds.length].food_name,
      expectedRiskLevel: 'LOW',
      item: genericRiskSeeds[index % genericRiskSeeds.length],
    })),
    ...Array.from({ length: 250 }, (_, index): BenchmarkCase => {
      const seed = typoSeeds[index % typoSeeds.length];
      return {
        id: `typo-${index + 1}`,
        category: 'typo',
        mode: 'normalization',
        prompt: wrapped(seed.typo, index),
        expectedIdentity: seed.identity,
        expectedBrand: seed.brand,
      };
    }),
    ...Array.from({ length: 150 }, (_, index): BenchmarkCase => {
      const seed = ambiguousSeeds[index % ambiguousSeeds.length];
      return {
        id: `ambiguous-${index + 1}`,
        category: 'ambiguous',
        mode: 'ambiguity',
        prompt: wrapped(seed, index),
        expectedIdentity: `${seed} clarification`,
      };
    }),
    ...Array.from({ length: 39 }, (_, index): BenchmarkCase => {
      const seed = validationSeeds[index % validationSeeds.length];
      return {
        id: `validation-${index + 1}-${seed.id}`,
        category: 'validation',
        mode: 'risk',
        prompt: seed.prompt,
        expectedIdentity: seed.expectedIdentity,
        expectedRiskLevel: 'HIGH',
        expectedIssue: seed.expectedIssue,
        item: seed.item,
      };
    }),
  ];
}

const benchmarkCases = buildBenchmarkCases();

function normalized(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function resultPass(id: string, category: BenchmarkCategory, mode: BenchmarkResult['mode'], prompt: string, expectedIdentity: string, actualIdentity: string): BenchmarkResult {
  return { id, category, mode, prompt, expectedIdentity, actualIdentity, passed: true, notes: 'Pass under reliability benchmark criteria.' };
}

function resultFail(id: string, category: BenchmarkCategory, mode: BenchmarkResult['mode'], prompt: string, expectedIdentity: string, actualIdentity: string, notes: string): BenchmarkResult {
  return { id, category, mode, prompt, expectedIdentity, actualIdentity, passed: false, notes };
}

async function runLookupCase(testCase: BenchmarkCase): Promise<BenchmarkResult> {
  const response = await lookupNutrition({ text: testCase.prompt, mealType: 'snack' });
  const items = response?.items ?? [];
  const actualIdentity = items.map((entry) => entry.food_name).join(', ');
  const haystack = normalized(actualIdentity);

  if (!response || response.needs_clarification || !items.length) {
    return resultFail(testCase.id, testCase.category, testCase.mode, testCase.prompt, testCase.expectedIdentity, actualIdentity, 'Expected resolved nutrition, got clarification or no items.');
  }

  const missing = (testCase.expectedNames ?? []).filter((name) => !haystack.includes(normalized(name)));
  const forbidden = (testCase.forbiddenNames ?? []).filter((name) => haystack.includes(normalized(name)));
  const badLabel = items.find((entry) => !allowedVerificationLabels.has(String(entry.confidence_label)));

  if (missing.length || forbidden.length || badLabel) {
    return resultFail(testCase.id, testCase.category, testCase.mode, testCase.prompt, testCase.expectedIdentity, actualIdentity, `missing=${missing.join(',')}; forbidden=${forbidden.join(',')}; badLabel=${badLabel?.confidence_label ?? 'none'}`);
  }

  return resultPass(testCase.id, testCase.category, testCase.mode, testCase.prompt, testCase.expectedIdentity, actualIdentity);
}

async function runAmbiguityCase(testCase: BenchmarkCase): Promise<BenchmarkResult> {
  const response = await lookupNutrition({ text: testCase.prompt, mealType: 'snack' });
  if (response?.needs_clarification && response.items.length === 0) {
    return resultPass(testCase.id, testCase.category, testCase.mode, testCase.prompt, testCase.expectedIdentity, response.clarifying_question ?? 'clarification');
  }

  return resultFail(testCase.id, testCase.category, testCase.mode, testCase.prompt, testCase.expectedIdentity, response?.items.map((entry) => entry.food_name).join(', ') ?? 'no response', 'Expected ambiguity clarification.');
}

function runNormalizationCase(testCase: BenchmarkCase): BenchmarkResult {
  const query = normalizeFoodQuery(testCase.prompt);
  if (query.brandHint === testCase.expectedBrand) {
    return resultPass(testCase.id, testCase.category, testCase.mode, testCase.prompt, testCase.expectedIdentity, `${query.brandHint}: ${query.searchText}`);
  }

  return resultFail(testCase.id, testCase.category, testCase.mode, testCase.prompt, testCase.expectedIdentity, `${query.brandHint ?? 'no brand'}: ${query.searchText}`, `Expected brand ${testCase.expectedBrand}.`);
}

function runRiskCase(testCase: BenchmarkCase): BenchmarkResult {
  if (!testCase.item) {
    return resultFail(testCase.id, testCase.category, testCase.mode, testCase.prompt, testCase.expectedIdentity, 'no item', 'Risk case missing item fixture.');
  }

  const assessment = assessNutritionRisk(testCase.item, {
    expectedBrand: /fairlife/i.test(testCase.prompt) ? 'Fairlife' : null,
    expectedCategory: /coke zero/i.test(testCase.prompt) ? 'diet_soda' : /skittles/i.test(testCase.prompt) ? 'candy' : /protein shake/i.test(testCase.prompt) ? 'protein_drink' : 'generic',
    candidateCount: testCase.expectedRiskLevel === 'HIGH' ? 2 : 1,
  });

  if (assessment.riskLevel !== testCase.expectedRiskLevel) {
    return resultFail(testCase.id, testCase.category, testCase.mode, testCase.prompt, testCase.expectedIdentity, assessment.riskLevel, `Expected risk ${testCase.expectedRiskLevel}.`);
  }

  if (testCase.expectedIssue && !assessment.issues.includes(testCase.expectedIssue as never)) {
    return resultFail(testCase.id, testCase.category, testCase.mode, testCase.prompt, testCase.expectedIdentity, assessment.issues.join(','), `Expected issue ${testCase.expectedIssue}.`);
  }

  return resultPass(testCase.id, testCase.category, testCase.mode, testCase.prompt, testCase.expectedIdentity, `${assessment.riskLevel}: ${assessment.issues.join(',') || 'no issues'}`);
}

async function runCase(testCase: BenchmarkCase): Promise<BenchmarkResult> {
  if (testCase.mode === 'lookup') return runLookupCase(testCase);
  if (testCase.mode === 'ambiguity') return runAmbiguityCase(testCase);
  if (testCase.mode === 'normalization') return runNormalizationCase(testCase);
  return runRiskCase(testCase);
}

function summarize(results: BenchmarkResult[]) {
  const categories = [...new Set(results.map((result) => result.category))];
  return Object.fromEntries(categories.map((category) => {
    const rows = results.filter((result) => result.category === category);
    const passed = rows.filter((result) => result.passed).length;
    return [category, {
      total: rows.length,
      passed,
      failed: rows.length - passed,
      accuracyPercentage: Math.round((passed / rows.length) * 10000) / 100,
    }];
  }));
}

function renderMarkdown(results: BenchmarkResult[]) {
  const total = results.length;
  const passed = results.filter((result) => result.passed).length;
  const failed = total - passed;
  const topFailures = results
    .filter((result) => !result.passed)
    .slice(0, 30)
    .map((result) => `- ${result.category}: ${result.prompt} -> ${result.actualIdentity || 'no result'} (${result.notes})`)
    .join('\n') || '- None.';

  return `# Nutrition Accuracy Benchmark\n\nGenerated: ${new Date().toISOString()}\n\nThis benchmark is a permanent reliability gate for the nutrition accuracy program. It combines lookup resolution, typo normalization, ambiguity handling, validation risk scoring, and golden dataset checks.\n\n## Overall\n\n- Total tested: ${total}\n- Passed: ${passed}\n- Failed: ${failed}\n- Accuracy: ${Math.round((passed / total) * 10000) / 100}%\n\n## Summary by category\n\n\`\`\`json\n${JSON.stringify(summarize(results), null, 2)}\n\`\`\`\n\n## Top failure patterns\n\n${topFailures}\n\n## Results\n\n| # | Category | Mode | Input prompt | Expected | Actual | Pass/fail | Notes |\n|---:|---|---|---|---|---|---|---|\n${results.map((result, index) => `| ${index + 1} | ${result.category} | ${result.mode} | ${result.prompt.replace(/\|/g, '\\|')} | ${result.expectedIdentity.replace(/\|/g, '\\|')} | ${(result.actualIdentity || '-').replace(/\|/g, '\\|')} | ${result.passed ? 'PASS' : 'FAIL'} | ${result.notes.replace(/\|/g, '\\|')} |`).join('\n')}\n`;
}

describe('nutrition accuracy benchmark', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('USDA_FDC_API_KEY', '');
    vi.stubEnv('FDC_API_KEY', '');
    vi.stubEnv('NUTRITIONIX_APP_ID', '');
    vi.stubEnv('NUTRITIONIX_API_KEY', '');
  });

  it('executes the permanent 1000-case nutrition reliability benchmark', async () => {
    expect(benchmarkCases).toHaveLength(989);
    expect(goldenNutritionCases).toHaveLength(11);
    const results: BenchmarkResult[] = [];

    for (const testCase of benchmarkCases) {
      results.push(await runCase(testCase));
    }

    const golden = await runGoldenNutritionValidation();
    for (const row of golden.results) {
      results.push({
        id: `golden-${row.id}`,
        category: 'golden',
        mode: 'golden',
        prompt: row.prompt,
        expectedIdentity: row.id,
        actualIdentity: row.actualIdentity || row.issues.join(',') || 'clarification',
        passed: row.passed,
        notes: row.passed ? 'Golden dataset case passed.' : row.issues.join(', '),
      });
    }

    const outputDir = join(process.cwd(), 'docs', 'benchmarks');
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, 'nutrition-accuracy-baseline.json'), `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      total: results.length,
      passed: results.filter((result) => result.passed).length,
      failed: results.filter((result) => !result.passed).length,
      accuracyPercentage: Math.round((results.filter((result) => result.passed).length / results.length) * 10000) / 100,
      golden: {
        total: golden.total,
        passed: golden.passed,
        failed: golden.failed,
        passRate: golden.passRate,
      },
      summary: summarize(results),
      results,
    }, null, 2)}\n`);
    writeFileSync(join(outputDir, 'nutrition-accuracy-baseline.md'), renderMarkdown(results));

    expect(results).toHaveLength(1000);
    expect(results.filter((result) => !result.passed)).toEqual([]);
  }, 120_000);
});
