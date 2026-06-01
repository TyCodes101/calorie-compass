// BackendService.swift
// CalorieCompass
//
// Handles API calls for meal assistant, meals, dashboard, profile, and native meal management.
//
import Foundation

struct MealAssistantTranscriptMessage: Codable, Equatable {
    let role: String
    let text: String
}

struct MealAssistantState: Codable, Equatable {
    var currentMealItems: [MealRequestItem] = []
    var pendingClarification: String? = nil
    var lastAssistantQuestion: String? = nil
    var userCorrections: [String] = []
    var saved: Bool = false
    var mealType: String = "snack"
    var userName: String? = nil
    var currentMealText: String? = nil
    var confidenceScore: Double = 0.82
    var sourceReusableMealId: String? = nil
    var editingMealId: String? = nil
    var lastAssistantReply: String? = nil
    var activeTopic: String? = nil
    var activeMode: String? = nil
    var activeQuestion: String? = nil
    var previousIntent: String? = nil
    var previousUserMessage: String? = nil
}

struct MealAssistantContext: Codable, Equatable {
    var favoriteMeals: [MealAssistantMemoryMeal] = []
    var recentMeals: [MealAssistantMemoryMeal] = []
    var nutritionPreferences: String? = nil
    var proteinGoal: Double? = nil
    var dailyCalorieGoal: Double? = nil
    var todayProtein: Double? = nil
    var todayCarbs: Double? = nil
    var todayFat: Double? = nil
    var todayCalories: Double? = nil
    var remainingProtein: Double? = nil
    var remainingCarbs: Double? = nil
    var remainingFat: Double? = nil
    var remainingCalories: Double? = nil
    var todayMealCount: Double? = nil
}

struct MealAssistantMemoryMeal: Codable, Equatable {
    var id: String
    var title: String
    var rawText: String?
    var mealType: String
    var totalCalories: Double
    var confidenceScore: Double
    var items: [MealRequestItem]
}

struct MealAssistantRequest: Codable {
    let message: String
    let state: MealAssistantState
    let context: MealAssistantContext?
    let conversationHistory: [MealAssistantTranscriptMessage]
}

struct MealAssistantTotals: Codable, Equatable {
    let calories: Double
    let protein: Double
    let carbs: Double
    let fat: Double
    let fiber: Double
    let sugar: Double
    let sodium: Double
}

struct MealAssistantMeal: Codable, Equatable {
    let items: [MealRequestItem]
    let totals: MealAssistantTotals
    let confidence_score: Double
}

struct MealAssistantResponse: Codable {
    let assistant_reply: String
    let meal: MealAssistantMeal
    let next_state: MealAssistantState
    let intent: String?
    let should_save_meal: Bool?
    let clarification_question: String?

    enum CodingKeys: String, CodingKey {
        case assistant_reply
        case meal
        case next_state
        case intent
        case should_save_meal
        case clarification_question
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        assistant_reply = try container.decode(String.self, forKey: .assistant_reply)
        meal = try container.decode(MealAssistantMeal.self, forKey: .meal)
        next_state = try container.decode(MealAssistantState.self, forKey: .next_state)
        intent = try container.decodeIfPresent(String.self, forKey: .intent)
        should_save_meal = try container.decodeIfPresent(Bool.self, forKey: .should_save_meal)
        clarification_question = try container.decodeIfPresent(String.self, forKey: .clarification_question)
    }
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
    var is_trusted: Bool?
    var catalog_food_id: String?

    init(
        food_name: String,
        quantity: Double,
        unit: String,
        calories: Double,
        protein: Double,
        carbs: Double,
        fat: Double,
        fiber: Double,
        sugar: Double,
        sodium: Double,
        notes: String?,
        source_type: String?,
        source_name: String?,
        confidence_label: String?,
        is_trusted: Bool? = nil,
        catalog_food_id: String? = nil
    ) {
        self.food_name = food_name
        self.quantity = quantity
        self.unit = unit
        self.calories = calories
        self.protein = protein
        self.carbs = carbs
        self.fat = fat
        self.fiber = fiber
        self.sugar = sugar
        self.sodium = sodium
        self.notes = notes
        self.source_type = source_type
        self.source_name = source_name
        self.confidence_label = confidence_label
        self.is_trusted = is_trusted
        self.catalog_food_id = catalog_food_id
    }

    enum CodingKeys: String, CodingKey {
        case food_name
        case quantity
        case unit
        case calories
        case protein
        case carbs
        case fat
        case fiber
        case sugar
        case sodium
        case notes
        case source_type
        case source_name
        case confidence_label
        case is_trusted
        case catalog_food_id
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        food_name = try container.decodeIfPresent(String.self, forKey: .food_name) ?? "Food item"
        quantity = try container.decodeIfPresent(Double.self, forKey: .quantity) ?? 1
        unit = try container.decodeIfPresent(String.self, forKey: .unit) ?? "serving"
        calories = try container.decodeIfPresent(Double.self, forKey: .calories) ?? 0
        protein = try container.decodeIfPresent(Double.self, forKey: .protein) ?? 0
        carbs = try container.decodeIfPresent(Double.self, forKey: .carbs) ?? 0
        fat = try container.decodeIfPresent(Double.self, forKey: .fat) ?? 0
        fiber = try container.decodeIfPresent(Double.self, forKey: .fiber) ?? 0
        sugar = try container.decodeIfPresent(Double.self, forKey: .sugar) ?? 0
        sodium = try container.decodeIfPresent(Double.self, forKey: .sodium) ?? 0
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        source_type = try container.decodeIfPresent(String.self, forKey: .source_type)
        source_name = try container.decodeIfPresent(String.self, forKey: .source_name)
        confidence_label = try container.decodeIfPresent(String.self, forKey: .confidence_label)
        is_trusted = try container.decodeIfPresent(Bool.self, forKey: .is_trusted)
        catalog_food_id = try container.decodeIfPresent(String.self, forKey: .catalog_food_id)
    }
}

enum MealAssistantLocalCommand: Equatable {
    case discard
    case save
    case removeItem(String)
}

enum MealAssistantQuantityResolution: Equatable {
    case target(foodName: String)
    case clarify
}

struct MealAssistantClientLogic {
    static func buildRequestState(
        assistantState: MealAssistantState,
        currentMealItems: [MealRequestItem],
        incomingUserMessage: String,
        fallbackMealType: String = "snack"
    ) -> MealAssistantState {
        var state = assistantState

        if state.saved {
            state.currentMealItems = []
            state.saved = false
            state.currentMealText = nil
        } else {
            state.currentMealItems = currentMealItems
        }

        if state.currentMealText == nil || state.currentMealText?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == true {
            state.currentMealText = incomingUserMessage
        }

        if state.mealType.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            state.mealType = fallbackMealType
        }

        state.previousUserMessage = incomingUserMessage
        state.activeMode = state.activeMode ?? "logging_mode"
        state.activeTopic = state.activeTopic ?? "meal"
        return state
    }

    static func detectLocalCommand(_ message: String, hasActiveMeal: Bool) -> MealAssistantLocalCommand? {
        let normalized = message.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { return nil }

        if hasActiveMeal && ["discard", "discard that", "cancel", "clear", "clear meal", "clear everything", "reset", "reset meal", "start over", "start over please", "new meal", "delete this meal", "delete meal", "nevermind", "never mind"].contains(normalized) {
            return .discard
        }

        if hasActiveMeal && ["save", "save it", "save meal", "save the meal", "okay now save the meal", "ok now save the meal", "log it", "log this", "log meal", "log the meal"].contains(normalized) {
            return .save
        }

        if hasActiveMeal {
            let patterns = ["remove ", "delete ", "take out ", "drop "]
            for pattern in patterns where normalized.hasPrefix(pattern) {
                let target = String(normalized.dropFirst(pattern.count)).trimmingCharacters(in: .whitespacesAndNewlines)
                if !target.isEmpty && target != "that" && target != "it" {
                    return .removeItem(target)
                }
            }
        }

        return nil
    }

    static func quantityResolution(for message: String, items: [MealRequestItem]) -> MealAssistantQuantityResolution? {
        let normalized = message.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { return nil }
        let looksLikeQuantityEdit = normalized.contains("make") || normalized.contains("double") || normalized.contains("half") || normalized.contains("large") || normalized.contains("ounces") || normalized.contains("oz")
        guard looksLikeQuantityEdit else { return nil }

        let messageTokens = significantTokens(in: normalized)
        let namedMatches = items.filter { !messageTokens.isDisjoint(with: significantTokens(in: $0.food_name)) }
        if let match = namedMatches.first {
            return .target(foodName: match.food_name)
        }

        let pronounOnly = normalized.contains("that") || normalized.contains(" it ") || normalized.hasPrefix("it ") || normalized.hasSuffix(" it")
        if pronounOnly, let lastItem = items.last {
            return .target(foodName: lastItem.food_name)
        }

        return items.count == 1 ? items.first.map { .target(foodName: $0.food_name) } : .clarify
    }

    static func foodMatchWarning(for message: String, items: [MealRequestItem]) -> String? {
        let normalized = message.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let itemNames = items.map { $0.food_name.lowercased() }

        if normalized.contains("banana"), itemNames.contains(where: { $0.contains("powder") || $0.contains("dehydrated") }) {
            return "That banana match looks off. Try choosing a plain banana result instead of powder or dehydrated banana."
        }

        if normalized.contains("sandwich"), normalized.contains("chips"), !itemNames.contains(where: { $0.contains("sandwich") }) {
            return "I only found the side item. Please retry so I can include the sandwich too."
        }

        return nil
    }

    static func shouldPreserveActiveMeal(currentItems: [MealRequestItem], responseItems: [MealRequestItem], responseSaved: Bool) -> Bool {
        !currentItems.isEmpty && responseItems.isEmpty && !responseSaved
    }

    static func canAttemptSave(items: [MealRequestItem], isSaving: Bool) -> Bool {
        !isSaving && !items.isEmpty
    }

    static func removingItems(matching target: String, from items: [MealRequestItem]) -> [MealRequestItem] {
        let targetTokens = significantTokens(in: target)
        guard !targetTokens.isEmpty else { return items }

        return items.filter { item in
            let itemTokens = significantTokens(in: item.food_name)
            return targetTokens.isDisjoint(with: itemTokens)
        }
    }

    private static func significantTokens(in text: String) -> Set<String> {
        let ignored: Set<String> = ["a", "an", "the", "of", "with", "and", "to", "that", "it"]
        let normalized = text.lowercased()
        let rawParts = normalized.split { character in
            !character.isLetter && !character.isNumber
        }
        let words = rawParts.map(String.init)
        let singularized = words.map { token in
            token.hasSuffix("s") && token.count > 3 ? String(token.dropLast()) : token
        }
        let filtered = singularized.filter { token in
            token.count > 1 && !ignored.contains(token)
        }
        return Set(filtered)
    }
}

struct PostMealRequest: Codable, Equatable {
    var meal_type: String
    var confidence_score: Double
    var raw_text: String?
    var source_reusable_meal_id: String? = nil
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

    static let empty = DashboardResponse(
        calories: 0,
        goalCalories: 2200,
        protein: 0,
        carbs: 0,
        fat: 0,
        recentMeals: [],
        totals: DashboardTotals(calories: 0, protein: 0, carbs: 0, fat: 0),
        macroGoals: MacroGoals(calories: 2200, protein: 160, carbs: 220, fat: 73),
        mealCount: 0,
        remainingCalories: 2200,
        dailySummary: DailySummary(title: "Ready when you are", description: "Guest mode is setting up. You can log your first meal whenever you are ready.")
    )
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

struct NativeAppleAuthRequest: Encodable {
    let provider = "apple"
    let identityToken: String
    let authorizationCode: String?

    init(identityToken: String, authorizationCode: String?) {
        self.identityToken = identityToken
        self.authorizationCode = authorizationCode
    }
}

struct NativeAppleAuthResponse: Codable, Equatable {
    let ok: Bool?
    let code: String?
    let sessionIssued: Bool
    let account: NativeAppleAuthAccount?
    let session: NativeAppleAuthSession?
    let error: String?

    var hasBackendIssuedSession: Bool {
        ok == true &&
        sessionIssued &&
        account?.mode?.lowercased() == "account" &&
        session?.token.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
    }
}

struct NativeAppleAuthAccount: Codable, Equatable {
    let mode: String?
    let userId: String?
    let provider: String?
    let canUpgradeGuest: Bool?
}

struct NativeAppleAuthSession: Codable, Equatable {
    let token: String
    let expiresAt: String?
    let tokenType: String?
}

struct NativeGuestBootstrapResponse: Codable, Equatable {
    let account: AccountSnapshot?
    let user: SessionUser?
    let session: NativeAppleAuthSession

    var sessionResponse: SessionResponse {
        SessionResponse(account: account, user: user)
    }
}

struct NativeLogoutResponse: Codable, Equatable {
    let ok: Bool?
    let mode: String?
    let code: String?
    let revoked: Bool?
    let message: String?
}

struct NativeLifecycleCounts: Codable, Equatable {
    let profile: Int?
    let meals: Int?
    let reusableMeals: Int?
    let dailyLogs: Int?
    let weightEntries: Int?

    var total: Int {
        (profile ?? 0) + (meals ?? 0) + (reusableMeals ?? 0) + (dailyLogs ?? 0) + (weightEntries ?? 0)
    }
}

struct NativeGuestMigrationResult: Codable, Equatable {
    let status: String?
    let accountUserId: String?
    let guestUserId: String?
    let migrated: NativeLifecycleCounts
    let skipped: NativeLifecycleCounts
}

struct NativeGuestMigrationResponse: Codable, Equatable {
    let ok: Bool?
    let code: String?
    let result: NativeGuestMigrationResult?
    let error: String?

    var successMessage: String {
        let moved = result?.migrated.total ?? 0
        let skipped = result?.skipped.total ?? 0
        if skipped > 0 {
            return "\(moved) items moved, \(skipped) skipped because matching account data already existed."
        }
        if moved == 0 {
            return "No guest data needed migration."
        }
        return "\(moved) items moved into your account."
    }
}

struct NativeAccountExportAccount: Codable, Equatable {
    let userId: String?
    let name: String?
    let email: String?
    let demo: Bool?
}

struct NativeAccountExportSession: Codable, Equatable {
    let id: String?
    let expiresAt: String?
    let revokedAt: String?
    let createdAt: String?
    let updatedAt: String?
}

struct NativeAccountExportResponse: Codable, Equatable {
    let ok: Bool?
    let code: String?
    let exportedAt: String?
    let account: NativeAccountExportAccount?
    let profile: ProfileData?
    let meals: [MealResponse]?
    let nativeSessions: [NativeAccountExportSession]?
    let error: String?

    var successMessage: String {
        "Export ready. \(meals?.count ?? 0) meals included."
    }
}

struct NativeAccountDeleteCounts: Codable, Equatable {
    let profile: Int?
    let meals: Int?
    let reusableMeals: Int?
    let dailyLogs: Int?
    let weightEntries: Int?
    let authProviders: Int?

    var totalAccountDataRows: Int {
        let profileCount = profile ?? 0
        let mealCount = meals ?? 0
        let reusableMealCount = reusableMeals ?? 0
        let dailyLogCount = dailyLogs ?? 0
        let weightEntryCount = weightEntries ?? 0
        let authProviderCount = authProviders ?? 0

        return profileCount + mealCount + reusableMealCount + dailyLogCount + weightEntryCount + authProviderCount
    }
}

struct NativeAccountDeleteResponse: Codable, Equatable {
    let ok: Bool?
    let code: String?
    let deleted: NativeAccountDeleteCounts?
    let revokedSessions: Int?
    let error: String?

    var successMessage: String {
        "Account data deleted. \(revokedSessions ?? 0) sessions revoked."
    }
}

enum BackendError: LocalizedError, Equatable {
    case badURL
    case noData
    case offline
    case unauthorized
    case forbidden
    case malformedResponse
    case server(String)
    case unsupported(String)

    var errorDescription: String? {
        switch self {
        case .badURL: return "The Calorie Compass server URL is invalid."
        case .noData: return "The server returned no data."
        case .offline: return "You appear to be offline. Check your connection and try again."
        case .unauthorized: return "Your Calorie Compass session has expired. Please sign in again, then retry."
        case .forbidden: return "You do not have access to this Calorie Compass data. Please check your session and try again."
        case .malformedResponse: return "Calorie Compass returned an unexpected response. Please try again."
        case .server(let message): return message
        case .unsupported(let message): return message
        }
    }
}

class BackendService {
    static var baseURL: URL { AppConfig.current.backendBaseURL }
    static var nativeSessionTokenProvider: () -> String? = {
        KeychainAuthStorage().readBackendSessionToken()
    }

    private static func perform<T: Decodable>(_ urlRequest: URLRequest, completion: @escaping (Result<T, Error>) -> Void) {
        let task = URLSession.shared.dataTask(with: urlRequest) { data, response, error in
            if let error = error {
                completion(.failure(mapTransportError(error)))
                return
            }
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(BackendError.malformedResponse))
                return
            }
            guard let data = data, !data.isEmpty else {
                completion(.failure(BackendError.noData))
                return
            }
            if !(200...299).contains(httpResponse.statusCode) {
                completion(.failure(mapHTTPError(statusCode: httpResponse.statusCode, data: data)))
                return
            }
            do {
                let decoded = try JSONDecoder().decode(T.self, from: data)
                completion(.success(decoded))
            } catch {
                completion(.failure(BackendError.malformedResponse))
            }
        }
        task.resume()
    }

    static func mapHTTPError(statusCode: Int, data: Data?) -> BackendError {
        if statusCode == 401 { return .unauthorized }
        if statusCode == 403 { return .forbidden }
        if let data,
           let apiError = try? JSONDecoder().decode(APIErrorResponse.self, from: data),
           let message = apiError.error,
           !message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return .server(message)
        }
        return .server("Request failed with status \(statusCode).")
    }

    static func mapTransportError(_ error: Error) -> BackendError {
        let nsError = error as NSError
        let offlineCodes = [
            NSURLErrorNotConnectedToInternet,
            NSURLErrorNetworkConnectionLost,
            NSURLErrorCannotFindHost,
            NSURLErrorCannotConnectToHost,
            NSURLErrorTimedOut,
            NSURLErrorInternationalRoamingOff,
            NSURLErrorDataNotAllowed
        ]
        if nsError.domain == NSURLErrorDomain && offlineCodes.contains(nsError.code) {
            return .offline
        }
        return .server(error.localizedDescription)
    }

    static func applyNativeSessionAuthorization(to request: inout URLRequest, token: String?) {
        guard let token = token?.trimmingCharacters(in: .whitespacesAndNewlines),
              !token.isEmpty else {
            return
        }
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }

    private static func request(path: String, method: String = "GET", queryItems: [URLQueryItem] = [], includeNativeSession: Bool = true) -> URLRequest? {
        guard var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false) else { return nil }
        if !queryItems.isEmpty { components.queryItems = queryItems }
        guard let url = components.url else { return nil }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("ios", forHTTPHeaderField: "X-Calorie-Compass-Client")
        if includeNativeSession {
            applyNativeSessionAuthorization(to: &request, token: nativeSessionTokenProvider())
        }
        return request
    }

    static func makeNativeAccountLifecycleRequest(path: String, method: String, token: String?) -> URLRequest? {
        guard let token = token?.trimmingCharacters(in: .whitespacesAndNewlines),
              !token.isEmpty,
              var urlRequest = request(path: path, method: method, includeNativeSession: false) else {
            return nil
        }
        applyNativeSessionAuthorization(to: &urlRequest, token: token)
        return urlRequest
    }

    static func fetchSession(completion: @escaping (Result<SessionResponse, Error>) -> Void) {
        guard let urlRequest = request(path: "api/session", method: "GET") else { completion(.failure(BackendError.badURL)); return }
        perform(urlRequest, completion: completion)
    }

    static func createGuestSession(completion: @escaping (Result<NativeGuestBootstrapResponse, Error>) -> Void) {
        guard let urlRequest = request(path: "api/session/guest", method: "POST", includeNativeSession: false) else { completion(.failure(BackendError.badURL)); return }
        perform(urlRequest, completion: completion)
    }

    static func signInWithApple(identityToken: String, authorizationCode: String?, completion: @escaping (Result<NativeAppleAuthResponse, Error>) -> Void) {
        guard var urlRequest = request(path: "api/auth/apple/native", method: "POST", includeNativeSession: false) else { completion(.failure(BackendError.badURL)); return }
        let body = NativeAppleAuthRequest(identityToken: identityToken, authorizationCode: authorizationCode)
        do { urlRequest.httpBody = try JSONEncoder().encode(body) } catch { completion(.failure(error)); return }
        perform(urlRequest, completion: completion)
    }

    static func logoutNativeSession(token: String?, completion: @escaping (Result<NativeLogoutResponse, Error>) -> Void) {
        guard var urlRequest = request(path: "api/auth/logout", method: "POST", includeNativeSession: false) else { completion(.failure(BackendError.badURL)); return }
        applyNativeSessionAuthorization(to: &urlRequest, token: token)
        perform(urlRequest, completion: completion)
    }

    static func migrateGuestData(completion: @escaping (Result<NativeGuestMigrationResponse, Error>) -> Void) {
        guard let urlRequest = makeNativeAccountLifecycleRequest(path: "api/auth/guest/migrate", method: "POST", token: nativeSessionTokenProvider()) else {
            completion(.failure(BackendError.unauthorized))
            return
        }
        perform(urlRequest, completion: completion)
    }

    static func exportNativeAccountData(completion: @escaping (Result<NativeAccountExportResponse, Error>) -> Void) {
        guard let urlRequest = makeNativeAccountLifecycleRequest(path: "api/account/native/export", method: "GET", token: nativeSessionTokenProvider()) else {
            completion(.failure(BackendError.unauthorized))
            return
        }
        perform(urlRequest, completion: completion)
    }

    static func deleteNativeAccount(completion: @escaping (Result<NativeAccountDeleteResponse, Error>) -> Void) {
        guard let urlRequest = makeNativeAccountLifecycleRequest(path: "api/account/native/delete", method: "DELETE", token: nativeSessionTokenProvider()) else {
            completion(.failure(BackendError.unauthorized))
            return
        }
        perform(urlRequest, completion: completion)
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
