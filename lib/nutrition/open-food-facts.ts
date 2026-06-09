import { normalizeBarcode } from '@/lib/barcode-lookup';

type OffProductResponse = {
  code?: string;
  product?: {
    _id?: string;
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    serving_size?: string;
    nutriments?: Record<string, unknown>;
  };
  status?: number;
};

function toNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function pickName(product: NonNullable<OffProductResponse['product']>) {
  return (product.product_name?.trim() || product.product_name_en?.trim() || '').trim();
}

function pickBrand(product: NonNullable<OffProductResponse['product']>) {
  const brands = (product.brands ?? '').split(',').map((b) => b.trim()).filter(Boolean);
  return brands[0] ?? null;
}

export async function fetchOpenFoodFactsByBarcode(barcode: string): Promise<
  | { found: false; barcode: string; raw: unknown }
  | {
      found: true;
      barcode: string;
      providerId: string;
      name: string;
      brand: string | null;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber: number;
      sugar: number;
      sodium: number;
      raw: unknown;
    }
> {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) {
    return { found: false, barcode: String(barcode), raw: null };
  }

  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${normalized}.json`, {
    headers: {
      'User-Agent': 'MacroMesh (calorie-compass) - barcode lookup',
    },
    // Keep this quick. If OFF is down, we fall back.
    cache: 'no-store',
  });

  const raw = (await response.json().catch(() => null)) as OffProductResponse | null;
  const status = raw?.status ?? null;

  if (!raw?.product || status !== 1) {
    return { found: false, barcode: normalized, raw };
  }

  const name = pickName(raw.product);
  const nutriments = raw.product.nutriments ?? {};

  // OFF nutrients are often per 100g. We treat this as a best-effort packaged-food snapshot
  // and keep review-before-save as the guardrail.
  const calories = toNumber(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal_serving'] ?? nutriments['energy-kcal']) ?? null;
  const protein = toNumber(nutriments['proteins_100g'] ?? nutriments['proteins_serving'] ?? nutriments['proteins']) ?? null;
  const carbs = toNumber(nutriments['carbohydrates_100g'] ?? nutriments['carbohydrates_serving'] ?? nutriments['carbohydrates']) ?? null;
  const fat = toNumber(nutriments['fat_100g'] ?? nutriments['fat_serving'] ?? nutriments['fat']) ?? null;
  const fiber = toNumber(nutriments['fiber_100g'] ?? nutriments['fiber_serving'] ?? nutriments['fiber']) ?? 0;
  const sugar = toNumber(nutriments['sugars_100g'] ?? nutriments['sugars_serving'] ?? nutriments['sugars']) ?? 0;
  const sodium = toNumber(nutriments['sodium_100g'] ?? nutriments['sodium_serving'] ?? nutriments['sodium']) ?? 0;

  if (!name || calories === null || protein === null || carbs === null || fat === null) {
    return { found: false, barcode: normalized, raw };
  }

  return {
    found: true,
    barcode: normalized,
    providerId: raw.product._id ?? raw.code ?? normalized,
    name,
    brand: pickBrand(raw.product),
    calories,
    protein,
    carbs,
    fat,
    fiber,
    sugar,
    sodium,
    raw,
  };
}

