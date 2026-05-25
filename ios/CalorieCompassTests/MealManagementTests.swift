// MealManagementTests.swift
// Calorie Compass iOS — Phase 3B meal management coverage
import XCTest
@testable import CalorieCompass

final class MealManagementTests: XCTestCase {
    func testMealDraftBuildsBackendPatchPayload() {
        let meal = MealResponse(
            id: "meal-1",
            mealType: "lunch",
            rawText: "Chicken bowl",
            date: "2026-05-25T12:00:00.000Z",
            createdAt: nil,
            confidenceScore: 0.9,
            totalCalories: 520,
            totalProtein: 42,
            totalCarbs: 48,
            totalFat: 18,
            itemCount: 1,
            trustedCount: nil,
            estimatedCount: nil,
            coverageSummary: nil,
            items: [MealRequestItem(food_name: "chicken", quantity: 1, unit: "serving", calories: 250, protein: 35, carbs: 0, fat: 8, fiber: 0, sugar: 0, sodium: 300, notes: nil, source_type: nil, source_name: nil, confidence_label: nil)]
        )

        let draft = MealDraft(meal: meal)

        XCTAssertEqual(draft.request.meal_type, "lunch")
        XCTAssertEqual(draft.request.raw_text, "Chicken bowl")
        XCTAssertEqual(draft.request.items.count, 1)
        XCTAssertEqual(draft.totalCalories, 250)
    }

    func testMealDisplayFallsBackSafelyWithoutTitleOrDate() {
        let meal = MealResponse(id: "meal-2", mealType: nil, rawText: nil, date: nil, createdAt: nil, confidenceScore: nil, totalCalories: nil, totalProtein: nil, totalCarbs: nil, totalFat: nil, itemCount: nil, trustedCount: nil, estimatedCount: nil, coverageSummary: nil, items: [])

        XCTAssertEqual(meal.displayTitle, "Saved meal")
        XCTAssertEqual(meal.displayMealType, "Snack")
        XCTAssertEqual(meal.displayDate, "Date unavailable")
    }

    func testLocalOnlyMealIDsAreRejectedBeforeMutation() {
        let expectation = expectation(description: "unsupported edit returns")
        let request = PostMealRequest(meal_type: "snack", confidence_score: 1, raw_text: nil, notes: nil, date: nil, items: [MealRequestItem(food_name: "apple", quantity: 1, unit: "piece", calories: 95, protein: 0, carbs: 25, fat: 0, fiber: 4, sugar: 19, sodium: 1, notes: nil, source_type: nil, source_name: nil, confidence_label: nil)])

        BackendService.updateMeal(id: "local-123", request: request) { result in
            if case .failure(let error) = result {
                XCTAssertTrue(error.localizedDescription.contains("Local-only"))
            } else {
                XCTFail("Expected local-only edit to fail safely")
            }
            expectation.fulfill()
        }

        waitForExpectations(timeout: 1)
    }
}
