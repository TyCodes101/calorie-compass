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
                            if let actionMessage {
                                AppCard(padding: 12) {
                                    Text(actionMessage)
                                        .font(.caption)
                                        .foregroundColor(MacroMeshTheme.primaryDark)
                                }
                            }

                            ForEach(groupedMealDates, id: \.self) { date in
                                VStack(alignment: .leading, spacing: 10) {
                                    HistoryDayHeaderCard(date: date, meals: mealsByDate[date] ?? [])

                                    VStack(spacing: 10) {
                                        ForEach(mealsByDate[date] ?? []) { meal in
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

    private var groupedMealDates: [String] {
        let formatter = DateFormatter.mealDisplay
        let dates: Set<String> = Set(meals.compactMap { meal -> String? in
            guard let date = DateParser.parseMealDate(meal.date ?? meal.createdAt) else { return nil }
            return formatter.string(from: date)
        })
        return dates.sorted().reversed()
    }

    private var mealsByDate: [String: [MealResponse]] {
        let formatter = DateFormatter.mealDisplay
        var dict = [String: [MealResponse]]()
        for meal in meals {
            guard let date = DateParser.parseMealDate(meal.date ?? meal.createdAt) else { continue }
            let dateString = formatter.string(from: date)
            dict[dateString, default: []].append(meal)
        }
        return dict
    }
}
