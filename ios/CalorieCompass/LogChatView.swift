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
    @FocusState private var mealInputFocused: Bool
    private let stabilityReporter = ConsoleStabilityReporter()

    var body: some View {
        NavigationView {
            MacroMeshScreen {
                VStack(spacing: 0) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            introCard
                            ForEach(Array(messages.enumerated()), id: \.offset) { _, msg in
                                ChatBubble(role: msg.role, text: msg.text)
                            }
                            if isLoading {
                                ChatBubble(role: "assistant", text: "Estimating nutrition…")
                                    .redacted(reason: .placeholder)
                            }
                            if showReviewCard {
                                MealReviewCard(items: $reviewItems, showCard: $showReviewCard, onConfirm: saveMeal, onCancel: { showReviewCard = false })
                                if let saveError {
                                    Text(saveError)
                                        .font(.caption)
                                        .foregroundColor(.red)
                                }
                            }
                            if let error {
                                InlineRecoveryCard(message: error, retry: sendMessage)
                            }
                        }
                        .padding(.horizontal, 18)
                        .padding(.top, 12)
                        .padding(.bottom, 16)
                    }
                    composer
                }
            }
            .navigationTitle("Log")
            .navigationBarTitleDisplayMode(.inline)
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private var introCard: some View {
        AppCard(padding: 18) {
            VStack(alignment: .leading, spacing: 12) {
                Text("Conversational logging")
                    .font(.caption.weight(.bold))
                    .foregroundColor(MacroMeshTheme.primary)
                    .textCase(.uppercase)
                    .tracking(1.1)
                Text("What did you eat?")
                    .font(.title.weight(.bold))
                    .foregroundColor(MacroMeshTheme.text)
                Text(sessionStore.state.isPreparingSession ? "Setting up your guest session. You can type now and send in a moment." : "Describe a meal naturally. MacroMesh estimates nutrition, then asks you to review before anything is saved.")
                    .font(.subheadline)
                    .foregroundColor(MacroMeshTheme.muted)
                VStack(alignment: .leading, spacing: 8) {
                    PromptChip(text: "Greek yogurt with granola and berries")
                    PromptChip(text: "Chicken burrito bowl for lunch")
                    PromptChip(text: "Two eggs, toast, and coffee")
                }
            }
        }
    }

    private var composer: some View {
        VStack(spacing: 8) {
            NutritionDisclaimerView()
            HStack(spacing: 10) {
                TextField(sessionStore.state.isPreparingSession ? "Setting up guest session…" : "Describe your meal", text: $inputText)
                    .textFieldStyle(MacroMeshTextFieldStyle())
                    .disabled(isLoading || sessionStore.state.isActionBlocked)
                    .focused($mealInputFocused)
                    .submitLabel(.send)
                    .onSubmit(sendMessage)
                    .accessibilityLabel("Meal description")
                Button(action: sendMessage) {
                    if isLoading {
                        ProgressView().tint(.white)
                    } else {
                        Image(systemName: "arrow.up")
                            .font(.headline.weight(.bold))
                    }
                }
                .frame(width: 46, height: 46)
                .background((isLoading || sessionStore.state.isActionBlocked || inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) ? MacroMeshTheme.primary.opacity(0.35) : MacroMeshTheme.primary)
                .foregroundColor(.white)
                .clipShape(Circle())
                .disabled(isLoading || sessionStore.state.isActionBlocked || inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityLabel("Send meal description")
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 10)
        .background(.ultraThinMaterial)
    }

    func sendMessage() {
        let trimmedInput = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedInput.isEmpty else { return }
        guard !isLoading else {
            stabilityReporter.record(.duplicateSubmissionBlocked(screen: "Log"))
            return
        }
        guard !sessionStore.state.isActionBlocked else {
            error = sessionStore.state.isPreparingSession ? "MacroMesh is still setting up your guest session. Please try again in a moment." : "Your session needs attention before logging. Use the Today retry button, then send again."
            return
        }
        let userMessage = trimmedInput
        messages.append((role: "user", text: userMessage))
        inputText = ""
        mealInputFocused = false
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
                    if let detectedItems = try? tryExtractMealItems(from: resp.assistant_message) {
                        reviewItems = detectedItems
                        if !reviewItems.isEmpty { showReviewCard = true }
                    }
                case .failure(let err):
                    sessionStore.apply(err)
                    stabilityReporter.record(.networkFailure(screen: "Log", message: err.localizedDescription))
                    error = RetryCopy.nonDestructiveFailure(action: "send that meal description", error: err)
                }
            }
        }
    }

    func tryExtractMealItems(from reply: String) throws -> [MealItem] {
        guard let start = reply.firstIndex(of: "["), let end = reply.lastIndex(of: "]") else { return [] }
        let jsonString = String(reply[start...end])
        let decoder = JSONDecoder()
        if let data = jsonString.data(using: .utf8) {
            return try decoder.decode([MealItem].self, from: data)
        }
        return []
    }

    func saveMeal(items: [MealItem]) {
        guard !isSavingMeal else {
            stabilityReporter.record(.duplicateSubmissionBlocked(screen: "Meal review"))
            return
        }
        guard !items.isEmpty else { return }
        isSavingMeal = true
        saveError = nil
        let req = PostMealRequest(
            meal_type: "breakfast",
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
                    fiber: 0,
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
                case .success:
                    showReviewCard = false
                    reviewItems.removeAll()
                    NotificationCenter.default.post(name: .calorieCompassMealsDidChange, object: nil)
                case .failure(let err):
                    sessionStore.apply(err)
                    stabilityReporter.record(.networkFailure(screen: "Meal review", message: err.localizedDescription))
                    saveError = RetryCopy.nonDestructiveFailure(action: "save this meal", error: err)
                }
            }
        }
    }
}

struct PromptChip: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption.weight(.medium))
            .foregroundColor(MacroMeshTheme.primaryDark)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(MacroMeshTheme.cardSubtle)
            .clipShape(Capsule())
    }
}

struct ChatBubble: View {
    let role: String
    let text: String

    var isUser: Bool { role == "user" }

    var body: some View {
        HStack(alignment: .bottom) {
            if isUser { Spacer(minLength: 50) }
            Text(text)
                .font(.subheadline)
                .foregroundColor(isUser ? .white : MacroMeshTheme.text)
                .padding(12)
                .background(isUser ? MacroMeshTheme.primary : Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .shadow(color: MacroMeshTheme.shadow, radius: 10, x: 0, y: 6)
            if !isUser { Spacer(minLength: 50) }
        }
    }
}

struct NutritionDisclaimerView: View {
    var body: some View {
        Text("Nutrition estimates are approximate and not medical advice. Review before saving.")
            .font(.caption2)
            .foregroundColor(MacroMeshTheme.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityLabel("Nutrition estimates are approximate and not medical advice. Review before saving.")
    }
}

#Preview {
    LogChatView()
}
