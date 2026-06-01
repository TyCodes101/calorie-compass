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
                    VStack(alignment: .leading, spacing: MacroMeshSpacing.lg) {
                        todayHero
                        if loading && dashboard == nil {
                            DashboardSkeletonView()
                        } else {
                            if let error {
                                InlineRecoveryCard(message: recoverableDashboardMessage(error), retry: loadDashboard)
                            }
                            premiumCalorieSummaryCard
                            premiumMacroSection
                            dailyInsightsSection
                            Button(action: openLog) {
                                Label(hasLoggedMeal ? "Log another meal" : "Log first meal", systemImage: "plus.circle.fill")
                            }
                            .buttonStyle(PrimaryCTAButtonStyle())
                            premiumRecentMealsSection
                        }
                    }
                    .padding(.horizontal, MacroMeshSpacing.screenHorizontal)
                    .padding(.top, 12)
                    .padding(.bottom, MacroMeshSpacing.bottomPadding)
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

    private var todayHero: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 8) {
                    IconBadge(systemName: "leaf.fill", size: 30)
                    Text("MacroMesh")
                        .font(.caption.weight(.bold))
                        .foregroundColor(MacroMeshTheme.primary)
                        .textCase(.uppercase)
                }
                Text("Today's nutrition")
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundColor(MacroMeshTheme.text)
                    .lineLimit(2)
                Text(hasLoggedMeal ? "A clear look at calories, protein, and the next useful move." : "Start with one meal and the day fills in from there.")
                    .font(.subheadline)
                    .foregroundColor(MacroMeshTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 10)
            InsightPill(
                title: "Meals",
                value: "\(dashboard?.mealCount ?? dashboard?.recentMeals?.count ?? 0)",
                tint: MacroMeshTheme.blue,
                systemImage: "fork.knife"
            )
            .padding(.top, 4)
        }
        .padding(.top, 4)
    }

    private var premiumCalorieSummaryCard: some View {
        let used = dashboard?.displayedCalories ?? 0
        let goal = max(dashboard?.displayedGoalCalories ?? 2_000, 1)
        let remaining = max(dashboard?.remainingCalories ?? (goal - used), 0)
        return AppCard(padding: 20) {
            HStack(alignment: .center, spacing: 20) {
                CalorieProgressRing(value: used, goal: goal, lineWidth: 15)
                    .frame(width: 142, height: 142)
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Calories")
                            .font(.caption.weight(.bold))
                            .foregroundColor(MacroMeshTheme.muted)
                            .textCase(.uppercase)
                        Text("\(Int(remaining)) left")
                            .font(.system(size: 27, weight: .bold, design: .rounded))
                            .foregroundColor(MacroMeshTheme.text)
                            .lineLimit(1)
                            .minimumScaleFactor(0.78)
                        Text("Goal \(Int(goal)) cal")
                            .font(.caption)
                            .foregroundColor(MacroMeshTheme.muted)
                    }
                    HStack(spacing: 8) {
                        InsightPill(title: "Protein", value: "\(Int(dashboard?.displayedProtein ?? 0))g", tint: MacroMeshTheme.primary, systemImage: "bolt.fill")
                        InsightPill(title: "Logged", value: "\(Int(used))", tint: MacroMeshTheme.orange, systemImage: "checkmark")
                    }
                }
            }
        }
    }

    private var premiumMacroSection: some View {
        AppCard {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeader("Macro targets", subtitle: "Protein gets top billing; carbs and fat stay easy to scan.")
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    MacroMetricTile(title: "Protein", value: dashboard?.displayedProtein ?? 0, goal: dashboard?.displayedProteinGoal ?? 120, unit: "g", tint: MacroMeshTheme.protein, systemImage: "bolt.fill")
                    MacroMetricTile(title: "Carbs", value: dashboard?.displayedCarbs ?? 0, goal: dashboard?.displayedCarbsGoal ?? 220, unit: "g", tint: MacroMeshTheme.carbs, systemImage: "flame.fill")
                    MacroMetricTile(title: "Fat", value: dashboard?.displayedFat ?? 0, goal: dashboard?.displayedFatGoal ?? 70, unit: "g", tint: MacroMeshTheme.fat, systemImage: "drop.fill")
                    MacroMetricTile(title: "Meals", value: Double(dashboard?.mealCount ?? dashboard?.recentMeals?.count ?? 0), goal: 4, unit: "", tint: MacroMeshTheme.blue, systemImage: "clock.fill")
                }
            }
        }
    }

    private var dailyInsightsSection: some View {
        let title = dashboard?.dailySummary?.title?.trimmingCharacters(in: .whitespacesAndNewlines)
        let description = dashboard?.dailySummary?.description?.trimmingCharacters(in: .whitespacesAndNewlines)
        return AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 13) {
                HStack(spacing: 10) {
                    IconBadge(systemName: "sparkles", tint: MacroMeshTheme.yellow, size: 34)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(title?.isEmpty == false ? title! : (hasLoggedMeal ? "Daily insight" : "Ready to build the day"))
                            .font(.headline.weight(.bold))
                            .foregroundColor(MacroMeshTheme.text)
                        Text(description?.isEmpty == false ? description! : (hasLoggedMeal ? "Keep the next log simple and adjust the review card before saving." : "Log one meal to start calories, macros, and trends."))
                            .font(.caption)
                            .foregroundColor(MacroMeshTheme.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                HStack(spacing: 8) {
                    InsightPill(title: "Protein pace", value: "\(Int(dashboard?.displayedProtein ?? 0))g", tint: MacroMeshTheme.primary, systemImage: "chart.line.uptrend.xyaxis")
                    InsightPill(title: "Remaining", value: "\(Int(max(dashboard?.remainingCalories ?? 0, 0))) cal", tint: MacroMeshTheme.blue, systemImage: "target")
                }
            }
        }
    }

    private var premiumRecentMealsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeader("Recent meals", subtitle: "The latest saves, cleaned up for scanning.")
            if let meals = dashboard?.recentMeals, !meals.isEmpty {
                VStack(spacing: 10) {
                    ForEach(Array(meals.prefix(4).enumerated()), id: \.offset) { _, meal in
                        PremiumMealPreviewCard(meal: meal)
                    }
                }
            } else {
                EmptyStateCard(
                    icon: "fork.knife.circle.fill",
                    title: "No meals logged yet",
                    message: "Meals you save from Log will appear here after review.",
                    buttonTitle: "Log a meal",
                    action: openLog
                )
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
                    dashboard = dashboard ?? .empty
                    error = RetryCopy.recoveryMessage(action: "load Today", error: err)
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
                    dashboard = dashboard ?? .empty
                    error = RetryCopy.recoveryMessage(action: "refresh Today", error: err)
                }
            }
        }
    }
}

struct PremiumMealPreviewCard: View {
    let meal: MealResponse

    var body: some View {
        AppCard(padding: 14) {
            HStack(alignment: .center, spacing: 12) {
                IconBadge(systemName: mealIcon, tint: mealTint, size: 36)
                VStack(alignment: .leading, spacing: 6) {
                    Text(meal.displayTitle)
                        .font(.headline)
                        .foregroundColor(MacroMeshTheme.text)
                        .lineLimit(1)
                    Text("\(Int(meal.safeTotalCalories)) cal | \(Int(meal.safeTotalProtein))g protein")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption.weight(.bold))
                    .foregroundColor(MacroMeshTheme.subtleText)
            }
        }
    }

    private var mealIcon: String {
        switch meal.normalizedMealType {
        case "breakfast": return "sunrise.fill"
        case "lunch": return "sun.max.fill"
        case "dinner": return "moon.stars.fill"
        default: return "leaf.fill"
        }
    }

    private var mealTint: Color {
        switch meal.normalizedMealType {
        case "breakfast": return MacroMeshTheme.orange
        case "lunch": return MacroMeshTheme.blue
        case "dinner": return MacroMeshTheme.purple
        default: return MacroMeshTheme.primary
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
