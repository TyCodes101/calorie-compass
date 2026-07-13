import { afterEach, describe, expect, it, vi } from 'vitest';

import { fatSecretProvider } from '@/lib/nutrition/providers/fatsecret';
import { normalizeFoodQuery } from '@/lib/nutrition/normalizeFoodQuery';

function lookup(text: string) {
  return fatSecretProvider.lookup({
    text,
    mealType: 'snack',
    normalizedQuery: normalizeFoodQuery(text),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('FatSecret provider', () => {
  it('is optional and never calls the network without both credentials', async () => {
    vi.stubEnv('FATSECRET_CLIENT_ID', '');
    vi.stubEnv('FATSECRET_CLIENT_SECRET', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(fatSecretProvider.getStatus?.()).toMatchObject({ configured: false, reason: 'fatsecret_not_configured' });
    expect(await lookup('one protein bar')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps one branded bar to one provider serving and applies a two-bar request exactly twice', async () => {
    vi.stubEnv('FATSECRET_CLIENT_ID', 'client-test');
    vi.stubEnv('FATSECRET_CLIENT_SECRET', 'secret-test');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token-test', expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          foods_search: {
            results: {
              food: [{
                food_id: 'food-1',
                food_name: 'Creamy Crisp Protein Bar',
                brand_name: 'Barebells',
                food_type: 'Brand',
                servings: {
                  serving: {
                    serving_id: 'serving-1',
                    serving_description: '1 bar',
                    measurement_description: 'bar',
                    number_of_units: '1.000',
                    calories: '200',
                    protein: '20',
                    carbohydrate: '18',
                    fat: '7',
                    fiber: '2',
                    sugar: '2',
                    sodium: '150',
                    is_default: '1',
                  },
                },
              }],
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          foods_search: {
            results: {
              food: [{
                food_id: 'food-1',
                food_name: 'Creamy Crisp Protein Bar',
                brand_name: 'Barebells',
                food_type: 'Brand',
                servings: {
                  serving: {
                    serving_id: 'serving-1',
                    serving_description: '1 bar',
                    measurement_description: 'bar',
                    number_of_units: '1.000',
                    calories: '200',
                    protein: '20',
                    carbohydrate: '18',
                    fat: '7',
                    fiber: '2',
                    sugar: '2',
                    sodium: '150',
                    is_default: '1',
                  },
                },
              }],
            },
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const one = await lookup('one Barebells creamy crisp protein bar');
    expect(one?.items[0]).toMatchObject({ food_name: 'Barebells Creamy Crisp Protein Bar', quantity: 1, unit: 'bar', calories: 200, protein: 20, provider_used: 'fatsecret', match_type: 'verified_database' });

    const two = await lookup('two Barebells creamy crisp protein bars');
    expect(two?.items[0]).toMatchObject({ quantity: 2, unit: 'bar', calories: 400, protein: 40 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rejects a candidate whose brand does not agree with the requested brand', async () => {
    vi.stubEnv('FATSECRET_CLIENT_ID', 'client-mismatch');
    vi.stubEnv('FATSECRET_CLIENT_SECRET', 'secret-mismatch');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'token-mismatch', expires_in: 3600 }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          foods_search: {
            results: {
              food: [{
                food_id: 'wrong-food',
                food_name: 'Creamy Crisp Protein Bar',
                brand_name: 'Unrelated Brand',
                food_type: 'Brand',
                servings: { serving: { serving_description: '1 bar', measurement_description: 'bar', number_of_units: '1', calories: '200', protein: '20', carbohydrate: '18', fat: '7' } },
              }],
            },
          },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    expect(await lookup('one Barebells creamy crisp protein bar')).toBeNull();
  });
});
