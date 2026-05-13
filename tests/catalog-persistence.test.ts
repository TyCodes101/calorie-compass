import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    catalogFood: {
      findMany,
    },
  },
}));

import { getPersistableCatalogFoodIds } from '@/lib/catalog-persistence';

describe('catalog persistence helpers', () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it('keeps only catalog food ids that exist in the database', async () => {
    findMany.mockResolvedValue([{ id: 'generic_banana' }, { id: 'generic_rice_cake' }]);

    const result = await getPersistableCatalogFoodIds([
      'generic_banana',
      null,
      'generic_rice_cake',
      'generic_banana',
      undefined,
    ]);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ['generic_banana', 'generic_rice_cake'],
        },
      },
      select: { id: true },
    });
    expect(Array.from(result).sort()).toEqual(['generic_banana', 'generic_rice_cake']);
  });

  it('skips the database query when there are no ids to resolve', async () => {
    const result = await getPersistableCatalogFoodIds([null, undefined]);

    expect(findMany).not.toHaveBeenCalled();
    expect(Array.from(result)).toEqual([]);
  });
});
