export type NutritionPlausibilityReason =
  | 'non_finite_nutrients'
  | 'negative_nutrients'
  | 'calorie_macro_mismatch'
  | 'energy_density_outlier'
  | 'serving_weight_invalid'
  | 'nutrient_outlier';

export type NutritionFacts = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
};

export function validateNutritionFacts(
  facts: NutritionFacts,
  options?: { basis?: 'serving' | 'per_100g'; servingWeightGrams?: number | null },
) {
  const values = [facts.calories, facts.protein, facts.carbs, facts.fat, facts.fiber ?? 0, facts.sugar ?? 0, facts.sodium ?? 0];
  const reasons: NutritionPlausibilityReason[] = [];

  if (!values.every(Number.isFinite)) reasons.push('non_finite_nutrients');
  if (values.some((value) => value < 0)) reasons.push('negative_nutrients');

  const weight = options?.servingWeightGrams;
  if (weight !== undefined && weight !== null && (!Number.isFinite(weight) || weight <= 0 || weight > 5_000)) {
    reasons.push('serving_weight_invalid');
  }

  const per100g = options?.basis === 'per_100g';
  const macroLimit = per100g ? 100 : 500;
  const calorieLimit = per100g ? 910 : 5_000;
  if (
    facts.calories > calorieLimit ||
    facts.protein > macroLimit ||
    facts.carbs > macroLimit ||
    facts.fat > macroLimit ||
    (facts.fiber ?? 0) > macroLimit ||
    (facts.sugar ?? 0) > macroLimit
  ) {
    reasons.push('nutrient_outlier');
  }

  if (
    Number.isFinite(facts.calories)
    && facts.calories >= 0
    && ((per100g && facts.calories > 910)
      || (weight !== undefined
        && weight !== null
        && Number.isFinite(weight)
        && weight > 0
        && facts.calories > weight * 9.1 + 5))
  ) {
    reasons.push('energy_density_outlier');
  }

  const macroCalories = facts.protein * 4 + facts.carbs * 4 + facts.fat * 9;
  const difference = Math.abs(facts.calories - macroCalories);
  const tolerance = Math.max(80, facts.calories * 0.35, macroCalories * 0.25);
  if ((facts.calories === 0 && macroCalories > 20) || (facts.calories > 0 && difference > tolerance)) {
    reasons.push('calorie_macro_mismatch');
  }

  return {
    valid: reasons.length === 0,
    reasons: [...new Set(reasons)],
  };
}
