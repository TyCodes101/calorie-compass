// DashboardView.swift
// Calorie Compass native iOS
// Phase 2C: Dashboard, macros, recent meals
import SwiftUI

struct DashboardInsight: Equatable {
    let title: String
    let message: String
    let icon: String
}

struct DashboardQuickAction: Equatable, Identifiable {
    let id: String
    let title: String
    let subtitle: String
    let icon: String
    let launch: LogToolLaunch
}

struct DashboardV1Model: Equatable {
    let caloriesUsedText: String
    let calorieGoalText: String
    let remainingCaloriesText: String
    let proteinProgressText: String
    let primaryInsight: DashboardInsight
    let secondaryInsights: [DashboardInsight]
    let quickActions: [DashboardQuickAction]

    static func build(dashboard: DashboardResponse?) -> DashboardV1Model {
        let used = dashboard?.displayedCalories ?? 0
        let goal = dashboard?.displayedGoalCalories ?? 2_000
        let remaining = max(goal - used, 0)
        let protein = dashboard?.displayedProtein ?? 0
        let proteinGoal = dashboard?.displayedProteinGoal ?? 120
        let meals = dashboard?.mealCount ?? dashboard?.recentMeals?.count ?? 0

        let title = dashboard?.dailySummary?.title?.nilIfBlank ?? (used > 0 ? "Steady progress" : "Ready for your first log")
        let message = dashboard?.dailySummary?.description?.nilIfBlank ?? (used > 0 ? "Keep protein visible and review each serving before saving." : "Start with one meal to build today's picture.")

        let secondaryInsights = [
            DashboardInsight(title: "Protein", message: "\(format(protein))/\(format(proteinGoal)) g logged", icon: "bolt.heart.fill"),
            DashboardInsight(title: "Meals", message: meals == 1 ? "1 meal saved today" : "\(meals) meals saved today", icon: "fork.knife"),
            DashboardInsight(title: "Review", message: "Nothing logs until you confirm it.", icon: "checkmark.seal.fill")
        ]

        return DashboardV1Model(
            caloriesUsedText: "\(format(used)) cal",
            calorieGoalText: "\(format(goal)) goal",
            remainingCaloriesText: "\(format(remaining)) cal",
            proteinProgressText: "\(format(protein))/\(format(proteinGoal)) g",
            primaryInsight: DashboardInsight(title: title, message: message, icon: "sparkles"),
            secondaryInsights: secondaryInsights,
            quickActions: [
                DashboardQuickAction(id: "food-search", title: "Food Search", subtitle: "Find verified foods", icon: "magnifyingglass", launch: .foodSearch),
                DashboardQuickAction(id: "scan-barcode", title: "Scan Barcode", subtitle: "Use camera or UPC", icon: "barcode.viewfinder", launch: .barcodeCamera),
                DashboardQuickAction(id: "quick-add", title: "Quick Add", subtitle: "Calories and macros", icon: "plus.circle.fill", launch: .quickAdd),
                DashboardQuickAction(id: "scan-label", title: "Scan Label", subtitle: "OCR text capture", icon: "doc.text.viewfinder", launch: .nutritionLabel)
            ]
        )
    }

    private static func format(_ value: Double) -> String {
        value == floor(value) ? String(Int(value)) : String(format: "%.1f", value)
    }
}

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
                        heroV1
                        if loading && dashboard == nil {
                            DashboardSkeletonView()
                        } else {
                            if let error {
                                InlineRecoveryCard(message: recoverableDashboardMessage(error), retry: loadDashboard)
                            }
                            calorieSummaryCard
                            dashboardQuickActionsCard
                            macroSection
                            dailyInsightsCard
                            streaksCard
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

    private var v1Model: DashboardV1Model {
        DashboardV1Model.build(dashboard: dashboard)
    }

    private var heroV1: some View {
        AppCard(padding: 20) {
            HStack(alignment: .center, spacing: 14) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("MacroMesh")
                        .font(.caption.weight(.bold))
                        .foregroundColor(MacroMeshTheme.primary)
                        .textCase(.uppercase)
                        .tracking(1.2)
                    Text("Today's nutrition")
                        .font(.largeTitle.weight(.bold))
                        .foregroundColor(MacroMeshTheme.text)
                        .minimumScaleFactor(0.82)
                    Text(hasLoggedMeal ? "Momentum is building. Keep protein visible and servings reviewed." : "Start with one meal and build a clean picture of the day.")
                        .font(.subheadline)
                        .foregroundColor(MacroMeshTheme.muted)
                }
                Spacer(minLength: 8)
                Image(systemName: "leaf.circle.fill")
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundColor(MacroMeshTheme.primary)
                    .accessibilityHidden(true)
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
                        Text("\(v1Model.caloriesUsedText) of \(v1Model.calorieGoalText)")
                            .font(.caption)
                            .foregroundColor(MacroMeshTheme.muted)
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

    private var dashboardQuickActionsCard: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Log faster", subtitle: "Jump into the logging path that fits the food in front of you.")
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ForEach(v1Model.quickActions) { action in
                        DashboardQuickActionButton(action: action) {
                            openLog(tool: action.launch)
                        }
                    }
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

    private var dailyInsightsCard: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: v1Model.primaryInsight.icon)
                        .foregroundColor(MacroMeshTheme.primary)
                        .frame(width: 30, height: 30)
                        .background(MacroMeshTheme.cardSubtle)
                        .clipShape(Circle())
                    SectionHeader(v1Model.primaryInsight.title, subtitle: v1Model.primaryInsight.message)
                }
                VStack(spacing: 8) {
                    ForEach(v1Model.secondaryInsights, id: \.title) { insight in
                        HStack(spacing: 10) {
                            Image(systemName: insight.icon)
                                .foregroundColor(MacroMeshTheme.primary)
                                .frame(width: 24)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(insight.title)
                                    .font(.caption.weight(.bold))
                                    .foregroundColor(MacroMeshTheme.text)
                                Text(insight.message)
                                    .font(.caption)
                                    .foregroundColor(MacroMeshTheme.muted)
                            }
                            Spacer()
                        }
                    }
                }
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
                        MealPreviewCard(meal: meal, onLogAgain: logAgain)
                    }
                }
            } else {
                EmptyStateCard(
                    icon: "fork.knife.circle.fill",
                    title: "No meals logged yet",
                    message: "Start by logging breakfast, lunch, dinner, or a snack. Nothing is saved until you review it.",
                    buttonTitle: "Log a meal",
                    action: openLog
                )
            }
        }
    }

    private func logAgain(_ meal: MealResponse) {
        NotificationCenter.default.post(name: .macroMeshPrefillLogText, object: MealPrefillBuilder.buildPrefill(meal: meal))
    }

    private func openLog() {
        NotificationCenter.default.post(name: .macroMeshOpenLogTab, object: nil)
    }

    private func openLog(tool: LogToolLaunch) {
        NotificationCenter.default.post(name: .macroMeshOpenLogTool, object: tool)
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

struct DashboardQuickActionButton: View {
    let action: DashboardQuickAction
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 8) {
                Image(systemName: action.icon)
                    .font(.headline)
                    .foregroundColor(MacroMeshTheme.primary)
                    .frame(width: 32, height: 32)
                    .background(MacroMeshTheme.cardSubtle)
                    .clipShape(Circle())
                Text(action.title)
                    .font(.subheadline.weight(.bold))
                    .foregroundColor(MacroMeshTheme.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
                Text(action.subtitle)
                    .font(.caption2)
                    .foregroundColor(MacroMeshTheme.muted)
                    .lineLimit(2)
            }
            .padding(12)
            .frame(maxWidth: .infinity, minHeight: 104, alignment: .leading)
            .background(MacroMeshTheme.cardSubtle.opacity(0.72))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(action.title)
    }
}

struct MealPreviewCard: View {
    let meal: MealResponse
    var onLogAgain: ((MealResponse) -> Void)? = nil

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
                if let onLogAgain {
                    Button {
                        onLogAgain(meal)
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(MacroMeshTheme.primary)
                            .padding(10)
                            .background(MacroMeshTheme.cardSubtle)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Log again")
                    .accessibilityHint("Prefills this meal in the Log tab for review before saving.")
                }
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
