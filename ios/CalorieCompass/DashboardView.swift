// DashboardView.swift
// Calorie Compass native iOS
// Phase 2C: Dashboard, macros, recent meals
import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @State private var dashboard: DashboardResponse? = nil
    @State private var loading = false
    @State private var error: String? = nil
    @State private var refreshing = false
    private let stabilityReporter = ConsoleStabilityReporter()

    var body: some View {
        NavigationView {
            Group {
                if loading && dashboard == nil {
                    VStack(spacing: 12) {
                        ProgressView()
                        Text("Setting up your day…")
                            .font(.headline)
                        Text("MacroMesh is preparing your guest dashboard.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding()
                } else if let error = error {
                    FirstLaunchStateView(
                        systemImage: "fork.knife.circle",
                        title: "Welcome to MacroMesh",
                        message: recoverableDashboardMessage(error),
                        primaryTitle: "Log your first meal",
                        secondaryTitle: "Try again",
                        primaryAction: openLog,
                        secondaryAction: loadDashboard
                    )
                } else if let dashboard = dashboard {
                    ScrollView {
                        VStack(spacing: 18) {
                            if dashboard.recentMeals?.isEmpty ?? true, dashboard.displayedCalories == 0 {
                                FirstLaunchStateView(
                                    systemImage: "sparkles",
                                    title: "Welcome to MacroMesh",
                                    message: "Log your first meal to start tracking calories and macros today.",
                                    primaryTitle: "Log a meal",
                                    secondaryTitle: nil,
                                    primaryAction: openLog,
                                    secondaryAction: nil
                                )
                            }
                            macroRow(label: "Calories", used: dashboard.displayedCalories, goal: dashboard.displayedGoalCalories)
                            macroRow(label: "Protein", used: dashboard.displayedProtein, goal: dashboard.displayedProteinGoal)
                            macroRow(label: "Carbs", used: dashboard.displayedCarbs, goal: dashboard.displayedCarbsGoal)
                            macroRow(label: "Fat", used: dashboard.displayedFat, goal: dashboard.displayedFatGoal)
                            Divider()
                            if let meals = dashboard.recentMeals, !meals.isEmpty {
                                VStack(alignment: .leading, spacing: 10) {
                                    Text("Recent Meals").font(.headline)
                                    ForEach(Array(meals.enumerated()), id: \.offset) { _, meal in
                                        VStack(alignment: .leading, spacing: 4) {
                                            if let raw = meal.rawText {
                                                Text(raw).font(.subheadline)
                                            }
                                            if let items = meal.items {
                                                ForEach(Array(items.enumerated()), id: \.offset) { _, food in
                                                    Text("\(food.food_name.capitalized) — \(Int(food.calories)) cal")
                                                        .font(.caption)
                                                }
                                            }
                                        }
                                        Divider()
                                    }
                                }
                            } else {
                                Text("Your saved meals will appear here after you log one.")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding()
                        .padding(.bottom, 32)
                        .refreshable { refreshDashboard() }
                    }
                } else {
                    FirstLaunchStateView(
                        systemImage: "fork.knife.circle",
                        title: "Welcome to MacroMesh",
                        message: "Log your first meal to start tracking calories and macros today.",
                        primaryTitle: "Log a meal",
                        secondaryTitle: nil,
                        primaryAction: openLog,
                        secondaryAction: nil
                    )
                }
            }
            .navigationTitle("Today")
            .onAppear(perform: loadDashboard)
            .onReceive(NotificationCenter.default.publisher(for: .calorieCompassMealsDidChange)) { _ in
                refreshDashboard()
            }
        }
    }

    private func openLog() {
        NotificationCenter.default.post(name: .macroMeshOpenLogTab, object: nil)
    }

    private func recoverableDashboardMessage(_ error: String) -> String {
        if error.localizedCaseInsensitiveContains("profile") || error.localizedCaseInsensitiveContains("no data") {
            return "Your guest dashboard is still getting ready. You can log a meal now, or retry in a moment."
        }
        return "We couldn’t refresh Today yet. Nothing was changed — try again or start by logging a meal."
    }

    func loadDashboard() {
        guard !loading else { return }
        loading = true
        error = nil
        BackendService.fetchDashboard { result in
            DispatchQueue.main.async {
                loading = false
                switch result {
                case .success(let resp):
                    dashboard = resp
                case .failure(let err):
                    sessionStore.apply(err)
                    stabilityReporter.record(.networkFailure(screen: "Today", message: err.localizedDescription))
                    error = err.localizedDescription
                }
            }
        }
    }

    func refreshDashboard() {
        guard !refreshing else {
            stabilityReporter.record(.duplicateSubmissionBlocked(screen: "Today"))
            return
        }
        refreshing = true
        BackendService.fetchDashboard { result in
            DispatchQueue.main.async {
                refreshing = false
                switch result {
                case .success(let resp):
                    dashboard = resp
                case .failure(let err):
                    sessionStore.apply(err)
                    stabilityReporter.record(.networkFailure(screen: "Today", message: err.localizedDescription))
                    error = RetryCopy.nonDestructiveFailure(action: "refresh Today", error: err)
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
                .accessibilityLabel("\(label) progress")
                .accessibilityValue("\(Int(used)) of \(Int(goal))")
        }.padding(.vertical, 2)
    }
}

struct FirstLaunchStateView: View {
    let systemImage: String
    let title: String
    let message: String
    let primaryTitle: String
    let secondaryTitle: String?
    let primaryAction: () -> Void
    let secondaryAction: (() -> Void)?

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: systemImage)
                .font(.largeTitle)
                .foregroundColor(.accentColor)
            Text(title)
                .font(.title3)
                .fontWeight(.semibold)
            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            Button(primaryTitle, action: primaryAction)
                .buttonStyle(.borderedProminent)
            if let secondaryTitle, let secondaryAction {
                Button(secondaryTitle, action: secondaryAction)
                    .font(.caption)
            }
        }
        .padding(20)
        .frame(maxWidth: .infinity)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .padding()
    }
}
