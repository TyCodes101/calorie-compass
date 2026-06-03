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
