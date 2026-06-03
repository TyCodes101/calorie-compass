import SwiftUI

enum HistoryFilter: String, CaseIterable, Identifiable, Equatable {
    case all
    case breakfast
    case lunch
    case dinner
    case snack

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: return "All"
        case .breakfast, .lunch, .dinner, .snack: return rawValue.capitalized
        }
    }

    func matches(_ meal: MealResponse) -> Bool {
        self == .all || meal.normalizedMealType == rawValue
    }
}

struct HistoryDayTotal: Equatable {
    let calories: Int
    let protein: Int
}

struct HistoryListModel: Equatable {
    let visibleMeals: [MealResponse]
    let groupedMealDates: [String]
    let mealsByDate: [String: [MealResponse]]
    let dayTotals: [String: HistoryDayTotal]
    let summaryText: String

    static func build(meals: [MealResponse], searchText: String, filter: HistoryFilter) -> HistoryListModel {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let filtered = meals.filter { meal in
            let matchesFilter = filter.matches(meal)
            let matchesSearch = query.isEmpty ||
                meal.displayTitle.lowercased().contains(query) ||
                meal.displayMealType.lowercased().contains(query) ||
                (meal.items ?? []).contains { $0.food_name.lowercased().contains(query) }
            return matchesFilter && matchesSearch
        }

        var grouped = [String: [MealResponse]]()
        for meal in filtered {
            guard let date = DateParser.parseMealDate(meal.date ?? meal.createdAt) else { continue }
            let key = dayFormatter.string(from: date)
            grouped[key, default: []].append(meal)
        }

        let sortedDates = grouped.keys.sorted { left, right in
            guard let leftDate = dayFormatter.date(from: left),
                  let rightDate = dayFormatter.date(from: right) else {
                return left > right
            }
            return leftDate > rightDate
        }

        let totals = grouped.reduce(into: [String: HistoryDayTotal]()) { partial, pair in
            partial[pair.key] = HistoryDayTotal(
                calories: pair.value.reduce(0) { $0 + Int($1.safeTotalCalories) },
                protein: pair.value.reduce(0) { $0 + Int($1.safeTotalProtein) }
            )
        }

        let totalCalories = filtered.reduce(0) { $0 + Int($1.safeTotalCalories) }
        let totalProtein = filtered.reduce(0) { $0 + Int($1.safeTotalProtein) }
        let mealWord = filtered.count == 1 ? "meal" : "meals"

        return HistoryListModel(
            visibleMeals: filtered,
            groupedMealDates: sortedDates,
            mealsByDate: grouped,
            dayTotals: totals,
            summaryText: "\(filtered.count) \(mealWord), \(totalCalories) cal, \(totalProtein)g protein"
        )
    }

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()
}

struct PremiumHistoryView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @State private var meals: [MealResponse] = []
    @State private var loading = false
    @State private var refreshing = false
    @State private var error: String?
    @State private var actionMessage: String?
    @State private var searchText = ""
    @State private var selectedFilter: HistoryFilter = .all
    
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
                            HistoryOverviewCard(summaryText: historyModel.summaryText, filter: selectedFilter)
                            HistoryFilterBar(selectedFilter: $selectedFilter)

                            if let actionMessage {
                                AppCard(padding: 12) {
                                    Text(actionMessage)
                                        .font(.caption)
                                        .foregroundColor(MacroMeshTheme.primaryDark)
                                }
                            }

                            if historyModel.visibleMeals.isEmpty {
                                AppCard(padding: 18) {
                                    VStack(spacing: 12) {
                                        Image(systemName: "magnifyingglass")
                                            .font(.title2)
                                            .foregroundColor(MacroMeshTheme.primary)
                                        Text("No matching meals")
                                            .font(.headline.weight(.semibold))
                                            .foregroundColor(MacroMeshTheme.text)
                                        Text("Try another search or filter.")
                                            .font(.subheadline)
                                            .foregroundColor(MacroMeshTheme.muted)
                                        Button("Clear filters") {
                                            searchText = ""
                                            selectedFilter = .all
                                        }
                                        .buttonStyle(SecondaryCTAButtonStyle())
                                    }
                                    .frame(maxWidth: .infinity)
                                }
                            }

                            ForEach(historyModel.groupedMealDates, id: \.self) { date in
                                VStack(alignment: .leading, spacing: 10) {
                                    HistoryDayHeaderCard(date: date, meals: historyModel.mealsByDate[date] ?? [])

                                    VStack(spacing: 10) {
                                        ForEach(historyModel.mealsByDate[date] ?? []) { meal in
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
            .searchable(text: $searchText, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search meals")
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
        guard let items = meal.items, !items.isEmpty else {
            actionMessage = "This meal needs item details before it can be repeated."
            return
        }

        let request = PostMealRequest(
            meal_type: meal.mealType?.lowercased() ?? "snack",
            confidence_score: meal.confidenceScore ?? 0.82,
            raw_text: meal.rawText ?? meal.displayTitle,
            source_reusable_meal_id: nil,
            notes: "Repeated from History",
            date: nil,
            items: items
        )
        BackendService.saveConfirmedMeal(request: request) { result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    actionMessage = "Repeated \(meal.displayTitle) for today."
                    NotificationCenter.default.post(name: .calorieCompassMealsDidChange, object: nil)
                    loadMeals()
                case .failure(let error):
                    sessionStore.apply(error)
                    actionMessage = RetryCopy.nonDestructiveFailure(action: "repeat that meal", error: error)
                }
            }
        }
    }

    private var historyModel: HistoryListModel {
        HistoryListModel.build(meals: meals, searchText: searchText, filter: selectedFilter)
    }
}

struct HistoryOverviewCard: View {
    let summaryText: String
    let filter: HistoryFilter

    var body: some View {
        AppCard(padding: 18) {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Meal history")
                        .font(.title2.weight(.bold))
                        .foregroundColor(MacroMeshTheme.text)
                    Text(filter == .all ? summaryText : "\(filter.label): \(summaryText)")
                        .font(.subheadline)
                        .foregroundColor(MacroMeshTheme.muted)
                }
                Spacer()
                Image(systemName: "chart.bar.doc.horizontal.fill")
                    .font(.title2)
                    .foregroundColor(MacroMeshTheme.primary)
                    .frame(width: 42, height: 42)
                    .background(MacroMeshTheme.cardSubtle)
                    .clipShape(Circle())
            }
        }
    }
}

struct HistoryFilterBar: View {
    @Binding var selectedFilter: HistoryFilter

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(HistoryFilter.allCases) { filter in
                    Button {
                        selectedFilter = filter
                    } label: {
                        Text(filter.label)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(selectedFilter == filter ? MacroMeshTheme.primary : MacroMeshTheme.card)
                            .foregroundColor(selectedFilter == filter ? .white : MacroMeshTheme.primaryDark)
                            .clipShape(Capsule())
                            .overlay(
                                Capsule().stroke(MacroMeshTheme.border, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Filter history by \(filter.label)")
                }
            }
            .padding(.vertical, 2)
        }
    }
}
