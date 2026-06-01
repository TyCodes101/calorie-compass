import SwiftUI

struct HistoryDayHeaderCard: View {
    let date: String
    let meals: [MealResponse]
    var totalCals: Int { meals.reduce(0) { $0 + Int($1.safeTotalCalories) } }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(date)
                    .font(.headline)
                Text("\(meals.count) meal\(meals.count == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            if meals.count > 0 {
                Text("\(totalCals) cal")
                    .font(.caption)
                    .foregroundColor(.primary.opacity(0.75))
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 12)
        .padding(.bottom, 4)
    }
}
