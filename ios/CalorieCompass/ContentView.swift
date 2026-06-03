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
    case profile
}

extension Notification.Name {
    static let macroMeshOpenLogTab = Notification.Name("macroMeshOpenLogTab")
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
        .onChange(of: sessionStore.state) { _, _ in
            showSessionPill = true
        }
    }

    private func configureTabBarAppearance() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor.white.withAlphaComponent(0.96)
        appearance.shadowColor = UIColor.black.withAlphaComponent(0.08)
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }
}

#Preview {
    ContentView()
}
