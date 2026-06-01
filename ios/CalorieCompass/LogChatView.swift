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

    var body: some View {
        NavigationView {
            MacroMeshScreen {
                VStack(spacing: 0) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            introCard
                            if !reviewItems.isEmpty {
                                ActiveReviewSummary(items: reviewItems)
                            }
                            ForEach(Array(messages.enumerated()), id: \.offset) { _, msg in
                                ChatBubble(role: msg.role, text: msg.text)
                            }
                            if isLoading {
                                AssistantTypingBubble()
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
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .center, spacing: 12) {
                    IconBadge(systemName: "plus.bubble.fill", tint: MacroMeshTheme.primary, size: 42)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Log")
                            .font(.caption.weight(.bold))
                            .foregroundColor(MacroMeshTheme.primary)
                            .textCase(.uppercase)
                        Text("Tell MacroMesh what you ate")
                            .font(.title2.weight(.bold))
                            .foregroundColor(MacroMeshTheme.text)
                    }
                }
                Text(sessionStore.state.isPreparingSession ? "Guest mode is setting up. Draft naturally and send in a moment." : "Use normal language. MacroMesh builds the review card, then you decide what gets saved.")
                    .font(.subheadline)
                    .foregroundColor(MacroMeshTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(["Quest BBQ protein chips", "A Snickers", "Greek yogurt bowl", "Baked potato"], id: \.self) { prompt in
                            Button {
                                inputText = prompt
                                mealInputFocused = true
                            } label: {
                                PromptChip(text: prompt)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Use suggestion \(prompt)")
                        }
                    }
                }
            }
        }
    }

    private var composer: some View {
        VStack(spacing: 8) {
            NutritionDisclaimerView()
            HStack(spacing: 10) {
                TextField(sessionStore.state.isPreparingSession ? "Setting up guest session..." : "Meal, snack, or correction", text: $inputText)
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
        .padding(.bottom, 12)
        .background(.thinMaterial)
    }

    func sendMessage(retryText: String? = nil) {
        let isRetry = retryText != nil
        let trimmedInput = (retryText ?? inputText).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedInput.isEmpty else { return }
        guard sessionStore.state != .unknown && sessionStore.state != .loading else {
            sessionStore.refresh()
            error = "Guest mode is still setting up. Try again in a moment - your message was not sent yet."
            return
        }
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
                    if MealAssistantClientLogic.shouldPreserveActiveMeal(currentItems: activeItemsBeforeResponse, responseItems: resp.meal.items, responseSaved: resp.next_state.saved) {
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
                    error = RetryCopy.recoveryMessage(action: "send that meal description", error: err)
                }
            }
        }
    }

    private func retryFailedMessage() {
        guard let retryMessage else { return }
        sendMessage(retryText: retryMessage)
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
                    saveError = RetryCopy.recoveryMessage(action: "save this meal", error: err)
                }
            }
        }
    }
}

struct PromptChip: View {
    let text: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "sparkles")
                .font(.caption2.weight(.bold))
            Text(text)
                .font(.caption.weight(.medium))
        }
        .foregroundColor(MacroMeshTheme.primaryDark)
        .padding(.horizontal, 11)
        .padding(.vertical, 8)
        .background(MacroMeshTheme.cardSubtle)
        .overlay(
            Capsule()
                .stroke(MacroMeshTheme.primary.opacity(0.08), lineWidth: 1)
        )
        .clipShape(Capsule())
    }
}

struct ActiveReviewSummary: View {
    let items: [MealItem]

    private var calories: Double { items.reduce(0) { $0 + $1.calories } }
    private var protein: Double { items.reduce(0) { $0 + $1.protein } }

    var body: some View {
        HStack(spacing: 12) {
            IconBadge(systemName: "checklist.checked", tint: MacroMeshTheme.blue, size: 36)
            VStack(alignment: .leading, spacing: 4) {
                Text("Active review")
                    .font(.caption.weight(.bold))
                    .foregroundColor(MacroMeshTheme.blue)
                    .textCase(.uppercase)
                Text(items.map(\.displayName).prefix(2).joined(separator: ", "))
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.text)
                    .lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(Int(calories))")
                    .font(.headline.weight(.bold))
                    .foregroundColor(MacroMeshTheme.primary)
                Text("\(Int(protein))g protein")
                    .font(.caption2.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.muted)
            }
        }
        .padding(14)
        .background(MacroMeshTheme.cardCool)
        .clipShape(RoundedRectangle(cornerRadius: MacroMeshRadius.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: MacroMeshRadius.lg, style: .continuous)
                .stroke(MacroMeshTheme.border, lineWidth: 1)
        )
    }
}

struct AssistantTypingBubble: View {
    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            IconBadge(systemName: "leaf.fill", tint: MacroMeshTheme.primary, size: 28)
            HStack(spacing: 6) {
                ProgressView()
                    .tint(MacroMeshTheme.primary)
                    .scaleEffect(0.72)
                Text("Checking serving and source...")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.muted)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(MacroMeshTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: MacroMeshRadius.md, style: .continuous))
            Spacer(minLength: 50)
        }
        .transition(.opacity.combined(with: .move(edge: .bottom)))
    }
}

enum MealAssistantDisplayCopy {
    static func clean(_ raw: String) -> String {
        var text = raw
            .replacingOccurrences(of: #"100g\s+Candies,\s*MARS SNACKFOOD US,\s*SNICKERS Bar"#, with: "1 Snickers Bar", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"Candies,\s*MARS SNACKFOOD US,\s*SNICKERS Bar"#, with: "Snickers Bar", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"Candies,\s*MARS SNACKFOOD US,\s*SKITTLES Sours Original"#, with: "Skittles Sour Candy", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"100g\s+Cracker chips"#, with: "1 serving crackers", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: #"1 cup Potatoes"#, with: "1 medium potato", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: "USDA match", with: "Reference estimate", options: .caseInsensitive)
            .replacingOccurrences(of: "USDA", with: "reference", options: .caseInsensitive)
        text = text.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

struct ChatBubble: View {
    let role: String
    let text: String

    var isUser: Bool { role == "user" }
    private var displayText: String { isUser ? text : MealAssistantDisplayCopy.clean(text) }

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if isUser { Spacer(minLength: 50) }
            if !isUser {
                IconBadge(systemName: "leaf.fill", tint: MacroMeshTheme.primary, size: 28)
            }
            Text(displayText)
                .font(.subheadline)
                .foregroundColor(isUser ? .white : MacroMeshTheme.text)
                .padding(.horizontal, 13)
                .padding(.vertical, 11)
                .frame(maxWidth: 310, alignment: isUser ? .trailing : .leading)
                .background(isUser ? MacroMeshTheme.primary : MacroMeshTheme.card)
                .clipShape(RoundedRectangle(cornerRadius: MacroMeshRadius.md, style: .continuous))
                .shadow(color: isUser ? MacroMeshTheme.primary.opacity(0.18) : MacroMeshTheme.shadow, radius: 8, x: 0, y: 5)
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
