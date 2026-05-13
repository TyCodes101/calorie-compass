import { describe, expect, it } from 'vitest';

import { analyzeMealText } from '@/lib/ai/analyze';
import { buildClarificationDecision } from '@/lib/ai/clarification';

describe('clarification quality', () => {
  it('skips follow-ups for countable foods that already include quantity', () => {
    const examples = ['2 rice cakes', '1 banana', '3 eggs', '2 slices of toast', '1 protein bar', '1 Greek yogurt', '2 apples', '1 bagel'];

    for (const example of examples) {
      const analysis = analyzeMealText(example);
      const result = buildClarificationDecision(analysis);

      expect(result.needsClarification).toBe(false);
      expect(result.question).toBeNull();
    }
  });

  it('asks a sauce and protein question for vague pasta', () => {
    const analysis = analyzeMealText('I had pasta');
    const result = buildClarificationDecision(analysis);

    expect(result.needsClarification).toBe(true);
    expect(result.question).toMatch(/sauce or protein/i);
  });

  it('asks a dressing and protein question for vague salad', () => {
    const analysis = analyzeMealText('I had a salad');
    const result = buildClarificationDecision(analysis);

    expect(result.needsClarification).toBe(true);
    expect(result.question).toMatch(/dressing/i);
    expect(result.question).toMatch(/protein/i);
  });

  it('asks a size and add-on question for vague sandwich input', () => {
    const analysis = analyzeMealText('I had a sandwich');
    const result = buildClarificationDecision(analysis);

    expect(result.needsClarification).toBe(true);
    expect(result.question).toMatch(/what kind of sandwich/i);
  });

  it('keeps a plain protein shake ambiguous when no ingredients are given', () => {
    const analysis = analyzeMealText('protein shake');
    const result = buildClarificationDecision(analysis);

    expect(result.needsClarification).toBe(true);
    expect(result.question).toMatch(/what went in/i);
  });
});
