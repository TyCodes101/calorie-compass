import SwiftUI

struct ProfileV4CCoachingCard: View {
    let profile: ProfileData?
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Coaching Insights")
                .font(.headline)
            if let goal = profile?.goal, let activity = profile?.activityLevel, !goal.isEmpty, !activity.isEmpty {
                switch goal {
                case "Lose":
                    Text("Focus on a slight calorie deficit and regular movement for gradual fat loss.")
                case "Maintain":
                    Text("Keep up your consistent habits to maintain your current weight.")
                case "Gain":
                    Text("Aim for a small calorie surplus and progressive training to support healthy gain.")
                default:
                    Text("Set your goal for tailored advice.")
                }
                Text(activityAdvice(activity: activity))
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            } else {
                Text("Set your goal and activity level to get personalized coaching tips.")
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
    }
    func activityAdvice(activity: String) -> String {
        switch activity {
        case "Inactive": return "Try to increase light movement throughout your day."
        case "Light": return "Nice! Add a daily walk or some stretching."
        case "Moderate": return "Great! Keep up your moderate activity for health benefits."
        case "Active": return "Well done. Active habits support your wellness goals."
        case "Very Active": return "Impressive! Ensure you’re recovering well and fueling enough."
        default: return ""
        }
    }
}
