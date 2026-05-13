import { PrismaClient } from '@prisma/client';
import { resolvePrismaDatabaseUrl } from '@/lib/prisma-database-url';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const databaseUrl = resolvePrismaDatabaseUrl();

if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl
      ? {
          datasources: {
            db: {
              url: databaseUrl,
            },
          },
        }
      : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
