//
//  LogChatView.swift
//  CalorieCompass
//
//  Native chat logger main view for Phase 2A
//
import SwiftUI

struct LogChatView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @State private var messages: [(role: String, text: String)] = []
    @State private var inputText = ""
    @State private var isLoading = false
    @State private var error: String?
    @State private var assistantState: String? = nil

    @State private var reviewItems: [MealItem] = []
    @State private var showReviewCard = false
    @State private var isSavingMeal = false
    @State private var saveError: String? = nil
    
    var body: some View {
        VStack {
            if showReviewCard {
                MealReviewCard(items: $reviewItems, showCard: $showReviewCard, onConfirm: { items in
                    saveMeal(items: items)
                }, onCancel: {
                    showReviewCard = false
                })
                if let saveError = saveError {
                    Text(saveError).foregroundColor(.red)
                }
            }
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if messages.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("What did you eat?")
                                .font(.headline)
                            Text("Describe a meal or snack in your own words. Calorie Compass will help estimate nutrition before you save it.")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.secondarySystemBackground))
                        .cornerRadius(12)
                    }
                    ForEach(Array(messages.enumerated()), id: \.offset) { index, msg in
                        HStack(alignment: .top) {
                            if msg.role == "user" { Spacer() }
                            Text("\(msg.role == "user" ? "You" : "Assistant"): \(msg.text)")
                                .padding(8)
                                .background(msg.role == "user" ? Color.blue.opacity(0.13) : Color.gray.opacity(0.18))
                                .cornerRadius(8)
                            if msg.role != "user" { Spacer() }
                        }
                    }
                }.padding()
            }
            if let error = error {
                Text(error)
                    .foregroundColor(.red)
                    .padding(4)
            }
            NutritionDisclaimerView()
            HStack {
                TextField("Describe your meal", text: $inputText)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .disabled(isLoading)
                Button(action: sendMessage) {
                    if isLoading {
                        ProgressView()
                    } else {
                        Text("Send")
                    }
                }
                .disabled(isLoading || inputText.isEmpty)
                .accessibilityLabel("Send meal description")
            }.padding()
        }
    }
    
    func sendMessage() {
        guard !inputText.isEmpty, !isLoading else { return }
        let userMessage = inputText
        messages.append((role: "user", text: userMessage))
        inputText = ""
        isLoading = true
        error = nil

        let conversationHistory = messages.map { $0.text }
        let req = MealAssistantRequest(
            user_message: userMessage,
            current_state: assistantState,
            conversation_history: conversationHistory,
            macro_context: nil
        )
        BackendService.sendMealAssistant(request: req) { result in
            DispatchQueue.main.async {
                isLoading = false
                switch result {
                case .success(let resp):
                    messages.append((role: "assistant", text: resp.assistant_message))
                    assistantState = resp.next_state
                    // Extract possible meal items from the assistant response for review.
                    if let detectedItems = try? tryExtractMealItems(from: resp.assistant_message) {
                        reviewItems = detectedItems
                        if !reviewItems.isEmpty {
                            showReviewCard = true
                        }
                    }
                case .failure(let err):
                    sessionStore.apply(err)
                    error = "Send failed: \(err.localizedDescription)"
                }
            }
        }
    }

    // Attempt to extract meal items from assistant messages that include JSON item data.
    func tryExtractMealItems(from reply: String) throws -> [MealItem] {
        // The backend contract is still evolving, so this safely ignores replies without JSON.
        guard let start = reply.firstIndex(of: "["), let end = reply.lastIndex(of: "]") else {
            return []
        }
        let jsonString = String(reply[start...end])
        let decoder = JSONDecoder()
        if let data = jsonString.data(using: .utf8) {
            let raw = try decoder.decode([MealItem].self, from: data)
            return raw
        }
        return []
    }

    func saveMeal(items: [MealItem]) {
        isSavingMeal = true
        saveError = nil
        // Map MealItem to PostMealRequest
        let req = PostMealRequest(
            meal_type: "breakfast", // The current assistant save payload does not expose a selected meal type yet.
            confidence_score: 0.95,
            raw_text: nil,
            notes: nil,
            date: nil,
            items: items.map {
                MealRequestItem(
                    food_name: $0.name,
                    quantity: $0.quantity,
                    unit: $0.unit,
                    calories: $0.calories,
                    protein: $0.protein,
                    carbs: $0.carbs,
                    fat: $0.fat,
                    fiber: 0,   // Not available in prototype
                    sugar: 0,
                    sodium: 0,
                    notes: nil,
                    source_type: nil,
                    source_name: $0.source,
                    confidence_label: $0.confidence
                )
            }
        )
        BackendService.saveConfirmedMeal(request: req) { result in
            DispatchQueue.main.async {
                isSavingMeal = false
                switch result {
                case .success(_):
                    showReviewCard = false
                    reviewItems.removeAll()
                    NotificationCenter.default.post(name: .calorieCompassMealsDidChange, object: nil)
                case .failure(let err):
                    sessionStore.apply(err)
                    saveError = "Save failed: \(err.localizedDescription)"
                }
            }
        }
    }

}

struct NutritionDisclaimerView: View {
    var body: some View {
        Text("Nutrition estimates are informational and may be approximate. Verify critical details; this is not medical advice.")
            .font(.footnote)
            .foregroundColor(.secondary)
            .multilineTextAlignment(.leading)
            .padding(.horizontal)
            .accessibilityLabel("Nutrition estimates are informational and may be approximate. Verify critical details. This is not medical advice.")
    }
}

#Preview {
    LogChatView()
}
