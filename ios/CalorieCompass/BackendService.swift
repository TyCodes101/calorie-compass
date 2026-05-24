// BackendService.swift
// CalorieCompass
//
// Handles API calls for Phase 2 (meal-assistant, meals, dashboard)
//
import Foundation

struct MealAssistantRequest: Codable {
    let user_message: String
    let current_state: String?
    let conversation_history: [String]?
    let macro_context: [String: Double]? // Nutrition info if available
}

struct MealAssistantResponse: Codable {
    let assistant_message: String
    let next_state: String?
}

struct PostMealRequest: Codable {
    let meal_type: String
    let confidence_score: Double
    let raw_text: String?
    let notes: String?
    let date: String?
    let items: [MealRequestItem]
}

struct MealRequestItem: Codable {
    let food_name: String
    let quantity: Double
    let unit: String
    let calories: Double
    let protein: Double
    let carbs: Double
    let fat: Double
    let fiber: Double
    let sugar: Double
    let sodium: Double
    let notes: String?
    let source_type: String?
    let source_name: String?
    let confidence_label: String?
}

struct PostMealResponse: Codable {
    let meal: MealResponse?
    let dashboard: DashboardResponse?
    let localOnly: Bool?
    let error: String?
}

struct MealResponse: Codable {
    let mealType: String?
    let rawText: String?
    let confidenceScore: Double?
    let items: [MealRequestItem]?
}

struct DashboardResponse: Codable {
    let calories: Double?
    let goalCalories: Double?
    let protein: Double?
    let carbs: Double?
    let fat: Double?
    let recentMeals: [MealResponse]?
}

extension BackendService {
    static func fetchProfile(completion: @escaping (Result<ProfileData, Error>) -> Void) {
        guard let url = URL(string: "/api/profile", relativeTo: baseURL) else {
            completion(.failure(NSError(domain: "BadURL", code: 0)))
            return
        }
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "GET"
        let task = URLSession.shared.dataTask(with: urlRequest) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            guard let data = data else {
                completion(.failure(NSError(domain: "NoData", code: 0)))
                return
            }
            do {
                let decoded = try JSONDecoder().decode(ProfileData.self, from: data)
                completion(.success(decoded))
            } catch {
                completion(.failure(error))
            }
        }
        task.resume()
    }
    static func saveProfile(_ profile: ProfileData, completion: @escaping (Result<ProfileData, Error>) -> Void) {
        guard let url = URL(string: "/api/profile", relativeTo: baseURL) else {
            completion(.failure(NSError(domain: "BadURL", code: 0)))
            return
        }
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "PATCH"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        do {
            urlRequest.httpBody = try JSONEncoder().encode(profile)
        } catch {
            completion(.failure(error))
            return
        }
        let task = URLSession.shared.dataTask(with: urlRequest) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            guard let data = data else {
                completion(.failure(NSError(domain: "NoData", code: 0)))
                return
            }
            do {
                let decoded = try JSONDecoder().decode(ProfileData.self, from: data)
                completion(.success(decoded))
            } catch {
                completion(.failure(error))
            }
        }
        task.resume()
    }

    static func fetchDashboard(completion: @escaping (Result<DashboardResponse, Error>) -> Void) {
        guard let url = URL(string: "/api/dashboard", relativeTo: baseURL) else {
            completion(.failure(NSError(domain: "BadURL", code: 0)))
            return
        }
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "GET"
        let task = URLSession.shared.dataTask(with: urlRequest) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            guard let data = data else {
                completion(.failure(NSError(domain: "NoData", code: 0)))
                return
            }
            do {
                let decoded = try JSONDecoder().decode(DashboardResponse.self, from: data)
                completion(.success(decoded))
            } catch {
                completion(.failure(error))
            }
        }
        task.resume()
    }
}

class BackendService {
    static let baseURL = URL(string: "https://calorie-compass-chi.vercel.app")!

    static func sendMealAssistant(
        request: MealAssistantRequest,
        completion: @escaping (Result<MealAssistantResponse, Error>) -> Void
    ) {
        guard let url = URL(string: "/api/meal-assistant", relativeTo: baseURL) else {
            completion(.failure(NSError(domain: "BadURL", code: 0)))
            return
        }
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        do {
            urlRequest.httpBody = try JSONEncoder().encode(request)
        } catch {
            completion(.failure(error))
            return
        }
        let task = URLSession.shared.dataTask(with: urlRequest) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            guard let data = data else {
                completion(.failure(NSError(domain: "NoData", code: 0)))
                return
            }
            do {
                let decoded = try JSONDecoder().decode(MealAssistantResponse.self, from: data)
                completion(.success(decoded))
            } catch {
                completion(.failure(error))
            }
        }
        task.resume()
    }

    static func saveConfirmedMeal(
        request: PostMealRequest,
        completion: @escaping (Result<PostMealResponse, Error>) -> Void
    ) {
        guard let url = URL(string: "/api/meals", relativeTo: baseURL) else {
            completion(.failure(NSError(domain: "BadURL", code: 0)))
            return
        }
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        do {
            urlRequest.httpBody = try JSONEncoder().encode(request)
        } catch {
            completion(.failure(error))
            return
        }
        let task = URLSession.shared.dataTask(with: urlRequest) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            guard let data = data else {
                completion(.failure(NSError(domain: "NoData", code: 0)))
                return
            }
            do {
                let decoded = try JSONDecoder().decode(PostMealResponse.self, from: data)
                completion(.success(decoded))
            } catch {
                completion(.failure(error))
            }
        }
        task.resume()
    }
}
