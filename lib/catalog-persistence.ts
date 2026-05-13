import { prisma } from '@/lib/prisma';

export async function getPersistableCatalogFoodIds(catalogFoodIds: Array<string | null | undefined>) {
  const ids = Array.from(new Set(catalogFoodIds.filter((id): id is string => Boolean(id))));

  if (!ids.length) {
    return new Set<string>();
  }

  const foods = await prisma.catalogFood.findMany({
    where: {
      id: {
        in: ids,
      },
    },
    select: { id: true },
  });

  return new Set(foods.map((food) => food.id));
}
