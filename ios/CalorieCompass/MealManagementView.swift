// MealManagementView.swift
// Calorie Compass iOS — Phase 3B native meal management
import SwiftUI

extension Notification.Name {
    static let calorieCompassMealsDidChange = Notification.Name("calorieCompassMealsDidChange")
}

struct MealManagementView: View {
    @State private var meals: [MealResponse] = []
    @State private var selectedMeal: MealResponse?
    @State private var loading = false
    @State private var refreshing = false
    @State private var error: String?
    @State private var mutationMessage: String?
    @State private var inFlightMealID: String?

    var body: some View {
        NavigationView {
            Group {
                if loading && meals.isEmpty {
                    VStack(spacing: 12) {
                        ProgressView()
                        Text("Loading saved meals…")
                            .foregroundColor(.secondary)
                    }
                } else if let error = error, meals.isEmpty {
                    VStack(spacing: 14) {
                        Image(systemName: "wifi.exclamationmark")
                            .font(.largeTitle)
                            .foregroundColor(.orange)
                        Text("Meals unavailable")
                            .font(.headline)
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                        Button("Retry") { loadMeals() }
                            .buttonStyle(.borderedProminent)
                    }
                    .padding()
                } else if meals.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "fork.knife.circle")
                            .font(.largeTitle)
                            .foregroundColor(.secondary)
                        Text("No saved meals yet")
                            .font(.headline)
                        Text("Meals you save from Log will appear here for review and management.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                        Button("Refresh") { loadMeals() }
                    }
                    .padding()
                } else {
                    List(meals) { meal in
                        NavigationLink(destination: MealDetailView(meal: meal, isMutating: inFlightMealID == meal.stableID, onSave: updateMeal, onDelete: deleteMeal)) {
                            MealRow(meal: meal)
                        }
                    }
                    .refreshable { refreshMeals() }
                }
            }
            .navigationTitle("Meals")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: loadMeals) {
                        if refreshing { ProgressView() } else { Image(systemName: "arrow.clockwise") }
                    }
                    .disabled(loading || refreshing)
                }
            }
            .safeAreaInset(edge: .bottom) {
                if let mutationMessage = mutationMessage {
                    Text(mutationMessage)
                        .font(.caption)
                        .padding(10)
                        .frame(maxWidth: .infinity)
                        .background(Color.green.opacity(0.12))
                }
            }
            .onAppear(perform: loadMeals)
            .onReceive(NotificationCenter.default.publisher(for: .calorieCompassMealsDidChange)) { _ in
                refreshMeals()
            }
        }
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
                    mutationMessage = "Meal updated. Dashboard and History will refresh."
                    NotificationCenter.default.post(name: .calorieCompassMealsDidChange, object: nil)
                    refreshMeals()
                case .failure(let err):
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
                    mutationMessage = "Meal deleted. Dashboard and History will refresh."
                    NotificationCenter.default.post(name: .calorieCompassMealsDidChange, object: nil)
                    refreshMeals()
                case .failure(let err):
                    error = err.localizedDescription
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
                Text("\(Int(meal.totalCalories ?? 0)) cal")
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

    @State private var editing = false
    @State private var draft: MealDraft
    @State private var showDeleteConfirmation = false
    @State private var showSaveConfirmation = false
    @State private var localError: String?

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
                    Picker("Meal type", selection: $draft.mealType) {
                        Text("Breakfast").tag("breakfast")
                        Text("Lunch").tag("lunch")
                        Text("Dinner").tag("dinner")
                        Text("Snack").tag("snack")
                    }
                    DatePicker("Date", selection: $draft.date, displayedComponents: [.date, .hourAndMinute])
                } else {
                    LabeledContent("Title", value: meal.displayTitle)
                    LabeledContent("Type", value: meal.displayMealType)
                    LabeledContent("Date", value: meal.displayDate)
                }
                LabeledContent("Calories", value: "\(Int(meal.totalCalories ?? draft.totalCalories))")
                LabeledContent("Protein", value: "\(Int(meal.totalProtein ?? draft.totalProtein))g")
                LabeledContent("Carbs", value: "\(Int(meal.totalCarbs ?? draft.totalCarbs))g")
                LabeledContent("Fat", value: "\(Int(meal.totalFat ?? draft.totalFat))g")
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
                                HStack {
                                    TextField("Qty", value: $item.quantity, formatter: NumberFormatter.decimal)
                                        .keyboardType(.decimalPad)
                                    TextField("Unit", text: $item.unit)
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

            if let localError = localError {
                Section { Text(localError).foregroundColor(.red) }
            }

            Section {
                if editing {
                    Button("Save meal changes") { validateAndConfirmSave() }
                        .disabled(isMutating)
                    Button("Cancel edit", role: .cancel) {
                        draft = MealDraft(meal: meal)
                        localError = nil
                        editing = false
                    }
                } else {
                    Button("Edit meal") {
                        draft = MealDraft(meal: meal)
                        localError = nil
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
            Button("Delete", role: .destructive) { onDelete(meal) }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("This removes the saved meal after the backend confirms the delete.")
        }
        .alert("Save meal changes?", isPresented: $showSaveConfirmation) {
            Button("Save", role: .destructive) { onSave(meal, draft.request) }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Your local meal list updates only after the backend confirms the save.")
        }
    }

    private func validateAndConfirmSave() {
        guard meal.id != nil else {
            localError = "This meal cannot be edited because it has no backend id."
            return
        }
        guard !draft.items.isEmpty else {
            localError = "A saved meal must keep at least one food item. Delete the meal instead if needed."
            return
        }
        localError = nil
        showSaveConfirmation = true
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
        mealType = meal.normalizedMealType
        date = ISO8601DateFormatter.flexible.date(from: meal.date ?? meal.createdAt ?? "") ?? Date()
        confidenceScore = meal.confidenceScore ?? 0.95
        items = meal.items ?? []
    }

    var request: PostMealRequest {
        PostMealRequest(meal_type: mealType, confidence_score: confidenceScore, raw_text: title.isEmpty ? nil : title, notes: nil, date: ISO8601DateFormatter().string(from: date), items: items)
    }

    var totalCalories: Double { items.reduce(0) { $0 + $1.calories } }
    var totalProtein: Double { items.reduce(0) { $0 + $1.protein } }
    var totalCarbs: Double { items.reduce(0) { $0 + $1.carbs } }
    var totalFat: Double { items.reduce(0) { $0 + $1.fat } }
}

extension MealResponse {
    var stableID: String { id ?? rawText ?? UUID().uuidString }
    var displayTitle: String {
        if let rawText, !rawText.isEmpty { return rawText }
        if let first = items?.first?.food_name, !first.isEmpty { return first.capitalized }
        return "Saved meal"
    }
    var normalizedMealType: String { (mealType ?? "snack").lowercased() }
    var displayMealType: String { normalizedMealType.capitalized }
    var displayDate: String {
        guard let raw = date ?? createdAt, let parsed = ISO8601DateFormatter.flexible.date(from: raw) else { return "Date unavailable" }
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

extension ISO8601DateFormatter {
    static var flexible: ISO8601DateFormatter {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }
}
