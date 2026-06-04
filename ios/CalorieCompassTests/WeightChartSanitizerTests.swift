import XCTest
@testable import CalorieCompass

final class WeightChartSanitizerTests: XCTestCase {
    func testFiltersInvalidAndDedupesLatestPerDay() {
        let entries: [WeightEntry] = [
            WeightEntry(id: "a", date: "2026-06-03T08:00:00Z", weightLbs: 200),
            WeightEntry(id: "b", date: "2026-06-03T20:00:00Z", weightLbs: 199), // same day, later
            WeightEntry(id: "c", date: "2026-06-02T10:00:00Z", weightLbs: 0), // invalid
        ]

        let now = ISO8601DateFormatter().date(from: "2026-06-03T21:00:00Z")!
        let sanitized = WeightChartSanitizer.sanitize(entries: entries, now: now)
        XCTAssertEqual(sanitized.map(\.id), ["a", "b"])

        let deduped = WeightChartSanitizer.dedupeLatestPerDay(sanitized)
        XCTAssertEqual(deduped.count, 1)
        XCTAssertEqual(deduped.first?.id, "b")
        XCTAssertEqual(deduped.first?.weight, 199)
    }
}

