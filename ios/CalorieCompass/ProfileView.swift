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
                    error = err.localizedDescription
                }
            }
        }
    }
    private func saveProfile() {
        saving = true; saveError = nil
        guard let candidate = dirtyProfile else { saveError = "Missing profile"; return }
        BackendService.saveProfile(candidate) { result in
            DispatchQueue.main.async {
                saving = false; showConfirmSave = false
                switch result {
                case .success(let saved):
                    profile = saved; editing = false; showSuccess = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { showSuccess = false }
                case .failure(let err):
                    saveError = err.localizedDescription
                }
            }
        }
    }
}
