// ProfileViewTests.swift
// Calorie Compass iOS
import XCTest
@testable import CalorieCompass
import SwiftUI

final class ProfileViewTests: XCTestCase {
    func testProfileDataDecodesBackendPayload() throws {
        let data = """
        {
          "name": "Tyler",
          "age": 34,
          "heightCm": 180,
          "weightLbs": 175.5,
          "goal": "maintain",
          "activityLevel": "moderate",
          "dailyCalorieGoal": 2400,
          "proteinGoal": 160,
          "nutritionPreferences": "High protein"
        }
        """.data(using: .utf8)

        let jsonData = try XCTUnwrap(data)
        let profile = try JSONDecoder().decode(ProfileData.self, from: jsonData)

        XCTAssertEqual(profile.name, "Tyler")
        XCTAssertEqual(profile.age, 34)
        XCTAssertEqual(profile.heightCm, 180)
        XCTAssertEqual(profile.weightLbs, 175.5)
        XCTAssertEqual(profile.dailyCalorieGoal, 2400)
        XCTAssertEqual(profile.proteinGoal, 160)
        XCTAssertEqual(profile.nutritionPreferences, "High protein")
    }

    func testProfileDataAllowsMissingOptionalFields() throws {
        let data = #"{"name":"Guest"}"#.data(using: .utf8)

        let jsonData = try XCTUnwrap(data)
        let profile = try JSONDecoder().decode(ProfileData.self, from: jsonData)

        XCTAssertEqual(profile.name, "Guest")
        XCTAssertNil(profile.age)
        XCTAssertNil(profile.heightCm)
        XCTAssertNil(profile.weightLbs)
        XCTAssertNil(profile.dailyCalorieGoal)
        XCTAssertNil(profile.proteinGoal)
        XCTAssertNil(profile.nutritionPreferences)
    }

    func testProfileDataEncodesSavePayload() throws {
        let profile = ProfileData(
            name: "Tyler",
            age: nil,
            heightCm: 180,
            weightLbs: nil,
            goal: "maintain",
            activityLevel: "moderate",
            dailyCalorieGoal: 2400,
            proteinGoal: 160,
            nutritionPreferences: nil
        )

        let encoded = try JSONEncoder().encode(profile)
        let decoded = try JSONDecoder().decode(ProfileData.self, from: encoded)

        XCTAssertEqual(decoded, profile)
    }
}
