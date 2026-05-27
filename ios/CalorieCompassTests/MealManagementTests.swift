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

    func testMealResponseDecodesItemWithMissingNutrients() throws {
        let data = """
        {
          "id": "meal-3",
          "mealType": "snack",
          "rawText": "Apple",
          "date": "2026-05-25T12:00:00.000Z",
          "items": [
            {
              "food_name": "apple",
              "quantity": 1,
              "unit": "medium",
              "calories": 95
            }
          ]
        }
        """.data(using: .utf8)

        let jsonData = try XCTUnwrap(data)
        let meal = try JSONDecoder().decode(MealResponse.self, from: jsonData)

        XCTAssertEqual(meal.items?.first?.food_name, "apple")
        XCTAssertEqual(meal.items?.first?.protein, 0)
        XCTAssertEqual(meal.items?.first?.carbs, 0)
        XCTAssertEqual(meal.items?.first?.fat, 0)
        XCTAssertEqual(meal.safeTotalCalories, 95)
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
        let editExpectation = expectation(description: "unsupported edit returns")
        let deleteExpectation = expectation(description: "unsupported delete returns")
        let request = PostMealRequest(meal_type: "snack", confidence_score: 1, raw_text: nil, notes: nil, date: nil, items: [Self.sampleItem()])

        BackendService.updateMeal(id: "local-123", request: request) { result in
            if case .failure(let error) = result {
                XCTAssertTrue(error.localizedDescription.contains("Local-only"))
            } else {
                XCTFail("Expected local-only edit to fail safely")
            }
            editExpectation.fulfill()
        }

        BackendService.deleteMeal(id: "local-123") { result in
            if case .failure(let error) = result {
                XCTAssertTrue(error.localizedDescription.contains("Local-only"))
            } else {
                XCTFail("Expected local-only delete to fail safely")
            }
            deleteExpectation.fulfill()
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

    func testBlankBackendErrorFallsBackToStatusMessage() {
        let data = #"{"error":"   "}"#.data(using: .utf8)
        XCTAssertEqual(BackendService.mapHTTPError(statusCode: 502, data: data), .server("Request failed with status 502."))
    }

    func testNetworkOfflineErrorsMapToOfflineMessage() {
        let error = NSError(domain: NSURLErrorDomain, code: NSURLErrorNotConnectedToInternet)
        XCTAssertEqual(BackendService.mapTransportError(error), .offline)
        XCTAssertTrue(BackendError.offline.localizedDescription.contains("offline"))
    }
}

final class AppConfigTests: XCTestCase {
    func testDefaultBaseURLUsesProductionBackend() {
        let url = AppConfig.resolvedBaseURL(
            bundleValue: nil,
            environmentValue: nil
        )

        XCTAssertEqual(url.absoluteString, AppConfig.defaultBackendBaseURLString)
    }

    func testEnvironmentBaseURLOverridesBundleValue() {
        let url = AppConfig.resolvedBaseURL(
            bundleValue: "https://bundle.example.com",
            environmentValue: "https://env.example.com"
        )

        XCTAssertEqual(url.absoluteString, "https://env.example.com")
    }

    func testBundleBaseURLIsUsedWhenEnvironmentIsMissing() {
        let url = AppConfig.resolvedBaseURL(
            bundleValue: "https://bundle.example.com",
            environmentValue: nil
        )

        XCTAssertEqual(url.absoluteString, "https://bundle.example.com")
    }

    func testInvalidBaseURLFallsBackToProduction() {
        let url = AppConfig.resolvedBaseURL(
            bundleValue: "not a url",
            environmentValue: "file:///tmp/local"
        )

        XCTAssertEqual(url.absoluteString, AppConfig.defaultBackendBaseURLString)
    }
}

final class NativeSessionStateTests: XCTestCase {
    func testGuestSessionMapsToGuestStateWithBanner() {
        let response = SessionResponse(account: AccountSnapshot(mode: "guest", title: "Guest mode is active", description: "Device session", persistenceLabel: nil, providers: nil), user: SessionUser(id: "u1", name: nil, mode: "guest"))
        let state = NativeSessionState.fromSessionResponse(response)

        if case .guest = state {
            XCTAssertFalse(state.isActionBlocked)
            XCTAssertEqual(state.banner?.title, "Guest mode is active")
        } else {
            XCTFail("Expected guest session")
        }
    }

    func testAccountSessionMapsToAuthenticatedWithoutBanner() {
        let response = SessionResponse(account: AccountSnapshot(mode: "account", title: "Account session is active", description: nil, persistenceLabel: nil, providers: nil), user: SessionUser(id: "u1", name: "Tyler", mode: "account"))
        let state = NativeSessionState.fromSessionResponse(response)

        XCTAssertEqual(state, .authenticated(response))
        XCTAssertNil(state.banner)
    }

    func testMissingUserMapsToUnauthenticatedSafeMessage() {
        let state = NativeSessionState.fromSessionResponse(SessionResponse(account: nil, user: nil))

        if case .unauthenticated(let message) = state {
            XCTAssertTrue(message.contains("Native sign-in is not available"))
        } else {
            XCTFail("Expected unauthenticated state")
        }
    }

    func testAccountSnapshotDecodesProviderReadiness() throws {
        let data = """
        {
          "account": {
            "mode": "guest",
            "title": "Guest mode is active",
            "description": "Device session",
            "persistenceLabel": "Live guest session",
            "providers": [
              {
                "id": "apple",
                "label": "Continue with Apple",
                "status": "planned",
                "detail": "Backend verification is not ready yet."
              }
            ]
          },
          "user": {
            "id": "u1",
            "name": null,
            "mode": "guest"
          }
        }
        """.data(using: .utf8)

        let jsonData = try XCTUnwrap(data)
        let response = try JSONDecoder().decode(SessionResponse.self, from: jsonData)

        XCTAssertEqual(response.account?.providers?.first?.id, "apple")
        XCTAssertEqual(response.account?.providers?.first?.displayLabel, "Continue with Apple")
        XCTAssertFalse(response.account?.providers?.first?.isAvailable ?? true)
        XCTAssertEqual(NativeSessionState.fromSessionResponse(response).sessionResponse, response)
    }

    func testBackendErrorsMapToSessionStates() {
        XCTAssertEqual(NativeSessionState.fromError(BackendError.offline), .offline(message: BackendError.offline.localizedDescription))
        XCTAssertEqual(NativeSessionState.fromError(BackendError.unauthorized), .expired(message: BackendError.unauthorized.localizedDescription))
        XCTAssertEqual(NativeSessionState.fromError(BackendError.forbidden), .expired(message: BackendError.forbidden.localizedDescription))
    }

    func testOnlyExpiredAndOfflineStatesBlockActions() {
        let response = SessionResponse(account: nil, user: SessionUser(id: "u1", name: nil, mode: "account"))

        XCTAssertFalse(NativeSessionState.unknown.isActionBlocked)
        XCTAssertFalse(NativeSessionState.loading.isActionBlocked)
        XCTAssertFalse(NativeSessionState.authenticated(response).isActionBlocked)
        XCTAssertFalse(NativeSessionState.unauthenticated(message: "Native sign-in is not available in this build yet.").isActionBlocked)
        XCTAssertTrue(NativeSessionState.expired(message: "Expired").isActionBlocked)
        XCTAssertTrue(NativeSessionState.offline(message: "Offline").isActionBlocked)
    }

    func testNativeSessionStateExposesAuthSessionWithoutForcingLogin() {
        let response = SessionResponse(account: nil, user: SessionUser(id: "guest-1", name: nil, mode: "guest"))
        let session = NativeSessionState.fromSessionResponse(response).authSession

        XCTAssertTrue(session.isGuest)
        XCTAssertFalse(session.isSignedIn)
        XCTAssertTrue(session.canUpgradeGuest)
        XCTAssertEqual(session.signInAvailability, .planned)
    }
}

final class AuthSessionScaffoldTests: XCTestCase {
    func testAppleAuthServiceReportsUnavailableInsteadOfPretendingToSignIn() {
        let service = AppleAuthService(storage: InMemoryAuthStorage())
        let expectation = expectation(description: "auth scaffold responds")

        service.signInWithApple { result in
            switch result {
            case .success(.unavailable(let message)):
                XCTAssertTrue(message.contains("coming soon"))
            default:
                XCTFail("Phase 4C must not report a real Apple sign-in result")
            }
            expectation.fulfill()
        }

        waitForExpectations(timeout: 1)
    }

    func testSignOutClearsStoredSessionToken() {
        let storage = InMemoryAuthStorage(token: "server-issued-token-placeholder")
        let service = AppleAuthService(storage: storage)
        let expectation = expectation(description: "sign out responds")

        XCTAssertNotNil(storage.readSessionToken())
        XCTAssertTrue(service.currentSession().isGuest)
        XCTAssertFalse(service.currentSession().isSignedIn)
        service.signOut { result in
            XCTAssertEqual(result, .success(.signedOut))
            XCTAssertNil(storage.readSessionToken())
            expectation.fulfill()
        }

        waitForExpectations(timeout: 1)
    }
}

final class StabilitySupportTests: XCTestCase {
    func testRetryCopyMakesFailuresNonDestructive() {
        let message = RetryCopy.nonDestructiveFailure(action: "save this meal", error: BackendError.offline)

        XCTAssertTrue(message.contains("Nothing was deleted or overwritten"))
        XCTAssertTrue(message.contains("offline") || message.contains("network"))
    }

    func testOfflineRetryCopyKeepsCurrentScreenSafe() {
        let message = RetryCopy.offlineMessage(action: "refresh Today")

        XCTAssertTrue(message.contains("current screen is safe"))
        XCTAssertTrue(message.contains("try again"))
    }
}

private final class InMemoryAuthStorage: SecureAuthStorage {
    private var token: String?

    init(token: String? = nil) {
        self.token = token
    }

    func readSessionToken() -> String? { token }
    func saveSessionToken(_ token: String) throws { self.token = token }
    func clearSessionToken() { token = nil }
}
