import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MealLoggerClient } from '@/components/meal-logger-client';
import type { RecentMealQuickLog } from '@/lib/history';

function buildRecentMeal(overrides?: Partial<RecentMealQuickLog>): RecentMealQuickLog {
  return {
    id: 'recent-1',
    title: 'Chipotle chicken bowl',
    mealType: 'dinner',
    totalCalories: 980,
    createdAt: new Date().toISOString(),
    rawText: 'Chipotle chicken bowl',
    confidenceScore: 0.92,
    items: [
      {
        food_name: 'Chipotle chicken bowl',
        quantity: 1,
        unit: 'bowl',
        calories: 980,
        protein: 68,
        carbs: 74,
        fat: 34,
        fiber: 10,
        sugar: 4,
        sodium: 1760,
        notes: 'Trusted match.',
        is_trusted: true,
        source_type: 'OFFICIAL_RESTAURANT' as const,
        source_name: 'Chipotle official nutrition',
        catalog_food_id: 'chipotle_bowl_double_chicken',
      },
    ],
    ...overrides,
  };
}

const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, className, ...props }: { children: ReactNode; href: string; className?: string; [key: string]: unknown }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

describe('meal logger client', () => {
  beforeEach(() => {
    refreshMock.mockReset();
    vi.restoreAllMocks();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('renders a conversational estimate flow and saves the reviewed meal', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          needs_clarification: false,
          clarifying_question: null,
          meal_type: 'lunch',
          confidence_score: 0.9,
          items: [
            {
              food_name: 'Chipotle chicken bowl',
              quantity: 1,
              unit: 'bowl',
              calories: 980,
              protein: 68,
              carbs: 74,
              fat: 34,
              fiber: 10,
              sugar: 4,
              sodium: 1760,
              notes: 'Matched to a trusted Chipotle-style bowl estimate.',
              is_trusted: true,
              source_type: 'OFFICIAL_RESTAURANT',
              source_name: 'Chipotle official nutrition',
              catalog_food_id: 'chipotle_bowl_double_chicken',
            },
          ],
          totals: {
            calories: 980,
            protein: 68,
            carbs: 74,
            fat: 34,
            fiber: 10,
            sugar: 4,
            sodium: 1760,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MealLoggerClient
        nutritionPreferences="high protein"
        favoriteMeals={[]}
        recentMeals={[]}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Tell the assistant what you ate'), {
      target: { value: 'I had a Chipotle bowl with white rice, double chicken, corn salsa, cheese, and lettuce.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    await waitFor(() => {
      expect(screen.getByText(/got it, that looks like chipotle chicken bowl/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/980/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^save it$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save it/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/ai/parse-meal',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/meals',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    await waitFor(() => {
      expect(screen.getByText(/Saved it\. Want to log anything else\?/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled();
    expect(refreshMock).toHaveBeenCalled();
  });

  it('responds conversationally to greetings instead of trying to parse a meal', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[]} userName="Tyler Cox" />);

    expect(screen.getByRole('combobox', { name: /meal type/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Tell the assistant what you ate'), {
      target: { value: 'hi' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Hey Tyler, what'd you eat?")).toBeInTheDocument();
    expect(screen.queryByText(/i'd estimate about/i)).not.toBeInTheDocument();
  });

  it('answers nutrition questions conversationally without trying to parse them as food', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MealLoggerClient
        favoriteMeals={[]}
        recentMeals={[]}
        proteinGoal={195}
        dailyCalorieGoal={2550}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Tell the assistant what you ate'), {
      target: { value: 'how much protein should I eat?' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/195g of protein today/i)).toBeInTheDocument();
  });

  it('answers goal questions using today totals without parsing food', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MealLoggerClient
        favoriteMeals={[]}
        recentMeals={[]}
        proteinGoal={195}
        todayProtein={120}
        remainingProtein={75}
        dailyCalorieGoal={2550}
        todayCalories={1800}
        remainingCalories={750}
        todayMealCount={3}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Tell the assistant what you ate'), {
      target: { value: 'how much protein do I have left?' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/75g left/i)).toBeInTheDocument();
  });

  it('answers meal history questions from recent meals without triggering parsing', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MealLoggerClient
        favoriteMeals={[]}
        recentMeals={[buildRecentMeal({ id: 'meal-1' })]}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Tell the assistant what you ate'), {
      target: { value: 'what was my last meal?' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/your last meal was chipotle chicken bowl/i)).toBeInTheDocument();
  });

  it('answers recommendation requests using familiar meals', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MealLoggerClient
        favoriteMeals={[
          {
            id: 'fav-1',
            title: 'Fairlife Core Power Elite 42g shake',
            rawText: 'Fairlife Core Power Elite 42g shake',
            mealType: 'snack',
            lastUsedAt: new Date().toISOString(),
            totalCalories: 230,
            itemCount: 1,
            trustedCount: 1,
          },
        ]}
        recentMeals={[]}
        proteinGoal={195}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Tell the assistant what you ate'), {
      target: { value: 'what should I eat for protein?' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/fairlife core power elite 42g shake/i)).toBeInTheDocument();
  });

  it('keeps the running chat visible and can repeat the last meal from conversation', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[buildRecentMeal()]} />);

    fireEvent.change(screen.getByPlaceholderText('Tell the assistant what you ate'), {
      target: { value: 'hi' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    fireEvent.change(screen.getByPlaceholderText('Tell the assistant what you ate'), {
      target: { value: 'repeat my last meal' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('hi')).toBeInTheDocument();
    expect(screen.getByText(/repeat my last meal/i)).toBeInTheDocument();
    expect(screen.getByText(/i loaded chipotle chicken bowl again/i)).toBeInTheDocument();
    expect(screen.getAllByText(/chipotle chicken bowl/i).length).toBeGreaterThan(1);
  });

  it('updates the current meal when the user sends a simple correction', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        needs_clarification: false,
        clarifying_question: null,
        meal_type: 'lunch',
        confidence_score: 0.94,
        items: [
          {
            food_name: "McDonald's McDouble",
            quantity: 1,
            unit: 'burger',
            calories: 390,
            protein: 22,
            carbs: 33,
            fat: 18,
            fiber: 2,
            sugar: 7,
            sodium: 850,
            notes: 'Restaurant match.',
            is_trusted: true,
            source_type: 'OFFICIAL_RESTAURANT',
            source_name: "McDonald's official nutrition",
            catalog_food_id: 'mcdouble',
          },
        ],
        totals: {
          calories: 390,
          protein: 22,
          carbs: 33,
          fat: 18,
          fiber: 2,
          sugar: 7,
          sodium: 850,
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[]} />);

    fireEvent.change(screen.getByPlaceholderText('Tell the assistant what you ate'), {
      target: { value: "mcdouble from mcdonald's" },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    await screen.findByText(/390 calories/i);

    fireEvent.change(screen.getByPlaceholderText('Tell the assistant what you ate'), {
      target: { value: 'actually it was two' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/780 calories total/i)).toBeInTheDocument();
  });

  it('removes a matching item locally when the user says remove fries', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        needs_clarification: false,
        clarifying_question: null,
        meal_type: 'lunch',
        confidence_score: 0.94,
        items: [
          {
            food_name: "McDonald's McDouble",
            quantity: 1,
            unit: 'burger',
            calories: 390,
            protein: 22,
            carbs: 33,
            fat: 18,
            fiber: 2,
            sugar: 7,
            sodium: 850,
            notes: 'Restaurant match.',
            is_trusted: true,
            source_type: 'OFFICIAL_RESTAURANT',
            source_name: "McDonald's official nutrition",
            catalog_food_id: 'mcdouble',
          },
          {
            food_name: "McDonald's small fries",
            quantity: 1,
            unit: 'order',
            calories: 230,
            protein: 3,
            carbs: 29,
            fat: 11,
            fiber: 3,
            sugar: 0,
            sodium: 180,
            notes: 'Restaurant match.',
            is_trusted: true,
            source_type: 'OFFICIAL_RESTAURANT',
            source_name: "McDonald's official nutrition",
            catalog_food_id: 'mcdonalds_small_fries',
          },
        ],
        totals: {
          calories: 620,
          protein: 25,
          carbs: 62,
          fat: 29,
          fiber: 5,
          sugar: 7,
          sodium: 1030,
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[]} />);

    fireEvent.change(screen.getByPlaceholderText('Tell the assistant what you ate'), {
      target: { value: "mcdouble and fries from mcdonald's" },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    await screen.findByText(/620 calories/i);

    fireEvent.change(screen.getByPlaceholderText('Tell the assistant what you ate'), {
      target: { value: 'remove fries' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/390 calories total/i)).toBeInTheDocument();
    expect(screen.queryByText(/small fries/i)).not.toBeInTheDocument();
  });

  it('updates meal type locally when the user changes it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        needs_clarification: false,
        clarifying_question: null,
        meal_type: 'lunch',
        confidence_score: 0.9,
        items: [
          {
            food_name: 'Chicken bowl',
            quantity: 1,
            unit: 'bowl',
            calories: 700,
            protein: 45,
            carbs: 60,
            fat: 20,
            fiber: 8,
            sugar: 4,
            sodium: 900,
            notes: 'Estimate.',
            is_trusted: false,
            source_type: 'AI_ESTIMATE',
            source_name: 'AI estimate',
            catalog_food_id: null,
          },
        ],
        totals: {
          calories: 700,
          protein: 45,
          carbs: 60,
          fat: 20,
          fiber: 8,
          sugar: 4,
          sodium: 900,
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[]} />);

    fireEvent.change(screen.getByPlaceholderText('Tell the assistant what you ate'), {
      target: { value: 'chicken bowl' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    await screen.findByText(/around 700 calories/i);

    fireEvent.change(screen.getByPlaceholderText('Tell the assistant what you ate'), {
      target: { value: 'change it to lunch' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/changed this to lunch/i)).toBeInTheDocument();
  });

  it('handles save it as a conversational command', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          needs_clarification: false,
          clarifying_question: null,
          meal_type: 'snack',
          confidence_score: 0.96,
          items: [
            {
              food_name: 'Fairlife Core Power Elite 42g Protein Shake',
              quantity: 1,
              unit: 'bottle',
              calories: 230,
              protein: 42,
              carbs: 9,
              fat: 3.5,
              fiber: 1,
              sugar: 7,
              sodium: 260,
              notes: 'Product match.',
              is_trusted: true,
              source_type: 'GENERIC_REFERENCE',
              source_name: 'Core Power nutrition reference',
              catalog_food_id: 'fairlife-core-power-elite-42g',
            },
          ],
          totals: {
            calories: 230,
            protein: 42,
            carbs: 9,
            fat: 3.5,
            fiber: 1,
            sugar: 7,
            sodium: 260,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[]} />);

    fireEvent.change(screen.getByPlaceholderText('Tell the assistant what you ate'), {
      target: { value: 'fairlife 42g shake' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    await screen.findByText(/230 calories/i);

    fireEvent.change(screen.getByPlaceholderText('Tell the assistant what you ate'), {
      target: { value: 'save it' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/meals',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('supports barcode lookup for packaged foods', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        needs_clarification: false,
        clarifying_question: null,
        meal_type: 'snack',
        confidence_score: 0.93,
        items: [
          {
            food_name: 'Packaged protein bar',
            quantity: 1,
            unit: 'bar',
            calories: 200,
            protein: 20,
            carbs: 22,
            fat: 7,
            fiber: 5,
            sugar: 2,
            sodium: 190,
            notes: 'Barcode match.',
            is_trusted: true,
            source_type: 'GENERIC_REFERENCE',
            source_name: 'Open Food Facts barcode match',
            catalog_food_id: null,
          },
        ],
        totals: {
          calories: 200,
          protein: 20,
          carbs: 22,
          fat: 7,
          fiber: 5,
          sugar: 2,
          sodium: 190,
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[]} />);

    fireEvent.click(screen.getByRole('button', { name: /open helper actions/i }));
    fireEvent.click(screen.getByRole('button', { name: /^barcode$/i }));
    fireEvent.change(screen.getByLabelText('Barcode digits'), {
      target: { value: '012345678905' },
    });
    fireEvent.click(screen.getByRole('button', { name: /use barcode/i }));

    await screen.findByText(/around 200 calories/i);

    expect(fetchMock).toHaveBeenCalled();
    expect(screen.getByText(/got it, that looks like packaged protein bar/i)).toBeInTheDocument();
    expect(screen.getAllByText(/packaged protein bar/i).length).toBeGreaterThan(0);
  });

  it('supports manual nutrition label entry for packaged foods', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        needs_clarification: false,
        clarifying_question: null,
        meal_type: 'snack',
        confidence_score: 0.95,
        items: [
          {
            food_name: 'Fairlife Core Power Elite',
            quantity: 1,
            unit: 'bottle',
            calories: 230,
            protein: 42,
            carbs: 9,
            fat: 3.5,
            fiber: 1,
            sugar: 7,
            sodium: 260,
            notes: 'Matched to a nutrition label you provided.',
            is_trusted: true,
            source_type: 'GENERIC_REFERENCE',
            source_name: 'User-provided nutrition label',
            catalog_food_id: null,
          },
        ],
        totals: {
          calories: 230,
          protein: 42,
          carbs: 9,
          fat: 3.5,
          fiber: 1,
          sugar: 7,
          sodium: 260,
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[]} />);

    fireEvent.click(screen.getByRole('button', { name: /open helper actions/i }));
    fireEvent.click(screen.getByRole('button', { name: /nutrition label/i }));
    fireEvent.change(screen.getByLabelText('Product name'), {
      target: { value: 'Fairlife Core Power Elite' },
    });
    fireEvent.change(screen.getByLabelText('Serving amount'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByLabelText('Serving unit'), {
      target: { value: 'bottle' },
    });
    fireEvent.change(screen.getByLabelText('Calories'), {
      target: { value: '230' },
    });
    fireEvent.change(screen.getByLabelText('Protein (g)'), {
      target: { value: '42' },
    });

    fireEvent.click(screen.getByRole('button', { name: /use label/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ai/parse-meal',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Fairlife Core Power Elite'),
        }),
      );
    });

    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"calories":230');
    expect(fetchMock.mock.calls[0]?.[1]?.body).toContain('"protein":42');
    expect(screen.getAllByText(/fairlife core power elite/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/around 230 calories/i)).toBeInTheDocument();
  });
});
