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
    }
}
