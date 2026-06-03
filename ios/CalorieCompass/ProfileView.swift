// ProfileView.swift
// Calorie Compass iOS - Phase 5 native profile and account status
// Native Profile with backend fetch/edit/confirm, robust states
import AuthenticationServices
import Charts
import Foundation
import SwiftUI

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
    @State private var dashboard: DashboardResponse?
    @State private var weightEntries: WeightEntriesResponse?
    @State private var profileActionMessage: String?
    @State private var showWeeklyReport = false
    @State private var showReminders = false
    @State private var showPrivacyAbout = false
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
                    ProfileFallbackView(message: "We couldn’t load Profile yet. Your guest session is safe — try again.", retry: loadProfile)
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
                                let model = ProfileDashboardModel.build(
                                    profile: profile,
                                    isGuest: sessionStore.state.authSession.isGuest,
                                    analytics: analytics,
                                    dashboard: dashboard,
                                    weightEntries: weightEntries
                                )
                                ProfileDashboardView(
                                    model: model,
                                    weightEntries: weightEntries,
                                    onUpdateGoals: { showGoalWizard = true },
                                    onLogWeight: { showWeightSheet = true },
                                    onWeeklyReport: { showWeeklyReport = true },
                                    onCustomFoods: { NotificationCenter.default.post(name: .macroMeshOpenLogTab, object: nil) },
                                    onReminders: { showReminders = true },
                                    onPrivacyAbout: { showPrivacyAbout = true }
                                )

                                if let profileActionMessage {
                                    AppCard(padding: 12) {
                                        Text(profileActionMessage)
                                            .font(.caption)
                                            .foregroundColor(MacroMeshTheme.primaryDark)
                                    }
                                }

                                Button("Edit profile") {
                                    dirtyProfile = profile; editing = true
                                }
                                .buttonStyle(PrimaryCTAButtonStyle())
                                .padding(.top, 2)
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
                loadProfile()
                loadGrowthData()
            }
            .scrollDismissesKeyboard(.interactively)
            .sheet(isPresented: $showGoalWizard) {
                GoalSetupWizardSheet(profile: profile) { result in
                    applyGoalSetup(result)
                }
            }
            .sheet(isPresented: $showWeightSheet) {
                WeightEntrySheet(weightEntries: weightEntries, latestWeight: weightEntries?.trend.latestWeightLbs ?? profile?.weightLbs) { weight in
                    logWeight(weight)
                }
            }
            .sheet(isPresented: $showWeeklyReport) {
                WeeklyReportSheet(analytics: analytics, dashboard: dashboard, weightEntries: weightEntries)
            }
            .sheet(isPresented: $showReminders) {
                RemindersEntrySheet()
            }
            .sheet(isPresented: $showPrivacyAbout) {
                PrivacyAboutSheet(isGuest: sessionStore.state.authSession.isGuest)
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

        BackendService.fetchDashboard { result in
            DispatchQueue.main.async {
                if case .success(let response) = result {
                    dashboard = response
                }
            }
        }
    }

    private func profileFallbackMessage(_ error: String) -> String {
        if error.localizedCaseInsensitiveContains("profile") || error.localizedCaseInsensitiveContains("no data") {
            return "We couldn’t load Profile details yet. Guest defaults are still available — reload in a moment."
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
            MacroMeshScreen {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        AppCard(padding: 18) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Goal setup")
                                    .font(.title2.weight(.bold))
                                    .foregroundColor(MacroMeshTheme.text)
                                Text("Set targets that feel motivating — then adjust as you learn what works.")
                                    .font(.subheadline)
                                    .foregroundColor(MacroMeshTheme.muted)
                            }
                        }

                        goalSummaryCard
                        basicsCard
                        goalTypeCard
                        activityCard
                        rateCard
                        proteinForwardCard
                        targetsCard

                        Button {
                            onSave(GoalSetupResult(name: name, weightLbs: weight, goalWeightLbs: goalWeight, goal: goal, activityLevel: activityLevel, targets: targets))
                            dismiss()
                        } label: {
                            Label("Save goals", systemImage: "checkmark.circle.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(PrimaryCTAButtonStyle())
                        .padding(.top, 4)
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
                    .padding(.bottom, 28)
                }
            }
            .navigationTitle("Goal setup")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private var goalSummaryCard: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Goal summary", subtitle: "A quick snapshot before you choose targets.")

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    GoalSummaryTile(title: "Current", value: String(format: "%.0f lb", weight), icon: "scalemass", tint: MacroMeshTheme.primary)
                    GoalSummaryTile(title: "Goal", value: goalWeight.map { String(format: "%.0f lb", $0) } ?? "Optional", icon: "target", tint: MacroMeshTheme.orange)
                }

                if let goalWeight {
                    Text(String(format: "%.0f lb remaining", max(weight - goalWeight, 0)))
                        .font(.caption.weight(.semibold))
                        .foregroundColor(MacroMeshTheme.muted)
                } else {
                    Text("Add a goal weight if you want an estimated remaining amount.")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }
            }
        }
    }

    private var basicsCard: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Basics", subtitle: "Used to personalize your targets.")
                TextField("Name", text: $name)
                    .textFieldStyle(.roundedBorder)
                TextField("Current weight (lbs)", text: $weightText)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)
                TextField("Goal weight (optional)", text: $goalWeightText)
                    .keyboardType(.decimalPad)
                    .textFieldStyle(.roundedBorder)
            }
        }
    }

    private var goalTypeCard: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Goal type", subtitle: "Choose one — you can change it anytime.")
                LazyVGrid(columns: [GridItem(.flexible())], spacing: 10) {
                    SelectableCard(title: "Lose Weight", subtitle: "Cut calories while keeping protein high.", icon: "arrow.down", selected: goal == "LOSE_WEIGHT") {
                        goal = "LOSE_WEIGHT"
                    }
                    SelectableCard(title: "Maintain", subtitle: "Hold steady and build consistency.", icon: "equal", selected: goal == "MAINTAIN") {
                        goal = "MAINTAIN"
                    }
                    SelectableCard(title: "Gain Weight", subtitle: "Add calories with protein support.", icon: "arrow.up", selected: goal == "GAIN_MUSCLE") {
                        goal = "GAIN_MUSCLE"
                    }
                }
            }
        }
    }

    private var activityCard: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Activity", subtitle: "Pick what matches your typical week.")
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ActivityCardOption(title: "Sedentary", subtitle: "Desk-heavy days", selected: activityLevel == "LOW") { activityLevel = "LOW" }
                    ActivityCardOption(title: "Light", subtitle: "Walks + some training", selected: activityLevel == "MODERATE") { activityLevel = "MODERATE" }
                    ActivityCardOption(title: "High", subtitle: "Hard training most days", selected: activityLevel == "HIGH") { activityLevel = "HIGH" }
                    ActivityCardOption(title: "Very High", subtitle: "Athletic workload", selected: activityLevel == "VERY_HIGH") { activityLevel = "VERY_HIGH" }
                }
            }
        }
    }

    private var rateCard: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Weight change rate", subtitle: "Choose a weekly pace.")
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    RateOption(title: "0.5 lb/week", selected: ratePerWeek == 0.5) { ratePerWeek = 0.5 }
                    RateOption(title: "1.0 lb/week", selected: ratePerWeek == 1.0) { ratePerWeek = 1.0 }
                    RateOption(title: "1.5 lb/week", selected: ratePerWeek == 1.5) { ratePerWeek = 1.5 }
                    RateOption(title: "2.0 lb/week", selected: ratePerWeek == 2.0) { ratePerWeek = 2.0 }
                }
            }
        }
    }

    private var proteinForwardCard: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Protein forward", subtitle: "Higher protein supports satiety and muscle retention.")
                Toggle(isOn: $highProtein) {
                    Text("Prioritize protein")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(MacroMeshTheme.text)
                }
                .toggleStyle(SwitchToggleStyle(tint: MacroMeshTheme.primary))
                Text("This nudges your protein target up while keeping calories appropriate for your goal.")
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.muted)
            }
        }
    }

    private var targetsCard: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Macro targets", subtitle: "A 2×2 dashboard view of your daily targets.")

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    MacroTargetTile(title: "Calories", value: "\(targets.dailyCalorieGoal)", subtitle: "Daily Target", icon: "flame.fill", tint: MacroMeshTheme.orange)
                    MacroTargetTile(title: "Protein", value: "\(targets.proteinGoal)g", subtitle: "Muscle Support", icon: "bolt.heart.fill", tint: MacroMeshTheme.primary)
                    MacroTargetTile(title: "Carbs", value: "\(targets.carbsGoal)g", subtitle: "Energy", icon: "leaf", tint: MacroMeshTheme.blue)
                    MacroTargetTile(title: "Fat", value: "\(targets.fatGoal)g", subtitle: "Hormonal Health", icon: "drop.fill", tint: MacroMeshTheme.purple)
                }
            }
        }
    }
}

private struct SelectableCard: View {
    let title: String
    let subtitle: String
    let icon: String
    let selected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .foregroundColor(selected ? .white : MacroMeshTheme.primary)
                    .frame(width: 32, height: 32)
                    .background((selected ? MacroMeshTheme.primary : MacroMeshTheme.cardSubtle))
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(MacroMeshTheme.text)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }
                Spacer()
                if selected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(MacroMeshTheme.primary)
                }
            }
            .padding(14)
            .background(selected ? MacroMeshTheme.primary.opacity(0.08) : MacroMeshTheme.cardSubtle.opacity(0.7))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(selected ? "\(title), selected" : title)
    }
}

private struct ActivityCardOption: View {
    let title: String
    let subtitle: String
    let selected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.text)
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.muted)
                Spacer(minLength: 0)
            }
            .padding(12)
            .frame(maxWidth: .infinity, minHeight: 74, alignment: .leading)
            .background(selected ? MacroMeshTheme.primary.opacity(0.10) : MacroMeshTheme.cardSubtle.opacity(0.7))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(selected ? MacroMeshTheme.primary.opacity(0.45) : Color.clear, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(selected ? "\(title), selected" : title)
    }
}

private struct RateOption: View {
    let title: String
    let selected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.text)
                Spacer()
                Image(systemName: selected ? "largecircle.fill.circle" : "circle")
                    .foregroundColor(selected ? MacroMeshTheme.primary : MacroMeshTheme.muted)
            }
            .padding(12)
            .frame(maxWidth: .infinity)
            .background(selected ? MacroMeshTheme.primary.opacity(0.10) : MacroMeshTheme.cardSubtle.opacity(0.7))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(selected ? "\(title), selected" : title)
    }
}

private struct MacroTargetTile: View {
    let title: String
    let value: String
    let subtitle: String
    let icon: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(tint)
                Spacer()
            }
            Text(value)
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .foregroundColor(MacroMeshTheme.text)
                .minimumScaleFactor(0.75)
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundColor(MacroMeshTheme.muted)
                .textCase(.uppercase)
                .tracking(0.8)
            Text(subtitle)
                .font(.caption)
                .foregroundColor(MacroMeshTheme.muted)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 118, alignment: .leading)
        .background(MacroMeshTheme.cardSubtle.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

private struct GoalSummaryTile: View {
    let title: String
    let value: String
    let icon: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundColor(tint)
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.muted)
                Spacer()
            }
            Text(value)
                .font(.title3.weight(.bold))
                .foregroundColor(MacroMeshTheme.text)
        }
        .padding(12)
        .frame(maxWidth: .infinity, minHeight: 74, alignment: .leading)
        .background(MacroMeshTheme.cardSubtle.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

struct WeightEntrySheet: View {
    let weightEntries: WeightEntriesResponse?
    let latestWeight: Double?
    let onSave: (Double) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var weightText: String

    init(weightEntries: WeightEntriesResponse?, latestWeight: Double?, onSave: @escaping (Double) -> Void) {
        self.weightEntries = weightEntries
        self.latestWeight = latestWeight
        self.onSave = onSave
        _weightText = State(initialValue: latestWeight.map { String(Int($0)) } ?? "")
    }

    var body: some View {
        NavigationView {
            MacroMeshScreen {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        AppCard(padding: 18) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Weight")
                                    .font(.title2.weight(.bold))
                                    .foregroundColor(MacroMeshTheme.text)
                                Text("Log consistently — trend is what matters.")
                                    .font(.subheadline)
                                    .foregroundColor(MacroMeshTheme.muted)
                            }
                        }

                        currentWeightCard
                        trendCard

                        AppCard(padding: 16) {
                            VStack(alignment: .leading, spacing: 10) {
                                SectionHeader("Quick save", subtitle: "Enter your weight — then save with one tap.")
                                TextField("Weight in lbs", text: $weightText)
                                    .keyboardType(.decimalPad)
                                    .font(.title3.weight(.semibold))
                                    .padding(14)
                                    .background(MacroMeshTheme.cardSubtle)
                                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                                    .accessibilityLabel("Weight in pounds")

                                Button {
                                    save()
                                } label: {
                                    Label("Save weigh-in", systemImage: "checkmark.circle.fill")
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(PrimaryCTAButtonStyle())
                                .accessibilityHint("Saves this weight entry.")
                            }
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
                    .padding(.bottom, 28)
                }
            }
            .navigationTitle("Log weight")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private var currentWeightCard: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader("Current weight", subtitle: latestDateText)
                HStack(alignment: .lastTextBaseline, spacing: 8) {
                    Text(latestWeight.map { String(format: "%.1f", $0) } ?? "—")
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                        .foregroundColor(MacroMeshTheme.text)
                    Text("lbs")
                        .font(.headline)
                        .foregroundColor(MacroMeshTheme.muted)
                    Spacer()
                }
            }
        }
    }

    private var trendCard: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Weight trend", subtitle: "Compared to your previous entry")

                HStack(spacing: 12) {
                    SnapshotMetric(title: "Previous", value: previousWeightText)
                    SnapshotMetric(title: "Change", value: changeText)
                }

                if sparklinePoints.count >= 3 {
                    Chart(sparklinePoints) {
                        LineMark(
                            x: .value("Date", $0.date),
                            y: .value("Weight", $0.weight)
                        )
                        .foregroundStyle(MacroMeshTheme.primary)
                        .interpolationMethod(.catmullRom)
                    }
                    .chartXAxis(.hidden)
                    .chartYAxis(.hidden)
                    .frame(height: 70)
                    .accessibilityLabel("Weight sparkline")
                    .animation(.easeInOut(duration: 0.25), value: sparklinePoints)
                } else {
                    Text("Log a couple more weigh-ins to unlock a sparkline trend.")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }
            }
        }
    }

    private var latestDateText: String {
        guard let raw = weightEntries?.entries.first?.date,
              let date = DateParser.parseMealDate(raw) else {
            return "Most recent entry"
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return "Updated \(formatter.string(from: date))"
    }

    private var previousWeightText: String {
        guard let prev = sortedEntries.dropFirst().first?.weightLbs else { return "Not enough data" }
        return String(format: "%.1f lbs", prev)
    }

    private var changeText: String {
        guard let latest = sortedEntries.first?.weightLbs,
              let prev = sortedEntries.dropFirst().first?.weightLbs else { return "Not enough data" }
        return String(format: "%+.1f lbs", latest - prev)
    }

    private var sortedEntries: [WeightEntry] {
        (weightEntries?.entries ?? []).sorted { ($0.date) > ($1.date) }
    }

    private struct SparkPoint: Identifiable, Equatable {
        let id = UUID()
        let date: Date
        let weight: Double
    }

    private var sparklinePoints: [SparkPoint] {
        let parsed = (weightEntries?.entries ?? []).compactMap { entry -> SparkPoint? in
            guard let date = DateParser.parseMealDate(entry.date) else { return nil }
            return SparkPoint(date: date, weight: entry.weightLbs)
        }
        return Array(parsed.sorted { $0.date < $1.date }.suffix(14))
    }

    private func save() {
        if let weight = Double(weightText.trimmingCharacters(in: .whitespacesAndNewlines)) {
            onSave(weight)
            dismiss()
        }
    }
}

struct AccountStatusSection: View {
    let response: SessionResponse?

    private var title: String {
        response?.account?.title ?? "Account tools are in progress"
    }

    private var description: String {
        response?.account?.description ?? "Sign in with Apple is optional. You can keep using MacroMesh as a guest at any time."
    }

    private var providers: [AuthProviderSnapshot] {
        response?.account?.providers ?? [
            AuthProviderSnapshot(
                id: "apple",
                label: "Continue with Apple",
                status: "planned",
                detail: "Sign in to sync your data and unlock account tools like export and deletion."
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
        .accessibilityLabel("Account status. Apple sign-in is optional and guest mode remains available.")
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
        Text("Your nutrition data belongs to you. MacroMesh supports Sign in with Apple, export, and account deletion — and nothing is saved until you review it.")
            .font(.footnote)
            .foregroundColor(MacroMeshTheme.muted)
            .padding(.top, 8)
            .accessibilityLabel("Your nutrition data belongs to you. MacroMesh supports Apple sign in, export, and account deletion.")
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
    static let deleteConfirmationMessage = "This deletes your signed-in MacroMesh account data. Guest data that was not migrated will remain on this device."

    static func visibility(for session: AuthSession) -> AccountManagementVisibility {
        if session.isSignedIn {
            return AccountManagementVisibility(
                canUseAccountActions: true,
                message: "You’re signed in. You can migrate guest data, export your account, delete account data, or sign out."
            )
        }

        return AccountManagementVisibility(
            canUseAccountActions: false,
            message: "You can keep logging meals as a guest. Sign in with Apple to enable account export and deletion (optional)."
        )
    }

    static func failureMessage(action: String, error: Error) -> String {
        "Could not \(action). \(error.localizedDescription) Nothing else was changed."
    }
}
