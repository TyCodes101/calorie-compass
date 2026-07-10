import Foundation
import SwiftUI

struct HistoryMealCardModel: Equatable {
    let title: String
    let caloriesText: String
    let subtitleText: String
    let macroLineText: String?
    let trustBadgeText: String

    let isZeroCalorie: Bool

    static func build(meal: MealResponse) -> HistoryMealCardModel {
        let title = meal.displayTitle
        let caloriesValue = Int(meal.safeTotalCalories)
        let caloriesText = "\(caloriesValue)"

        let subtitleText = "\(meal.displayMealType) • \(meal.displayDate)"

        let macros = (Int(meal.safeTotalProtein), Int(meal.safeTotalCarbs), Int(meal.safeTotalFat))
        let macroLineText: String? = {
            guard caloriesValue > 0 || macros.0 > 0 || macros.1 > 0 || macros.2 > 0 else { return nil }
            return "P \(macros.0)g  •  C \(macros.1)g  •  F \(macros.2)g"
        }()

        let trustBadgeText = MealTrustBadgeBuilder.badgeText(meal: meal)
        let isZero = caloriesValue == 0 && (macros.0 + macros.1 + macros.2) == 0

        return HistoryMealCardModel(
            title: title,
            caloriesText: caloriesText,
            subtitleText: subtitleText,
            macroLineText: macroLineText,
            trustBadgeText: trustBadgeText,
            isZeroCalorie: isZero
        )
    }
}

struct HistoryMealCard: View {
    let meal: MealResponse
    var onFavorite: (() -> Void)? = nil
    var onRepeat: (() -> Void)? = nil

    private var model: HistoryMealCardModel {
        HistoryMealCardModel.build(meal: meal)
    }

    var body: some View {
        AppCard(padding: 14) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(model.title)
                        .font(.headline.weight(.semibold))
                        .foregroundColor(MacroMeshTheme.text)
                        .lineLimit(2)
                        .truncationMode(.tail)

                    Spacer(minLength: 10)

                    Text("\(model.caloriesText) cal")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(MacroMeshTheme.text)
                        .accessibilityLabel("\(model.caloriesText) calories")
                }

                Text(model.subtitleText)
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.muted)

                if let macroLineText = model.macroLineText {
                    Text(macroLineText)
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                } else {
                    Text("This meal is missing nutrition details.")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }

                HStack(alignment: .center, spacing: 8) {
                    if !(model.isZeroCalorie && model.trustBadgeText == "Verified") {
                        Badge(model.trustBadgeText, color: MacroMeshTheme.primary)
                            .accessibilityLabel("Trust level \(model.trustBadgeText)")
                    }

                    if model.isZeroCalorie {
                        Badge("Needs review", color: MacroMeshTheme.orange)
                            .accessibilityLabel("Missing nutrition details")
                    }

                    Spacer(minLength: 0)

                    if onFavorite != nil || onRepeat != nil {
                        Menu {
                            if let onFavorite {
                                Button(action: onFavorite) {
                                    Label("Add to Favorites", systemImage: "star")
                                }
                            }
                            if let onRepeat {
                                Button(action: onRepeat) {
                                    Label("Log again", systemImage: "arrow.clockwise")
                                }
                            }
                        } label: {
                            Image(systemName: "ellipsis")
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(MacroMeshTheme.muted)
                                .padding(8)
                                .background(MacroMeshTheme.cardSubtle)
                                .clipShape(Circle())
                                .accessibilityLabel("Meal actions")
                        }
                    }
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityHint("Double tap for details. Use actions menu for favorites and repeat.")
    }
}

private enum MealTrustBadgeBuilder {
    static func badgeText(meal: MealResponse) -> String {
        let types = (meal.items ?? []).compactMap { $0.source_type?.uppercased() }
        let hasEstimated = types.contains(where: { $0.contains("AI") || $0.contains("ESTIMATE") })
            || (meal.items ?? []).contains(where: { ($0.confidence_label ?? "").localizedCaseInsensitiveContains("Needs Review") })
            || (meal.estimatedCount ?? 0) > 0
        let hasOfficial = types.contains(where: { $0.contains("OFFICIAL_RESTAURANT") })
        let hasStructured = types.contains(where: { $0.contains("USDA") || $0.contains("BRAND") })
        if hasEstimated && (hasOfficial || hasStructured || (meal.trustedCount ?? 0) > 0) { return "Mixed" }
        if hasEstimated { return "Estimated" }
        if hasOfficial { return "Restaurant" }
        if types.contains(where: { $0.contains("USDA") }) { return "USDA" }
        if types.contains(where: { $0.contains("BRAND") }) { return "Brand" }
        return "Verified"
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
