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
            .tint(.blue)

            if selectedTab == .today, showSessionPill, let banner = sessionStore.state.banner {
                SessionBannerView(model: banner, onRetry: sessionStore.refresh, onDismiss: { showSessionPill = false })
                    .padding(.top, 4)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .environmentObject(sessionStore)
        .onAppear(perform: sessionStore.refresh)
        .onReceive(NotificationCenter.default.publisher(for: .macroMeshOpenLogTab)) { _ in
            selectedTab = .log
        }
        .onChange(of: sessionStore.state) { _ in
            showSessionPill = true
        }
    }
}

#Preview {
    ContentView()
}
