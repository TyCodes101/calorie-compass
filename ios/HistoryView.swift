import SwiftUI

struct HistoryView: View {
    var body: some View {
        ContentUnavailableView(
            "History API needed",
            systemImage: "clock",
            description: Text("The web app renders history server-side today. Native iOS needs a dedicated /api/history endpoint before this screen can show saved meals.")
        )
        .navigationTitle("History")
    }
}

#Preview {
    NavigationStack {
        HistoryView()
    }
}
