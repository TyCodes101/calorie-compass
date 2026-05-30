# Nutrition Accuracy Benchmark

Generated: 2026-05-30T00:52:18.671Z

This report measures the current deterministic nutrition pipeline against the Phase 9A baseline case set. Improvements must be interpreted as benchmark deltas, not as perfect nutrition accuracy.

## Overall

- Total tested: 125
- Passed: 96
- Failed: 29
- Recognition rate: 92%
- Exact-match rate: 66%
- Generic fallback rate: 0%
- Obvious wrong-result rate: 22%

## Summary by category

```json
{
  "branded": {
    "total": 25,
    "passed": 21,
    "failed": 4,
    "exactMatchPercentage": 76,
    "brandedMatchPercentage": 96,
    "restaurantMatchPercentage": 0,
    "genericFallbackPercentage": 0,
    "correctionSuccessPercentage": null
  },
  "restaurant": {
    "total": 25,
    "passed": 20,
    "failed": 5,
    "exactMatchPercentage": 60,
    "brandedMatchPercentage": 0,
    "restaurantMatchPercentage": 96,
    "genericFallbackPercentage": 0,
    "correctionSuccessPercentage": null
  },
  "grocery": {
    "total": 25,
    "passed": 16,
    "failed": 9,
    "exactMatchPercentage": 64,
    "brandedMatchPercentage": 52,
    "restaurantMatchPercentage": 0,
    "genericFallbackPercentage": 0,
    "correctionSuccessPercentage": null
  },
  "typo": {
    "total": 25,
    "passed": 19,
    "failed": 6,
    "exactMatchPercentage": 68,
    "brandedMatchPercentage": 72,
    "restaurantMatchPercentage": 20,
    "genericFallbackPercentage": 0,
    "correctionSuccessPercentage": null
  },
  "correction": {
    "total": 25,
    "passed": 20,
    "failed": 5,
    "exactMatchPercentage": 64,
    "brandedMatchPercentage": 48,
    "restaurantMatchPercentage": 24,
    "genericFallbackPercentage": 0,
    "correctionSuccessPercentage": 80
  }
}
```

## Confidence label distribution

- Very High: 64
- High: 36
- High; Low: 2
- missing: 10
- Low: 10
- Very High; High: 2
- Low; High: 1

## Top failure patterns

- branded: I had Fairlife Core Power Chocolate → Fairlife chocolate protein shake (Expected Fairlife Core Power Chocolate; got Fairlife chocolate protein shake.)
- branded: I had Fairlife Nutrition Plan Chocolate → Fairlife chocolate protein shake (Expected Fairlife Nutrition Plan Chocolate; got Fairlife chocolate protein shake.)
- branded: I had Gatorade Zero → Gatorade (Expected Gatorade Zero; got Gatorade.)
- branded: I had Muscle Milk Protein Shake → Milk, Protein shake (Expected Muscle Milk Protein Shake; got Milk, Protein shake.)
- restaurant: I had Dunkin cold brew → Dunkin' Medium Latte (Expected Dunkin Cold Brew; got Dunkin' Medium Latte.)
- restaurant: I had Dunkin wake-up wrap → Dunkin' Medium Latte (Expected Dunkin Wake-Up Wrap; got Dunkin' Medium Latte.)
- restaurant: I had Wendy's Dave's Single → Wendy's Spicy Chicken Sandwich (Expected Wendy's Dave's Single; got Wendy's Spicy Chicken Sandwich.)
- restaurant: I had Panda Express chow mein → Panda Express Orange Chicken (Expected Panda Express Chow Mein; got Panda Express Orange Chicken.)
- restaurant: I had Texas Roadhouse sirloin → no items (Expected Texas Roadhouse Sirloin; got no items.)
- grocery: I had white rice → Rice (Expected white rice; got Rice.)
- grocery: I had brown rice → Rice (Expected brown rice; got Rice.)
- grocery: I had sweet potato → Potatoes (Expected sweet potato; got Potatoes.)
- grocery: I had strawberries → no items (Expected strawberries; got no items.)
- grocery: I had almonds → no items (Expected almonds; got no items.)
- grocery: I had skim milk → Milk (Expected skim milk; got Milk.)
- grocery: I had cheddar cheese → no items (Expected cheddar cheese; got no items.)
- grocery: I had ground beef → no items (Expected ground beef; got no items.)
- grocery: I had cereal → no items (Expected cereal; got no items.)
- typo: I had premeir protein → no items (Expected Premier Protein; got no items.)
- typo: I had starbuks iced vanila latte → no items (Expected Starbucks Iced Vanilla Latte; got no items.)

## Benchmark limitations

- Current schema exposes only `Verified`, `High confidence`, and `Estimated`; the future Very High/High/Medium/Low model is not available yet.
- Provenance is inferred from current item fields: `source_type`, `source_name`, `confidence_label`, `provider_used`, and `used_ai_fallback`. Fallback path and source freshness are not first-class fields yet.
- This benchmark runs in local test mode without live OpenAI/USDA/Nutritionix calls, so it primarily measures deterministic/catalog/mock behavior. Live-provider accuracy must be measured separately when those services are enabled.
- Pass/fail is identity/category based, not calorie-perfect. Macro/calorie conflict scoring belongs in the future sanity/conflict engine.
- Correction scenarios are measured by final meal identity after turns, not by every intermediate assistant reply.

## Results

| # | Test case | Input prompt | Expected identity | Actual identity | Expected category | Actual category | Source | Confidence | Match | Pass/fail | Notes |
|---:|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Quest BBQ Protein Chips | I had Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | branded | branded | Quest nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 2 | Quest Nacho Cheese Protein Chips | I had Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | branded | branded | Quest nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 3 | Fairlife Core Power Chocolate | I had Fairlife Core Power Chocolate | Fairlife Core Power Chocolate | Fairlife chocolate protein shake | branded | branded | Fairlife nutrition reference | High | miss | FAIL | Expected Fairlife Core Power Chocolate; got Fairlife chocolate protein shake. |
| 4 | Fairlife Nutrition Plan Chocolate | I had Fairlife Nutrition Plan Chocolate | Fairlife Nutrition Plan Chocolate | Fairlife chocolate protein shake | branded | branded | Fairlife nutrition reference | High | miss | FAIL | Expected Fairlife Nutrition Plan Chocolate; got Fairlife chocolate protein shake. |
| 5 | Premier Protein Chocolate Shake | I had Premier Protein Chocolate Shake | Premier Protein Chocolate Shake | Premier Protein Shake | branded | branded | Premier Protein nutrition reference | High | fuzzy | PASS | Pass under current benchmark criteria. |
| 6 | David Sunflower Seeds | I had David Sunflower Seeds | David Sunflower Seeds | David Sunflower Seeds | branded | branded | David nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 7 | Chobani Greek Yogurt Strawberry | I had Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | branded | branded | Chobani nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 8 | Oikos Triple Zero Vanilla | I had Oikos Triple Zero Vanilla | Oikos Triple Zero Vanilla | Oikos Triple Zero Greek Yogurt | branded | branded | Oikos nutrition reference | High | fuzzy | PASS | Pass under current benchmark criteria. |
| 9 | Kodiak Cakes Protein Pancake Mix | I had Kodiak Cakes Protein Pancake Mix | Kodiak Cakes Protein Pancake Mix | Kodiak Cakes Protein Pancake Mix | branded | branded | Kodiak Cakes nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 10 | Coke Zero | I had Coke Zero | Coke Zero | Coke Zero | branded | branded | Coca-Cola nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 11 | Dr Pepper Zero | I had Dr Pepper Zero | Dr Pepper Zero | Dr Pepper Zero | branded | branded | Dr Pepper nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 12 | Doritos Nacho Cheese | I had Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | branded | branded | Doritos nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 13 | Goldfish Crackers | I had Goldfish Crackers | Goldfish Crackers | Goldfish Crackers | branded | branded | Goldfish nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 14 | Barebells Protein Bar | I had Barebells Protein Bar | Barebells Protein Bar | Barebells Protein Bar | branded | branded | Barebells nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 15 | Legendary Foods Protein Pastry | I had Legendary Foods Protein Pastry | Legendary Foods Protein Pastry | Legendary Foods Protein Pastry | branded | branded | Legendary Foods nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 16 | Pure Protein Bar | I had Pure Protein Bar | Pure Protein Bar | Pure Protein Bar | branded | branded | Pure Protein nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 17 | Nature Valley Granola Bar | I had Nature Valley Granola Bar | Nature Valley Granola Bar | Nature Valley Granola Bar | branded | branded | Nature Valley nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 18 | Quaker Rice Cakes | I had Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | branded | branded | Quaker nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 19 | Gatorade Zero | I had Gatorade Zero | Gatorade Zero | Gatorade | branded | branded | Gatorade nutrition reference | High | miss | FAIL | Expected Gatorade Zero; got Gatorade. |
| 20 | Celsius Energy Drink | I had Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | branded | branded | Celsius nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 21 | Pop-Tarts Frosted Strawberry | I had Pop-Tarts Frosted Strawberry | Pop-Tarts Frosted Strawberry | Pop-Tarts Frosted Strawberry | branded | branded | Pop-Tarts nutrition reference | Very High | exact | PASS | Pass under current benchmark criteria. |
| 22 | Cheez-It Original | I had Cheez-It Original | Cheez-It Original | Cheez-It Original | branded | branded | Cheez-It nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 23 | Clif Bar Chocolate Chip | I had Clif Bar Chocolate Chip | Clif Bar Chocolate Chip | Clif Bar Chocolate Chip | branded | branded | Clif Bar nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 24 | RXBAR Chocolate Sea Salt | I had RXBAR Chocolate Sea Salt | RXBAR Chocolate Sea Salt | RXBAR Chocolate Sea Salt | branded | branded | RXBAR nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 25 | Muscle Milk Protein Shake | I had Muscle Milk Protein Shake | Muscle Milk Protein Shake | Milk, Protein shake | branded | estimated | Milk common serving estimate; Protein shake common serving estimate | High; Low | fuzzy | FAIL | Expected Muscle Milk Protein Shake; got Milk, Protein shake. |
| 26 | McDonald's Big Mac | I had McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | restaurant | restaurant | McDonald's official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 27 | McDonald's McChicken | I had McDonald's McChicken | McDonald's McChicken | McDonald's McChicken | restaurant | restaurant | McDonald's official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 28 | McDonald's Medium Fries | I had McDonald's medium fries | McDonald's Medium Fries | McDonald's medium fries | restaurant | restaurant | McDonald's official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 29 | Chick-fil-A 12 count nuggets | I had Chick-fil-A 12 count nuggets | Chick-fil-A 12 count nuggets | 12 Chick-fil-A Nuggets | restaurant | restaurant | Chick-fil-A official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 30 | Chick-fil-A Spicy Deluxe Sandwich | I had Chick-fil-A spicy deluxe sandwich | Chick-fil-A Spicy Deluxe Sandwich | Chick-fil-A Chicken Sandwich | restaurant | restaurant | Chick-fil-A official nutrition | Very High | fuzzy | PASS | Pass under current benchmark criteria. |
| 31 | Chipotle Chicken Bowl | I had Chipotle chicken bowl | Chipotle Chicken Bowl | Chipotle bowl with chicken, white rice, black beans | restaurant | restaurant | Chipotle official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 32 | Chipotle Chicken Burrito | I had Chipotle burrito with chicken | Chipotle Chicken Burrito | Chipotle chicken bowl | restaurant | restaurant | Chipotle official nutrition | Very High | fuzzy | PASS | Pass under current benchmark criteria. |
| 33 | Starbucks Venti Iced Vanilla Latte | I had Starbucks venti iced vanilla latte | Starbucks Venti Iced Vanilla Latte | Starbucks Caffe Latte Venti | restaurant | restaurant | Starbucks official nutrition | Very High | fuzzy | PASS | Pass under current benchmark criteria. |
| 34 | Starbucks Grande Pink Drink | I had Starbucks grande pink drink | Starbucks Grande Pink Drink | Starbucks Grande Pink Drink | restaurant | restaurant | Starbucks nutrition reference | High | exact | PASS | Pass under current benchmark criteria. |
| 35 | Dunkin Cold Brew | I had Dunkin cold brew | Dunkin Cold Brew | Dunkin' Medium Latte | restaurant | restaurant | Dunkin' official nutrition | Very High | miss | FAIL | Expected Dunkin Cold Brew; got Dunkin' Medium Latte. |
| 36 | Dunkin Wake-Up Wrap | I had Dunkin wake-up wrap | Dunkin Wake-Up Wrap | Dunkin' Medium Latte | restaurant | restaurant | Dunkin' official nutrition | Very High | miss | FAIL | Expected Dunkin Wake-Up Wrap; got Dunkin' Medium Latte. |
| 37 | Taco Bell Crunchwrap Supreme | I had Taco Bell Crunchwrap Supreme | Taco Bell Crunchwrap Supreme | Taco Bell Crunchwrap Supreme | restaurant | restaurant | Taco Bell nutrition reference | High | exact | PASS | Pass under current benchmark criteria. |
| 38 | Taco Bell Soft Taco | I had Taco Bell soft taco | Taco Bell Soft Taco | Taco Bell Spicy Potato Soft Taco | restaurant | restaurant | Taco Bell official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 39 | Wendy's Dave's Single | I had Wendy's Dave's Single | Wendy's Dave's Single | Wendy's Spicy Chicken Sandwich | restaurant | restaurant | Wendy's official nutrition | Very High | miss | FAIL | Expected Wendy's Dave's Single; got Wendy's Spicy Chicken Sandwich. |
| 40 | Wendy's Spicy Chicken Sandwich | I had Wendy's spicy chicken sandwich | Wendy's Spicy Chicken Sandwich | Wendy's Spicy Chicken Sandwich | restaurant | restaurant | Wendy's official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 41 | Panera Mac and Cheese | I had Panera mac and cheese | Panera Mac and Cheese | Panera Mac and Cheese | restaurant | restaurant | Panera official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 42 | Subway Turkey Footlong | I had Subway turkey footlong | Subway Turkey Footlong | Subway Turkey Footlong | restaurant | restaurant | Subway official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 43 | Panda Express Orange Chicken | I had Panda Express orange chicken | Panda Express Orange Chicken | Panda Express Orange Chicken | restaurant | restaurant | Panda Express official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 44 | Panda Express Chow Mein | I had Panda Express chow mein | Panda Express Chow Mein | Panda Express Orange Chicken | restaurant | restaurant | Panda Express official nutrition | Very High | miss | FAIL | Expected Panda Express Chow Mein; got Panda Express Orange Chicken. |
| 45 | Raising Cane's Box Combo | I had Raising Cane's Box Combo | Raising Cane's Box Combo | Raising Cane's Caniac Combo | restaurant | restaurant | Raising Cane's official nutrition | Very High | fuzzy | PASS | Pass under current benchmark criteria. |
| 46 | Texas Roadhouse Sirloin | I had Texas Roadhouse sirloin | Texas Roadhouse Sirloin | — | restaurant | unknown | — | — | miss | FAIL | Expected Texas Roadhouse Sirloin; got no items. |
| 47 | KFC Famous Bowl | I had KFC famous bowl | KFC Famous Bowl | KFC Famous Bowl | restaurant | restaurant | KFC official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 48 | Burger King Whopper | I had Burger King Whopper | Burger King Whopper | Burger King Whopper | restaurant | restaurant | Burger King official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 49 | Popeyes Chicken Sandwich | I had Popeyes chicken sandwich | Popeyes Chicken Sandwich | Chick-fil-A Chicken Sandwich | restaurant | restaurant | Chick-fil-A official nutrition | Very High | fuzzy | PASS | Pass under current benchmark criteria. |
| 50 | Jersey Mike's Turkey Sub | I had Jersey Mike's turkey sub | Jersey Mike's Turkey Sub | Jersey Mike's Turkey Sub Regular | restaurant | restaurant | Jersey Mike's official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 51 | apple | I had apple | apple | Apple | generic | estimated | Apple common serving estimate | Low | exact | PASS | Pass under current benchmark criteria. |
| 52 | banana | I had banana | banana | Banana | generic | estimated | Banana common serving estimate | Low | exact | PASS | Pass under current benchmark criteria. |
| 53 | white rice | I had white rice | white rice | Rice | generic | branded | Rice common serving estimate | High | miss | FAIL | Expected white rice; got Rice. |
| 54 | brown rice | I had brown rice | brown rice | Rice | generic | branded | Rice common serving estimate | High | miss | FAIL | Expected brown rice; got Rice. |
| 55 | chicken breast | I had chicken breast | chicken breast | Chicken, Grilled chicken breast | generic | branded | Chicken common serving estimate; Grilled chicken common serving estimate | High | exact | PASS | Pass under current benchmark criteria. |
| 56 | salmon | I had salmon | salmon | Salmon | generic | branded | Salmon common serving estimate | High | exact | PASS | Pass under current benchmark criteria. |
| 57 | eggs | I had eggs | eggs | Eggs | generic | estimated | Egg common serving estimate | Low | exact | PASS | Pass under current benchmark criteria. |
| 58 | oatmeal | I had oatmeal | oatmeal | Oatmeal | generic | branded | Oatmeal common serving estimate | High | exact | PASS | Pass under current benchmark criteria. |
| 59 | peanut butter toast | I had peanut butter toast | peanut butter toast | Peanut butter, Toast | generic | estimated | Peanut butter common serving estimate; Toast common serving estimate | High; Low | exact | PASS | Pass under current benchmark criteria. |
| 60 | Greek yogurt | I had Greek yogurt | Greek yogurt | Greek yogurt | generic | estimated | Calorie Compass common-food fallback | Low | exact | PASS | Pass under current benchmark criteria. |
| 61 | broccoli | I had broccoli | broccoli | Broccoli | generic | branded | Broccoli common serving estimate | High | exact | PASS | Pass under current benchmark criteria. |
| 62 | potato | I had potato | potato | Potatoes | generic | branded | Potatoes common serving estimate | High | exact | PASS | Pass under current benchmark criteria. |
| 63 | sweet potato | I had sweet potato | sweet potato | Potatoes | generic | branded | Potatoes common serving estimate | High | miss | FAIL | Expected sweet potato; got Potatoes. |
| 64 | avocado | I had avocado | avocado | Avocado | generic | branded | Avocado common serving estimate | High | exact | PASS | Pass under current benchmark criteria. |
| 65 | strawberries | I had strawberries | strawberries | — | generic | unknown | — | — | miss | FAIL | Expected strawberries; got no items. |
| 66 | blueberries | I had blueberries | blueberries | Blueberries | generic | branded | Blueberry common serving reference | High | exact | PASS | Pass under current benchmark criteria. |
| 67 | almonds | I had almonds | almonds | — | generic | unknown | — | — | miss | FAIL | Expected almonds; got no items. |
| 68 | whole milk | I had whole milk | whole milk | Whole milk | generic | branded | Whole milk common serving estimate | High | exact | PASS | Pass under current benchmark criteria. |
| 69 | skim milk | I had skim milk | skim milk | Milk | generic | branded | Milk common serving estimate | High | miss | FAIL | Expected skim milk; got Milk. |
| 70 | cheddar cheese | I had cheddar cheese | cheddar cheese | — | generic | unknown | — | — | miss | FAIL | Expected cheddar cheese; got no items. |
| 71 | ground beef | I had ground beef | ground beef | — | generic | unknown | — | — | miss | FAIL | Expected ground beef; got no items. |
| 72 | turkey sandwich | I had turkey sandwich | turkey sandwich | Turkey sandwich | generic | branded | Turkey sandwich common serving estimate | High | exact | PASS | Pass under current benchmark criteria. |
| 73 | pasta | I had pasta | pasta | 1.5 Cooked pasta | generic | estimated | Generic nutrition reference | Low | exact | PASS | Pass under current benchmark criteria. |
| 74 | cereal | I had cereal | cereal | — | generic | unknown | — | — | miss | FAIL | Expected cereal; got no items. |
| 75 | orange juice | I had orange juice | orange juice | Orange juice | generic | estimated | Orange juice common serving estimate | Low | exact | PASS | Pass under current benchmark criteria. |
| 76 | quest bbq protien chips | I had quest bbq protien chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | branded | branded | Quest nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 77 | fairlife choclate shake | I had fairlife choclate shake | Fairlife Chocolate Shake | Fairlife protein shake | branded | branded | Fairlife nutrition reference | High | fuzzy | PASS | Pass under current benchmark criteria. |
| 78 | premeir protein | I had premeir protein | Premier Protein | — | branded | unknown | — | — | miss | FAIL | Expected Premier Protein; got no items. |
| 79 | chick fil a nuggest | I had chick fil a nuggest | Chick-fil-A Nuggets | Chick-fil-A Chicken Sandwich | branded | restaurant | Chick-fil-A official nutrition | Very High | fuzzy | PASS | Pass under current benchmark criteria. |
| 80 | mcdonalds bigmac | I had mcdonalds bigmac | McDonald's Big Mac | McDonald's Big Mac | branded | restaurant | McDonald's official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 81 | starbuks iced vanila latte | I had starbuks iced vanila latte | Starbucks Iced Vanilla Latte | — | branded | unknown | — | — | miss | FAIL | Expected Starbucks Iced Vanilla Latte; got no items. |
| 82 | chipoltle chicken bowl | I had chipoltle chicken bowl | Chipotle Chicken Bowl | Chicken | branded | branded | Chicken common serving estimate | High | miss | FAIL | Expected Chipotle Chicken Bowl; got Chicken. |
| 83 | dorittos nacho chees | I had dorittos nacho chees | Doritos Nacho Cheese | Doritos Nacho Cheese | branded | branded | Doritos nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 84 | chobanni greek yogurt | I had chobanni greek yogurt | Chobani Greek Yogurt | Chobani Greek Yogurt Strawberry | branded | branded | Chobani nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 85 | oikos tripple zero | I had oikos tripple zero | Oikos Triple Zero | Oikos Triple Zero Greek Yogurt | branded | branded | Oikos nutrition reference | High | exact | PASS | Pass under current benchmark criteria. |
| 86 | coke zerro | I had coke zerro | Coke Zero | Coke | branded | branded | Coca-Cola common serving estimate | High | miss | FAIL | Expected Coke Zero; got Coke. |
| 87 | dr peper zero | I had dr peper zero | Dr Pepper Zero | Dr Pepper Zero | branded | branded | Dr Pepper nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 88 | panda expres orange chicken | I had panda expres orange chicken | Panda Express Orange Chicken | Chicken | branded | branded | Chicken common serving estimate | High | miss | FAIL | Expected Panda Express Orange Chicken; got Chicken. |
| 89 | tacobell crunch wrap | I had tacobell crunch wrap | Taco Bell Crunchwrap | Taco Bell Crunchwrap Supreme | branded | restaurant | Taco Bell nutrition reference | High | exact | PASS | Pass under current benchmark criteria. |
| 90 | wendys daves single | I had wendys daves single | Wendy's Dave's Single | Wendy's Spicy Chicken Sandwich | branded | restaurant | Wendy's official nutrition | Very High | miss | FAIL | Expected Wendy's Dave's Single; got Wendy's Spicy Chicken Sandwich. |
| 91 | subway turky footlong | I had subway turky footlong | Subway Turkey Footlong | Subway Turkey Footlong | branded | restaurant | Subway official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 92 | kodiac cakes | I had kodiac cakes | Kodiak Cakes | Kodiak Cakes Protein Pancake Mix | branded | branded | Kodiak Cakes nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 93 | gold fish crackers | I had gold fish crackers | Goldfish Crackers | Goldfish Crackers | branded | branded | Goldfish nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 94 | cheez its | I had cheez its | Cheez-It | Cheez-It Original | branded | branded | Cheez-It nutrition reference | Very High | exact | PASS | Pass under current benchmark criteria. |
| 95 | barebell protein bar | I had barebell protein bar | Barebells Protein Bar | Barebells Protein Bar | branded | branded | Barebells nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 96 | legendairy protein pastry | I had legendairy protein pastry | Legendary Protein Pastry | Legendary Foods Protein Pastry | branded | branded | Legendary Foods nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 97 | quaker rice cake | I had quaker rice cake | Quaker Rice Cake | Quaker Rice Cakes | branded | branded | Quaker nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 98 | celsius drink | I had celsius drink | Celsius | Celsius Energy Drink | branded | branded | Celsius nutrition reference | High | exact | PASS | Pass under current benchmark criteria. |
| 99 | musclemilk shake | I had musclemilk shake | Muscle Milk Shake | Muscle Milk Protein Shake | branded | branded | Muscle Milk nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 100 | poptart strawberry | I had poptart strawberry | Pop-Tarts Strawberry | Pop-Tarts Frosted Strawberry | branded | branded | Pop-Tarts nutrition reference · high-confidence product match | Very High | exact | PASS | Pass under current benchmark criteria. |
| 101 | I had a banana → Actually make it 2 bananas | I had a banana → Actually make it 2 bananas | 2 Banana | 2 Banana | generic | estimated | Banana common serving estimate | Low | exact | PASS | Pass under current benchmark criteria. |
| 102 | I had Premier Protein → Actually it was Fairlife | I had Premier Protein → Actually it was Fairlife | Fairlife | Fairlife protein shake | generic | branded | Fairlife nutrition reference | High | exact | PASS | Pass under current benchmark criteria. |
| 103 | I had Quest chips → Actually BBQ flavor | I had Quest chips → Actually BBQ flavor | Quest BBQ | Quest BBQ Protein Chips | generic | branded | Quest nutrition reference | High | exact | PASS | Pass under current benchmark criteria. |
| 104 | I had fries → Make them medium fries | I had fries → Make them medium fries | Medium Fries | Medium fries | generic | estimated | Fries common serving estimate | Low | exact | PASS | Pass under current benchmark criteria. |
| 105 | I had white rice → Change it to brown rice | I had white rice → Change it to brown rice | Brown Rice | Rice | generic | branded | Rice common serving estimate | High | miss | FAIL | Expected Brown Rice; got Rice. |
| 106 | I had chicken → Make it 6 oz grilled chicken | I had chicken → Make it 6 oz grilled chicken | Grilled Chicken | 6 Chicken | generic | branded | Chicken common serving estimate | High | miss | FAIL | Expected Grilled Chicken; got 6 Chicken. |
| 107 | I had a Big Mac and fries → Remove the fries | I had a Big Mac and fries → Remove the fries | Big Mac | McDonald's Big Mac | generic | restaurant | McDonald's official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 108 | I had a Starbucks latte → Make it venti | I had a Starbucks latte → Make it venti | Venti Starbucks Latte | — | generic | unknown | — | — | miss | FAIL | Expected Venti Starbucks Latte; got no items. |
| 109 | I had Chipotle chicken bowl → Add extra chicken | I had Chipotle chicken bowl → Add extra chicken | Chipotle Chicken Bowl Extra Chicken | Chipotle bowl with chicken, white rice, black beans, Chicken | generic | restaurant | Chipotle official nutrition; Chicken common serving estimate | Very High; High | fuzzy | PASS | Pass under current benchmark criteria. |
| 110 | I had a protein shake → Actually it was Fairlife Core Power | I had a protein shake → Actually it was Fairlife Core Power | Fairlife Core Power | Fairlife protein shake | generic | branded | Fairlife nutrition reference | High | miss | FAIL | Expected Fairlife Core Power; got Fairlife protein shake. |
| 111 | I had McDonald's burger → Actually Big Mac | I had McDonald's burger → Actually Big Mac | Big Mac | McDonald's Big Mac | generic | restaurant | McDonald's official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 112 | I had 12 nuggets → Actually Chick-fil-A 12 count nuggets | I had 12 nuggets → Actually Chick-fil-A 12 count nuggets | Chick-fil-A 12 count nuggets | 12 Chick-fil-A Nuggets | generic | restaurant | Chick-fil-A official nutrition | Very High | exact | PASS | Pass under current benchmark criteria. |
| 113 | I had oatmeal → Add peanut butter | I had oatmeal → Add peanut butter | Oatmeal Peanut Butter | Oatmeal, Peanut butter | generic | branded | Oatmeal common serving estimate; Peanut butter common serving estimate | High | exact | PASS | Pass under current benchmark criteria. |
| 114 | I had a smoothie → Actually homemade banana peanut butter smoothie | I had a smoothie → Actually homemade banana peanut butter smoothie | Banana Peanut Butter Smoothie | Smoothie with banana and peanut butter | generic | branded | Smoothie common serving estimate | High | exact | PASS | Pass under current benchmark criteria. |
| 115 | I had a turkey sandwich → Remove cheese | I had a turkey sandwich → Remove cheese | Turkey Sandwich | — | generic | unknown | — | — | miss | FAIL | Expected Turkey Sandwich; got no items. |
| 116 | I had eggs → Make it 3 eggs | I had eggs → Make it 3 eggs | 3 Eggs | 3 Eggs | generic | estimated | Egg common serving estimate | Low | exact | PASS | Pass under current benchmark criteria. |
| 117 | I had Coke → Actually Coke Zero | I had Coke → Actually Coke Zero | Coke Zero | Coke Zero | generic | branded | Coca-Cola nutrition reference | Very High | exact | PASS | Pass under current benchmark criteria. |
| 118 | I had Panera mac → Actually large mac and cheese | I had Panera mac → Actually large mac and cheese | Panera Mac and Cheese | 1 large mac and cheese | generic | estimated | Generic nutrition reference | Low | fuzzy | PASS | Pass under current benchmark criteria. |
| 119 | I had Panda Express → Add orange chicken and chow mein | I had Panda Express → Add orange chicken and chow mein | Panda Express Orange Chicken Chow Mein | Panda Express Orange Chicken, Chicken | generic | restaurant | Panda Express official nutrition; Chicken common serving estimate | Very High; High | fuzzy | PASS | Pass under current benchmark criteria. |
| 120 | I had a burrito → Actually Chipotle chicken burrito | I had a burrito → Actually Chipotle chicken burrito | Chipotle Chicken Burrito | Chipotle chicken bowl | generic | restaurant | Chipotle official nutrition | Very High | fuzzy | PASS | Pass under current benchmark criteria. |
| 121 | I had chips → Actually Doritos Nacho Cheese | I had chips → Actually Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | generic | branded | Doritos nutrition reference | High | exact | PASS | Pass under current benchmark criteria. |
| 122 | I had yogurt → Actually Chobani Greek Yogurt Strawberry | I had yogurt → Actually Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | generic | branded | Chobani nutrition reference | Very High | exact | PASS | Pass under current benchmark criteria. |
| 123 | I had protein bar → Actually Barebells | I had protein bar → Actually Barebells | Barebells Protein Bar | Barebells Protein Bar | generic | branded | Barebells nutrition reference | Very High | exact | PASS | Pass under current benchmark criteria. |
| 124 | I had toast → Add peanut butter | I had toast → Add peanut butter | Toast Peanut Butter | Toast, Peanut butter | generic | estimated | Toast common serving estimate; Peanut butter common serving estimate | Low; High | exact | PASS | Pass under current benchmark criteria. |
| 125 | I had chicken rice broccoli → Double the chicken | I had chicken rice broccoli → Double the chicken | Chicken Rice Broccoli | 2 Chicken, Rice, Broccoli | generic | branded | Chicken common serving estimate; Rice common serving estimate; Broccoli common serving estimate | High | exact | PASS | Pass under current benchmark criteria. |
