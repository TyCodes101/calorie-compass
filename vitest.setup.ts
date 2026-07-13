import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Fixture tests import getMockParsedMeal directly; runtime tests keep the production-safe default.
process.env.ALLOW_MOCK_MEAL_PARSER = 'false';
// Automated tests must never consume live nutrition-provider quota, even when
// a developer has credentials in an ignored local environment file.
process.env.CALORIE_API_KEY = '';
process.env.FATSECRET_CLIENT_ID = '';
process.env.FATSECRET_CLIENT_SECRET = '';

afterEach(() => {
  cleanup();
});
