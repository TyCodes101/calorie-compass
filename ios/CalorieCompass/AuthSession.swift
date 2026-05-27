// AuthSession.swift
// Calorie Compass iOS — Phase 4C authentication scaffold
//
// This file defines native auth/session architecture only. It does not implement
// Sign in with Apple, token verification, or production account sessions.

import Foundation
import Security

enum AuthMode: String, Codable, Equatable {
    case guest
    case account
    case unauthenticated
}

enum AuthProvider: String, Codable, Equatable {
    case apple
}

enum AuthAvailability: String, Codable, Equatable {
    case planned
    case unavailable
    case available
}

struct AuthSession: Codable, Equatable {
    let mode: AuthMode
    let userId: String?
    let displayName: String?
    let provider: AuthProvider?
    let canUpgradeGuest: Bool
    let signInAvailability: AuthAvailability

    static let guest = AuthSession(
        mode: .guest,
        userId: nil,
        displayName: nil,
        provider: nil,
        canUpgradeGuest: true,
        signInAvailability: .planned
    )

    static let unauthenticated = AuthSession(
        mode: .unauthenticated,
        userId: nil,
        displayName: nil,
        provider: nil,
        canUpgradeGuest: false,
        signInAvailability: .planned
    )

    var isSignedIn: Bool { mode == .account }
    var isGuest: Bool { mode == .guest }
}

enum AuthActionResult: Equatable {
    case unavailable(message: String)
    case signedOut
    case migratedGuest(AuthSession)
    case signedIn(AuthSession)
}

enum AuthServiceError: LocalizedError, Equatable {
    case notImplemented(String)
    case storageUnavailable
    case verificationRequired

    var errorDescription: String? {
        switch self {
        case .notImplemented(let message): return message
        case .storageUnavailable: return "Secure account storage is unavailable on this device."
        case .verificationRequired: return "Backend token verification is required before native sign-in can continue."
        }
    }
}

protocol AuthService {
    func currentSession() -> AuthSession
    func signInWithApple(completion: @escaping (Result<AuthActionResult, AuthServiceError>) -> Void)
    func signOut(completion: @escaping (Result<AuthActionResult, AuthServiceError>) -> Void)
    func prepareGuestUpgrade(completion: @escaping (Result<AuthActionResult, AuthServiceError>) -> Void)
}

final class AppleAuthService: AuthService {
    private let storage: SecureAuthStorage

    init(storage: SecureAuthStorage = KeychainAuthStorage()) {
        self.storage = storage
    }

    func currentSession() -> AuthSession {
        // Real account sessions require a backend-issued session artifact. Phase 5A
        // intentionally does not treat any locally stored placeholder/token as an
        // authenticated account, because Apple token verification and backend
        // session issuance are not complete yet.
        .guest
    }

    func signInWithApple(completion: @escaping (Result<AuthActionResult, AuthServiceError>) -> Void) {
        completion(.success(.unavailable(message: "Sign in with Apple is coming soon after backend token verification is wired.")))
    }

    func signOut(completion: @escaping (Result<AuthActionResult, AuthServiceError>) -> Void) {
        storage.clearSessionToken()
        completion(.success(.signedOut))
    }

    func prepareGuestUpgrade(completion: @escaping (Result<AuthActionResult, AuthServiceError>) -> Void) {
        completion(.success(.unavailable(message: "Guest-to-account upgrade will be enabled after the backend migration contract is ready.")))
    }
}

protocol SecureAuthStorage {
    func readSessionToken() -> String?
    func saveSessionToken(_ token: String) throws
    func clearSessionToken()
}

final class KeychainAuthStorage: SecureAuthStorage {
    private let service = "com.caloriecompass.ios.auth"
    private let account = "native-session"

    func readSessionToken() -> String? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess,
              let data = item as? Data,
              let token = String(data: data, encoding: .utf8),
              !token.isEmpty else {
            return nil
        }
        return token
    }

    func saveSessionToken(_ token: String) throws {
        clearSessionToken()
        var query = baseQuery()
        query[kSecValueData as String] = Data(token.utf8)
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw AuthServiceError.storageUnavailable
        }
    }

    func clearSessionToken() {
        SecItemDelete(baseQuery() as CFDictionary)
    }

    private func baseQuery() -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
    }
}
