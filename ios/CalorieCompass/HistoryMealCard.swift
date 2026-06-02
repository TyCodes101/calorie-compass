import SwiftUI

struct HistoryMealCard: View {
    let meal: MealResponse
    var onFavorite: (() -> Void)? = nil
    var onRepeat: (() -> Void)? = nil

    var body: some View {
        AppCard(padding: 15) {
            VStack(alignment: .leading, spacing: 7) {
                HStack {
                    Image(systemName: "fork.knife.circle.fill")
                        .font(.title3)
                        .foregroundColor(MacroMeshTheme.primary)
                    Text(meal.displayTitle)
                        .font(.headline.weight(.semibold))
                        .foregroundColor(MacroMeshTheme.text)
                        .lineLimit(1)
                    Spacer()
                    // Calories: visually secondary
                    Text("\(Int(meal.safeTotalCalories)) cal")
                        .font(.subheadline)
                        .fontWeight(.regular)
                        .foregroundColor(MacroMeshTheme.primary)
                        .padding(.leading, 4)
                }
                Text("\(meal.displayMealType) · \(meal.displayDate)")
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.muted)
                HStack(spacing: 8) {
                    HistoryMacroChip(label: "P", value: Int(meal.safeTotalProtein), color: .accentColor)
                    HistoryMacroChip(label: "C", value: Int(meal.safeTotalCarbs), color: .blue)
                    HistoryMacroChip(label: "F", value: Int(meal.safeTotalFat), color: .purple)
                }
                .padding(.top, 2)
                if onFavorite != nil || onRepeat != nil {
                    HStack(spacing: 8) {
                        if let onFavorite {
                            Button(action: onFavorite) {
                                Label("Favorite", systemImage: "star")
                            }
                            .buttonStyle(HistoryActionButtonStyle())
                        }
                        if let onRepeat {
                            Button(action: onRepeat) {
                                Label("Repeat", systemImage: "arrow.clockwise")
                            }
                            .buttonStyle(HistoryActionButtonStyle())
                        }
                    }
                    .padding(.top, 6)
                }
            }
        }
    }
}

struct HistoryActionButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.caption.weight(.semibold))
            .foregroundColor(MacroMeshTheme.primaryDark)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(MacroMeshTheme.cardSubtle.opacity(configuration.isPressed ? 0.65 : 1))
            .clipShape(Capsule())
    }
}

struct HistoryMacroChip: View {
    let label: String
    let value: Int
    let color: Color
    var body: some View {
        HStack(spacing: 4) {
            Text(label)
                .font(.caption2.weight(.bold))
            Text("\(value)g")
                .font(.caption2)
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 4)
        .background(color.opacity(0.14))
        .clipShape(Capsule())
        .foregroundColor(color)
    }
}
