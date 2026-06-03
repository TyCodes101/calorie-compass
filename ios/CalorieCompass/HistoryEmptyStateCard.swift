import SwiftUI

struct HistoryEmptyStateCard: View {
    let icon: String
    let title: String
    let message: String
    let buttonTitle: String?
    let action: (() -> Void)?

    var body: some View {
        AppCard(padding: 20) {
            VStack(spacing: 14) {
                Image(systemName: icon)
                    .font(.system(size: 40, weight: .bold))
                    .foregroundColor(MacroMeshTheme.primary)

                VStack(spacing: 6) {
                    Text(title)
                        .font(.headline.weight(.semibold))
                        .foregroundColor(MacroMeshTheme.text)
                    Text(message)
                        .font(.subheadline)
                        .foregroundColor(MacroMeshTheme.muted)
                        .multilineTextAlignment(.center)
                }

                if let buttonTitle, let action {
                    Button(buttonTitle, action: action)
                        .buttonStyle(PrimaryCTAButtonStyle())
                }
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.horizontal, 18)
    }
}
