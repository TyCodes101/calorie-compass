import { describe, expect, it } from 'vitest';

import {
  expectBaselineQuality,
  expectCorrectionReply,
  expectMealContains,
  expectMealDoesNotContain,
  expectMealItemCount,
  expectMealUnchanged,
  expectNoClarification,
  expectNoUnrelatedFood,
  expectReplyMatches,
  expectReplyNotMatches,
  runQaScenario,
} from './utils/assistantQaHarness';

describe('assistant real-user gauntlet', () => {
  it('preserves common foods through messy add, casual, and garbage turns', async () => {
    const conversation = await runQaScenario({
      name: 'grilled chicken rice berries casual garbage',
      messages: ['I had grilled chicken and rice', 'Add blueberries too', 'Thanks bro', 'asdfghjkl'],
    });
    const [initialTurn, berriesTurn, thanksTurn, garbageTurn] = conversation.turns;

    expectBaselineQuality(initialTurn);
    expectNoClarification(initialTurn);
    expectMealContains(initialTurn, [/grilled chicken|chicken breast|chicken/i, /rice/i]);
    expectNoUnrelatedFood(initialTurn, [/frozen dinner/i, /nutritional powder/i]);

    expectBaselineQuality(berriesTurn);
    expectCorrectionReply(berriesTurn);
    expectMealContains(berriesTurn, [/grilled chicken|chicken breast|chicken/i, /rice/i, /blueberr/i]);

    expectBaselineQuality(thanksTurn);
    expectMealUnchanged(thanksTurn);
    expectReplyNotMatches(thanksTurn, /i can log|need more detail/i, 'Thanks should stay conversational and preserve the active meal.');

    expectBaselineQuality(garbageTurn);
    expectMealUnchanged(garbageTurn);
    expectMealDoesNotContain(garbageTurn, [/asdfghjkl/i]);
    expectReplyNotMatches(garbageTurn, /i can log asdfghjkl/i, 'Keyboard-smash input should not become a food.');
  });

  it('handles everyday user foods without silently dropping salmon, avocado, or salsa', async () => {
    const salmonConversation = await runQaScenario({
      name: 'salmon rice logging',
      messages: ['I had salmon and rice'],
    });
    const salmonTurn = salmonConversation.turns[0];
    expectBaselineQuality(salmonTurn);
    expectNoClarification(salmonTurn);
    expectMealContains(salmonTurn, [/salmon/i, /rice/i]);

    const avocadoConversation = await runQaScenario({
      name: 'avocado removal from active meal',
      messages: ['I had chicken, rice, and avocado', 'Remove the avocado'],
    });
    const [avocadoInitial, removeAvocadoTurn] = avocadoConversation.turns;
    expectBaselineQuality(avocadoInitial);
    expectMealContains(avocadoInitial, [/chicken/i, /rice/i, /avocado/i]);
    expectBaselineQuality(removeAvocadoTurn);
    expectCorrectionReply(removeAvocadoTurn);
    expectMealContains(removeAvocadoTurn, [/chicken/i, /rice/i]);
    expectMealDoesNotContain(removeAvocadoTurn, [/avocado/i]);

    const chipotleConversation = await runQaScenario({
      name: 'chipotle generic salsa preservation',
      messages: ['I had a Chipotle bowl with chicken, rice, black beans, cheese, and salsa'],
    });
    const chipotleTurn = chipotleConversation.turns[0];
    expectBaselineQuality(chipotleTurn);
    expectMealContains(chipotleTurn, [/chipotle/i, /chicken/i, /rice/i, /beans/i, /cheese/i, /salsa/i]);
  });

  it('does not over-log vague bowls or nonsense, and starts a clean new meal after save', async () => {
    const vagueConversation = await runQaScenario({
      name: 'vague bowl clarification',
      messages: ['I had a bowl'],
    });
    const vagueTurn = vagueConversation.turns[0];
    expectBaselineQuality(vagueTurn);
    expectMealItemCount(vagueTurn, 0);
    expectReplyMatches(vagueTurn, /what kind of bowl|what was in it|what kind/i, 'Bare bowl input should ask a short clarification.');

    const nonsenseConversation = await runQaScenario({
      name: 'nonsense recovery without active meal',
      messages: ['asdfghjkl'],
    });
    const nonsenseTurn = nonsenseConversation.turns[0];
    expectBaselineQuality(nonsenseTurn);
    expectMealItemCount(nonsenseTurn, 0);
    expectReplyNotMatches(nonsenseTurn, /i can log asdfghjkl|asdfghjkl.*calories/i, 'Nonsense input should not create a fake food.');

    const saveConversation = await runQaScenario({
      name: 'save then new turkey sandwich',
      messages: ['I had 2 eggs, toast, and a banana', 'save it', 'Now I had a turkey sandwich'],
    });
    const [, saveTurn, sandwichTurn] = saveConversation.turns;
    expectBaselineQuality(saveTurn);
    expect(saveTurn.response.next_state.saved).toBe(true);
    expectBaselineQuality(sandwichTurn);
    expectMealContains(sandwichTurn, [/turkey sandwich|sandwich/i]);
    expectMealDoesNotContain(sandwichTurn, [/eggs?/i, /toast/i, /banana/i]);
  });

  it('survives a couple dozen realistic user turns without reset, drift, or stale corrections', async () => {
    const conversation = await runQaScenario({
      name: 'couple dozen realistic user inputs',
      messages: [
        'hey',
        'nothing yet',
        'okay i had 1 cup cottage cheese',
        'actually .75 cup',
        'no half cup',
        'add blueberries',
        'how much protein do I have left?',
        'save it',
        'for lunch i had a McDouble and medium fries',
        'remove fries and make the burger two',
        'that looks right save it',
        'later i had salmon and rice',
        'also my workout destroyed me today',
        'anyway add broccoli too',
        'actually add avocado',
        'remove the avocado',
        'what should I eat tonight?',
        'wait add a Fairlife Core Power Elite strawberry',
        'make it two',
        'save it',
        'for dinner I had chicken, potatoes, and salsa',
        'make the potatoes 2 cups and add a Coke Zero',
        'no remove the Coke',
        'done',
      ],
      context: {
        remainingCalories: 720,
        remainingProtein: 63,
        nutritionPreferences: 'high protein',
      },
    });

    for (const turn of conversation.turns) {
      expectBaselineQuality(turn);
      expectNoUnrelatedFood(turn, [/frozen dinner/i, /nutritional powder/i, /what a melon/i, /estimated mixed meal/i]);
      expectReplyNotMatches(turn, /i can log (?:asdf|thanks|that looks right|workout destroyed)/i, 'Conversation/meta turns should not become foods.');
    }

    const recommendationTurn = conversation.turns[16];
    expectMealUnchanged(recommendationTurn);
    expectReplyMatches(recommendationTurn, /chicken|turkey|salmon|steak|yogurt|cottage cheese|bowl|potatoes|tacos/i, 'Dinner advice should include real food ideas.');

    const fairlifeTurn = conversation.turns[17];
    expectMealContains(fairlifeTurn, [/fairlife|core power/i]);

    const twoFairlifeTurn = conversation.turns[18];
    expectCorrectionReply(twoFairlifeTurn);
    expectMealContains(twoFairlifeTurn, [/fairlife|core power/i]);

    const finalTurn = conversation.turns.at(-1);
    expect(finalTurn).toBeTruthy();
    expect(finalTurn!.response.next_state.saved).toBe(true);
    expectMealContains(finalTurn!, [/chicken/i, /potatoes/i, /salsa/i]);
    expectMealDoesNotContain(finalTurn!, [/coke/i]);
    expectReplyNotMatches(finalTurn!, /what'd you eat today|send the meal whenever/i, 'Long sessions should not feel like a reset.');
  });

  it('handles recommendation follow-ups as advice instead of logging random foods', async () => {
    const conversation = await runQaScenario({
      name: 'recommendation follow up no random lookup',
      messages: [
        'I had 1 cup cottage cheese',
        'what should I eat tonight?',
        'give me a yummy dinner idea',
        'no a yummy dinner ideas',
        'no i want a good idea for dinner',
      ],
      context: {
        remainingCalories: 720,
        remainingProtein: 63,
      },
    });

    const recommendationTurns = conversation.turns.slice(1);
    for (const turn of recommendationTurns) {
      expectBaselineQuality(turn);
      expectMealUnchanged(turn);
      expectReplyMatches(turn, /chicken|turkey|steak|salmon|bowl|potatoes|tacos|dinner/i, 'Recommendation follow-ups should provide food ideas.');
      expectReplyNotMatches(turn, /frozen dinner|usda|i can log/i, 'Recommendation follow-ups should not trigger food logging.');
    }
  });

  it('answers clarification meta-questions without nutrition lookup drift', async () => {
    const scenarios = [
      ['I had an omelette with some hashbrowns', 'like what'],
      ['I had cottage cheese', 'what detail do you need'],
      ['I had a sandwich', 'examples?'],
      ['I had a smoothie', 'what do you mean'],
    ] as const;

    for (const [foodTurn, metaTurn] of scenarios) {
      const conversation = await runQaScenario({
        name: `clarification meta follow-up: ${foodTurn}`,
        messages: [foodTurn, metaTurn],
      });

      const firstTurn = conversation.turns[0];
      const secondTurn = conversation.turns[1];

      expectBaselineQuality(firstTurn);
      if (firstTurn.response.should_ask_clarification) {
        expectMealItemCount(firstTurn, 0);
      }

      expectReplyNotMatches(secondTurn, /^(?:got it|okay|ok|yep|yeah|sure|sounds good)[.!]*$/i, 'Clarification meta replies should be specific, not dead-end.');
      expect(secondTurn.response.should_lookup_nutrition).toBe(false);
      if (firstTurn.response.should_ask_clarification) {
        expectMealItemCount(secondTurn, 0);
        expect(secondTurn.response.next_state.pendingClarification).toBeTruthy();
      } else {
        expectMealUnchanged(secondTurn);
      }
      expectReplyNotMatches(secondTurn, /what a melon|lollipop|frozen dinner|usda/i, 'Clarification meta replies should not map to random database foods.');
      expectReplyMatches(secondTurn, /how many|amount|size|ingredients|details|example|works|useful/i, 'Clarification meta reply should explain what details help.');
    }
  });

  it('keeps active meal stable across many frustration and pushback phrases', async () => {
    const frustrationPhrases = [
      'no',
      "that's wrong",
      'that is way off',
      'nah',
      'bro what',
      'try again',
      'wtf man',
      'huh',
      'wym',
      'wdym',
      'this makes no sense',
      'not even close',
      'you messed that up',
      'that is not right',
      'nope',
      'nvm',
      'wait what',
      'wrong item',
      'that was confusing',
      'fix that',
    ];

    const conversation = await runQaScenario({
      name: 'frustration phrase matrix',
      messages: ['I had 1 cup cottage cheese', ...frustrationPhrases],
    });

    const baselineTurn = conversation.turns[0];
    expectBaselineQuality(baselineTurn);
    expectMealContains(baselineTurn, [/cottage cheese/i]);

    for (const turn of conversation.turns.slice(1)) {
      expectBaselineQuality(turn);
      expectMealUnchanged(turn);
      expectMealContains(turn, [/cottage cheese/i]);
      expectReplyNotMatches(turn, /i can log/i, 'Frustration follow-ups should not be treated as new food logs.');
      expectReplyNotMatches(turn, /frozen dinner|what a melon|lollipop|usda/i, 'Frustration turns should not trigger unrelated lookup drift.');
    }
  });
});
