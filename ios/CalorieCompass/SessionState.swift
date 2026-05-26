// SessionState.swift
// Calorie Compass iOS — Phase 3E native session model
import Foundation
import SwiftUI

struct SessionResponse: Codable, Equatable {
    let account: AccountSnapshot?
    let user: SessionUser?
}

struct AccountSnapshot: Codable, Equatable {
    let mode: String?
    let title: String?
    let description: String?
    let persistenceLabel: String?
}

struct SessionUser: Codable, Equatable {
    let id: String
    let name: String?
    let mode: String?
}

enum NativeSessionState: Equatable {
    case unknown
    case loading
    case guest(SessionResponse)
    case authenticated(SessionResponse)
    case unauthenticated(message: String)
    case expired(message: String)
    case offline(message: String)

    var isActionBlocked: Bool {
        switch self {
        case .expired, .offline:
            return true
        case .unknown, .loading, .guest, .authenticated, .unauthenticated:
            return false
        }
    }

    var banner: SessionBannerModel? {
        switch self {
        case .unknown, .loading:
            return SessionBannerModel(title: "Checking session…", message: "We’re confirming your Calorie Compass session.", systemImage: "hourglass", tint: .blue)
        case .guest(let response):
            return SessionBannerModel(title: response.account?.title ?? "Guest mode", message: response.account?.description ?? "Your meals are tied to this device session. Sign in is not available in this build yet.", systemImage: "person.crop.circle.badge.questionmark", tint: .orange)
        case .authenticated:
            return nil
        case .unauthenticated(let message):
            return SessionBannerModel(title: "Sign in unavailable", message: message, systemImage: "person.crop.circle.badge.exclamationmark", tint: .orange)
        case .expired(let message):
            return SessionBannerModel(title: "Session expired", message: message, systemImage: "lock.trianglebadge.exclamationmark", tint: .red)
        case .offline(let message):
            return SessionBannerModel(title: "Offline", message: message, systemImage: "wifi.slash", tint: .gray)
        }
    }

    static func fromSessionResponse(_ response: SessionResponse) -> NativeSessionState {
        guard let user = response.user else {
            return .unauthenticated(message: "Sign in is not available in this build yet. You can still explore safe read-only states when available.")
        }
        if user.mode?.lowercased() == "guest" || response.account?.mode?.lowercased() == "guest" {
            return .guest(response)
        }
        return .authenticated(response)
    }

    static func fromError(_ error: Error) -> NativeSessionState {
        guard let backendError = error as? BackendError else {
            return .unauthenticated(message: error.localizedDescription)
        }
        switch backendError {
        case .offline:
            return .offline(message: backendError.localizedDescription)
        case .unauthorized, .forbidden:
            return .expired(message: backendError.localizedDescription)
        default:
            return .unauthenticated(message: backendError.localizedDescription)
        }
    }
}

struct SessionBannerModel: Equatable {
    let title: String
    let message: String
    let systemImage: String
    let tint: Color

    static func == (lhs: SessionBannerModel, rhs: SessionBannerModel) -> Bool {
        lhs.title == rhs.title && lhs.message == rhs.message && lhs.systemImage == rhs.systemImage
    }
}

final class SessionStore: ObservableObject {
    @Published private(set) var state: NativeSessionState = .unknown
    private var isRefreshing = false

    func refresh() {
        guard !isRefreshing else { return }
        isRefreshing = true
        state = .loading
        BackendService.fetchSession { [weak self] result in
            DispatchQueue.main.async {
                guard let self else { return }
                self.isRefreshing = false
                switch result {
                case .success(let response):
                    self.state = NativeSessionState.fromSessionResponse(response)
                case .failure(let error):
                    self.state = NativeSessionState.fromError(error)
                }
            }
        }
    }

    func apply(_ error: Error) {
        let mapped = NativeSessionState.fromError(error)
        switch mapped {
        case .expired, .offline:
            state = mapped
        default:
            break
        }
    }
}

struct SessionBannerView: View {
    let model: SessionBannerModel
    let onRetry: (() -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: model.systemImage)
                .foregroundColor(model.tint)
            VStack(alignment: .leading, spacing: 4) {
                Text(model.title).font(.subheadline).fontWeight(.semibold)
                Text(model.message).font(.caption).foregroundColor(.secondary)
                if let onRetry {
                    Button("Retry session check", action: onRetry)
                        .font(.caption)
                }
            }
            Spacer()
        }
        .padding(12)
        .background(model.tint.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .padding(.horizontal)
        .padding(.top, 8)
    }
}
