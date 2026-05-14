import { describe, expect, it } from 'vitest';

import { buildLoggerIntentReply, detectLoggerIntent } from '@/lib/logger-intent';

describe('logger intent detection', () => {
  it('detects greetings before nutrition parsing', () => {
    expect(detectLoggerIntent('hi')).toBe('greeting');
    expect(detectLoggerIntent('how are you?')).toBe('greeting');
  });

  it('detects clear food logs', () => {
    expect(detectLoggerIntent("McDouble from McDonald's")).toBe('food_log');
    expect(detectLoggerIntent('3 scrambled eggs and toast')).toBe('food_log');
  });

  it('detects non-food questions separately', () => {
    expect(detectLoggerIntent('can you help me log lunch?')).toBe('question');
  });

  it('builds a conversational greeting reply', () => {
    expect(buildLoggerIntentReply('greeting', { userName: 'Tyler Cox' })).toBe("Hey Tyler, what'd you eat?");
  });
});
