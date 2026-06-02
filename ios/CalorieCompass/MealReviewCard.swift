// MealReviewCard.swift
// CalorieCompass native iOS
//
// Phase 2B: Review-before-save card for meal confirmation, editing, removal
//
import SwiftUI

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
    static let reviewTitle = "Review meal"

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
    private var trustedCount: Int { items.filter { ($0.isTrusted ?? false) || ($0.confidence ?? "").localizedCaseInsensitiveContains("high") }.count }

    var body: some View {
        if !showCard {
            EmptyView()
        } else {
            AppCard(padding: 18) {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(alignment: .top, spacing: 14) {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.title2)
                            .foregroundColor(MacroMeshTheme.primary)
                            .frame(width: 42, height: 42)
                            .background(MacroMeshTheme.primary.opacity(0.12))
                            .clipShape(Circle())
                        VStack(alignment: .leading, spacing: 4) {
                            Text(Self.reviewTitle)
                                .font(.title3.weight(.bold))
                                .foregroundColor(MacroMeshTheme.text)
                                .lineLimit(1)
                                .minimumScaleFactor(0.85)
                            Text("Check serving sizes and confidence. Nothing is saved until you confirm.")
                                .font(.caption)
                                .foregroundColor(MacroMeshTheme.muted)
                        }
                        Spacer()
                        Text("\(Int(totalCalories)) cal")
                            .font(.headline)
                            .foregroundColor(MacroMeshTheme.primary)
                    }

                    HStack(spacing: 8) {
                        ReviewMacroPill(label: "Protein", value: totalProtein)
                        ReviewMacroPill(label: "Carbs", value: totalCarbs)
                        ReviewMacroPill(label: "Fat", value: totalFat)
                    }

                    VStack(spacing: 10) {
                        ForEach(items.indices, id: \.self) { idx in
                            HStack(alignment: .top, spacing: 12) {
                                FoodAvatar(name: items[idx].name)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(items[idx].name)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundColor(MacroMeshTheme.text)
                                    Text(servingText(for: items[idx]))
                                        .font(.caption)
                                        .foregroundColor(MacroMeshTheme.muted)
                                    HStack(spacing: 6) {
                                        ConfidenceBadge(label: items[idx].confidence, isTrusted: items[idx].isTrusted)
                                        Text("\(Int(items[idx].calories)) cal")
                                            .font(.caption.weight(.semibold))
                                            .foregroundColor(MacroMeshTheme.primaryDark)
                                    }
                                    if let source = items[idx].source?.trimmingCharacters(in: .whitespacesAndNewlines), !source.isEmpty {
                                        Text("Source: \(source)")
                                            .font(.caption2)
                                            .foregroundColor(MacroMeshTheme.muted)
                                            .lineLimit(2)
                                    }
                                }
                                Spacer()
                                Button(role: .destructive) {
                                    items.remove(at: idx)
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                }
                                .accessibilityLabel("Remove \(items[idx].name)")
                            }
                            .padding(12)
                            .background(Color.white.opacity(0.86))
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .stroke(MacroMeshTheme.border, lineWidth: 1)
                            )
                        }
                    }

                    Text(items.isEmpty ? "No items left in this draft." : "\(trustedCount) of \(items.count) items matched with high-confidence or trusted nutrition data.")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)

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

    private func servingText(for item: MealItem) -> String {
        let quantity = item.quantity == floor(item.quantity) ? String(Int(item.quantity)) : String(format: "%.1f", item.quantity)
        let unit = item.unit.trimmingCharacters(in: .whitespacesAndNewlines)
        return unit.isEmpty ? "Serving: \(quantity)" : "Serving: \(quantity) \(unit)"
    }
}

struct FoodAvatar: View {
    let name: String

    private var symbol: String {
        let lower = name.lowercased()
        if lower.contains("drink") || lower.contains("shake") || lower.contains("coffee") { return "takeoutbag.and.cup.and.straw.fill" }
        if lower.contains("bar") || lower.contains("pack") || lower.contains("chips") { return "bag.fill" }
        return "fork.knife.circle.fill"
    }

    var body: some View {
        Image(systemName: symbol)
            .font(.headline)
            .foregroundColor(MacroMeshTheme.primary)
            .frame(width: 38, height: 38)
            .background(MacroMeshTheme.cardSubtle)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct ConfidenceBadge: View {
    let label: String?
    let isTrusted: Bool?

    var body: some View {
        Text(display)
            .font(.caption2.weight(.bold))
            .foregroundColor(isTrusted == false ? MacroMeshTheme.orange : MacroMeshTheme.primary)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background((isTrusted == false ? MacroMeshTheme.orange : MacroMeshTheme.primary).opacity(0.12))
            .clipShape(Capsule())
    }

    private var display: String {
        if let label, !label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return label
        }
        return isTrusted == false ? "Estimated" : "High confidence"
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
