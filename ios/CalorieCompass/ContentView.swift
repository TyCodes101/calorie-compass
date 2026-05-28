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

    var body: some View {
        VStack(spacing: 0) {
            if selectedTab == .today, let banner = sessionStore.state.banner {
                SessionBannerView(model: banner, onRetry: sessionStore.refresh)
            }
            TabView(selection: $selectedTab) {
                DashboardView()
                    .tabItem {
                        Label("Today", systemImage: "house.fill")
                    }
                    .tag(MainTab.today)
                LogChatView()
                    .tabItem {
                        Label("Log", systemImage: "plus.bubble")
                    }
                    .tag(MainTab.log)
                HistoryView()
                    .tabItem {
                        Label("History", systemImage: "clock")
                    }
                    .tag(MainTab.history)
                ProfileView()
                    .tabItem {
                        Label("Profile", systemImage: "person")
                    }
                    .tag(MainTab.profile)
            }
        }
        .environmentObject(sessionStore)
        .onAppear(perform: sessionStore.refresh)
        .onReceive(NotificationCenter.default.publisher(for: .macroMeshOpenLogTab)) { _ in
            selectedTab = .log
        }
    }
}

#Preview {
    ContentView()
}
