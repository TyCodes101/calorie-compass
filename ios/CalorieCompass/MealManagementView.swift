// MealManagementView.swift
// Calorie Compass iOS — Phase 3C native meal management polish
import SwiftUI

extension Notification.Name {
    static let calorieCompassMealsDidChange = Notification.Name("calorieCompassMealsDidChange")
}

enum MealTypeOption: String, CaseIterable, Identifiable {
    case breakfast
    case lunch
    case dinner
    case snack

    var id: String { rawValue }
    var label: String { rawValue.capitalized }
}

struct MealDraftValidation: Equatable {
    let messages: [String]
    var isValid: Bool { messages.isEmpty }
}

struct MealManagementView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @State private var meals: [MealResponse] = []
    @State private var loading = false
    @State private var refreshing = false
    @State private var error: String?
    @State private var mutationMessage: String?
    @State private var inFlightMealID: String?

    var body: some View {
        NavigationView {
            MacroMeshScreen {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        AppCard(padding: 20) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Meal history")
                                    .font(.largeTitle.weight(.bold))
                                    .foregroundColor(MacroMeshTheme.text)
                                Text("Review and manage meals saved from Log.")
                                    .font(.subheadline)
                                    .foregroundColor(MacroMeshTheme.muted)
                            }
                        }

                        if loading && meals.isEmpty {
                            EmptyStateCard(icon: "clock.arrow.circlepath", title: "Loading meals", message: "Your saved meals will appear here in a moment.", buttonTitle: nil, action: nil)
                                .redacted(reason: .placeholder)
                        } else if let error = error, meals.isEmpty {
                            EmptyStateCard(icon: "wifi.exclamationmark", title: "Meals unavailable", message: error, buttonTitle: "Retry", action: loadMeals)
                        } else if meals.isEmpty {
                            EmptyStateCard(icon: "fork.knife.circle.fill", title: "No saved meals yet", message: "Meals you save from Log will appear here as a clean history of your day.", buttonTitle: "Log a meal", action: openLog)
                        } else {
                            VStack(spacing: 12) {
                                ForEach(meals) { meal in
                                    NavigationLink(destination: MealDetailView(meal: meal, isMutating: inFlightMealID == meal.stableID, onSave: updateMeal, onDelete: deleteMeal)) {
                                        MealHistoryCard(meal: meal)
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
                    .padding(.bottom, 88)
                    .refreshable { refreshMeals() }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: loadMeals) {
                        if refreshing { ProgressView() } else { Image(systemName: "arrow.clockwise") }
                    }
                    .foregroundColor(MacroMeshTheme.primary)
                    .disabled(loading || refreshing || inFlightMealID != nil)
                    .accessibilityLabel("Refresh meals")
                }
            }
            .safeAreaInset(edge: .bottom) {
                if let mutationMessage = mutationMessage {
                    Text(mutationMessage)
                        .font(.caption.weight(.semibold))
                        .foregroundColor(MacroMeshTheme.primaryDark)
                        .padding(10)
                        .frame(maxWidth: .infinity)
                        .background(MacroMeshTheme.cardSubtle)
                }
            }
            .onAppear(perform: loadMeals)
        }
    }

    private func openLog() {
        NotificationCenter.default.post(name: .macroMeshOpenLogTab, object: nil)
    }

    private func loadMeals() {
        guard !loading else { return }
        loading = true
        error = nil
        BackendService.fetchMeals { result in
            DispatchQueue.main.async {
                loading = false
                applyMealsResult(result)
            }
        }
    }

    private func refreshMeals() {
        guard !refreshing else { return }
        refreshing = true
        BackendService.fetchMeals { result in
            DispatchQueue.main.async {
                refreshing = false
                applyMealsResult(result)
            }
        }
    }

    private func applyMealsResult(_ result: Result<[MealResponse], Error>) {
        switch result {
        case .success(let loadedMeals):
            meals = loadedMeals
            error = nil
        case .failure(let err):
            sessionStore.apply(err)
            error = err.localizedDescription
        }
    }

    private func updateMeal(_ meal: MealResponse, with request: PostMealRequest) {
        guard let mealID = meal.id, inFlightMealID == nil else { return }
        inFlightMealID = mealID
        mutationMessage = nil
        BackendService.updateMeal(id: mealID, request: request) { result in
            DispatchQueue.main.async {
                inFlightMealID = nil
                switch result {
                case .success(let response):
                    if let updated = response.meal, let index = meals.firstIndex(where: { $0.stableID == mealID }) {
                        meals[index] = updated
                    }
                    mutationMessage = "Meal updated. Today and History refreshed."
                    NotificationCenter.default.post(name: .calorieCompassMealsDidChange, object: nil)
                case .failure(let err):
                    sessionStore.apply(err)
                    error = err.localizedDescription
                }
            }
        }
    }

    private func deleteMeal(_ meal: MealResponse) {
        guard let mealID = meal.id, inFlightMealID == nil else { return }
        inFlightMealID = mealID
        mutationMessage = nil
        BackendService.deleteMeal(id: mealID) { result in
            DispatchQueue.main.async {
                inFlightMealID = nil
                switch result {
                case .success:
                    meals.removeAll { $0.stableID == mealID }
                    mutationMessage = "Meal deleted. Today and History refreshed."
                    NotificationCenter.default.post(name: .calorieCompassMealsDidChange, object: nil)
                case .failure(let err):
                    sessionStore.apply(err)
                    error = err.localizedDescription
                }
            }
        }
    }
}

struct MealStateView: View {
    let systemImage: String
    let title: String
    let message: String
    let buttonTitle: String
    let action: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: systemImage)
                .font(.largeTitle)
                .foregroundColor(.accentColor)
            Text(title)
                .font(.title3)
                .fontWeight(.semibold)
            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            Button(buttonTitle, action: action)
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
        }
        .padding(22)
        .frame(maxWidth: .infinity)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .padding(.horizontal, 18)
        .padding(.top, 24)
    }
}

struct MealHistoryCard: View {
    let meal: MealResponse

    var body: some View {
        AppCard(padding: 16) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: "fork.knife.circle.fill")
                    .font(.title2)
                    .foregroundColor(MacroMeshTheme.primary)
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(meal.displayTitle)
                            .font(.headline)
                            .foregroundColor(MacroMeshTheme.text)
                            .lineLimit(1)
                        Spacer()
                        Text("\(Int(meal.safeTotalCalories)) cal")
                            .font(.subheadline.weight(.bold))
                            .foregroundColor(MacroMeshTheme.primary)
                    }
                    Text("\(meal.displayMealType) · \(meal.displayDate)")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                    HStack(spacing: 8) {
                        Text("P \(Int(meal.safeTotalProtein))g")
                        Text("C \(Int(meal.safeTotalCarbs))g")
                        Text("F \(Int(meal.safeTotalFat))g")
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.primaryDark)
                }
            }
        }
    }
}

struct MealRow: View {
    let meal: MealResponse

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(meal.displayTitle)
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                Text("\(Int(meal.safeTotalCalories)) cal")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            HStack(spacing: 8) {
                Text(meal.displayMealType)
                Text(meal.displayDate)
                if let count = meal.itemCount ?? meal.items?.count {
                    Text("\(count) item\(count == 1 ? "" : "s")")
                }
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct MealDetailView: View {
    let meal: MealResponse
    let isMutating: Bool
    let onSave: (MealResponse, PostMealRequest) -> Void
    let onDelete: (MealResponse) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var editing = false
    @State private var draft: MealDraft
    @State private var showDeleteConfirmation = false
    @State private var showSaveConfirmation = false
    @State private var showDiscardConfirmation = false
    @State private var validationMessages: [String] = []

    init(meal: MealResponse, isMutating: Bool, onSave: @escaping (MealResponse, PostMealRequest) -> Void, onDelete: @escaping (MealResponse) -> Void) {
        self.meal = meal
        self.isMutating = isMutating
        self.onSave = onSave
        self.onDelete = onDelete
        _draft = State(initialValue: MealDraft(meal: meal))
    }

    var body: some View {
        Form {
            Section("Summary") {
                if editing {
                    TextField("Title / notes", text: $draft.title)
                        .textInputAutocapitalization(.sentences)
                    Picker("Meal type", selection: $draft.mealType) {
                        ForEach(MealTypeOption.allCases) { option in
                            Text(option.label).tag(option.rawValue)
                        }
                    }
                    DatePicker("Date & time", selection: $draft.date, displayedComponents: [.date, .hourAndMinute])
                } else {
                    LabeledContent("Title", value: meal.displayTitle)
                    LabeledContent("Type", value: meal.displayMealType)
                    LabeledContent("Date", value: meal.displayDate)
                }
                LabeledContent("Calories", value: "\(Int(editing ? draft.totalCalories : meal.safeTotalCalories))")
                LabeledContent("Protein", value: "\(Int(editing ? draft.totalProtein : meal.safeTotalProtein))g")
                LabeledContent("Carbs", value: "\(Int(editing ? draft.totalCarbs : meal.safeTotalCarbs))g")
                LabeledContent("Fat", value: "\(Int(editing ? draft.totalFat : meal.safeTotalFat))g")
            }

            Section("Food items") {
                if draft.items.isEmpty {
                    Text("No item details are available for this meal.")
                        .foregroundColor(.secondary)
                } else {
                    ForEach($draft.items) { $item in
                        VStack(alignment: .leading, spacing: 8) {
                            if editing {
                                TextField("Food", text: $item.food_name)
                                    .textInputAutocapitalization(.words)
                                HStack {
                                    TextField("Qty", value: $item.quantity, formatter: NumberFormatter.decimal)
                                        .keyboardType(.decimalPad)
                                    TextField("Unit", text: $item.unit)
                                }
                                HStack {
                                    TextField("Calories", value: $item.calories, formatter: NumberFormatter.decimal)
                                        .keyboardType(.decimalPad)
                                    TextField("Protein", value: $item.protein, formatter: NumberFormatter.decimal)
                                        .keyboardType(.decimalPad)
                                }
                                HStack {
                                    TextField("Carbs", value: $item.carbs, formatter: NumberFormatter.decimal)
                                        .keyboardType(.decimalPad)
                                    TextField("Fat", value: $item.fat, formatter: NumberFormatter.decimal)
                                        .keyboardType(.decimalPad)
                                }
                            } else {
                                Text(item.food_name.capitalized).font(.headline)
                                Text("\(item.quantity.formatted()) \(item.unit)")
                                    .foregroundColor(.secondary)
                            }
                            Text("\(Int(item.calories)) cal · P \(Int(item.protein))g · C \(Int(item.carbs))g · F \(Int(item.fat))g")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .onDelete { offsets in
                        guard editing else { return }
                        draft.items.remove(atOffsets: offsets)
                    }
                }
            }

            if !validationMessages.isEmpty {
                Section("Needs attention") {
                    ForEach(validationMessages, id: \.self) { message in
                        Label(message, systemImage: "exclamationmark.triangle")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                }
            }

            Section {
                if editing {
                    Button("Save meal changes") { validateAndConfirmSave() }
                        .disabled(isMutating)
                    Button("Discard changes", role: .cancel) {
                        if draft == MealDraft(meal: meal) {
                            cancelEditing()
                        } else {
                            showDiscardConfirmation = true
                        }
                    }
                } else {
                    Button("Edit meal") {
                        draft = MealDraft(meal: meal)
                        validationMessages = []
                        editing = true
                    }
                    Button("Delete meal", role: .destructive) { showDeleteConfirmation = true }
                        .disabled(isMutating || meal.id == nil)
                }
                if isMutating { ProgressView("Saving…") }
            }
        }
        .navigationTitle("Meal detail")
        .alert("Delete this meal?", isPresented: $showDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                onDelete(meal)
                dismiss()
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("This removes the saved meal only after the backend confirms the delete.")
        }
        .alert("Save meal changes?", isPresented: $showSaveConfirmation) {
            Button("Save", role: .destructive) {
                onSave(meal, draft.request)
                editing = false
            }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Your local meal list updates only after the backend confirms the save.")
        }
        .alert("Discard unsaved changes?", isPresented: $showDiscardConfirmation) {
            Button("Discard", role: .destructive) { cancelEditing() }
            Button("Keep editing", role: .cancel) { }
        } message: {
            Text("This returns the meal form to the last saved backend version.")
        }
    }

    private func validateAndConfirmSave() {
        guard meal.id != nil else {
            validationMessages = ["This meal cannot be edited because it has no backend id."]
            return
        }

        let validation = draft.validate()
        validationMessages = validation.messages
        guard validation.isValid else { return }
        showSaveConfirmation = true
    }

    private func cancelEditing() {
        draft = MealDraft(meal: meal)
        validationMessages = []
        editing = false
    }
}

struct MealDraft: Equatable {
    var title: String
    var mealType: String
    var date: Date
    var confidenceScore: Double
    var items: [MealRequestItem]

    init(meal: MealResponse) {
        title = meal.rawText ?? ""
        mealType = MealTypeOption(rawValue: meal.normalizedMealType)?.rawValue ?? MealTypeOption.snack.rawValue
        date = DateParser.parseMealDate(meal.date ?? meal.createdAt) ?? Date()
        confidenceScore = min(max(meal.confidenceScore ?? 0.95, 0), 1)
        items = meal.items ?? []
    }

    var request: PostMealRequest {
        PostMealRequest(meal_type: mealType, confidence_score: confidenceScore, raw_text: title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : title.trimmingCharacters(in: .whitespacesAndNewlines), notes: nil, date: ISO8601DateFormatter().string(from: date), items: items)
    }

    var totalCalories: Double { items.reduce(0) { $0 + max($1.calories, 0) } }
    var totalProtein: Double { items.reduce(0) { $0 + max($1.protein, 0) } }
    var totalCarbs: Double { items.reduce(0) { $0 + max($1.carbs, 0) } }
    var totalFat: Double { items.reduce(0) { $0 + max($1.fat, 0) } }

    func validate() -> MealDraftValidation {
        var messages: [String] = []
        if MealTypeOption(rawValue: mealType) == nil {
            messages.append("Choose breakfast, lunch, dinner, or snack.")
        }
        if items.isEmpty {
            messages.append("A saved meal must keep at least one food item. Delete the meal instead if needed.")
        }
        if confidenceScore < 0 || confidenceScore > 1 {
            messages.append("Confidence must stay between 0 and 1.")
        }
        for (index, item) in items.enumerated() {
            let label = item.food_name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Item \(index + 1)" : item.food_name
            if item.food_name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                messages.append("Item \(index + 1) needs a food name.")
            }
            if item.unit.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                messages.append("\(label) needs a unit.")
            }
            if item.quantity <= 0 || !item.quantity.isFinite {
                messages.append("\(label) needs a quantity above 0.")
            }
            let nutrients = [("calories", item.calories), ("protein", item.protein), ("carbs", item.carbs), ("fat", item.fat), ("fiber", item.fiber), ("sugar", item.sugar), ("sodium", item.sodium)]
            for nutrient in nutrients where nutrient.1 < 0 || !nutrient.1.isFinite {
                messages.append("\(label) has an invalid \(nutrient.0) value.")
            }
        }
        return MealDraftValidation(messages: messages)
    }
}

struct DateParser {
    static func parseMealDate(_ raw: String?) -> Date? {
        guard let raw, !raw.isEmpty else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: raw) { return date }
        let standard = ISO8601DateFormatter()
        standard.formatOptions = [.withInternetDateTime]
        return standard.date(from: raw)
    }
}

extension MealResponse {
    var stableID: String { id ?? rawText ?? date ?? createdAt ?? "unsaved-meal" }
    var safeTotalCalories: Double { max(totalCalories ?? totalFromItems(\.calories), 0) }
    var safeTotalProtein: Double { max(totalProtein ?? totalFromItems(\.protein), 0) }
    var safeTotalCarbs: Double { max(totalCarbs ?? totalFromItems(\.carbs), 0) }
    var safeTotalFat: Double { max(totalFat ?? totalFromItems(\.fat), 0) }

    private func totalFromItems(_ keyPath: KeyPath<MealRequestItem, Double>) -> Double {
        (items ?? []).reduce(0) { $0 + max($1[keyPath: keyPath], 0) }
    }

    var displayTitle: String {
        if let rawText, !rawText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return rawText }
        if let first = items?.first?.food_name, !first.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { return first.capitalized }
        return "Saved meal"
    }
    var normalizedMealType: String { (mealType ?? "snack").lowercased() }
    var displayMealType: String { MealTypeOption(rawValue: normalizedMealType)?.label ?? "Snack" }
    var displayDate: String {
        guard let parsed = DateParser.parseMealDate(date ?? createdAt) else { return "Date unavailable" }
        return DateFormatter.mealDisplay.string(from: parsed)
    }
}

extension NumberFormatter {
    static var decimal: NumberFormatter {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 2
        return formatter
    }
}

extension DateFormatter {
    static var mealDisplay: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }
}
