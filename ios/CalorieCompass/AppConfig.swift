// AppConfig.swift
// Calorie Compass iOS
//
// Runtime configuration for non-secret app values only.

import Foundation

struct AppConfig {
    static let baseURLInfoKey = "CALORIE_COMPASS_BASE_URL"
    static let defaultBackendBaseURLString = "https://calorie-compass-chi.vercel.app"

    let backendBaseURL: URL

    static var current: AppConfig {
        let bundleValue = Bundle.main.object(forInfoDictionaryKey: baseURLInfoKey) as? String
        let environmentValue = ProcessInfo.processInfo.environment[baseURLInfoKey]

        return AppConfig(
            backendBaseURL: resolvedBaseURL(
                bundleValue: bundleValue,
                environmentValue: environmentValue
            )
        )
    }

    static func resolvedBaseURL(bundleValue: String?, environmentValue: String?) -> URL {
        [environmentValue, bundleValue, defaultBackendBaseURLString]
            .compactMap { normalizedURL(from: $0) }
            .first ?? URL(fileURLWithPath: "/")
    }

    private static func normalizedURL(from rawValue: String?) -> URL? {
        guard let rawValue else { return nil }

        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty,
              let url = URL(string: trimmed),
              let scheme = url.scheme?.lowercased(),
              ["https", "http"].contains(scheme),
              url.host != nil else {
            return nil
        }

        return url
    }
}
