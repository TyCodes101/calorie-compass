//
// BackendService.swift
// CalorieCompass
//
// Handles API calls for Phase 2A (POST /api/meal-assistant)
//
import Foundation

struct MealAssistantRequest: Codable {
    let user_message: String
    let current_state: String?
    let conversation_history: [String]? // To match real contract type
    let macro_context: [String: Double]? // Nutrition info if available
}

struct MealAssistantResponse: Codable {
    let assistant_message: String
    let next_state: String? // Phase 2A: preserve between turns
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
}
