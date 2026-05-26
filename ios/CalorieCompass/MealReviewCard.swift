// MealReviewCard.swift
// CalorieCompass native iOS
//
// Phase 2B: Review-before-save card for meal confirmation, editing, removal
//
import SwiftUI

struct MealItem: Identifiable, Codable, Equatable {
    let id = UUID()
    var name: String
    var quantity: Double
    var unit: String
    var calories: Double
    var protein: Double
    var carbs: Double
    var fat: Double
    var confidence: String?
    var source: String?
}

struct MealReviewCard: View {
    @Binding var items: [MealItem]
    @Binding var showCard: Bool
    @State private var isSaving = false
    @State private var error: String?
    @FocusState private var editingMealItem: Bool
    var onConfirm: ([MealItem]) -> Void
    var onCancel: () -> Void
    
    var body: some View {
        if !showCard { EmptyView() } else {
            VStack(spacing: 16) {
                Text("Review your meal before saving")
                    .font(.headline)
                    .accessibilityAddTraits(.isHeader)
                ForEach(items.indices, id: \ .self) { idx in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(items[idx].name)
                                .font(.subheadline).bold()
                            Spacer()
                            if let c = items[idx].confidence { Text(c).font(.footnote).foregroundColor(.gray) }
                            if let s = items[idx].source { Text(s).font(.footnote).foregroundColor(.gray) }
                        }
                        HStack(spacing: 12) {
                            Text("Qty: \(items[idx].quantity, specifier: "%.0f") \(items[idx].unit)")
                            Text("Cal: \(Int(items[idx].calories))")
                            Text("Prot: \(Int(items[idx].protein))g")
                            Text("Carb: \(Int(items[idx].carbs))g")
                            Text("Fat: \(Int(items[idx].fat))g")
                        }.font(.caption)
                        HStack {
                            Button("Remove") {
                                items.remove(at: idx)
                            }
                            .foregroundColor(.red)
                            .font(.footnote)
                            .accessibilityLabel("Remove \(items[idx].name)")
                        }
                    }
                    .padding(8).background(Color(.secondarySystemBackground)).cornerRadius(8)
                    .accessibilityElement(children: .combine)
                }
                if let error = error { Text(error).foregroundColor(.red) }
                HStack {
                    Button("Cancel") {
                        onCancel()
                    }.foregroundColor(.gray)
                    Spacer()
                    Button(action: saveMeal) {
                        if isSaving { ProgressView() } else { Text("Confirm & Save") }
                    }
                    .disabled(isSaving || items.isEmpty)
                    .accessibilityLabel("Confirm and save reviewed meal")
                    .accessibilityHint("Saves this meal only after review.")
                }
            }
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(14)
            .shadow(radius: 10)
            .padding(.horizontal, 20)
            .accessibilityElement(children: .contain)
        }
    }

    private func saveMeal() {
        guard !isSaving, !items.isEmpty else { return }
        isSaving = true
        error = nil
        // For owner context: actual BackendService integration in parent view
        onConfirm(items)
        isSaving = false
    }
}
