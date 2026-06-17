// MealManagementTests.swift
// Calorie Compass iOS — Phase 3C meal management coverage
import AVFoundation
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

    func testRateLimitAndBadRequestErrorsStayFriendly() {
        let rateLimit = #"{"error":"Too many meal requests. Please wait a minute."}"#.data(using: .utf8)

        XCTAssertEqual(BackendService.mapHTTPError(statusCode: 400, data: nil), .server("Request failed with status 400."))
        XCTAssertEqual(BackendService.mapHTTPError(statusCode: 429, data: rateLimit), .server("Too many meal requests. Please wait a minute."))
    }

    func testNetworkOfflineErrorsMapToOfflineMessage() {
        let error = NSError(domain: NSURLErrorDomain, code: NSURLErrorNotConnectedToInternet)
        XCTAssertEqual(BackendService.mapTransportError(error), .offline)
        XCTAssertTrue(BackendError.offline.localizedDescription.contains("offline"))
    }
}

final class MealAssistantParityTests: XCTestCase {
    func testRequestStateCarriesReviewItemsForQuantityCorrections() {
        let salmon = Self.item("salmon", quantity: 1, unit: "fillet")
        let broccoli = Self.item("broccoli", quantity: 1, unit: "cup")
        var state = MealAssistantState()
        state.currentMealText = "salmon with broccoli"

        let requestState = MealAssistantClientLogic.buildRequestState(
            assistantState: state,
            currentMealItems: [salmon, broccoli],
            incomingUserMessage: "8 ounces of salmon"
        )

        XCTAssertEqual(requestState.currentMealItems.map(\.food_name), ["salmon", "broccoli"])
        XCTAssertEqual(requestState.currentMealText, "salmon with broccoli")
        XCTAssertEqual(requestState.previousUserMessage, "8 ounces of salmon")
        XCTAssertFalse(requestState.saved)
    }

    func testSavedStateStartsFreshMealWithoutLeakingOldItems() {
        var state = MealAssistantState()
        state.currentMealItems = [Self.item("old shake")]
        state.currentMealText = "old shake"
        state.saved = true

        let requestState = MealAssistantClientLogic.buildRequestState(
            assistantState: state,
            currentMealItems: [Self.item("old shake")],
            incomingUserMessage: "one banana"
        )

        XCTAssertTrue(requestState.currentMealItems.isEmpty)
        XCTAssertEqual(requestState.currentMealText, "one banana")
        XCTAssertFalse(requestState.saved)
    }

    func testDiscardAndSaveCommandsAreHandledLocallyBeforeFoodLookup() {
        XCTAssertEqual(MealAssistantClientLogic.detectLocalCommand("Discard that", hasActiveMeal: true), .discard)
        XCTAssertEqual(MealAssistantClientLogic.detectLocalCommand("Delete this meal", hasActiveMeal: true), .discard)
        XCTAssertEqual(MealAssistantClientLogic.detectLocalCommand("Clear everything", hasActiveMeal: true), .discard)
        XCTAssertEqual(MealAssistantClientLogic.detectLocalCommand("start over", hasActiveMeal: true), .discard)
        XCTAssertEqual(MealAssistantClientLogic.detectLocalCommand("new meal", hasActiveMeal: true), .discard)
        XCTAssertEqual(MealAssistantClientLogic.detectLocalCommand("save it", hasActiveMeal: true), .save)
        XCTAssertEqual(MealAssistantClientLogic.detectLocalCommand("Save the meal", hasActiveMeal: true), .save)
        XCTAssertEqual(MealAssistantClientLogic.detectLocalCommand("Okay now save the meal", hasActiveMeal: true), .save)
        XCTAssertEqual(MealAssistantClientLogic.detectLocalCommand("Save", hasActiveMeal: true), .save)
        XCTAssertEqual(MealAssistantClientLogic.detectLocalCommand("nvm", hasActiveMeal: true), .discard)
        XCTAssertEqual(MealAssistantClientLogic.detectLocalCommand("delete that nvm", hasActiveMeal: true), .discard)
        XCTAssertNil(MealAssistantClientLogic.detectLocalCommand("Discard that", hasActiveMeal: false))
        XCTAssertNil(MealAssistantClientLogic.detectLocalCommand("Save the meal", hasActiveMeal: false))
    }

    func testRecentSavedMealUndoCommandsAreRecognizedWithoutActiveDraft() {
        XCTAssertTrue(MealAssistantClientLogic.isRecentSavedMealUndoCommand("delete that nvm"))
        XCTAssertTrue(MealAssistantClientLogic.isRecentSavedMealUndoCommand("undo that"))
        XCTAssertTrue(MealAssistantClientLogic.isRecentSavedMealUndoCommand("remove last"))
        XCTAssertFalse(MealAssistantClientLogic.isRecentSavedMealUndoCommand("1 can coke zero"))
        XCTAssertFalse(MealAssistantClientLogic.isRecentSavedMealUndoCommand("delete fries"))
    }

    func testRemoveFriesUpdatesActiveMealItemsLocally() {
        let burger = Self.item("turkey sandwich with mayo")
        let fries = Self.item("fries")

        let nextItems = MealAssistantClientLogic.removingItems(matching: "fries", from: [burger, fries])

        XCTAssertEqual(nextItems.map(\.food_name), ["turkey sandwich with mayo"])
    }

    func testRemoveVariantsOnlyRemoveTargetItem() {
        let items = [Self.item("sandwich"), Self.item("chips"), Self.item("Coke Zero")]

        XCTAssertEqual(MealAssistantClientLogic.detectLocalCommand("Remove the chips", hasActiveMeal: true), .removeItem("the chips"))
        XCTAssertEqual(MealAssistantClientLogic.removingItems(matching: "the chips", from: items).map(\.food_name), ["sandwich", "Coke Zero"])
        XCTAssertEqual(MealAssistantClientLogic.removingItems(matching: "Coke Zero", from: items).map(\.food_name), ["sandwich", "chips"])
        XCTAssertEqual(MealAssistantClientLogic.removingItems(matching: "sandwich", from: items).map(\.food_name), ["chips", "Coke Zero"])
    }

    func testWrongTargetCorrectionResolvesNamedItemOnly() {
        let items = [Self.item("salmon"), Self.item("broccoli"), Self.item("mashed potatoes")]

        let resolution = MealAssistantClientLogic.quantityResolution(for: "Make the salmon 8 ounces", items: items)

        XCTAssertEqual(resolution, .target(foodName: "salmon"))
    }

    func testPronounQuantityCorrectionUsesLastItemOrClarifies() {
        let items = [Self.item("salmon"), Self.item("broccoli")]

        let resolution = MealAssistantClientLogic.quantityResolution(for: "Make it 8 ounces", items: items)

        XCTAssertEqual(resolution, .target(foodName: "broccoli"))
        XCTAssertNotEqual(resolution, .target(foodName: "salmon"))
    }

    func testQuantityUpdateVariantsResolveTargetsOrClarify() {
        XCTAssertEqual(MealAssistantClientLogic.quantityResolution(for: "Actually make that 2", items: [Self.item("Fairlife shake")]), .target(foodName: "Fairlife shake"))
        XCTAssertEqual(MealAssistantClientLogic.quantityResolution(for: "Double the chicken", items: [Self.item("chicken"), Self.item("rice")]), .target(foodName: "chicken"))
        XCTAssertEqual(MealAssistantClientLogic.quantityResolution(for: "Half the rice", items: [Self.item("chicken"), Self.item("rice")]), .target(foodName: "rice"))
        XCTAssertEqual(MealAssistantClientLogic.quantityResolution(for: "Make the fries large", items: [Self.item("burger"), Self.item("fries")]), .target(foodName: "fries"))
        XCTAssertEqual(MealAssistantClientLogic.quantityResolution(for: "Make it large", items: [Self.item("burger"), Self.item("fries")]), .target(foodName: "fries"))
        XCTAssertNil(MealAssistantClientLogic.quantityResolution(for: "McDouble no cheese", items: [Self.item("Chipotle bowl")]))
    }

    func testBrandCorrectionUpdatesPreviousBrandItem() {
        let fairlife = Self.item("Fairlife shake")

        let requestState = MealAssistantClientLogic.buildRequestState(
            assistantState: MealAssistantState(),
            currentMealItems: [fairlife],
            incomingUserMessage: "Actually make that 2"
        )

        XCTAssertEqual(requestState.currentMealItems.map(\.food_name), ["Fairlife shake"])
        XCTAssertEqual(MealAssistantClientLogic.quantityResolution(for: "Actually make that 2", items: requestState.currentMealItems), .target(foodName: "Fairlife shake"))
    }

    func testBadFoodMatchWarningsCatchBananaPowderAndMissingSandwich() {
        XCTAssertNotNil(MealAssistantClientLogic.foodMatchWarning(for: "One banana", items: [Self.item("banana powder")]))
        XCTAssertNotNil(MealAssistantClientLogic.foodMatchWarning(for: "One banana", items: [Self.item("dehydrated banana")]))
        XCTAssertNil(MealAssistantClientLogic.foodMatchWarning(for: "One banana", items: [Self.item("banana")]))

        XCTAssertNotNil(MealAssistantClientLogic.foodMatchWarning(for: "Turkey sandwich with mayo and chips", items: [Self.item("Sun Chips")]))
        XCTAssertNil(MealAssistantClientLogic.foodMatchWarning(for: "Turkey sandwich with mayo and chips", items: [Self.item("turkey sandwich with mayo"), Self.item("chips")]))
    }

    func testBrandedFoodsDoNotTriggerGenericBadMatchGuards() {
        let brands = [
            "Quest BBQ Protein Chips",
            "Fairlife Core Power",
            "Premier Protein shake",
            "David Sunflower Seeds",
            "McDonald's Big Mac",
            "Chick-fil-A Nuggets",
            "Starbucks Iced Latte",
            "Chipotle Chicken Bowl",
            "Chobani Greek Yogurt",
            "Coke Zero"
        ]

        for brand in brands {
            XCTAssertNil(MealAssistantClientLogic.foodMatchWarning(for: brand, items: [Self.trustedItem(brand)]), brand)
        }
    }

    func testOffTopicEmptyAssistantResponsePreservesActiveMealState() {
        let currentItems = [Self.item("chicken breast"), Self.item("rice")]

        XCTAssertTrue(MealAssistantClientLogic.shouldPreserveActiveMeal(currentItems: currentItems, responseItems: [], responseSaved: false, incomingUserMessage: "thanks"))
        XCTAssertTrue(MealAssistantClientLogic.shouldPreserveActiveMeal(currentItems: currentItems, responseItems: [], responseSaved: false, incomingUserMessage: "where are my macros"))
        XCTAssertTrue(MealAssistantClientLogic.shouldPreserveActiveMeal(currentItems: currentItems, responseItems: [], responseSaved: false, incomingUserMessage: "and fries"))
        XCTAssertFalse(MealAssistantClientLogic.shouldPreserveActiveMeal(currentItems: currentItems, responseItems: [Self.item("broccoli")], responseSaved: false, incomingUserMessage: "thanks"))
        XCTAssertFalse(MealAssistantClientLogic.shouldPreserveActiveMeal(currentItems: currentItems, responseItems: [], responseSaved: true, incomingUserMessage: "thanks"))
        XCTAssertFalse(MealAssistantClientLogic.shouldPreserveActiveMeal(currentItems: currentItems, responseItems: [], responseSaved: false, incomingUserMessage: "McDouble no cheese"))
    }

    func testReplacementClarificationDoesNotPreserveStaleReviewCard() {
        let currentItems = [Self.item("Candies, MARS SNACKFOOD US, SNICKERS Bar")]

        XCTAssertFalse(MealAssistantClientLogic.shouldPreserveActiveMeal(currentItems: currentItems, responseItems: [], responseSaved: false, incomingUserMessage: "A skittles pack I meant"))
        XCTAssertFalse(MealAssistantClientLogic.shouldPreserveActiveMeal(currentItems: currentItems, responseItems: [], responseSaved: false, incomingUserMessage: "actually Quest BBQ protein chips"))
    }

    func testResponseReducerUsesNextStateAsPendingMealSourceOfTruth() {
        let stale = [Self.item("Chipotle bowl")]
        let authoritative = [Self.item("McDouble no cheese")]
        let legacyMealItems = [Self.item("McChicken")]

        let items = MealAssistantClientLogic.resolvedReviewItems(
            currentItems: stale,
            nextStateItems: authoritative,
            responseItems: legacyMealItems,
            responseSaved: false,
            incomingUserMessage: "McDouble no cheese"
        )

        XCTAssertEqual(items.map(\.food_name), ["McDouble no cheese"])
    }

    func testResponseReducerPrefersStructuredPendingMealOverLegacyFields() {
        let stale = [Self.item("Chipotle bowl")]
        let pending = PendingMeal(
            id: "pending-1",
            version: 1,
            items: [Self.item("Baconator")],
            totals: MealAssistantTotals(calories: 960, protein: 59, carbs: 38, fat: 62, fiber: 2, sugar: 8, sodium: 1600),
            aggregateConfidence: 0.97,
            sourceSummary: PendingMealSourceSummary(sourceTypes: ["OFFICIAL_RESTAURANT"], sourceNames: ["Wendy's official nutrition"], trustedItemCount: 1, estimatedItemCount: 0),
            mealType: "lunch",
            status: "ready_for_review",
            clarification: nil,
            createdAt: "2026-06-16T12:00:00.000Z",
            updatedAt: "2026-06-16T12:00:00.000Z",
            lastResolvedAt: "2026-06-16T12:00:00.000Z"
        )

        let items = MealAssistantClientLogic.resolvedReviewItems(
            currentItems: stale,
            pendingMeal: pending,
            nextStateItems: [Self.item("Spicy Chicken")],
            responseItems: [Self.item("McChicken")],
            responseSaved: false,
            incomingUserMessage: "Wendy's Baconator"
        )

        XCTAssertEqual(items.map(\.food_name), ["Baconator"])
    }

    func testResponseReducerPreservesPendingCardForMacroFollowUp() {
        let current = [Self.item("grilled chicken breast"), Self.item("asparagus")]

        let items = MealAssistantClientLogic.resolvedReviewItems(
            currentItems: current,
            nextStateItems: [],
            responseItems: [],
            responseSaved: false,
            incomingUserMessage: "where are my macros"
        )

        XCTAssertEqual(items.map(\.food_name), ["grilled chicken breast", "asparagus"])
    }

    func testResponseReducerDoesNotRestoreStaleItemsAfterFailedReplacement() {
        let current = [Self.item("Chipotle bowl")]

        let items = MealAssistantClientLogic.resolvedReviewItems(
            currentItems: current,
            nextStateItems: [],
            responseItems: [],
            responseSaved: false,
            incomingUserMessage: "McDouble no cheese"
        )

        XCTAssertTrue(items.isEmpty)
    }

    func testMealReviewTitleUsesShortNonTruncatedCopy() {
        XCTAssertEqual(MealReviewCard.reviewTitle, "Review meal")
        XCTAssertLessThanOrEqual(MealReviewCard.reviewTitle.count, 16)
    }

    func testMealItemServingScalingPreservesSourceMetadata() {
        var item = MealItem(from: Self.trustedItem("Greek yogurt"))

        item.applyServing(quantity: 2, unit: "servings")

        XCTAssertEqual(item.quantity, 2)
        XCTAssertEqual(item.unit, "serving")
        XCTAssertEqual(item.calories, 200)
        XCTAssertEqual(item.protein, 20)
        XCTAssertEqual(item.source, "Nutrition catalog")
        XCTAssertEqual(item.catalogFoodID, "brand-greek-yogurt")
    }

    func testMealItemPrefersServerDisplayNameButPreservesSourceName() {
        let requestItem = MealRequestItem(
            food_name: "Corn, sweet, white, frozen, kernels on cob, unprepared",
            display_name: "Buttered Corn on the Cob",
            canonical_name: "Corn On The Cob",
            source_food_name: "Corn, sweet, white, frozen, kernels on cob, unprepared",
            quantity: 1,
            unit: "ear",
            calories: 155,
            protein: 4,
            carbs: 32,
            fat: 3,
            fiber: 3,
            sugar: 6,
            sodium: 120,
            notes: nil,
            source_type: "GENERIC_REFERENCE",
            source_name: "USDA FoodData Central",
            confidence_label: "Matched"
        )

        let item = MealItem(from: requestItem)
        let roundTripped = item.asMealRequestItem()

        XCTAssertEqual(item.displayName, "Buttered Corn on the Cob")
        XCTAssertEqual(roundTripped.display_name, "Buttered Corn on the Cob")
        XCTAssertEqual(roundTripped.source_food_name, "Corn, sweet, white, frozen, kernels on cob, unprepared")
    }

    func testServingUnitFormatterCleansMalformedUnits() {
        XCTAssertEqual(ServingUnitFormatter.clean("28.4 1 onz"), "oz")
        XCTAssertEqual(ServingUnitFormatter.clean("ounces"), "oz")
        XCTAssertEqual(ServingUnitFormatter.clean("grams"), "g")
    }

    func testSearchAndBarcodeResponsesDecodeReviewItems() throws {
        let data = """
        {
          "query": "egg",
          "results": [
            {
              "id": "catalog:egg",
              "name": "Large egg",
              "brand": null,
              "sourceLabel": "Verified",
              "servingQuantity": 1,
              "servingUnit": "egg",
              "calories": 70,
              "protein": 6,
              "carbs": 0,
              "fat": 5,
              "barcode": null,
              "mealType": "snack",
              "confidenceScore": 1,
              "sourceReusableMealId": null,
              "items": [
                {
                  "food_name": "Large egg",
                  "quantity": 1,
                  "unit": "egg",
                  "calories": 70,
                  "protein": 6,
                  "carbs": 0,
                  "fat": 5,
                  "fiber": 0,
                  "sugar": 0,
                  "sodium": 70,
                  "source_type": "GENERIC_REFERENCE",
                  "source_name": "Generic nutrition reference",
                  "confidence_label": "High",
                  "is_trusted": true,
                  "catalog_food_id": "generic_large_egg"
                }
              ]
            }
          ]
        }
        """.data(using: .utf8)
        let barcodeData = """
        {
          "barcode": "012345678905",
          "found": true,
          "result": {
            "id": "custom-1",
            "name": "Turkey Chili",
            "brand": "Home",
            "sourceLabel": "Custom",
            "servingQuantity": 1,
            "servingUnit": "bowl",
            "calories": 410,
            "protein": 36,
            "carbs": 32,
            "fat": 14,
            "barcode": "012345678905",
            "mealType": "snack",
            "confidenceScore": 1,
            "sourceReusableMealId": null,
            "items": [
              {
                "food_name": "Turkey Chili",
                "quantity": 1,
                "unit": "bowl",
                "calories": 410,
                "protein": 36,
                "carbs": 32,
                "fat": 14,
                "fiber": 8,
                "sugar": 6,
                "sodium": 720,
                "source_type": "GENERIC_REFERENCE",
                "source_name": "Custom food: Home",
                "confidence_label": "Verified",
                "is_trusted": true
              }
            ]
          }
        }
        """.data(using: .utf8)

        let search = try JSONDecoder().decode(FoodSearchResponse.self, from: try XCTUnwrap(data))
        let barcode = try JSONDecoder().decode(BarcodeLookupResponse.self, from: try XCTUnwrap(barcodeData))

        XCTAssertEqual(search.results.first?.reviewItems.first?.food_name, "Large egg")
        XCTAssertEqual(barcode.result?.barcode, "012345678905")
        XCTAssertEqual(barcode.result?.reviewItems.first?.food_name, "Turkey Chili")
    }

    func testFoodSearchResponseDecodesTrustAndReviewMetadata() throws {
        let data = """
        {
          "query": "1 can coke zero",
          "normalizedQuery": "Coke Zero",
          "clarificationQuestion": null,
          "usedResolver": true,
          "usedRanking": false,
          "cache": {
            "resolverHit": false,
            "rankingHit": false,
            "selectedResultHit": false
          },
          "results": [
            {
              "id": "provider:coke-zero",
              "name": "Coke Zero",
              "brand": "Coca-Cola",
              "restaurant": null,
              "sourceLabel": "Brand verified",
              "sourceType": "GENERIC_REFERENCE",
              "sourceName": "Coca-Cola nutrition reference",
              "providerId": "brand-provider",
              "servingQuantity": 1,
              "servingUnit": "can",
              "calories": 0,
              "protein": 0,
              "carbs": 0,
              "fat": 0,
              "confidenceScore": 0.96,
              "estimated": false,
              "needsReview": false,
              "reason": "Matched branded zero-calorie soda.",
              "barcode": null,
              "mealType": "snack",
              "sourceReusableMealId": null,
              "items": [
                {
                  "food_name": "Coke Zero",
                  "quantity": 1,
                  "unit": "can",
                  "calories": 0,
                  "protein": 0,
                  "carbs": 0,
                  "fat": 0,
                  "fiber": 0,
                  "sugar": 0,
                  "sodium": 40,
                  "source_type": "GENERIC_REFERENCE",
                  "source_name": "Coca-Cola nutrition reference",
                  "confidence_label": "Matched",
                  "is_trusted": true
                }
              ]
            }
          ]
        }
        """.data(using: .utf8)

        let response = try JSONDecoder().decode(FoodSearchResponse.self, from: try XCTUnwrap(data))
        let result = try XCTUnwrap(response.results.first)

        XCTAssertEqual(response.normalizedQuery, "Coke Zero")
        XCTAssertEqual(response.cache?.resolverHit, false)
        XCTAssertEqual(result.sourceLabel, "Brand verified")
        XCTAssertEqual(result.sourceType, "GENERIC_REFERENCE")
        XCTAssertEqual(result.sourceName, "Coca-Cola nutrition reference")
        XCTAssertEqual(result.providerId, "brand-provider")
        XCTAssertEqual(result.estimated, false)
        XCTAssertEqual(result.needsReview, false)
        XCTAssertEqual(result.reason, "Matched branded zero-calorie soda.")
        XCTAssertEqual(result.reviewItems.first?.source_name, "Coca-Cola nutrition reference")
    }

    func testManualQuickAddRejectsInvalidValuesAndBuildsReviewItem() {
        XCTAssertNil(ManualQuickAddBuilder.build(calories: -1, protein: 0, carbs: 0, fat: 0, barcode: nil))

        let item = ManualQuickAddBuilder.build(calories: 250, protein: 20, carbs: 25, fat: 7, barcode: "012345678905")

        XCTAssertEqual(item?.food_name, "Manual Quick Add")
        XCTAssertEqual(item?.calories, 250)
        XCTAssertEqual(item?.protein, 20)
        XCTAssertEqual(item?.notes, "Manual barcode: 012345678905")
        XCTAssertEqual(item?.confidence_label, "Estimated")
    }

    func testBarcodeCameraPermissionStateMapsDeniedAndUnavailable() {
        XCTAssertEqual(BarcodeCameraPermissionState.from(status: .authorized, hasCamera: true), .authorized)
        XCTAssertEqual(BarcodeCameraPermissionState.from(status: .denied, hasCamera: true), .denied)
        XCTAssertEqual(BarcodeCameraPermissionState.from(status: .authorized, hasCamera: false), .unavailable)
        XCTAssertFalse(BarcodeCameraPermissionState.denied.allowsScanning)
        XCTAssertTrue(BarcodeCameraPermissionState.authorized.permissionCopy.contains("read barcodes"))
    }

    func testBarcodeFallbackModelKeepsReviewBeforeSaveOptions() {
        let model = BarcodeLookupFallbackModel(barcode: " 01234-5678905 ")

        XCTAssertEqual(model.normalizedBarcode, "012345678905")
        XCTAssertTrue(model.canLookup)
        XCTAssertEqual(model.aiDescriptionPrompt, "Barcode 012345678905: describe the food or package so MacroMesh can estimate it for review.")
    }

    func testLogToolCatalogShowsMFPAndCameraFoundationActionsTogether() {
        XCTAssertEqual(LogToolCatalog.foodToolTitles, ["Food Search", "Enter Barcode", "Quick Add", "Custom Food"])
        XCTAssertEqual(LogToolCatalog.cameraToolTitles, ["Scan Barcode", "Scan Label", "Attach Photo"])
        XCTAssertTrue(LogToolCatalog.allTitles.contains("Food Search"))
        XCTAssertTrue(LogToolCatalog.allTitles.contains("Scan Barcode"))
    }

    func testNutritionLabelOCRTextNormalizesWithoutParsingMacros() {
        let result = NutritionLabelOCRResult.fromRecognizedText([
            "Nutrition Facts",
            "Calories 150",
            "Protein 10g",
            "   "
        ])

        XCTAssertEqual(result.lines, ["Nutrition Facts", "Calories 150", "Protein 10g"])
        XCTAssertEqual(result.rawText, "Nutrition Facts\nCalories 150\nProtein 10g")
        XCTAssertTrue(result.hasUsableText)
    }

    func testNutritionLabelManualEntryRequiresUserConfirmedValues() {
        let rejected = NutritionLabelManualEntryBuilder.build(foodName: " ", calories: 150, protein: 10, carbs: 12, fat: 3, extractedText: "Calories 150")
        XCTAssertNil(rejected)

        let item = NutritionLabelManualEntryBuilder.build(foodName: "Greek yogurt", calories: 150, protein: 10, carbs: 12, fat: 3, extractedText: "Calories 150")

        XCTAssertEqual(item?.food_name, "Greek yogurt")
        XCTAssertEqual(item?.unit, "label")
        XCTAssertEqual(item?.calories, 150)
        XCTAssertEqual(item?.source_type, "AI_ESTIMATE")
        XCTAssertEqual(item?.source_name, "Nutrition label manual entry")
        XCTAssertTrue(item?.notes?.contains("OCR text captured") == true)
    }

    func testMealPhotoDraftTracksLocalOnlyAttachmentStatus() {
        let draft = MealPhotoDraft(
            itemIdentifier: "local-asset-1",
            filename: "IMG_0001.jpg",
            createdAt: Date(timeIntervalSince1970: 0),
            hasLocalPreview: true
        )

        XCTAssertEqual(draft.storageStatus, "Local draft only")
        XCTAssertEqual(draft.accessibilityLabel, "Meal photo IMG_0001.jpg attached locally. Upload storage is deferred.")
        XCTAssertTrue(draft.hasLocalPreview)
    }

    func testQuickMealTypeSelectionUpdatesAssistantState() {
        var state = MealAssistantState()

        state = MealAssistantClientLogic.applyingMealType("lunch", to: state)

        XCTAssertEqual(state.mealType, "lunch")
    }

    func testGoalSetupCalculatorBuildsProteinForwardTargets() {
        let result = GoalSetupCalculator.calculate(
            weightLbs: 180,
            goalWeightLbs: 170,
            goal: "LOSE_WEIGHT",
            activityLevel: "MODERATE",
            ratePerWeekLbs: 1,
            proteinPreference: .high
        )

        XCTAssertGreaterThanOrEqual(result.dailyCalorieGoal, 1500)
        XCTAssertGreaterThanOrEqual(result.proteinGoal, 160)
        XCTAssertGreaterThan(result.carbsGoal, 0)
        XCTAssertGreaterThan(result.fatGoal, 40)
    }

    func testDashboardResponseDecodesStreakStats() throws {
        let data = """
        {
          "totals": { "calories": 900, "protein": 95, "carbs": 80, "fat": 28 },
          "macroGoals": { "calories": 2100, "protein": 160, "carbs": 210, "fat": 70 },
          "mealCount": 2,
          "streaks": {
            "currentStreakDays": 3,
            "mealsLoggedThisWeek": 12,
            "proteinGoalHitDaysThisWeek": 4,
            "summary": "3 day streak"
          }
        }
        """.data(using: .utf8)

        let response = try JSONDecoder().decode(DashboardResponse.self, from: try XCTUnwrap(data))

        XCTAssertEqual(response.streaks?.currentStreakDays, 3)
        XCTAssertEqual(response.streaks?.mealsLoggedThisWeek, 12)
        XCTAssertEqual(response.streaks?.proteinGoalHitDaysThisWeek, 4)
    }

    func testAnalyticsAndWeightResponsesDecodeNativeSummaries() throws {
        let analyticsData = """
        {
          "analytics": {
            "sevenDayAverageCalories": 1775,
            "sevenDayAverageProtein": 149,
            "thirtyDayAverageCalories": 1801,
            "highestProteinDay": { "date": "2026-06-01", "protein": 185 },
            "macroConsistencySummary": "4 protein days"
          },
          "weightTrend": {
            "latestWeightLbs": 181,
            "changeLbs": -3,
            "direction": "down"
          }
        }
        """.data(using: .utf8)
        let weightData = """
        {
          "entries": [
            { "id": "weight-1", "date": "2026-06-02T00:00:00.000Z", "weightLbs": 181 }
          ],
          "trend": {
            "latestWeightLbs": 181,
            "changeLbs": -3,
            "direction": "down"
          }
        }
        """.data(using: .utf8)

        let analytics = try JSONDecoder().decode(AnalyticsResponse.self, from: try XCTUnwrap(analyticsData))
        let weights = try JSONDecoder().decode(WeightEntriesResponse.self, from: try XCTUnwrap(weightData))

        XCTAssertEqual(analytics.analytics.sevenDayAverageCalories, 1775)
        XCTAssertEqual(analytics.weightTrend.direction, "down")
        XCTAssertEqual(weights.entries.first?.weightLbs, 181)
        XCTAssertEqual(weights.trend.changeLbs, -3)
    }

    func testSaveGuardPreventsEmptyAndDuplicateSubmissions() {
        let items = [Self.item("protein shake")]

        XCTAssertTrue(MealAssistantClientLogic.canAttemptSave(items: items, isSaving: false))
        XCTAssertFalse(MealAssistantClientLogic.canAttemptSave(items: items, isSaving: true))
        XCTAssertFalse(MealAssistantClientLogic.canAttemptSave(items: [], isSaving: false))
    }

    func testSimpleAndCompoundFoodPromptsCarryStableRequestState() {
        let prompts = [
            "apple",
            "banana",
            "rice",
            "eggs",
            "chicken breast",
            "oatmeal",
            "protein shake",
            "peanut butter toast",
            "burger fries and soda",
            "eggs toast bacon and orange juice",
            "chicken rice broccoli",
            "quest chips and fairlife shake",
            "big mac meal with fries and coke",
            "chipotle bowl with extra chicken"
        ]

        for prompt in prompts {
            let requestState = MealAssistantClientLogic.buildRequestState(assistantState: MealAssistantState(), currentMealItems: [], incomingUserMessage: prompt)
            XCTAssertEqual(requestState.currentMealText, prompt)
            XCTAssertEqual(requestState.previousUserMessage, prompt)
            XCTAssertFalse(requestState.saved)
        }
    }

    func testMalformedMealAssistantResponsesFailDecodingInsteadOfApplyingPartialState() throws {
        let missingMeal = #"{"assistant_reply":"ok","next_state":{},"intent":"new_food_item"}"#.data(using: .utf8)
        let malformedJSON = #"{"assistant_reply":"ok","meal": "#.data(using: .utf8)

        XCTAssertThrowsError(try JSONDecoder().decode(MealAssistantResponse.self, from: try XCTUnwrap(missingMeal)))
        XCTAssertThrowsError(try JSONDecoder().decode(MealAssistantResponse.self, from: try XCTUnwrap(malformedJSON)))
    }

    func testStateResetAfterSaveStartsFreshMeal() {
        var state = MealAssistantState()
        state.currentMealItems = [Self.item("salmon")]
        state.currentMealText = "salmon and broccoli"
        state.saved = true

        let requestState = MealAssistantClientLogic.buildRequestState(
            assistantState: state,
            currentMealItems: state.currentMealItems,
            incomingUserMessage: "one banana"
        )

        XCTAssertTrue(requestState.currentMealItems.isEmpty)
        XCTAssertEqual(requestState.currentMealText, "one banana")
    }

    func testEditRemoveSavePreservesAllSourceMetadata() throws {
        let trusted = MealRequestItem(
            food_name: "salmon",
            quantity: 8,
            unit: "oz",
            calories: 360,
            protein: 46,
            carbs: 0,
            fat: 18,
            fiber: 0,
            sugar: 0,
            sodium: 120,
            notes: "wild caught",
            source_type: "USDA_FOUNDATION",
            source_name: "USDA FoodData Central",
            confidence_label: "High",
            is_trusted: true,
            catalog_food_id: "fdc-salmon"
        )

        let roundTripped = MealItem(from: trusted).asMealRequestItem()

        XCTAssertEqual(roundTripped.food_name, "salmon")
        XCTAssertEqual(roundTripped.is_trusted, true)
        XCTAssertEqual(roundTripped.catalog_food_id, "fdc-salmon")
        XCTAssertEqual(roundTripped.source_name, "USDA FoodData Central")
        XCTAssertEqual(roundTripped.source_type, "USDA_FOUNDATION")
        XCTAssertEqual(roundTripped.confidence_label, "High")
    }

    func testMealAssistantPayloadPreservesWebFoodSourceFields() throws {
        let item = MealRequestItem(
            food_name: "banana",
            quantity: 1,
            unit: "medium",
            calories: 105,
            protein: 1,
            carbs: 27,
            fat: 0,
            fiber: 3,
            sugar: 14,
            sodium: 1,
            notes: nil,
            source_type: "USDA_FOUNDATION",
            source_name: "USDA",
            confidence_label: "High",
            is_trusted: true,
            catalog_food_id: "food-banana"
        )
        let body = MealAssistantRequest(
            message: "one banana",
            state: MealAssistantClientLogic.buildRequestState(assistantState: MealAssistantState(), currentMealItems: [item], incomingUserMessage: "one banana"),
            context: nil,
            conversationHistory: [MealAssistantTranscriptMessage(role: "user", text: "one banana")]
        )

        let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(body)) as? [String: Any]
        let state = try XCTUnwrap(json?["state"] as? [String: Any])
        let items = try XCTUnwrap(state["currentMealItems"] as? [[String: Any]])
        let encodedItem = try XCTUnwrap(items.first)

        XCTAssertEqual(encodedItem["food_name"] as? String, "banana")
        XCTAssertEqual(encodedItem["is_trusted"] as? Bool, true)
        XCTAssertEqual(encodedItem["catalog_food_id"] as? String, "food-banana")
    }

    func testPostMealRequestEncodesPendingMealIdempotencyKey() throws {
        let request = PostMealRequest(
            meal_type: "lunch",
            confidence_score: 0.95,
            raw_text: "McDouble no cheese",
            idempotency_key: "pending-1:v1",
            source_reusable_meal_id: nil,
            notes: nil,
            date: nil,
            items: [Self.item("McDouble no cheese")]
        )

        let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(request)) as? [String: Any]

        XCTAssertEqual(json?["idempotency_key"] as? String, "pending-1:v1")
    }

    func testConciseReplyPreservesMacroQuestionDetails() {
        let rawReply = "That pending meal is about 370 calories, 66g protein, 7g carbs, and 7g fat."
        let reply = MealAssistantClientLogic.conciseReply(
            rawReply: rawReply,
            items: [Self.item("grilled chicken breast"), Self.item("asparagus")],
            nextState: MealAssistantState(),
            intent: "macro_question"
        )

        XCTAssertEqual(reply, rawReply)
    }

    func testPendingMealIdempotencyKeyChangesAfterLocalReviewEdits() {
        var state = MealAssistantState()
        state.pendingMeal = PendingMeal(
            id: "pending-1",
            version: 1,
            items: [Self.item("McDouble")],
            totals: MealAssistantTotals(calories: 390, protein: 22, carbs: 33, fat: 19, fiber: 2, sugar: 7, sodium: 920),
            aggregateConfidence: 0.95,
            sourceSummary: PendingMealSourceSummary(sourceTypes: ["OFFICIAL_RESTAURANT"], sourceNames: ["McDonald's official nutrition"], trustedItemCount: 1, estimatedItemCount: 0),
            mealType: "lunch",
            status: "ready_for_review",
            clarification: nil,
            createdAt: "2026-06-16T12:00:00.000Z",
            updatedAt: "2026-06-16T12:00:00.000Z",
            lastResolvedAt: "2026-06-16T12:00:00.000Z"
        )

        let original = [Self.item("McDouble", quantity: 1, unit: "burger")]
        let edited = [Self.item("McDouble", quantity: 2, unit: "burger")]

        XCTAssertNotEqual(
            MealAssistantClientLogic.pendingMealSaveIdempotencyKey(state: state, items: original),
            MealAssistantClientLogic.pendingMealSaveIdempotencyKey(state: state, items: edited)
        )
    }

    func testSaveSignaturesIgnoreWhitespaceAndCaseForDuplicateGuards() {
        let first = MealRequestItem(food_name: "Coke Zero", quantity: 1, unit: "can", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 40, notes: nil, source_type: "GENERIC_REFERENCE", source_name: "Coca-Cola", confidence_label: "Matched")
        let second = MealRequestItem(food_name: " coke zero ", quantity: 1, unit: "CAN", calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 40, notes: nil, source_type: "GENERIC_REFERENCE", source_name: "Coca-Cola", confidence_label: "Matched")

        XCTAssertEqual(MealAssistantClientLogic.saveSignature(for: [first]), MealAssistantClientLogic.saveSignature(for: [second]))
    }

    private static func item(_ name: String, quantity: Double = 1, unit: String = "serving") -> MealRequestItem {
        MealRequestItem(food_name: name, quantity: quantity, unit: unit, calories: 100, protein: 10, carbs: 10, fat: 2, fiber: 0, sugar: 0, sodium: 0, notes: nil, source_type: nil, source_name: nil, confidence_label: nil)
    }

    private static func trustedItem(_ name: String) -> MealRequestItem {
        MealRequestItem(food_name: name, quantity: 1, unit: "serving", calories: 100, protein: 10, carbs: 10, fat: 2, fiber: 0, sugar: 0, sodium: 0, notes: "Exact branded match", source_type: "BRANDED", source_name: "Nutrition catalog", confidence_label: "High", is_trusted: true, catalog_food_id: "brand-\(name.lowercased().replacingOccurrences(of: " ", with: "-"))")
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

    func testSetupExpiredAndOfflineStatesBlockActions() {
        let response = SessionResponse(account: nil, user: SessionUser(id: "u1", name: nil, mode: "account"))

        XCTAssertTrue(NativeSessionState.unknown.isActionBlocked)
        XCTAssertTrue(NativeSessionState.loading.isActionBlocked)
        XCTAssertTrue(NativeSessionState.unknown.isPreparingSession)
        XCTAssertTrue(NativeSessionState.loading.isPreparingSession)
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
        XCTAssertEqual(session.signInAvailability, .available)
    }
}

final class AuthSessionScaffoldTests: XCTestCase {
    func testProgrammaticAppleAuthEntryPointDoesNotPretendToSignIn() {
        let service = AppleAuthService(storage: InMemoryAuthStorage())
        let expectation = expectation(description: "auth scaffold responds")

        service.signInWithApple { result in
            switch result {
            case .success(.unavailable(let message)):
                XCTAssertTrue(message.contains("secure sign-in sheet"))
            default:
                XCTFail("Programmatic auth entry point must not report a fake Apple sign-in result")
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

    func testBackendIssuedTokenIsStoredWithSessionEnvelope() throws {
        let storage = InMemoryAuthStorage()
        let service = AppleAuthService(storage: storage)

        try storage.saveBackendSessionToken("server-issued-token")

        XCTAssertEqual(storage.readSessionToken(), "backend-session-v1:server-issued-token")
        XCTAssertEqual(storage.readBackendSessionToken(), "server-issued-token")
        XCTAssertTrue(service.currentSession().isSignedIn)
        XCTAssertFalse(service.currentSession().isGuest)
    }

    func testPlaceholderTokenStillDoesNotCreateSignedInSession() {
        let storage = InMemoryAuthStorage(token: "server-issued-token-placeholder")
        let service = AppleAuthService(storage: storage)

        XCTAssertNil(storage.readBackendSessionToken())
        XCTAssertTrue(service.currentSession().isGuest)
        XCTAssertFalse(service.currentSession().isSignedIn)
    }

    func testNativeAppleAuthResponseRequiresBackendIssuedSession() throws {
        let data = """
        {
          "ok": true,
          "code": "NATIVE_APPLE_SESSION_ISSUED",
          "sessionIssued": true,
          "account": {
            "mode": "account",
            "userId": "user-1",
            "provider": "apple",
            "canUpgradeGuest": false
          },
          "session": {
            "token": "server-issued-token",
            "expiresAt": "2026-06-26T12:00:00.000Z",
            "tokenType": "Bearer"
          }
        }
        """.data(using: .utf8)

        let jsonData = try XCTUnwrap(data)
        let response = try JSONDecoder().decode(NativeAppleAuthResponse.self, from: jsonData)

        XCTAssertTrue(response.sessionIssued)
        XCTAssertEqual(response.account?.mode, "account")
        XCTAssertEqual(response.account?.provider, "apple")
        XCTAssertEqual(response.session?.token, "server-issued-token")
        XCTAssertTrue(response.hasBackendIssuedSession)
    }

    func testAuthorizationHeaderUsesBackendIssuedSessionTokenOnly() throws {
        let url = try XCTUnwrap(URL(string: "https://example.com/api/session"))
        var request = URLRequest(url: url)

        BackendService.applyNativeSessionAuthorization(to: &request, token: "server-issued-token")

        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer server-issued-token")
    }

    func testAccountLifecycleRequestRequiresBackendSessionToken() {
        XCTAssertNil(BackendService.makeNativeAccountLifecycleRequest(path: "api/auth/guest/migrate", method: "POST", token: nil))
        XCTAssertNil(BackendService.makeNativeAccountLifecycleRequest(path: "api/auth/guest/migrate", method: "POST", token: "   "))
    }

    func testAccountLifecycleRequestsAttachBearerTokenAndMethods() throws {
        let migrate = try XCTUnwrap(BackendService.makeNativeAccountLifecycleRequest(path: "api/auth/guest/migrate", method: "POST", token: "server-issued-token"))
        let export = try XCTUnwrap(BackendService.makeNativeAccountLifecycleRequest(path: "api/account/native/export", method: "GET", token: "server-issued-token"))
        let delete = try XCTUnwrap(BackendService.makeNativeAccountLifecycleRequest(path: "api/account/native/delete", method: "DELETE", token: "server-issued-token"))

        XCTAssertEqual(migrate.httpMethod, "POST")
        XCTAssertEqual(export.httpMethod, "GET")
        XCTAssertEqual(delete.httpMethod, "DELETE")
        XCTAssertEqual(migrate.url?.path, "/api/auth/guest/migrate")
        XCTAssertEqual(export.url?.path, "/api/account/native/export")
        XCTAssertEqual(delete.url?.path, "/api/account/native/delete")
        XCTAssertEqual(delete.value(forHTTPHeaderField: "Authorization"), "Bearer server-issued-token")
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
