import { describe, expect, it } from 'vitest';

import {
  buildQuickFoodFromParsedItem,
  buildQuickListsExport,
  defaultQuickListsState,
  toggleFavorite,
  upsertRecentFood,
  createTemplate,
  filterMealTemplates,
  filterQuickFoods,
  importQuickListsJson,
  renameTemplate,
  deleteTemplate,
  validateTemplateName,
} from '@/lib/logger-quicklists';

import type { ParsedFoodItem } from '@/lib/ai/types';

const baseItem: ParsedFoodItem = {
  food_name: 'Fairlife Core Power',
  quantity: 1,
  unit: 'bottle',
  calories: 230,
  protein: 42,
  carbs: 8,
  fat: 3,
  fiber: 0,
  sugar: 7,
  sodium: 260,
  notes: null,
  is_trusted: true,
  source_type: 'GENERIC_REFERENCE' as const,
  source_name: 'Verified',
  catalog_food_id: null,
};

describe('logger quicklists', () => {
  it('toggles favorites on/off by identity', () => {
    const food = buildQuickFoodFromParsedItem({ item: baseItem, sourceLabel: 'Matched' });
    const once = toggleFavorite([], food);
    expect(once).toHaveLength(1);
    const twice = toggleFavorite(once, food);
    expect(twice).toHaveLength(0);
  });

  it('recents dedupe and cap', () => {
    const food = buildQuickFoodFromParsedItem({ item: baseItem, sourceLabel: 'Matched' });
    let recents = [] as typeof food[];
    recents = upsertRecentFood(recents, food, 2);
    recents = upsertRecentFood(recents, { ...food, id: 'second' }, 2);
    expect(recents).toHaveLength(1);
    recents = upsertRecentFood(recents, { ...food, name: 'Quest BBQ Chips', parsedItem: { ...baseItem, food_name: 'Quest BBQ Chips' } }, 2);
    expect(recents).toHaveLength(2);
    recents = upsertRecentFood(recents, { ...food, name: 'Coke Zero', parsedItem: { ...baseItem, food_name: 'Coke Zero' } }, 2);
    expect(recents).toHaveLength(2);
  });

  it('creates/renames/deletes templates', () => {
    const state = defaultQuickListsState();
    const food = buildQuickFoodFromParsedItem({ item: baseItem, sourceLabel: 'Matched' });
    const created = createTemplate(state.templates, { name: 'Tyler breakfast', foods: [food] });
    expect(created).toHaveLength(1);
    const renamed = renameTemplate(created, created[0]!.id, 'New name');
    expect(renamed[0]!.name).toBe('New name');
    const deleted = deleteTemplate(renamed, renamed[0]!.id);
    expect(deleted).toHaveLength(0);
  });

  it('filters favorites and recents by food name or brand without mutating order', () => {
    const fairlife = buildQuickFoodFromParsedItem({ item: baseItem, sourceLabel: 'Verified', brand: 'Fairlife' });
    const quest = buildQuickFoodFromParsedItem({
      item: { ...baseItem, food_name: 'BBQ Protein Chips', calories: 140, protein: 19, carbs: 5, fat: 4 },
      sourceLabel: 'Verified',
      brand: 'Quest',
    });
    const foods = [fairlife, quest];

    expect(filterQuickFoods(foods, 'quest')).toEqual([quest]);
    expect(filterQuickFoods(foods, 'core power')).toEqual([fairlife]);
    expect(filterQuickFoods(foods, '')).toEqual(foods);
  });

  it('filters meal templates by template name', () => {
    const food = buildQuickFoodFromParsedItem({ item: baseItem, sourceLabel: 'Matched' });
    const templates = [
      createTemplate([], { name: 'Weekday breakfast', foods: [food] })[0]!,
      createTemplate([], { name: 'Post-lift shake', foods: [food] })[0]!,
    ];

    expect(filterMealTemplates(templates, 'lift').map((template) => template.name)).toEqual(['Post-lift shake']);
    expect(filterMealTemplates(templates, 'weekday').map((template) => template.name)).toEqual(['Weekday breakfast']);
  });

  it('validates required and duplicate template names', () => {
    const food = buildQuickFoodFromParsedItem({ item: baseItem, sourceLabel: 'Matched' });
    const templates = createTemplate([], { name: 'Weekday Breakfast', foods: [food] });

    expect(validateTemplateName(templates, '   ')).toBe('Template name is required.');
    expect(validateTemplateName(templates, 'weekday breakfast')).toBe('A template with that name already exists.');
    expect(validateTemplateName(templates, 'weekday breakfast', templates[0]!.id)).toBeNull();
  });

  it('exports quicklist JSON with stable metadata and imports valid favorites', () => {
    const food = buildQuickFoodFromParsedItem({ item: baseItem, sourceLabel: 'Verified', brand: 'Fairlife' });
    const exported = buildQuickListsExport('favorites', [food], '2026-06-09T12:00:00.000Z');
    const parsed = JSON.parse(exported);

    expect(parsed).toMatchObject({
      version: 1,
      kind: 'favorites',
      exportedAt: '2026-06-09T12:00:00.000Z',
    });
    expect(parsed.items).toHaveLength(1);

    const imported = importQuickListsJson('favorites', exported);
    expect(imported.ok).toBe(true);
    expect(imported.ok ? imported.items[0]?.name : null).toBe('Fairlife Core Power');
  });

  it('rejects invalid quicklist import JSON without returning partial data', () => {
    expect(importQuickListsJson('favorites', '{not-json').ok).toBe(false);
    expect(importQuickListsJson('templates', JSON.stringify({ version: 1, kind: 'favorites', items: [] })).ok).toBe(false);
    expect(importQuickListsJson('templates', JSON.stringify({ version: 1, kind: 'templates', items: [{ name: '' }] })).ok).toBe(false);
  });
});
