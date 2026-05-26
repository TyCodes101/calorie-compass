import Foundation

struct AppConfig {
    var backendBaseURL: URL

    static var current: AppConfig {
        let bundleValue = Bundle.main.object(forInfoDictionaryKey: "CALORIE_COMPASS_BASE_URL") as? String
        let processValue = ProcessInfo.processInfo.environment["CALORIE_COMPASS_BASE_URL"]
        let rawValue = processValue ?? bundleValue ?? "https://calorie-compass-chi.vercel.app"
        let url = URL(string: rawValue) ?? URL(string: "https://calorie-compass-chi.vercel.app")!
        return AppConfig(backendBaseURL: url)
    }
}
