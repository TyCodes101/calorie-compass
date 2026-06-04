import Foundation

enum WeightChartSanitizer {
    static func sanitize(entries: [WeightEntry], now: Date = Date(), futureToleranceSeconds: TimeInterval = 6 * 3600) -> [(date: Date, weight: Double, id: String)] {
        entries.compactMap { entry in
            guard let date = DateParser.parseMealDate(entry.date) else { return nil }
            let weight = entry.weightLbs
            guard weight.isFinite, weight >= 60, weight <= 600 else { return nil }
            guard date <= now.addingTimeInterval(futureToleranceSeconds) else { return nil }
            return (date: date, weight: weight, id: entry.id)
        }
    }

    static func dedupeLatestPerDay(_ points: [(date: Date, weight: Double, id: String)]) -> [(date: Date, weight: Double, id: String)] {
        let calendar = Calendar.current
        var latestByDay: [Date: (Date, Double, String)] = [:]

        for point in points {
            let day = calendar.startOfDay(for: point.date)
            if let existing = latestByDay[day] {
                if point.date > existing.0 {
                    latestByDay[day] = (point.date, point.weight, point.id)
                }
            } else {
                latestByDay[day] = (point.date, point.weight, point.id)
            }
        }

        return latestByDay.values.sorted { $0.0 < $1.0 }.map { (date: $0.0, weight: $0.1, id: $0.2) }
    }
}

