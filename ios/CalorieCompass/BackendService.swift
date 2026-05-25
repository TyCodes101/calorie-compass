// BackendService.swift
// CalorieCompass
//
// Handles API calls for meal assistant, meals, dashboard, profile, and native meal management.
//
import Foundation

struct MealAssistantRequest: Codable {
    let user_message: String
    let current_state: String?
    let conversation_history: [String]?
    let macro_context: [String: Double]?
}

struct MealAssistantResponse: Codable {
    let assistant_message: String
    let next_state: String?
}

struct MealRequestItem: Codable, Equatable, Identifiable {
    var id: String { food_name + unit + String(quantity) }
    var food_name: String
    var quantity: Double
    var unit: String
    var calories: Double
    var protein: Double
    var carbs: Double
    var fat: Double
    var fiber: Double
    var sugar: Double
    var sodium: Double
    var notes: String?
    var source_type: String?
    var source_name: String?
    var confidence_label: String?
}

struct PostMealRequest: Codable, Equatable {
    var meal_type: String
    var confidence_score: Double
    var raw_text: String?
    var notes: String?
    var date: String?
    var items: [MealRequestItem]
}

struct PostMealResponse: Codable {
    let meal: MealResponse?
    let dashboard: DashboardResponse?
    let localOnly: Bool?
    let error: String?
}

struct MealResponse: Codable, Equatable, Identifiable {
    let id: String?
    let mealType: String?
    let rawText: String?
    let date: String?
    let createdAt: String?
    let confidenceScore: Double?
    let totalCalories: Double?
    let totalProtein: Double?
    let totalCarbs: Double?
    let totalFat: Double?
    let itemCount: Int?
    let trustedCount: Int?
    let estimatedCount: Int?
    let coverageSummary: String?
    let items: [MealRequestItem]?
}

struct MealsListResponse: Codable {
    let meals: [MealResponse]
    let error: String?
}

struct MealMutationResponse: Codable {
    let meal: MealResponse?
    let deleted: DeletedMealResponse?
    let dashboard: DashboardResponse?
    let error: String?
}

struct DeletedMealResponse: Codable, Equatable {
    let id: String
    let rawText: String?
    let date: String?
}

struct DashboardResponse: Codable {
    let calories: Double?
    let goalCalories: Double?
    let protein: Double?
    let carbs: Double?
    let fat: Double?
    let recentMeals: [MealResponse]?

    let totals: DashboardTotals?
    let macroGoals: MacroGoals?
    let mealCount: Int?
    let remainingCalories: Double?
    let dailySummary: DailySummary?

    var displayedCalories: Double { totals?.calories ?? calories ?? 0 }
    var displayedGoalCalories: Double { macroGoals?.calories ?? goalCalories ?? 1 }
    var displayedProtein: Double { totals?.protein ?? protein ?? 0 }
    var displayedProteinGoal: Double { macroGoals?.protein ?? max(protein ?? 0, 1) }
    var displayedCarbs: Double { totals?.carbs ?? carbs ?? 0 }
    var displayedCarbsGoal: Double { macroGoals?.carbs ?? max(carbs ?? 0, 1) }
    var displayedFat: Double { totals?.fat ?? fat ?? 0 }
    var displayedFatGoal: Double { macroGoals?.fat ?? max(fat ?? 0, 1) }
}

struct DashboardTotals: Codable {
    let calories: Double?
    let protein: Double?
    let carbs: Double?
    let fat: Double?
}

struct MacroGoals: Codable {
    let calories: Double?
    let protein: Double?
    let carbs: Double?
    let fat: Double?
}

struct DailySummary: Codable {
    let title: String?
    let description: String?
}

enum BackendError: LocalizedError, Equatable {
    case badURL
    case noData
    case server(String)
    case unsupported(String)

    var errorDescription: String? {
        switch self {
        case .badURL: return "The Calorie Compass server URL is invalid."
        case .noData: return "The server returned no data."
        case .server(let message): return message
        case .unsupported(let message): return message
        }
    }
}

class BackendService {
    static let baseURL = URL(string: "https://calorie-compass-chi.vercel.app")!

    private static func perform<T: Decodable>(_ urlRequest: URLRequest, completion: @escaping (Result<T, Error>) -> Void) {
        let task = URLSession.shared.dataTask(with: urlRequest) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(BackendError.noData))
                return
            }
            guard let data = data, !data.isEmpty else {
                completion(.failure(BackendError.noData))
                return
            }
            do {
                if !(200...299).contains(httpResponse.statusCode) {
                    if let apiError = try? JSONDecoder().decode(APIErrorResponse.self, from: data), let message = apiError.error {
                        completion(.failure(BackendError.server(message)))
                    } else {
                        completion(.failure(BackendError.server("Request failed with status \(httpResponse.statusCode).")))
                    }
                    return
                }
                let decoded = try JSONDecoder().decode(T.self, from: data)
                completion(.success(decoded))
            } catch {
                completion(.failure(error))
            }
        }
        task.resume()
    }

    private static func request(path: String, method: String = "GET", queryItems: [URLQueryItem] = []) -> URLRequest? {
        guard var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false) else { return nil }
        if !queryItems.isEmpty { components.queryItems = queryItems }
        guard let url = components.url else { return nil }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return request
    }

    static func sendMealAssistant(request body: MealAssistantRequest, completion: @escaping (Result<MealAssistantResponse, Error>) -> Void) {
        guard var urlRequest = request(path: "api/meal-assistant", method: "POST") else { completion(.failure(BackendError.badURL)); return }
        do { urlRequest.httpBody = try JSONEncoder().encode(body) } catch { completion(.failure(error)); return }
        perform(urlRequest, completion: completion)
    }

    static func saveConfirmedMeal(request body: PostMealRequest, completion: @escaping (Result<PostMealResponse, Error>) -> Void) {
        guard var urlRequest = request(path: "api/meals", method: "POST") else { completion(.failure(BackendError.badURL)); return }
        do { urlRequest.httpBody = try JSONEncoder().encode(body) } catch { completion(.failure(error)); return }
        perform(urlRequest, completion: completion)
    }

    static func fetchMeals(completion: @escaping (Result<[MealResponse], Error>) -> Void) {
        guard let urlRequest = request(path: "api/meals", method: "GET") else { completion(.failure(BackendError.badURL)); return }
        perform(urlRequest) { (result: Result<MealsListResponse, Error>) in
            switch result {
            case .success(let response): completion(.success(response.meals))
            case .failure(let error): completion(.failure(error))
            }
        }
    }

    static func updateMeal(id: String, request body: PostMealRequest, completion: @escaping (Result<MealMutationResponse, Error>) -> Void) {
        guard !id.hasPrefix("local-") else { completion(.failure(BackendError.unsupported("Local-only meals cannot be edited until the backend saves them."))); return }
        guard var urlRequest = request(path: "api/meals/\(id)", method: "PATCH") else { completion(.failure(BackendError.badURL)); return }
        do { urlRequest.httpBody = try JSONEncoder().encode(body) } catch { completion(.failure(error)); return }
        perform(urlRequest, completion: completion)
    }

    static func deleteMeal(id: String, completion: @escaping (Result<MealMutationResponse, Error>) -> Void) {
        guard !id.hasPrefix("local-") else { completion(.failure(BackendError.unsupported("Local-only meals cannot be deleted until the backend saves them."))); return }
        guard let urlRequest = request(path: "api/meals/\(id)", method: "DELETE") else { completion(.failure(BackendError.badURL)); return }
        perform(urlRequest, completion: completion)
    }

    static func fetchDashboard(completion: @escaping (Result<DashboardResponse, Error>) -> Void) {
        guard let urlRequest = request(path: "api/dashboard", method: "GET") else { completion(.failure(BackendError.badURL)); return }
        perform(urlRequest, completion: completion)
    }

    static func fetchProfile(completion: @escaping (Result<ProfileData, Error>) -> Void) {
        guard let urlRequest = request(path: "api/profile", method: "GET") else { completion(.failure(BackendError.badURL)); return }
        perform(urlRequest, completion: completion)
    }

    static func saveProfile(_ profile: ProfileData, completion: @escaping (Result<ProfileData, Error>) -> Void) {
        guard var urlRequest = request(path: "api/profile", method: "PATCH") else { completion(.failure(BackendError.badURL)); return }
        do { urlRequest.httpBody = try JSONEncoder().encode(profile) } catch { completion(.failure(error)); return }
        perform(urlRequest, completion: completion)
    }
}

private struct APIErrorResponse: Codable {
    let error: String?
}
