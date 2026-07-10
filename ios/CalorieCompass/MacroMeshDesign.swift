// MacroMeshDesign.swift
// Shared native UI tokens and components for the MacroMesh iOS shell.
import SwiftUI
import UIKit

enum MacroMeshTheme {
    // The app icon is the visual source of truth: near-black ink, green mesh, and a clean teal edge.
    // Dynamic UIColor keeps every screen legible without forcing a global light color scheme.
    static let background = adaptive(
        light: UIColor(red: 0.95, green: 0.97, blue: 0.96, alpha: 1),
        dark: UIColor(red: 0.025, green: 0.055, blue: 0.065, alpha: 1)
    )
    static let card = adaptive(
        light: UIColor.white,
        dark: UIColor(red: 0.055, green: 0.095, blue: 0.105, alpha: 1)
    )
    static let cardSubtle = adaptive(
        light: UIColor(red: 0.90, green: 0.96, blue: 0.92, alpha: 1),
        dark: UIColor(red: 0.08, green: 0.16, blue: 0.16, alpha: 1)
    )
    static let brandSurface = Color(red: 0.025, green: 0.065, blue: 0.075)
    static let primary = adaptive(
        light: UIColor(red: 0.08, green: 0.57, blue: 0.34, alpha: 1),
        dark: UIColor(red: 0.32, green: 0.94, blue: 0.48, alpha: 1)
    )
    static let primaryDark = adaptive(
        light: UIColor(red: 0.04, green: 0.30, blue: 0.18, alpha: 1),
        dark: UIColor(red: 0.55, green: 1.0, blue: 0.68, alpha: 1)
    )
    static let teal = Color(red: 0.02, green: 0.86, blue: 0.72)
    static let cyan = Color(red: 0.13, green: 0.72, blue: 0.82)
    static let orange = adaptive(
        light: UIColor(red: 0.88, green: 0.43, blue: 0.08, alpha: 1),
        dark: UIColor(red: 1.0, green: 0.72, blue: 0.28, alpha: 1)
    )
    static let blue = adaptive(
        light: UIColor(red: 0.12, green: 0.39, blue: 0.76, alpha: 1),
        dark: UIColor(red: 0.40, green: 0.72, blue: 1.0, alpha: 1)
    )
    static let purple = adaptive(
        light: UIColor(red: 0.39, green: 0.28, blue: 0.74, alpha: 1),
        dark: UIColor(red: 0.70, green: 0.60, blue: 1.0, alpha: 1)
    )
    static let text = adaptive(
        light: UIColor(red: 0.055, green: 0.10, blue: 0.08, alpha: 1),
        dark: UIColor(red: 0.94, green: 0.98, blue: 0.96, alpha: 1)
    )
    static let muted = adaptive(
        light: UIColor(red: 0.35, green: 0.44, blue: 0.39, alpha: 1),
        dark: UIColor(red: 0.62, green: 0.72, blue: 0.68, alpha: 1)
    )
    static let border = adaptive(
        light: UIColor.black.withAlphaComponent(0.08),
        dark: UIColor.white.withAlphaComponent(0.13)
    )
    static let shadow = adaptive(
        light: UIColor.black.withAlphaComponent(0.08),
        dark: UIColor.black.withAlphaComponent(0.35)
    )
    static let radiusLarge: CGFloat = 24
    static let radiusMedium: CGFloat = 16
    static let radiusSmall: CGFloat = 10
    static let spacing: CGFloat = 16

    static let meshGradient = LinearGradient(
        colors: [Color(red: 0.47, green: 0.95, blue: 0.28), teal, cyan],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let brandGradient = LinearGradient(
        colors: [primary, teal],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    private static func adaptive(light: UIColor, dark: UIColor) -> Color {
        Color(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? dark : light
        })
    }
}

struct MacroMeshBrandMark: View {
    var size: CGFloat = 48

    var body: some View {
        ZStack {
            Image("MacroMeshMark")
                .resizable()
                .scaledToFill()
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: size * 0.24, style: .continuous))
        }
        .frame(width: size, height: size)
        .overlay(
            RoundedRectangle(cornerRadius: size * 0.24, style: .continuous)
                .stroke(Color.white.opacity(0.13), lineWidth: 1)
        )
        .accessibilityLabel("MacroMesh")
    }
}

struct MacroMeshGradientHeader: View {
    let eyebrow: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text(eyebrow.uppercased())
                    .font(.caption.weight(.bold))
                    .tracking(1.1)
                    .foregroundColor(MacroMeshTheme.primary)
                Text(title)
                    .font(.title2.weight(.bold))
                    .foregroundColor(.white)
                    .fixedSize(horizontal: false, vertical: true)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundColor(Color.white.opacity(0.72))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
            MacroMeshBrandMark(size: 58)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: MacroMeshTheme.radiusLarge, style: .continuous)
                .fill(MacroMeshTheme.brandSurface)
                .clipShape(RoundedRectangle(cornerRadius: MacroMeshTheme.radiusLarge, style: .continuous))
        )
        .overlay(
            RoundedRectangle(cornerRadius: MacroMeshTheme.radiusLarge, style: .continuous)
                .stroke(Color.white.opacity(0.10), lineWidth: 1)
        )
        .accessibilityElement(children: .combine)
    }
}

struct MacroMeshBadge: View {
    enum Tone {
        case success
        case warning
        case neutral
        case accent
    }

    let text: String
    var tone: Tone = .success

    private var tint: Color {
        switch tone {
        case .success: return MacroMeshTheme.primary
        case .warning: return MacroMeshTheme.orange
        case .neutral: return MacroMeshTheme.muted
        case .accent: return MacroMeshTheme.cyan
        }
    }

    var body: some View {
        Text(text)
            .font(.caption2.weight(.bold))
            .foregroundColor(tint)
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(tint.opacity(0.13))
            .clipShape(Capsule())
            .fixedSize(horizontal: true, vertical: false)
    }
}

struct MacroMeshStatCard: View {
    let title: String
    let value: String
    let icon: String
    let tint: Color

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: icon)
                .font(.caption.weight(.bold))
                .foregroundColor(tint)
                .frame(width: 28, height: 28)
                .background(tint.opacity(0.13))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(value)
                    .font(.headline.weight(.bold))
                    .foregroundColor(MacroMeshTheme.text)
                Text(title)
                    .font(.caption2.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.muted)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MacroMeshTheme.cardSubtle.opacity(0.72))
        .clipShape(RoundedRectangle(cornerRadius: MacroMeshTheme.radiusMedium, style: .continuous))
    }
}

struct MacroMeshProgressRing: View {
    let value: Double
    let goal: Double
    let size: CGFloat

    var body: some View {
        CalorieRing(value: value, goal: goal, size: size)
    }
}

struct MacroMeshEmptyState: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.title2.weight(.semibold))
                .foregroundColor(MacroMeshTheme.primary)
                .frame(width: 42, height: 42)
                .background(MacroMeshTheme.cardSubtle)
                .clipShape(Circle())
            Text(title)
                .font(.headline.weight(.bold))
                .foregroundColor(MacroMeshTheme.text)
                .multilineTextAlignment(.center)
            Text(message)
                .font(.subheadline)
                .foregroundColor(MacroMeshTheme.muted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(18)
    }
}

struct MacroMeshLoadingState: View {
    let title: String
    let message: String

    var body: some View {
        HStack(spacing: 10) {
            ProgressView().tint(MacroMeshTheme.primary)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.text)
                Text(message)
                    .font(.caption)
                    .foregroundColor(MacroMeshTheme.muted)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(MacroMeshTheme.card)
        .clipShape(RoundedRectangle(cornerRadius: MacroMeshTheme.radiusMedium, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: MacroMeshTheme.radiusMedium, style: .continuous)
                .stroke(MacroMeshTheme.border, lineWidth: 1)
        )
    }
}

struct CalorieRing: View {
    let value: Double
    let goal: Double
    let size: CGFloat

    private var progress: Double { goal > 0 ? min(max(value / goal, 0), 1) : 0 }

    var body: some View {
        ZStack {
            Circle()
                .stroke(MacroMeshTheme.cardSubtle.opacity(0.72), lineWidth: 14)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    AngularGradient(colors: [MacroMeshTheme.primary, MacroMeshTheme.teal, MacroMeshTheme.cyan, MacroMeshTheme.primary], center: .center),
                    style: StrokeStyle(lineWidth: 14, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.spring(response: 0.55, dampingFraction: 0.82), value: progress)
            VStack(spacing: 2) {
                Text("\(Int(value))")
                    .font(.system(size: size * 0.24, weight: .bold, design: .rounded))
                    .foregroundColor(MacroMeshTheme.text)
                Text("of \(Int(goal))")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.muted)
            }
        }
        .frame(width: size, height: size)
        .accessibilityLabel("\(Int(value)) of \(Int(goal)) calories")
    }
}

struct MetricPill: View {
    let title: String
    let value: String
    let icon: String
    let tint: Color

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.caption.weight(.bold))
                .foregroundColor(tint)
                .frame(width: 24, height: 24)
                .background(tint.opacity(0.12))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 1) {
                Text(value)
                    .font(.subheadline.weight(.bold))
                    .foregroundColor(MacroMeshTheme.text)
                Text(title)
                    .font(.caption2.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.muted)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(MacroMeshTheme.cardSubtle.opacity(0.72))
        .clipShape(RoundedRectangle(cornerRadius: MacroMeshTheme.radiusMedium, style: .continuous))
    }
}

struct MacroMeshScreen<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ZStack {
            MacroMeshTheme.background.ignoresSafeArea()
            content
        }
    }
}

struct AppCard<Content: View>: View {
    let padding: CGFloat
    let content: Content

    init(padding: CGFloat = 16, @ViewBuilder content: () -> Content) {
        self.padding = padding
        self.content = content()
    }

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(MacroMeshTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: MacroMeshTheme.radiusLarge, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: MacroMeshTheme.radiusLarge, style: .continuous)
                    .stroke(MacroMeshTheme.border, lineWidth: 1)
            )
            .shadow(color: MacroMeshTheme.shadow, radius: 14, x: 0, y: 8)
    }
}

struct PrimaryCTAButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.white)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .background(MacroMeshTheme.brandGradient.opacity(configuration.isPressed ? 0.82 : 1))
            .clipShape(RoundedRectangle(cornerRadius: MacroMeshTheme.radiusMedium, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}

struct SecondaryCTAButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundColor(MacroMeshTheme.primaryDark)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity)
            .background(MacroMeshTheme.cardSubtle.opacity(configuration.isPressed ? 0.65 : 1))
            .clipShape(RoundedRectangle(cornerRadius: MacroMeshTheme.radiusMedium, style: .continuous))
    }
}

struct SectionHeader: View {
    let title: String
    let subtitle: String?

    init(_ title: String, subtitle: String? = nil) {
        self.title = title
        self.subtitle = subtitle
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.headline)
                .foregroundColor(MacroMeshTheme.text)
            if let subtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundColor(MacroMeshTheme.muted)
            }
        }
    }
}

struct EmptyStateCard: View {
    let icon: String
    let title: String
    let message: String
    let buttonTitle: String?
    let action: (() -> Void)?

    var body: some View {
        AppCard {
            VStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 36, weight: .semibold))
                    .foregroundColor(MacroMeshTheme.primary)
                Text(title)
                    .font(.title3.weight(.bold))
                    .foregroundColor(MacroMeshTheme.text)
                    .multilineTextAlignment(.center)
                Text(message)
                    .font(.subheadline)
                    .foregroundColor(MacroMeshTheme.muted)
                    .multilineTextAlignment(.center)
                if let buttonTitle, let action {
                    Button(buttonTitle, action: action)
                        .buttonStyle(PrimaryCTAButtonStyle())
                        .padding(.top, 4)
                }
            }
            .frame(maxWidth: .infinity)
        }
    }
}

struct MacroProgressRow: View {
    let title: String
    let value: Double
    let goal: Double
    let unit: String
    let tint: Color

    private var progress: Double { goal > 0 ? min(max(value / goal, 0), 1) : 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.text)
                Spacer()
                Text("\(Int(value))/\(Int(goal)) \(unit)")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.muted)
            }
            ProgressView(value: progress)
                .tint(tint)
                .scaleEffect(x: 1, y: 1.8, anchor: .center)
        }
    }
}

struct MacroMeshTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(12)
            .background(MacroMeshTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: MacroMeshTheme.radiusMedium, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: MacroMeshTheme.radiusMedium, style: .continuous)
                    .stroke(MacroMeshTheme.border, lineWidth: 1)
            )
    }
}
