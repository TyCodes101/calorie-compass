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
                                Text("Weekly report")
                                    .font(.title2.weight(.bold))
                                    .foregroundColor(MacroMeshTheme.text)
                                Text("A quick scan of your recent nutrition and weigh-ins.")
                                    .font(.subheadline)
                                    .foregroundColor(MacroMeshTheme.muted)
                            }
                        }

                        AnalyticsSummaryCard(analytics: analytics)
                        WeightTrackingCard(response: weightEntries, onLogWeight: {})

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
                            Text("Estimates: MacroMesh uses your saved meals and recent weigh-ins. If something looks off, log one more meal or weigh-in and re-check.")
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
                                Text(isGuest ? "You’re in guest mode — your data stays local unless you sign in." : "Your account data is synced securely with your session.")
                                    .font(.subheadline)
                                    .foregroundColor(MacroMeshTheme.muted)
                            }
                        }

                        SessionAndPrivacyNote()
                            .padding(.top, 4)

                        AppCard(padding: 16) {
                            VStack(alignment: .leading, spacing: 8) {
                                SectionHeader("About MacroMesh")
                                Text("MacroMesh helps you log meals with review-before-save, so you stay in control.")
                                    .font(.caption)
                                    .foregroundColor(MacroMeshTheme.muted)
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
}
