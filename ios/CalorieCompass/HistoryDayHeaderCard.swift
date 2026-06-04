import SwiftUI

struct HistoryDayHeaderCard: View {
    let date: String
    let meals: [MealResponse]

    private var totalCals: Int { meals.reduce(0) { $0 + Int($1.safeTotalCalories) } }
    private var hasAnyCalories: Bool { totalCals > 0 }

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(date)
                    .font(.headline.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.text)
                Text("\(meals.count) meal\(meals.count == 1 ? "" : "s")")
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.muted)
            }
            Spacer()
            if meals.isEmpty {
                EmptyView()
            } else if hasAnyCalories {
                Text("\(totalCals) cal")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.text)
            } else {
                Badge("Needs review", color: MacroMeshTheme.orange)
                    .accessibilityLabel("Missing nutrition totals")
            }
        }
        .padding(.horizontal, 2)
        .padding(.top, 10)
        .padding(.bottom, 2)
        .accessibilityElement(children: .combine)
    }
}
