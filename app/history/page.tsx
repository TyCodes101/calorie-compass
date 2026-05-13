import { HistoryClient } from '@/components/history-client';
import { getMealHistory } from '@/lib/history';
import { getFavoriteMeals } from '@/lib/reusable-meals';

export const dynamic = 'force-dynamic';

type HistoryPageProps = {
  searchParams?: Promise<{
    updated?: string | string[];
  }>;
};

function pickFirst(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const updated = pickFirst(params?.updated);
  const [history, favorites] = await Promise.all([getMealHistory(), getFavoriteMeals()]);
  const initialNotice = updated
    ? { tone: 'success' as const, text: 'Meal updated. Your history reflects the latest saved version.' }
    : null;

  return <HistoryClient initialHistory={history} initialFavorites={favorites} initialNotice={initialNotice} />;
}
