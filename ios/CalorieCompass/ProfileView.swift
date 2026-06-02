// ProfileView.swift
// Calorie Compass iOS - Phase 5 native profile and account status
// Native Profile with backend fetch/edit/confirm, robust states
import AuthenticationServices
import Foundation
import SwiftUI
import UserNotifications

struct ProfileData: Codable, Equatable {
    var name: String
    var age: Int?
    var heightCm: Int?
    var weightLbs: Double?
    var goal: String?
    var activityLevel: String?
    var dailyCalorieGoal: Int?
    var proteinGoal: Int?
    var nutritionPreferences: String?
}

struct ProfileView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @State private var profile: ProfileData? = nil
    @State private var loading = false
    @State private var error: String? = nil
    @State private var editing = false
    @State private var saveError: String? = nil
    @State private var dirtyProfile: ProfileData? = nil
    @State private var saving = false
    @State private var showConfirmSave = false
    @State private var showSuccess = false
    @State private var showGoalWizard = false
    @State private var showWeightSheet = false
    @State private var analytics: AnalyticsResponse?
    @State private var weightEntries: WeightEntriesResponse?
    @State private var customFoods: [CustomFoodSummary] = []
    @State private var reminderSettings = ReminderSettings.standard
    @State private var showReminderSheet = false
    @State private var showCustomFoodSheet = false
    @State private var profileActionMessage: String?
    @FocusState private var focusedProfileField: Bool
    private let stabilityReporter = ConsoleStabilityReporter()

    var body: some View {
        NavigationView {
            MacroMeshScreen {
                if loading && profile == nil {
                    VStack(spacing: 12) {
                        ProgressView()
                        Text("Preparing your profile…")
                            .font(.headline)
                            .foregroundColor(MacroMeshTheme.text)
                        Text("MacroMesh is loading your guest defaults.")
                            .font(.caption)
                            .foregroundColor(MacroMeshTheme.muted)
                    }
                    .padding()
                } else if let error = error {
                    ProfileFallbackView(message: profileFallbackMessage(error), retry: loadProfile)
                } else if profile == nil {
                    ProfileFallbackView(message: "Your guest profile will appear here once MacroMesh finishes setup.", retry: loadProfile)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            if editing {
                                ProfileEditorCard(
                                    profile: $dirtyProfile,
                                    saveError: saveError,
                                    saving: saving,
                                    onCancel: {
                                        focusedProfileField = false
                                        editing = false
                                        dirtyProfile = profile
                                    },
                                    onSave: {
                                        focusedProfileField = false
                                        showConfirmSave = true
                                    }
                                )
                            } else {
                                ProfileSummaryCard(profile: profile, isGuest: sessionStore.state.authSession.isGuest)
                                GoalSetupCard(profile: profile, onLaunch: { showGoalWizard = true })
                                AnalyticsSummaryCard(analytics: analytics)
                                WeeklyReportCard(report: analytics?.weeklyReport)
                                WeightTrackingCard(response: weightEntries, onLogWeight: { showWeightSheet = true })
                                ReminderSettingsCard(settings: reminderSettings, onOpen: { showReminderSheet = true })
                                CustomFoodsCard(customFoods: customFoods, onCreate: { showCustomFoodSheet = true }, onDelete: deleteCustomFood)
                                AppStorePolishCard()
                                if let profileActionMessage {
                                    Text(profileActionMessage)
                                        .font(.caption)
                                        .foregroundColor(MacroMeshTheme.primaryDark)
                                }
                                Button("Edit Profile") {
                                    dirtyProfile = profile; editing = true
                                }
                                .buttonStyle(PrimaryCTAButtonStyle())
                                .padding(.top, 4)
                                if sessionStore.state.authSession.isSignedIn {
                                    AccountStatusSection(response: sessionStore.state.sessionResponse)
                                    AccountSignInEntryPoint(
                                        authSession: sessionStore.state.authSession,
                                        onSessionChanged: sessionStore.refresh
                                    )
                                    SessionAndPrivacyNote()
                                } else {
                                    GuestProfileNote()
                                }
                                if showSuccess {
                                    Text("Profile updated! Save confirmed.").foregroundColor(.green)
                                }
                            }
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 16)
                        .padding(.bottom, 96)
                    }
                }
            }
            .navigationTitle("Profile")
            .onAppear {
                reminderSettings = ReminderScheduler.load()
                loadProfile()
                loadGrowthData()
                loadCustomFoods()
            }
            .scrollDismissesKeyboard(.interactively)
            .sheet(isPresented: $showGoalWizard) {
                GoalSetupWizardSheet(profile: profile) { result in
                    applyGoalSetup(result)
                }
            }
            .sheet(isPresented: $showWeightSheet) {
                WeightEntrySheet(latestWeight: weightEntries?.trend.latestWeightLbs ?? profile?.weightLbs) { weight in
                    logWeight(weight)
                }
            }
            .sheet(isPresented: $showReminderSheet) {
                ReminderSettingsSheet(settings: reminderSettings) { settings in
                    saveReminderSettings(settings)
                }
            }
            .sheet(isPresented: $showCustomFoodSheet) {
                CustomFoodEditorSheet { draft in
                    createCustomFood(draft)
                }
            }
            .alert(isPresented: $showConfirmSave) {
                Alert(
                    title: Text("Confirm save?"),
                    message: Text("Save changes to your profile?"),
                    primaryButton: .destructive(Text("Save")) {
                        saveProfile()
                    },
                    secondaryButton: .cancel() {
                        showConfirmSave = false
                    }
                )
            }
        }
    }

    private func loadProfile() {
        loading = true; error = nil
        BackendService.fetchProfile { result in
            DispatchQueue.main.async {
                loading = false
                switch result {
                case .success(let raw):
                    profile = raw; dirtyProfile = raw
                case .failure(let err):
                    sessionStore.apply(err)
                    stabilityReporter.record(.networkFailure(screen: "Profile", message: err.localizedDescription))
                    error = err.localizedDescription
                }
            }
        }
    }

    private func loadGrowthData() {
        BackendService.fetchAnalytics { result in
            DispatchQueue.main.async {
                if case .success(let response) = result {
                    analytics = response
                }
            }
        }
        BackendService.fetchWeightEntries { result in
            DispatchQueue.main.async {
                if case .success(let response) = result {
                    weightEntries = response
                }
            }
        }
    }

    private func loadCustomFoods() {
        BackendService.fetchCustomFoods { result in
            DispatchQueue.main.async {
                if case .success(let response) = result {
                    customFoods = response.customFoods
                }
            }
        }
    }

    private func saveReminderSettings(_ settings: ReminderSettings) {
        let sanitized = settings.sanitized
        reminderSettings = sanitized
        profileActionMessage = "Saving reminders..."
        ReminderScheduler.save(sanitized)
        ReminderScheduler.apply(sanitized) { result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    profileActionMessage = sanitized.hasEnabledReminder ? "Reminders updated." : "Reminders turned off."
                case .failure(let error):
                    profileActionMessage = "Reminder settings were saved, but iOS could not schedule them: \(error.localizedDescription)"
                }
            }
        }
    }

    private func createCustomFood(_ draft: CustomFoodDraft) {
        profileActionMessage = "Saving custom food..."
        BackendService.createCustomFood(request: draft.request) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let customFood):
                    customFoods.insert(customFood, at: 0)
                    profileActionMessage = "Custom food saved."
                case .failure(let error):
                    sessionStore.apply(error)
                    profileActionMessage = RetryCopy.nonDestructiveFailure(action: "save that custom food", error: error)
                }
            }
        }
    }

    private func deleteCustomFood(_ customFood: CustomFoodSummary) {
        profileActionMessage = "Deleting \(customFood.name)..."
        BackendService.deleteCustomFood(id: customFood.id) { result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    customFoods.removeAll { $0.id == customFood.id }
                    profileActionMessage = "Custom food deleted."
                case .failure(let error):
                    sessionStore.apply(error)
                    profileActionMessage = RetryCopy.nonDestructiveFailure(action: "delete that custom food", error: error)
                }
            }
        }
    }

    private func profileFallbackMessage(_ error: String) -> String {
        if error.localizedCaseInsensitiveContains("profile") || error.localizedCaseInsensitiveContains("no data") {
            return "Your guest profile is still getting ready. Nothing was changed — reload in a moment."
        }
        return "We couldn’t refresh Profile yet. Nothing was changed — check your connection and try again."
    }

    private func saveProfile() {
        saving = true; saveError = nil
        guard let candidate = dirtyProfile else {
            saving = false
            saveError = "Profile changes are unavailable. Reload and try again."
            return
        }
        BackendService.saveProfile(candidate) { result in
            DispatchQueue.main.async {
                saving = false; showConfirmSave = false
                switch result {
                case .success(let saved):
                    profile = saved; editing = false; showSuccess = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { showSuccess = false }
                case .failure(let err):
                    sessionStore.apply(err)
                    stabilityReporter.record(.networkFailure(screen: "Profile", message: err.localizedDescription))
                    saveError = RetryCopy.nonDestructiveFailure(action: "save your profile", error: err)
                }
            }
        }
    }

    private func applyGoalSetup(_ result: GoalSetupResult) {
        var candidate = profile ?? ProfileData(name: result.name.nilIfBlank ?? "Guest", age: nil, heightCm: nil, weightLbs: nil, goal: nil, activityLevel: nil, dailyCalorieGoal: nil, proteinGoal: nil, nutritionPreferences: nil)
        if let name = result.name.nilIfBlank {
            candidate.name = name
        }
        candidate.weightLbs = result.weightLbs
        candidate.goal = result.goal
        candidate.activityLevel = result.activityLevel
        candidate.dailyCalorieGoal = result.targets.dailyCalorieGoal
        candidate.proteinGoal = result.targets.proteinGoal
        dirtyProfile = candidate
        saving = true
        profileActionMessage = "Saving goal setup..."
        BackendService.saveProfile(candidate) { saveResult in
            DispatchQueue.main.async {
                saving = false
                switch saveResult {
                case .success(let saved):
                    profile = saved
                    dirtyProfile = saved
                    profileActionMessage = "Goals updated."
                    loadGrowthData()
                case .failure(let error):
                    sessionStore.apply(error)
                    profileActionMessage = RetryCopy.nonDestructiveFailure(action: "save your goals", error: error)
                }
            }
        }
    }

    private func logWeight(_ weight: Double) {
        profileActionMessage = "Saving weight..."
        BackendService.createWeightEntry(weightLbs: weight) { result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    profile?.weightLbs = weight
                    dirtyProfile = profile
                    profileActionMessage = "Weight logged."
                    loadGrowthData()
                case .failure(let error):
                    sessionStore.apply(error)
                    profileActionMessage = RetryCopy.nonDestructiveFailure(action: "save that weight", error: error)
                }
            }
        }
    }
}

struct GoalSetupResult: Equatable {
    let name: String
    let weightLbs: Double
    let goalWeightLbs: Double?
    let goal: String
    let activityLevel: String
    let targets: GoalTargets
}

struct ReminderSettings: Codable, Equatable {
    static let standard = ReminderSettings(mealReminderEnabled: false, weeklyReportEnabled: false, reminderHour: 20, reminderMinute: 0, quietHoursEnabled: true)

    let mealReminderEnabled: Bool
    let weeklyReportEnabled: Bool
    let reminderHour: Int
    let reminderMinute: Int
    let quietHoursEnabled: Bool

    var sanitized: ReminderSettings {
        let allowedHours = quietHoursEnabled ? 5...22 : 0...23
        return ReminderSettings(
            mealReminderEnabled: mealReminderEnabled,
            weeklyReportEnabled: weeklyReportEnabled,
            reminderHour: allowedHours.contains(reminderHour) ? reminderHour : ReminderSettings.standard.reminderHour,
            reminderMinute: (0...59).contains(reminderMinute) ? reminderMinute : ReminderSettings.standard.reminderMinute,
            quietHoursEnabled: quietHoursEnabled
        )
    }

    var hasEnabledReminder: Bool {
        mealReminderEnabled || weeklyReportEnabled
    }

    var reminderTimeLabel: String {
        String(format: "%02d:%02d", sanitized.reminderHour, sanitized.reminderMinute)
    }
}

enum ReminderScheduler {
    private static let storageKey = "macromesh.reminder-settings.v1"
    private static let mealIdentifier = "macromesh.meal-reminder"
    private static let weeklyIdentifier = "macromesh.weekly-report-reminder"

    static func load() -> ReminderSettings {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let decoded = try? JSONDecoder().decode(ReminderSettings.self, from: data) else {
            return .standard
        }

        return decoded.sanitized
    }

    static func save(_ settings: ReminderSettings) {
        if let data = try? JSONEncoder().encode(settings.sanitized) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }

    static func apply(_ settings: ReminderSettings, completion: @escaping (Result<Void, Error>) -> Void) {
        let sanitized = settings.sanitized
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [mealIdentifier, weeklyIdentifier])

        guard sanitized.hasEnabledReminder else {
            completion(.success(()))
            return
        }

        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if let error {
                completion(.failure(error))
                return
            }
            guard granted else {
                completion(.success(()))
                return
            }

            if sanitized.mealReminderEnabled {
                var dateComponents = DateComponents()
                dateComponents.hour = sanitized.reminderHour
                dateComponents.minute = sanitized.reminderMinute
                let content = UNMutableNotificationContent()
                content.title = "Log dinner when you are ready"
                content.body = "A quick meal note keeps today's nutrition picture useful."
                content.sound = .default
                let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
                center.add(UNNotificationRequest(identifier: mealIdentifier, content: content, trigger: trigger))
            }

            if sanitized.weeklyReportEnabled {
                var dateComponents = DateComponents()
                dateComponents.weekday = 2
                dateComponents.hour = 9
                dateComponents.minute = 0
                let content = UNMutableNotificationContent()
                content.title = "Weekly MacroMesh report"
                content.body = "Review your logging streak, protein days, and calorie consistency."
                content.sound = .default
                let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
                center.add(UNNotificationRequest(identifier: weeklyIdentifier, content: content, trigger: trigger))
            }

            completion(.success(()))
        }
    }
}

struct CustomFoodDraft: Equatable {
    let name: String
    let brand: String?
    let servingQuantity: Double
    let servingUnit: String
    let calories: Double
    let protein: Double
    let carbs: Double
    let fat: Double
    let fiber: Double
    let sugar: Double
    let sodium: Double

    var request: CustomFoodRequest {
        CustomFoodRequest(
            name: name,
            brand: brand,
            servingQuantity: servingQuantity,
            servingUnit: servingUnit,
            calories: calories,
            protein: protein,
            carbs: carbs,
            fat: fat,
            fiber: fiber,
            sugar: sugar,
            sodium: sodium
        )
    }
}

struct GoalSetupCard: View {
    let profile: ProfileData?
    let onLaunch: () -> Void

    var body: some View {
        AppCard(padding: 16) {
            HStack(spacing: 12) {
                Image(systemName: "target")
                    .font(.title2)
                    .foregroundColor(MacroMeshTheme.primary)
                    .frame(width: 40, height: 40)
                    .background(MacroMeshTheme.cardSubtle)
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 4) {
                    Text(profile?.dailyCalorieGoal == nil ? "Set up goals" : "Update goals")
                        .font(.headline)
                        .foregroundColor(MacroMeshTheme.text)
                    Text("Guided calories and protein defaults for your current goal.")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }
                Spacer()
                Button("Start", action: onLaunch)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(MacroMeshTheme.primary)
                    .clipShape(Capsule())
            }
        }
    }
}

struct AnalyticsSummaryCard: View {
    let analytics: AnalyticsResponse?

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Analytics", subtitle: analytics?.analytics.macroConsistencySummary ?? "Log meals to unlock weekly patterns.")
                HStack(spacing: 10) {
                    MetricPill(title: "7-day cal", value: "\(Int(analytics?.analytics.sevenDayAverageCalories ?? 0))", icon: "chart.bar.fill", tint: MacroMeshTheme.primary)
                    MetricPill(title: "7-day protein", value: "\(Int(analytics?.analytics.sevenDayAverageProtein ?? 0))g", icon: "bolt.fill", tint: MacroMeshTheme.blue)
                }
                HStack(spacing: 10) {
                    MetricPill(title: "30-day cal", value: "\(Int(analytics?.analytics.thirtyDayAverageCalories ?? 0))", icon: "calendar", tint: MacroMeshTheme.orange)
                    MetricPill(title: "Best protein", value: "\(Int(analytics?.analytics.highestProteinDay?.protein ?? 0))g", icon: "star.fill", tint: MacroMeshTheme.purple)
                }
            }
        }
    }
}

struct WeeklyReportCard: View {
    let report: WeeklyReportSummary?

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Weekly report", subtitle: report?.summary ?? "Save meals this week to unlock your report.")
                HStack(spacing: 10) {
                    MetricPill(title: "Logged", value: "\(report?.loggedDays ?? 0)/7", icon: "calendar.badge.checkmark", tint: MacroMeshTheme.primary)
                    MetricPill(title: "Protein", value: "\(report?.proteinTargetDays ?? 0)d", icon: "bolt.fill", tint: MacroMeshTheme.blue)
                }
                ForEach(Array((report?.highlights ?? ["No weekly highlights yet."]).prefix(3)), id: \.self) { highlight in
                    Label(highlight, systemImage: "checkmark.seal.fill")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }
            }
        }
    }
}

struct WeightTrackingCard: View {
    let response: WeightEntriesResponse?
    let onLogWeight: () -> Void

    private var subtitle: String {
        guard let latestWeight = response?.trend.latestWeightLbs else {
            return "Track weight without changing your goals automatically."
        }

        return String(format: "Latest %.1f lbs", latestWeight)
    }

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    SectionHeader("Weight", subtitle: subtitle)
                    Spacer()
                    Button("Log", action: onLogWeight)
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(MacroMeshTheme.primary)
                        .clipShape(Capsule())
                }
                if let trend = response?.trend, trend.latestWeightLbs != nil {
                    Text("\(trend.changeLbs, specifier: "%.1f") lbs \(trend.direction) across recent entries")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }
                ForEach(Array((response?.entries ?? []).prefix(3))) { entry in
                    HStack {
                        Text(entry.date.prefix(10))
                            .font(.caption)
                            .foregroundColor(MacroMeshTheme.muted)
                        Spacer()
                        Text("\(entry.weightLbs, specifier: "%.1f") lbs")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(MacroMeshTheme.text)
                    }
                }
            }
        }
    }
}

struct ReminderSettingsCard: View {
    let settings: ReminderSettings
    let onOpen: () -> Void

    private var detail: String {
        if settings.mealReminderEnabled && settings.weeklyReportEnabled {
            return "Meal reminder at \(settings.reminderTimeLabel), plus a weekly check-in."
        }
        if settings.mealReminderEnabled {
            return "Meal reminder at \(settings.reminderTimeLabel)."
        }
        if settings.weeklyReportEnabled {
            return "Weekly report reminders are on."
        }
        return "Local reminders are off."
    }

    var body: some View {
        AppCard(padding: 16) {
            HStack(spacing: 12) {
                Image(systemName: "bell.badge.fill")
                    .font(.title2)
                    .foregroundColor(MacroMeshTheme.primary)
                    .frame(width: 40, height: 40)
                    .background(MacroMeshTheme.cardSubtle)
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 4) {
                    Text("Reminders")
                        .font(.headline)
                        .foregroundColor(MacroMeshTheme.text)
                    Text(detail)
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }
                Spacer()
                Button("Edit", action: onOpen)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(MacroMeshTheme.primary)
                    .clipShape(Capsule())
            }
        }
    }
}

struct CustomFoodsCard: View {
    let customFoods: [CustomFoodSummary]
    let onCreate: () -> Void
    let onDelete: (CustomFoodSummary) -> Void

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    SectionHeader("Custom foods", subtitle: customFoods.isEmpty ? "Create foods you eat often." : "\(customFoods.count) saved custom foods")
                    Spacer()
                    Button("New", action: onCreate)
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(MacroMeshTheme.primary)
                        .clipShape(Capsule())
                }
                if customFoods.isEmpty {
                    Text("Add foods you eat often, then use them from Log as quick add buttons.")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                } else {
                    ForEach(Array(customFoods.prefix(4))) { food in
                        HStack(spacing: 10) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(food.name)
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundColor(MacroMeshTheme.text)
                                Text("\(food.servingLabel) | \(Int(food.calories)) cal | \(Int(food.protein))g protein")
                                    .font(.caption)
                                    .foregroundColor(MacroMeshTheme.muted)
                            }
                            Spacer()
                            Button(role: .destructive) {
                                onDelete(food)
                            } label: {
                                Image(systemName: "trash")
                            }
                            .foregroundColor(.red)
                            .accessibilityLabel("Delete \(food.name)")
                        }
                    }
                }
            }
        }
    }
}

struct AppStorePolishCard: View {
    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader("Privacy and review", subtitle: "Clear controls before anything reaches your log.")
                Label("Reminders stay on this iPhone.", systemImage: "bell")
                Label("Custom foods sync only with your account.", systemImage: "person.crop.circle.badge.checkmark")
                Label("Nutrition estimates still wait for your review.", systemImage: "checkmark.seal")
            }
            .font(.caption)
            .foregroundColor(MacroMeshTheme.muted)
        }
    }
}

struct GoalSetupWizardSheet: View {
    let profile: ProfileData?
    let onSave: (GoalSetupResult) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var weightText: String
    @State private var goalWeightText: String
    @State private var goal: String
    @State private var activityLevel: String
    @State private var ratePerWeek: Double = 1
    @State private var highProtein = true

    init(profile: ProfileData?, onSave: @escaping (GoalSetupResult) -> Void) {
        self.profile = profile
        self.onSave = onSave
        _name = State(initialValue: profile?.name ?? "")
        _weightText = State(initialValue: profile?.weightLbs.map { String(Int($0)) } ?? "")
        _goalWeightText = State(initialValue: "")
        _goal = State(initialValue: profile?.goal ?? "MAINTAIN")
        _activityLevel = State(initialValue: profile?.activityLevel ?? "MODERATE")
    }

    private var weight: Double {
        Double(weightText.trimmingCharacters(in: .whitespacesAndNewlines)) ?? profile?.weightLbs ?? 180
    }

    private var goalWeight: Double? {
        Double(goalWeightText.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    private var targets: GoalTargets {
        GoalSetupCalculator.calculate(
            weightLbs: weight,
            goalWeightLbs: goalWeight,
            goal: goal,
            activityLevel: activityLevel,
            ratePerWeekLbs: ratePerWeek,
            proteinPreference: highProtein ? .high : .moderate
        )
    }

    var body: some View {
        NavigationView {
            Form {
                Section("Basics") {
                    TextField("Name", text: $name)
                    TextField("Current weight", text: $weightText)
                        .keyboardType(.decimalPad)
                    TextField("Goal weight optional", text: $goalWeightText)
                        .keyboardType(.decimalPad)
                }
                Section("Goal") {
                    Picker("Goal", selection: $goal) {
                        Text("Lose").tag("LOSE_WEIGHT")
                        Text("Maintain").tag("MAINTAIN")
                        Text("Gain").tag("GAIN_MUSCLE")
                    }
                    Picker("Activity", selection: $activityLevel) {
                        Text("Low").tag("LOW")
                        Text("Moderate").tag("MODERATE")
                        Text("High").tag("HIGH")
                        Text("Very high").tag("VERY_HIGH")
                    }
                    Stepper("Rate \(ratePerWeek, specifier: "%.1f") lb/week", value: $ratePerWeek, in: 0...2, step: 0.5)
                    Toggle("Protein forward", isOn: $highProtein)
                }
                Section("Suggested targets") {
                    LabeledContent("Calories", value: "\(targets.dailyCalorieGoal) cal")
                    LabeledContent("Protein", value: "\(targets.proteinGoal)g")
                    LabeledContent("Carbs", value: "\(targets.carbsGoal)g")
                    LabeledContent("Fat", value: "\(targets.fatGoal)g")
                }
            }
            .navigationTitle("Goal setup")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(GoalSetupResult(name: name, weightLbs: weight, goalWeightLbs: goalWeight, goal: goal, activityLevel: activityLevel, targets: targets))
                        dismiss()
                    }
                }
            }
        }
    }
}

struct WeightEntrySheet: View {
    let latestWeight: Double?
    let onSave: (Double) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var weightText: String

    init(latestWeight: Double?, onSave: @escaping (Double) -> Void) {
        self.latestWeight = latestWeight
        self.onSave = onSave
        _weightText = State(initialValue: latestWeight.map { String(Int($0)) } ?? "")
    }

    var body: some View {
        NavigationView {
            Form {
                Section("Weight") {
                    TextField("Weight in lbs", text: $weightText)
                        .keyboardType(.decimalPad)
                }
            }
            .navigationTitle("Log weight")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if let weight = Double(weightText.trimmingCharacters(in: .whitespacesAndNewlines)) {
                            onSave(weight)
                            dismiss()
                        }
                    }
                }
            }
        }
    }
}

struct ReminderSettingsSheet: View {
    let onSave: (ReminderSettings) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var mealReminderEnabled: Bool
    @State private var weeklyReportEnabled: Bool
    @State private var reminderHour: Int
    @State private var reminderMinute: Int
    @State private var quietHoursEnabled: Bool

    private var hourLabel: String {
        String(format: "Hour %02d", reminderHour)
    }

    private var minuteLabel: String {
        String(format: "Minute %02d", reminderMinute)
    }

    private var hourRange: ClosedRange<Int> {
        quietHoursEnabled ? 5...22 : 0...23
    }

    init(settings: ReminderSettings, onSave: @escaping (ReminderSettings) -> Void) {
        self.onSave = onSave
        let sanitized = settings.sanitized
        _mealReminderEnabled = State(initialValue: sanitized.mealReminderEnabled)
        _weeklyReportEnabled = State(initialValue: sanitized.weeklyReportEnabled)
        _reminderHour = State(initialValue: sanitized.reminderHour)
        _reminderMinute = State(initialValue: sanitized.reminderMinute)
        _quietHoursEnabled = State(initialValue: sanitized.quietHoursEnabled)
    }

    var body: some View {
        NavigationView {
            Form {
                Section("Reminders") {
                    Toggle("Meal reminder", isOn: $mealReminderEnabled)
                    Toggle("Weekly report", isOn: $weeklyReportEnabled)
                    Toggle("Quiet hours", isOn: $quietHoursEnabled)
                }
                Section("Meal reminder time") {
                    Stepper(hourLabel, value: $reminderHour, in: hourRange)
                    Stepper(minuteLabel, value: $reminderMinute, in: 0...55, step: 5)
                }
                Section("Privacy") {
                    Text("MacroMesh schedules these locally on this iPhone. There is no push server in this build.")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }
            }
            .navigationTitle("Reminders")
            .onChange(of: quietHoursEnabled) { _, isEnabled in
                if isEnabled && !(5...22).contains(reminderHour) {
                    reminderHour = ReminderSettings.standard.reminderHour
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(ReminderSettings(
                            mealReminderEnabled: mealReminderEnabled,
                            weeklyReportEnabled: weeklyReportEnabled,
                            reminderHour: reminderHour,
                            reminderMinute: reminderMinute,
                            quietHoursEnabled: quietHoursEnabled
                        ))
                        dismiss()
                    }
                }
            }
        }
    }
}

struct CustomFoodEditorSheet: View {
    let onSave: (CustomFoodDraft) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var brand = ""
    @State private var servingQuantity = "1"
    @State private var servingUnit = "serving"
    @State private var calories = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var fiber = "0"
    @State private var sugar = "0"
    @State private var sodium = "0"

    private var draft: CustomFoodDraft? {
        guard let servingQuantityValue = Double(servingQuantity.trimmingCharacters(in: .whitespacesAndNewlines)),
              let caloriesValue = Double(calories.trimmingCharacters(in: .whitespacesAndNewlines)),
              let proteinValue = Double(protein.trimmingCharacters(in: .whitespacesAndNewlines)),
              let carbsValue = Double(carbs.trimmingCharacters(in: .whitespacesAndNewlines)),
              let fatValue = Double(fat.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            return nil
        }

        let cleanedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanedUnit = servingUnit.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanedName.isEmpty, !cleanedUnit.isEmpty, servingQuantityValue > 0 else {
            return nil
        }

        return CustomFoodDraft(
            name: cleanedName,
            brand: brand.nilIfBlank,
            servingQuantity: servingQuantityValue,
            servingUnit: cleanedUnit,
            calories: max(0, caloriesValue),
            protein: max(0, proteinValue),
            carbs: max(0, carbsValue),
            fat: max(0, fatValue),
            fiber: max(0, Double(fiber.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0),
            sugar: max(0, Double(sugar.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0),
            sodium: max(0, Double(sodium.trimmingCharacters(in: .whitespacesAndNewlines)) ?? 0)
        )
    }

    var body: some View {
        NavigationView {
            Form {
                Section("Food") {
                    TextField("Name", text: $name)
                    TextField("Brand optional", text: $brand)
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
                Section("Optional details") {
                    TextField("Fiber", text: $fiber)
                        .keyboardType(.decimalPad)
                    TextField("Sugar", text: $sugar)
                        .keyboardType(.decimalPad)
                    TextField("Sodium mg", text: $sodium)
                        .keyboardType(.decimalPad)
                }
            }
            .navigationTitle("Custom food")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if let draft {
                            onSave(draft)
                            dismiss()
                        }
                    }
                    .disabled(draft == nil)
                }
            }
        }
    }
}

struct AccountStatusSection: View {
    let response: SessionResponse?

    private var title: String {
        response?.account?.title ?? "Account tools are in progress"
    }

    private var description: String {
        response?.account?.description ?? "Native Sign in with Apple uses backend verification and remains optional while account tools are polished."
    }

    private var providers: [AuthProviderSnapshot] {
        response?.account?.providers ?? [
            AuthProviderSnapshot(
                id: "apple",
                label: "Continue with Apple",
                status: "planned",
                detail: "Apple sign-in can request a backend-issued session; account-management polish and TestFlight auth QA are still pending."
            )
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Account status")
                .font(.headline)
            Text(title)
                .font(.subheadline)
                .fontWeight(.semibold)
            Text(description)
                .font(.footnote)
                .foregroundColor(MacroMeshTheme.muted)
            ForEach(providers) { provider in
                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text(provider.displayLabel)
                            .font(.subheadline)
                            .fontWeight(.medium)
                        Spacer()
                        Text(provider.isAvailable ? "Available" : "In progress")
                            .font(.caption)
                            .foregroundColor(provider.isAvailable ? .green : .secondary)
                    }
                    if let detail = provider.detail {
                        Text(detail)
                            .font(.caption)
                            .foregroundColor(MacroMeshTheme.muted)
                    }
                }
                .padding(10)
                .background(Color.secondary.opacity(0.10))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .padding(.top, 12)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Account status. Apple sign-in remains optional and guest mode remains available.")
    }
}

struct ProfileFallbackView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "person.crop.circle")
                .font(.largeTitle)
                .foregroundColor(.accentColor)
            Text("Guest profile")
                .font(.title3)
                .fontWeight(.semibold)
            Text(message)
                .font(.subheadline)
                .foregroundColor(MacroMeshTheme.muted)
                .multilineTextAlignment(.center)
            Button("Reload profile", action: retry)
                .buttonStyle(PrimaryCTAButtonStyle())
        }
        .padding(20)
        .frame(maxWidth: .infinity)
        .background(MacroMeshTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .padding()
    }
}

struct ProfileEditorCard: View {
    @Binding var profile: ProfileData?
    let saveError: String?
    let saving: Bool
    let onCancel: () -> Void
    let onSave: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Edit profile")
                    .font(.title3)
                    .fontWeight(.semibold)
                Text("Update the defaults MacroMesh uses for goals and nutrition context.")
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.muted)
            }

            ProfileTextField(title: "Name", placeholder: "Guest", text: textBinding(\.name))
            ProfileNumberField(title: "Age", placeholder: "Add age", value: intBinding(\.age), keyboard: .numberPad)
            ProfileNumberField(title: "Height", placeholder: "cm", value: intBinding(\.heightCm), keyboard: .numberPad)
            ProfileDecimalField(title: "Weight", placeholder: "lbs", value: doubleBinding(\.weightLbs))
            ProfileNumberField(title: "Daily calories", placeholder: "2000", value: intBinding(\.dailyCalorieGoal), keyboard: .numberPad)
            ProfileNumberField(title: "Protein goal", placeholder: "120g", value: intBinding(\.proteinGoal), keyboard: .numberPad)
            ProfileTextField(title: "Preferences", placeholder: "High protein, vegetarian, etc.", text: textBinding(\.nutritionPreferences))

            if let saveError {
                Text(saveError)
                    .font(.caption)
                    .foregroundColor(.red)
            }

            HStack(spacing: 12) {
                Button("Cancel", action: onCancel)
                    .buttonStyle(SecondaryCTAButtonStyle())
                    .frame(maxWidth: .infinity)
                Button(saving ? "Saving…" : "Save changes", action: onSave)
                    .buttonStyle(PrimaryCTAButtonStyle())
                    .frame(maxWidth: .infinity)
                    .disabled(saving)
            }
        }
        .padding(16)
        .background(MacroMeshTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func ensureProfile() -> ProfileData {
        if let profile { return profile }
        let fallback = ProfileData(name: "Guest", age: nil, heightCm: nil, weightLbs: nil, goal: nil, activityLevel: nil, dailyCalorieGoal: nil, proteinGoal: nil, nutritionPreferences: nil)
        profile = fallback
        return fallback
    }

    private func textBinding(_ keyPath: WritableKeyPath<ProfileData, String?>) -> Binding<String> {
        Binding(
            get: { profile?[keyPath: keyPath] ?? "" },
            set: { newValue in
                var updated = ensureProfile()
                updated[keyPath: keyPath] = newValue.nilIfBlank
                profile = updated
            }
        )
    }

    private func textBinding(_ keyPath: WritableKeyPath<ProfileData, String>) -> Binding<String> {
        Binding(
            get: { profile?[keyPath: keyPath] ?? "" },
            set: { newValue in
                var updated = ensureProfile()
                updated[keyPath: keyPath] = newValue
                profile = updated
            }
        )
    }

    private func intBinding(_ keyPath: WritableKeyPath<ProfileData, Int?>) -> Binding<String> {
        Binding(
            get: { profile?[keyPath: keyPath].map(String.init) ?? "" },
            set: { newValue in
                var updated = ensureProfile()
                updated[keyPath: keyPath] = Int(newValue.trimmingCharacters(in: .whitespacesAndNewlines))
                profile = updated
            }
        )
    }

    private func doubleBinding(_ keyPath: WritableKeyPath<ProfileData, Double?>) -> Binding<String> {
        Binding(
            get: { profile?[keyPath: keyPath].map { String(Int($0)) } ?? "" },
            set: { newValue in
                var updated = ensureProfile()
                updated[keyPath: keyPath] = Double(newValue.trimmingCharacters(in: .whitespacesAndNewlines))
                profile = updated
            }
        )
    }
}

struct ProfileTextField: View {
    let title: String
    let placeholder: String
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption).foregroundColor(MacroMeshTheme.muted)
            TextField(placeholder, text: $text)
                .textFieldStyle(.roundedBorder)
        }
    }
}

struct ProfileNumberField: View {
    let title: String
    let placeholder: String
    @Binding var value: String
    let keyboard: UIKeyboardType

    var body: some View {
        ProfileTextField(title: title, placeholder: placeholder, text: $value)
            .keyboardType(keyboard)
    }
}

struct ProfileDecimalField: View {
    let title: String
    let placeholder: String
    @Binding var value: String

    var body: some View {
        ProfileTextField(title: title, placeholder: placeholder, text: $value)
            .keyboardType(.decimalPad)
    }
}

struct ProfileSummaryCard: View {
    let profile: ProfileData?
    let isGuest: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(profile?.name.nilIfBlank ?? (isGuest ? "Guest profile" : "Profile"))
                        .font(.title3)
                        .fontWeight(.semibold)
                    Text(isGuest ? "Guest session" : "Account profile")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }
                Spacer()
                Text(isGuest ? "Guest" : "Synced")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 5)
                    .background(Color.orange.opacity(isGuest ? 0.16 : 0.0))
                    .clipShape(Capsule())
            }
            Divider()
            ProfileInfoRow(label: "Daily calories", value: profile?.dailyCalorieGoal.map { "\($0) cal" } ?? "Add goal")
            ProfileInfoRow(label: "Protein", value: profile?.proteinGoal.map { "\($0)g" } ?? "Add protein")
            ProfileInfoRow(label: "Height", value: profile?.heightCm.map { "\($0) cm" } ?? "Add height")
            ProfileInfoRow(label: "Weight", value: profile?.weightLbs.map { "\(Int($0)) lbs" } ?? "Add weight")
            ProfileInfoRow(label: "Preferences", value: profile?.nutritionPreferences?.nilIfBlank ?? "Add preferences")
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MacroMeshTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct ProfileInfoRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(.subheadline)
                .foregroundColor(MacroMeshTheme.muted)
            Spacer()
            Text(value)
                .font(.subheadline)
                .fontWeight(.medium)
                .multilineTextAlignment(.trailing)
        }
    }
}

struct GuestProfileNote: View {
    var body: some View {
        Text("You can keep using MacroMesh as a guest. Edit Profile lets you tune local defaults without changing sign-in or account settings.")
            .font(.footnote)
            .foregroundColor(MacroMeshTheme.muted)
            .padding(.top, 4)
    }
}

extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    var nilIfBlankForTesting: String? { nilIfBlank }
}

struct AccountSignInEntryPoint: View {
    let authSession: AuthSession
    let onSessionChanged: () -> Void
    private let authService = AppleAuthService()
    @State private var interactionState: AuthInteractionState = .idle
    @State private var showDeleteAccountConfirmation = false

    private var accountContent: AccountManagementVisibility {
        AccountManagementContent.visibility(for: authSession)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(authSession.isGuest ? "Guest mode" : "Account")
                .font(.headline)
            Text(accountContent.message)
                .font(.footnote)
                .foregroundColor(MacroMeshTheme.muted)

            if authSession.isSignedIn {
                Button {
                    migrateGuestData()
                } label: {
                    Label("Migrate guest data", systemImage: "arrow.triangle.2.circlepath")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(SecondaryCTAButtonStyle())
                .disabled(interactionState.isWorking)
                .accessibilityHint("Moves eligible guest meals, goals, and history into this signed-in account.")

                Button {
                    exportAccountData()
                } label: {
                    Label("Export account data", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(SecondaryCTAButtonStyle())
                .disabled(interactionState.isWorking)
                .accessibilityHint("Requests a server export for only this signed-in account.")

                Button(role: .destructive) {
                    showDeleteAccountConfirmation = true
                } label: {
                    Label("Delete account data", systemImage: "trash")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(SecondaryCTAButtonStyle())
                .disabled(interactionState.isWorking)
                .accessibilityHint("Requires confirmation and deletes only the signed-in account data handled by the backend endpoint.")

                Button(role: .destructive) {
                    signOut()
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(SecondaryCTAButtonStyle())
                .disabled(interactionState.isWorking)
                .accessibilityHint("Revokes the backend-issued native session when possible and clears local secure storage.")
            } else {
                SignInWithAppleButton(.continue) { request in
                    authService.configureAppleRequest(request)
                } onCompletion: { result in
                    handleAppleAuthorization(result)
                }
                .signInWithAppleButtonStyle(.black)
                .frame(height: 46)
                .disabled(interactionState.isWorking)
                .accessibilityLabel("Continue with Apple")
                .accessibilityHint("Starts Apple's secure sign-in sheet. Guest mode remains available if sign-in fails or is cancelled.")
            }

            switch interactionState {
            case .idle:
                EmptyView()
            case .signingIn:
                ProgressView("Signing in with Apple...")
                    .font(.caption)
            case .signingOut:
                ProgressView("Signing out...")
                    .font(.caption)
            case .migratingGuest:
                ProgressView("Migrating guest data...")
                    .font(.caption)
            case .exportingAccount:
                ProgressView("Exporting account data...")
                    .font(.caption)
            case .deletingAccount:
                ProgressView("Deleting account data...")
                    .font(.caption)
            case .success(let message):
                Text(message)
                    .font(.caption)
                    .foregroundColor(.green)
            case .error(let message):
                Text(message)
                    .font(.caption)
                    .foregroundColor(.red)
            }
        }
        .padding(.top, 12)
        .alert(isPresented: $showDeleteAccountConfirmation) {
            Alert(
                title: Text(AccountManagementContent.deleteConfirmationTitle),
                message: Text(AccountManagementContent.deleteConfirmationMessage),
                primaryButton: .destructive(Text("Delete account data")) {
                    deleteAccount()
                },
                secondaryButton: .cancel()
            )
        }
    }

    private func handleAppleAuthorization(_ result: Result<ASAuthorization, Error>) {
        interactionState = .signingIn
        authService.handleAppleAuthorizationResult(result) { serviceResult in
            DispatchQueue.main.async {
                switch serviceResult {
                case .success(.signedIn):
                    interactionState = .success("Signed in. Refreshing account status...")
                    onSessionChanged()
                case .success(.unavailable(let message)):
                    interactionState = .error(message)
                case .success:
                    interactionState = .idle
                    onSessionChanged()
                case .failure(let error):
                    interactionState = .error(error.localizedDescription)
                }
            }
        }
    }

    private func signOut() {
        interactionState = .signingOut
        authService.signOut { result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    interactionState = .success("Signed out. Guest mode is available.")
                    onSessionChanged()
                case .failure(let error):
                    interactionState = .error(error.localizedDescription)
                }
            }
        }
    }

    private func migrateGuestData() {
        interactionState = .migratingGuest
        BackendService.migrateGuestData { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let response):
                    interactionState = .success(response.successMessage)
                    onSessionChanged()
                case .failure(let error):
                    interactionState = .error(AccountManagementContent.failureMessage(action: "migrate guest data", error: error))
                }
            }
        }
    }

    private func exportAccountData() {
        interactionState = .exportingAccount
        BackendService.exportNativeAccountData { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let response):
                    interactionState = .success("\(response.successMessage) Download/share polish remains before App Store account tooling is final.")
                case .failure(let error):
                    interactionState = .error(AccountManagementContent.failureMessage(action: "export account data", error: error))
                }
            }
        }
    }

    private func deleteAccount() {
        interactionState = .deletingAccount
        BackendService.deleteNativeAccount { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let response):
                    authService.clearLocalSessionAfterAccountDeletion()
                    interactionState = .success("\(response.successMessage) Guest mode is available.")
                    onSessionChanged()
                case .failure(let error):
                    interactionState = .error(AccountManagementContent.failureMessage(action: "delete account data", error: error))
                }
            }
        }
    }
}

struct SessionAndPrivacyNote: View {
    var body: some View {
        Text("Apple sign-in uses backend token verification and server-issued sessions. Account migration, export, and deletion endpoints are wired here for QA, but TestFlight readiness and App Store compliance are not claimed.")
            .font(.footnote)
            .foregroundColor(MacroMeshTheme.muted)
            .padding(.top, 8)
            .accessibilityLabel("Apple sign-in uses backend verification and server-issued sessions. Account tools are wired for QA, but TestFlight readiness and App Store compliance are not claimed.")
    }
}

private enum AuthInteractionState: Equatable {
    case idle
    case signingIn
    case signingOut
    case migratingGuest
    case exportingAccount
    case deletingAccount
    case success(String)
    case error(String)

    var isWorking: Bool {
        switch self {
        case .signingIn, .signingOut, .migratingGuest, .exportingAccount, .deletingAccount:
            return true
        case .idle, .success, .error:
            return false
        }
    }
}

struct AccountManagementVisibility: Equatable {
    let canUseAccountActions: Bool
    let message: String
}

enum AccountManagementContent {
    static let deleteConfirmationTitle = "Delete account data?"
    static let deleteConfirmationMessage = "This deletes only the signed-in account data handled by the backend endpoint and revokes active native sessions. Guest data that was not migrated is not deleted. This is not a claim of App Store compliance until real-device QA and final support/privacy flows are complete."

    static func visibility(for session: AuthSession) -> AccountManagementVisibility {
        if session.isSignedIn {
            return AccountManagementVisibility(
                canUseAccountActions: true,
                message: "Signed in with a backend-issued MacroMesh session. You can migrate guest data, request an account export, delete account data, or sign out."
            )
        }

        return AccountManagementVisibility(
            canUseAccountActions: false,
            message: "You can keep logging meals as a guest. Sign in with Apple to use migration, export, and delete account actions; sign-in remains optional."
        )
    }

    static func failureMessage(action: String, error: Error) -> String {
        "Could not \(action). \(error.localizedDescription) Nothing else was changed."
    }
}
