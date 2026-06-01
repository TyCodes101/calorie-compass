// MealReviewCard.swift
// CalorieCompass native iOS
//
// Phase 2B: Review-before-save card for meal confirmation, editing, removal
//
import SwiftUI

enum FoodDisplayFormatter {
    static func cleanName(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Food item" }

        let lower = trimmed.lowercased()
        if lower.contains("snickers") {
            return "Snickers Bar"
        }
        if lower.contains("skittles") {
            return lower.contains("sour") || lower.contains("sours") ? "Skittles Sour Candy" : "Skittles Candy"
        }
        if lower.contains("peanut"), lower.range(of: #"m\s*(?:&|/|\s)\s*m'?s?"#, options: .regularExpression) != nil {
            return "Peanut M&M's"
        }
        if lower.contains("sun chips") || (lower.contains("multigrain chips") && lower.contains("sun")) {
            return "Sun Chips Multigrain Chips"
        }

        var cleaned = trimmed
            .replacingOccurrences(of: #"^\d+(?:\.\d+)?\s*g\s+"#, with: "", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"^candies,\s*(?:mars snackfood us,\s*)?"#, with: "", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"mars snackfood us,?\s*"#, with: "", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"\s*\([^)]*\)\s*$"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if cleaned.isEmpty {
            cleaned = trimmed
        }

        return titleCaseFood(cleaned)
    }

    static func quantityText(_ quantity: Double) -> String {
        if quantity.rounded() == quantity {
            return "\(Int(quantity))"
        }
        return String(format: "%.1f", quantity)
    }

    static func servingText(quantity: Double, unit: String, foodName: String) -> String {
        let cleanUnit = unit.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanUnit.isEmpty else { return quantityText(quantity) }

        let lowerUnit = cleanUnit.lowercased()
        if lowerUnit == "g" || lowerUnit == "gram" || lowerUnit == "grams" {
            return "\(quantityText(quantity))g"
        }

        let singularUnit = lowerUnit.hasSuffix("s") && lowerUnit.count > 3 ? String(lowerUnit.dropLast()) : lowerUnit
        let displayUnit = quantity == 1 ? singularUnit : singularUnit + (singularUnit.hasSuffix("s") ? "" : "s")
        let cleanName = cleanName(foodName).lowercased()
        if cleanName.contains(singularUnit) && singularUnit != "serving" {
            return "\(quantityText(quantity)) \(FoodDisplayFormatter.cleanName(foodName))"
        }

        return "\(quantityText(quantity)) \(displayUnit)"
    }

    static func sourceSummary(confidence: String?, source: String?, sourceType: String?, isTrusted: Bool?) -> String? {
        let combined = [sourceType, source, confidence].compactMap { $0?.lowercased() }.joined(separator: " ")
        if isTrusted == true || combined.contains("official") || combined.contains("branded") {
            return "Verified source"
        }
        if combined.contains("high") || combined.contains("reference") || combined.contains("usda") || combined.contains("database") {
            return "Reference estimate"
        }
        if combined.contains("ai") || combined.contains("estimate") {
            return "Estimated"
        }
        return nil
    }

    private static func titleCaseFood(_ value: String) -> String {
        let preserved: [String: String] = [
            "m&m's": "M&M's",
            "m&ms": "M&M's",
            "usda": "USDA",
            "nfs": "NFS"
        ]
        return value
            .split(separator: " ")
            .map { word in
                let lower = word.lowercased()
                if let replacement = preserved[String(lower)] {
                    return replacement
                }
                return lower.prefix(1).uppercased() + String(lower.dropFirst())
            }
            .joined(separator: " ")
    }
}

struct MealItem: Identifiable, Codable, Equatable {
    var id = UUID()
    var name: String
    var quantity: Double
    var unit: String
    var calories: Double
    var protein: Double
    var carbs: Double
    var fat: Double
    var fiber: Double = 0
    var sugar: Double = 0
    var sodium: Double = 0
    var confidence: String?
    var source: String?
    var notes: String?
    var sourceType: String?
    var isTrusted: Bool?
    var catalogFoodID: String?
    var displayName: String { FoodDisplayFormatter.cleanName(name) }
    var displayServing: String { FoodDisplayFormatter.servingText(quantity: quantity, unit: unit, foodName: name) }
    var displaySource: String? {
        FoodDisplayFormatter.sourceSummary(confidence: confidence, source: source, sourceType: sourceType, isTrusted: isTrusted)
    }

    init(from item: MealRequestItem) {
        name = item.food_name
        quantity = item.quantity
        unit = item.unit
        calories = item.calories
        protein = item.protein
        carbs = item.carbs
        fat = item.fat
        fiber = item.fiber
        sugar = item.sugar
        sodium = item.sodium
        confidence = item.confidence_label
        source = item.source_name
        notes = item.notes
        sourceType = item.source_type
        isTrusted = item.is_trusted
        catalogFoodID = item.catalog_food_id
    }

    func asMealRequestItem() -> MealRequestItem {
        MealRequestItem(
            food_name: name,
            quantity: quantity,
            unit: unit,
            calories: calories,
            protein: protein,
            carbs: carbs,
            fat: fat,
            fiber: fiber,
            sugar: sugar,
            sodium: sodium,
            notes: notes,
            source_type: sourceType,
            source_name: source,
            confidence_label: confidence,
            is_trusted: isTrusted,
            catalog_food_id: catalogFoodID
        )
    }
}

struct MealReviewCard: View {
    @Binding var items: [MealItem]
    @Binding var showCard: Bool
    @State private var isSaving = false
    @State private var error: String?
    var onConfirm: ([MealItem]) -> Void
    var onCancel: () -> Void

    private var totalCalories: Double { items.reduce(0) { $0 + $1.calories } }
    private var totalProtein: Double { items.reduce(0) { $0 + $1.protein } }
    private var totalCarbs: Double { items.reduce(0) { $0 + $1.carbs } }
    private var totalFat: Double { items.reduce(0) { $0 + $1.fat } }

    var body: some View {
        if !showCard {
            EmptyView()
        } else {
            AppCard(padding: 16) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .center, spacing: 12) {
                        Image(systemName: "checklist.checked")
                            .font(.title3.weight(.semibold))
                            .foregroundColor(MacroMeshTheme.primary)
                            .frame(width: 34, height: 34)
                            .background(MacroMeshTheme.cardSubtle)
                            .clipShape(Circle())
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Review meal")
                                .font(.title3.weight(.bold))
                                .foregroundColor(MacroMeshTheme.text)
                            Text("Confirm before anything is saved.")
                                .font(.caption)
                                .foregroundColor(MacroMeshTheme.muted)
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("\(Int(totalCalories))")
                                .font(.title3.weight(.bold))
                                .foregroundColor(MacroMeshTheme.primary)
                            Text("cal")
                                .font(.caption2.weight(.semibold))
                                .foregroundColor(MacroMeshTheme.muted)
                        }
                    }

                    HStack(spacing: 8) {
                        ReviewMacroPill(label: "Protein", value: totalProtein)
                        ReviewMacroPill(label: "Carbs", value: totalCarbs)
                        ReviewMacroPill(label: "Fat", value: totalFat)
                    }

                    VStack(spacing: 8) {
                        ForEach(items.indices, id: \.self) { idx in
                            HStack(alignment: .top, spacing: 10) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(items[idx].displayName)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundColor(MacroMeshTheme.text)
                                        .lineLimit(2)
                                    Text("\(items[idx].displayServing) | \(Int(items[idx].calories)) cal")
                                        .font(.caption)
                                        .foregroundColor(MacroMeshTheme.muted)
                                    if let source = items[idx].displaySource {
                                        Text(source)
                                            .font(.caption2.weight(.medium))
                                            .foregroundColor(MacroMeshTheme.primaryDark.opacity(0.75))
                                    }
                                }
                                Spacer()
                                Button(role: .destructive) {
                                    items.remove(at: idx)
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                }
                                .accessibilityLabel("Remove \(items[idx].displayName)")
                            }
                            .padding(12)
                            .background(MacroMeshTheme.cardSubtle.opacity(0.78))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        }
                    }

                    if let error {
                        Text(error).font(.caption).foregroundColor(.red)
                    }

                    HStack(spacing: 12) {
                        Button("Cancel", action: onCancel)
                            .buttonStyle(SecondaryCTAButtonStyle())
                        Button(action: saveMeal) {
                            if isSaving { ProgressView().tint(.white) } else { Text("Save meal") }
                        }
                        .buttonStyle(PrimaryCTAButtonStyle())
                        .disabled(isSaving || items.isEmpty)
                    }
                }
                .accessibilityElement(children: .contain)
            }
        }
    }

    private func saveMeal() {
        guard !isSaving, !items.isEmpty else { return }
        isSaving = true
        error = nil
        onConfirm(items)
        isSaving = false
    }
}

struct ReviewMacroPill: View {
    let label: String
    let value: Double

    var body: some View {
        VStack(spacing: 2) {
            Text("\(Int(value))g")
                .font(.caption.weight(.bold))
            Text(label)
                .font(.caption2)
        }
        .foregroundColor(MacroMeshTheme.primaryDark)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity)
        .background(MacroMeshTheme.cardSubtle)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}
