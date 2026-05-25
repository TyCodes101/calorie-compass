// MealManagementTests.swift
// Calorie Compass iOS — Phase 3C meal management coverage
import XCTest
@testable import CalorieCompass

final class MealManagementTests: XCTestCase {
    func testMealDraftBuildsBackendPatchPayload() {
        let meal = Self.sampleMeal()
        let draft = MealDraft(meal: meal)

        XCTAssertEqual(draft.request.meal_type, "lunch")
        XCTAssertEqual(draft.request.raw_text, "Chicken bowl")
        XCTAssertEqual(draft.request.items.count, 1)
        XCTAssertEqual(draft.totalCalories, 250)
        XCTAssertTrue(draft.validate().isValid)
    }

    func testMealDraftValidationRejectsBrokenPatchPayloads() {
        var draft = MealDraft(meal: Self.sampleMeal())
        draft.mealType = "brunch"
        draft.items[0].food_name = " "
        draft.items[0].quantity = 0
        draft.items[0].calories = -1

        let validation = draft.validate()

        XCTAssertFalse(validation.isValid)
        XCTAssertTrue(validation.messages.contains { $0.contains("Choose breakfast") })
        XCTAssertTrue(validation.messages.contains { $0.contains("food name") })
        XCTAssertTrue(validation.messages.contains { $0.contains("quantity above 0") })
        XCTAssertTrue(validation.messages.contains { $0.contains("invalid calories") })
    }

    func testMealTypeAndDateFallbacksAreSafe() {
        let malformed = MealResponse(id: "meal-2", mealType: "BRUNCH", rawText: " ", date: "not-a-date", createdAt: nil, confidenceScore: nil, totalCalories: nil, totalProtein: nil, totalCarbs: nil, totalFat: nil, itemCount: nil, trustedCount: nil, estimatedCount: nil, coverageSummary: nil, items: [])

        XCTAssertEqual(malformed.displayTitle, "Saved meal")
        XCTAssertEqual(malformed.displayMealType, "Snack")
        XCTAssertEqual(malformed.displayDate, "Date unavailable")
        XCTAssertEqual(MealDraft(meal: malformed).mealType, "snack")
    }

    func testDateParserAcceptsFractionalAndStandardISO8601() {
        XCTAssertNotNil(DateParser.parseMealDate("2026-05-25T12:00:00.000Z"))
        XCTAssertNotNil(DateParser.parseMealDate("2026-05-25T12:00:00Z"))
        XCTAssertNil(DateParser.parseMealDate("bad-date"))
    }

    func testEmptyItemsRequireDeleteInsteadOfSaving() {
        var draft = MealDraft(meal: Self.sampleMeal())
        draft.items = []

        let validation = draft.validate()

        XCTAssertFalse(validation.isValid)
        XCTAssertTrue(validation.messages.contains { $0.contains("Delete the meal instead") })
    }

    func testLocalOnlyMealIDsAreRejectedBeforeMutation() {
        let expectation = expectation(description: "unsupported edit returns")
        let request = PostMealRequest(meal_type: "snack", confidence_score: 1, raw_text: nil, notes: nil, date: nil, items: [Self.sampleItem()])

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

    private static func sampleMeal() -> MealResponse {
        MealResponse(
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
            items: [sampleItem()]
        )
    }

    private static func sampleItem() -> MealRequestItem {
        MealRequestItem(food_name: "chicken", quantity: 1, unit: "serving", calories: 250, protein: 35, carbs: 0, fat: 8, fiber: 0, sugar: 0, sodium: 300, notes: nil, source_type: nil, source_name: nil, confidence_label: nil)
    }
}

final class BackendServiceErrorMappingTests: XCTestCase {
    func testUnauthorizedAndForbiddenMapToFriendlySessionErrors() {
        XCTAssertEqual(BackendService.mapHTTPError(statusCode: 401, data: nil), .unauthorized)
        XCTAssertEqual(BackendService.mapHTTPError(statusCode: 403, data: nil), .forbidden)
        XCTAssertTrue(BackendError.unauthorized.localizedDescription.contains("session has expired"))
    }

    func testServerErrorUsesBackendMessageWhenAvailable() {
        let data = #"{"error":"Please try again later."}"#.data(using: .utf8)
        XCTAssertEqual(BackendService.mapHTTPError(statusCode: 500, data: data), .server("Please try again later."))
    }

    func testNetworkOfflineErrorsMapToOfflineMessage() {
        let error = NSError(domain: NSURLErrorDomain, code: NSURLErrorNotConnectedToInternet)
        XCTAssertEqual(BackendService.mapTransportError(error), .offline)
        XCTAssertTrue(BackendError.offline.localizedDescription.contains("offline"))
    }
}

final class NativeSessionStateTests: XCTestCase {
    func testGuestSessionMapsToGuestStateWithBanner() {
        let response = SessionResponse(account: AccountSnapshot(mode: "guest", title: "Guest mode is active", description: "Device session", persistenceLabel: nil), user: SessionUser(id: "u1", name: nil, mode: "guest"))
        let state = NativeSessionState.fromSessionResponse(response)

        if case .guest = state {
            XCTAssertFalse(state.isActionBlocked)
            XCTAssertEqual(state.banner?.title, "Guest mode is active")
        } else {
            XCTFail("Expected guest session")
        }
    }

    func testAccountSessionMapsToAuthenticatedWithoutBanner() {
        let response = SessionResponse(account: AccountSnapshot(mode: "account", title: "Account session is active", description: nil, persistenceLabel: nil), user: SessionUser(id: "u1", name: "Tyler", mode: "account"))
        let state = NativeSessionState.fromSessionResponse(response)

        XCTAssertEqual(state, .authenticated(response))
        XCTAssertNil(state.banner)
    }

    func testMissingUserMapsToUnauthenticatedSafeMessage() {
        let state = NativeSessionState.fromSessionResponse(SessionResponse(account: nil, user: nil))

        if case .unauthenticated(let message) = state {
            XCTAssertTrue(message.contains("Sign in is not available"))
        } else {
            XCTFail("Expected unauthenticated state")
        }
    }

    func testBackendErrorsMapToSessionStates() {
        XCTAssertEqual(NativeSessionState.fromError(BackendError.offline), .offline(message: BackendError.offline.localizedDescription))
        XCTAssertEqual(NativeSessionState.fromError(BackendError.unauthorized), .expired(message: BackendError.unauthorized.localizedDescription))
        XCTAssertEqual(NativeSessionState.fromError(BackendError.forbidden), .expired(message: BackendError.forbidden.localizedDescription))
    }
}
