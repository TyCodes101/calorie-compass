import SwiftUI

struct PremiumHistoryView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @State private var meals: [MealResponse] = []
    @State private var loading = false
    @State private var refreshing = false
    @State private var error: String?
    
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
                        VStack(spacing: 32) {
                            // Group meals by date
                            ForEach(groupedMealDates, id: \.self) { date in
                                Section(header: HistoryDayHeaderCard(date: date, meals: mealsByDate[date] ?? [])) {
                                    VStack(spacing: 14) {
                                        ForEach(mealsByDate[date] ?? []) { meal in
                                            HistoryMealCard(meal: meal)
                                        }
                                    }
                                }
                            }
                        }.padding(.horizontal, 18).padding(.top, 18).padding(.bottom, 90)
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: loadMeals) {
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

    private var groupedMealDates: [String] {
        let formatter = DateFormatter.mealDisplay
        let dates = Set(meals.compactMap { meal in
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
