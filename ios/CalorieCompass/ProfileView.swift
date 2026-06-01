// ProfileView.swift
// Calorie Compass iOS - Phase 5 native profile and account status
// Native Profile with backend fetch/edit/confirm, robust states
import AuthenticationServices
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

    static let guestDefault = ProfileData(
        name: "Guest",
        age: nil,
        heightCm: nil,
        weightLbs: nil,
        goal: "MAINTAIN",
        activityLevel: "MODERATE",
        dailyCalorieGoal: 2200,
        proteinGoal: 160,
        nutritionPreferences: nil
    )
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
                        VStack(alignment: .leading, spacing: 16) {
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
                                ProfileGoalProgressCard(profile: profile)
                                ProfileMacroGoalsCard(profile: profile)
                                ProfileWeightTrendCard(profile: profile)
                                ProfilePreferenceCard(profile: profile)
                                Button {
                                    dirtyProfile = profile; editing = true
                                } label: {
                                    Label("Edit profile", systemImage: "pencil")
                                }
                                .buttonStyle(PrimaryCTAButtonStyle())
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
                                    Text("Profile updated.")
                                        .font(.caption.weight(.semibold))
                                        .foregroundColor(MacroMeshTheme.primary)
                                }
                                if let error = error {
                                    Text(error)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
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
            .onAppear(perform: loadProfile)
            .scrollDismissesKeyboard(.interactively)
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
                    let fallback = profile ?? .guestDefault
                    profile = fallback; dirtyProfile = fallback
                    error = RetryCopy.recoveryMessage(action: "load your profile", error: err)
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

struct ProfileGoalProgressCard: View {
    let profile: ProfileData?

    private var calorieGoal: Double { Double(profile?.dailyCalorieGoal ?? 2200) }
    private var proteinGoal: Double { Double(profile?.proteinGoal ?? 160) }
    private var completedFields: Double {
        Double([
            profile?.dailyCalorieGoal != nil,
            profile?.proteinGoal != nil,
            profile?.weightLbs != nil,
            profile?.nutritionPreferences?.nilIfBlank != nil,
        ].filter { $0 }.count)
    }

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeader("Goal setup", subtitle: "Complete profile details improve estimates and daily targets.")
                HStack(alignment: .center, spacing: 12) {
                    IconBadge(systemName: "target", tint: MacroMeshTheme.primary, size: 42)
                    VStack(alignment: .leading, spacing: 7) {
                        HStack {
                            Text("\(Int(completedFields))/4 complete")
                                .font(.headline.weight(.bold))
                                .foregroundColor(MacroMeshTheme.text)
                            Spacer()
                            Text("\(Int((completedFields / 4) * 100))%")
                                .font(.caption.weight(.bold))
                                .foregroundColor(MacroMeshTheme.primary)
                        }
                        ProgressView(value: completedFields, total: 4)
                            .tint(MacroMeshTheme.primary)
                    }
                }
                HStack(spacing: 8) {
                    InsightPill(title: "Daily target", value: "\(Int(calorieGoal)) cal", tint: MacroMeshTheme.primary, systemImage: "target")
                    InsightPill(title: "Protein target", value: "\(Int(proteinGoal))g", tint: MacroMeshTheme.blue, systemImage: "bolt.fill")
                }
            }
        }
    }
}

struct ProfileMacroGoalsCard: View {
    let profile: ProfileData?

    private var calories: Double { Double(profile?.dailyCalorieGoal ?? 2200) }
    private var protein: Double { Double(profile?.proteinGoal ?? 160) }
    private var carbsGoal: Double { max((calories - protein * 4 - 70 * 9) / 4, 120) }
    private var fatGoal: Double { max((calories * 0.28) / 9, 45) }

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 14) {
                SectionHeader("Macro goals")
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                    ProfileGoalTile(title: "Protein", value: "\(Int(protein))g", tint: MacroMeshTheme.protein, icon: "bolt.fill")
                    ProfileGoalTile(title: "Carbs", value: "\(Int(carbsGoal))g", tint: MacroMeshTheme.carbs, icon: "flame.fill")
                    ProfileGoalTile(title: "Fat", value: "\(Int(fatGoal))g", tint: MacroMeshTheme.fat, icon: "drop.fill")
                    ProfileGoalTile(title: "Calories", value: "\(Int(calories))", tint: MacroMeshTheme.blue, icon: "target")
                }
            }
        }
    }
}

struct ProfileGoalTile: View {
    let title: String
    let value: String
    let tint: Color
    let icon: String

    var body: some View {
        HStack(spacing: 10) {
            IconBadge(systemName: icon, tint: tint, size: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.muted)
                Text(value)
                    .font(.headline.weight(.bold))
                    .foregroundColor(MacroMeshTheme.text)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tint.opacity(0.09))
        .clipShape(RoundedRectangle(cornerRadius: MacroMeshRadius.md, style: .continuous))
    }
}

struct ProfileWeightTrendCard: View {
    let profile: ProfileData?

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 13) {
                SectionHeader("Weight trend", subtitle: "A cleaner snapshot today; check-ins can fill this chart later.")
                HStack(alignment: .bottom, spacing: 14) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(profile?.weightLbs.map { "\(Int($0)) lbs" } ?? "Add weight")
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                            .foregroundColor(MacroMeshTheme.text)
                        Text(profile?.goal?.goalLabel ?? "Maintain")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(MacroMeshTheme.muted)
                    }
                    Spacer()
                    MiniTrendBars()
                        .frame(width: 112, height: 46)
                }
            }
        }
    }
}

struct MiniTrendBars: View {
    private let values: [CGFloat] = [0.46, 0.58, 0.52, 0.66, 0.62, 0.74, 0.70]

    var body: some View {
        HStack(alignment: .bottom, spacing: 5) {
            ForEach(Array(values.enumerated()), id: \.offset) { _, value in
                RoundedRectangle(cornerRadius: 4, style: .continuous)
                    .fill(MacroMeshTheme.primary.opacity(0.25 + Double(value) * 0.45))
                    .frame(width: 10, height: 44 * value)
            }
        }
    }
}

struct ProfilePreferenceCard: View {
    let profile: ProfileData?

    var body: some View {
        AppCard(padding: 16) {
            HStack(alignment: .top, spacing: 12) {
                IconBadge(systemName: "slider.horizontal.3", tint: MacroMeshTheme.orange, size: 36)
                VStack(alignment: .leading, spacing: 5) {
                    Text("Preferences")
                        .font(.headline.weight(.bold))
                        .foregroundColor(MacroMeshTheme.text)
                    Text(profile?.nutritionPreferences?.nilIfBlank ?? "Add cuisine, diet, allergies, or coaching style preferences.")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

struct ProfileSummaryCard: View {
    let profile: ProfileData?
    let isGuest: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .center, spacing: 12) {
                Image(systemName: isGuest ? "person.crop.circle" : "person.crop.circle.fill")
                    .font(.title2.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.primary)
                    .frame(width: 42, height: 42)
                    .background(MacroMeshTheme.cardSubtle)
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 4) {
                    Text(profile?.name.nilIfBlank ?? (isGuest ? "Guest profile" : "Profile"))
                        .font(.title3)
                        .fontWeight(.semibold)
                    Text(isGuest ? "Guest mode is active" : "Synced account profile")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }
                Spacer()
                Text(isGuest ? "Guest" : "Synced")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundColor(isGuest ? MacroMeshTheme.orange : MacroMeshTheme.primaryDark)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 5)
                    .background((isGuest ? MacroMeshTheme.orange : MacroMeshTheme.primary).opacity(0.14))
                    .clipShape(Capsule())
            }
            Divider()
            ProfileInfoRow(label: "Daily calories", value: profile?.dailyCalorieGoal.map { "\($0) cal" } ?? "Add goal")
            ProfileInfoRow(label: "Protein", value: profile?.proteinGoal.map { "\($0)g" } ?? "Add protein")
            ProfileInfoRow(label: "Height", value: profile?.heightCm.map { "\($0) cm" } ?? "Add height")
            ProfileInfoRow(label: "Weight", value: profile?.weightLbs.map { "\(Int($0)) lbs" } ?? "Add weight")
            ProfileInfoRow(label: "Preferences", value: profile?.nutritionPreferences?.nilIfBlank ?? "Add preferences")
            Text("These defaults help MacroMesh estimate meals and daily targets. Sign-in stays optional.")
                .font(.caption)
                .foregroundColor(MacroMeshTheme.muted)
                .padding(.top, 2)
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
                .lineLimit(2)
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

    var goalLabel: String {
        lowercased()
            .split(separator: "_")
            .map { part in part.prefix(1).uppercased() + String(part.dropFirst()) }
            .joined(separator: " ")
    }
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
