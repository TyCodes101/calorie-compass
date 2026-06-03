import SwiftUI

struct HistoryDayHeaderCard: View {
    let date: String
    let meals: [MealResponse]

    private var totalCals: Int { meals.reduce(0) { $0 + Int($1.safeTotalCalories) } }
    private var totalProtein: Int { meals.reduce(0) { $0 + Int($1.safeTotalProtein) } }

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(date)
                    .font(.headline.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.text)
                Text("\(meals.count) meal\(meals.count == 1 ? "" : "s") | \(totalProtein)g protein")
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.muted)
            }
            Spacer()
            Text("\(totalCals) cal")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(MacroMeshTheme.text)
                .opacity(meals.isEmpty ? 0 : 1)
                .accessibilityHidden(meals.isEmpty)
        }
        .padding(.horizontal, 2)
        .padding(.top, 10)
        .padding(.bottom, 2)
        .accessibilityElement(children: .combine)
    }
}
