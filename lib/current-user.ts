import { prisma } from '@/lib/prisma';

export async function getCurrentUserWithProfile() {
  return prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    include: { profile: true },
  });
}

export async function getCurrentUserId() {
  const user = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  return user?.id ?? null;
}
