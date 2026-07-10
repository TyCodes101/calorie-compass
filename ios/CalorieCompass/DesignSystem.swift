// DesignSystem.swift
// MacroMesh iOS Design System entry: tokens, tiles, badges, bars
import SwiftUI

// Elevation, Spacing, Radius tokens
public enum DesignTokens {
    public static let radiusLarge: CGFloat = 24
    public static let radiusMedium: CGFloat = 16
    public static let radiusSmall: CGFloat = 10
    public static let spacing: CGFloat = 16
    public static let elevation: CGFloat = 8

    // Tab bar clearance: prevents scroll content + bottom CTAs from being obscured by the iOS tab bar.
    // Includes a little extra breathing room so the last card never feels cramped.
    public static let tabBarClearance: CGFloat = 120
}

public extension View {
    /// Ensures scroll content never lands under the iOS Tab Bar.
    func macroMeshTabBarSpacer() -> some View {
        safeAreaInset(edge: .bottom) {
            Color.clear
                .frame(height: DesignTokens.tabBarClearance)
                .accessibilityHidden(true)
        }
    }
}

// Progress Bar
public struct ProgressBar: View {
    let progress: Double    // 0...1
    let color: Color
    let background: Color
    public init(progress: Double, color: Color, background: Color = Color(.systemGray6)) {
        self.progress = progress
        self.color = color
        self.background = background
    }
    public var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: DesignTokens.radiusSmall)
                    .fill(background)
                RoundedRectangle(cornerRadius: DesignTokens.radiusSmall)
                    .fill(color)
                    .frame(width: max(4, proxy.size.width * progress), alignment: .leading)
                    .animation(.easeInOut(duration: 0.35), value: progress)
            }
        }
        .frame(height: 10)
        .accessibilityLabel("Progress: \(Int(progress * 100)) percent")
    }
}

// MetricTile for macro metrics
public struct MetricTile: View {
    let title: String
    let value: String
    let icon: String
    let tint: Color
    public init(title: String, value: String, icon: String, tint: Color) {
        self.title = title
        self.value = value
        self.icon = icon
        self.tint = tint
    }
    public var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon).font(.largeTitle).foregroundColor(tint)
            Text(value).font(.title2.bold()).foregroundColor(.primary)
            Text(title).font(.caption.bold()).foregroundColor(.secondary)
        }
        .padding()
        .frame(width: 100, height: 100)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusMedium, style: .continuous))
        .shadow(color: MacroMeshTheme.shadow, radius: 6, x: 0, y: 2)
        .accessibilityElement(children: .combine)
    }
}

// Badge
public struct Badge: View {
    let text: String
    let color: Color
    public init(_ text: String, color: Color = Color.accentColor) {
        self.text = text
        self.color = color
    }
    public var body: some View {
        Text(text)
            .font(.caption2.bold())
            .padding(.horizontal, 8).padding(.vertical, 2)
            .background(color.opacity(0.1))
            .foregroundColor(color)
            .clipShape(Capsule())
    }
}

// Weight History Timeline
public struct WeightHistoryTimelineView: View {
    public struct Row: Identifiable, Equatable {
        public let id: String
        public let date: Date
        public let weightLbs: Double
        public let deltaLbs: Double?
    }

    let title: String
    let subtitle: String
    let rows: [Row]

    public init(title: String = "Weight history", subtitle: String = "Recent weigh-ins", rows: [Row]) {
        self.title = title
        self.subtitle = subtitle
        self.rows = rows
    }

    public var body: some View {
        AppCard(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                SectionHeader(title, subtitle: subtitle)

                if rows.isEmpty {
                    EmptyStateCard(
                        icon: "scalemass",
                        title: "Your weigh-ins will appear here",
                        message: "Log 2–3 weigh-ins to unlock a clearer trend.",
                        buttonTitle: nil,
                        action: nil
                    )
                } else {
                    VStack(spacing: 10) {
                        ForEach(rows.prefix(10)) { row in
                            WeightHistoryRow(row: row)
                        }
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
    }
}

private struct WeightHistoryRow: View {
    let row: WeightHistoryTimelineView.Row

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(Self.dateFormatter.string(from: row.date))
                    .font(.caption.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.muted)
                Text(String(format: "%.1f lbs", row.weightLbs))
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.text)
            }
            Spacer(minLength: 0)
            if let delta = row.deltaLbs {
                let isUp = delta > 0.0001
                let isDown = delta < -0.0001
                let isUnusual = abs(delta) >= 10
                let tint: Color = isUnusual ? .red : (isUp ? MacroMeshTheme.orange : (isDown ? MacroMeshTheme.blue : MacroMeshTheme.muted))
                let icon = isUnusual ? "exclamationmark.triangle.fill" : (isUp ? "arrow.up" : (isDown ? "arrow.down" : "minus"))
                HStack(spacing: 6) {
                    Image(systemName: icon)
                        .font(.caption.weight(.bold))
                    Text(String(format: "%+.1f", delta))
                        .font(.caption.weight(.bold))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(tint.opacity(0.12))
                .foregroundColor(tint)
                .clipShape(Capsule())
                .accessibilityLabel("Change \(String(format: "%+.1f", delta)) pounds")
            }
        }
        .padding(12)
        .background(MacroMeshTheme.cardSubtle.opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusMedium, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()
}
