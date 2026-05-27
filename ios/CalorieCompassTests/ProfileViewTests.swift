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

    func testAccountManagementVisibilityRequiresBackendAccountSession() {
        let guestContent = AccountManagementContent.visibility(for: .guest)
        XCTAssertFalse(guestContent.canUseAccountActions)
        XCTAssertTrue(guestContent.message.contains("Sign in with Apple"))

        let accountSession = AuthSession(
            mode: .account,
            userId: "user-1",
            displayName: nil,
            provider: .apple,
            canUpgradeGuest: false,
            signInAvailability: .available
        )
        let accountContent = AccountManagementContent.visibility(for: accountSession)

        XCTAssertTrue(accountContent.canUseAccountActions)
        XCTAssertTrue(accountContent.message.contains("backend-issued"))
    }

    func testDeleteConfirmationCopyIsExplicitAndScoped() {
        XCTAssertTrue(AccountManagementContent.deleteConfirmationTitle.contains("Delete account"))
        XCTAssertTrue(AccountManagementContent.deleteConfirmationMessage.contains("signed-in account"))
        XCTAssertTrue(AccountManagementContent.deleteConfirmationMessage.contains("not a claim of App Store compliance"))
    }

    func testMigrationResultSummarizesMovedAndSkippedCounts() throws {
        let data = """
        {
          "ok": true,
          "code": "GUEST_DATA_MIGRATION_COMPLETED",
          "result": {
            "status": "migrated",
            "accountUserId": "account-1",
            "guestUserId": "guest-1",
            "migrated": {
              "profile": 1,
              "meals": 2,
              "reusableMeals": 1,
              "dailyLogs": 1,
              "weightEntries": 1
            },
            "skipped": {
              "profile": 0,
              "meals": 0,
              "reusableMeals": 1,
              "dailyLogs": 0,
              "weightEntries": 0
            }
          }
        }
        """.data(using: .utf8)

        let jsonData = try XCTUnwrap(data)
        let response = try JSONDecoder().decode(NativeGuestMigrationResponse.self, from: jsonData)

        XCTAssertEqual(response.result?.migrated.total, 6)
        XCTAssertEqual(response.result?.skipped.total, 1)
        XCTAssertTrue(response.successMessage.contains("6 items moved"))
        XCTAssertTrue(response.successMessage.contains("1 skipped"))
    }

    func testNativeAccountExportDecodesWithoutTokenHashes() throws {
        let data = """
        {
          "ok": true,
          "code": "NATIVE_ACCOUNT_EXPORT_READY",
          "exportedAt": "2026-05-27T12:00:00.000Z",
          "account": {
            "userId": "user-1",
            "name": "Apple User",
            "email": null,
            "demo": false
          },
          "meals": [
            {
              "id": "meal-1",
              "mealType": "LUNCH",
              "rawText": "Chicken bowl",
              "items": []
            }
          ],
          "nativeSessions": [
            {
              "id": "session-1",
              "expiresAt": "2026-06-27T12:00:00.000Z",
              "revokedAt": null
            }
          ]
        }
        """.data(using: .utf8)

        let jsonData = try XCTUnwrap(data)
        let response = try JSONDecoder().decode(NativeAccountExportResponse.self, from: jsonData)

        XCTAssertEqual(response.account?.userId, "user-1")
        XCTAssertEqual(response.meals?.count, 1)
        XCTAssertEqual(response.nativeSessions?.first?.id, "session-1")
        XCTAssertTrue(response.successMessage.contains("1 meals"))
    }

    func testNativeAccountDeleteDecodesRevokedSessionCount() throws {
        let data = """
        {
          "ok": true,
          "code": "NATIVE_ACCOUNT_DELETED",
          "deleted": {
            "profile": 1,
            "meals": 2,
            "reusableMeals": 1,
            "dailyLogs": 3,
            "weightEntries": 1,
            "authProviders": 1
          },
          "revokedSessions": 2
        }
        """.data(using: .utf8)

        let jsonData = try XCTUnwrap(data)
        let response = try JSONDecoder().decode(NativeAccountDeleteResponse.self, from: jsonData)

        XCTAssertEqual(response.deleted?.totalAccountDataRows, 9)
        XCTAssertEqual(response.revokedSessions, 2)
        XCTAssertTrue(response.successMessage.contains("Account data deleted"))
    }
}
