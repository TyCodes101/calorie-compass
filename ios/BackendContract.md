# Native iOS Backend Contract

This document captures the backend contract the native iOS foundation expects. It should stay aligned with the Next.js API routes.

## `POST /api/meal-assistant`

Purpose: run the conversational food logging assistant and return the next chat state plus reviewable meal items.

Request shape:

```json
{
  "message": "I had 2 eggs and toast",
  "state": {
    "currentMealItems": [],
    "pendingClarification": null,
    "lastAssistantQuestion": null,
    "userCorrections": [],
    "saved": false,
    "mealType": "breakfast",
    "userName": "Tyler",
    "currentMealText": null,
    "confidenceScore": 0.82
  },
  "context": {
    "favoriteMeals": [],
    "recentMeals": [],
    "nutritionPreferences": null,
    "proteinGoal": 160,
    "dailyCalorieGoal": 2200,
    "remainingProtein": 63,
    "remainingCalories": 720
  },
  "conversationHistory": [
    { "role": "assistant", "text": "Hey, what did you eat today?" },
    { "role": "user", "text": "I had 2 eggs and toast" }
  ]
}
```

Response shape:

```json
{
  "intent": "new_food_item",
  "assistant_reply": "I have 2 eggs and toast, around 240 calories.",
  "should_lookup_nutrition": true,
  "should_save_meal": false,
  "should_ask_clarification": false,
  "clarification_question": null,
  "confidence": "high",
  "meal": {
    "items": [],
    "totals": {
      "calories": 240,
      "protein": 16,
      "carbs": 20,
      "fat": 11,
      "fiber": 2,
      "sugar": 2,
      "sodium": 300
    },
    "confidence_score": 0.84
  },
  "next_state": {}
}
```

Notes:

- iOS should render `assistant_reply` in chat.
- iOS should replace local state with `next_state` after each successful response.
- iOS should render `meal.items` or `next_state.currentMealItems` in the review-before-save card.
- iOS should not save automatically unless the user clearly confirms.

## `POST /api/meals`

Purpose: save a reviewed meal.

Request shape:

```json
{
  "meal_type": "breakfast",
  "confidence_score": 0.84,
  "raw_text": "2 eggs and toast",
  "notes": null,
  "date": "2026-05-19T12:00:00.000Z",
  "source_reusable_meal_id": null,
  "items": []
}
```

Response shape:

```json
{
  "meal": {},
  "dashboard": {}
}
```

When no database is configured, the web app can return `localOnly: true`.

## Other existing endpoints

- `GET /api/dashboard?date=<iso-date>` returns dashboard summary data.
- `GET /api/session` returns account and user mode.
- `POST /api/profile` creates/saves profile data.
- `PATCH /api/profile` updates profile settings.
- `GET /api/profile/export` exports account data.
- `POST /api/profile/reset` resets account data.
- `PATCH /api/meals/[mealId]` updates a saved meal.
- `DELETE /api/meals/[mealId]` deletes a saved meal.

## Native API gaps

- Add `GET /api/history` for saved meal history. The web app currently renders history server-side.
- Add `GET /api/profile` or expand `GET /api/session` if native profile needs a full read endpoint.
- Add an authenticated production account flow before native release.
- Define CSRF/session-cookie behavior for iOS once auth leaves demo mode.
- Add structured error codes for offline/retry UX instead of relying only on message text.
- Add idempotency keys for native save requests to prevent duplicate saves after retries.
