import XCTest
@testable import CalorieCompass

final class ProfileHistoryDashboardTests: XCTestCase {
    func testProfileDashboardModelBuildsGuestFallbacks() {
        let profile = ProfileData(name: " ", age: nil, heightCm: nil, weightLbs: nil, goal: nil, activityLevel: nil, dailyCalorieGoal: nil, proteinGoal: nil, nutritionPreferences: nil)
        let model = ProfileDashboardModel.build(profile: profile, isGuest: true, analytics: nil, dashboard: nil, weightEntries: nil)

        XCTAssertEqual(model.displayName, "Guest")
        XCTAssertEqual(model.statusPillText, "Guest")
        XCTAssertTrue(model.todayCaloriesText.contains("/"))
        XCTAssertEqual(model.currentWeightText, "Add weight")
    }

    func testHistoryMealCardModelUsesConfidenceAndCoverageWhenPresent() {
        let meal = MealResponse(
            id: "meal-1",
            mealType: "lunch",
            rawText: "Chicken bowl",
            date: "2026-05-25T12:00:00.000Z",
            createdAt: nil,
            confidenceScore: 0.82,
            totalCalories: 520,
            totalProtein: 42,
            totalCarbs: 48,
            totalFat: 18,
            itemCount: 1,
            trustedCount: nil,
            estimatedCount: nil,
            coverageSummary: "1 verified",
            items: []
        )

        let model = HistoryMealCardModel.build(meal: meal)

        XCTAssertEqual(model.title, "Chicken bowl")
        XCTAssertEqual(model.caloriesText, "520")
        XCTAssertEqual(model.macroLineText, "P 42g  •  C 48g  •  F 18g")
        XCTAssertEqual(model.trustBadgeText, "Verified")
        XCTAssertFalse(model.isZeroCalorie)
        XCTAssertTrue(model.accessibilityLabelText.contains("Chicken bowl"))
        XCTAssertTrue(model.accessibilityLabelText.contains("520 calories"))
    }

    func testHistoryMealCardDoesNotShowRestaurantBadgeForMixedEstimatedModifierMeal() {
        let meal = MealResponse(
            id: "meal-mixed",
            mealType: "dinner",
            rawText: "Five Guys bacon cheeseburger no bun",
            date: "2026-07-09T18:00:00.000Z",
            createdAt: nil,
            confidenceScore: 0.72,
            totalCalories: 760,
            totalProtein: 45,
            totalCarbs: 14,
            totalFat: 60,
            itemCount: 2,
            trustedCount: 1,
            estimatedCount: 1,
            coverageSummary: "1 of 2 items matched",
            items: [
                MealRequestItem(food_name: "Five Guys Cheeseburger", quantity: 1, unit: "burger", calories: 980, protein: 47, carbs: 40, fat: 55, fiber: 2, sugar: 9, sodium: 1050, notes: nil, source_type: "OFFICIAL_RESTAURANT", source_name: "Five Guys official nutrition", confidence_label: "Verified"),
                MealRequestItem(food_name: "No bun modifier", quantity: 1, unit: "modifier", calories: -220, protein: -2, carbs: -26, fat: -5, fiber: 0, sugar: 0, sodium: -260, notes: "Estimated modifier delta", source_type: "AI_ESTIMATE", source_name: "Estimated modifier", confidence_label: "Needs Review"),
            ]
        )

        let model = HistoryMealCardModel.build(meal: meal)

        XCTAssertEqual(model.trustBadgeText, "Mixed")
    }
}
