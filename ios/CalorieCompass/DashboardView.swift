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

    private var dashboardForDisplay: DashboardResponse? {
        dashboard
    }

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    header

                    if loading && dashboard == nil {
                        DashboardSkeletonView()
                    } else {
                        if let error = error {
                            InlineRecoveryCard(message: recoverableDashboardMessage(error), retry: loadDashboard)
                        }

                        MacroGridView(dashboard: dashboardForDisplay)

                        Button(action: openLog) {
                            Label(hasLoggedMeal ? "Log another meal" : "Log first meal", systemImage: "plus.circle.fill")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)

                        recentMealsSection
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 8)
                .padding(.bottom, 88)
                .refreshable { refreshDashboard() }
            }
            .navigationTitle("Today")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: refreshDashboard) {
                        if refreshing { ProgressView() } else { Image(systemName: "arrow.clockwise") }
                    }
                    .disabled(loading || refreshing)
                    .accessibilityLabel("Refresh Today")
                }
            }
            .onAppear(perform: loadDashboard)
            .onReceive(NotificationCenter.default.publisher(for: .calorieCompassMealsDidChange)) { _ in
                refreshDashboard()
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Welcome to MacroMesh")
                .font(.largeTitle)
                .fontWeight(.bold)
            Text(hasLoggedMeal ? "Here’s how today is tracking." : "Log your first meal to start tracking calories and macros today.")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var hasLoggedMeal: Bool {
        !(dashboard?.recentMeals?.isEmpty ?? true) || (dashboard?.displayedCalories ?? 0) > 0
    }

    private var recentMealsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Recent Meals")
                .font(.headline)
            if let meals = dashboard?.recentMeals, !meals.isEmpty {
                VStack(spacing: 10) {
                    ForEach(Array(meals.enumerated()), id: \.offset) { _, meal in
                        VStack(alignment: .leading, spacing: 5) {
                            Text(meal.rawText?.nilIfBlank ?? "Saved meal")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                            if let items = meal.items, !items.isEmpty {
                                Text(items.prefix(2).map { "\($0.food_name.capitalized) · \(Int($0.calories)) cal" }.joined(separator: "  "))
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .lineLimit(2)
                            }
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                }
            } else {
                Text("Meals you save from Log will appear here.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
    }

    private func openLog() {
        NotificationCenter.default.post(name: .macroMeshOpenLogTab, object: nil)
    }

    private func recoverableDashboardMessage(_ error: String) -> String {
        if error.localizedCaseInsensitiveContains("profile") || error.localizedCaseInsensitiveContains("no data") {
            return "Today is ready to use. Profile details can finish syncing in the background."
        }
        return "We couldn’t refresh today yet. Nothing was changed."
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
                    error = nil
                case .failure(let err):
                    sessionStore.apply(err)
                    stabilityReporter.record(.networkFailure(screen: "Today", message: err.localizedDescription))
                    error = RetryCopy.nonDestructiveFailure(action: "refresh Today", error: err)
                }
            }
        }
    }
}

struct MacroGridView: View {
    let dashboard: DashboardResponse?

    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            MacroMetricCard(title: "Calories", value: dashboard?.displayedCalories ?? 0, goal: dashboard?.displayedGoalCalories ?? 2_000, unit: "cal", tint: .blue)
            MacroMetricCard(title: "Protein", value: dashboard?.displayedProtein ?? 0, goal: dashboard?.displayedProteinGoal ?? 120, unit: "g", tint: .green)
            MacroMetricCard(title: "Carbs", value: dashboard?.displayedCarbs ?? 0, goal: dashboard?.displayedCarbsGoal ?? 220, unit: "g", tint: .orange)
            MacroMetricCard(title: "Fat", value: dashboard?.displayedFat ?? 0, goal: dashboard?.displayedFatGoal ?? 70, unit: "g", tint: .purple)
        }
    }
}

struct MacroMetricCard: View {
    let title: String
    let value: Double
    let goal: Double
    let unit: String
    let tint: Color

    private var progress: Double { goal > 0 ? min(max(value / goal, 0), 1) : 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            Text("\(Int(value))")
                .font(.title2)
                .fontWeight(.bold)
            Text("of \(Int(goal)) \(unit)")
                .font(.caption2)
                .foregroundColor(.secondary)
            ProgressView(value: progress)
                .tint(tint)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct DashboardSkeletonView: View {
    var body: some View {
        VStack(spacing: 14) {
            MacroGridView(dashboard: nil)
                .redacted(reason: .placeholder)
            Text("Preparing your dashboard…")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }
}

struct InlineRecoveryCard: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "arrow.triangle.2.circlepath.circle.fill")
                .foregroundColor(.orange)
            Text(message)
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer()
            Button("Retry", action: retry)
                .font(.caption)
        }
        .padding(12)
        .background(Color.orange.opacity(0.10))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
