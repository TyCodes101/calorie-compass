//
//  ContentView.swift
//  CalorieCompass
//
//  Created for Phase 2A by Peter 🧠
//
import SwiftUI

enum MainTab: Hashable {
    case today
    case log
    case history
    case progress
    case profile
}

extension Notification.Name {
    static let macroMeshOpenLogTab = Notification.Name("macroMeshOpenLogTab")
    static let macroMeshOpenLogTool = Notification.Name("macroMeshOpenLogTool")
    static let macroMeshPrefillLogText = Notification.Name("macroMeshPrefillLogText")
}

struct ContentView: View {
    @StateObject private var sessionStore = SessionStore()
    @State private var selectedTab: MainTab = .today
    @State private var showSessionPill = true

    var body: some View {
        ZStack(alignment: .top) {
            MacroMeshScreen {
                TabView(selection: $selectedTab) {
                    DashboardView()
                        .tabItem { Label("Today", systemImage: "house") }
                        .tag(MainTab.today)
                    LogChatView()
                        .tabItem { Label("Log", systemImage: "plus.bubble") }
                        .tag(MainTab.log)
                    HistoryView()
                        .tabItem { Label("History", systemImage: "clock") }
                        .tag(MainTab.history)
                    ProgressScreenView()
                        .tabItem { Label("Progress", systemImage: "chart.bar") }
                        .tag(MainTab.progress)
                    ProfileView()
                        .tabItem { Label("Profile", systemImage: "person") }
                        .tag(MainTab.profile)
                }
                .tint(MacroMeshTheme.primary)
            }

            if selectedTab == .today, showSessionPill, let banner = sessionStore.state.banner {
                SessionBannerView(model: banner, onRetry: sessionStore.refresh, onDismiss: { showSessionPill = false })
                    .padding(.top, 6)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .environmentObject(sessionStore)
        .onAppear {
            configureTabBarAppearance()
            sessionStore.refresh()
        }
        .onReceive(NotificationCenter.default.publisher(for: .macroMeshOpenLogTab)) { _ in
            selectedTab = .log
        }
        .onReceive(NotificationCenter.default.publisher(for: .macroMeshOpenLogTool)) { _ in
            selectedTab = .log
        }
        .onReceive(NotificationCenter.default.publisher(for: .macroMeshPrefillLogText)) { _ in
            selectedTab = .log
        }
        .onChange(of: sessionStore.state) { _, _ in
            showSessionPill = true
        }
    }

    private func configureTabBarAppearance() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(red: 0.035, green: 0.07, blue: 0.08, alpha: 0.98)
                : UIColor(red: 0.98, green: 0.99, blue: 0.98, alpha: 0.98)
        }
        appearance.shadowColor = UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor.white.withAlphaComponent(0.08)
                : UIColor.black.withAlphaComponent(0.08)
        }
        appearance.stackedLayoutAppearance.selected.iconColor = UIColor(red: 0.08, green: 0.57, blue: 0.34, alpha: 1)
        appearance.stackedLayoutAppearance.selected.titleTextAttributes = [.foregroundColor: UIColor(red: 0.08, green: 0.57, blue: 0.34, alpha: 1)]
        appearance.stackedLayoutAppearance.normal.iconColor = .secondaryLabel
        appearance.stackedLayoutAppearance.normal.titleTextAttributes = [.foregroundColor: UIColor.secondaryLabel]
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
}

#Preview {
    ContentView()
}
