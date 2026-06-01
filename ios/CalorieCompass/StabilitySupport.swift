// StabilitySupport.swift
// Calorie Compass iOS — Phase 4D stabilization helpers
//
// Lightweight reliability and observability boundaries only. No analytics SDK,
// crash-reporting SDK, secrets, or production telemetry claims are added here.

import Foundation

enum AppStabilityEvent: Equatable {
    case networkFailure(screen: String, message: String)
    case retry(screen: String)
    case duplicateSubmissionBlocked(screen: String)
    case unsupportedFeature(feature: String)
}

protocol AppStabilityReporting {
    func record(_ event: AppStabilityEvent)
}

struct ConsoleStabilityReporter: AppStabilityReporting {
    func record(_ event: AppStabilityEvent) {
        #if DEBUG
        print("[stability] \(event)")
        #endif
    }
}

struct RetryCopy {
    static func offlineMessage(action: String) -> String {
        "We couldn’t \(action) because the network is unavailable. Your current screen is safe; reconnect and try again."
    }

    static func nonDestructiveFailure(action: String, error: Error) -> String {
        "We couldn’t \(action). Nothing was deleted or overwritten. \(error.localizedDescription)"
    }

    static func recoveryMessage(action: String, error: Error) -> String {
        "We’re setting things up and couldn’t \(action) yet. Your guest session is safe — try again in a moment. \(error.localizedDescription)"
    }
}
