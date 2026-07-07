import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createCompletion: vi.fn(),
}));

vi.mock('openai', () => ({
  default: vi.fn(function OpenAIMock() {
    return {
      chat: {
        completions: {
          create: mocks.createCompletion,
        },
      },
    };
  }),
}));

import { POST as postFoodMatch } from '@/app/api/food-match/route';

function request(body: unknown) {
  return new Request('http://localhost/api/food-match', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('food match OpenAI security boundary', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    mocks.createCompletion.mockReset();
  });

  it('does not return or log raw model output when LLM JSON parsing fails', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const rawModelText = [
      'not json',
      'raw prompt: Wendy Baconator',
      'OPENAI_API_KEY=test-key',
    ].join(' | ');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.createCompletion.mockResolvedValue({
      choices: [{ message: { content: rawModelText } }],
    });

    const response = await postFoodMatch(request({ query: "Wendy's Baconator" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      confidence_label: 'Needs Review',
      source_type: 'parse_error',
      flag: 'NO_MATCH',
      system_signal: {
        type: 'PARSE_ERROR',
        raw_output: null,
      },
    });
    expect(JSON.stringify(payload)).not.toMatch(/Wendy Baconator|OPENAI_API_KEY|test-key|raw prompt/i);
    expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(/Wendy Baconator|OPENAI_API_KEY|test-key|raw prompt/i);
  });
});
