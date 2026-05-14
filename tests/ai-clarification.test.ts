import { describe, expect, it } from 'vitest';

import { analyzeMealText } from '@/lib/ai/analyze';
import { buildClarificationDecision } from '@/lib/ai/clarification';

describe('clarification quality', () => {
  it('skips follow-ups for countable foods that already include quantity', () => {
    const examples = [
      '2 rice cakes',
      '1 banana',
      '3 eggs',
      '2 slices of toast',
      '1 protein bar',
      '1 Greek yogurt',
      '2 apples',
      '1 bagel',
      '3 quaker oats rice cakes white cheddar',
      '3 quaker oats rice cakes which are 50-60 cals each white cheddar',
    ];

    for (const example of examples) {
      const analysis = analyzeMealText(example);
      const result = buildClarificationDecision(analysis);

      expect(result.needsClarification).toBe(false);
      expect(result.question).toBeNull();
    }
  });

  it('estimates vague pasta instead of forcing a follow-up', () => {
    const analysis = analyzeMealText('I had pasta');
    const result = buildClarificationDecision(analysis);

    expect(result.needsClarification).toBe(false);
    expect(result.question).toBeNull();
  });

  it('estimates vague salad instead of forcing a dressing question first', () => {
    const analysis = analyzeMealText('I had a salad');
    const result = buildClarificationDecision(analysis);

    expect(result.needsClarification).toBe(false);
    expect(result.question).toBeNull();
  });

  it('estimates vague sandwich input instead of blocking review', () => {
    const analysis = analyzeMealText('I had a sandwich');
    const result = buildClarificationDecision(analysis);

    expect(result.needsClarification).toBe(false);
    expect(result.question).toBeNull();
  });

  it('estimates a plain protein shake when a reasonable default exists', () => {
    const analysis = analyzeMealText('protein shake');
    const result = buildClarificationDecision(analysis);

    expect(result.needsClarification).toBe(false);
    expect(result.question).toBeNull();
  });

  it('does not mistake branded rice cakes for generic rice', () => {
    const examples = ['white cheddar rice cakes', 'quaker rice cakes', 'rice cakes'];

    for (const example of examples) {
      const analysis = analyzeMealText(example);
      const result = buildClarificationDecision(analysis);

      expect(result.needsClarification).toBe(false);
      expect(result.question).toBeNull();
    }
  });
});
