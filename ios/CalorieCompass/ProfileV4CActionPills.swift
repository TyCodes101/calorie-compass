import SwiftUI

struct ProfileV4CActionPills: View {
    let onEdit: () -> Void
    var body: some View {
        HStack(spacing: 14) {
            Button(action: onEdit) {
                Label("Edit Profile", systemImage: "pencil").padding(.horizontal, 16).padding(.vertical, 7)
            }
            .background(Capsule().fill(Color.accentColor.opacity(0.14)))
            .font(.subheadline)
            .foregroundColor(.accentColor)
        }
        .padding(.vertical, 9)
    }
}
