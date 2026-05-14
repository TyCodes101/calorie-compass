import { describe, expect, it } from 'vitest';

import { buildLoggerIntentReply, buildLoggerGoalReply, buildLoggerQuestionReply, detectLoggerCommand, detectLoggerIntent } from '@/lib/logger-intent';

describe('logger intent detection', () => {
  it('detects greetings before nutrition parsing', () => {
    expect(detectLoggerIntent('hi')).toBe('greeting');
    expect(detectLoggerIntent('how are you?')).toBe('greeting');
  });

  it('detects clear food logs', () => {
    expect(detectLoggerIntent("McDouble from McDonald's")).toBe('food_log');
    expect(detectLoggerIntent('3 scrambled eggs and toast')).toBe('food_log');
  });

  it('treats follow-up fixes as corrections when a meal is already active', () => {
    expect(detectLoggerIntent('actually it was two', { hasActiveMeal: true })).toBe('correction');
    expect(detectLoggerIntent('remove cheese', { hasActiveMeal: true })).toBe('correction');
  });

  it('detects non-food questions separately', () => {
    expect(detectLoggerIntent('can you help me log lunch?')).toBe('nutrition_question');
    expect(detectLoggerIntent('how much protein do I have left?')).toBe('goal_question');
  });

  it('detects meal history questions and recommendation requests', () => {
    expect(detectLoggerIntent('what did I eat yesterday?')).toBe('meal_history_question');
    expect(detectLoggerIntent('what should I eat for lunch?')).toBe('recommendation_request');
  });

  it('detects casual non-food replies', () => {
    expect(detectLoggerIntent('okay cool')).toBe('casual');
  });

  it('builds a conversational greeting reply', () => {
    expect(buildLoggerIntentReply('greeting', { userName: 'Tyler Cox' })).toBe("Hey Tyler, what'd you eat?");
  });

  it('detects repeat-last-meal commands and builds goal replies', () => {
    expect(detectLoggerCommand('repeat my last meal', { hasRecentMeal: true })).toBe('repeat_last_meal');
    expect(detectLoggerCommand('cancel')).toBe('start_over');
    expect(detectLoggerCommand('edit it', { hasActiveMeal: true })).toBe('edit');
    expect(
      buildLoggerGoalReply('how much protein do I have left?', {
        proteinGoal: 195,
        todayProtein: 120,
        remainingProtein: 75,
        currentMealProtein: 42,
      }),
    ).toMatch(/162g/i);
    expect(buildLoggerQuestionReply('what can you do?')).toMatch(/save it/i);
  });
});
