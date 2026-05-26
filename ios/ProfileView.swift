import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var apiClient: APIClient
    @State private var session: SessionResponse?
    @State private var errorMessage: String?
    @State private var isLoading = false

    var body: some View {
        List {
            Section("Account") {
                HStack {
                    Text("User")
                    Spacer()
                    Text(session?.user?.name ?? "Guest")
                        .foregroundStyle(.secondary)
                }
                HStack {
                    Text("Mode")
                    Spacer()
                    Text(session?.user?.mode ?? "unknown")
                        .foregroundStyle(.secondary)
                }
            }

            Section("Native app readiness") {
                Label("Sign in with Apple needed", systemImage: "apple.logo")
                Label("Privacy, export, and delete flows needed", systemImage: "lock.shield")
                Label("Barcode, OCR, and notifications are future native work", systemImage: "camera.viewfinder")
            }

            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                    Button("Retry") {
                        Task { await loadSession() }
                    }
                }
            }
        }
        .navigationTitle("Profile")
        .overlay {
            if isLoading {
                ProgressView("Loading profile")
                    .padding()
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
            }
        }
        .task {
            await loadSession()
        }
    }

    private func loadSession() async {
        isLoading = true
        errorMessage = nil
        do {
            session = try await apiClient.fetchSession()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

#Preview {
    NavigationStack {
        ProfileView()
            .environmentObject(APIClient())
    }
}
