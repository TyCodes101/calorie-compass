import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MealLoggerClient } from '@/components/meal-logger-client';
import { assistantMemoryStorageKey } from '@/lib/assistant-memory';
import type { MealAssistantResponse } from '@/lib/ai/mealAssistantSchema';
import type { ParsedFoodItem } from '@/lib/ai/types';
import type { RecentMealQuickLog } from '@/lib/history';

function buildItem(overrides?: Partial<ParsedFoodItem>): ParsedFoodItem {
  return {
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
    confidence_label: 'Verified',
    matched_query: null,
    original_user_text: null,
    provider_used: null,
    used_ai_fallback: false,
    catalog_food_id: 'chipotle_bowl_double_chicken',
    ...overrides,
  };
}

function buildAssistantResponse(overrides?: Partial<MealAssistantResponse>): MealAssistantResponse {
  const items = overrides?.meal?.items ?? [buildItem()];
  return {
    intent: 'new_food_item',
    assistant_reply: 'Got it, that looks like a Chipotle chicken bowl. Verified match.',
    items: [],
    corrections: [],
    should_lookup_nutrition: true,
    should_save_meal: false,
    should_ask_clarification: false,
    clarification_question: null,
    confidence: 'high',
    meal: {
      items,
      totals: {
        calories: 980,
        protein: 68,
        carbs: 74,
        fat: 34,
        fiber: 10,
        sugar: 4,
        sodium: 1760,
        ...overrides?.meal?.totals,
      },
      confidence_score: 0.96,
      ...overrides?.meal,
    },
    next_state: {
      currentMealItems: items,
      pendingClarification: null,
      lastAssistantQuestion: null,
      userCorrections: [],
      saved: false,
      mealType: 'lunch',
      userName: 'Tyler Cox',
      currentMealText: 'Chipotle bowl with white rice and chicken',
      confidenceScore: 0.96,
      sourceReusableMealId: null,
      editingMealId: null,
      ...overrides?.next_state,
    },
    ...overrides,
  };
}

function buildRecentMeal(overrides?: Partial<RecentMealQuickLog>): RecentMealQuickLog {
  return {
    id: 'recent-1',
    title: 'Chipotle chicken bowl',
    mealType: 'dinner',
    totalCalories: 980,
    createdAt: new Date().toISOString(),
    rawText: 'Chipotle chicken bowl',
    confidenceScore: 0.92,
    items: [buildItem()],
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
    window.localStorage.clear();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('shows quick suggestions on the first screen without cluttering the composer', () => {
    render(
      <MealLoggerClient
        favoriteMeals={[]}
        recentMeals={[buildRecentMeal()]}
        remainingProtein={52}
        remainingCalories={780}
      />,
    );

    expect(screen.getByText(/chipotle chicken bowl/i)).toBeInTheDocument();
    expect(screen.getByText(/protein left\?/i)).toBeInTheDocument();
    expect(screen.getByText(/tonight idea/i)).toBeInTheDocument();
    expect(screen.getByText(/talk naturally/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tell me what you ate')).toBeInTheDocument();
    expect(screen.queryByText(/^log meal$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/assistant/i)).toBeInTheDocument();
  });


  it('shows a polished starter panel with fast logging actions and today snapshot', () => {
    render(
      <MealLoggerClient
        favoriteMeals={[]}
        recentMeals={[]}
        remainingCalories={640}
        remainingProtein={38}
        todayMealCount={2}
      />,
    );

    const todaySnapshot = screen.getByLabelText(/today snapshot/i);

    expect(todaySnapshot).toBeInTheDocument();
    expect(within(todaySnapshot).getByText(/calories left/i)).toBeInTheDocument();
    expect(within(todaySnapshot).getByText(/protein left/i)).toBeInTheDocument();
    expect(screen.getByText(/fast ways to log/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try example/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^barcode$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nutrition label/i })).toBeInTheDocument();
  });

  it('hydrates assistant memory from server-seeded saved meals', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => buildAssistantResponse(),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(
      <MealLoggerClient
        favoriteMeals={[]}
        recentMeals={[]}
        seedAssistantMemory={{
          version: 1,
          syncStatus: 'local',
          updatedAt: '2026-05-14T19:00:00.000Z',
          recurringMeals: [
            {
              id: 'snack:fairlife elite 42g shake',
              title: 'Fairlife Elite 42g shake',
              rawText: 'Fairlife Elite 42g shake',
              mealType: 'snack',
              totalCalories: 230,
              confidenceScore: 0.96,
              source: 'saved',
              createdAt: '2026-05-14T19:00:00.000Z',
              lastUsedAt: '2026-05-14T19:00:00.000Z',
              count: 2,
              items: [buildItem()],
            },
          ],
          recurringFoods: [],
          commonRestaurants: [],
          commonBrands: [],
          preferredServingSizes: [],
          commonCorrections: [],
          mealTiming: [],
        }}
      />,
    );

    expect(screen.getByText(/fairlife elite 42g shake/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Tell me what you ate'), {
      target: { value: 'same as usual' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const request = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body ?? '{}'));
    expect(body.context.assistantMemory.recurringMeals[0]).toMatchObject({
      title: 'Fairlife Elite 42g shake',
      mealType: 'snack',
    });
  });

  it('adds a gentle consistency note on first load when recent logging is steady', () => {
    render(
      <MealLoggerClient
        favoriteMeals={[]}
        recentMeals={[
          buildRecentMeal({ id: 'recent-1', createdAt: new Date(Date.now() - 86400000).toISOString() }),
          buildRecentMeal({ id: 'recent-2', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() }),
          buildRecentMeal({ id: 'recent-3', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() }),
          buildRecentMeal({ id: 'recent-4', createdAt: new Date(Date.now() - 4 * 86400000).toISOString() }),
        ]}
      />,
    );

    expect(screen.getByText(/what'd you eat today\?/i)).toBeInTheDocument();
    expect(screen.getByText(/pretty steady lately/i)).toBeInTheDocument();
  });

  it('surfaces the week check-in quick action when enough recent meals exist', () => {
    render(
      <MealLoggerClient
        favoriteMeals={[]}
        recentMeals={[
          buildRecentMeal({ id: 'recent-1' }),
          buildRecentMeal({ id: 'recent-2', createdAt: new Date(Date.now() - 86400000).toISOString() }),
          buildRecentMeal({ id: 'recent-3', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() }),
          buildRecentMeal({ id: 'recent-4', createdAt: new Date(Date.now() - 3 * 86400000).toISOString() }),
        ]}
      />,
    );

    expect(screen.getByText(/week check-in/i)).toBeInTheDocument();
  });

  it('can send a quick suggestion as a one-tap assistant prompt', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        buildAssistantResponse({
          intent: 'nutrition_guidance',
          assistant_reply: "You've got about 52g of protein left today.",
          should_lookup_nutrition: false,
          meal: {
            items: [],
            totals: {
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              fiber: 0,
              sugar: 0,
              sodium: 0,
            },
            confidence_score: 0.82,
          },
          next_state: {
            currentMealItems: [],
            pendingClarification: null,
            lastAssistantQuestion: null,
            userCorrections: [],
            saved: false,
            mealType: 'snack',
            userName: 'Tyler Cox',
            currentMealText: null,
            confidenceScore: 0.82,
            sourceReusableMealId: null,
            editingMealId: null,
          },
        }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[buildRecentMeal()]} remainingProtein={52} remainingCalories={780} userName="Tyler Cox" />);

    fireEvent.click(screen.getByText(/protein left\?/i));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const request = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body ?? '{}'));
    expect(body.message).toBe('how much protein do I have left?');

    await waitFor(() => {
      expect(screen.getByText(/52g of protein left today/i)).toBeInTheDocument();
    });
  });

  it('opens barcode mode from a natural conversational request without calling the assistant API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[buildRecentMeal()]} />);

    fireEvent.change(screen.getByPlaceholderText('Tell me what you ate'), {
      target: { value: 'scan a barcode' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/barcode mode is open/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/barcode digits/i)).toBeInTheDocument();
  });

  it('handles voice logging requests gracefully without breaking the chat flow', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[buildRecentMeal()]} />);

    fireEvent.change(screen.getByPlaceholderText('Tell me what you ate'), {
      target: { value: 'can I log by voice?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/voice logging is next up/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/barcode digits/i)).not.toBeInTheDocument();
  });

  it('uses the meal-assistant route for conversational logging and still saves the reviewed meal', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => buildAssistantResponse(),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[buildRecentMeal()]} userName="Tyler Cox" />);

    fireEvent.change(screen.getByPlaceholderText('Tell me what you ate'), {
      target: { value: 'I had a Chipotle bowl with white rice, double chicken, corn salsa, cheese, and lettuce.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    await waitFor(() => {
      expect(screen.getByText(/got it, that looks like a chipotle chicken bowl/i)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/meal-assistant',
      expect.objectContaining({ method: 'POST' }),
    );

    const firstRequest = fetchMock.mock.calls[0]?.[1];
    const firstBody = JSON.parse(String(firstRequest?.body ?? '{}'));
    expect(firstBody.context).toMatchObject({
      favoriteMeals: [],
      recentMeals: expect.any(Array),
      proteinGoal: null,
      dailyCalorieGoal: null,
    });
    expect(firstBody.context.recentMeals[0]).toMatchObject({
      title: 'Chipotle chicken bowl',
      mealType: 'dinner',
    });
    expect(screen.getAllByText(/980/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^save it$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^save it$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/meals',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/saved it\. want to log anything else\?|all set, that one is logged\.|got it saved\. want to keep going\?/i)).toBeInTheDocument();
    });

    expect(refreshMock).toHaveBeenCalled();

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(assistantMemoryStorageKey) || '{}');
      expect(stored.recurringMeals?.[0]?.title).toMatch(/chipotle bowl with white rice and chicken/i);
    });
  });

  it('shows only the assistant reply from the conversational route for greetings', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        buildAssistantResponse({
          intent: 'casual_message',
          assistant_reply: "Hey Tyler, what'd you eat?",
          should_lookup_nutrition: false,
          meal: {
            items: [],
            totals: {
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              fiber: 0,
              sugar: 0,
              sodium: 0,
            },
            confidence_score: 0.82,
          },
          next_state: {
            currentMealItems: [],
            pendingClarification: null,
            lastAssistantQuestion: null,
            userCorrections: [],
            saved: false,
            mealType: 'snack',
            userName: 'Tyler Cox',
            currentMealText: null,
            confidenceScore: 0.82,
            sourceReusableMealId: null,
            editingMealId: null,
          },
        }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[]} userName="Tyler Cox" />);

    fireEvent.change(screen.getByPlaceholderText('Tell me what you ate'), {
      target: { value: 'hi' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    await waitFor(() => {
      expect(screen.getByText("Hey Tyler, what'd you eat?")).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/meal-assistant', expect.anything());
    expect(screen.queryByText(/980/)).not.toBeInTheDocument();
  });

  it('does not duplicate the initial assistant bubble when the screen rerenders', () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[]} />);

    expect(screen.getAllByText(/what'd you eat today\?/i)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Open helper actions' }));

    expect(screen.getAllByText(/what'd you eat today\?/i)).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('can repeat the last meal without hitting the assistant route', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[buildRecentMeal()]} />);

    fireEvent.change(screen.getByPlaceholderText('Tell me what you ate'), {
      target: { value: 'repeat my last meal' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/i loaded chipotle chicken bowl again/i)).toBeInTheDocument();
    expect(screen.getAllByText(/980/).length).toBeGreaterThan(0);
  });

  it('can send a conversational correction through the assistant route', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => buildAssistantResponse(),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () =>
          buildAssistantResponse({
            intent: 'correction',
            assistant_reply: 'Got it, I updated that to 2 Chipotle chicken bowls. Verified match.',
            meal: {
              items: [buildItem({ quantity: 2, calories: 1960, protein: 136, carbs: 148, fat: 68 })],
              totals: {
                calories: 1960,
                protein: 136,
                carbs: 148,
                fat: 68,
                fiber: 20,
                sugar: 8,
                sodium: 3520,
              },
              confidence_score: 0.96,
            },
            next_state: {
              currentMealItems: [buildItem({ quantity: 2, calories: 1960, protein: 136, carbs: 148, fat: 68 })],
              pendingClarification: null,
              lastAssistantQuestion: null,
              userCorrections: ['actually it was two'],
              saved: false,
              mealType: 'lunch',
              userName: 'Tyler Cox',
              currentMealText: '2 Chipotle chicken bowls',
              confidenceScore: 0.96,
              sourceReusableMealId: null,
              editingMealId: null,
            },
          }),
      });

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[]} userName="Tyler Cox" />);

    fireEvent.change(screen.getByPlaceholderText('Tell me what you ate'), {
      target: { value: 'Chipotle bowl with chicken' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    await waitFor(() => {
      expect(screen.getAllByText(/chipotle chicken bowl/i).length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByPlaceholderText('Tell me what you ate'), {
      target: { value: 'actually it was two' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    await waitFor(() => {
      expect(screen.getByText(/updated that to 2 chipotle chicken bowls/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText(/1960/).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('handles save it as a conversational command through the assistant route', async () => {
    const mealResponse = buildAssistantResponse();
    const saveResponse = buildAssistantResponse({
      intent: 'save_meal',
      assistant_reply: 'Saved. Anything else?',
      should_lookup_nutrition: false,
      should_save_meal: true,
      next_state: {
        ...mealResponse.next_state,
        saved: true,
      },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => mealResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => saveResponse });

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[]} userName="Tyler Cox" />);

    fireEvent.change(screen.getByPlaceholderText('Tell me what you ate'), {
      target: { value: 'chipotle bowl' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^save it$/i })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Tell me what you ate'), {
      target: { value: 'save it' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send meal' }));

    await waitFor(() => {
      expect(screen.getByText(/saved\. anything else\?|all set, that one is logged\.|got it saved\. want to keep going\?|that one is in\. anything else\?/i)).toBeInTheDocument();
    });

    expect(refreshMock).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/meal-assistant', expect.anything());
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
          buildItem({
            food_name: 'Coca-Cola Classic',
            unit: 'can',
            calories: 140,
            protein: 0,
            carbs: 39,
            fat: 0,
            fiber: 0,
            sugar: 39,
            sodium: 45,
            is_trusted: true,
            source_type: 'GENERIC_REFERENCE',
            source_name: 'Open Food Facts Coke match',
            catalog_food_id: null,
          }),
        ],
        totals: {
          calories: 140,
          protein: 0,
          carbs: 39,
          fat: 0,
          fiber: 0,
          sugar: 39,
          sodium: 45,
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open helper actions' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Barcode' }).at(-1)!);
    fireEvent.change(screen.getByLabelText('Barcode digits'), {
      target: { value: '5449000000996' },
    });
    fireEvent.click(screen.getByRole('button', { name: /use barcode/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/coca-cola classic/i).length).toBeGreaterThan(0);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/parse-meal', expect.anything());
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
          buildItem({
            food_name: 'Fairlife Core Power Elite',
            unit: 'bottle',
            calories: 230,
            protein: 42,
            carbs: 8,
            fat: 3,
            fiber: 0,
            sugar: 7,
            sodium: 260,
            is_trusted: true,
            source_type: 'GENERIC_REFERENCE',
            source_name: 'User-provided nutrition label',
            catalog_food_id: null,
          }),
        ],
        totals: {
          calories: 230,
          protein: 42,
          carbs: 8,
          fat: 3,
          fiber: 0,
          sugar: 7,
          sodium: 260,
        },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<MealLoggerClient favoriteMeals={[]} recentMeals={[]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open helper actions' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Nutrition label' }).at(-1)!);
    fireEvent.change(screen.getByLabelText('Product name'), {
      target: { value: 'Fairlife Core Power Elite' },
    });
    fireEvent.change(screen.getByLabelText('Calories'), {
      target: { value: '230' },
    });
    fireEvent.change(screen.getByLabelText('Protein (g)'), {
      target: { value: '42' },
    });
    fireEvent.click(screen.getByRole('button', { name: /use label/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/fairlife core power elite/i).length).toBeGreaterThan(0);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/parse-meal', expect.anything());
  });
});
