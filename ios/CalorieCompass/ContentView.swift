//
//  ContentView.swift
//  CalorieCompass
//
//  Created for Phase 2A by Peter 🧠
//
import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("Today", systemImage: "house.fill")
                }
            LogChatView()
                .tabItem {
                    Label("Log", systemImage: "plus.bubble")
                }
        }
    }
}

#Preview {
    ContentView()
}

