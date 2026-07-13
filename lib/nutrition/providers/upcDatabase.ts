import { z } from 'zod';

import { normalizeBarcode } from '@/lib/nutrition/barcode';
import { buildProviderCacheKey, withProviderCache } from '@/lib/nutrition/providers/providerCache';
import { getUpcDatabaseConfiguration, UPC_DATABASE_API_BASE_URL } from '@/lib/nutrition/providers/providerConfig';
import { requestProviderJson } from '@/lib/nutrition/providers/providerHttp';

const METADATA_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const METADATA_MISS_TTL_MS = 5 * 60 * 1_000;

const successValue = z.preprocess((value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}, z.boolean());

const responseSchema = z.object({
  success: successValue,
  barcode: z.union([z.string(), z.number()]).transform(String).optional(),
  title: z.string().trim().min(1).nullable().optional(),
  alias: z.string().trim().min(1).nullable().optional(),
  description: z.string().trim().min(1).nullable().optional(),
  brand: z.string().trim().min(1).nullable().optional(),
  manufacturer: z.string().trim().min(1).nullable().optional(),
  category: z.string().trim().min(1).nullable().optional(),
  metadata: z.object({
    size: z.string().nullable().optional(),
    weight: z.string().nullable().optional(),
    quantity: z.string().nullable().optional(),
    unit: z.string().nullable().optional(),
  }).passthrough().nullable().optional(),
  error: z.object({
    code: z.union([z.string(), z.number()]).optional(),
    message: z.string().optional(),
  }).passthrough().nullable().optional(),
}).passthrough();

export type UpcProductMetadata = {
  barcode: string;
  title: string;
  brand: string | null;
  manufacturer: string | null;
  category: string | null;
  packageDescription: string | null;
};

export async function lookupUpcDatabaseMetadata(barcode: string): Promise<UpcProductMetadata | null> {
  const normalized = normalizeBarcode(barcode);
  const config = getUpcDatabaseConfiguration();
  if (!normalized || !config.configured || !config.apiKey) return null;

  const key = buildProviderCacheKey('upc-database:v1:metadata', normalized);
  const cached = await withProviderCache({
    key,
    ttlMs: METADATA_CACHE_TTL_MS,
    negativeTtlMs: METADATA_MISS_TTL_MS,
    load: async () => {
      const result = await requestProviderJson({
        url: `${config.baseUrl}/product/${encodeURIComponent(normalized)}`,
        allowedOrigins: [UPC_DATABASE_API_BASE_URL],
        init: { headers: { Authorization: `Bearer ${config.apiKey}` } },
        schema: responseSchema,
        timeoutMs: config.timeoutMs,
        notFoundIsNull: true,
      });
      const payload = result?.data;
      if (!payload?.success) return null;
      const responseBarcode = normalizeBarcode(payload.barcode ?? normalized);
      const title = payload.title?.trim() || payload.alias?.trim() || null;
      if (!responseBarcode || !title || responseBarcode.padStart(14, '0') !== normalized.padStart(14, '0')) return null;

      const packageDescription = [
        payload.metadata?.quantity,
        payload.metadata?.size,
        payload.metadata?.weight,
        payload.metadata?.unit,
      ].map((value) => value?.trim()).filter(Boolean).join(' ') || null;

      return {
        barcode: normalized,
        title,
        brand: payload.brand?.trim() || null,
        manufacturer: payload.manufacturer?.trim() || null,
        category: payload.category?.trim() || null,
        packageDescription,
      };
    },
  });
  return cached.value;
}
