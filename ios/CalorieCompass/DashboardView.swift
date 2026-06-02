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
                            streaksCard
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
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .center, spacing: 18) {
                    CalorieRing(value: used, goal: goal, size: 132)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Remaining")
                            .font(.caption.weight(.bold))
                            .foregroundColor(MacroMeshTheme.muted)
                            .textCase(.uppercase)
                            .tracking(0.8)
                        Text("\(Int(remaining)) cal")
                            .font(.system(size: 34, weight: .bold, design: .rounded))
                            .foregroundColor(MacroMeshTheme.text)
                        Text(remaining > 0 ? "left for today" : "goal reached")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(MacroMeshTheme.primary)
                    }
                    Spacer()
                }
                HStack(spacing: 10) {
                    MetricPill(title: "Protein", value: "\(Int(dashboard?.displayedProtein ?? 0))g", icon: "bolt.heart.fill", tint: MacroMeshTheme.primary)
                    MetricPill(title: "Meals", value: "\(dashboard?.mealCount ?? dashboard?.recentMeals?.count ?? 0)", icon: "fork.knife", tint: MacroMeshTheme.orange)
                }
            }
        }
    }

    private var macroSection: some View {
        AppCard {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeader("Macro targets", subtitle: "Protein first, then balance carbs and fats around the day.")
                MacroProgressRow(title: "Protein", value: dashboard?.displayedProtein ?? 0, goal: dashboard?.displayedProteinGoal ?? 120, unit: "g", tint: MacroMeshTheme.primary)
                MacroProgressRow(title: "Carbs", value: dashboard?.displayedCarbs ?? 0, goal: dashboard?.displayedCarbsGoal ?? 220, unit: "g", tint: MacroMeshTheme.orange)
                MacroProgressRow(title: "Fat", value: dashboard?.displayedFat ?? 0, goal: dashboard?.displayedFatGoal ?? 70, unit: "g", tint: MacroMeshTheme.purple)
            }
        }
    }

    private var streaksCard: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Streaks", subtitle: dashboard?.streaks?.summary ?? "Build consistency one saved meal at a time.")
                HStack(spacing: 10) {
                    MetricPill(title: "Current", value: "\(dashboard?.streaks?.currentStreakDays ?? 0)d", icon: "flame.fill", tint: MacroMeshTheme.orange)
                    MetricPill(title: "This week", value: "\(dashboard?.streaks?.mealsLoggedThisWeek ?? 0)", icon: "calendar", tint: MacroMeshTheme.primary)
                    MetricPill(title: "Protein", value: "\(dashboard?.streaks?.proteinGoalHitDaysThisWeek ?? 0)/7", icon: "bolt.fill", tint: MacroMeshTheme.blue)
                }
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
