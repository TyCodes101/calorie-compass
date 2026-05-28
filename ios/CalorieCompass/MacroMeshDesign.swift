// MacroMeshDesign.swift
// Shared native UI tokens and components for the MacroMesh iOS shell.
import SwiftUI

enum MacroMeshTheme {
    static let background = Color(red: 0.97, green: 0.98, blue: 0.95)
    static let card = Color.white
    static let cardSubtle = Color(red: 0.93, green: 0.97, blue: 0.91)
    static let primary = Color(red: 0.18, green: 0.55, blue: 0.34)
    static let primaryDark = Color(red: 0.09, green: 0.32, blue: 0.20)
    static let orange = Color(red: 0.96, green: 0.55, blue: 0.23)
    static let blue = Color(red: 0.20, green: 0.48, blue: 0.90)
    static let purple = Color(red: 0.45, green: 0.34, blue: 0.86)
    static let text = Color(red: 0.09, green: 0.12, blue: 0.10)
    static let muted = Color(red: 0.42, green: 0.48, blue: 0.43)
    static let border = Color.black.opacity(0.06)
    static let shadow = Color.black.opacity(0.08)
}

struct MacroMeshScreen<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [MacroMeshTheme.background, Color.white],
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
            .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
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
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
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
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
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
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(MacroMeshTheme.border, lineWidth: 1)
            )
    }
}
