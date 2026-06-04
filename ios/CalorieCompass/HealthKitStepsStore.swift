import Foundation
import HealthKit
import SwiftUI

@MainActor
final class HealthKitStepsStore: ObservableObject {
    enum AuthorizationState: Equatable {
        case unavailable
        case notDetermined
        case denied
        case authorized
    }

    @Published private(set) var authorization: AuthorizationState = .notDetermined
    @Published private(set) var stepsToday: Int? = nil
    @Published private(set) var lastSyncedAt: Date? = nil
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var errorMessage: String? = nil

    private let store = HKHealthStore()
    private let stepType = HKQuantityType.quantityType(forIdentifier: .stepCount)

    init() {
        refreshAuthorizationState()
    }

    func refreshAuthorizationState() {
        guard HKHealthStore.isHealthDataAvailable(), let stepType else {
            authorization = .unavailable
            return
        }

        switch store.authorizationStatus(for: stepType) {
        case .notDetermined:
            authorization = .notDetermined
        case .sharingDenied:
            authorization = .denied
        case .sharingAuthorized:
            authorization = .authorized
        @unknown default:
            authorization = .notDetermined
        }
    }

    func requestAuthorization() {
        guard HKHealthStore.isHealthDataAvailable(), let stepType else {
            authorization = .unavailable
            return
        }

        isLoading = true
        errorMessage = nil

        store.requestAuthorization(toShare: [], read: [stepType]) { [weak self] success, error in
            DispatchQueue.main.async {
                guard let self else { return }
                self.isLoading = false
                if let error {
                    self.errorMessage = error.localizedDescription
                }
                self.refreshAuthorizationState()
                if success {
                    self.refreshTodaySteps()
                }
            }
        }
    }

    func refreshTodaySteps() {
        refreshAuthorizationState()
        guard authorization == .authorized, let stepType else { return }

        isLoading = true
        errorMessage = nil

        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: Date())
        let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: Date(), options: .strictStartDate)

        let query = HKStatisticsQuery(quantityType: stepType, quantitySamplePredicate: predicate, options: .cumulativeSum) { [weak self] _, result, error in
            DispatchQueue.main.async {
                guard let self else { return }
                self.isLoading = false

                if let error {
                    self.errorMessage = error.localizedDescription
                    return
                }

                let count = result?.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0
                self.stepsToday = Int(count.rounded())
                self.lastSyncedAt = Date()
            }
        }

        store.execute(query)
    }
}

struct ActivityStepsCard: View {
    @StateObject private var stepsStore = HealthKitStepsStore()

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Activity", subtitle: "Steps today")

                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(stepsValueText)
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundColor(MacroMeshTheme.text)
                        .minimumScaleFactor(0.7)

                    Text("steps")
                        .font(.headline.weight(.semibold))
                        .foregroundColor(MacroMeshTheme.muted)

                    Spacer(minLength: 0)

                    Text(permissionPillText)
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(permissionPillTint.opacity(0.14))
                        .foregroundColor(permissionPillTint)
                        .clipShape(Capsule())
                }

                Text(statusCopy)
                    .font(.subheadline)
                    .foregroundColor(MacroMeshTheme.muted)

                if let lastSyncedAt = stepsStore.lastSyncedAt {
                    Text("Last synced \(Self.timeFormatter.string(from: lastSyncedAt))")
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }

                if let errorMessage = stepsStore.errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundColor(.red)
                }

                if showsAction {
                    Button(actionButtonTitle) {
                        action()
                    }
                    .buttonStyle(SecondaryCTAButtonStyle())
                    .disabled(stepsStore.isLoading)
                }

                Text("MacroMesh only reads your step count so you can see a simple activity snapshot. Steps stay on-device and are not sent to the server.")
                    .font(.caption2)
                    .foregroundColor(MacroMeshTheme.muted)
            }
        }
        .onAppear {
            stepsStore.refreshAuthorizationState()
            stepsStore.refreshTodaySteps()
        }
    }

    private var stepsValueText: String {
        switch stepsStore.authorization {
        case .authorized:
            return stepsStore.stepsToday.map { "\($0)" } ?? "—"
        case .unavailable:
            return "—"
        case .denied:
            return "—"
        case .notDetermined:
            return "—"
        }
    }

    private var statusCopy: String {
        if stepsStore.isLoading {
            return "Syncing steps from Apple Health…"
        }

        switch stepsStore.authorization {
        case .unavailable:
            return "Apple Health isn’t available on this device."
        case .denied:
            return "Steps permission is off. You can enable it in Settings → Health → Data Access & Devices."
        case .notDetermined:
            return "Enable step count access to show your daily steps."
        case .authorized:
            if stepsStore.stepsToday == nil {
                return "No step data yet today."
            }
            return "Your steps update from Apple Health."
        }
    }

    private var showsAction: Bool {
        switch stepsStore.authorization {
        case .notDetermined, .authorized:
            return true
        case .unavailable, .denied:
            return false
        }
    }

    private var actionButtonTitle: String {
        switch stepsStore.authorization {
        case .notDetermined:
            return "Enable steps"
        case .authorized:
            return "Sync now"
        default:
            return ""
        }
    }

    private func action() {
        switch stepsStore.authorization {
        case .notDetermined:
            stepsStore.requestAuthorization()
        case .authorized:
            stepsStore.refreshTodaySteps()
        default:
            break
        }
    }

    private var permissionPillText: String {
        switch stepsStore.authorization {
        case .authorized: return "Connected"
        case .notDetermined: return "Optional"
        case .denied: return "Blocked"
        case .unavailable: return "Unavailable"
        }
    }

    private var permissionPillTint: Color {
        switch stepsStore.authorization {
        case .authorized: return MacroMeshTheme.primary
        case .notDetermined: return MacroMeshTheme.muted
        case .denied: return MacroMeshTheme.orange
        case .unavailable: return MacroMeshTheme.muted
        }
    }

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return formatter
    }()
}
