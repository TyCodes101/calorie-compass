import SwiftUI

struct RootView: View {
    enum Tab: Hashable {
        case dashboard
        case logger
        case history
        case profile
    }

    @State private var selectedTab: Tab = .logger

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                DashboardView()
            }
            .tabItem { Label("Today", systemImage: "chart.bar.fill") }
            .tag(Tab.dashboard)

            NavigationStack {
                MealLoggerView()
            }
            .tabItem { Label("Log", systemImage: "message.fill") }
            .tag(Tab.logger)

            NavigationStack {
                HistoryView()
            }
            .tabItem { Label("History", systemImage: "clock.fill") }
            .tag(Tab.history)

            NavigationStack {
                ProfileView()
            }
            .tabItem { Label("Profile", systemImage: "person.crop.circle.fill") }
            .tag(Tab.profile)
        }
    }
}

#Preview {
    RootView()
        .environmentObject(APIClient())
}
