// ProgressView.swift
// MacroMesh: Premium Progress Tab
import Charts
import SwiftUI

struct ProgressScreenView: View {
    @EnvironmentObject private var sessionStore: SessionStore

    @State private var range: ProgressRange = .days7
    @State private var loading = false
    @State private var error: String?

    @State private var analytics: AnalyticsResponse?
    @State private var weightEntries: WeightEntriesResponse?
    @State private var profile: ProfileData?

    private let stabilityReporter = ConsoleStabilityReporter()

    var body: some View {
        NavigationView {
            MacroMeshScreen {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        heroCard

                        AppCard(padding: 12) {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Range")
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(MacroMeshTheme.muted)
                                ProgressRangePicker(range: $range)
                            }
                        }

                        if loading, weightEntries == nil {
                            AppCard(padding: 18) {
                                HStack(spacing: 12) {
                                    ProgressView()
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Loading progress")
                                            .font(.headline)
                                            .foregroundColor(MacroMeshTheme.text)
                                        Text("Fetching your weight trend and weekly summary…")
                                            .font(.caption)
                                            .foregroundColor(MacroMeshTheme.muted)
                                    }
                                    Spacer()
                                }
                            }
                        } else {
                            if let error {
                                InlineRecoveryCard(message: error, retry: load)
                            }

                            if let chartPoints = chartPoints, chartPoints.count < 2 {
                                ProgressEmptyStateView(onLog: openLog)
                            } else if let chartPoints {
                                WeightTrendChartCard(points: chartPoints, range: range)
                                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                            }

                            WeightHistoryTimelineView(
                                rows: WeightHistoryTimelineViewBuilder.build(weightEntries: weightEntries)
                            )

                            GoalProgressCard(profile: profile, latestWeight: latestWeight)
                            WeeklySummaryCard(analytics: analytics, weightDeltaLast7Days: weightDeltaLast7Days)
                            MilestonesCard()
                        }
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 12)
                    .padding(.bottom, 118)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .navigationTitle("")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: load) {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(loading)
                    .accessibilityLabel("Refresh Progress")
                }
            }
            .onAppear(perform: load)
        }
    }

    private var latestWeight: Double? {
        weightEntries?.trend.latestWeightLbs ?? analytics?.weightTrend.latestWeightLbs ?? profile?.weightLbs
    }

    private var heroCard: some View {
        AppCard(padding: 18) {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Progress")
                        .font(.title2.weight(.bold))
                        .foregroundColor(MacroMeshTheme.text)
                    Spacer()
                    Badge("TestFlight Beta", color: MacroMeshTheme.orange)
                        .accessibilityHidden(true)
                }

                HStack(alignment: .lastTextBaseline, spacing: 10) {
                    Text(latestWeight.map { String(format: "%.1f", $0) } ?? "—")
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                        .foregroundColor(MacroMeshTheme.text)
                        .minimumScaleFactor(0.7)
                        .accessibilityLabel(latestWeight.map { "Current weight \(String(format: "%.1f", $0)) pounds" } ?? "Current weight not set")
                    Text("lbs")
                        .font(.headline)
                        .foregroundColor(MacroMeshTheme.muted)
                    Spacer()
                }

                Text(latestWeight == nil ? "Log a weigh-in to start seeing trends." : "Trends update as you log weigh-ins and meals.")
                    .font(.subheadline)
                    .foregroundColor(MacroMeshTheme.muted)
            }
        }
    }

    private var chartPoints: [WeightChartPoint]? {
        guard let entries = weightEntries?.entries else { return weightEntries == nil ? nil : [] }

        let now = Date()
        let calendar = Calendar.current

        // 1) Parse dates
        // 2) Filter invalid/placeholder weights
        // 3) Drop future-ish timestamps
        // 4) Sort chronologically
        // 5) De-dupe by day (prevents vertical edge artifacts when multiple entries share the same timestamp)
        let parsed: [(Date, Double)] = entries.compactMap { entry in
            guard let date = DateParser.parseMealDate(entry.date) else { return nil }
            let weight = entry.weightLbs
            guard weight.isFinite, weight >= 60, weight <= 600 else { return nil }
            guard date <= now.addingTimeInterval(6 * 3600) else { return nil }
            return (date, weight)
        }
        .sorted { $0.0 < $1.0 }

        var latestByDay: [Date: (Date, Double)] = [:]
        for (date, weight) in parsed {
            let day = calendar.startOfDay(for: date)
            // Keep the latest entry for that day.
            if let existing = latestByDay[day] {
                if date > existing.0 {
                    latestByDay[day] = (date, weight)
                }
            } else {
                latestByDay[day] = (date, weight)
            }
        }

        let deduped = latestByDay.values
            .sorted { $0.0 < $1.0 }
            .map { WeightChartPoint(date: $0.0, weightLbs: $0.1) }

        let cutoff: Date?
        switch range {
        case .days7:
            cutoff = Calendar.current.date(byAdding: .day, value: -7, to: Date())
        case .days30:
            cutoff = Calendar.current.date(byAdding: .day, value: -30, to: Date())
        case .days90:
            cutoff = Calendar.current.date(byAdding: .day, value: -90, to: Date())
        case .all:
            cutoff = nil
        }
        guard let cutoff else { return deduped }
        return deduped.filter { $0.date >= cutoff }
    }

    private var weightDeltaLast7Days: Double? {
        guard let entries = weightEntries?.entries else { return nil }
        let parsed = entries.compactMap { entry -> (Date, Double)? in
            guard let date = DateParser.parseMealDate(entry.date) else { return nil }
            return (date, entry.weightLbs)
        }
        .sorted { $0.0 < $1.0 }
        let cutoff = Calendar.current.date(byAdding: .day, value: -7, to: Date()) ?? Date().addingTimeInterval(-7 * 86400)
        let window = parsed.filter { $0.0 >= cutoff }
        guard let first = window.first?.1, let last = window.last?.1, window.count >= 2 else { return nil }
        return last - first
    }

    private func openLog() {
        NotificationCenter.default.post(name: .macroMeshOpenLogTab, object: nil)
    }

    private func load() {
        guard !loading else { return }
        loading = true
        error = nil

        let group = DispatchGroup()

        group.enter()
        BackendService.fetchAnalytics { result in
            DispatchQueue.main.async {
                defer { group.leave() }
                if case .success(let response) = result {
                    analytics = response
                }
            }
        }

        group.enter()
        BackendService.fetchWeightEntries { result in
            DispatchQueue.main.async {
                defer { group.leave() }
                switch result {
                case .success(let response):
                    weightEntries = response
                case .failure(let err):
                    sessionStore.apply(err)
                    stabilityReporter.record(.networkFailure(screen: "Progress", message: err.localizedDescription))
                    error = RetryCopy.nonDestructiveFailure(action: "load Progress", error: err)
                }
            }
        }

        group.enter()
        BackendService.fetchProfile { result in
            DispatchQueue.main.async {
                defer { group.leave() }
                if case .success(let response) = result {
                    profile = response
                }
            }
        }

        group.notify(queue: .main) {
            loading = false
        }
    }
}

private enum WeightHistoryTimelineViewBuilder {
    static func build(weightEntries: WeightEntriesResponse?) -> [WeightHistoryTimelineView.Row] {
        let now = Date()
        let parsed = (weightEntries?.entries ?? []).compactMap { entry -> (Date, Double, String)? in
            guard let date = DateParser.parseMealDate(entry.date) else { return nil }
            let weight = entry.weightLbs
            guard weight.isFinite, weight >= 60, weight <= 600 else { return nil }
            guard date <= now.addingTimeInterval(6 * 3600) else { return nil }
            return (date, weight, entry.id)
        }
        .sorted { $0.0 > $1.0 }

        return parsed.enumerated().map { index, item in
            let next = parsed.dropFirst(index + 1).first
            let delta = next.map { item.1 - $0.1 }
            return WeightHistoryTimelineView.Row(id: item.2, date: item.0, weightLbs: item.1, deltaLbs: delta)
        }
    }
}

enum ProgressRange: String, CaseIterable, Identifiable {
    case days7 = "7D"
    case days30 = "30D"
    case days90 = "90D"
    case all = "All"

    var id: String { rawValue }
}

struct ProgressRangePicker: View {
    @Binding var range: ProgressRange

    var body: some View {
        Picker("Range", selection: $range) {
            ForEach(ProgressRange.allCases) { option in
                Text(option.rawValue).tag(option)
            }
        }
        .pickerStyle(.segmented)
        .frame(width: 240)
        .accessibilityLabel("Select time range")
    }
}

struct WeightChartPoint: Identifiable, Equatable {
    let id = UUID()
    let date: Date
    let weightLbs: Double
}

private struct WeightTrendChartCard: View {
    let points: [WeightChartPoint]
    let range: ProgressRange

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Weight trend", subtitle: chartSubtitle)
                Chart(points) {
                    LineMark(
                        x: .value("Day", $0.date),
                        y: .value("Weight", $0.weightLbs)
                    )
                    .foregroundStyle(MacroMeshTheme.primary)
                    .interpolationMethod(.catmullRom)
                    AreaMark(
                        x: .value("Day", $0.date),
                        y: .value("Weight", $0.weightLbs)
                    )
                    .foregroundStyle(LinearGradient(colors: [MacroMeshTheme.primary.opacity(0.22), .clear], startPoint: .top, endPoint: .bottom))
                }
                .chartYScale(domain: yDomain)
                .frame(height: 220)
                .animation(.easeInOut(duration: 0.25), value: points)
                .accessibilityLabel("Weight trend chart")
            }
        }
    }

    private var chartSubtitle: String {
        points.count < 2 ? "Log a few weigh-ins to see a clearer trend." : "Showing \(range.rawValue.lowercased()) trend from your weigh-ins."
    }

    private var yDomain: ClosedRange<Double> {
        let values = points.map(\.weightLbs)
        guard let minValue = values.min(), let maxValue = values.max() else { return 0...1 }
        let padding = max((maxValue - minValue) * 0.12, 1)
        return (minValue - padding)...(maxValue + padding)
    }
}

private struct GoalProgressCard: View {
    let profile: ProfileData?
    let latestWeight: Double?

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Goal progress", subtitle: subtitle)

                if goalWeightLbs == nil {
                    EmptyStateCard(
                        icon: "target",
                        title: "Set a goal weight to unlock progress tracking",
                        message: "Go to Profile → Update goals and add an optional goal weight.",
                        buttonTitle: nil,
                        action: nil
                    )
                } else if latestWeight == nil {
                    EmptyStateCard(
                        icon: "scalemass",
                        title: "Log a weigh-in to start tracking",
                        message: "Your goal progress will update after your first weigh-in.",
                        buttonTitle: nil,
                        action: nil
                    )
                } else {
                    HStack(spacing: 12) {
                        MetricTile(title: "Current", value: latestWeightText, icon: "scalemass", tint: MacroMeshTheme.primary)
                        MetricTile(title: "Goal", value: goalWeightText, icon: "target", tint: MacroMeshTheme.orange)
                    }
                    if let remainingText {
                        Text(remainingText)
                            .font(.caption.weight(.semibold))
                            .foregroundColor(MacroMeshTheme.muted)
                    }

                    if let progress {
                        ProgressBar(progress: progress, color: MacroMeshTheme.primary)
                            .accessibilityLabel("Goal progress \(Int(progress * 100)) percent")
                    }
                }
            }
        }
    }

    // Goal weight is not currently persisted in ProfileData.
    private var goalWeightLbs: Double? { nil }

    private var subtitle: String {
        if goalWeightLbs == nil {
            return "Set a goal weight to unlock remaining and percent progress."
        }
        if latestWeight == nil {
            return "Log a weigh-in to start tracking progress."
        }
        return "Progress updates as you log weigh-ins."
    }

    private var latestWeightText: String {
        latestWeight.map { String(format: "%.1f lbs", $0) } ?? "—"
    }

    private var goalWeightText: String {
        goalWeightLbs.map { String(format: "%.1f lbs", $0) } ?? "—"
    }

    private var remainingText: String? {
        guard let current = latestWeight, let goal = goalWeightLbs else { return nil }
        let remaining = goal - current
        // Lose vs gain messaging based on direction.
        if remaining > 0 {
            return String(format: "%.1f lbs to go", remaining)
        }
        if remaining < 0 {
            return String(format: "%.1f lbs past goal", abs(remaining))
        }
        return "Goal reached"
    }

    private var progress: Double? {
        // Requires a starting weight and goal weight to compute safely.
        nil
    }
}

private struct WeeklySummaryCard: View {
    let analytics: AnalyticsResponse?
    let weightDeltaLast7Days: Double?

    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader("Weekly summary", subtitle: "A quick look at the last 7 days.")

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    SummaryTile(title: "Avg calories", value: avgCaloriesText, icon: "flame.fill", tint: MacroMeshTheme.orange)
                    SummaryTile(title: "Avg protein", value: avgProteinText, icon: "bolt.heart.fill", tint: MacroMeshTheme.primary)
                    SummaryTile(title: "Weight change", value: weightChangeText, icon: "scalemass", tint: MacroMeshTheme.blue)
                    SummaryTile(title: "Avg deficit", value: "Not enough data yet", icon: "minus.circle", tint: MacroMeshTheme.purple)
                }
            }
        }
    }

    private var avgCaloriesText: String {
        guard let value = analytics?.analytics.sevenDayAverageCalories, value > 0 else { return "Not enough data" }
        return "\(Int(value))"
    }

    private var avgProteinText: String {
        guard let value = analytics?.analytics.sevenDayAverageProtein, value > 0 else { return "Not enough data" }
        return "\(Int(value))g"
    }

    private var weightChangeText: String {
        guard let delta = weightDeltaLast7Days else { return "Not enough data" }
        return String(format: "%+.1f lbs", delta)
    }
}

private struct SummaryTile: View {
    let title: String
    let value: String
    let icon: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundColor(tint)
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.muted)
                Spacer()
            }
            Text(value)
                .font(.title3.weight(.bold))
                .foregroundColor(MacroMeshTheme.text)
                .minimumScaleFactor(0.8)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MacroMeshTheme.cardSubtle.opacity(0.85))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

private struct MilestonesCard: View {
    var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeader("Milestones", subtitle: "Small wins that compound.")
                Text("Milestones coming soon")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.text)
                Text("We’ll surface streaks, weight milestones, and protein consistency as you log.")
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.muted)
            }
        }
    }
}

struct ProgressEmptyStateView: View {
    var onLog: () -> Void

    var body: some View {
        EmptyStateCard(
            icon: "chart.line.uptrend.xyaxis",
            title: "Not enough data yet",
            message: "Log a weigh-in (and a few meals) to unlock weight trends and weekly summaries.",
            buttonTitle: "Log a meal",
            action: onLog
        )
        .accessibilityLabel("Not enough data yet. Log a meal to begin.")
    }
}

#Preview {
    ProgressScreenView()
}
