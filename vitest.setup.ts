import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Fixture tests import getMockParsedMeal directly; runtime tests keep the production-safe default.
process.env.ALLOW_MOCK_MEAL_PARSER = 'false';

afterEach(() => {
  cleanup();
});
