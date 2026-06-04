import Foundation
import SwiftUI

struct ProgressMilestone: Identifiable, Equatable {
    enum Status: Equatable {
        case locked(detail: String)
        case inProgress(progress: Double, detail: String)
        case completed(detail: String)
    }

    let id: String
    let title: String
    let systemImage: String
    let status: Status
}

enum ProgressMilestoneBuilder {
    static func build(
        weightEntries: WeightEntriesResponse?,
        analytics: AnalyticsResponse?,
        trustedTrendPoints: [(date: Date, weight: Double)]
    ) -> [ProgressMilestone] {
        let sanitized = WeightChartSanitizer.sanitize(entries: weightEntries?.entries ?? [])
        let deduped = WeightChartSanitizer.dedupeLatestPerDay(sanitized)

        let weighInCount = deduped.count
        let weightLoss = weightLossFromStart(trustedTrendPoints: trustedTrendPoints)

        var milestones: [ProgressMilestone] = []

        milestones.append(weighInMilestone(count: weighInCount, target: 1, title: "First weigh-in", systemImage: "scalemass"))
        milestones.append(weighInMilestone(count: weighInCount, target: 3, title: "3 weigh-ins logged", systemImage: "chart.line.uptrend.xyaxis"))
        milestones.append(weighInMilestone(count: weighInCount, target: 7, title: "7 weigh-ins logged", systemImage: "calendar"))

        if let highestProteinDay = analytics?.analytics.highestProteinDay,
           let protein = highestProteinDay.protein as Double? {
            milestones.append(
                ProgressMilestone(
                    id: "highest-protein-day",
                    title: "First high-protein day",
                    systemImage: "bolt.heart",
                    status: .completed(detail: "Hit \(Int(protein))g protein in a day")
                )
            )
        } else {
            milestones.append(
                ProgressMilestone(
                    id: "highest-protein-day",
                    title: "First high-protein day",
                    systemImage: "bolt.heart",
                    status: .locked(detail: "Log meals with protein to unlock")
                )
            )
        }

        milestones.append(weightLossMilestone(pounds: 5, loss: weightLoss))
        milestones.append(weightLossMilestone(pounds: 10, loss: weightLoss))
        milestones.append(weightLossMilestone(pounds: 15, loss: weightLoss))

        // Show the most relevant 6: completed first, then closest in-progress.
        return Array(
            milestones
                .sorted(by: relevanceSort)
                .prefix(6)
        )
    }

    private static func weighInMilestone(count: Int, target: Int, title: String, systemImage: String) -> ProgressMilestone {
        if count >= target {
            return ProgressMilestone(
                id: "weighins-\(target)",
                title: title,
                systemImage: systemImage,
                status: .completed(detail: "Logged \(count) weigh-ins")
            )
        }

        let progress = min(max(Double(count) / Double(target), 0), 1)
        return ProgressMilestone(
            id: "weighins-\(target)",
            title: title,
            systemImage: systemImage,
            status: .inProgress(progress: progress, detail: "\(count)/\(target) logged")
        )
    }

    private static func weightLossMilestone(pounds: Int, loss: Double?) -> ProgressMilestone {
        let id = "weightloss-\(pounds)"
        let title = "Lose \(pounds) lbs"
        let systemImage = "arrow.down.circle"

        guard let loss else {
            return ProgressMilestone(id: id, title: title, systemImage: systemImage, status: .locked(detail: "Log consistent weigh-ins to unlock"))
        }

        if loss >= Double(pounds) {
            return ProgressMilestone(id: id, title: title, systemImage: systemImage, status: .completed(detail: "Down \(String(format: "%.1f", loss)) lbs"))
        }

        let progress = min(max(loss / Double(pounds), 0), 1)
        return ProgressMilestone(id: id, title: title, systemImage: systemImage, status: .inProgress(progress: progress, detail: "Down \(String(format: "%.1f", loss)) lbs"))
    }

    private static func weightLossFromStart(trustedTrendPoints: [(date: Date, weight: Double)]) -> Double? {
        let sorted = trustedTrendPoints.sorted { $0.date < $1.date }
        guard let first = sorted.first?.weight, let last = sorted.last?.weight, sorted.count >= 2 else { return nil }
        let delta = last - first
        return delta < 0 ? abs(delta) : 0
    }

    private static func relevanceSort(lhs: ProgressMilestone, rhs: ProgressMilestone) -> Bool {
        let rank: (ProgressMilestone.Status) -> Int = {
            switch $0 {
            case .completed: return 0
            case .inProgress: return 1
            case .locked: return 2
            }
        }

        let lhsRank = rank(lhs.status)
        let rhsRank = rank(rhs.status)
        if lhsRank != rhsRank { return lhsRank < rhsRank }

        let lhsProgress: Double = {
            if case .inProgress(let progress, _) = lhs.status { return progress }
            return 0
        }()
        let rhsProgress: Double = {
            if case .inProgress(let progress, _) = rhs.status { return progress }
            return 0
        }()
        return lhsProgress > rhsProgress
    }
}

