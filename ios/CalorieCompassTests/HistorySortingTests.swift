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
}

