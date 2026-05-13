async function loadLocalEnv() {
  const [{ readFile }, pathModule] = await Promise.all([import('node:fs/promises'), import('node:path')]);
  const cwd = process.cwd();
  const envFiles = ['.env.local', '.env'];

  for (const filename of envFiles) {
    try {
      const filePath = pathModule.join(cwd, filename);
      const raw = await readFile(filePath, 'utf8');

      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) continue;

        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();

        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        continue;
      }

      throw error;
    }
  }
}

async function syncNutritionCatalog() {
  await loadLocalEnv();

  const [{ PrismaClient }, { default: catalogData }] = await Promise.all([
    import('@prisma/client'),
    import('../data/nutrition-catalog.json', { with: { type: 'json' } }),
  ]);

  const prisma = new PrismaClient();

  try {
    for (const source of catalogData.sources) {
      await prisma.nutritionSource.upsert({
        where: { id: source.id },
        update: {
          name: source.name,
          sourceType: source.sourceType,
          brand: source.brand,
          citation: source.citation,
          notes: source.notes,
          active: true,
        },
        create: {
          id: source.id,
          name: source.name,
          sourceType: source.sourceType,
          brand: source.brand,
          citation: source.citation,
          notes: source.notes,
          active: true,
        },
      });
    }

    for (const food of catalogData.foods) {
      const foodRecord = { ...food };
      delete foodRecord.aliases;

      await prisma.catalogFood.upsert({
        where: { id: food.id },
        update: foodRecord,
        create: foodRecord,
      });
    }

    const foodIds = catalogData.foods.map((food) => food.id);

    await prisma.catalogAlias.deleteMany({
      where: {
        foodId: {
          in: foodIds,
        },
      },
    });

    await prisma.catalogAlias.createMany({
      data: catalogData.foods.flatMap((food) =>
        food.aliases.map((alias) => ({
          foodId: food.id,
          alias,
          normalizedAlias: alias.toLowerCase(),
        })),
      ),
      skipDuplicates: true,
    });

    console.log(`Synced nutrition catalog with ${catalogData.sources.length} sources and ${catalogData.foods.length} foods.`);
  } finally {
    await prisma.$disconnect();
  }
}

syncNutritionCatalog().catch((error) => {
  console.error(error);
  process.exit(1);
});
