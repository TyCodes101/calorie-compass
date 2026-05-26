import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var apiClient: APIClient
    @State private var dashboard: DashboardSnapshot?
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        List {
            Section {
                metricRow(title: "Calories left", value: dashboard?.remainingCalories.map { "\(Int($0))" } ?? "--")
                metricRow(title: "Protein goal", value: dashboard?.macroGoals?.protein.map { "\(Int($0))g" } ?? "--")
                metricRow(title: "Meals today", value: dashboard?.mealCount.map(String.init) ?? "--")
            }

            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                    Button("Try again") {
                        Task { await loadDashboard() }
                    }
                }
            }
        }
        .navigationTitle("Today")
        .overlay {
            if isLoading {
                ProgressView("Loading today")
                    .padding()
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
            }
        }
        .task {
            await loadDashboard()
        }
    }

    private func metricRow(title: String, value: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(value)
                .font(.headline)
        }
    }

    private func loadDashboard() async {
        isLoading = true
        errorMessage = nil
        do {
            dashboard = try await apiClient.fetchDashboard()
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

#Preview {
    NavigationStack {
        DashboardView()
            .environmentObject(APIClient())
    }
}
