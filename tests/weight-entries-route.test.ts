import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  prisma: {
    weightEntry: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    userProfile: {
      update: vi.fn(),
    },
  },
}));

const currentUserMocks = vi.hoisted(() => ({
  getCurrentUserWithProfile: vi.fn(),
  hasDatabaseConnectionString: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMocks.prisma,
}));

vi.mock('@/lib/current-user', () => currentUserMocks);

import { GET, POST } from '@/app/api/weight-entries/route';

describe('weight entries route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentUserMocks.hasDatabaseConnectionString.mockReturnValue(true);
    currentUserMocks.getCurrentUserWithProfile.mockResolvedValue({
      id: 'user-1',
      name: 'Tyler',
      profile: { id: 'profile-1', userId: 'user-1', weightLbs: 182 },
    });
  });

  it('lists recent weight entries newest first with a trend summary', async () => {
    prismaMocks.prisma.weightEntry.findMany.mockResolvedValue([
      { id: 'weight-2', date: new Date('2026-06-02T00:00:00.000Z'), weightLbs: 181 },
      { id: 'weight-1', date: new Date('2026-05-28T00:00:00.000Z'), weightLbs: 183 },
    ]);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.entries).toHaveLength(2);
    expect(payload.trend).toMatchObject({
      latestWeightLbs: 181,
      changeLbs: -2,
      direction: 'down',
    });
    expect(prismaMocks.prisma.weightEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        orderBy: { date: 'desc' },
      }),
    );
  });

  it('logs weight and updates profile latest weight without touching goals', async () => {
    prismaMocks.prisma.weightEntry.create.mockResolvedValue({
      id: 'weight-3',
      date: new Date('2026-06-02T00:00:00.000Z'),
      weightLbs: 181,
    });

    const response = await POST(new Request('http://localhost/api/weight-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weightLbs: 181, date: '2026-06-02' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.entry.weightLbs).toBe(181);
    expect(prismaMocks.prisma.weightEntry.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        date: new Date('2026-06-02T00:00:00.000Z'),
        weightLbs: 181,
      },
    });
    expect(prismaMocks.prisma.userProfile.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { weightLbs: 181 },
    });
  });
});
