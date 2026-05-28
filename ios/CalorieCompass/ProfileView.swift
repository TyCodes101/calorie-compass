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
            Group {
                if loading && profile == nil {
                    VStack(spacing: 12) {
                        ProgressView()
                        Text("Preparing your profile…")
                            .font(.headline)
                        Text("MacroMesh is loading your guest defaults.")
                            .font(.caption)
                            .foregroundColor(.secondary)
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
                                Button("Edit Profile") {
                                    dirtyProfile = profile; editing = true
                                }
                                .buttonStyle(.borderedProminent)
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
                    error = err.localizedDescription
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
                .foregroundColor(.secondary)
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
                            .foregroundColor(.secondary)
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
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            Button("Reload profile", action: retry)
                .buttonStyle(.borderedProminent)
        }
        .padding(20)
        .frame(maxWidth: .infinity)
        .background(Color(.secondarySystemBackground))
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
                    .foregroundColor(.secondary)
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
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity)
                Button(saving ? "Saving…" : "Save changes", action: onSave)
                    .buttonStyle(.borderedProminent)
                    .frame(maxWidth: .infinity)
                    .disabled(saving)
            }
        }
        .padding(16)
        .background(Color(.secondarySystemBackground))
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
            Text(title).font(.caption).foregroundColor(.secondary)
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
                        .foregroundColor(.secondary)
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
        .background(Color(.secondarySystemBackground))
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
                .foregroundColor(.secondary)
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
            .foregroundColor(.secondary)
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
                .foregroundColor(.secondary)

            if authSession.isSignedIn {
                Button {
                    migrateGuestData()
                } label: {
                    Label("Migrate guest data", systemImage: "arrow.triangle.2.circlepath")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(interactionState.isWorking)
                .accessibilityHint("Moves eligible guest meals, goals, and history into this signed-in account.")

                Button {
                    exportAccountData()
                } label: {
                    Label("Export account data", systemImage: "square.and.arrow.up")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(interactionState.isWorking)
                .accessibilityHint("Requests a server export for only this signed-in account.")

                Button(role: .destructive) {
                    showDeleteAccountConfirmation = true
                } label: {
                    Label("Delete account data", systemImage: "trash")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .disabled(interactionState.isWorking)
                .accessibilityHint("Requires confirmation and deletes only the signed-in account data handled by the backend endpoint.")

                Button(role: .destructive) {
                    signOut()
                } label: {
                    Label("Sign out", systemImage: "rectangle.portrait.and.arrow.right")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
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
            .foregroundColor(.secondary)
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
