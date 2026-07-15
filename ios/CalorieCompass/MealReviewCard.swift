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
    var matchType: String?
    var matchedQuery: String?
    var originalUserText: String?
    var providerUsed: String?
    var usedAiFallback: Bool?
    var userQuantity: Double?
    var userUnit: String?
    var userTextSpan: String?
    var normalizedGrams: Double?
    var normalizedOunces: Double?
    var sourceID: String?
    var providerCandidateID: String?
    var confidenceScore: Double?
    var requestedModifiers: [String] = []
    var modifierResolution: String?
    var reviewStatus: String?
    var nutritionBasis: MealNutritionBasis?

    init(from item: MealRequestItem) {
        name = item.food_name
        quantity = item.quantity
        unit = ServingUnitFormatter.clean(item.unit)
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
        matchType = item.match_type
        matchedQuery = item.matched_query
        originalUserText = item.original_user_text
        providerUsed = item.provider_used
        usedAiFallback = item.used_ai_fallback
        userQuantity = item.userQuantity
        userUnit = item.userUnit
        userTextSpan = item.userTextSpan
        normalizedGrams = item.normalizedGrams
        normalizedOunces = item.normalizedOunces
        sourceID = item.sourceId
        providerCandidateID = item.providerCandidateId
        confidenceScore = item.confidence
        requestedModifiers = item.requested_modifiers ?? []
        modifierResolution = item.modifier_resolution
        reviewStatus = item.review_status
        nutritionBasis = item.nutrition_basis
    }

    mutating func applyServing(quantity nextQuantity: Double, unit nextUnit: String? = nil) {
        let safeQuantity = max(0.01, nextQuantity)
        let currentQuantity = max(0.01, quantity)
        let currentUnit = ServingUnitFormatter.clean(unit)
        let requestedUnit = ServingUnitFormatter.clean(nextUnit ?? unit)

        if let basis = nutritionBasis,
           let scaleFactor = Self.scaleFactor(
               quantity: safeQuantity,
               unit: requestedUnit,
               currentQuantity: currentQuantity,
               currentUnit: currentUnit,
               basis: basis
           ) {
            quantity = rounded(safeQuantity)
            unit = requestedUnit
            calories = rounded(basis.base_nutrition.calories * scaleFactor)
            protein = rounded(basis.base_nutrition.protein * scaleFactor)
            carbs = rounded(basis.base_nutrition.carbs * scaleFactor)
            fat = rounded(basis.base_nutrition.fat * scaleFactor)
            fiber = rounded(basis.base_nutrition.fiber * scaleFactor)
            sugar = rounded(basis.base_nutrition.sugar * scaleFactor)
            sodium = rounded(basis.base_nutrition.sodium * scaleFactor)
            nutritionBasis?.scale_factor = scaleFactor
            userQuantity = safeQuantity
            userUnit = requestedUnit
            return
        }

        // Never relabel a serving when the conversion cannot be proven.
        guard requestedUnit == currentUnit else { return }
        let factor = safeQuantity / currentQuantity
        quantity = rounded(safeQuantity)
        unit = requestedUnit
        calories = rounded(calories * factor)
        protein = rounded(protein * factor)
        carbs = rounded(carbs * factor)
        fat = rounded(fat * factor)
        fiber = rounded(fiber * factor)
        sugar = rounded(sugar * factor)
        sodium = rounded(sodium * factor)
    }

    func asMealRequestItem() -> MealRequestItem {
        MealRequestItem(
            food_name: name,
            quantity: quantity,
            unit: ServingUnitFormatter.clean(unit),
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
            catalog_food_id: catalogFoodID,
            match_type: matchType,
            matched_query: matchedQuery,
            original_user_text: originalUserText,
            provider_used: providerUsed,
            used_ai_fallback: usedAiFallback,
            userQuantity: userQuantity,
            userUnit: userUnit,
            userTextSpan: userTextSpan,
            normalizedGrams: normalizedGrams,
            normalizedOunces: normalizedOunces,
            sourceId: sourceID,
            providerCandidateId: providerCandidateID,
            confidence: confidenceScore,
            requested_modifiers: requestedModifiers,
            modifier_resolution: modifierResolution,
            review_status: reviewStatus,
            nutrition_basis: nutritionBasis
        )
    }

    private static func scaleFactor(
        quantity: Double,
        unit: String,
        currentQuantity: Double,
        currentUnit: String,
        basis: MealNutritionBasis
    ) -> Double? {
        let providerQuantity = basis.provider_quantity
        guard providerQuantity > 0 else { return nil }
        let providerUnit = ServingUnitFormatter.clean(basis.provider_unit)

        if unit == currentUnit, basis.scale_factor > 0 {
            return basis.scale_factor * quantity / currentQuantity
        }
        if unit == providerUnit {
            return quantity / providerQuantity
        }

        let requestedGrams: Double?
        switch unit {
        case "g": requestedGrams = quantity
        case "oz": requestedGrams = quantity * 28.3495
        default: requestedGrams = nil
        }
        guard let requestedGrams else { return nil }

        if providerUnit == "g" {
            return requestedGrams / providerQuantity
        }
        if providerUnit == "oz" {
            return requestedGrams / (providerQuantity * 28.3495)
        }
        if let providerWeight = basis.provider_weight_grams, providerWeight > 0 {
            return requestedGrams / (providerQuantity * providerWeight)
        }
        return nil
    }

    private func rounded(_ value: Double) -> Double {
        (value * 100).rounded() / 100
    }
}

enum ServingUnitFormatter {
    static func clean(_ unit: String) -> String {
        let cleaned = unit.trimmingCharacters(in: .whitespacesAndNewlines).lowercased().replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        if cleaned.isEmpty { return "serving" }
        if cleaned.range(of: #"^\d+(?:\.\d+)?\s+1\s+onz$"#, options: .regularExpression) != nil { return "oz" }
        if cleaned.range(of: #"^\d+(?:\.\d+)?\s+g(?:ram|rams)?$"#, options: .regularExpression) != nil { return "g" }
        switch cleaned {
        case "ounces", "ounce", "onz", "1 onz": return "oz"
        case "grams", "gram", "gms": return "g"
        case "cups": return "cup"
        case "servings": return "serving"
        case "bars": return "bar"
        case "bottles": return "bottle"
        case "bowls": return "bowl"
        case "packs", "packets": return "pack"
        default: return cleaned
        }
    }
}

struct FoodTrustPresentation: Equatable {
    enum Tone: Equatable {
        case trusted
        case review
    }

    let badge: String
    let explanation: String
    let systemImage: String
    let tone: Tone

    static func build(
        sourceType: String?,
        sourceName: String?,
        providerUsed: String? = nil,
        matchType: String? = nil,
        usedAiFallback: Bool? = nil,
        isTrusted: Bool? = nil,
        reviewStatus: String? = nil,
        modifierResolution: String? = nil,
        sourceLabel: String? = nil
    ) -> FoodTrustPresentation {
        let type = normalized(sourceType)
        let source = normalized(sourceName)
        let provider = normalized(providerUsed)
        let match = normalized(matchType)
        let label = normalized(sourceLabel)
        let modifierNeedsReview = modifierResolution == "unresolved" || modifierResolution == "estimated"
        let needsReview = reviewStatus == "required"
            || isTrusted == false
            || usedAiFallback == true
            || type.contains("ai")
            || modifierNeedsReview

        if needsReview {
            if modifierNeedsReview {
                return .init(
                    badge: "Needs Review",
                    explanation: "Base nutrition was found, but the requested changes still need your review.",
                    systemImage: "exclamationmark.circle.fill",
                    tone: .review
                )
            }
            if type.contains("ai") || usedAiFallback == true {
                return .init(
                    badge: "Estimated",
                    explanation: "Estimated because no exact database entry was available. Check the serving and nutrition.",
                    systemImage: "sparkles",
                    tone: .review
                )
            }
            return .init(
                badge: "Needs Review",
                explanation: "The identity or serving is uncertain. Check it before saving.",
                systemImage: "exclamationmark.circle.fill",
                tone: .review
            )
        }

        if match.contains("barcode") {
            return .init(
                badge: "Barcode Match",
                explanation: "Matched to the product barcode. Confirm the package serving before saving.",
                systemImage: "barcode.viewfinder",
                tone: .trusted
            )
        }
        if label == "favorite" || label == "recent" || label == "custom" || source.contains("custom food") {
            return .init(
                badge: label == "custom" || source.contains("custom food") ? "Your Food" : "Previously Logged",
                explanation: "Loaded from nutrition you previously confirmed.",
                systemImage: label == "custom" ? "person.crop.circle.fill" : "clock.arrow.circlepath",
                tone: .trusted
            )
        }
        if type.contains("official_restaurant") {
            return .init(
                badge: "Restaurant Match",
                explanation: modifierResolution == "deterministic_database"
                    ? "Matched to official restaurant nutrition with supported adjustments."
                    : "Matched to an exact item from official restaurant nutrition.",
                systemImage: "fork.knife.circle.fill",
                tone: .trusted
            )
        }
        if type.contains("usda") || provider.contains("usda") || source.contains("fooddata central") {
            return .init(
                badge: "USDA Match",
                explanation: "Matched to a USDA generic food and serving.",
                systemImage: "leaf.circle.fill",
                tone: .trusted
            )
        }
        if provider.contains("open food facts") || provider.contains("open-food-facts") || source.contains("community") {
            return .init(
                badge: "Community Product",
                explanation: "Matched to a community product record. Compare it with the package label.",
                systemImage: "person.2.circle.fill",
                tone: .trusted
            )
        }
        if type.contains("brand") || label.contains("brand") || (!source.isEmpty && !source.contains("generic")) {
            return .init(
                badge: "Branded Product",
                explanation: "Matched by brand and product identity from a nutrition database.",
                systemImage: "checkmark.seal.fill",
                tone: .trusted
            )
        }
        if type.contains("generic_reference") || source.contains("generic") {
            return .init(
                badge: "Structured Match",
                explanation: "Matched to a structured generic food reference. Check the serving for your meal.",
                systemImage: "checkmark.circle.fill",
                tone: .trusted
            )
        }
        if isTrusted == true {
            return .init(
                badge: "Database Match",
                explanation: "Matched to structured nutrition data. Check the serving before saving.",
                systemImage: "checkmark.circle.fill",
                tone: .trusted
            )
        }
        return .init(
            badge: "Review",
            explanation: "Check the food identity, serving, and nutrition before saving.",
            systemImage: "eye.circle.fill",
            tone: .review
        )
    }

    private static func normalized(_ value: String?) -> String {
        value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
    }
}

struct FoodTrustBadge: View {
    let presentation: FoodTrustPresentation

    private var tint: Color {
        presentation.tone == .review ? MacroMeshTheme.orange : MacroMeshTheme.primary
    }

    var body: some View {
        Label(presentation.badge, systemImage: presentation.systemImage)
            .font(.caption2.weight(.bold))
            .foregroundColor(tint)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(tint.opacity(0.11))
            .clipShape(Capsule())
            .fixedSize(horizontal: true, vertical: false)
    }
}

struct MealReviewCard: View {
    static let reviewTitle = "Review meal"

    @Binding var items: [MealItem]
    @Binding var showCard: Bool
    @State private var isSaving = false
    @State private var error: String?
    var isSavingExternally = false
    var onConfirm: ([MealItem]) -> Void
    var onCancel: () -> Void

    private var totalCalories: Double { items.reduce(0) { $0 + $1.calories } }
    private var totalProtein: Double { items.reduce(0) { $0 + $1.protein } }
    private var totalCarbs: Double { items.reduce(0) { $0 + $1.carbs } }
    private var totalFat: Double { items.reduce(0) { $0 + $1.fat } }
    private var trustedCount: Int {
        items.filter {
            $0.reviewStatus != "required"
                && $0.modifierResolution != "unresolved"
                && $0.modifierResolution != "estimated"
                && (($0.isTrusted ?? false) || ($0.confidence ?? "").localizedCaseInsensitiveContains("high"))
        }.count
    }

    var body: some View {
        if !showCard {
            EmptyView()
        } else {
            AppCard(padding: 12) {
                VStack(alignment: .leading, spacing: 11) {
                    HStack(alignment: .top, spacing: 12) {
                        Image(systemName: "checkmark.seal.fill")
                            .font(.subheadline.weight(.bold))
                            .foregroundColor(MacroMeshTheme.primary)
                            .frame(width: 32, height: 32)
                            .background(MacroMeshTheme.primary.opacity(0.12))
                            .clipShape(Circle())
                        VStack(alignment: .leading, spacing: 4) {
                            Text(Self.reviewTitle)
                                .font(.headline.weight(.bold))
                                .foregroundColor(MacroMeshTheme.text)
                                .lineLimit(1)
                                .minimumScaleFactor(0.85)
                            Text("Check serving sizes and confidence. Nothing is saved until you confirm.")
                                .font(.caption2)
                                .foregroundColor(MacroMeshTheme.muted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        Spacer()
                        Text("\(Int(totalCalories)) cal")
                            .font(.title3.weight(.semibold))
                            .foregroundColor(MacroMeshTheme.primary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.82)
                    }

                    HStack(spacing: 6) {
                        ReviewMacroPill(label: "Protein", value: totalProtein)
                        ReviewMacroPill(label: "Carbs", value: totalCarbs)
                        ReviewMacroPill(label: "Fat", value: totalFat)
                    }

                    VStack(spacing: 9) {
                        ForEach(items.indices, id: \.self) { idx in
                            let trust = FoodTrustPresentation.build(
                                sourceType: items[idx].sourceType,
                                sourceName: items[idx].source,
                                providerUsed: items[idx].providerUsed,
                                matchType: items[idx].matchType,
                                usedAiFallback: items[idx].usedAiFallback,
                                isTrusted: items[idx].isTrusted,
                                reviewStatus: items[idx].reviewStatus,
                                modifierResolution: items[idx].modifierResolution
                            )
                            HStack(alignment: .top, spacing: 10) {
                                FoodAvatar(name: items[idx].name)
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(items[idx].name)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundColor(MacroMeshTheme.text)
                                        .lineLimit(3)
                                        .fixedSize(horizontal: false, vertical: true)
                                    Text(servingText(for: items[idx]))
                                        .font(.caption)
                                        .foregroundColor(MacroMeshTheme.muted)
                                    HStack(spacing: 6) {
                                        FoodTrustBadge(presentation: trust)
                                        Text("\(Int(items[idx].calories)) cal")
                                            .font(.caption.weight(.semibold))
                                            .foregroundColor(MacroMeshTheme.primaryDark)
                                    }
                                    Text(trust.explanation)
                                        .font(.caption2)
                                        .foregroundColor(MacroMeshTheme.muted)
                                        .fixedSize(horizontal: false, vertical: true)
                                        .accessibilityLabel("\(trust.badge). \(trust.explanation)")
                                    if !items[idx].requestedModifiers.isEmpty {
                                        Text("Requested: \(items[idx].requestedModifiers.joined(separator: ", "))")
                                            .font(.caption2)
                                            .foregroundColor(MacroMeshTheme.orange)
                                            .fixedSize(horizontal: false, vertical: true)
                                    }
                                    ServingAdjuster(item: $items[idx])
                                }
                                Spacer()
                                Button {
                                    items.remove(at: idx)
                                } label: {
                                    Image(systemName: "xmark")
                                        .font(.caption.weight(.bold))
                                        .foregroundColor(Color.red.opacity(0.78))
                                        .frame(width: 28, height: 28)
                                        .background(Color.red.opacity(0.08))
                                        .clipShape(Circle())
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Remove \(items[idx].name)")
                            }
                            .padding(11)
                            .background(MacroMeshTheme.card.opacity(0.92))
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
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
                            if isSaving || isSavingExternally { ProgressView().tint(.white) } else { Text("Save meal") }
                        }
                        .buttonStyle(PrimaryCTAButtonStyle())
                        .disabled(isSaving || isSavingExternally || items.isEmpty)
                    }
                }
                .accessibilityElement(children: .contain)
            }
        }
    }

    private func saveMeal() {
        guard !isSaving, !isSavingExternally, !items.isEmpty else { return }
        isSaving = true
        error = nil
        onConfirm(items)
        isSaving = false
    }

    private func servingText(for item: MealItem) -> String {
        let quantity = item.quantity == floor(item.quantity) ? String(Int(item.quantity)) : String(format: "%.1f", item.quantity)
        let unit = ServingUnitFormatter.clean(item.unit)
        if unit == "serving", item.quantity >= 50 {
            return "Serving: \(quantity) g"
        }
        return unit.isEmpty ? "Serving: \(quantity)" : "Serving: \(quantity) \(unit)"
    }
}

struct ServingAdjuster: View {
    @Binding var item: MealItem
    @State private var unitDraft: String = ""

    var body: some View {
        HStack(spacing: 6) {
            Button {
                item.applyServing(quantity: item.quantity - stepSize)
            } label: {
                Image(systemName: "minus")
                    .font(.caption.weight(.bold))
                    .frame(width: 28, height: 28)
                    .background(MacroMeshTheme.primary.opacity(0.12))
                    .clipShape(Circle())
            }
            .disabled(item.quantity <= stepSize)
            .accessibilityLabel("Decrease \(item.name) serving")

            Text(quantityLabel)
                .font(.caption.weight(.semibold))
                .foregroundColor(MacroMeshTheme.primaryDark)
                .frame(minWidth: 34)
                .padding(.horizontal, 7)
                .padding(.vertical, 6)
                .background(MacroMeshTheme.cardSubtle.opacity(0.8))
                .clipShape(Capsule())

            Button {
                item.applyServing(quantity: item.quantity + stepSize)
            } label: {
                Image(systemName: "plus")
                    .font(.caption.weight(.bold))
                    .frame(width: 28, height: 28)
                    .background(MacroMeshTheme.primary.opacity(0.12))
                    .clipShape(Circle())
            }
            .accessibilityLabel("Increase \(item.name) serving")

            TextField("Unit", text: $unitDraft)
                .font(.caption)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .frame(width: 82)
                .background(MacroMeshTheme.card)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(MacroMeshTheme.border, lineWidth: 1)
                )
                .onSubmit {
                    item.applyServing(quantity: item.quantity, unit: unitDraft)
                    unitDraft = item.unit
                }
                .onAppear {
                    if ServingUnitFormatter.clean(item.unit) == "serving", item.quantity >= 50 {
                        unitDraft = "g"
                    } else {
                        unitDraft = item.unit
                    }
                }
        }
        .foregroundColor(MacroMeshTheme.primary)
    }

    private var stepSize: Double {
        item.quantity < 1 ? 0.25 : 0.5
    }

    private var quantityLabel: String {
        guard item.quantity != floor(item.quantity) else { return String(Int(item.quantity)) }
        return String(format: "%.2f", item.quantity)
            .replacingOccurrences(of: "0+$", with: "", options: .regularExpression)
            .replacingOccurrences(of: "\\.$", with: "", options: .regularExpression)
    }
}

struct SourceBadge: View {
    let sourceType: String?
    let sourceName: String?
    let modifierResolution: String?

    init(sourceType: String?, sourceName: String?, modifierResolution: String? = nil) {
        self.sourceType = sourceType
        self.sourceName = sourceName
        self.modifierResolution = modifierResolution
    }

    var body: some View {
        if let label = displayLabel {
            Text(label)
                .font(.caption2.weight(.bold))
                .foregroundColor(tint)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(tint.opacity(0.10))
                .clipShape(Capsule())
        }
    }

    private var tint: Color {
        let normalizedType = sourceType?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() ?? ""
        if normalizedType.contains("AI") { return MacroMeshTheme.orange }
        return MacroMeshTheme.primary
    }

    private var displayLabel: String? {
        Self.label(sourceType: sourceType, sourceName: sourceName, modifierResolution: modifierResolution)
    }

    static func label(sourceType: String?, sourceName: String?, modifierResolution: String? = nil) -> String? {
        let normalizedType = sourceType?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() ?? ""
        if normalizedType.contains("USDA") { return "USDA match" }
        if normalizedType.contains("OFFICIAL_RESTAURANT") {
            if modifierResolution == "unresolved" || modifierResolution == "estimated" { return "Official base nutrition" }
            if modifierResolution == "deterministic_database" { return "Official adjusted nutrition" }
            return "Restaurant verified"
        }
        if normalizedType.contains("BRAND") { return "Brand verified" }
        if normalizedType.contains("GENERIC_REFERENCE") {
            if modifierResolution == "unresolved" || modifierResolution == "estimated" { return "Structured base nutrition" }
            return "Generic reference"
        }
        if normalizedType.contains("AI") { return "AI estimate" }

        if let name = sourceName?.trimmingCharacters(in: .whitespacesAndNewlines), !name.isEmpty {
            if name.localizedCaseInsensitiveContains("FoodData Central") { return "USDA match" }
            if name.localizedCaseInsensitiveContains("common serving") || name.localizedCaseInsensitiveContains("generic") { return "Generic fallback" }
            return name
        }

        return nil
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
            .font(.subheadline.weight(.semibold))
            .foregroundColor(MacroMeshTheme.primary)
            .frame(width: 34, height: 34)
            .background(MacroMeshTheme.cardSubtle)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct ConfidenceBadge: View {
    let label: String?
    let isTrusted: Bool?
    let reviewStatus: String?

    init(label: String?, isTrusted: Bool?, reviewStatus: String? = nil) {
        self.label = label
        self.isTrusted = isTrusted
        self.reviewStatus = reviewStatus
    }

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
        Self.label(label: label, isTrusted: isTrusted, reviewStatus: reviewStatus)
    }

    static func label(label: String?, isTrusted: Bool?, reviewStatus: String? = nil) -> String {
        if reviewStatus == "required" { return "Review" }
        if let label, !label.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            if label == "Needs Review" || label == "Estimated" { return "Review" }
            return label
        }
        return isTrusted == false ? "Review" : "High confidence"
    }
}

struct ReviewMacroPill: View {
    let label: String
    let value: Double

    var body: some View {
        VStack(spacing: 2) {
            Text("\(Int(value))g")
                .font(.subheadline.weight(.bold))
            Text(label)
                .font(.caption2)
        }
        .foregroundColor(MacroMeshTheme.primaryDark)
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity)
        .background(MacroMeshTheme.cardSubtle.opacity(0.82))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private enum MealReviewPreviewFixtures {
    static let chickFilA = MealItem(from: MealRequestItem(
        food_name: "Chick-fil-A Chicken Sandwich",
        quantity: 1,
        unit: "sandwich",
        calories: 420,
        protein: 29,
        carbs: 41,
        fat: 18,
        fiber: 2,
        sugar: 6,
        sodium: 1460,
        notes: "Matched to trusted restaurant catalog entry.",
        source_type: "OFFICIAL_RESTAURANT",
        source_name: "Chick-fil-A official nutrition",
        confidence_label: "Verified",
        is_trusted: true,
        catalog_food_id: "chickfila_sandwich"
    ))

    static let longSubway = MealItem(from: MealRequestItem(
        food_name: "SUBWAY Meatball Marinara 6-Inch on white bread with lettuce and tomato",
        quantity: 100,
        unit: "g",
        calories: 220,
        protein: 10,
        carbs: 27,
        fat: 10,
        fiber: 3,
        sugar: 4,
        sodium: 565,
        notes: "Scaled from the restaurant serving.",
        source_type: "OFFICIAL_RESTAURANT",
        source_name: "Subway official nutrition",
        confidence_label: "Verified",
        is_trusted: true,
        catalog_food_id: "subway_meatball_marinara_6in"
    ))
}

#Preview("Meal Review") {
    MacroMeshScreen {
        ScrollView {
            MealReviewCard(
                items: .constant([MealReviewPreviewFixtures.chickFilA]),
                showCard: .constant(true),
                onConfirm: { _ in },
                onCancel: {}
            )
            .padding()
        }
    }
}

#Preview("Long Restaurant Item") {
    MacroMeshScreen {
        ScrollView {
            MealReviewCard(
                items: .constant([MealReviewPreviewFixtures.longSubway]),
                showCard: .constant(true),
                onConfirm: { _ in },
                onCancel: {}
            )
            .padding()
        }
    }
    .previewDevice("iPhone SE (3rd generation)")
}
