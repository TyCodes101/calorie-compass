import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MealLoggerClient } from '@/components/meal-logger-client';

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
      expect(screen.getByText('Assistant estimate ready')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/980/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Looks right, save meal/i)).toBeInTheDocument();
    expect(screen.getByText(/I’ll keep your saved preferences in mind: high protein/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /looks right, save meal/i }));

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
      expect(screen.getByText(/Saved to today/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled();
    expect(refreshMock).toHaveBeenCalled();
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

    fireEvent.click(screen.getByRole('button', { name: /enter barcode/i }));
    fireEvent.change(screen.getByLabelText('Barcode digits'), {
      target: { value: '012345678905' },
    });
    fireEvent.click(screen.getByRole('button', { name: /look up barcode/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ai/parse-meal',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('012345678905'),
        }),
      );
    });

    expect(screen.getByText(/assistant estimate ready/i)).toBeInTheDocument();
    expect(screen.getByText(/packaged protein bar/i)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: /type nutrition label/i }));
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

    fireEvent.click(screen.getByRole('button', { name: /use nutrition label/i }));

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
    expect(screen.getByText(/assistant estimate ready/i)).toBeInTheDocument();
  });
});
