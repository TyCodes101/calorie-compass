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
            confidence_label: confidence
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
            AppCard(padding: 18) {
                VStack(alignment: .leading, spacing: 16) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Review before saving")
                                .font(.title3.weight(.bold))
                                .foregroundColor(MacroMeshTheme.text)
                            Text("Nothing is saved until you confirm.")
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
                            HStack(alignment: .top, spacing: 10) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(items[idx].name)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundColor(MacroMeshTheme.text)
                                    Text("\(items[idx].quantity, specifier: "%.0f") \(items[idx].unit) · \(Int(items[idx].calories)) cal")
                                        .font(.caption)
                                        .foregroundColor(MacroMeshTheme.muted)
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
                            .background(MacroMeshTheme.cardSubtle.opacity(0.7))
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
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
