// DesignSystem.swift
// MacroMesh iOS Design System entry: tokens, tiles, badges, bars
import SwiftUI

// Elevation, Spacing, Radius tokens
public enum DesignTokens {
    public static let radiusLarge: CGFloat = 28
    public static let radiusMedium: CGFloat = 20
    public static let radiusSmall: CGFloat = 12
    public static let spacing: CGFloat = 16
    public static let elevation: CGFloat = 8
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
