import XCTest

final class FoodIntelligenceUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments.append("--macromesh-ui-testing")
        app.launchEnvironment["CALORIE_COMPASS_BASE_URL"] = ProcessInfo.processInfo.environment["MACROMESH_UI_TEST_BASE_URL"]
            ?? "http://127.0.0.1:8765"
        app.launch()
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
        let resultsList = app.scrollViews.firstMatch
        let whiteCreme = app.staticTexts["KitKat White Creme"]
        if !whiteCreme.waitForExistence(timeout: 1) {
            resultsList.swipeUp()
        }
        XCTAssertTrue(whiteCreme.waitForExistence(timeout: 3))

        let milkChocolate = app.staticTexts["KitKat Milk Chocolate"]
        if !milkChocolate.isHittable {
            resultsList.swipeDown()
        }
        XCTAssertTrue(milkChocolate.waitForExistence(timeout: 3))
        milkChocolate.tap()
        XCTAssertTrue(app.staticTexts["Review meal"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["KitKat Milk Chocolate"].exists)

        let saveButton = app.buttons["Save meal"]
        XCTAssertTrue(saveButton.waitForExistence(timeout: 3))
        saveButton.tap()
        XCTAssertTrue(app.staticTexts["Saved. Ready for the next one?"].waitForExistence(timeout: 5))

        app.tabBars.buttons["History"].tap()
        XCTAssertTrue(app.staticTexts["KitKat Milk Chocolate"].waitForExistence(timeout: 5))
    }
}
