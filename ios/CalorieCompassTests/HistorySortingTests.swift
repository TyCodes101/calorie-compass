import XCTest
@testable import CalorieCompass

final class HistorySortingTests: XCTestCase {
    func testGroupsNewestDayFirstAndMealsNewestFirst() {
        let meals: [MealResponse] = [
            MealResponse(id: "1", mealType: "lunch", rawText: "A", date: "2026-06-03T12:00:00Z", createdAt: nil, confidenceScore: nil, totalCalories: 500, totalProtein: 20, totalCarbs: 50, totalFat: 10, itemCount: nil, trustedCount: nil, estimatedCount: nil, coverageSummary: nil, items: nil),
            MealResponse(id: "2", mealType: "dinner", rawText: "B", date: "2026-06-02T18:00:00Z", createdAt: nil, confidenceScore: nil, totalCalories: 600, totalProtein: 30, totalCarbs: 60, totalFat: 15, itemCount: nil, trustedCount: nil, estimatedCount: nil, coverageSummary: nil, items: nil),
            MealResponse(id: "3", mealType: "snack", rawText: "C", date: "2026-06-03T08:00:00Z", createdAt: nil, confidenceScore: nil, totalCalories: 200, totalProtein: 10, totalCarbs: 20, totalFat: 5, itemCount: nil, trustedCount: nil, estimatedCount: nil, coverageSummary: nil, items: nil),
        ]

        let now = ISO8601DateFormatter().date(from: "2026-06-03T20:00:00Z")!
        let groups = HistorySorting.groupMealsByDay(meals, now: now)

        XCTAssertEqual(groups.count, 2)
        XCTAssertEqual(groups[0].meals.map(\.id), ["1", "3"])
        XCTAssertEqual(groups[1].meals.map(\.id), ["2"])
    }

    func testSearchesFoodSourceMealTypeAndMacrosThenAppliesFilters() throws {
        let restaurantItem = MealRequestItem(
            food_name: "Cava Chicken Bowl",
            quantity: 1,
            unit: "bowl",
            calories: 620,
            protein: 45,
            carbs: 58,
            fat: 22,
            fiber: 8,
            sugar: 6,
            sodium: 980,
            notes: nil,
            source_type: "OFFICIAL_RESTAURANT",
            source_name: "Cava official nutrition",
            confidence_label: "Verified",
            is_trusted: true
        )
        let meals: [MealResponse] = [
            MealResponse(id: "1", mealType: "lunch", rawText: "Chicken bowl", date: "2026-06-03T12:00:00Z", createdAt: nil, confidenceScore: 0.96, totalCalories: 620, totalProtein: 45, totalCarbs: 58, totalFat: 22, itemCount: 1, trustedCount: 1, estimatedCount: 0, coverageSummary: nil, items: [restaurantItem]),
            MealResponse(id: "2", mealType: "snack", rawText: "Apple", date: "2026-05-01T12:00:00Z", createdAt: nil, confidenceScore: 0.9, totalCalories: 95, totalProtein: 0, totalCarbs: 25, totalFat: 0, itemCount: 1, trustedCount: 1, estimatedCount: 0, coverageSummary: nil, items: nil),
        ]
        let now = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-06-04T12:00:00Z"))

        XCTAssertEqual(HistorySorting.filteredMeals(meals, query: "cava 620 calories", filter: .all, now: now).map(\.id), ["1"])
        XCTAssertEqual(HistorySorting.filteredMeals(meals, query: "", filter: .highProtein, now: now).map(\.id), ["1"])
        XCTAssertEqual(HistorySorting.filteredMeals(meals, query: "", filter: .lunch, now: now).map(\.id), ["1"])
        XCTAssertEqual(HistorySorting.filteredMeals(meals, query: "", filter: .recent, now: now).map(\.id), ["1"])
    }
}

