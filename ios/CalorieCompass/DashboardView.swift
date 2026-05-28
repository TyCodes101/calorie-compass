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
            MacroMeshScreen {
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        hero
                        if loading && dashboard == nil {
                            DashboardSkeletonView()
                        } else {
                            if let error {
                                InlineRecoveryCard(message: recoverableDashboardMessage(error), retry: loadDashboard)
                            }
                            calorieSummaryCard
                            macroSection
                            Button(action: openLog) {
                                Label(hasLoggedMeal ? "Log another meal" : "Log first meal", systemImage: "plus.circle.fill")
                            }
                            .buttonStyle(PrimaryCTAButtonStyle())
                            recentMealsSection
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
                    .padding(.bottom, 88)
                    .refreshable { refreshDashboard() }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: refreshDashboard) {
                        if refreshing { ProgressView() } else { Image(systemName: "arrow.clockwise") }
                    }
                    .disabled(loading || refreshing)
                    .foregroundColor(MacroMeshTheme.primary)
                    .accessibilityLabel("Refresh Today")
                }
            }
            .onAppear(perform: loadDashboard)
            .onReceive(NotificationCenter.default.publisher(for: .calorieCompassMealsDidChange)) { _ in
                refreshDashboard()
            }
        }
    }

    private var hero: some View {
        AppCard(padding: 20) {
            VStack(alignment: .leading, spacing: 10) {
                Text("MacroMesh")
                    .font(.caption.weight(.bold))
                    .foregroundColor(MacroMeshTheme.primary)
                    .textCase(.uppercase)
                    .tracking(1.2)
                Text("Today’s nutrition")
                    .font(.largeTitle.weight(.bold))
                    .foregroundColor(MacroMeshTheme.text)
                Text(hasLoggedMeal ? "You’re building momentum. Keep logging to refine your day." : "Start with one meal and MacroMesh will build your calorie and macro picture.")
                    .font(.subheadline)
                    .foregroundColor(MacroMeshTheme.muted)
            }
        }
    }

    private var calorieSummaryCard: some View {
        let used = dashboard?.displayedCalories ?? 0
        let goal = dashboard?.displayedGoalCalories ?? 2_000
        let remaining = max(goal - used, 0)
        return AppCard(padding: 20) {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Calories consumed")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(MacroMeshTheme.muted)
                        Text("\(Int(used))")
                            .font(.system(size: 46, weight: .bold, design: .rounded))
                            .foregroundColor(MacroMeshTheme.text)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 4) {
                        Text("Remaining")
                            .font(.caption)
                            .foregroundColor(MacroMeshTheme.muted)
                        Text("\(Int(remaining))")
                            .font(.title2.weight(.bold))
                            .foregroundColor(MacroMeshTheme.primary)
                    }
                }
                ProgressView(value: goal > 0 ? min(used / goal, 1) : 0)
                    .tint(MacroMeshTheme.primary)
                    .scaleEffect(x: 1, y: 2.2, anchor: .center)
                Text("Daily goal: \(Int(goal)) calories")
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.muted)
            }
        }
    }

    private var macroSection: some View {
        AppCard {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeader("Macro targets", subtitle: "Progress updates as meals are saved.")
                MacroProgressRow(title: "Protein", value: dashboard?.displayedProtein ?? 0, goal: dashboard?.displayedProteinGoal ?? 120, unit: "g", tint: MacroMeshTheme.primary)
                MacroProgressRow(title: "Carbs", value: dashboard?.displayedCarbs ?? 0, goal: dashboard?.displayedCarbsGoal ?? 220, unit: "g", tint: MacroMeshTheme.orange)
                MacroProgressRow(title: "Fat", value: dashboard?.displayedFat ?? 0, goal: dashboard?.displayedFatGoal ?? 70, unit: "g", tint: MacroMeshTheme.purple)
            }
        }
    }

    private var hasLoggedMeal: Bool {
        !(dashboard?.recentMeals?.isEmpty ?? true) || (dashboard?.displayedCalories ?? 0) > 0
    }

    private var recentMealsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader("Recent meals")
            if let meals = dashboard?.recentMeals, !meals.isEmpty {
                VStack(spacing: 10) {
                    ForEach(Array(meals.prefix(4).enumerated()), id: \.offset) { _, meal in
                        MealPreviewCard(meal: meal)
                    }
                }
            } else {
                EmptyStateCard(
                    icon: "fork.knife.circle.fill",
                    title: "No meals logged yet",
                    message: "Use Log to describe breakfast, lunch, dinner, or a snack. Nothing is saved until you review it.",
                    buttonTitle: "Log a meal",
                    action: openLog
                )
            }
        }
    }

    private func openLog() {
        NotificationCenter.default.post(name: .macroMeshOpenLogTab, object: nil)
    }

    private func recoverableDashboardMessage(_ error: String) -> String {
        if error.localizedCaseInsensitiveContains("profile") || error.localizedCaseInsensitiveContains("no data") {
            return "Your dashboard is ready to start. Profile details can finish syncing in the background."
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

struct MealPreviewCard: View {
    let meal: MealResponse

    var body: some View {
        AppCard(padding: 14) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "leaf.circle.fill")
                    .font(.title2)
                    .foregroundColor(MacroMeshTheme.primary)
                VStack(alignment: .leading, spacing: 5) {
                    Text(meal.rawText?.nilIfBlank ?? "Saved meal")
                        .font(.headline)
                        .foregroundColor(MacroMeshTheme.text)
                        .lineLimit(1)
                    Text("\(Int(meal.safeTotalCalories)) cal · \(Int(meal.safeTotalProtein))g protein")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }
                Spacer()
            }
        }
    }
}

struct DashboardSkeletonView: View {
    var body: some View {
        VStack(spacing: 14) {
            AppCard {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Preparing dashboard")
                        .font(.headline)
                    Text("Loading your latest meal and macro totals…")
                        .font(.subheadline)
                }
            }
            .redacted(reason: .placeholder)
            ProgressView()
                .tint(MacroMeshTheme.primary)
        }
    }
}

struct InlineRecoveryCard: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        AppCard(padding: 12) {
            HStack(spacing: 12) {
                Image(systemName: "arrow.triangle.2.circlepath.circle.fill")
                    .foregroundColor(MacroMeshTheme.orange)
                Text(message)
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.muted)
                Spacer()
                Button("Retry", action: retry)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.primary)
            }
        }
    }
}
