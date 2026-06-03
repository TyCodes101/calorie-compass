//
//  LogChatView.swift
//  CalorieCompass
//
//  Native chat logger main view for Phase 2A
//
import AVFoundation
import PhotosUI
import SwiftUI
import UIKit
import Vision

enum BarcodeCameraPermissionState: Equatable {
    case notDetermined
    case authorized
    case denied
    case restricted
    case unavailable

    static var current: BarcodeCameraPermissionState {
        from(status: AVCaptureDevice.authorizationStatus(for: .video), hasCamera: BarcodeCameraAvailability.hasVideoCamera)
    }

    static func from(status: AVAuthorizationStatus, hasCamera: Bool) -> BarcodeCameraPermissionState {
        guard hasCamera else { return .unavailable }
        switch status {
        case .notDetermined: return .notDetermined
        case .authorized: return .authorized
        case .denied: return .denied
        case .restricted: return .restricted
        @unknown default: return .restricted
        }
    }

    var allowsScanning: Bool { self == .authorized }

    var permissionCopy: String {
        switch self {
        case .notDetermined:
            return "MacroMesh uses the camera only to read barcodes. No photo is saved from barcode scanning."
        case .authorized:
            return "MacroMesh uses the camera only to read barcodes. Point at a UPC or EAN code to look it up for review before saving."
        case .denied:
            return "Camera access is off. Enter the barcode manually, create a custom food, or describe the item."
        case .restricted:
            return "Camera access is restricted on this device. Manual barcode entry is still available."
        case .unavailable:
            return "Camera scanning is not available on this device. Manual barcode entry is still available."
        }
    }
}

enum BarcodeCameraAvailability {
    static var hasVideoCamera: Bool {
        AVCaptureDevice.default(for: .video) != nil
    }
}

struct BarcodeLookupFallbackModel: Equatable {
    let barcode: String

    var normalizedBarcode: String {
        barcode.filter(\.isNumber)
    }

    var canLookup: Bool {
        (8...14).contains(normalizedBarcode.count)
    }

    var aiDescriptionPrompt: String {
        if normalizedBarcode.isEmpty {
            return "Describe the food or package so MacroMesh can estimate it for review."
        }
        return "Barcode \(normalizedBarcode): describe the food or package so MacroMesh can estimate it for review."
    }
}

struct NutritionLabelOCRResult: Equatable {
    let rawText: String
    let lines: [String]

    var hasUsableText: Bool { !lines.isEmpty }

    static func fromRecognizedText(_ recognizedText: [String]) -> NutritionLabelOCRResult {
        let lines = recognizedText
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression) }
            .filter { !$0.isEmpty }
        return NutritionLabelOCRResult(rawText: lines.joined(separator: "\n"), lines: lines)
    }
}

enum NutritionLabelManualEntryBuilder {
    static func build(foodName: String, calories: Double, protein: Double, carbs: Double, fat: Double, extractedText: String?) -> MealRequestItem? {
        let cleanedName = foodName.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        guard !cleanedName.isEmpty,
              calories >= 0,
              protein >= 0,
              carbs >= 0,
              fat >= 0,
              calories + protein + carbs + fat > 0 else {
            return nil
        }

        let cleanedText = extractedText?.trimmingCharacters(in: .whitespacesAndNewlines)
        let note: String
        if let cleanedText, !cleanedText.isEmpty {
            note = "OCR text captured for manual verification: \(cleanedText)"
        } else {
            note = "Nutrition label values entered manually."
        }

        return MealRequestItem(
            food_name: cleanedName,
            quantity: 1,
            unit: "label",
            calories: calories,
            protein: protein,
            carbs: carbs,
            fat: fat,
            fiber: 0,
            sugar: 0,
            sodium: 0,
            notes: note,
            source_type: "AI_ESTIMATE",
            source_name: "Nutrition label manual entry",
            confidence_label: "User-entered",
            is_trusted: false,
            catalog_food_id: nil
        )
    }
}

struct MealPhotoDraft: Equatable, Identifiable {
    let id: UUID
    let itemIdentifier: String?
    let filename: String
    let createdAt: Date
    let hasLocalPreview: Bool

    init(id: UUID = UUID(), itemIdentifier: String?, filename: String, createdAt: Date = Date(), hasLocalPreview: Bool) {
        self.id = id
        self.itemIdentifier = itemIdentifier
        self.filename = filename
        self.createdAt = createdAt
        self.hasLocalPreview = hasLocalPreview
    }

    var storageStatus: String { "Local draft only" }

    var accessibilityLabel: String {
        "Meal photo \(filename) attached locally. Upload storage is deferred."
    }
}

enum LogActionSheet: Identifiable {
    case foodSearch
    case barcode(prefersCamera: Bool)
    case quickAdd(barcode: String?)
    case customFood(barcode: String?)
    case photoFoundation
    case nutritionLabelFoundation

    var id: String {
        switch self {
        case .foodSearch: return "food-search"
        case .barcode(let prefersCamera): return prefersCamera ? "barcode-camera" : "barcode-manual"
        case .quickAdd(let barcode): return "quick-add-\(barcode ?? "none")"
        case .customFood(let barcode): return "custom-food-\(barcode ?? "none")"
        case .photoFoundation: return "photo-foundation"
        case .nutritionLabelFoundation: return "nutrition-label-foundation"
        }
    }
}

enum LogToolLaunch: String, CaseIterable, Equatable {
    case foodSearch
    case barcodeManual
    case barcodeCamera
    case quickAdd
    case customFood
    case nutritionLabel
    case photo

    var sheet: LogActionSheet {
        switch self {
        case .foodSearch: return .foodSearch
        case .barcodeManual: return .barcode(prefersCamera: false)
        case .barcodeCamera: return .barcode(prefersCamera: true)
        case .quickAdd: return .quickAdd(barcode: nil)
        case .customFood: return .customFood(barcode: nil)
        case .nutritionLabel: return .nutritionLabelFoundation
        case .photo: return .photoFoundation
        }
    }
}

enum LogToolCatalog {
    static let foodToolTitles = ["Food Search", "Enter Barcode", "Quick Add", "Custom Food"]
    static let cameraToolTitles = ["Scan Barcode", "Scan Label", "Attach Photo"]
    static var allTitles: [String] { foodToolTitles + cameraToolTitles }
}

struct LogChatView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @State private var messages: [MealAssistantTranscriptMessage] = []
    @State private var inputText = ""
    @State private var isLoading = false
    @State private var error: String?
    @State private var retryMessage: String?
    @State private var assistantState = MealAssistantState()
    @State private var selectedMealType = "snack"
    @State private var favoriteMeals: [ReusableMealSummary] = []
    @State private var recentMeals: [ReusableMealSummary] = []
    @State private var quickActionMessage: String?
    @State private var activeSheet: LogActionSheet?

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
                                        .onChange(of: reviewItems) { _, nextItems in
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
                        .onChange(of: messages.count) { _, _ in scrollToBottom(proxy) }
                        .onChange(of: isLoading) { _, _ in scrollToBottom(proxy) }
                        .onChange(of: showReviewCard) { _, _ in scrollToBottom(proxy) }
                        .onChange(of: reviewItems.count) { _, _ in scrollToBottom(proxy) }
                    }
                    composer
                }
            }
            .navigationTitle("Log")
            .navigationBarTitleDisplayMode(.inline)
            .scrollDismissesKeyboard(.interactively)
            .onAppear(perform: loadReusableMeals)
            .onReceive(NotificationCenter.default.publisher(for: .macroMeshOpenLogTool)) { notification in
                guard let launch = notification.object as? LogToolLaunch else { return }
                activeSheet = launch.sheet
            }
            .onReceive(NotificationCenter.default.publisher(for: .macroMeshPrefillLogText)) { notification in
                guard let text = notification.object as? String else { return }
                inputText = text
                mealInputFocused = true
            }
            .sheet(item: $activeSheet) { sheet in
                switch sheet {
                case .foodSearch:
                    FoodSearchSheet { result in
                        reviewSearchResult(result, assistantText: "Found \(result.name). Review the serving before saving.")
                    } onQuickAdd: {
                        activeSheet = .quickAdd(barcode: nil)
                    }
                case .barcode(let prefersCamera):
                    BarcodeLookupSheet(prefersCamera: prefersCamera) { result in
                        reviewSearchResult(result, assistantText: "Found \(result.name) from barcode lookup. Review before saving.")
                    } onCreateCustomFood: { barcode in
                        activeSheet = .customFood(barcode: barcode)
                    } onQuickAdd: { barcode in
                        activeSheet = .quickAdd(barcode: barcode)
                    } onDescribeWithAI: { barcode in
                        inputText = BarcodeLookupFallbackModel(barcode: barcode).aiDescriptionPrompt
                        mealInputFocused = true
                        activeSheet = nil
                    }
                case .quickAdd(let barcode):
                    QuickAddSheet(barcode: barcode) { item in
                        beginReview(
                            items: [item],
                            mealType: selectedMealType,
                            confidenceScore: 0.72,
                            rawText: "Manual Quick Add",
                            sourceReusableMealId: nil,
                            assistantText: "Manual Quick Add is ready. Review it before saving."
                        )
                    }
                case .customFood(let barcode):
                    CustomFoodEditorSheet(initialBarcode: barcode) { result in
                        reviewSearchResult(result, assistantText: "Custom food saved. Review it before adding to your log.")
                        loadReusableMeals()
                    }
                case .photoFoundation:
                    PhotoAttachmentFoundationSheet {
                        activeSheet = .quickAdd(barcode: nil)
                    }
                case .nutritionLabelFoundation:
                    NutritionLabelFoundationSheet { item in
                        beginReview(
                            items: [item],
                            mealType: selectedMealType,
                            confidenceScore: 0.72,
                            rawText: "Nutrition label manual entry",
                            sourceReusableMealId: nil,
                            assistantText: "Nutrition label values are ready. Review them before saving."
                        )
                    } onQuickAdd: {
                        activeSheet = .quickAdd(barcode: nil)
                    }
                }
            }
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
                    PromptChip(text: "Chipotle bowl with double chicken")
                    PromptChip(text: "Quest BBQ protein chips")
                    PromptChip(text: "Protein shake and banana")
                }
                logActionGrid
                quickRepeatSection
            }
        }
    }

    private var logActionGrid: some View {
        VStack(alignment: .leading, spacing: 8) {
            LogActionSectionHeader(title: "Food tools")
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                LogActionButton(title: LogToolCatalog.foodToolTitles[0], icon: "magnifyingglass") {
                    activeSheet = .foodSearch
                }
                LogActionButton(title: LogToolCatalog.foodToolTitles[1], icon: "barcode") {
                    activeSheet = .barcode(prefersCamera: false)
                }
                LogActionButton(title: LogToolCatalog.foodToolTitles[2], icon: "plus.circle.fill") {
                    activeSheet = .quickAdd(barcode: nil)
                }
                LogActionButton(title: LogToolCatalog.foodToolTitles[3], icon: "fork.knife.circle.fill") {
                    activeSheet = .customFood(barcode: nil)
                }
            }
            LogActionSectionHeader(title: "Camera tools")
                .padding(.top, 4)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                LogActionButton(title: LogToolCatalog.cameraToolTitles[0], icon: "barcode.viewfinder") {
                    activeSheet = .barcode(prefersCamera: true)
                }
                LogActionButton(title: LogToolCatalog.cameraToolTitles[1], icon: "doc.text.viewfinder") {
                    activeSheet = .nutritionLabelFoundation
                }
                LogActionButton(title: LogToolCatalog.cameraToolTitles[2], icon: "photo") {
                    activeSheet = .photoFoundation
                }
            }
        }
    }

    private var composer: some View {
        VStack(spacing: 8) {
            mealTypeSelector
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

    private var mealTypeSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(["breakfast", "lunch", "dinner", "snack"], id: \.self) { mealType in
                    Button {
                        selectedMealType = mealType
                        assistantState = MealAssistantClientLogic.applyingMealType(mealType, to: assistantState)
                    } label: {
                        Text(mealType.capitalized)
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(selectedMealType == mealType ? MacroMeshTheme.primary : MacroMeshTheme.cardSubtle)
                            .foregroundColor(selectedMealType == mealType ? .white : MacroMeshTheme.primaryDark)
                            .clipShape(Capsule())
                    }
                    .accessibilityLabel("Set meal type to \(mealType)")
                }
            }
            .padding(.vertical, 2)
        }
    }

    private var quickRepeatSection: some View {
        let favorites = Array(favoriteMeals.prefix(4))
        let recents = Array(recentMeals.prefix(4))
        let frequent = Array(recentMeals.dropFirst(4).prefix(4))

        return VStack(alignment: .leading, spacing: 8) {
            if favorites.isEmpty && recents.isEmpty {
                Text("Recent, frequent, and favorite foods will appear here after you log a few meals.")
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.muted)
            } else {
                QuickMealRail(title: "Recently logged", emptyText: "No recent meals yet.", meals: recents, label: "Recent") { meal in
                    reviewReusableMeal(meal, label: "recent")
                }
                QuickMealRail(title: "Frequently logged", emptyText: "Frequent foods build as you log.", meals: frequent, label: "Frequent") { meal in
                    reviewReusableMeal(meal, label: "frequent")
                }
                QuickMealRail(title: "Favorites", emptyText: "Save favorites from meal review.", meals: favorites, label: "Favorite") { meal in
                    reviewReusableMeal(meal, label: "favorite")
                }
            }
            if let quickActionMessage {
                Text(quickActionMessage)
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.primaryDark)
            }
        }
    }

    private func reviewSearchResult(_ result: FoodSearchResult, assistantText: String) {
        beginReview(
            items: result.reviewItems,
            mealType: result.mealType,
            confidenceScore: result.confidenceScore,
            rawText: result.name,
            sourceReusableMealId: result.sourceReusableMealId,
            assistantText: assistantText
        )
    }

    private func beginReview(
        items: [MealRequestItem],
        mealType: String,
        confidenceScore: Double,
        rawText: String,
        sourceReusableMealId: String?,
        assistantText: String
    ) {
        let normalizedMealType = ["breakfast", "lunch", "dinner", "snack"].contains(mealType) ? mealType : selectedMealType
        selectedMealType = normalizedMealType
        assistantState = MealAssistantState()
        assistantState.mealType = normalizedMealType
        assistantState.confidenceScore = min(max(confidenceScore, 0), 1)
        assistantState.currentMealText = rawText
        assistantState.sourceReusableMealId = sourceReusableMealId
        reviewItems = items.map(MealItem.init(from:))
        syncActiveMealItems(reviewItems)
        showReviewCard = !reviewItems.isEmpty
        saveError = nil
        error = nil
        quickActionMessage = "Ready for review."
        messages.append(MealAssistantTranscriptMessage(role: "assistant", text: assistantText))
        activeSheet = nil
    }

    private func reviewReusableMeal(_ meal: ReusableMealSummary, label: String) {
        guard let items = meal.items, !items.isEmpty else {
            quickActionMessage = "That \(label) item is missing details. Open History to review it first."
            return
        }

        beginReview(
            items: items,
            mealType: meal.mealType,
            confidenceScore: meal.confidenceScore ?? 0.82,
            rawText: meal.rawText ?? meal.title,
            sourceReusableMealId: label == "favorite" ? meal.id : nil,
            assistantText: "Loaded \(meal.title). Review it before saving."
        )
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
        let typedState = MealAssistantClientLogic.applyingMealType(selectedMealType, to: assistantState)
        return MealAssistantClientLogic.buildRequestState(
            assistantState: typedState,
            currentMealItems: reviewItems.map { $0.asMealRequestItem() },
            incomingUserMessage: userMessage,
            fallbackMealType: selectedMealType
        )
    }

    private func loadReusableMeals() {
        BackendService.fetchReusableMeals { result in
            DispatchQueue.main.async {
                if case .success(let response) = result {
                    favoriteMeals = response.favoriteMeals
                    recentMeals = response.recentMeals
                }
            }
        }
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
                    loadReusableMeals()
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

struct LogActionButton: View {
    let title: String
    let icon: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: icon)
                .font(.caption.weight(.semibold))
                .foregroundColor(MacroMeshTheme.primaryDark)
                .frame(maxWidth: .infinity, minHeight: 38)
                .background(MacroMeshTheme.cardSubtle)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

struct LogActionSectionHeader: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.caption.weight(.semibold))
            .foregroundColor(MacroMeshTheme.muted)
            .textCase(.uppercase)
            .tracking(0.8)
    }
}

struct QuickMealRail: View {
    let title: String
    let emptyText: String
    let meals: [ReusableMealSummary]
    let label: String
    let onSelect: (ReusableMealSummary) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundColor(MacroMeshTheme.muted)
            if meals.isEmpty {
                Text(emptyText)
                    .font(.caption2)
                    .foregroundColor(MacroMeshTheme.muted)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(meals) { meal in
                            QuickRepeatMealButton(meal: meal, label: label) {
                                onSelect(meal)
                            }
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }
}

struct QuickRepeatMealButton: View {
    let meal: ReusableMealSummary
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 4) {
                Text(label)
                    .font(.caption2.weight(.bold))
                    .foregroundColor(MacroMeshTheme.primary)
                    .textCase(.uppercase)
                Text(meal.title)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.text)
                    .lineLimit(2)
                Text("\(Int(meal.totalCalories)) cal")
                    .font(.caption2)
                    .foregroundColor(MacroMeshTheme.muted)
            }
            .frame(width: 144, alignment: .leading)
            .padding(10)
            .background(MacroMeshTheme.cardSubtle)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Review \(meal.title)")
    }
}

struct FoodSearchSheet: View {
    let onSelect: (FoodSearchResult) -> Void
    let onQuickAdd: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""
    @State private var results: [FoodSearchResult] = []
    @State private var isLoading = false
    @State private var message: String?

    var body: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 14) {
                TextField("Search foods", text: $query)
                    .textFieldStyle(MacroMeshTextFieldStyle())
                    .submitLabel(.search)
                    .onSubmit(search)
                    .accessibilityLabel("Search foods")
                Button(action: search) {
                    if isLoading { ProgressView().tint(.white) } else { Label("Search", systemImage: "magnifyingglass") }
                }
                .buttonStyle(PrimaryCTAButtonStyle())
                .disabled(isLoading || query.trimmingCharacters(in: .whitespacesAndNewlines).count < 2)
                if let message {
                    Text(message)
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }
                ScrollView {
                    LazyVStack(spacing: 10) {
                        ForEach(results) { result in
                            FoodSearchResultRow(result: result) {
                                onSelect(result)
                                dismiss()
                            }
                        }
                    }
                }
                if results.isEmpty && !isLoading {
                    Button("Quick Add Calories/Macros") {
                        onQuickAdd()
                    }
                    .buttonStyle(SecondaryCTAButtonStyle())
                }
            }
            .padding(18)
            .navigationTitle("Food Search")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
        }
    }

    private func search() {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 2 else { return }
        isLoading = true
        message = nil
        BackendService.searchFoods(query: trimmed) { result in
            DispatchQueue.main.async {
                isLoading = false
                switch result {
                case .success(let response):
                    results = response.results
                    message = response.results.isEmpty ? "No verified, custom, recent, or favorite match found. Try a manual Quick Add or describe the food." : nil
                case .failure(let error):
                    message = RetryCopy.nonDestructiveFailure(action: "search foods", error: error)
                }
            }
        }
    }
}

struct BarcodeLookupSheet: View {
    let prefersCamera: Bool
    let onFound: (FoodSearchResult) -> Void
    let onCreateCustomFood: (String) -> Void
    let onQuickAdd: (String) -> Void
    let onDescribeWithAI: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var barcode = ""
    @State private var isLoading = false
    @State private var permissionState = BarcodeCameraPermissionState.current
    @State private var isScannerVisible = false
    @State private var message = "Scan a package barcode or enter UPC/EAN digits manually."

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    scannerPermissionCard
                    Text(message)
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                    TextField("Barcode digits", text: $barcode)
                        .keyboardType(.numberPad)
                        .textFieldStyle(MacroMeshTextFieldStyle())
                        .accessibilityLabel("Barcode digits")
                    Button(action: lookup) {
                        if isLoading { ProgressView().tint(.white) } else { Label("Look Up Barcode", systemImage: "barcode") }
                    }
                    .buttonStyle(PrimaryCTAButtonStyle())
                    .disabled(isLoading || !fallbackModel.canLookup)
                    VStack(spacing: 10) {
                        HStack(spacing: 10) {
                            Button("Create Custom") {
                                onCreateCustomFood(fallbackModel.normalizedBarcode)
                            }
                            .buttonStyle(SecondaryCTAButtonStyle())
                            Button("Quick Add") {
                                onQuickAdd(fallbackModel.normalizedBarcode)
                            }
                            .buttonStyle(SecondaryCTAButtonStyle())
                        }
                        Button("Describe with AI") {
                            onDescribeWithAI(fallbackModel.normalizedBarcode)
                        }
                        .buttonStyle(SecondaryCTAButtonStyle())
                        .accessibilityLabel("Describe barcode item with AI")
                    }
                }
                .padding(18)
            }
            .navigationTitle(prefersCamera ? "Scan Barcode" : "Enter Barcode")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
            .onAppear {
                permissionState = .current
                if prefersCamera && permissionState == .authorized {
                    isScannerVisible = true
                }
            }
        }
    }

    private var fallbackModel: BarcodeLookupFallbackModel {
        BarcodeLookupFallbackModel(barcode: barcode)
    }

    @ViewBuilder
    private var scannerPermissionCard: some View {
        AppCard(padding: 14) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    Image(systemName: permissionState.allowsScanning ? "barcode.viewfinder" : "camera.fill")
                        .font(.headline)
                        .foregroundColor(MacroMeshTheme.primary)
                        .frame(width: 34, height: 34)
                        .background(MacroMeshTheme.cardSubtle)
                        .clipShape(Circle())
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Camera barcode scanner")
                            .font(.subheadline.weight(.bold))
                            .foregroundColor(MacroMeshTheme.text)
                        Text(permissionState.permissionCopy)
                            .font(.caption)
                            .foregroundColor(MacroMeshTheme.muted)
                    }
                }
                if permissionState.allowsScanning && isScannerVisible {
                    BarcodeScannerPreview { scannedCode in
                        barcode = scannedCode.filter(\.isNumber)
                        isScannerVisible = false
                        lookup()
                    }
                    .frame(height: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .accessibilityLabel("Live barcode scanner")
                }
                Button(permissionState.allowsScanning ? (isScannerVisible ? "Hide Camera" : "Open Camera") : "Enable Camera Scanner") {
                    handleCameraButton()
                }
                .buttonStyle(SecondaryCTAButtonStyle())
                .disabled(permissionState == .denied || permissionState == .restricted || permissionState == .unavailable)
            }
        }
    }

    private func handleCameraButton() {
        permissionState = .current
        switch permissionState {
        case .authorized:
            isScannerVisible.toggle()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    permissionState = granted ? .authorized : .denied
                    isScannerVisible = granted
                }
            }
        case .denied, .restricted, .unavailable:
            isScannerVisible = false
        }
    }

    private func lookup() {
        let digits = fallbackModel.normalizedBarcode
        guard fallbackModel.canLookup else { return }
        isLoading = true
        BackendService.lookupBarcode(digits) { result in
            DispatchQueue.main.async {
                isLoading = false
                switch result {
                case .success(let response):
                    if let found = response.result {
                        onFound(found)
                        dismiss()
                    } else {
                        message = "No trusted barcode match yet. Create a custom food, quick add macros, or describe the package with AI."
                    }
                case .failure(let error):
                    message = RetryCopy.nonDestructiveFailure(action: "look up that barcode", error: error)
                }
            }
        }
    }
}

struct BarcodeScannerPreview: UIViewControllerRepresentable {
    let onCode: (String) -> Void

    func makeUIViewController(context: Context) -> BarcodeScannerViewController {
        BarcodeScannerViewController(onCode: onCode)
    }

    func updateUIViewController(_ uiViewController: BarcodeScannerViewController, context: Context) {}
}

final class BarcodeScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    private let session = AVCaptureSession()
    private let onCode: (String) -> Void
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var didScan = false

    init(onCode: @escaping (String) -> Void) {
        self.onCode = onCode
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        return nil
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor.black
        configureSession()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if session.isRunning {
            session.stopRunning()
        }
    }

    private func configureSession() {
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device),
              session.canAddInput(input) else {
            addStatusLabel("Camera unavailable")
            return
        }

        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else {
            addStatusLabel("Barcode scanner unavailable")
            return
        }

        session.beginConfiguration()
        session.addInput(input)
        session.addOutput(output)
        let supportedTypes: [AVMetadataObject.ObjectType] = [.ean8, .ean13, .upce, .code39, .code93, .code128, .pdf417, .qr]
        output.metadataObjectTypes = supportedTypes.filter { output.availableMetadataObjectTypes.contains($0) }
        output.setMetadataObjectsDelegate(self, queue: DispatchQueue(label: "macromesh.barcode-scanner"))
        session.commitConfiguration()

        let previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill
        previewLayer.frame = view.bounds
        view.layer.insertSublayer(previewLayer, at: 0)
        self.previewLayer = previewLayer

        DispatchQueue.global(qos: .userInitiated).async {
            self.session.startRunning()
        }
    }

    private func addStatusLabel(_ text: String) {
        let label = UILabel()
        label.text = text
        label.textColor = .white
        label.font = .preferredFont(forTextStyle: .headline)
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            label.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 16),
            label.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -16)
        ])
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard !didScan,
              let object = metadataObjects.compactMap({ $0 as? AVMetadataMachineReadableCodeObject }).first,
              let value = object.stringValue,
              !value.isEmpty else {
            return
        }
        didScan = true
        DispatchQueue.main.async {
            self.onCode(value)
        }
    }
}

struct QuickAddSheet: View {
    let barcode: String?
    let onCreate: (MealRequestItem) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var calories = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var error: String?

    var body: some View {
        NavigationView {
            Form {
                Section("Calories and macros") {
                    TextField("Calories required", text: $calories)
                        .keyboardType(.decimalPad)
                    TextField("Protein optional", text: $protein)
                        .keyboardType(.decimalPad)
                    TextField("Carbs optional", text: $carbs)
                        .keyboardType(.decimalPad)
                    TextField("Fat optional", text: $fat)
                        .keyboardType(.decimalPad)
                }
                if let barcode, !barcode.isEmpty {
                    Section("Barcode") {
                        Text(barcode)
                            .font(.caption)
                            .foregroundColor(MacroMeshTheme.muted)
                    }
                }
                if let error {
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.red)
                }
            }
            .navigationTitle("Quick Add")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Review") {
                        guard let item = buildItem() else {
                            error = "Enter non-negative numbers and at least calories."
                            return
                        }
                        onCreate(item)
                        dismiss()
                    }
                }
            }
        }
    }

    private func buildItem() -> MealRequestItem? {
        guard let caloriesValue = Double(calories.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            return nil
        }
        return ManualQuickAddBuilder.build(
            calories: caloriesValue,
            protein: Double(protein.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0,
            carbs: Double(carbs.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0,
            fat: Double(fat.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0,
            barcode: barcode
        )
    }
}

struct CustomFoodEditorSheet: View {
    let initialBarcode: String?
    let onCreate: (FoodSearchResult) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var brand = ""
    @State private var barcode = ""
    @State private var servingQuantity = "1"
    @State private var servingUnit = "serving"
    @State private var calories = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var error: String?

    var body: some View {
        NavigationView {
            Form {
                Section("Food") {
                    TextField("Name", text: $name)
                    TextField("Brand optional", text: $brand)
                    TextField("Barcode optional", text: $barcode)
                        .keyboardType(.numberPad)
                    TextField("Serving quantity", text: $servingQuantity)
                        .keyboardType(.decimalPad)
                    TextField("Serving unit", text: $servingUnit)
                }
                Section("Macros") {
                    TextField("Calories", text: $calories)
                        .keyboardType(.decimalPad)
                    TextField("Protein", text: $protein)
                        .keyboardType(.decimalPad)
                    TextField("Carbs", text: $carbs)
                        .keyboardType(.decimalPad)
                    TextField("Fat", text: $fat)
                        .keyboardType(.decimalPad)
                }
                if let error {
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.red)
                }
            }
            .navigationTitle("Custom Food")
            .onAppear {
                if barcode.isEmpty {
                    barcode = initialBarcode ?? ""
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        save()
                    }
                }
            }
        }
    }

    private func save() {
        let cleanedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanedName.isEmpty,
              let servingQuantityValue = Double(servingQuantity),
              let caloriesValue = Double(calories),
              let proteinValue = Double(protein),
              let carbsValue = Double(carbs),
              let fatValue = Double(fat),
              servingQuantityValue > 0,
              caloriesValue >= 0,
              proteinValue >= 0,
              carbsValue >= 0,
              fatValue >= 0 else {
            error = "Enter a name, serving, and non-negative macro values."
            return
        }

        let cleanedBrand = brand.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanedBarcode = barcode.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanedServingUnit = ServingUnitFormatter.clean(servingUnit)

        let request = CustomFoodRequest(
            name: cleanedName,
            brand: cleanedBrand.isEmpty ? nil : cleanedBrand,
            barcode: cleanedBarcode.isEmpty ? nil : cleanedBarcode,
            servingQuantity: servingQuantityValue,
            servingUnit: cleanedServingUnit,
            calories: caloriesValue,
            protein: proteinValue,
            carbs: carbsValue,
            fat: fatValue,
            fiber: 0,
            sugar: 0,
            sodium: 0
        )
        BackendService.createCustomFood(request: request) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let customFood):
                    onCreate(customFood)
                    dismiss()
                case .failure(let failure):
                    error = RetryCopy.nonDestructiveFailure(action: "save that custom food", error: failure)
                }
            }
        }
    }
}

struct PhotoAttachmentFoundationSheet: View {
    let onQuickAdd: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var selectedItem: PhotosPickerItem?
    @State private var previewImage: UIImage?
    @State private var draft: MealPhotoDraft?
    @State private var message = "Attach a meal photo locally as a draft note. Backend photo upload/storage is not enabled in this build."

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Meal photo attachments")
                        .font(.title3.weight(.bold))
                        .foregroundColor(MacroMeshTheme.text)
                    Text(message)
                        .font(.subheadline)
                        .foregroundColor(MacroMeshTheme.muted)
                    PhotosPicker(selection: $selectedItem, matching: .images, photoLibrary: .shared()) {
                        Label("Choose Meal Photo", systemImage: "photo.on.rectangle")
                    }
                    .buttonStyle(PrimaryCTAButtonStyle())
                    .accessibilityLabel("Choose meal photo")
                    if let previewImage {
                        Image(uiImage: previewImage)
                            .resizable()
                            .scaledToFill()
                            .frame(maxWidth: .infinity)
                            .frame(height: 190)
                            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                            .accessibilityLabel("Selected meal photo preview")
                    }
                    if let draft {
                        AppCard(padding: 14) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(draft.filename)
                                    .font(.subheadline.weight(.bold))
                                    .foregroundColor(MacroMeshTheme.text)
                                Text(draft.storageStatus)
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(MacroMeshTheme.orange)
                                Text("This photo is not uploaded or attached to saved meals yet. Use it as a visual reference while entering calories/macros.")
                                    .font(.caption)
                                    .foregroundColor(MacroMeshTheme.muted)
                            }
                        }
                        .accessibilityLabel(draft.accessibilityLabel)
                    }
                    Button("Add calories/macros manually") {
                        onQuickAdd()
                    }
                    .buttonStyle(SecondaryCTAButtonStyle())
                    Spacer(minLength: 20)
                }
                .padding(18)
            }
            .onChange(of: selectedItem) { _, item in
                loadPhoto(item)
            }
            .navigationTitle("Meal Photo")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
        }
    }

    private func loadPhoto(_ item: PhotosPickerItem?) {
        guard let item else { return }
        Task {
            do {
                guard let data = try await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else {
                    message = "That photo could not be loaded. Try another image or use Quick Add."
                    return
                }
                previewImage = image
                draft = MealPhotoDraft(
                    itemIdentifier: item.itemIdentifier,
                    filename: item.itemIdentifier ?? "Selected meal photo",
                    hasLocalPreview: true
                )
                message = "Photo selected locally. Nothing is uploaded, analyzed, or saved until backend storage is added later."
            } catch {
                message = "That photo could not be loaded. Try another image or use Quick Add."
            }
        }
    }
}

struct NutritionLabelFoundationSheet: View {
    let onReview: (MealRequestItem) -> Void
    let onQuickAdd: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var selectedItem: PhotosPickerItem?
    @State private var previewImage: UIImage?
    @State private var ocrResult: NutritionLabelOCRResult?
    @State private var foodName = ""
    @State private var calories = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var message = "Choose a nutrition label photo. MacroMesh extracts text only; you verify and enter the nutrition values."
    @State private var isProcessing = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Nutrition label scan")
                        .font(.title3.weight(.bold))
                        .foregroundColor(MacroMeshTheme.text)
                    Text(message)
                        .font(.subheadline)
                        .foregroundColor(MacroMeshTheme.muted)
                    PhotosPicker(selection: $selectedItem, matching: .images, photoLibrary: .shared()) {
                        Label("Choose Label Photo", systemImage: "doc.text.viewfinder")
                    }
                    .buttonStyle(PrimaryCTAButtonStyle())
                    .accessibilityLabel("Choose nutrition label photo")
                    if isProcessing {
                        AssistantTypingCard()
                    }
                    if let previewImage {
                        Image(uiImage: previewImage)
                            .resizable()
                            .scaledToFill()
                            .frame(maxWidth: .infinity)
                            .frame(height: 160)
                            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                            .accessibilityLabel("Selected nutrition label photo preview")
                    }
                    if let ocrResult, ocrResult.hasUsableText {
                        AppCard(padding: 14) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Extracted text")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundColor(MacroMeshTheme.text)
                                Text(ocrResult.rawText)
                                    .font(.caption)
                                    .foregroundColor(MacroMeshTheme.muted)
                                    .textSelection(.enabled)
                            }
                        }
                    }
                    manualEntryFields
                    HStack(spacing: 10) {
                        Button("Manual Quick Add") {
                            onQuickAdd()
                        }
                        .buttonStyle(SecondaryCTAButtonStyle())
                        Button("Review") {
                            reviewManualValues()
                        }
                        .buttonStyle(PrimaryCTAButtonStyle())
                    }
                    Spacer(minLength: 20)
                }
                .padding(18)
            }
            .onChange(of: selectedItem) { _, item in
                loadLabelPhoto(item)
            }
            .navigationTitle("Scan Label")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
            }
        }
    }

    private var manualEntryFields: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Enter verified values")
                .font(.caption.weight(.semibold))
                .foregroundColor(MacroMeshTheme.muted)
            TextField("Food name", text: $foodName)
                .textFieldStyle(MacroMeshTextFieldStyle())
                .accessibilityLabel("Food name from nutrition label")
            TextField("Calories", text: $calories)
                .keyboardType(.decimalPad)
                .textFieldStyle(MacroMeshTextFieldStyle())
                .accessibilityLabel("Calories from nutrition label")
            HStack(spacing: 8) {
                TextField("Protein", text: $protein)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(MacroMeshTextFieldStyle())
                    .accessibilityLabel("Protein from nutrition label")
                TextField("Carbs", text: $carbs)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(MacroMeshTextFieldStyle())
                    .accessibilityLabel("Carbs from nutrition label")
                TextField("Fat", text: $fat)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(MacroMeshTextFieldStyle())
                    .accessibilityLabel("Fat from nutrition label")
            }
        }
    }

    private func loadLabelPhoto(_ item: PhotosPickerItem?) {
        guard let item else { return }
        isProcessing = true
        message = "Reading label text. Values will stay manual until you confirm them."
        Task {
            do {
                guard let data = try await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data) else {
                    isProcessing = false
                    message = "That image could not be loaded. Enter the label values manually."
                    return
                }
                previewImage = image
                recognizeText(in: image)
            } catch {
                isProcessing = false
                message = "That image could not be loaded. Enter the label values manually."
            }
        }
    }

    private func recognizeText(in image: UIImage) {
        guard let cgImage = image.cgImage else {
            isProcessing = false
            message = "That image could not be read. Enter the label values manually."
            return
        }

        let request = VNRecognizeTextRequest { request, error in
            let strings = (request.results as? [VNRecognizedTextObservation])?
                .compactMap { $0.topCandidates(1).first?.string } ?? []
            DispatchQueue.main.async {
                isProcessing = false
                ocrResult = NutritionLabelOCRResult.fromRecognizedText(strings)
                message = ocrResult?.hasUsableText == true
                    ? "Text extracted. Verify the label and enter calories/macros manually before review."
                    : "No reliable text was found. Enter the label values manually."
                if let firstFoodLine = ocrResult?.lines.first, foodName.isEmpty, !firstFoodLine.lowercased().contains("nutrition") {
                    foodName = firstFoodLine
                }
                if error != nil && ocrResult?.hasUsableText != true {
                    message = "OCR could not read this label. Enter the label values manually."
                }
            }
        }
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try VNImageRequestHandler(cgImage: cgImage, options: [:]).perform([request])
            } catch {
                DispatchQueue.main.async {
                    isProcessing = false
                    message = "OCR could not read this label. Enter the label values manually."
                }
            }
        }
    }

    private func reviewManualValues() {
        guard let caloriesValue = Double(calories.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            message = "Enter calories from the label before review."
            return
        }
        guard let item = NutritionLabelManualEntryBuilder.build(
            foodName: foodName,
            calories: caloriesValue,
            protein: Double(protein.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0,
            carbs: Double(carbs.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0,
            fat: Double(fat.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0,
            extractedText: ocrResult?.rawText
        ) else {
            message = "Enter a food name and non-negative label values before review."
            return
        }
        onReview(item)
        dismiss()
    }
}

struct FoodSearchResultRow: View {
    let result: FoodSearchResult
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                FoodAvatar(name: result.name)
                VStack(alignment: .leading, spacing: 4) {
                    Text(result.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(MacroMeshTheme.text)
                        .lineLimit(2)
                    Text("\(Int(result.calories)) cal | \(Int(result.protein))g protein | \(result.servingQuantity.cleanServingQuantity) \(result.servingUnit)")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                    Text(result.sourceLabel)
                        .font(.caption2.weight(.bold))
                        .foregroundColor(MacroMeshTheme.primary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .foregroundColor(MacroMeshTheme.muted)
            }
            .padding(12)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(MacroMeshTheme.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Review \(result.name)")
    }
}

extension Double {
    var cleanServingQuantity: String {
        self == floor(self) ? String(Int(self)) : String(format: "%.1f", self)
    }
}

struct ChatBubble: View {
    let role: String
    let text: String

    var isUser: Bool { role == "user" }

    var body: some View {
        HStack(alignment: .bottom, spacing: 10) {
            if isUser { Spacer(minLength: 44) }
            VStack(alignment: isUser ? .trailing : .leading, spacing: 6) {
                Text(isUser ? "You" : "MacroMesh")
                    .font(.caption2.weight(.bold))
                    .foregroundColor(MacroMeshTheme.muted)
                Text(text)
                    .font(.body)
                    .foregroundColor(isUser ? .white : MacroMeshTheme.text)
                    .multilineTextAlignment(isUser ? .trailing : .leading)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(isUser ? MacroMeshTheme.primary : MacroMeshTheme.card)
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(isUser ? Color.clear : MacroMeshTheme.border, lineWidth: 1)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .shadow(color: MacroMeshTheme.shadow.opacity(isUser ? 0.16 : 0.10), radius: 10, x: 0, y: 6)
                    .frame(maxWidth: 320, alignment: isUser ? .trailing : .leading)
                    .accessibilityLabel((isUser ? "You: " : "MacroMesh: ") + text)
            }
            if !isUser { Spacer(minLength: 44) }
        }
        .animation(.easeInOut(duration: 0.18), value: text)
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
