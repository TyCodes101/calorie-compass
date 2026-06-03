import SwiftUI
import UIKit

struct WeeklyReportSheet: View {
    let analytics: AnalyticsResponse?
    let dashboard: DashboardResponse?
    let weightEntries: WeightEntriesResponse?

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            MacroMeshScreen {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        AppCard(padding: 18) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("This week at a glance")
                                    .font(.title2.weight(.bold))
                                    .foregroundColor(MacroMeshTheme.text)
                                Text("A quick scan of your recent logging and weigh-ins.")
                                    .font(.subheadline)
                                    .foregroundColor(MacroMeshTheme.muted)
                            }
                        }

                        WeeklyAtAGlanceCard(analytics: analytics, dashboard: dashboard, weightEntries: weightEntries)

                        if analytics != nil {
                            AnalyticsSummaryCard(analytics: analytics)
                        }

                        if weightEntries != nil {
                            WeightTrackingCard(response: weightEntries, onLogWeight: {})
                        }

                        if let streaks = dashboard?.streaks {
                            AppCard(padding: 16) {
                                VStack(alignment: .leading, spacing: 10) {
                                    SectionHeader("Momentum", subtitle: streaks.summary ?? "Build consistency one meal at a time.")
                                    HStack(spacing: 10) {
                                        MetricPill(title: "Streak", value: "\(streaks.currentStreakDays)d", icon: "flame.fill", tint: MacroMeshTheme.orange)
                                        MetricPill(title: "Meals", value: "\(streaks.mealsLoggedThisWeek)", icon: "calendar", tint: MacroMeshTheme.primary)
                                        MetricPill(title: "Protein", value: "\(streaks.proteinGoalHitDaysThisWeek)/7", icon: "bolt.fill", tint: MacroMeshTheme.blue)
                                    }
                                }
                            }
                        }

                        AppCard(padding: 14) {
                            Text("Tip: Trends get better with consistency. Log a few meals and 2–3 weigh-ins to unlock clearer insights.")
                                .font(.caption)
                                .foregroundColor(MacroMeshTheme.muted)
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
                    .padding(.bottom, 28)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

private struct WeeklyAtAGlanceCard: View {
    let analytics: AnalyticsResponse?
    let dashboard: DashboardResponse?
    let weightEntries: WeightEntriesResponse?

    var body: some View {
        let tiles = buildTiles()

        return AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Highlights", subtitle: "Real data from your last 7 days.")

                if tiles.isEmpty {
                    EmptyStateCard(
                        icon: "sparkles",
                        title: "Not enough data yet",
                        message: "Log and save a few meals this week to unlock a weekly summary.",
                        buttonTitle: nil,
                        action: nil
                    )
                } else {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        ForEach(tiles) { tile in
                            WeeklyHighlightTile(tile: tile)
                        }
                    }
                }
            }
        }
    }

    private func buildTiles() -> [WeeklyHighlightTileModel] {
        var out: [WeeklyHighlightTileModel] = []

        if let meals = dashboard?.streaks?.mealsLoggedThisWeek, meals > 0 {
            out.append(WeeklyHighlightTileModel(id: "meals", title: "Meals logged", value: "\(meals)", icon: "fork.knife", tint: MacroMeshTheme.primary))
        }

        if let avgCals = analytics?.analytics.sevenDayAverageCalories, avgCals > 0 {
            out.append(WeeklyHighlightTileModel(id: "avg-cals", title: "Avg calories", value: "\(Int(avgCals))", icon: "flame.fill", tint: MacroMeshTheme.orange))
        }

        if let avgProtein = analytics?.analytics.sevenDayAverageProtein, avgProtein > 0 {
            out.append(WeeklyHighlightTileModel(id: "avg-protein", title: "Avg protein", value: "\(Int(avgProtein))g", icon: "bolt.heart.fill", tint: MacroMeshTheme.primary))
        }

        if let delta = weightDeltaLast7Days {
            out.append(WeeklyHighlightTileModel(id: "weight", title: "Weight change", value: String(format: "%+.1f lbs", delta), icon: "scalemass", tint: delta > 0 ? MacroMeshTheme.orange : MacroMeshTheme.blue))
        }

        if let best = analytics?.analytics.highestProteinDay {
            out.append(WeeklyHighlightTileModel(id: "best-protein", title: "Best protein day", value: "\(Int(best.protein))g", icon: "star.fill", tint: MacroMeshTheme.purple))
        }

        // Prefer showing 4 tiles max for hierarchy.
        return Array(out.prefix(4))
    }

    private var weightDeltaLast7Days: Double? {
        let parsed = (weightEntries?.entries ?? []).compactMap { entry -> (Date, Double)? in
            guard let date = DateParser.parseMealDate(entry.date) else { return nil }
            return (date, entry.weightLbs)
        }
        .sorted { $0.0 < $1.0 }

        let cutoff = Calendar.current.date(byAdding: .day, value: -7, to: Date()) ?? Date().addingTimeInterval(-7 * 86400)
        let window = parsed.filter { $0.0 >= cutoff }
        guard let first = window.first?.1, let last = window.last?.1, window.count >= 2 else { return nil }
        return last - first
    }
}

private struct WeeklyHighlightTileModel: Identifiable {
    let id: String
    let title: String
    let value: String
    let icon: String
    let tint: Color
}

private struct WeeklyHighlightTile: View {
    let tile: WeeklyHighlightTileModel

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Image(systemName: tile.icon)
                    .foregroundColor(tile.tint)
                Spacer()
            }
            Text(tile.value)
                .font(.title3.weight(.bold))
                .foregroundColor(MacroMeshTheme.text)
                .minimumScaleFactor(0.75)
            Text(tile.title)
                .font(.caption.weight(.semibold))
                .foregroundColor(MacroMeshTheme.muted)
        }
        .padding(12)
        .frame(maxWidth: .infinity, minHeight: 96, alignment: .leading)
        .background(MacroMeshTheme.cardSubtle.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

struct RemindersEntrySheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            MacroMeshScreen {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        AppCard(padding: 18) {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Reminders")
                                    .font(.title2.weight(.bold))
                                    .foregroundColor(MacroMeshTheme.text)
                                Text("Turn on notifications to get meal and weigh-in nudges. You’ll always be able to adjust or disable these.")
                                    .font(.subheadline)
                                    .foregroundColor(MacroMeshTheme.muted)
                            }
                        }

                        AppCard(padding: 16) {
                            VStack(alignment: .leading, spacing: 12) {
                                SectionHeader("Notification access")
                                Text("MacroMesh uses iOS Notifications for reminders. We’ll only send what you enable.")
                                    .font(.caption)
                                    .foregroundColor(MacroMeshTheme.muted)

                                Button {
                                    if let url = URL(string: UIApplication.openSettingsURLString) {
                                        UIApplication.shared.open(url)
                                    }
                                } label: {
                                    Label("Open iOS Settings", systemImage: "gear")
                                        .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(SecondaryCTAButtonStyle())
                            }
                        }

                        AppCard(padding: 14) {
                            Text("No dead ends: you can keep logging without reminders. When you’re ready, come back and enable them.")
                                .font(.caption)
                                .foregroundColor(MacroMeshTheme.muted)
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
                    .padding(.bottom, 28)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}

struct PrivacyAboutSheet: View {
    let isGuest: Bool

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            MacroMeshScreen {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        AppCard(padding: 18) {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Privacy & About")
                                    .font(.title2.weight(.bold))
                                    .foregroundColor(MacroMeshTheme.text)
                                Text(isGuest ? "Guest mode is always available. You can sign in when you want." : "You’re signed in. Your data is associated with your account.")
                                    .font(.subheadline)
                                    .foregroundColor(MacroMeshTheme.muted)
                            }
                        }

                        AppCard(padding: 16) {
                            VStack(alignment: .leading, spacing: 12) {
                                SectionHeader("Privacy & Data", subtitle: "Simple promises — no hidden surprises.")
                                PrivacyBulletRow(systemImage: "hand.raised.fill", text: "Your nutrition data belongs to you.")
                                PrivacyBulletRow(systemImage: "square.and.arrow.up", text: "Export is available from Profile.")
                                PrivacyBulletRow(systemImage: "trash.fill", text: "Account deletion is available from Profile.")
                                PrivacyBulletRow(systemImage: "applelogo", text: "Sign in with Apple is supported (optional).")
                                PrivacyBulletRow(systemImage: "lock.fill", text: "Data stays private — nothing logs until you review it.")
                            }
                        }

                        AppCard(padding: 16) {
                            VStack(alignment: .leading, spacing: 10) {
                                SectionHeader("About MacroMesh", subtitle: "A calmer way to stay consistent.")
                                Text("MacroMesh helps you log meals naturally, review every estimate before saving, and track calories + macros over time.")
                                    .font(.subheadline)
                                    .foregroundColor(MacroMeshTheme.muted)
                                Text("Consistency beats perfection — one saved meal at a time.")
                                    .font(.caption)
                                    .foregroundColor(MacroMeshTheme.muted)
                            }
                        }

                        AppCard(padding: 16) {
                            VStack(alignment: .leading, spacing: 10) {
                                SectionHeader("Version")
                                HStack {
                                    Text("MacroMesh")
                                        .font(.headline)
                                        .foregroundColor(MacroMeshTheme.text)
                                    Spacer()
                                    if isTestFlight {
                                        Badge("TestFlight Beta", color: MacroMeshTheme.orange)
                                    }
                                }
                                Text("Version \(appVersion) (\(buildNumber))")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundColor(MacroMeshTheme.text)
                                    .accessibilityLabel("App version \(appVersion), build \(buildNumber)")
                            }
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
                    .padding(.bottom, 28)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
    }

    private var buildNumber: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "—"
    }

    private var isTestFlight: Bool {
        (Bundle.main.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt")
    }
}

private struct PrivacyBulletRow: View {
    let systemImage: String
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: systemImage)
                .foregroundColor(MacroMeshTheme.primary)
                .frame(width: 20)
            Text(text)
                .font(.subheadline)
                .foregroundColor(MacroMeshTheme.text)
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }
}
