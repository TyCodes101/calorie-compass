// ProgressView.swift
// MacroMesh: Premium Progress Tab
import SwiftUI
import Charts

struct ProgressScreenView: View {
    @EnvironmentObject private var sessionStore: SessionStore
    @State private var range: ProgressRange = .week

    // Dummy data for now; wire to backend model as available
    let chartData: [ProgressChartPoint] = [] // To be filled with fetched trend data

    var body: some View {
        MacroMeshScreen {
            ScrollView {
                VStack(spacing: MacroMeshTheme.spacing) {
                    header
                    if chartData.isEmpty {
                        ProgressEmptyStateView(onLog: openLog)
                    } else {
                        ProgressChartSection(chartData: chartData, range: range)
                            .accessibilityElement(children: .contain)
                            .transition(.opacity.combined(with: .slide))
                    }
                    Spacer(minLength: 40)
                }
                .padding()
            }
            .navigationTitle("Progress")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    ProgressRangePicker(range: $range)
                }
            }
        }
    }
    
    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            SectionHeader("Progress", subtitle: "Track your trends and targets over time.")
        }
    }
    
    private func openLog() {
        NotificationCenter.default.post(name: .macroMeshOpenLogTab, object: nil)
    }
}

// Picker for time ranges
enum ProgressRange: String, CaseIterable, Identifiable {
    case week = "7D"
    case month = "1M"
    case year = "1Y"
    var id: String { rawValue }
    var label: String {
        switch self {
        case .week: return "This Week"
        case .month: return "This Month"
        case .year: return "This Year"
        }
    }
}

struct ProgressRangePicker: View {
    @Binding var range: ProgressRange
    var body: some View {
        Menu {
            ForEach(ProgressRange.allCases) { r in
                Button(r.label) { range = r }
            }
        } label: {
            Label(range.label, systemImage: "calendar")
        }
        .accessibilityLabel("Select range")
    }
}

// Example chart section stub
struct ProgressChartPoint: Identifiable {
    let id = UUID()
    let date: Date
    let value: Double
}

struct ProgressChartSection: View {
    let chartData: [ProgressChartPoint]
    let range: ProgressRange
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Calories logged")
                .font(.headline)
            Chart(chartData) {
                LineMark(
                    x: .value("Day", $0.date),
                    y: .value("Calories", $0.value)
                )
                .foregroundStyle(MacroMeshTheme.primary)
                .interpolationMethod(.catmullRom)
                .symbol(.circle)
                .accessibilityLabel("Trend line for calories logged")
            }
            .animation(.easeInOut, value: chartData)
            .frame(height: 180)
            .accessibilityElement(children: .contain)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(MacroMeshTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: MacroMeshTheme.radiusMedium, style: .continuous))
        .shadow(color: MacroMeshTheme.shadow, radius: 8, x: 0, y: 3)
    }
}

// Empty state for Progress
struct ProgressEmptyStateView: View {
    var onLog: () -> Void
    var body: some View {
        EmptyStateCard(
            icon: "chart.bar.xaxis",
            title: "No data yet",
            message: "Your trends will appear here after logging meals and progress.",
            buttonTitle: "Log your first meal",
            action: onLog
        )
        .accessibilityLabel("No progress data. Log your first meal to see trends.")
    }
}

#Preview {
    ProgressScreenView()
}
