// DashboardView.swift
// Calorie Compass native iOS
// Phase 2C: Dashboard, macros, recent meals
import SwiftUI

struct DashboardView: View {
    @State private var dashboard: DashboardResponse? = nil
    @State private var loading = false
    @State private var error: String? = nil
    @State private var refreshing = false
    
    var body: some View {
        NavigationView {
            Group {
                if loading && dashboard == nil {
                    ProgressView("Loading dashboard...")
                } else if let error = error {
                    VStack {
                        Text("Failed to load dashboard.").foregroundColor(.red)
                        Text(error).font(.caption)
                        Button("Retry") { loadDashboard() }
                            .padding(.top, 8)
                    }
                } else if let dashboard = dashboard {
                    ScrollView {
                        VStack(spacing: 18) {
                            macroRow(label: "Calories", used: dashboard.displayedCalories, goal: dashboard.displayedGoalCalories)
                            macroRow(label: "Protein", used: dashboard.displayedProtein, goal: dashboard.displayedProteinGoal)
                            macroRow(label: "Carbs", used: dashboard.displayedCarbs, goal: dashboard.displayedCarbsGoal)
                            macroRow(label: "Fat", used: dashboard.displayedFat, goal: dashboard.displayedFatGoal)
                            Divider()
                            if let meals = dashboard.recentMeals, !meals.isEmpty {
                                VStack(alignment: .leading, spacing: 10) {
                                    Text("Recent Meals").font(.headline)
                                    ForEach(Array(meals.enumerated()), id: \.offset) { idx, meal in
                                        VStack(alignment: .leading, spacing: 4) {
                                            if let raw = meal.rawText {
                                                Text(raw).font(.subheadline)
                                            }
                                            if let items = meal.items {
                                                ForEach(Array(items.enumerated()), id: \.offset) { j, food in
                                                    Text("\(food.food_name.capitalized) — \(Int(food.calories)) cal")
                                                        .font(.caption)
                                                }
                                            }
                                        }
                                        Divider()
                                    }
                                }
                            } else {
                                Text("No recent meals logged.").foregroundColor(.gray)
                            }
                        }
                        .padding()
                        .refreshable { refreshDashboard() }
                    }
                } else {
                    Text("Dashboard empty or unavailable.")
                }
            }
            .navigationTitle("Today")
            .onAppear(perform: loadDashboard)
            .onReceive(NotificationCenter.default.publisher(for: .calorieCompassMealsDidChange)) { _ in
                refreshDashboard()
            }
        }
    }

    func loadDashboard() {
        loading = true
        error = nil
        BackendService.fetchDashboard { result in
            DispatchQueue.main.async {
                loading = false
                switch result {
                case .success(let resp):
                    dashboard = resp
                case .failure(let err):
                    error = err.localizedDescription
                }
            }
        }
    }
    func refreshDashboard() {
        refreshing = true
        BackendService.fetchDashboard { result in
            DispatchQueue.main.async {
                refreshing = false
                switch result {
                case .success(let resp):
                    dashboard = resp
                case .failure(let err):
                    error = err.localizedDescription
                }
            }
        }
    }
    func macroRow(label: String, used: Double, goal: Double) -> some View {
        let pct: Double = goal > 0 ? used / goal : 0
        return VStack(alignment: .leading, spacing: 4) {
            Text("\(label): \(Int(used))/\(Int(goal))")
            ProgressView(value: pct)
                .tint(label == "Calories" ? .blue : label == "Protein" ? .green : .orange)
        }.padding(.vertical, 2)
    }
}
