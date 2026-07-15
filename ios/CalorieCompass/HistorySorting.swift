import Foundation

enum HistoryFilter: String, CaseIterable, Identifiable {
    case all
    case recent
    case highProtein
    case breakfast
    case lunch
    case dinner
    case snack

    var id: String { rawValue }

    var label: String {
        switch self {
        case .all: return "All meals"
        case .recent: return "Last 7 days"
        case .highProtein: return "30g+ protein"
        case .breakfast: return "Breakfast"
        case .lunch: return "Lunch"
        case .dinner: return "Dinner"
        case .snack: return "Snack"
        }
    }
}

enum HistorySorting {
    struct DayGroup: Identifiable, Equatable {
        let id: Date
        let day: Date
        let meals: [MealResponse]
    }

    static func groupMealsByDay(_ meals: [MealResponse], now: Date = Date(), futureToleranceSeconds: TimeInterval = 6 * 3600) -> [DayGroup] {
        let calendar = Calendar.current

        let mealsWithDates: [(MealResponse, Date)] = meals.compactMap { meal in
            guard let date = DateParser.parseMealDate(meal.date ?? meal.createdAt) else { return nil }
            guard date <= now.addingTimeInterval(futureToleranceSeconds) else { return nil }
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
            return DayGroup(id: day, day: day, meals: dayMeals)
        }
    }

    static func filteredMeals(
        _ meals: [MealResponse],
        query: String,
        filter: HistoryFilter,
        now: Date = Date()
    ) -> [MealResponse] {
        let normalizedQuery = normalize(query)
        let queryTokens = normalizedQuery.split(separator: " ").map(String.init)
        let recentCutoff = Calendar.current.date(byAdding: .day, value: -7, to: now) ?? now.addingTimeInterval(-7 * 86400)

        return meals.filter { meal in
            switch filter {
            case .all:
                break
            case .recent:
                guard let date = DateParser.parseMealDate(meal.date ?? meal.createdAt), date >= recentCutoff else { return false }
            case .highProtein:
                guard meal.safeTotalProtein >= 30 else { return false }
            case .breakfast, .lunch, .dinner, .snack:
                guard meal.normalizedMealType == filter.rawValue else { return false }
            }

            guard !queryTokens.isEmpty else { return true }
            let itemText = (meal.items ?? []).flatMap { item in
                [item.food_name, item.source_name ?? "", item.source_type ?? "", item.notes ?? ""]
            }.joined(separator: " ")
            let searchable = normalize([
                meal.displayTitle,
                meal.displayMealType,
                meal.displayDate,
                "\(Int(meal.safeTotalCalories)) calories",
                "\(Int(meal.safeTotalProtein)) protein",
                itemText,
            ].joined(separator: " "))
            return queryTokens.allSatisfy(searchable.contains)
        }
    }

    private static func normalize(_ value: String) -> String {
        value
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

