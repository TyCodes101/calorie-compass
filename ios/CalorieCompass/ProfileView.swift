// ProfileView.swift
// Calorie Compass iOS — Phase 3A
// Native Profile with backend fetch/edit/confirm, robust states
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

    var body: some View {
        NavigationView {
            Group {
                if loading && profile == nil {
                    ProgressView("Loading profile…")
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
                                    }
                                    Section(header: Text("Age")) {
                                        TextField("Age", value: Binding(
                                            get: { dirtyProfile?.age },
                                            set: { dirtyProfile?.age = $0 }
                                        ), formatter: NumberFormatter())
                                    }
                                    Section(header: Text("Height (cm)")) {
                                        TextField("Height (cm)", value: Binding(
                                            get: { dirtyProfile?.heightCm },
                                            set: { dirtyProfile?.heightCm = $0 })
                                        , formatter: NumberFormatter())
                                    }
                                    Section(header: Text("Weight (lbs)")) {
                                        TextField("Weight (lbs)", value: Binding(
                                            get: { dirtyProfile?.weightLbs },
                                            set: { dirtyProfile?.weightLbs = $0 })
                                        , formatter: NumberFormatter())
                                    }
                                    Section(header: Text("Daily Calorie Goal")) {
                                        TextField("Daily Calorie Goal", value: Binding(
                                            get: { dirtyProfile?.dailyCalorieGoal },
                                            set: { dirtyProfile?.dailyCalorieGoal = $0 })
                                        , formatter: NumberFormatter())
                                    }
                                    Section(header: Text("Protein Goal (g)")) {
                                        TextField("Protein Goal", value: Binding(
                                            get: { dirtyProfile?.proteinGoal },
                                            set: { dirtyProfile?.proteinGoal = $0 })
                                        , formatter: NumberFormatter())
                                    }
                                    Section(header: Text("Nutrition Preferences")) {
                                        TextField("Preferences", text: Binding(
                                            get: { dirtyProfile?.nutritionPreferences ?? "" },
                                            set: { dirtyProfile?.nutritionPreferences = $0 })
                                        )
                                    }
                                }
                                if let saveError = saveError {
                                    Text(saveError).foregroundColor(.red)
                                }
                                HStack {
                                    Button("Cancel") {
                                        editing = false; dirtyProfile = profile
                                    }.foregroundColor(.gray)
                                    Spacer()
                                    Button("Save changes") {
                                        showConfirmSave = true
                                    }.disabled(saving)
                                }.padding()
                            } else {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(profile?.name ?? "—").font(.headline)
                                    Group {
                                        Text("Calorie goal: \(profile?.dailyCalorieGoal?.description ?? "—")")
                                        Text("Protein goal: \(profile?.proteinGoal?.description ?? "—")")
                                        Text("Height: \(profile?.heightCm?.description ?? "—") cm")
                                        Text("Weight: \(profile?.weightLbs?.description ?? "—") lbs")
                                        Text("Preferences: \(profile?.nutritionPreferences ?? "—")")
                                    }.font(.subheadline).foregroundColor(.secondary)
                                }
                                Button("Edit Profile") {
                                    dirtyProfile = profile; editing = true
                                }.padding(.top, 8)
                                AccountStatusSection(response: sessionStore.state.sessionResponse)
                                AccountSignInEntryPoint(authSession: sessionStore.state.authSession)
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
                    saveError = err.localizedDescription
                }
            }
        }
    }
}

struct AccountStatusSection: View {
    let response: SessionResponse?

    private var title: String {
        response?.account?.title ?? "Account tools are coming soon"
    }

    private var description: String {
        response?.account?.description ?? "Native Sign in with Apple is planned, but this build does not include a complete account sign-in flow yet."
    }

    private var providers: [AuthProviderSnapshot] {
        response?.account?.providers ?? [
            AuthProviderSnapshot(
                id: "apple",
                label: "Continue with Apple",
                status: "planned",
                detail: "Coming soon after backend verification and secure session storage are complete."
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
                        Text(provider.isAvailable ? "Available" : "Coming soon")
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
        .accessibilityLabel("Account status. Native Sign in with Apple is coming soon and is not available in this build.")
    }
}

struct AccountSignInEntryPoint: View {
    let authSession: AuthSession
    private let authService = AppleAuthService()

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(authSession.isGuest ? "Guest mode" : "Account")
                .font(.headline)
            Text(authSession.isGuest ? "You can keep logging meals without signing in. Apple account upgrade is being prepared and will stay optional." : "Account-backed sessions will appear here after native auth is fully wired.")
                .font(.footnote)
                .foregroundColor(.secondary)
            Button {
                authService.signInWithApple { _ in
                    // Phase 4C scaffold only: keep the button non-destructive and avoid
                    // claiming real auth until backend Apple token verification exists.
                }
            } label: {
                Label("Continue with Apple — coming soon", systemImage: "apple.logo")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .disabled(true)
            .accessibilityHint("Sign in with Apple is planned, but it is not available in this build.")
        }
        .padding(.top, 12)
    }
}

struct SessionAndPrivacyNote: View {
    var body: some View {
        Text("Native sign-in is not available in this build. Profile and meal data are handled by the Calorie Compass backend; use the web app for account access, export, or deletion until native account tools are added.")
            .font(.footnote)
            .foregroundColor(.secondary)
            .padding(.top, 8)
            .accessibilityLabel("Native sign-in is not available in this build. Use the web app for account access, export, or deletion until native account tools are added.")
    }
}
