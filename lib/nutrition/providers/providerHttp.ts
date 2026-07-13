import type { z } from 'zod';

export type ProviderErrorCategory =
  | 'invalid_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'timeout'
  | 'network_failure'
  | 'provider_unavailable'
  | 'invalid_payload'
  | 'unknown_provider_failure';

export class NutritionProviderError extends Error {
  readonly category: ProviderErrorCategory;
  readonly status: number | null;
  readonly retryCount: number;

  constructor(category: ProviderErrorCategory, options?: { status?: number | null; retryCount?: number }) {
    super(`Nutrition provider request failed: ${category}`);
    this.name = 'NutritionProviderError';
    this.category = category;
    this.status = options?.status ?? null;
    this.retryCount = options?.retryCount ?? 0;
  }
}

type ProviderJsonRequestOptions<T> = {
  url: string;
  allowedOrigins: readonly string[];
  init?: RequestInit;
  schema: z.ZodType<T>;
  timeoutMs: number;
  retries?: number;
  notFoundIsNull?: boolean;
};

export type ProviderJsonResult<T> = {
  data: T;
  retryCount: number;
  status: number;
  rateLimit: {
    limit: string | null;
    remaining: string | null;
    reset: string | null;
  };
};

function categoryForStatus(status: number): ProviderErrorCategory {
  if (status === 400) return 'invalid_request';
  if (status === 401) return 'unauthorized';
  if (status === 402) return 'quota_exhausted';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 408) return 'timeout';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'provider_unavailable';
  return 'unknown_provider_failure';
}

function shouldRetry(status: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function retryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers?.get?.('retry-after')?.trim();
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      const delay = seconds * 1_000;
      return delay <= 750 ? delay : null;
    }
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) {
      const delay = Math.max(0, date - Date.now());
      return delay <= 750 ? delay : null;
    }
  }
  if (response.status === 429) return null;
  return Math.min(100 * (2 ** attempt) + Math.floor(Math.random() * 50), 500);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertAllowedUrl(value: string, allowedOrigins: readonly string[]) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new NutritionProviderError('invalid_request');
  }

  if (url.protocol !== 'https:' || !allowedOrigins.includes(url.origin)) {
    throw new NutritionProviderError('invalid_request');
  }

  return url;
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers?.get?.('content-type')?.toLowerCase() ?? '';
  if (contentType && !contentType.includes('application/json') && !contentType.includes('+json')) {
    throw new NutritionProviderError('invalid_payload', { status: response.status });
  }

  if (typeof response.text === 'function') {
    const text = await response.text();
    if (!text.trim()) throw new NutritionProviderError('invalid_payload', { status: response.status });
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new NutritionProviderError('invalid_payload', { status: response.status });
    }
  }

  try {
    return await response.json();
  } catch {
    throw new NutritionProviderError('invalid_payload', { status: response.status });
  }
}

export async function requestProviderJson<T>(options: ProviderJsonRequestOptions<T>): Promise<ProviderJsonResult<T> | null> {
  const url = assertAllowedUrl(options.url, options.allowedOrigins);
  const retries = Math.max(0, Math.min(options.retries ?? 1, 2));

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options.init,
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(options.init?.headers ?? {}),
        },
      });

      if (!response.ok) {
        if (response.status === 404 && options.notFoundIsNull) return null;
        if (attempt < retries && shouldRetry(response.status)) {
          const retryDelay = retryDelayMs(response, attempt);
          if (retryDelay !== null) {
            await sleep(retryDelay);
            continue;
          }
        }
        throw new NutritionProviderError(categoryForStatus(response.status), {
          status: response.status,
          retryCount: attempt,
        });
      }

      const payload = await parseResponseBody(response);
      const parsed = options.schema.safeParse(payload);
      if (!parsed.success) {
        throw new NutritionProviderError('invalid_payload', {
          status: response.status,
          retryCount: attempt,
        });
      }

      return {
        data: parsed.data,
        retryCount: attempt,
        status: response.status,
        rateLimit: {
          limit: response.headers?.get?.('x-ratelimit-limit') ?? null,
          remaining: response.headers?.get?.('x-ratelimit-remaining') ?? null,
          reset: response.headers?.get?.('x-ratelimit-reset') ?? null,
        },
      };
    } catch (error) {
      if (error instanceof NutritionProviderError) throw error;

      const isAbort = error instanceof Error && error.name === 'AbortError';
      if (attempt < retries && !isAbort) {
        const retryDelay = retryDelayMs(new Response(null, { status: 503 }), attempt);
        if (retryDelay !== null) await sleep(retryDelay);
        continue;
      }
      throw new NutritionProviderError(isAbort ? 'timeout' : 'network_failure', { retryCount: attempt });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new NutritionProviderError('unknown_provider_failure');
}
