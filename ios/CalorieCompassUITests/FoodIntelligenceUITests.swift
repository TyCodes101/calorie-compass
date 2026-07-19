import XCTest

final class FoodIntelligenceUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        executionTimeAllowance = 240
        app = XCUIApplication()
        app.launchArguments.append("--macromesh-ui-testing")
        app.launchEnvironment["CALORIE_COMPASS_BASE_URL"] = ProcessInfo.processInfo.environment["MACROMESH_UI_TEST_BASE_URL"]
            ?? "http://127.0.0.1:8765"
        app.launch()
    }

    override func tearDownWithError() throws {
        if app.state != .notRunning {
            app.terminate()
        }
        app = nil
    }

    func testLiveSearchReviewSaveAndHistoryUseOneNormalizedFood() throws {
        app.tabBars.buttons["Log"].tap()
        let foodSearch = app.buttons["Food Search"]
        XCTAssertTrue(foodSearch.waitForExistence(timeout: 5))
        foodSearch.tap()

        let searchField = app.textFields["Search foods"]
        XCTAssertTrue(searchField.waitForExistence(timeout: 3))
        searchField.tap()
        searchField.typeText("kit")

        XCTAssertTrue(app.staticTexts["KitKat Milk Chocolate"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["KitKat King Size"].exists)
        XCTAssertTrue(app.staticTexts["KitKat Mini"].exists)
        let resultsList = app.scrollViews["Food search results"]
        XCTAssertTrue(resultsList.waitForExistence(timeout: 3))
        let whiteCreme = app.staticTexts["KitKat White Creme"]
        for _ in 0..<3 where !whiteCreme.exists {
            resultsList.swipeUp()
        }
        XCTAssertTrue(whiteCreme.waitForExistence(timeout: 3))

        let milkChocolate = app.staticTexts["KitKat Milk Chocolate"]
        for _ in 0..<3 where !milkChocolate.isHittable {
            resultsList.swipeDown()
        }
        XCTAssertTrue(milkChocolate.isHittable)
        milkChocolate.tap()
        XCTAssertTrue(app.staticTexts["Review meal"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["KitKat Milk Chocolate"].exists)

        let saveButton = app.buttons["Save meal"]
        XCTAssertTrue(saveButton.waitForExistence(timeout: 3))
        saveButton.tap()
        XCTAssertTrue(app.staticTexts["MacroMesh: Saved. Ready for the next one?"].waitForExistence(timeout: 5))

        app.tabBars.buttons["History"].tap()
        let historyList = app.scrollViews["Meal history"]
        XCTAssertTrue(historyList.waitForExistence(timeout: 5))
        let savedHistoryMeal = app.descendants(matching: .any)
            .matching(NSPredicate(
                format: "label CONTAINS[c] %@ AND label CONTAINS[c] %@",
                "KitKat Milk Chocolate",
                "210 calories"
            ))
            .firstMatch
        for _ in 0..<4 where !savedHistoryMeal.exists {
            historyList.swipeUp()
        }
        let foundSavedHistoryMeal = savedHistoryMeal.waitForExistence(timeout: 10)
        if !foundSavedHistoryMeal {
            print("HISTORY_ACCESSIBILITY_HIERARCHY\n\(app.debugDescription)")
        }
        XCTAssertTrue(foundSavedHistoryMeal)
    }
}
