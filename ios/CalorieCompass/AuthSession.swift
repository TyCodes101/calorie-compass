// AuthSession.swift
// Calorie Compass iOS - Phase 5 native authentication scaffold
//
// This file defines native auth/session architecture only. It does not implement
// the real Sign in with Apple authorization UI yet.

import AuthenticationServices
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
        signInAvailability: .available
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
    case appleSignInCancelled
    case appleCredentialUnavailable
    case backend(String)

    var errorDescription: String? {
        switch self {
        case .notImplemented(let message): return message
        case .storageUnavailable: return "Secure account storage is unavailable on this device."
        case .verificationRequired: return "Backend token verification is required before native sign-in can continue."
        case .appleSignInCancelled: return "Sign in with Apple was cancelled. Guest mode is still available."
        case .appleCredentialUnavailable: return "Apple did not return the credential needed to continue sign-in."
        case .backend(let message): return message
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
        guard storage.readBackendSessionToken() != nil else { return .guest }
        return AuthSession(
            mode: .account,
            userId: nil,
            displayName: nil,
            provider: .apple,
            canUpgradeGuest: false,
            signInAvailability: .available
        )
    }

    func signInWithApple(completion: @escaping (Result<AuthActionResult, AuthServiceError>) -> Void) {
        completion(.success(.unavailable(message: "Use the Continue with Apple button to start Apple's secure sign-in sheet.")))
    }

    func configureAppleRequest(_ request: ASAuthorizationAppleIDRequest) {
        request.requestedScopes = [.email]
    }

    func handleAppleAuthorizationResult(
        _ result: Result<ASAuthorization, Error>,
        completion: @escaping (Result<AuthActionResult, AuthServiceError>) -> Void
    ) {
        switch result {
        case .failure(let error):
            completion(.failure(mapAppleAuthorizationError(error)))
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let identityToken = Self.utf8String(from: credential.identityToken) else {
                completion(.failure(.appleCredentialUnavailable))
                return
            }

            completeBackendSignIn(
                identityToken: identityToken,
                authorizationCode: Self.utf8String(from: credential.authorizationCode),
                completion: completion
            )
        }
    }

    func completeBackendSignIn(
        identityToken: String,
        authorizationCode: String? = nil,
        completion: @escaping (Result<AuthActionResult, AuthServiceError>) -> Void
    ) {
        BackendService.signInWithApple(identityToken: identityToken, authorizationCode: authorizationCode) { [storage] result in
            switch result {
            case .success(let response):
                guard response.hasBackendIssuedSession,
                      let token = response.session?.token else {
                    completion(.failure(.verificationRequired))
                    return
                }

                do {
                    try storage.saveBackendSessionToken(token)
                    let session = AuthSession(
                        mode: .account,
                        userId: response.account?.userId,
                        displayName: nil,
                        provider: .apple,
                        canUpgradeGuest: response.account?.canUpgradeGuest ?? false,
                        signInAvailability: .available
                    )
                    completion(.success(.signedIn(session)))
                } catch {
                    completion(.failure(.storageUnavailable))
                }
            case .failure(let error):
                completion(.failure(.backend(error.localizedDescription)))
            }
        }
    }

    func signOut(completion: @escaping (Result<AuthActionResult, AuthServiceError>) -> Void) {
        guard let token = storage.readBackendSessionToken() else {
            storage.clearSessionToken()
            completion(.success(.signedOut))
            return
        }

        BackendService.logoutNativeSession(token: token) { [storage] _ in
            storage.clearSessionToken()
            completion(.success(.signedOut))
        }
    }

    func clearLocalSessionAfterAccountDeletion() {
        storage.clearSessionToken()
    }

    func prepareGuestUpgrade(completion: @escaping (Result<AuthActionResult, AuthServiceError>) -> Void) {
        completion(.success(.unavailable(message: "Use the signed-in account tools to migrate guest data after Apple sign-in completes.")))
    }

    private func mapAppleAuthorizationError(_ error: Error) -> AuthServiceError {
        let nsError = error as NSError
        if nsError.domain == ASAuthorizationError.errorDomain,
           ASAuthorizationError.Code(rawValue: nsError.code) == .canceled {
            return .appleSignInCancelled
        }
        return .backend(error.localizedDescription)
    }

    private static func utf8String(from data: Data?) -> String? {
        guard let data,
              let value = String(data: data, encoding: .utf8),
              !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return nil
        }
        return value
    }
}

protocol SecureAuthStorage {
    func readSessionToken() -> String?
    func saveSessionToken(_ token: String) throws
    func clearSessionToken()
}

private let backendSessionTokenPrefix = "backend-session-v1:"

extension SecureAuthStorage {
    func readBackendSessionToken() -> String? {
        guard let stored = readSessionToken(),
              stored.hasPrefix(backendSessionTokenPrefix) else {
            return nil
        }

        let token = String(stored.dropFirst(backendSessionTokenPrefix.count))
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return token.isEmpty ? nil : token
    }

    func saveBackendSessionToken(_ token: String) throws {
        let trimmed = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw AuthServiceError.storageUnavailable
        }
        try saveSessionToken("\(backendSessionTokenPrefix)\(trimmed)")
    }
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
