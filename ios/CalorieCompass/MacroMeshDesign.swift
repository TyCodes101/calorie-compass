// MacroMeshDesign.swift
// Shared native UI tokens and components for the MacroMesh iOS shell.
import SwiftUI

enum MacroMeshTheme {
    static let background = Color(red: 0.97, green: 0.98, blue: 0.95)
    static let backgroundTop = Color(red: 0.95, green: 0.98, blue: 0.93)
    static let backgroundBottom = Color(red: 0.99, green: 0.99, blue: 0.98)
    static let card = Color.white
    static let elevatedCard = Color(red: 0.995, green: 0.995, blue: 0.985)
    static let cardSubtle = Color(red: 0.93, green: 0.97, blue: 0.91)
    static let cardWarm = Color(red: 0.99, green: 0.96, blue: 0.91)
    static let cardCool = Color(red: 0.92, green: 0.96, blue: 0.99)
    static let primary = Color(red: 0.18, green: 0.55, blue: 0.34)
    static let primaryDark = Color(red: 0.09, green: 0.32, blue: 0.20)
    static let primarySoft = Color(red: 0.79, green: 0.91, blue: 0.80)
    static let orange = Color(red: 0.96, green: 0.55, blue: 0.23)
    static let blue = Color(red: 0.20, green: 0.48, blue: 0.90)
    static let purple = Color(red: 0.45, green: 0.34, blue: 0.86)
    static let yellow = Color(red: 0.95, green: 0.72, blue: 0.20)
    static let protein = primary
    static let carbs = orange
    static let fat = purple
    static let text = Color(red: 0.09, green: 0.12, blue: 0.10)
    static let muted = Color(red: 0.42, green: 0.48, blue: 0.43)
    static let subtleText = Color(red: 0.56, green: 0.61, blue: 0.56)
    static let border = Color.black.opacity(0.06)
    static let shadow = Color.black.opacity(0.08)
    static let strongShadow = Color.black.opacity(0.12)
}

enum MacroMeshSpacing {
    static let xs: CGFloat = 6
    static let sm: CGFloat = 10
    static let md: CGFloat = 14
    static let lg: CGFloat = 18
    static let xl: CGFloat = 24
    static let screenHorizontal: CGFloat = 18
    static let bottomPadding: CGFloat = 96
}

enum MacroMeshRadius {
    static let sm: CGFloat = 12
    static let md: CGFloat = 16
    static let lg: CGFloat = 22
    static let xl: CGFloat = 28
}

enum MacroMeshMotion {
    static let spring = Animation.spring(response: 0.38, dampingFraction: 0.84)
}

struct MacroMeshScreen<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [MacroMeshTheme.backgroundTop, MacroMeshTheme.backgroundBottom],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            content
        }
        .preferredColorScheme(.light)
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
            .clipShape(RoundedRectangle(cornerRadius: MacroMeshRadius.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: MacroMeshRadius.lg, style: .continuous)
                    .stroke(MacroMeshTheme.border, lineWidth: 1)
            )
            .shadow(color: MacroMeshTheme.shadow, radius: 18, x: 0, y: 10)
    }
}

struct PrimaryCTAButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundColor(.white)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .background(MacroMeshTheme.primary.opacity(configuration.isPressed ? 0.82 : 1))
            .clipShape(RoundedRectangle(cornerRadius: MacroMeshRadius.md, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(MacroMeshMotion.spring, value: configuration.isPressed)
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
            .clipShape(RoundedRectangle(cornerRadius: MacroMeshRadius.md, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(MacroMeshMotion.spring, value: configuration.isPressed)
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

struct IconBadge: View {
    let systemName: String
    var tint: Color = MacroMeshTheme.primary
    var size: CGFloat = 38

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundColor(tint)
            .frame(width: size, height: size)
            .background(tint.opacity(0.13))
            .clipShape(Circle())
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

struct MacroMetricTile: View {
    let title: String
    let value: Double
    let goal: Double
    let unit: String
    let tint: Color
    let systemImage: String

    private var progress: Double { goal > 0 ? min(max(value / goal, 0), 1) : 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                IconBadge(systemName: systemImage, tint: tint, size: 32)
                Spacer()
                Text("\(Int(progress * 100))%")
                    .font(.caption.weight(.bold))
                    .foregroundColor(tint)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.muted)
                Text("\(Int(value))/\(Int(goal)) \(unit)")
                    .font(.headline.weight(.bold))
                    .foregroundColor(MacroMeshTheme.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
            }
            ProgressView(value: progress)
                .tint(tint)
                .scaleEffect(x: 1, y: 1.7, anchor: .center)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tint.opacity(0.09))
        .clipShape(RoundedRectangle(cornerRadius: MacroMeshRadius.md, style: .continuous))
    }
}

struct CalorieProgressRing: View {
    let value: Double
    let goal: Double
    var lineWidth: CGFloat = 16

    private var progress: Double { goal > 0 ? min(max(value / goal, 0), 1) : 0 }

    var body: some View {
        ZStack {
            Circle()
                .stroke(MacroMeshTheme.cardSubtle, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    AngularGradient(
                        colors: [MacroMeshTheme.primary, MacroMeshTheme.blue, MacroMeshTheme.orange],
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(MacroMeshMotion.spring, value: progress)
            VStack(spacing: 2) {
                Text("\(Int(value))")
                    .font(.system(size: 32, weight: .bold, design: .rounded))
                    .foregroundColor(MacroMeshTheme.text)
                    .minimumScaleFactor(0.72)
                Text("of \(Int(goal))")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.muted)
            }
            .padding(.horizontal, 10)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(Int(value)) of \(Int(goal)) calories")
    }
}

struct InsightPill: View {
    let title: String
    let value: String
    let tint: Color
    let systemImage: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: systemImage)
                .font(.caption.weight(.bold))
                .foregroundColor(tint)
            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(.caption2.weight(.semibold))
                    .foregroundColor(MacroMeshTheme.subtleText)
                Text(value)
                    .font(.caption.weight(.bold))
                    .foregroundColor(MacroMeshTheme.text)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(tint.opacity(0.10))
        .clipShape(Capsule())
    }
}

struct MacroMeshTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(13)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: MacroMeshRadius.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: MacroMeshRadius.md, style: .continuous)
                    .stroke(MacroMeshTheme.border, lineWidth: 1)
            )
    }
}
