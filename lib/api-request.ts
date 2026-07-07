import { z } from 'zod';

export class ApiRequestParseError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestParseError';
  }
}

export async function parseJsonRequest<T>(
  request: Request,
  schema: z.ZodType<T>,
  message: string,
): Promise<T> {
  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    throw new ApiRequestParseError(400, message, error);
  }

  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiRequestParseError(400, message, error);
    }

    throw error;
  }
}
