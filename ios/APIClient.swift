import Foundation

enum APIClientError: LocalizedError, Equatable {
    case invalidURL
    case badStatus(Int)
    case decodingFailed
    case offline
    case requestFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "The backend URL is not configured correctly."
        case .badStatus:
            return "The server could not finish that request."
        case .decodingFailed:
            return "The app could not read the server response."
        case .offline:
            return "You appear to be offline."
        case .requestFailed(let message):
            return message
        }
    }
}

@MainActor
final class APIClient: ObservableObject {
    @Published private(set) var isOnline = true

    private let baseURL: URL
    private let urlSession: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(config: AppConfig = .current, urlSession: URLSession = .shared) {
        self.baseURL = config.backendBaseURL
        self.urlSession = urlSession
        self.encoder = JSONEncoder()
        self.decoder = JSONDecoder()
    }

    func sendMealAssistantMessage(_ request: MealAssistantRequest) async throws -> MealAssistantResponse {
        try await post("/api/meal-assistant", body: request)
    }

    func saveMeal(_ request: SaveMealRequest) async throws -> Data {
        try await postRaw("/api/meals", body: request)
    }

    func updateMeal(id: String, request: SaveMealRequest) async throws -> Data {
        try await sendRaw(path: "/api/meals/\(id)", method: "PATCH", body: request)
    }

    func deleteMeal(id: String) async throws -> Data {
        try await sendRaw(path: "/api/meals/\(id)", method: "DELETE", body: EmptyBody())
    }

    func fetchDashboard(date: Date = Date()) async throws -> DashboardSnapshot {
        let formatter = ISO8601DateFormatter()
        let dateValue = formatter.string(from: date)
        return try await get("/api/dashboard?date=\(dateValue)")
    }

    func fetchSession() async throws -> SessionResponse {
        try await get("/api/session")
    }

    func updateProfile(_ request: ProfileUpdateRequest) async throws -> Data {
        try await sendRaw(path: "/api/profile", method: "PATCH", body: request)
    }

    private func get<Response: Decodable>(_ path: String) async throws -> Response {
        var request = try makeRequest(path: path)
        request.httpMethod = "GET"
        return try await send(request)
    }

    private func post<Body: Encodable, Response: Decodable>(_ path: String, body: Body) async throws -> Response {
        var request = try makeRequest(path: path)
        request.httpMethod = "POST"
        request.httpBody = try encoder.encode(body)
        return try await send(request)
    }

    private func postRaw<Body: Encodable>(_ path: String, body: Body) async throws -> Data {
        try await sendRaw(path: path, method: "POST", body: body)
    }

    private func sendRaw<Body: Encodable>(path: String, method: String, body: Body) async throws -> Data {
        var request = try makeRequest(path: path)
        request.httpMethod = method
        if method != "DELETE" {
            request.httpBody = try encoder.encode(body)
        }
        let (data, _) = try await perform(request)
        return data
    }

    private func send<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        let (data, _) = try await perform(request)
        do {
            return try decoder.decode(Response.self, from: data)
        } catch {
            throw APIClientError.decodingFailed
        }
    }

    private func perform(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        do {
            let (data, response) = try await urlSession.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIClientError.requestFailed("The server returned an invalid response.")
            }
            guard (200..<300).contains(httpResponse.statusCode) else {
                throw APIClientError.badStatus(httpResponse.statusCode)
            }
            isOnline = true
            return (data, httpResponse)
        } catch let error as APIClientError {
            throw error
        } catch {
            isOnline = false
            throw APIClientError.requestFailed(error.localizedDescription)
        }
    }

    private func makeRequest(path: String) throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIClientError.invalidURL
        }

        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return request
    }
}

private struct EmptyBody: Encodable {}
