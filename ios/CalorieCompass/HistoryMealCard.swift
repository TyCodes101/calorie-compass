import Foundation
import SwiftUI

struct HistoryMealCardModel: Equatable {
    let title: String
    let caloriesText: String
    let subtitleText: String
    let macroLineText: String
    let confidenceText: String

    static func build(meal: MealResponse) -> HistoryMealCardModel {
        let title = meal.displayTitle
        let caloriesText = "\(Int(meal.safeTotalCalories))"

        let subtitleText = "\(meal.displayMealType) • \(meal.displayDate)"
        let macroLineText = "P \(Int(meal.safeTotalProtein))g  •  C \(Int(meal.safeTotalCarbs))g  •  F \(Int(meal.safeTotalFat))g"

        let confidence = meal.confidenceScore.map { Int($0 * 100) } ?? 0
        let coverage = meal.coverageSummary?.nilIfBlank
        let confidenceBits = [
            confidence > 0 ? "\(confidence)%" : nil,
            coverage
        ].compactMap { $0 }

        let confidenceText = confidenceBits.isEmpty ? "Estimated" : "Estimated • \(confidenceBits.joined(separator: " • "))"

        return HistoryMealCardModel(
            title: title,
            caloriesText: caloriesText,
            subtitleText: subtitleText,
            macroLineText: macroLineText,
            confidenceText: confidenceText
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
                        .lineLimit(1)

                    Spacer(minLength: 10)

                    Text("\(model.caloriesText) cal")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(MacroMeshTheme.text)
                        .accessibilityLabel("\(model.caloriesText) calories")
                }

                Text(model.subtitleText)
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.muted)

                Text(model.macroLineText)
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.muted)

                HStack(alignment: .center, spacing: 8) {
                    Text(model.confidenceText)
                        .font(.caption2)
                        .foregroundColor(MacroMeshTheme.muted)
                        .lineLimit(1)

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
                                    Label("Repeat today", systemImage: "arrow.clockwise")
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
