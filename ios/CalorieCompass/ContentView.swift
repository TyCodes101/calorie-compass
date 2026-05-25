//
//  ContentView.swift
//  CalorieCompass
//
//  Created for Phase 2A by Peter 🧠
//
import SwiftUI

struct ContentView: View {
    @StateObject private var sessionStore = SessionStore()

    var body: some View {
        VStack(spacing: 0) {
            if let banner = sessionStore.state.banner {
                SessionBannerView(model: banner, onRetry: sessionStore.refresh)
            }
            TabView {
                DashboardView()
                    .tabItem {
                        Label("Today", systemImage: "house.fill")
                    }
                LogChatView()
                    .tabItem {
                        Label("Log", systemImage: "plus.bubble")
                    }
                HistoryView()
                    .tabItem {
                        Label("History", systemImage: "clock")
                    }
                ProfileView()
                    .tabItem {
                        Label("Profile", systemImage: "person")
                    }
            }
        }
        .environmentObject(sessionStore)
        .onAppear(perform: sessionStore.refresh)
    }
}

#Preview {
    ContentView()
}

