import SwiftUI

struct ProfileV4CMetricGrid: View {
    let profile: ProfileData?
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ProfileV4CMetricCell(label: "Weight", value: profile?.weightLbs.map { String(Int($0)) } ?? "—", unit: "lbs")
                Divider()
                ProfileV4CMetricCell(label: "Height", value: profile?.heightCm.map { "\($0)" } ?? "—", unit: "cm")
            }
            Divider()
            HStack(spacing: 0) {
                ProfileV4CMetricCell(label: "Age", value: profile?.age.map { "\($0)" } ?? "—", unit: "yrs")
                Divider()
                ProfileV4CMetricCell(label: "Goal", value: profile?.goal ?? "—", unit: "")
            }
            Divider()
            HStack(spacing: 0) {
                ProfileV4CMetricCell(label: "Activity", value: profile?.activityLevel ?? "—", unit: "")
            }
        }
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        .shadow(color: Color.primary.opacity(0.05), radius: 3, x: 0, y: 1)
    }
}

struct ProfileV4CMetricCell: View {
    let label: String
    let value: String
    let unit: String

    var body: some View {
        VStack(spacing: 6) {
            Text(label).font(.caption).foregroundColor(.secondary)
            HStack(spacing: 2) {
                Text(value).font(.title3).fontWeight(.bold)
                if !unit.isEmpty {
                    Text(unit).font(.footnote).foregroundColor(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(10)
    }
}
