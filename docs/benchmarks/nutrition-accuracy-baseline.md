# Nutrition Accuracy Benchmark

Generated: 2026-06-19T03:56:40.152Z

This benchmark is a permanent reliability gate for the nutrition accuracy program. It combines lookup resolution, typo normalization, ambiguity handling, validation risk scoring, and golden dataset checks.

## Overall

- Total tested: 1000
- Passed: 1000
- Failed: 0
- Accuracy: 100%

## Summary by category

```json
{
  "branded": {
    "total": 200,
    "passed": 200,
    "failed": 0,
    "accuracyPercentage": 100
  },
  "restaurant": {
    "total": 200,
    "passed": 200,
    "failed": 0,
    "accuracyPercentage": 100
  },
  "generic": {
    "total": 150,
    "passed": 150,
    "failed": 0,
    "accuracyPercentage": 100
  },
  "typo": {
    "total": 250,
    "passed": 250,
    "failed": 0,
    "accuracyPercentage": 100
  },
  "ambiguous": {
    "total": 150,
    "passed": 150,
    "failed": 0,
    "accuracyPercentage": 100
  },
  "validation": {
    "total": 39,
    "passed": 39,
    "failed": 0,
    "accuracyPercentage": 100
  },
  "golden": {
    "total": 11,
    "passed": 11,
    "failed": 0,
    "accuracyPercentage": 100
  }
}
```

## Top failure patterns

- None.

## Results

| # | Category | Mode | Input prompt | Expected | Actual | Pass/fail | Notes |
|---:|---|---|---|---|---|---|---|
| 1 | branded | lookup | Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 2 | branded | lookup | I had Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 3 | branded | lookup | log Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 4 | branded | lookup | for lunch I had Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 5 | branded | lookup | snack was Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 6 | branded | lookup | one Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 7 | branded | lookup | please add Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 8 | branded | lookup | track Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 9 | branded | lookup | Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 10 | branded | lookup | I had Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 11 | branded | lookup | log Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 12 | branded | lookup | for lunch I had Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 13 | branded | lookup | snack was Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 14 | branded | lookup | one Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 15 | branded | lookup | please add Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 16 | branded | lookup | track Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 17 | branded | lookup | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 18 | branded | lookup | I had Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 19 | branded | lookup | log Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 20 | branded | lookup | for lunch I had Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 21 | branded | lookup | snack was Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 22 | branded | lookup | one Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 23 | branded | lookup | please add Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 24 | branded | lookup | track Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 25 | branded | lookup | Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 26 | branded | lookup | I had Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 27 | branded | lookup | log Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 28 | branded | lookup | for lunch I had Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 29 | branded | lookup | snack was Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 30 | branded | lookup | one Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 31 | branded | lookup | please add Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 32 | branded | lookup | track Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 33 | branded | lookup | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 34 | branded | lookup | I had Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 35 | branded | lookup | log Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 36 | branded | lookup | for lunch I had Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 37 | branded | lookup | snack was Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 38 | branded | lookup | one Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 39 | branded | lookup | please add Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 40 | branded | lookup | track Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 41 | branded | lookup | Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 42 | branded | lookup | I had Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 43 | branded | lookup | log Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 44 | branded | lookup | for lunch I had Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 45 | branded | lookup | snack was Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 46 | branded | lookup | one Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 47 | branded | lookup | please add Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 48 | branded | lookup | track Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 49 | branded | lookup | Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 50 | branded | lookup | I had Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 51 | branded | lookup | log Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 52 | branded | lookup | for lunch I had Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 53 | branded | lookup | snack was Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 54 | branded | lookup | one Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 55 | branded | lookup | please add Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 56 | branded | lookup | track Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 57 | branded | lookup | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 58 | branded | lookup | I had Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 59 | branded | lookup | log Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 60 | branded | lookup | for lunch I had Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 61 | branded | lookup | snack was Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 62 | branded | lookup | one Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 63 | branded | lookup | please add Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 64 | branded | lookup | track Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 65 | branded | lookup | Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 66 | branded | lookup | I had Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 67 | branded | lookup | log Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 68 | branded | lookup | for lunch I had Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 69 | branded | lookup | snack was Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 70 | branded | lookup | one Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 71 | branded | lookup | please add Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 72 | branded | lookup | track Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 73 | branded | lookup | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 74 | branded | lookup | I had Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 75 | branded | lookup | log Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 76 | branded | lookup | for lunch I had Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 77 | branded | lookup | snack was Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 78 | branded | lookup | one Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 79 | branded | lookup | please add Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 80 | branded | lookup | track Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 81 | branded | lookup | Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 82 | branded | lookup | I had Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 83 | branded | lookup | log Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 84 | branded | lookup | for lunch I had Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 85 | branded | lookup | snack was Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 86 | branded | lookup | one Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 87 | branded | lookup | please add Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 88 | branded | lookup | track Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 89 | branded | lookup | Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 90 | branded | lookup | I had Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 91 | branded | lookup | log Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 92 | branded | lookup | for lunch I had Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 93 | branded | lookup | snack was Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 94 | branded | lookup | one Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 95 | branded | lookup | please add Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 96 | branded | lookup | track Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 97 | branded | lookup | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 98 | branded | lookup | I had Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 99 | branded | lookup | log Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 100 | branded | lookup | for lunch I had Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 101 | branded | lookup | snack was Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 102 | branded | lookup | one Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 103 | branded | lookup | please add Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 104 | branded | lookup | track Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 105 | branded | lookup | Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 106 | branded | lookup | I had Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 107 | branded | lookup | log Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 108 | branded | lookup | for lunch I had Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 109 | branded | lookup | snack was Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 110 | branded | lookup | one Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 111 | branded | lookup | please add Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 112 | branded | lookup | track Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 113 | branded | lookup | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 114 | branded | lookup | I had Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 115 | branded | lookup | log Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 116 | branded | lookup | for lunch I had Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 117 | branded | lookup | snack was Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 118 | branded | lookup | one Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 119 | branded | lookup | please add Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 120 | branded | lookup | track Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 121 | branded | lookup | Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 122 | branded | lookup | I had Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 123 | branded | lookup | log Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 124 | branded | lookup | for lunch I had Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 125 | branded | lookup | snack was Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 126 | branded | lookup | one Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 127 | branded | lookup | please add Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 128 | branded | lookup | track Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 129 | branded | lookup | Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 130 | branded | lookup | I had Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 131 | branded | lookup | log Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 132 | branded | lookup | for lunch I had Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 133 | branded | lookup | snack was Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 134 | branded | lookup | one Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 135 | branded | lookup | please add Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 136 | branded | lookup | track Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 137 | branded | lookup | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 138 | branded | lookup | I had Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 139 | branded | lookup | log Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 140 | branded | lookup | for lunch I had Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 141 | branded | lookup | snack was Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 142 | branded | lookup | one Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 143 | branded | lookup | please add Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 144 | branded | lookup | track Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 145 | branded | lookup | Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 146 | branded | lookup | I had Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 147 | branded | lookup | log Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 148 | branded | lookup | for lunch I had Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 149 | branded | lookup | snack was Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 150 | branded | lookup | one Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 151 | branded | lookup | please add Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 152 | branded | lookup | track Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 153 | branded | lookup | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 154 | branded | lookup | I had Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 155 | branded | lookup | log Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 156 | branded | lookup | for lunch I had Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 157 | branded | lookup | snack was Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 158 | branded | lookup | one Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 159 | branded | lookup | please add Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 160 | branded | lookup | track Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 161 | branded | lookup | Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 162 | branded | lookup | I had Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 163 | branded | lookup | log Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 164 | branded | lookup | for lunch I had Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 165 | branded | lookup | snack was Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 166 | branded | lookup | one Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 167 | branded | lookup | please add Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 168 | branded | lookup | track Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 169 | branded | lookup | Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 170 | branded | lookup | I had Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 171 | branded | lookup | log Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 172 | branded | lookup | for lunch I had Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 173 | branded | lookup | snack was Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 174 | branded | lookup | one Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 175 | branded | lookup | please add Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 176 | branded | lookup | track Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 177 | branded | lookup | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 178 | branded | lookup | I had Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 179 | branded | lookup | log Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 180 | branded | lookup | for lunch I had Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 181 | branded | lookup | snack was Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 182 | branded | lookup | one Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 183 | branded | lookup | please add Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 184 | branded | lookup | track Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 185 | branded | lookup | Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 186 | branded | lookup | I had Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 187 | branded | lookup | log Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 188 | branded | lookup | for lunch I had Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 189 | branded | lookup | snack was Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 190 | branded | lookup | one Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 191 | branded | lookup | please add Quest BBQ Protein Chips | Quest BBQ Protein Chips | Quest BBQ Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 192 | branded | lookup | track Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | Quest Nacho Cheese Protein Chips | PASS | Pass under reliability benchmark criteria. |
| 193 | branded | lookup | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g shake | Fairlife Core Power Elite 42g Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 194 | branded | lookup | I had Coke Zero | Coke Zero | Coke Zero | PASS | Pass under reliability benchmark criteria. |
| 195 | branded | lookup | log Doritos Nacho Cheese | Doritos Nacho Cheese | Doritos Nacho Cheese | PASS | Pass under reliability benchmark criteria. |
| 196 | branded | lookup | for lunch I had Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 197 | branded | lookup | snack was Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | Chobani Greek Yogurt Strawberry | PASS | Pass under reliability benchmark criteria. |
| 198 | branded | lookup | one Premier Protein Shake | Premier Protein Shake | Premier Protein Shake | PASS | Pass under reliability benchmark criteria. |
| 199 | branded | lookup | please add Celsius Energy Drink | Celsius Energy Drink | Celsius Energy Drink | PASS | Pass under reliability benchmark criteria. |
| 200 | branded | lookup | track Quaker Rice Cakes | Quaker Rice Cakes | Quaker Rice Cakes | PASS | Pass under reliability benchmark criteria. |
| 201 | restaurant | lookup | McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 202 | restaurant | lookup | I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 203 | restaurant | lookup | log Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 204 | restaurant | lookup | for lunch I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 205 | restaurant | lookup | snack was McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 206 | restaurant | lookup | one Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 207 | restaurant | lookup | please add McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 208 | restaurant | lookup | track McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 209 | restaurant | lookup | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 210 | restaurant | lookup | I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 211 | restaurant | lookup | log McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 212 | restaurant | lookup | for lunch I had Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 213 | restaurant | lookup | snack was McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 214 | restaurant | lookup | one McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 215 | restaurant | lookup | please add Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 216 | restaurant | lookup | track Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 217 | restaurant | lookup | McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 218 | restaurant | lookup | I had Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 219 | restaurant | lookup | log McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 220 | restaurant | lookup | for lunch I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 221 | restaurant | lookup | snack was Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 222 | restaurant | lookup | one Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 223 | restaurant | lookup | please add McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 224 | restaurant | lookup | track Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 225 | restaurant | lookup | McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 226 | restaurant | lookup | I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 227 | restaurant | lookup | log Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 228 | restaurant | lookup | for lunch I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 229 | restaurant | lookup | snack was McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 230 | restaurant | lookup | one Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 231 | restaurant | lookup | please add McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 232 | restaurant | lookup | track McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 233 | restaurant | lookup | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 234 | restaurant | lookup | I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 235 | restaurant | lookup | log McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 236 | restaurant | lookup | for lunch I had Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 237 | restaurant | lookup | snack was McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 238 | restaurant | lookup | one McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 239 | restaurant | lookup | please add Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 240 | restaurant | lookup | track Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 241 | restaurant | lookup | McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 242 | restaurant | lookup | I had Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 243 | restaurant | lookup | log McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 244 | restaurant | lookup | for lunch I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 245 | restaurant | lookup | snack was Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 246 | restaurant | lookup | one Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 247 | restaurant | lookup | please add McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 248 | restaurant | lookup | track Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 249 | restaurant | lookup | McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 250 | restaurant | lookup | I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 251 | restaurant | lookup | log Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 252 | restaurant | lookup | for lunch I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 253 | restaurant | lookup | snack was McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 254 | restaurant | lookup | one Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 255 | restaurant | lookup | please add McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 256 | restaurant | lookup | track McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 257 | restaurant | lookup | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 258 | restaurant | lookup | I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 259 | restaurant | lookup | log McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 260 | restaurant | lookup | for lunch I had Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 261 | restaurant | lookup | snack was McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 262 | restaurant | lookup | one McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 263 | restaurant | lookup | please add Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 264 | restaurant | lookup | track Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 265 | restaurant | lookup | McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 266 | restaurant | lookup | I had Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 267 | restaurant | lookup | log McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 268 | restaurant | lookup | for lunch I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 269 | restaurant | lookup | snack was Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 270 | restaurant | lookup | one Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 271 | restaurant | lookup | please add McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 272 | restaurant | lookup | track Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 273 | restaurant | lookup | McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 274 | restaurant | lookup | I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 275 | restaurant | lookup | log Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 276 | restaurant | lookup | for lunch I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 277 | restaurant | lookup | snack was McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 278 | restaurant | lookup | one Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 279 | restaurant | lookup | please add McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 280 | restaurant | lookup | track McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 281 | restaurant | lookup | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 282 | restaurant | lookup | I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 283 | restaurant | lookup | log McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 284 | restaurant | lookup | for lunch I had Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 285 | restaurant | lookup | snack was McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 286 | restaurant | lookup | one McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 287 | restaurant | lookup | please add Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 288 | restaurant | lookup | track Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 289 | restaurant | lookup | McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 290 | restaurant | lookup | I had Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 291 | restaurant | lookup | log McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 292 | restaurant | lookup | for lunch I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 293 | restaurant | lookup | snack was Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 294 | restaurant | lookup | one Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 295 | restaurant | lookup | please add McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 296 | restaurant | lookup | track Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 297 | restaurant | lookup | McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 298 | restaurant | lookup | I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 299 | restaurant | lookup | log Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 300 | restaurant | lookup | for lunch I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 301 | restaurant | lookup | snack was McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 302 | restaurant | lookup | one Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 303 | restaurant | lookup | please add McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 304 | restaurant | lookup | track McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 305 | restaurant | lookup | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 306 | restaurant | lookup | I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 307 | restaurant | lookup | log McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 308 | restaurant | lookup | for lunch I had Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 309 | restaurant | lookup | snack was McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 310 | restaurant | lookup | one McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 311 | restaurant | lookup | please add Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 312 | restaurant | lookup | track Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 313 | restaurant | lookup | McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 314 | restaurant | lookup | I had Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 315 | restaurant | lookup | log McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 316 | restaurant | lookup | for lunch I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 317 | restaurant | lookup | snack was Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 318 | restaurant | lookup | one Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 319 | restaurant | lookup | please add McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 320 | restaurant | lookup | track Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 321 | restaurant | lookup | McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 322 | restaurant | lookup | I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 323 | restaurant | lookup | log Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 324 | restaurant | lookup | for lunch I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 325 | restaurant | lookup | snack was McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 326 | restaurant | lookup | one Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 327 | restaurant | lookup | please add McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 328 | restaurant | lookup | track McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 329 | restaurant | lookup | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 330 | restaurant | lookup | I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 331 | restaurant | lookup | log McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 332 | restaurant | lookup | for lunch I had Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 333 | restaurant | lookup | snack was McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 334 | restaurant | lookup | one McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 335 | restaurant | lookup | please add Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 336 | restaurant | lookup | track Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 337 | restaurant | lookup | McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 338 | restaurant | lookup | I had Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 339 | restaurant | lookup | log McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 340 | restaurant | lookup | for lunch I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 341 | restaurant | lookup | snack was Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 342 | restaurant | lookup | one Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 343 | restaurant | lookup | please add McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 344 | restaurant | lookup | track Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 345 | restaurant | lookup | McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 346 | restaurant | lookup | I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 347 | restaurant | lookup | log Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 348 | restaurant | lookup | for lunch I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 349 | restaurant | lookup | snack was McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 350 | restaurant | lookup | one Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 351 | restaurant | lookup | please add McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 352 | restaurant | lookup | track McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 353 | restaurant | lookup | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 354 | restaurant | lookup | I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 355 | restaurant | lookup | log McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 356 | restaurant | lookup | for lunch I had Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 357 | restaurant | lookup | snack was McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 358 | restaurant | lookup | one McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 359 | restaurant | lookup | please add Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 360 | restaurant | lookup | track Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 361 | restaurant | lookup | McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 362 | restaurant | lookup | I had Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 363 | restaurant | lookup | log McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 364 | restaurant | lookup | for lunch I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 365 | restaurant | lookup | snack was Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 366 | restaurant | lookup | one Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 367 | restaurant | lookup | please add McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 368 | restaurant | lookup | track Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 369 | restaurant | lookup | McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 370 | restaurant | lookup | I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 371 | restaurant | lookup | log Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 372 | restaurant | lookup | for lunch I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 373 | restaurant | lookup | snack was McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 374 | restaurant | lookup | one Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 375 | restaurant | lookup | please add McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 376 | restaurant | lookup | track McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 377 | restaurant | lookup | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 378 | restaurant | lookup | I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 379 | restaurant | lookup | log McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 380 | restaurant | lookup | for lunch I had Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 381 | restaurant | lookup | snack was McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 382 | restaurant | lookup | one McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 383 | restaurant | lookup | please add Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 384 | restaurant | lookup | track Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 385 | restaurant | lookup | McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 386 | restaurant | lookup | I had Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 387 | restaurant | lookup | log McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 388 | restaurant | lookup | for lunch I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 389 | restaurant | lookup | snack was Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 390 | restaurant | lookup | one Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 391 | restaurant | lookup | please add McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 392 | restaurant | lookup | track Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 393 | restaurant | lookup | McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 394 | restaurant | lookup | I had McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 395 | restaurant | lookup | log Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | Taco Bell Crunchy Taco | PASS | Pass under reliability benchmark criteria. |
| 396 | restaurant | lookup | for lunch I had Subway Turkey Footlong | Subway Turkey Footlong | Subway Turkey Footlong | PASS | Pass under reliability benchmark criteria. |
| 397 | restaurant | lookup | snack was McDonald's Big Mac | McDonald's Big Mac | McDonald's Big Mac | PASS | Pass under reliability benchmark criteria. |
| 398 | restaurant | lookup | one Subway Turkey 6-Inch | Subway Turkey 6-Inch | Subway Turkey 6-Inch | PASS | Pass under reliability benchmark criteria. |
| 399 | restaurant | lookup | please add McDouble | McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 400 | restaurant | lookup | track McDonald's McDouble | McDonald's McDouble | McDonald's McDouble | PASS | Pass under reliability benchmark criteria. |
| 401 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 402 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 403 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 404 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 405 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 406 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 407 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 408 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 409 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 410 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 411 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 412 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 413 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 414 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 415 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 416 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 417 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 418 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 419 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 420 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 421 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 422 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 423 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 424 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 425 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 426 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 427 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 428 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 429 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 430 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 431 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 432 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 433 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 434 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 435 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 436 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 437 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 438 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 439 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 440 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 441 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 442 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 443 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 444 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 445 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 446 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 447 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 448 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 449 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 450 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 451 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 452 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 453 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 454 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 455 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 456 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 457 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 458 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 459 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 460 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 461 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 462 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 463 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 464 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 465 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 466 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 467 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 468 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 469 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 470 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 471 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 472 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 473 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 474 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 475 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 476 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 477 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 478 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 479 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 480 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 481 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 482 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 483 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 484 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 485 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 486 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 487 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 488 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 489 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 490 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 491 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 492 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 493 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 494 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 495 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 496 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 497 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 498 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 499 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 500 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 501 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 502 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 503 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 504 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 505 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 506 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 507 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 508 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 509 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 510 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 511 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 512 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 513 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 514 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 515 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 516 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 517 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 518 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 519 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 520 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 521 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 522 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 523 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 524 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 525 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 526 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 527 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 528 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 529 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 530 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 531 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 532 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 533 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 534 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 535 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 536 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 537 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 538 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 539 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 540 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 541 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 542 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 543 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 544 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 545 | generic | risk | Chicken breast | Chicken breast | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 546 | generic | risk | White rice | White rice | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 547 | generic | risk | Baked potato | Baked potato | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 548 | generic | risk | Eggs | Eggs | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 549 | generic | risk | Apple | Apple | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 550 | generic | risk | Broccoli | Broccoli | LOW: no issues | PASS | Pass under reliability benchmark criteria. |
| 551 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 552 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 553 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 554 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 555 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 556 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 557 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 558 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 559 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 560 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 561 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 562 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 563 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 564 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 565 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 566 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 567 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 568 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 569 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 570 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 571 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 572 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 573 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 574 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 575 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 576 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 577 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 578 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 579 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 580 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 581 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 582 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 583 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 584 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 585 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 586 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 587 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 588 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 589 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 590 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 591 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 592 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 593 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 594 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 595 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 596 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 597 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 598 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 599 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 600 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 601 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 602 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 603 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 604 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 605 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 606 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 607 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 608 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 609 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 610 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 611 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 612 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 613 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 614 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 615 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 616 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 617 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 618 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 619 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 620 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 621 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 622 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 623 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 624 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 625 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 626 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 627 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 628 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 629 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 630 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 631 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 632 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 633 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 634 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 635 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 636 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 637 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 638 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 639 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 640 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 641 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 642 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 643 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 644 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 645 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 646 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 647 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 648 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 649 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 650 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 651 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 652 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 653 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 654 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 655 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 656 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 657 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 658 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 659 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 660 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 661 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 662 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 663 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 664 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 665 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 666 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 667 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 668 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 669 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 670 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 671 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 672 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 673 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 674 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 675 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 676 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 677 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 678 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 679 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 680 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 681 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 682 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 683 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 684 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 685 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 686 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 687 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 688 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 689 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 690 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 691 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 692 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 693 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 694 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 695 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 696 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 697 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 698 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 699 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 700 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 701 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 702 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 703 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 704 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 705 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 706 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 707 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 708 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 709 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 710 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 711 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 712 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 713 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 714 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 715 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 716 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 717 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 718 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 719 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 720 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 721 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 722 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 723 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 724 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 725 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 726 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 727 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 728 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 729 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 730 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 731 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 732 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 733 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 734 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 735 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 736 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 737 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 738 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 739 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 740 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 741 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 742 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 743 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 744 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 745 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 746 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 747 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 748 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 749 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 750 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 751 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 752 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 753 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 754 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 755 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 756 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 757 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 758 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 759 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 760 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 761 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 762 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 763 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 764 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 765 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 766 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 767 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 768 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 769 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 770 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 771 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 772 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 773 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 774 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 775 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 776 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 777 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 778 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 779 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 780 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 781 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 782 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 783 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 784 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 785 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 786 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 787 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 788 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 789 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 790 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 791 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 792 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 793 | typo | normalization | log mcdoublee | McDonald's McDouble | McDonald's: mcdonalds mcdouble | PASS | Pass under reliability benchmark criteria. |
| 794 | typo | normalization | for lunch I had chipolte chicken bowl | Chipotle bowl | Chipotle: chipotle chicken bowl | PASS | Pass under reliability benchmark criteria. |
| 795 | typo | normalization | snack was fairlife choclate shake | Fairlife shake | Fairlife: fairlife chocolate shake | PASS | Pass under reliability benchmark criteria. |
| 796 | typo | normalization | one premeir protein shake | Premier Protein shake | Premier Protein: premier protein shake | PASS | Pass under reliability benchmark criteria. |
| 797 | typo | normalization | please add dorittos nacho chees | Doritos | Doritos: doritos nacho cheese | PASS | Pass under reliability benchmark criteria. |
| 798 | typo | normalization | track chick fil a nuggest | Chick-fil-A nuggets | Chick-fil-A: chick fil nuggets | PASS | Pass under reliability benchmark criteria. |
| 799 | typo | normalization | skitles | Skittles | Skittles: skittles | PASS | Pass under reliability benchmark criteria. |
| 800 | typo | normalization | I had quest bbq protien chips | Quest protein chips | Quest: quest bbq protein chips | PASS | Pass under reliability benchmark criteria. |
| 801 | ambiguous | ambiguity | chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 802 | ambiguous | ambiguity | I had bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 803 | ambiguous | ambiguity | log shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 804 | ambiguous | ambiguity | for lunch I had protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 805 | ambiguous | ambiguity | snack was salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 806 | ambiguous | ambiguity | one sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 807 | ambiguous | ambiguity | please add fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 808 | ambiguous | ambiguity | track chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 809 | ambiguous | ambiguity | bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 810 | ambiguous | ambiguity | I had shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 811 | ambiguous | ambiguity | log protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 812 | ambiguous | ambiguity | for lunch I had salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 813 | ambiguous | ambiguity | snack was sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 814 | ambiguous | ambiguity | one fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 815 | ambiguous | ambiguity | please add chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 816 | ambiguous | ambiguity | track bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 817 | ambiguous | ambiguity | shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 818 | ambiguous | ambiguity | I had protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 819 | ambiguous | ambiguity | log salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 820 | ambiguous | ambiguity | for lunch I had sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 821 | ambiguous | ambiguity | snack was fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 822 | ambiguous | ambiguity | one chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 823 | ambiguous | ambiguity | please add bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 824 | ambiguous | ambiguity | track shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 825 | ambiguous | ambiguity | protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 826 | ambiguous | ambiguity | I had salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 827 | ambiguous | ambiguity | log sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 828 | ambiguous | ambiguity | for lunch I had fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 829 | ambiguous | ambiguity | snack was chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 830 | ambiguous | ambiguity | one bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 831 | ambiguous | ambiguity | please add shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 832 | ambiguous | ambiguity | track protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 833 | ambiguous | ambiguity | salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 834 | ambiguous | ambiguity | I had sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 835 | ambiguous | ambiguity | log fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 836 | ambiguous | ambiguity | for lunch I had chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 837 | ambiguous | ambiguity | snack was bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 838 | ambiguous | ambiguity | one shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 839 | ambiguous | ambiguity | please add protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 840 | ambiguous | ambiguity | track salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 841 | ambiguous | ambiguity | sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 842 | ambiguous | ambiguity | I had fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 843 | ambiguous | ambiguity | log chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 844 | ambiguous | ambiguity | for lunch I had bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 845 | ambiguous | ambiguity | snack was shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 846 | ambiguous | ambiguity | one protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 847 | ambiguous | ambiguity | please add salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 848 | ambiguous | ambiguity | track sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 849 | ambiguous | ambiguity | fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 850 | ambiguous | ambiguity | I had chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 851 | ambiguous | ambiguity | log bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 852 | ambiguous | ambiguity | for lunch I had shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 853 | ambiguous | ambiguity | snack was protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 854 | ambiguous | ambiguity | one salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 855 | ambiguous | ambiguity | please add sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 856 | ambiguous | ambiguity | track fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 857 | ambiguous | ambiguity | chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 858 | ambiguous | ambiguity | I had bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 859 | ambiguous | ambiguity | log shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 860 | ambiguous | ambiguity | for lunch I had protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 861 | ambiguous | ambiguity | snack was salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 862 | ambiguous | ambiguity | one sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 863 | ambiguous | ambiguity | please add fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 864 | ambiguous | ambiguity | track chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 865 | ambiguous | ambiguity | bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 866 | ambiguous | ambiguity | I had shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 867 | ambiguous | ambiguity | log protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 868 | ambiguous | ambiguity | for lunch I had salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 869 | ambiguous | ambiguity | snack was sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 870 | ambiguous | ambiguity | one fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 871 | ambiguous | ambiguity | please add chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 872 | ambiguous | ambiguity | track bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 873 | ambiguous | ambiguity | shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 874 | ambiguous | ambiguity | I had protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 875 | ambiguous | ambiguity | log salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 876 | ambiguous | ambiguity | for lunch I had sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 877 | ambiguous | ambiguity | snack was fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 878 | ambiguous | ambiguity | one chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 879 | ambiguous | ambiguity | please add bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 880 | ambiguous | ambiguity | track shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 881 | ambiguous | ambiguity | protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 882 | ambiguous | ambiguity | I had salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 883 | ambiguous | ambiguity | log sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 884 | ambiguous | ambiguity | for lunch I had fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 885 | ambiguous | ambiguity | snack was chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 886 | ambiguous | ambiguity | one bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 887 | ambiguous | ambiguity | please add shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 888 | ambiguous | ambiguity | track protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 889 | ambiguous | ambiguity | salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 890 | ambiguous | ambiguity | I had sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 891 | ambiguous | ambiguity | log fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 892 | ambiguous | ambiguity | for lunch I had chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 893 | ambiguous | ambiguity | snack was bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 894 | ambiguous | ambiguity | one shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 895 | ambiguous | ambiguity | please add protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 896 | ambiguous | ambiguity | track salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 897 | ambiguous | ambiguity | sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 898 | ambiguous | ambiguity | I had fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 899 | ambiguous | ambiguity | log chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 900 | ambiguous | ambiguity | for lunch I had bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 901 | ambiguous | ambiguity | snack was shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 902 | ambiguous | ambiguity | one protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 903 | ambiguous | ambiguity | please add salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 904 | ambiguous | ambiguity | track sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 905 | ambiguous | ambiguity | fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 906 | ambiguous | ambiguity | I had chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 907 | ambiguous | ambiguity | log bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 908 | ambiguous | ambiguity | for lunch I had shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 909 | ambiguous | ambiguity | snack was protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 910 | ambiguous | ambiguity | one salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 911 | ambiguous | ambiguity | please add sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 912 | ambiguous | ambiguity | track fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 913 | ambiguous | ambiguity | chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 914 | ambiguous | ambiguity | I had bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 915 | ambiguous | ambiguity | log shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 916 | ambiguous | ambiguity | for lunch I had protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 917 | ambiguous | ambiguity | snack was salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 918 | ambiguous | ambiguity | one sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 919 | ambiguous | ambiguity | please add fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 920 | ambiguous | ambiguity | track chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 921 | ambiguous | ambiguity | bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 922 | ambiguous | ambiguity | I had shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 923 | ambiguous | ambiguity | log protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 924 | ambiguous | ambiguity | for lunch I had salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 925 | ambiguous | ambiguity | snack was sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 926 | ambiguous | ambiguity | one fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 927 | ambiguous | ambiguity | please add chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 928 | ambiguous | ambiguity | track bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 929 | ambiguous | ambiguity | shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 930 | ambiguous | ambiguity | I had protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 931 | ambiguous | ambiguity | log salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 932 | ambiguous | ambiguity | for lunch I had sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 933 | ambiguous | ambiguity | snack was fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 934 | ambiguous | ambiguity | one chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 935 | ambiguous | ambiguity | please add bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 936 | ambiguous | ambiguity | track shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 937 | ambiguous | ambiguity | protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 938 | ambiguous | ambiguity | I had salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 939 | ambiguous | ambiguity | log sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 940 | ambiguous | ambiguity | for lunch I had fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 941 | ambiguous | ambiguity | snack was chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 942 | ambiguous | ambiguity | one bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 943 | ambiguous | ambiguity | please add shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 944 | ambiguous | ambiguity | track protein shake | protein shake clarification | Which protein shake was it? Brand or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 945 | ambiguous | ambiguity | salad | salad clarification | What was in the salad, and about how much dressing or toppings did it have? | PASS | Pass under reliability benchmark criteria. |
| 946 | ambiguous | ambiguity | I had sandwich | sandwich clarification | What kind of sandwich was it, and what size or main ingredients should I use? | PASS | Pass under reliability benchmark criteria. |
| 947 | ambiguous | ambiguity | log fries | fries clarification | Which restaurant or serving size were the fries? | PASS | Pass under reliability benchmark criteria. |
| 948 | ambiguous | ambiguity | for lunch I had chips | chips clarification | Which chips did you mean, and about how much did you have? | PASS | Pass under reliability benchmark criteria. |
| 949 | ambiguous | ambiguity | snack was bowl | bowl clarification | Which bowl was it? Restaurant or main ingredients will keep the nutrition accurate. | PASS | Pass under reliability benchmark criteria. |
| 950 | ambiguous | ambiguity | one shake | shake clarification | Which shake was it? Brand, restaurant, or bottle size is enough. | PASS | Pass under reliability benchmark criteria. |
| 951 | validation | risk | Coke Zero returned regular soda calories | diet soda risk | HIGH: diet_soda_has_calories,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 952 | validation | risk | Skittles returned protein snack macros | candy risk | HIGH: candy_high_protein,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 953 | validation | risk | Missing serving | serving risk | HIGH: missing_serving,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 954 | validation | risk | Coke Zero returned regular soda calories | diet soda risk | HIGH: diet_soda_has_calories,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 955 | validation | risk | Skittles returned protein snack macros | candy risk | HIGH: candy_high_protein,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 956 | validation | risk | Missing serving | serving risk | HIGH: missing_serving,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 957 | validation | risk | Coke Zero returned regular soda calories | diet soda risk | HIGH: diet_soda_has_calories,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 958 | validation | risk | Skittles returned protein snack macros | candy risk | HIGH: candy_high_protein,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 959 | validation | risk | Missing serving | serving risk | HIGH: missing_serving,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 960 | validation | risk | Coke Zero returned regular soda calories | diet soda risk | HIGH: diet_soda_has_calories,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 961 | validation | risk | Skittles returned protein snack macros | candy risk | HIGH: candy_high_protein,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 962 | validation | risk | Missing serving | serving risk | HIGH: missing_serving,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 963 | validation | risk | Coke Zero returned regular soda calories | diet soda risk | HIGH: diet_soda_has_calories,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 964 | validation | risk | Skittles returned protein snack macros | candy risk | HIGH: candy_high_protein,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 965 | validation | risk | Missing serving | serving risk | HIGH: missing_serving,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 966 | validation | risk | Coke Zero returned regular soda calories | diet soda risk | HIGH: diet_soda_has_calories,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 967 | validation | risk | Skittles returned protein snack macros | candy risk | HIGH: candy_high_protein,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 968 | validation | risk | Missing serving | serving risk | HIGH: missing_serving,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 969 | validation | risk | Coke Zero returned regular soda calories | diet soda risk | HIGH: diet_soda_has_calories,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 970 | validation | risk | Skittles returned protein snack macros | candy risk | HIGH: candy_high_protein,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 971 | validation | risk | Missing serving | serving risk | HIGH: missing_serving,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 972 | validation | risk | Coke Zero returned regular soda calories | diet soda risk | HIGH: diet_soda_has_calories,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 973 | validation | risk | Skittles returned protein snack macros | candy risk | HIGH: candy_high_protein,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 974 | validation | risk | Missing serving | serving risk | HIGH: missing_serving,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 975 | validation | risk | Coke Zero returned regular soda calories | diet soda risk | HIGH: diet_soda_has_calories,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 976 | validation | risk | Skittles returned protein snack macros | candy risk | HIGH: candy_high_protein,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 977 | validation | risk | Missing serving | serving risk | HIGH: missing_serving,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 978 | validation | risk | Coke Zero returned regular soda calories | diet soda risk | HIGH: diet_soda_has_calories,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 979 | validation | risk | Skittles returned protein snack macros | candy risk | HIGH: candy_high_protein,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 980 | validation | risk | Missing serving | serving risk | HIGH: missing_serving,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 981 | validation | risk | Coke Zero returned regular soda calories | diet soda risk | HIGH: diet_soda_has_calories,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 982 | validation | risk | Skittles returned protein snack macros | candy risk | HIGH: candy_high_protein,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 983 | validation | risk | Missing serving | serving risk | HIGH: missing_serving,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 984 | validation | risk | Coke Zero returned regular soda calories | diet soda risk | HIGH: diet_soda_has_calories,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 985 | validation | risk | Skittles returned protein snack macros | candy risk | HIGH: candy_high_protein,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 986 | validation | risk | Missing serving | serving risk | HIGH: missing_serving,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 987 | validation | risk | Coke Zero returned regular soda calories | diet soda risk | HIGH: diet_soda_has_calories,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 988 | validation | risk | Skittles returned protein snack macros | candy risk | HIGH: candy_high_protein,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 989 | validation | risk | Missing serving | serving risk | HIGH: missing_serving,multiple_candidates | PASS | Pass under reliability benchmark criteria. |
| 990 | golden | golden | Quest BBQ Protein Chips | quest-bbq-protein-chips | Quest BBQ Protein Chips | PASS | Golden dataset case passed. |
| 991 | golden | golden | McDouble | mcdouble | McDonald's McDouble | PASS | Golden dataset case passed. |
| 992 | golden | golden | Coke Zero | coke-zero | Coke Zero | PASS | Golden dataset case passed. |
| 993 | golden | golden | Skittles pack | skittles-pack | Skittles Pack | PASS | Golden dataset case passed. |
| 994 | golden | golden | Fairlife Core Power Elite 42g shake | fairlife-core-power-elite | Fairlife Core Power Elite 42g Protein Shake | PASS | Golden dataset case passed. |
| 995 | golden | golden | Chipotle chicken bowl | chipotle-chicken-bowl | Chipotle bowl with chicken, white rice, black beans | PASS | Golden dataset case passed. |
| 996 | golden | golden | large baked potato | large-baked-potato | Baked potato | PASS | Golden dataset case passed. |
| 997 | golden | golden | 2 eggs and toast | eggs-and-toast | Eggs, Toast | PASS | Golden dataset case passed. |
| 998 | golden | golden | 8 oz chicken breast | eight-oz-chicken-breast | Grilled chicken breast | PASS | Golden dataset case passed. |
| 999 | golden | golden | chips | generic-chips-clarification | clarification | PASS | Golden dataset case passed. |
| 1000 | golden | golden | protein shake | protein-shake-clarification | clarification | PASS | Golden dataset case passed. |
