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
                    ProgressView("Loading profile...")
                } else if let error = error {
                    VStack(spacing: 16) {
                        Text("Profile unavailable").foregroundColor(.red)
                        Text(error).font(.caption)
                        Button("Retry") { loadProfile() }
                    }.padding()
                } else if profile == nil {
                    VStack {
                        Text("No profile data").foregroundColor(.gray)
                        Button("Reload") { loadProfile() }
                            .accessibilityLabel("Reload profile")
                    }.padding()
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            if editing {
                                Form {
                                    Section(header: Text("Name")) {
                                        TextField("Name", text: Binding(
                                            get: { dirtyProfile?.name ?? "" },
                                            set: { dirtyProfile?.name = $0 })
                                        )
                                        .focused($focusedProfileField)
                                        .accessibilityLabel("Profile name")
                                    }
                                    Section(header: Text("Age")) {
                                        TextField("Age", value: Binding(
                                            get: { dirtyProfile?.age },
                                            set: { dirtyProfile?.age = $0 }
                                        ), formatter: NumberFormatter())
                                        .focused($focusedProfileField)
                                        .keyboardType(.numberPad)
                                        .accessibilityLabel("Age")
                                    }
                                    Section(header: Text("Height (cm)")) {
                                        TextField("Height (cm)", value: Binding(
                                            get: { dirtyProfile?.heightCm },
                                            set: { dirtyProfile?.heightCm = $0 })
                                        , formatter: NumberFormatter())
                                        .focused($focusedProfileField)
                                        .keyboardType(.numberPad)
                                        .accessibilityLabel("Height in centimeters")
                                    }
                                    Section(header: Text("Weight (lbs)")) {
                                        TextField("Weight (lbs)", value: Binding(
                                            get: { dirtyProfile?.weightLbs },
                                            set: { dirtyProfile?.weightLbs = $0 })
                                        , formatter: NumberFormatter())
                                        .focused($focusedProfileField)
                                        .keyboardType(.decimalPad)
                                        .accessibilityLabel("Weight in pounds")
                                    }
                                    Section(header: Text("Daily Calorie Goal")) {
                                        TextField("Daily Calorie Goal", value: Binding(
                                            get: { dirtyProfile?.dailyCalorieGoal },
                                            set: { dirtyProfile?.dailyCalorieGoal = $0 })
                                        , formatter: NumberFormatter())
                                        .focused($focusedProfileField)
                                        .keyboardType(.numberPad)
                                        .accessibilityLabel("Daily calorie goal")
                                    }
                                    Section(header: Text("Protein Goal (g)")) {
                                        TextField("Protein Goal", value: Binding(
                                            get: { dirtyProfile?.proteinGoal },
                                            set: { dirtyProfile?.proteinGoal = $0 })
                                        , formatter: NumberFormatter())
                                        .focused($focusedProfileField)
                                        .keyboardType(.numberPad)
                                        .accessibilityLabel("Protein goal")
                                    }
                                    Section(header: Text("Nutrition Preferences")) {
                                        TextField("Preferences", text: Binding(
                                            get: { dirtyProfile?.nutritionPreferences ?? "" },
                                            set: { dirtyProfile?.nutritionPreferences = $0 })
                                        )
                                        .focused($focusedProfileField)
                                        .accessibilityLabel("Nutrition preferences")
                                    }
                                }
                                if let saveError = saveError {
                                    Text(saveError).foregroundColor(.red)
                                }
                                HStack {
                                    Button("Cancel") {
                                        focusedProfileField = false; editing = false; dirtyProfile = profile
                                    }.foregroundColor(.gray)
                                    Spacer()
                                    Button("Save changes") {
                                        focusedProfileField = false
                                        showConfirmSave = true
                                    }.disabled(saving)
                                }.padding()
                            } else {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(profile?.name ?? "Not set").font(.headline)
                                    Group {
                                        Text("Calorie goal: \(profile?.dailyCalorieGoal?.description ?? "Not set")")
                                        Text("Protein goal: \(profile?.proteinGoal?.description ?? "Not set")")
                                        Text("Height: \(profile?.heightCm?.description ?? "Not set") cm")
                                        Text("Weight: \(profile?.weightLbs?.description ?? "Not set") lbs")
                                        Text("Preferences: \(profile?.nutritionPreferences ?? "Not set")")
                                    }.font(.subheadline).foregroundColor(.secondary)
                                }
                                Button("Edit Profile") {
                                    dirtyProfile = profile; editing = true
                                }.padding(.top, 8)
                                AccountStatusSection(response: sessionStore.state.sessionResponse)
                                AccountSignInEntryPoint(
                                    authSession: sessionStore.state.authSession,
                                    onSessionChanged: sessionStore.refresh
                                )
                                SessionAndPrivacyNote()
                                if showSuccess {
                                    Text("Profile updated!").foregroundColor(.green)
                                }
                            }
                        }.padding(.horizontal, 20).padding(.top, 16)
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
        response?.account?.description ?? "Native Sign in with Apple uses backend verification and remains optional while account migration tools are completed."
    }

    private var providers: [AuthProviderSnapshot] {
        response?.account?.providers ?? [
            AuthProviderSnapshot(
                id: "apple",
                label: "Continue with Apple",
                status: "planned",
                detail: "Apple sign-in can request a backend-issued session; guest migration and account tools are still pending."
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

struct AccountSignInEntryPoint: View {
    let authSession: AuthSession
    let onSessionChanged: () -> Void
    private let authService = AppleAuthService()
    @State private var interactionState: AuthInteractionState = .idle

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(authSession.isGuest ? "Guest mode" : "Account")
                .font(.headline)
            Text(authSession.isGuest ? "You can keep logging meals without signing in. Apple sign-in is optional and only completes after the backend verifies Apple and returns a Calorie Compass session." : "Signed in with a backend-issued Calorie Compass session. Guest-to-account meal migration is still planned.")
                .font(.footnote)
                .foregroundColor(.secondary)

            if authSession.isSignedIn {
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
}

struct SessionAndPrivacyNote: View {
    var body: some View {
        Text("Apple sign-in now uses backend token verification and server-issued sessions. Guest-to-account meal migration, export, deletion, and TestFlight auth QA are still pending.")
            .font(.footnote)
            .foregroundColor(.secondary)
            .padding(.top, 8)
            .accessibilityLabel("Apple sign-in uses backend verification and server-issued sessions. Guest migration, export, deletion, and TestFlight auth QA are still pending.")
    }
}

private enum AuthInteractionState: Equatable {
    case idle
    case signingIn
    case signingOut
    case success(String)
    case error(String)

    var isWorking: Bool {
        switch self {
        case .signingIn, .signingOut:
            return true
        case .idle, .success, .error:
            return false
        }
    }
}
