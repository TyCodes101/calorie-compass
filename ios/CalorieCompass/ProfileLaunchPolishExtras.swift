import Foundation
import SwiftUI
import UserNotifications

// MARK: - Weekly report

struct WeeklyReportCard: View {
    let dashboard: DashboardResponse?
    let analytics: AnalyticsResponse?

    var body: some View {
        NavigationLink {
            WeeklyReportDetailView()
        } label: {
            AppCard(padding: 16) {
                VStack(alignment: .leading, spacing: 12) {
                    SectionHeader("Weekly report", subtitle: dashboard?.streaks?.summary ?? "See streaks, averages, and momentum.")
                    HStack(spacing: 10) {
                        MetricPill(title: "Meals / wk", value: "\(dashboard?.streaks?.mealsLoggedThisWeek ?? 0)", icon: "fork.knife", tint: MacroMeshTheme.primary)
                        MetricPill(title: "Streak", value: "\(dashboard?.streaks?.currentStreakDays ?? 0)d", icon: "flame.fill", tint: MacroMeshTheme.orange)
                    }
                    HStack(spacing: 10) {
                        MetricPill(title: "7-day cal", value: "\(Int(analytics?.analytics.sevenDayAverageCalories ?? 0))", icon: "chart.bar.fill", tint: MacroMeshTheme.blue)
                        MetricPill(title: "7-day protein", value: "\(Int(analytics?.analytics.sevenDayAverageProtein ?? 0))g", icon: "bolt.fill", tint: MacroMeshTheme.purple)
                    }
                    Text("View full report")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(MacroMeshTheme.primary)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

struct WeeklyReportDetailView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @State private var dashboard: DashboardResponse?
    @State private var analytics: AnalyticsResponse?
    @State private var loading = false
    @State private var error: String?

    var body: some View {
        MacroMeshScreen {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if loading {
                        ProgressView("Loading weekly report…")
                            .padding(.top, 20)
                    }
                    if let error {
                        ProfileFallbackView(message: error, retry: load)
                    } else {
                        AppCard(padding: 16) {
                            VStack(alignment: .leading, spacing: 10) {
                                SectionHeader("This week", subtitle: dashboard?.dailySummary?.description ?? "A quick snapshot from your recent logs.")
                                HStack(spacing: 10) {
                                    MetricPill(title: "Meals", value: "\(dashboard?.streaks?.mealsLoggedThisWeek ?? 0)", icon: "fork.knife", tint: MacroMeshTheme.primary)
                                    MetricPill(title: "Protein hits", value: "\(dashboard?.streaks?.proteinGoalHitDaysThisWeek ?? 0)", icon: "checkmark.seal.fill", tint: .green)
                                }
                            }
                        }

                        AppCard(padding: 16) {
                            VStack(alignment: .leading, spacing: 10) {
                                SectionHeader("Averages", subtitle: analytics?.analytics.macroConsistencySummary ?? "Log a few meals to unlock patterns.")
                                HStack(spacing: 10) {
                                    MetricPill(title: "7-day cal", value: "\(Int(analytics?.analytics.sevenDayAverageCalories ?? 0))", icon: "chart.bar.fill", tint: MacroMeshTheme.blue)
                                    MetricPill(title: "30-day cal", value: "\(Int(analytics?.analytics.thirtyDayAverageCalories ?? 0))", icon: "calendar", tint: MacroMeshTheme.orange)
                                }
                                HStack(spacing: 10) {
                                    MetricPill(title: "7-day protein", value: "\(Int(analytics?.analytics.sevenDayAverageProtein ?? 0))g", icon: "bolt.fill", tint: MacroMeshTheme.purple)
                                    MetricPill(title: "Best protein", value: "\(Int(analytics?.analytics.highestProteinDay?.protein ?? 0))g", icon: "star.fill", tint: MacroMeshTheme.primaryDark)
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 96)
            }
        }
        .navigationTitle("Weekly report")
        .onAppear(perform: load)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Reload", action: load)
                    .font(.subheadline.weight(.semibold))
            }
        }
    }

    private func load() {
        loading = true
        error = nil

        BackendService.fetchDashboard { dashboardResult in
            DispatchQueue.main.async {
                switch dashboardResult {
                case .success(let response):
                    dashboard = response
                case .failure(let err):
                    sessionStore.apply(err)
                    error = RetryCopy.nonDestructiveFailure(action: "load your weekly report", error: err)
                }
                loading = false
            }
        }

        BackendService.fetchAnalytics { analyticsResult in
            DispatchQueue.main.async {
                if case .success(let response) = analyticsResult {
                    analytics = response
                }
            }
        }
    }
}

// MARK: - Custom foods

struct CustomFoodsCard: View {
    var body: some View {
        NavigationLink {
            CustomFoodsManagerView()
        } label: {
            AppCard(padding: 16) {
                HStack(spacing: 12) {
                    Image(systemName: "carrot")
                        .font(.title2)
                        .foregroundColor(MacroMeshTheme.primary)
                        .frame(width: 40, height: 40)
                        .background(MacroMeshTheme.cardSubtle)
                        .clipShape(Circle())
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Custom foods")
                            .font(.headline)
                            .foregroundColor(MacroMeshTheme.text)
                        Text("Manage saved foods you created for quick logging.")
                            .font(.caption)
                            .foregroundColor(MacroMeshTheme.muted)
                    }
                    Spacer()
                    Text("Manage")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(MacroMeshTheme.primary)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

struct CustomFoodsManagerView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @State private var foods: [FoodSearchResult] = []
    @State private var loading = false
    @State private var error: String?
    @State private var deletingIds = Set<String>()

    var body: some View {
        MacroMeshScreen {
            Group {
                if loading {
                    VStack(spacing: 10) {
                        ProgressView("Loading custom foods…")
                        Text("Your saved foods will appear here.")
                            .font(.caption)
                            .foregroundColor(MacroMeshTheme.muted)
                    }
                    .padding(.top, 24)
                } else if let error {
                    ProfileFallbackView(message: error, retry: load)
                } else if foods.isEmpty {
                    ProfileFallbackView(
                        message: "No custom foods yet. Create one from Log → Custom Food, then it’ll show up here for reuse.",
                        retry: load
                    )
                } else {
                    List {
                        ForEach(foods) { food in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(food.name)
                                    .font(.headline)
                                Text(customFoodSubtitle(food))
                                    .font(.caption)
                                    .foregroundColor(MacroMeshTheme.muted)
                            }
                            .padding(.vertical, 6)
                        }
                        .onDelete(perform: delete)
                    }
                    .scrollContentBackground(.hidden)
                }
            }
            .padding(.horizontal, foods.isEmpty ? 20 : 0)
        }
        .navigationTitle("Custom foods")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Reload", action: load)
                    .font(.subheadline.weight(.semibold))
            }
        }
        .onAppear(perform: load)
    }

    private func customFoodSubtitle(_ food: FoodSearchResult) -> String {
        let brand = food.brand?.nilIfBlank
        let macros = "\(Int(food.calories)) cal • P \(Int(food.protein))g • C \(Int(food.carbs))g • F \(Int(food.fat))g"
        if let brand { return "\(brand) • \(macros)" }
        return macros
    }

    private func load() {
        loading = true
        error = nil
        BackendService.fetchCustomFoods { result in
            DispatchQueue.main.async {
                loading = false
                switch result {
                case .success(let foods):
                    self.foods = foods
                case .failure(let err):
                    sessionStore.apply(err)
                    error = RetryCopy.nonDestructiveFailure(action: "load custom foods", error: err)
                }
            }
        }
    }

    private func delete(at offsets: IndexSet) {
        for index in offsets {
            guard foods.indices.contains(index) else { continue }
            let food = foods[index]
            deletingIds.insert(food.id)
            BackendService.deleteCustomFood(id: food.id) { result in
                DispatchQueue.main.async {
                    deletingIds.remove(food.id)
                    switch result {
                    case .success:
                        foods.removeAll { $0.id == food.id }
                    case .failure(let err):
                        sessionStore.apply(err)
                        error = RetryCopy.nonDestructiveFailure(action: "delete that custom food", error: err)
                        load()
                    }
                }
            }
        }
    }
}

// MARK: - Reminders (local notifications)

struct ReminderSettingsCard: View {
    var body: some View {
        NavigationLink {
            ReminderSettingsView()
        } label: {
            AppCard(padding: 16) {
                HStack(spacing: 12) {
                    Image(systemName: "bell.badge")
                        .font(.title2)
                        .foregroundColor(MacroMeshTheme.primary)
                        .frame(width: 40, height: 40)
                        .background(MacroMeshTheme.cardSubtle)
                        .clipShape(Circle())
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Reminders")
                            .font(.headline)
                            .foregroundColor(MacroMeshTheme.text)
                        Text("Optional nudge to log meals. Stored on-device.")
                            .font(.caption)
                            .foregroundColor(MacroMeshTheme.muted)
                    }
                    Spacer()
                    Text("Settings")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(MacroMeshTheme.primary)
                }
            }
        }
        .buttonStyle(.plain)
    }
}

@MainActor
final class ReminderSettingsModel: ObservableObject {
    @Published var permission: UNAuthorizationStatus = .notDetermined
    @Published var enabled: Bool = UserDefaults.standard.bool(forKey: Keys.enabled)
    @Published var time: Date = {
        let stored = UserDefaults.standard.double(forKey: Keys.timeInterval)
        if stored > 0 { return Date(timeIntervalSince1970: stored) }
        var components = DateComponents()
        components.hour = 19
        components.minute = 0
        return Calendar.current.date(from: components) ?? Date()
    }()

    enum Keys {
        static let enabled = "macromesh.reminder.enabled"
        static let timeInterval = "macromesh.reminder.time"
        static let notificationId = "macromesh.dailyLogReminder"
    }

    func refreshPermission() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        permission = settings.authorizationStatus
    }

    func requestPermissionIfNeeded() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        permission = settings.authorizationStatus
        guard settings.authorizationStatus == .notDetermined else { return }
        do {
            _ = try await center.requestAuthorization(options: [.alert, .sound, .badge])
        } catch {
            // ignore; UI will show disabled
        }
        await refreshPermission()
    }

    func persist() {
        UserDefaults.standard.set(enabled, forKey: Keys.enabled)
        UserDefaults.standard.set(time.timeIntervalSince1970, forKey: Keys.timeInterval)
    }

    func apply() async {
        persist()
        await requestPermissionIfNeeded()

        let center = UNUserNotificationCenter.current()
        await center.removePendingNotificationRequests(withIdentifiers: [Keys.notificationId])

        guard enabled, permission == .authorized || permission == .provisional else {
            return
        }

        let content = UNMutableNotificationContent()
        content.title = "Log your meals"
        content.body = "Quick nudge from MacroMesh — you can always turn this off in Profile."
        content.sound = .default

        let components = Calendar.current.dateComponents([.hour, .minute], from: time)
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
        let request = UNNotificationRequest(identifier: Keys.notificationId, content: content, trigger: trigger)
        do {
            try await center.add(request)
        } catch {
            // ignore; permission UI will reflect if blocked
        }
    }
}

struct ReminderSettingsView: View {
    @StateObject private var model = ReminderSettingsModel()
    @State private var message: String?

    var body: some View {
        MacroMeshScreen {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    AppCard(padding: 16) {
                        VStack(alignment: .leading, spacing: 10) {
                            SectionHeader("Daily reminder", subtitle: "Optional. Stored on-device. Guest mode friendly.")

                            Toggle("Enable daily reminder", isOn: $model.enabled)

                            DatePicker("Time", selection: $model.time, displayedComponents: .hourAndMinute)
                                .disabled(!model.enabled)

                            permissionRow

                            if let message {
                                Text(message)
                                    .font(.caption)
                                    .foregroundColor(MacroMeshTheme.muted)
                            }
                        }
                    }

                    AppCard(padding: 16) {
                        VStack(alignment: .leading, spacing: 8) {
                            SectionHeader("Heads up", subtitle: nil)
                            Text("Reminders are not medical advice and are meant as a gentle nudge. If notifications are blocked in iOS Settings, MacroMesh can’t schedule them.")
                                .font(.footnote)
                                .foregroundColor(MacroMeshTheme.muted)
                        }
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 96)
            }
        }
        .navigationTitle("Reminders")
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button("Save") {
                    Task {
                        await model.apply()
                        message = model.enabled ? "Saved. iOS will deliver this reminder daily if allowed." : "Saved. Reminders are off."
                    }
                }
                .font(.subheadline.weight(.semibold))
            }
        }
        .task {
            await model.refreshPermission()
        }
    }

    @ViewBuilder
    private var permissionRow: some View {
        let status = model.permission
        let label: String
        switch status {
        case .authorized: label = "Notifications: Allowed"
        case .provisional: label = "Notifications: Provisional"
        case .denied: label = "Notifications: Blocked"
        case .notDetermined: label = "Notifications: Not requested"
        case .ephemeral: label = "Notifications: Temporary"
        @unknown default: label = "Notifications: Unknown"
        }

        Text(label)
            .font(.caption)
            .foregroundColor(status == .denied ? .red : MacroMeshTheme.muted)
    }
}
