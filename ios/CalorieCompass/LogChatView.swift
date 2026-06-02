//
//  LogChatView.swift
//  CalorieCompass
//
//  Native chat logger main view for Phase 2A
//
import SwiftUI

struct LogChatView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @State private var messages: [MealAssistantTranscriptMessage] = []
    @State private var inputText = ""
    @State private var isLoading = false
    @State private var error: String?
    @State private var retryMessage: String?
    @State private var assistantState = MealAssistantState()

    @State private var reviewItems: [MealItem] = []
    @State private var showReviewCard = false
    @State private var isSavingMeal = false
    @State private var saveError: String? = nil
    @FocusState private var mealInputFocused: Bool
    private let stabilityReporter = ConsoleStabilityReporter()
    private let bottomAnchorID = "meal-log-bottom-anchor"

    var body: some View {
        NavigationView {
            MacroMeshScreen {
                VStack(spacing: 0) {
                    ScrollViewReader { proxy in
                        ScrollView {
                            VStack(alignment: .leading, spacing: 14) {
                                introCard
                                ForEach(Array(messages.enumerated()), id: \.offset) { _, msg in
                                    ChatBubble(role: msg.role, text: msg.text)
                                }
                                if isLoading {
                                    AssistantTypingCard()
                                }
                                if showReviewCard {
                                    MealReviewCard(items: $reviewItems, showCard: $showReviewCard, onConfirm: saveMeal, onCancel: discardActiveMeal)
                                        .onChange(of: reviewItems) { nextItems in
                                            syncActiveMealItems(nextItems)
                                        }
                                    if let saveError {
                                        Text(saveError)
                                            .font(.caption)
                                            .foregroundColor(.red)
                                    }
                                }
                                if let error {
                                    InlineRecoveryCard(message: error, retry: retryFailedMessage)
                                }
                                Color.clear
                                    .frame(height: 1)
                                    .id(bottomAnchorID)
                            }
                            .padding(.horizontal, 18)
                            .padding(.top, 12)
                            .padding(.bottom, 16)
                        }
                        .onChange(of: messages.count) { _ in scrollToBottom(proxy) }
                        .onChange(of: isLoading) { _ in scrollToBottom(proxy) }
                        .onChange(of: showReviewCard) { _ in scrollToBottom(proxy) }
                        .onChange(of: reviewItems.count) { _ in scrollToBottom(proxy) }
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
                    Text("Try a natural phrase")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(MacroMeshTheme.muted)
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
                    .onSubmit { sendMessage() }
                    .accessibilityLabel("Meal description")
                Button { sendMessage() } label: {
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
        .overlay(alignment: .top) {
            Rectangle()
                .fill(MacroMeshTheme.border)
                .frame(height: 1)
        }
    }

    func sendMessage(retryText: String? = nil) {
        let isRetry = retryText != nil
        let trimmedInput = (retryText ?? inputText).trimmingCharacters(in: .whitespacesAndNewlines)
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
        if !isRetry {
            messages.append(MealAssistantTranscriptMessage(role: "user", text: userMessage))
        }
        inputText = ""
        mealInputFocused = false

        if !isRetry, handleLocalCommand(userMessage) {
            return
        }

        isLoading = true
        error = nil
        retryMessage = nil

        let conversationHistory = messages
        let requestState = buildAssistantRequestState(for: userMessage)
        let req = MealAssistantRequest(
            message: userMessage,
            state: requestState,
            context: nil,
            conversationHistory: conversationHistory
        )
        BackendService.sendMealAssistant(request: req) { result in
            DispatchQueue.main.async {
                isLoading = false
                switch result {
                case .success(let resp):
                    let activeItemsBeforeResponse = reviewItems.map { $0.asMealRequestItem() }
                    if let warning = MealAssistantClientLogic.foodMatchWarning(for: userMessage, items: resp.meal.items) {
                        error = warning
                        retryMessage = userMessage
                        messages.append(MealAssistantTranscriptMessage(role: "assistant", text: warning))
                        return
                    }
                    messages.append(MealAssistantTranscriptMessage(role: "assistant", text: resp.assistant_reply))
                    if MealAssistantClientLogic.shouldPreserveActiveMeal(currentItems: activeItemsBeforeResponse, responseItems: resp.meal.items, responseSaved: resp.next_state.saved, incomingUserMessage: userMessage) {
                        assistantState = resp.next_state
                        assistantState.currentMealItems = activeItemsBeforeResponse
                        showReviewCard = true
                        return
                    }
                    assistantState = resp.next_state
                    reviewItems = resp.meal.items.map(MealItem.init(from:))
                    if !reviewItems.isEmpty {
                        syncActiveMealItems(reviewItems)
                    }
                    showReviewCard = !reviewItems.isEmpty && resp.next_state.saved == false
                    if resp.next_state.saved {
                        reviewItems.removeAll()
                        NotificationCenter.default.post(name: .calorieCompassMealsDidChange, object: nil)
                    }
                case .failure(let err):
                    sessionStore.apply(err)
                    stabilityReporter.record(.networkFailure(screen: "Log", message: err.localizedDescription))
                    retryMessage = userMessage
                    error = RetryCopy.nonDestructiveFailure(action: "send that meal description", error: err)
                }
            }
        }
    }

    private func retryFailedMessage() {
        guard let retryMessage else { return }
        sendMessage(retryText: retryMessage)
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        DispatchQueue.main.async {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo(bottomAnchorID, anchor: .bottom)
            }
        }
    }

    private func buildAssistantRequestState(for userMessage: String) -> MealAssistantState {
        MealAssistantClientLogic.buildRequestState(
            assistantState: assistantState,
            currentMealItems: reviewItems.map { $0.asMealRequestItem() },
            incomingUserMessage: userMessage
        )
    }

    private func handleLocalCommand(_ userMessage: String) -> Bool {
        let activeItems = reviewItems.map { $0.asMealRequestItem() }
        guard let command = MealAssistantClientLogic.detectLocalCommand(userMessage, hasActiveMeal: !activeItems.isEmpty) else {
            return false
        }

        switch command {
        case .discard:
            discardActiveMeal()
            messages.append(MealAssistantTranscriptMessage(role: "assistant", text: "Discarded that meal. What would you like to log instead?"))
            return true
        case .save:
            saveMeal(items: reviewItems)
            return true
        case .removeItem(let target):
            let nextItems = MealAssistantClientLogic.removingItems(matching: target, from: activeItems)
            guard nextItems.count < activeItems.count else {
                return false
            }
            reviewItems = nextItems.map(MealItem.init(from:))
            syncActiveMealItems(reviewItems)
            showReviewCard = !reviewItems.isEmpty
            let reply = reviewItems.isEmpty
                ? "Removed \(target). There’s nothing left in this meal, so I cleared the draft."
                : "Removed \(target). Review what’s left, then save when it looks right."
            if reviewItems.isEmpty {
                resetAssistantDraft()
            }
            messages.append(MealAssistantTranscriptMessage(role: "assistant", text: reply))
            return true
        }
    }

    private func syncActiveMealItems(_ items: [MealItem]) {
        assistantState.currentMealItems = items.map { $0.asMealRequestItem() }
        assistantState.saved = false
        if !items.isEmpty {
            assistantState.activeMode = "logging_mode"
            assistantState.activeTopic = "meal"
        }
    }

    private func discardActiveMeal() {
        resetAssistantDraft()
        showReviewCard = false
        saveError = nil
        error = nil
    }

    private func resetAssistantDraft() {
        assistantState = MealAssistantState()
        reviewItems.removeAll()
        retryMessage = nil
    }

    func saveMeal(items: [MealItem]) {
        guard MealAssistantClientLogic.canAttemptSave(items: items.map { $0.asMealRequestItem() }, isSaving: isSavingMeal) else {
            if isSavingMeal {
                stabilityReporter.record(.duplicateSubmissionBlocked(screen: "Meal review"))
            }
            return
        }
        isSavingMeal = true
        saveError = nil
        let req = PostMealRequest(
            meal_type: assistantState.mealType,
            confidence_score: assistantState.confidenceScore,
            raw_text: assistantState.currentMealText,
            source_reusable_meal_id: assistantState.sourceReusableMealId,
            notes: nil,
            date: nil,
            items: items.map { $0.asMealRequestItem() }
        )
        BackendService.saveConfirmedMeal(request: req) { result in
            DispatchQueue.main.async {
                isSavingMeal = false
                switch result {
                case .success:
                    showReviewCard = false
                    reviewItems.removeAll()
                    assistantState = MealAssistantClientLogic.buildRequestState(
                        assistantState: assistantState,
                        currentMealItems: items.map { $0.asMealRequestItem() },
                        incomingUserMessage: assistantState.currentMealText ?? ""
                    )
                    assistantState.saved = true
                    messages.append(MealAssistantTranscriptMessage(role: "assistant", text: "Saved. Ready for the next one?"))
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
            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                Text(isUser ? "You" : "MacroMesh")
                    .font(.caption2.weight(.bold))
                    .foregroundColor(MacroMeshTheme.muted)
                Text(text)
                    .font(.subheadline)
                    .foregroundColor(isUser ? .white : MacroMeshTheme.text)
                    .padding(12)
                    .background(isUser ? MacroMeshTheme.primary : Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .shadow(color: MacroMeshTheme.shadow, radius: 10, x: 0, y: 6)
            }
            if !isUser { Spacer(minLength: 50) }
        }
    }
}

struct AssistantTypingCard: View {
    var body: some View {
        HStack(spacing: 10) {
            ProgressView()
                .tint(MacroMeshTheme.primary)
            VStack(alignment: .leading, spacing: 2) {
                Text("Checking nutrition")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.text)
                Text("Matching food, serving, and confidence…")
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.muted)
            }
            Spacer()
        }
        .padding(14)
        .background(Color.white)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: MacroMeshTheme.shadow, radius: 10, x: 0, y: 6)
        .transition(.opacity.combined(with: .move(edge: .bottom)))
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
