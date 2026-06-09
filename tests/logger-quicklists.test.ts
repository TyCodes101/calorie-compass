import { describe, expect, it } from 'vitest';

import {
  buildQuickFoodFromParsedItem,
  defaultQuickListsState,
  toggleFavorite,
  upsertRecentFood,
  createTemplate,
  renameTemplate,
  deleteTemplate,
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
});
