import SwiftUI

struct ProfileV4CHeroCard: View {
    let profile: ProfileData?
    var displayName: String { profile?.name.nilIfBlank ?? "Guest" }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .center, spacing: 15) {
                    Circle()
                        .fill(LinearGradient(gradient: Gradient(colors: [.blue.opacity(0.22), .purple.opacity(0.10)]), startPoint: .top, endPoint: .bottom))
                        .frame(width: 72, height: 72)
                        .overlay(
                            Image(systemName: "person.circle.fill")
                                .resizable()
                                .scaledToFit()
                                .frame(width: 60, height: 60)
                                .foregroundColor(.blue)
                        )
                    VStack(alignment: .leading, spacing: 4) {
                        Text(displayName)
                            .font(.title2).fontWeight(.bold)
                        if let age = profile?.age {
                            Text("Age \(age)").foregroundColor(.secondary).font(.caption)
                        }
                    }
                }
            }
        }
        .padding()
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
        .shadow(color: Color.primary.opacity(0.06), radius: 4, x: 0, y: 2)
    }
}
