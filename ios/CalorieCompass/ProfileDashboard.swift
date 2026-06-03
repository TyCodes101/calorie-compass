import Foundation
import SwiftUI

struct ProfileDashboardModel: Equatable {
    let displayName: String
    let statusPillText: String
    let statusPillTint: Color

    let calorieGoalText: String
    let proteinGoalText: String
    let carbsGoalText: String
    let fatGoalText: String

    let currentWeightText: String
    let weeklyTrendText: String
    let weightDeltaText: String

    let todayCaloriesText: String
    let todayMacrosText: String
    let adherenceText: String

    let streakText: String
    let mealsThisWeekText: String
    let momentumSummaryText: String

    let isGuest: Bool

    static func build(
        profile: ProfileData?,
        isGuest: Bool,
        analytics: AnalyticsResponse?,
        dashboard: DashboardResponse?,
        weightEntries: WeightEntriesResponse?
    ) -> ProfileDashboardModel {
        let name = profile?.name.nilIfBlank ?? (isGuest ? "Guest" : "Profile")
        let statusText = isGuest ? "Guest" : "Synced"
        let statusTint = isGuest ? MacroMeshTheme.orange : MacroMeshTheme.blue

        let calorieGoal = profile?.dailyCalorieGoal.map { "\($0)" } ?? "—"
        let proteinGoal = profile?.proteinGoal.map { "\($0)g" } ?? "—"
        let carbsGoal = dashboard?.macroGoals?.carbs.map { "\(Int($0))g" } ?? "—"
        let fatGoal = dashboard?.macroGoals?.fat.map { "\(Int($0))g" } ?? "—"

        let latestWeight = weightEntries?.trend.latestWeightLbs ?? analytics?.weightTrend.latestWeightLbs ?? profile?.weightLbs
        let currentWeightText = latestWeight.map { String(format: "%.1f lbs", $0) } ?? "Add weight"

        let change = weightEntries?.trend.changeLbs ?? analytics?.weightTrend.changeLbs ?? 0
        let direction = (weightEntries?.trend.direction ?? analytics?.weightTrend.direction)?.lowercased() ?? ""
        let deltaText = latestWeight == nil ? "No trend yet" : String(format: "%+.1f lbs", change)
        let weeklyTrendText = latestWeight == nil ? "Log 2–3 weigh-ins to see trend" : "\(deltaText) • \(direction.capitalized)"
        let weightDeltaText = latestWeight == nil ? "" : deltaText

        let todayCalories = Int(dashboard?.displayedCalories ?? 0)
        let goalCalories = max(Int(dashboard?.displayedGoalCalories ?? 0), 1)
        let todayCaloriesText = "\(todayCalories) / \(goalCalories)"

        let p = Int(dashboard?.displayedProtein ?? 0)
        let c = Int(dashboard?.displayedCarbs ?? 0)
        let f = Int(dashboard?.displayedFat ?? 0)
        let todayMacrosText = "P \(p)g  •  C \(c)g  •  F \(f)g"

        let adherence = dashboard.map { response -> String in
            let caloriesRatio = min(max((response.displayedCalories) / max(response.displayedGoalCalories, 1), 0), 1.5)
            let score = Int(min(caloriesRatio, 1) * 100)
            return "\(score)%"
        } ?? "—"

        let streak = dashboard?.streaks?.currentStreakDays ?? 0
        let mealsThisWeek = dashboard?.streaks?.mealsLoggedThisWeek ?? 0
        let streakText = streak > 0 ? "\(streak) day streak" : "Start a streak"
        let mealsThisWeekText = "\(mealsThisWeek) meals this week"
        let momentumSummaryText = dashboard?.streaks?.summary?.nilIfBlank ?? (mealsThisWeek > 0 ? "Keep going — consistency compounds." : "Log a meal to kick off your week.")

        return ProfileDashboardModel(
            displayName: name,
            statusPillText: statusText,
            statusPillTint: statusTint,
            calorieGoalText: calorieGoal,
            proteinGoalText: proteinGoal,
            carbsGoalText: carbsGoal,
            fatGoalText: fatGoal,
            currentWeightText: currentWeightText,
            weeklyTrendText: weeklyTrendText,
            weightDeltaText: weightDeltaText,
            todayCaloriesText: todayCaloriesText,
            todayMacrosText: todayMacrosText,
            adherenceText: adherence,
            streakText: streakText,
            mealsThisWeekText: mealsThisWeekText,
            momentumSummaryText: momentumSummaryText,
            isGuest: isGuest
        )
    }
}

struct ProfileDashboardView: View {
    let model: ProfileDashboardModel
    let weightEntries: WeightEntriesResponse?

    let onUpdateGoals: () -> Void
    let onLogWeight: () -> Void
    let onWeeklyReport: () -> Void
    let onCustomFoods: () -> Void
    let onReminders: () -> Void
    let onPrivacyAbout: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ProfileIdentityHeader(model: model)

            FitnessSnapshotCard(model: model, onLogWeight: onLogWeight)
            WeightHistoryTimelineView(rows: WeightHistoryTimelineProfileBuilder.build(weightEntries: weightEntries))
            NutritionSnapshotCard(model: model)
            WeeklyMomentumCard(model: model)

            ProfileActionsCard(
                onUpdateGoals: onUpdateGoals,
                onLogWeight: onLogWeight,
                onWeeklyReport: onWeeklyReport
            )
            PreferencesCard(
                onCustomFoods: onCustomFoods,
                onReminders: onReminders
            )
            PrivacyCard(onPrivacyAbout: onPrivacyAbout)
        }
    }
}

private enum WeightHistoryTimelineProfileBuilder {
    static func build(weightEntries: WeightEntriesResponse?) -> [WeightHistoryTimelineView.Row] {
        let parsed = (weightEntries?.entries ?? []).compactMap { entry -> (Date, Double, String)? in
            guard let date = DateParser.parseMealDate(entry.date) else { return nil }
            return (date, entry.weightLbs, entry.id)
        }
        .sorted { $0.0 > $1.0 }

        return parsed.enumerated().map { index, item in
            let next = parsed.dropFirst(index + 1).first
            let delta = next.map { item.1 - $0.1 }
            return WeightHistoryTimelineView.Row(id: item.2, date: item.0, weightLbs: item.1, deltaLbs: delta)
        }
    }
}

private struct ProfileIdentityHeader: View {
    let model: ProfileDashboardModel

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .center, spacing: 12) {
                    ZStack {
                        Circle().fill(MacroMeshTheme.cardSubtle)
                        Image(systemName: "person.fill")
                            .foregroundColor(MacroMeshTheme.primary)
                    }
                    .frame(width: 44, height: 44)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(model.displayName)
                            .font(.headline.weight(.semibold))
                            .foregroundColor(MacroMeshTheme.text)
                            .lineLimit(1)
                        Text(model.isGuest ? "Guest mode" : "Account profile")
                            .font(.caption)
                            .foregroundColor(MacroMeshTheme.muted)
                            .lineLimit(1)
                    }

                    Spacer()

                    Text(model.statusPillText)
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(model.statusPillTint.opacity(0.14))
                        .foregroundColor(model.statusPillTint)
                        .clipShape(Capsule())
                        .accessibilityLabel(model.isGuest ? "Guest profile" : "Synced profile")
                }

                HStack(spacing: 12) {
                    SnapshotMetric(title: "Current weight", value: model.currentWeightText)
                    SnapshotMetric(title: "Streak", value: model.streakText)
                }
            }
        }
    }
}

private struct FitnessSnapshotCard: View {
    let model: ProfileDashboardModel
    let onLogWeight: () -> Void

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    SectionHeader("Fitness snapshot", subtitle: "Weight trend is estimated from recent weigh-ins.")
                    Spacer()
                    Button(action: onLogWeight) {
                        Label("Log weight", systemImage: "plus")
                    }
                    .buttonStyle(InlineCapsuleActionStyle())
                    .accessibilityHint("Adds a new weight entry.")
                }

                HStack(spacing: 12) {
                    SnapshotMetric(title: "Current", value: model.currentWeightText)
                    SnapshotMetric(title: "Weekly", value: model.weeklyTrendText)
                }

                MacroMeshFootnote("Estimated trend improves after 2–3 weigh-ins.")
            }
        }
    }
}

private struct NutritionSnapshotCard: View {
    let model: ProfileDashboardModel

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Nutrition targets", subtitle: "A quick 2×2 view of your daily goals.")

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    TargetTile(title: "Calories", value: model.calorieGoalText, subtitle: "Daily Target", icon: "flame.fill", tint: MacroMeshTheme.orange)
                    TargetTile(title: "Protein", value: model.proteinGoalText, subtitle: "Muscle Support", icon: "bolt.heart.fill", tint: MacroMeshTheme.primary)
                    TargetTile(title: "Carbs", value: model.carbsGoalText, subtitle: "Energy", icon: "leaf", tint: MacroMeshTheme.blue)
                    TargetTile(title: "Fat", value: model.fatGoalText, subtitle: "Hormonal Health", icon: "drop.fill", tint: MacroMeshTheme.purple)
                }

                HStack(spacing: 12) {
                    SnapshotMetric(title: "Today", value: model.todayCaloriesText)
                    SnapshotMetric(title: "Adherence", value: model.adherenceText)
                }
                Text(model.todayMacrosText)
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.muted)
                    .accessibilityLabel("Macros today. \(model.todayMacrosText)")
            }
        }
    }
}

private struct TargetTile: View {
    let title: String
    let value: String
    let subtitle: String
    let icon: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(tint)
                Spacer()
            }
            Text(value)
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .foregroundColor(MacroMeshTheme.text)
                .minimumScaleFactor(0.75)
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundColor(MacroMeshTheme.muted)
                .textCase(.uppercase)
                .tracking(0.8)
            Text(subtitle)
                .font(.caption)
                .foregroundColor(MacroMeshTheme.muted)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 118, alignment: .leading)
        .background(MacroMeshTheme.cardSubtle.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

private struct WeeklyMomentumCard: View {
    let model: ProfileDashboardModel

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader("Weekly momentum", subtitle: model.momentumSummaryText)

                HStack(spacing: 12) {
                    SnapshotMetric(title: "Streak", value: model.streakText)
                    SnapshotMetric(title: "Volume", value: model.mealsThisWeekText)
                }
            }
        }
    }
}

private struct ProfileActionsCard: View {
    let onUpdateGoals: () -> Void
    let onLogWeight: () -> Void
    let onWeeklyReport: () -> Void

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Actions", subtitle: "Do the next helpful thing.")
                VStack(spacing: 10) {
                    ActionRow(title: "Update goals", subtitle: "Adjust targets and protein preference", systemImage: "target", action: onUpdateGoals)
                    ActionRow(title: "Log weight", subtitle: "One entry — trend will follow", systemImage: "scalemass", action: onLogWeight)
                    ActionRow(title: "Weekly report", subtitle: "A quick scan of your last 7 days", systemImage: "chart.line.uptrend.xyaxis", action: onWeeklyReport)
                }
            }
        }
    }
}

private struct PreferencesCard: View {
    let onCustomFoods: () -> Void
    let onReminders: () -> Void

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Preferences", subtitle: "Make MacroMesh feel like yours.")
                VStack(spacing: 10) {
                    ActionRow(title: "Custom foods", subtitle: "Create and reuse your staples", systemImage: "square.and.pencil", action: onCustomFoods)
                    ActionRow(title: "Reminders", subtitle: "Turn notifications on or off", systemImage: "bell", action: onReminders)
                }
            }
        }
    }
}

private struct PrivacyCard: View {
    let onPrivacyAbout: () -> Void

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Privacy", subtitle: "Export, delete, and learn more.")
                ActionRow(title: "Privacy & About", subtitle: "Data, version, and app basics", systemImage: "hand.raised", action: onPrivacyAbout)
            }
        }
    }
}

private struct ActionRow: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: systemImage)
                    .foregroundColor(MacroMeshTheme.primary)
                    .frame(width: 28)
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(MacroMeshTheme.text)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(MacroMeshTheme.muted)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.muted)
            }
            .padding(12)
            .background(MacroMeshTheme.cardSubtle.opacity(0.7))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

// QuickActionTile replaced by ActionRow inside card sections.

struct SnapshotMetric: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.caption)
                .foregroundColor(MacroMeshTheme.muted)
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(MacroMeshTheme.text)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

private struct InlineCapsuleActionStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.caption.weight(.semibold))
            .foregroundColor(MacroMeshTheme.primary)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(MacroMeshTheme.primary.opacity(configuration.isPressed ? 0.14 : 0.10))
            .clipShape(Capsule())
    }
}

private struct MacroMeshFootnote: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(.caption2)
            .foregroundColor(MacroMeshTheme.muted)
            .accessibilityLabel(text)
    }
}
