import SwiftUI

enum MealPrefillBuilder {
    static func buildPrefill(meal: MealResponse) -> String {
        if let items = meal.items, !items.isEmpty {
            let names = items
                .map { $0.food_name.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            if !names.isEmpty {
                let joined = names.prefix(6).joined(separator: ", ")
                return "Log this again: \(joined)."
            }
        }

        let fallback = meal.rawText?.nilIfBlank ?? meal.displayTitle
        return "Log this again: \(fallback)."
    }
}

struct PremiumHistoryView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @State private var meals: [MealResponse] = []
    @State private var loading = false
    @State private var refreshing = false
    @State private var error: String?
    @State private var actionMessage: String?
    
    var body: some View {
        NavigationView {
            ZStack {
                Color(.systemGroupedBackground).ignoresSafeArea()
                if loading && meals.isEmpty {
                    HistoryEmptyStateCard(icon: "clock.arrow.circlepath", title: "Loading meals", message: "Your saved meals will appear here in a moment.", buttonTitle: nil, action: nil)
                } else if let error = error, meals.isEmpty {
                    HistoryEmptyStateCard(icon: "wifi.exclamationmark", title: "Meals unavailable", message: error, buttonTitle: "Retry", action: loadMeals)
                } else if meals.isEmpty {
                    HistoryEmptyStateCard(icon: "fork.knife.circle.fill", title: "No saved meals yet", message: "Meals you save from Log will appear here as a clean history of your day.", buttonTitle: "Log a meal", action: openLog)
                } else {
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 18) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("History")
                                    .font(.title2.weight(.bold))
                                    .foregroundColor(MacroMeshTheme.text)
                                Text("Your saved meals, grouped by day.")
                                    .font(.caption)
                                    .foregroundColor(MacroMeshTheme.muted)
                            }

                            HistoryWeeklySummaryCard(summary: weeklySummary)

                            if let actionMessage {
                                AppCard(padding: 12) {
                                    Text(actionMessage)
                                        .font(.caption)
                                        .foregroundColor(MacroMeshTheme.primaryDark)
                                }
                            }

                            ForEach(dayGroups) { group in
                                VStack(alignment: .leading, spacing: 10) {
                                    HistoryDayHeaderCard(date: group.displayDate, meals: group.meals)

                                    VStack(spacing: 10) {
                                        ForEach(group.meals) { meal in
                                            HistoryMealCard(
                                                meal: meal,
                                                onFavorite: { favoriteMeal(meal) },
                                                onRepeat: { repeatMeal(meal) }
                                            )
                                        }
                                    }
                                }
                                .padding(.top, 4)
                            }
                        }
                        .padding(.horizontal, 18)
                        .padding(.top, 14)
                        .padding(.bottom, 90)
                    }
                    .refreshable { refreshMeals() }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .navigationTitle("")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: refreshMeals) {
                        if refreshing { ProgressView() } else { Image(systemName: "arrow.clockwise") }
                    }
                    .foregroundColor(MacroMeshTheme.primary)
                    .disabled(loading || refreshing)
                    .accessibilityLabel("Refresh meals")
                }
            }
            .onAppear(perform: loadMeals)
        }
    }

    private func openLog() {
        NotificationCenter.default.post(name: .macroMeshOpenLogTab, object: nil)
    }

    private func loadMeals() {
        guard !loading else { return }
        loading = true
        error = nil
        BackendService.fetchMeals { result in
            DispatchQueue.main.async {
                loading = false
                switch result {
                case .success(let data):
                    meals = data
                    error = nil
                case .failure(let err):
                    sessionStore.apply(err)
                    error = err.localizedDescription
                }
            }
        }
    }

    private func refreshMeals() {
        guard !refreshing else { return }
        refreshing = true
        BackendService.fetchMeals { result in
            DispatchQueue.main.async {
                refreshing = false
                switch result {
                case .success(let data):
                    meals = data
                    error = nil
                case .failure(let err):
                    sessionStore.apply(err)
                    error = RetryCopy.nonDestructiveFailure(action: "refresh meals", error: err)
                }
            }
        }
    }

    private func favoriteMeal(_ meal: MealResponse) {
        guard let items = meal.items, !items.isEmpty else {
            actionMessage = "This meal needs item details before it can become a favorite."
            return
        }

        let request = FavoriteMealRequest(
            reusable_meal_id: nil,
            meal_type: meal.mealType?.lowercased() ?? "snack",
            confidence_score: meal.confidenceScore ?? 0.82,
            raw_text: meal.rawText ?? meal.displayTitle,
            items: items
        )
        BackendService.saveFavoriteMeal(request: request) { result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    actionMessage = "Saved \(meal.displayTitle) as a favorite."
                case .failure(let error):
                    sessionStore.apply(error)
                    actionMessage = RetryCopy.nonDestructiveFailure(action: "save that favorite", error: error)
                }
            }
        }
    }

    private func repeatMeal(_ meal: MealResponse) {
        let prefill = MealPrefillBuilder.buildPrefill(meal: meal)
        NotificationCenter.default.post(name: .macroMeshPrefillLogText, object: prefill)
        actionMessage = "Ready to log \(meal.displayTitle) again. Review it before saving."
    }

    private var dayGroups: [HistoryDayGroup] {
        let calendar = Calendar.current
        let now = Date()
        let mealsWithDates: [(MealResponse, Date)] = meals.compactMap { meal in
            guard let date = DateParser.parseMealDate(meal.date ?? meal.createdAt) else { return nil }
            // Drop wildly future timestamps (timezone/parse artifacts).
            guard date <= now.addingTimeInterval(6 * 3600) else { return nil }
            return (meal, date)
        }

        let grouped = Dictionary(grouping: mealsWithDates) { (_, date) in
            calendar.startOfDay(for: date)
        }

        let sortedDays = grouped.keys.sorted(by: >)
        return sortedDays.map { day in
            let dayMeals = (grouped[day] ?? [])
                .sorted { $0.1 > $1.1 }
                .map { $0.0 }
            return HistoryDayGroup(day: day, meals: dayMeals)
        }
    }

    private var weeklySummary: HistoryWeeklySummary {
        HistoryWeeklySummary.build(meals: meals)
    }
}

private struct HistoryDayGroup: Identifiable {
    let id: Date
    let day: Date
    let meals: [MealResponse]

    init(day: Date, meals: [MealResponse]) {
        self.id = day
        self.day = day
        self.meals = meals
    }

    var displayDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .full
        formatter.timeStyle = .none
        return formatter.string(from: day)
    }
}

private struct HistoryWeeklySummary: Equatable {
    let mealsThisWeek: Int
    let averageCalories: Int?
    let bestProteinDayText: String?

    static func build(meals: [MealResponse]) -> HistoryWeeklySummary {
        let cutoff = Calendar.current.date(byAdding: .day, value: -7, to: Date()) ?? Date().addingTimeInterval(-7 * 86400)
        let calendar = Calendar.current
        let recent: [(MealResponse, Date)] = meals.compactMap { meal in
            guard let date = DateParser.parseMealDate(meal.date ?? meal.createdAt) else { return nil }
            guard date >= cutoff else { return nil }
            return (meal, date)
        }

        let count = recent.count
        let avg: Int? = {
            guard count > 0 else { return nil }
            let total = recent.reduce(0.0) { $0 + $1.0.safeTotalCalories }
            let perMeal = total / Double(count)
            return perMeal > 0 ? Int(perMeal.rounded()) : nil
        }()

        let proteinByDay = Dictionary(grouping: recent) { (_, date) in
            calendar.startOfDay(for: date)
        }.mapValues { items in
            items.reduce(0.0) { $0 + $1.0.safeTotalProtein }
        }

        let bestProteinDay = proteinByDay.max(by: { $0.value < $1.value })
        let bestProteinDayText: String? = {
            guard let bestProteinDay, bestProteinDay.value > 0 else { return nil }
            let formatter = DateFormatter()
            formatter.dateStyle = .medium
            formatter.timeStyle = .none
            return "Best protein day: \(formatter.string(from: bestProteinDay.key)) (\(Int(bestProteinDay.value))g)"
        }()

        return HistoryWeeklySummary(mealsThisWeek: count, averageCalories: avg, bestProteinDayText: bestProteinDayText)
    }
}

private struct HistoryWeeklySummaryCard: View {
    let summary: HistoryWeeklySummary

    var body: some View {
        AppCard(padding: 14) {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader("This week", subtitle: "A quick snapshot of the last 7 days.")

                HStack(spacing: 12) {
                    HistorySummaryPill(label: "Meals", value: "\(summary.mealsThisWeek)")
                    HistorySummaryPill(label: "Avg calories", value: summary.averageCalories.map { "\($0)" } ?? "—")
                }

                if let best = summary.bestProteinDayText {
                    Text(best)
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                        .lineLimit(2)
                } else {
                    Text("Log a few meals to unlock a richer weekly summary.")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }
            }
        }
    }
}

private struct HistorySummaryPill: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption2.weight(.semibold))
                .foregroundColor(MacroMeshTheme.muted)
            Text(value)
                .font(.headline.weight(.bold))
                .foregroundColor(MacroMeshTheme.text)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MacroMeshTheme.cardSubtle.opacity(0.85))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
