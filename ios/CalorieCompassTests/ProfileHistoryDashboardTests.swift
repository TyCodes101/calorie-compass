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
        XCTAssertTrue(model.confidenceText.contains("82%"))
        XCTAssertTrue(model.confidenceText.contains("verified"))
    }

    func testHistoryListModelFiltersAndGroupsByDay() {
        let breakfast = Self.meal(id: "meal-1", mealType: "breakfast", rawText: "Greek yogurt", date: "2026-06-03T08:00:00.000Z", calories: 220, protein: 20)
        let lunch = Self.meal(id: "meal-2", mealType: "lunch", rawText: "Chicken bowl", date: "2026-06-03T12:00:00.000Z", calories: 520, protein: 42)
        let dinner = Self.meal(id: "meal-3", mealType: "dinner", rawText: "Salmon plate", date: "2026-06-02T18:00:00.000Z", calories: 610, protein: 45)

        let model = HistoryListModel.build(meals: [breakfast, lunch, dinner], searchText: "chicken", filter: .all)

        XCTAssertEqual(model.visibleMeals.map(\.displayTitle), ["Chicken bowl"])
        XCTAssertEqual(model.groupedMealDates, ["Jun 3, 2026"])
        XCTAssertEqual(model.dayTotals["Jun 3, 2026"]?.calories, 520)
        XCTAssertEqual(model.dayTotals["Jun 3, 2026"]?.protein, 42)
    }

    func testHistoryListModelAppliesMealTypeFilter() {
        let breakfast = Self.meal(id: "meal-1", mealType: "breakfast", rawText: "Greek yogurt", date: "2026-06-03T08:00:00.000Z", calories: 220, protein: 20)
        let dinner = Self.meal(id: "meal-2", mealType: "dinner", rawText: "Salmon plate", date: "2026-06-02T18:00:00.000Z", calories: 610, protein: 45)

        let model = HistoryListModel.build(meals: [breakfast, dinner], searchText: "", filter: .dinner)

        XCTAssertEqual(model.visibleMeals.map(\.displayTitle), ["Salmon plate"])
        XCTAssertEqual(model.summaryText, "1 meal, 610 cal, 45g protein")
    }

    func testDashboardV1ModelBuildsPremiumSummaryAndActions() throws {
        let data = """
        {
          "totals": { "calories": 900, "protein": 95, "carbs": 80, "fat": 28 },
          "macroGoals": { "calories": 2100, "protein": 160, "carbs": 210, "fat": 70 },
          "mealCount": 2,
          "dailySummary": { "title": "Steady start", "description": "Protein is ahead of pace." },
          "streaks": {
            "currentStreakDays": 3,
            "mealsLoggedThisWeek": 12,
            "proteinGoalHitDaysThisWeek": 4,
            "summary": "3 day streak"
          }
        }
        """.data(using: .utf8)
        let dashboard = try JSONDecoder().decode(DashboardResponse.self, from: try XCTUnwrap(data))

        let model = DashboardV1Model.build(dashboard: dashboard)

        XCTAssertEqual(model.remainingCaloriesText, "1200 cal")
        XCTAssertEqual(model.proteinProgressText, "95/160 g")
        XCTAssertEqual(model.primaryInsight.title, "Steady start")
        XCTAssertTrue(model.quickActions.map(\.title).contains("Food Search"))
        XCTAssertTrue(model.quickActions.map(\.launch).contains(.nutritionLabel))
    }

    func testLogChatToolVisibilityListsAllExpectedTools() {
        XCTAssertEqual(LogChatView.foodToolTitles, ["Food Search", "Enter Barcode", "Quick Add", "Custom Food"])
        XCTAssertEqual(LogChatView.cameraToolTitles, ["Scan Barcode", "Scan Label", "Attach Photo"])
    }

    private static func meal(id: String, mealType: String, rawText: String, date: String, calories: Double, protein: Double) -> MealResponse {
        MealResponse(
            id: id,
            mealType: mealType,
            rawText: rawText,
            date: date,
            createdAt: nil,
            confidenceScore: 0.82,
            totalCalories: calories,
            totalProtein: protein,
            totalCarbs: 20,
            totalFat: 10,
            itemCount: 1,
            trustedCount: nil,
            estimatedCount: nil,
            coverageSummary: nil,
            items: []
        )
    }
}
