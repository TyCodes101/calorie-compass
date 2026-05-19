import SwiftUI

@main
struct CalorieCompassApp: App {
    @StateObject private var apiClient = APIClient()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(apiClient)
        }
    }
}
