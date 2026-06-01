import SwiftUI

struct HistoryEmptyStateCard: View {
    let icon: String
    let title: String
    let message: String
    let buttonTitle: String?
    let action: (() -> Void)?

    var body: some View {
        VStack(spacing: 15) {
            Image(systemName: icon)
                .font(.system(size: 44, weight: .bold))
                .foregroundColor(.accentColor)
            Text(title)
                .font(.title3)
                .fontWeight(.bold)
            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.bottom, 2)
            if let buttonTitle = buttonTitle, let action = action {
                Button(buttonTitle, action: action)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
            }
        }
        .padding(30)
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .padding(.horizontal, 16)
    }
}
