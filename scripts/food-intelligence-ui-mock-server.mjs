import http from 'node:http';

const port = Number(process.env.MACROMESH_UI_TEST_PORT || 8765);
let savedItems = [];

function food(name, calories, unit = 'bar') {
  const item = {
    food_name: name,
    quantity: 1,
    unit,
    calories,
    protein: 3,
    carbs: 27,
    fat: 11,
    fiber: 1,
    sugar: 21,
    sodium: 30,
    notes: 'Deterministic UI test database match.',
    is_trusted: true,
    source_type: 'GENERIC_REFERENCE',
    source_name: 'UI test nutrition database',
    confidence_label: 'Matched',
    match_type: 'exact_branded',
    provider_used: 'ui-test-provider',
    used_ai_fallback: false,
  };
  return {
    id: `ui:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    brand: 'KitKat',
    restaurant: null,
    sourceLabel: 'Database match',
    sourceType: 'GENERIC_REFERENCE',
    sourceName: 'UI test nutrition database',
    providerId: 'ui-test-provider',
    servingQuantity: 1,
    servingUnit: unit,
    calories,
    protein: 3,
    carbs: 27,
    fat: 11,
    barcode: null,
    mealType: 'snack',
    confidenceScore: 0.9,
    estimated: false,
    needsReview: false,
    reason: null,
    sourceReusableMealId: null,
    items: [item],
  };
}

const variants = [
  food('KitKat Milk Chocolate', 210),
  food('KitKat King Size', 420, 'package'),
  food('KitKat Mini', 90),
  food('KitKat White Creme', 220),
];

function send(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
  if (request.method === 'GET' && url.pathname === '/api/reusable-meals') {
    return send(response, 200, { favoriteMeals: [], recentMeals: [] });
  }
  if (request.method === 'GET' && url.pathname === '/api/food-search') {
    return send(response, 200, {
      query: url.searchParams.get('q') ?? '',
      normalizedQuery: 'KitKat',
      results: variants,
      clarificationQuestion: null,
      usedResolver: true,
      usedRanking: true,
      cache: { resolverHit: false, rankingHit: false, selectedResultHit: false },
    });
  }
  if (request.method === 'POST' && url.pathname === '/api/meals') {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const parsed = JSON.parse(body || '{}');
      savedItems = parsed.items ?? [];
      send(response, 200, {
        meal: {
          id: 'ui-saved-meal',
          mealType: 'SNACK',
          rawText: 'KitKat Milk Chocolate',
          totalCalories: 210,
          totalProtein: 3,
          totalCarbs: 27,
          totalFat: 11,
          itemCount: 1,
          trustedCount: 1,
          estimatedCount: 0,
          items: savedItems,
        },
        dashboard: null,
        localOnly: false,
      });
    });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/api/meals') {
    return send(response, 200, {
      meals: savedItems.length ? [{
        id: 'ui-saved-meal',
        mealType: 'SNACK',
        rawText: 'KitKat Milk Chocolate',
        totalCalories: 210,
        totalProtein: 3,
        totalCarbs: 27,
        totalFat: 11,
        itemCount: 1,
        trustedCount: 1,
        estimatedCount: 0,
        items: savedItems,
      }] : [],
    });
  }
  return send(response, 404, { error: 'Not found in UI test server.' });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`MacroMesh UI test server ready on ${port}\n`);
});
