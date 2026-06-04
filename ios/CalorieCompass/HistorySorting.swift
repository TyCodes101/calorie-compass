import Foundation

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
}

