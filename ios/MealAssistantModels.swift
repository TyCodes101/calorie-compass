import Foundation

enum MealType: String, Codable, CaseIterable, Identifiable {
    case breakfast
    case lunch
    case dinner
    case snack

    var id: String { rawValue }
}

enum ChatRole: String, Codable {
    case user
    case assistant
}

struct ChatTranscriptMessage: Codable, Identifiable, Equatable {
    var id = UUID()
    var role: ChatRole
    var text: String

    enum CodingKeys: String, CodingKey {
        case role
        case text
    }
}

struct NutritionTotals: Codable, Equatable {
    var calories: Double
    var protein: Double
    var carbs: Double
    var fat: Double
    var fiber: Double
    var sugar: Double
    var sodium: Double

    static let zero = NutritionTotals(calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0)
}

struct FoodNutritionBasis: Codable, Equatable {
    struct Values: Codable, Equatable {
        var calories: Double
        var protein: Double
        var carbs: Double
        var fat: Double
        var fiber: Double
        var sugar: Double
        var sodium: Double
    }

    var type: String
    var providerQuantity: Double
    var providerUnit: String
    var providerWeightGrams: Double?
    var scaleFactor: Double
    var baseNutrition: Values

    enum CodingKeys: String, CodingKey {
        case type
        case providerQuantity = "provider_quantity"
        case providerUnit = "provider_unit"
        case providerWeightGrams = "provider_weight_grams"
        case scaleFactor = "scale_factor"
        case baseNutrition = "base_nutrition"
    }
}

struct FoodItem: Codable, Identifiable, Equatable {
    var id = UUID()
    var foodName: String
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
    var isTrusted: Bool?
    var sourceType: String?
    var sourceName: String?
    var confidenceLabel: String?
    var matchedQuery: String?
    var originalUserText: String?
    var providerUsed: String?
    var usedAiFallback: Bool?
    var catalogFoodId: String?
    var userQuantity: Double?
    var userUnit: String?
    var userTextSpan: String?
    var normalizedGrams: Double?
    var normalizedOunces: Double?
    var sourceId: String?
    var providerCandidateId: String?
    var confidence: Double?
    var requestedModifiers: [String]?
    var modifierResolution: String?
    var reviewStatus: String?
    var nutritionBasis: FoodNutritionBasis?

    enum CodingKeys: String, CodingKey {
        case foodName = "food_name"
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
        case isTrusted = "is_trusted"
        case sourceType = "source_type"
        case sourceName = "source_name"
        case confidenceLabel = "confidence_label"
        case matchedQuery = "matched_query"
        case originalUserText = "original_user_text"
        case providerUsed = "provider_used"
        case usedAiFallback = "used_ai_fallback"
        case catalogFoodId = "catalog_food_id"
        case userQuantity
        case userUnit
        case userTextSpan
        case normalizedGrams
        case normalizedOunces
        case sourceId
        case providerCandidateId
        case confidence
        case requestedModifiers = "requested_modifiers"
        case modifierResolution = "modifier_resolution"
        case reviewStatus = "review_status"
        case nutritionBasis = "nutrition_basis"
    }
}

struct MealAssistantMemoryMeal: Codable, Identifiable, Equatable {
    var id: String
    var title: String
    var rawText: String?
    var mealType: MealType
    var totalCalories: Double
    var confidenceScore: Double
    var sourceReusableMealId: String?
    var date: String?
    var createdAt: String?
    var lastUsedAt: String?
    var items: [FoodItem]
}

struct MealAssistantContext: Codable, Equatable {
    var favoriteMeals: [MealAssistantMemoryMeal] = []
    var recentMeals: [MealAssistantMemoryMeal] = []
    var nutritionPreferences: String?
    var proteinGoal: Double?
    var dailyCalorieGoal: Double?
    var todayProtein: Double?
    var todayCarbs: Double?
    var todayFat: Double?
    var todayCalories: Double?
    var remainingProtein: Double?
    var remainingCarbs: Double?
    var remainingFat: Double?
    var remainingCalories: Double?
    var todayMealCount: Int?
}

struct PendingMeal: Codable, Equatable {
    var id: String
    var version: Int
    var status: String
    var mealType: MealType
    var displayTitle: String
    var rawText: String?
    var items: [FoodItem]
    var totals: NutritionTotals
    var confidenceScore: Double
    var createdAt: String?
    var updatedAt: String?
    var expiresAt: String?
    var savedMealId: String?
    var idempotencyKey: String?
}

struct MealAssistantState: Codable, Equatable {
    var currentMealItems: [FoodItem] = []
    var pendingMeal: PendingMeal?
    var pendingClarification: String?
    var lastAssistantQuestion: String?
    var userCorrections: [String] = []
    var saved = false
    var mealType: MealType = .snack
    var userName: String?
    var currentMealText: String?
    var confidenceScore: Double = 0.82
    var sourceReusableMealId: String?
    var editingMealId: String?
    var lastAssistantReply: String?
    var activeTopic: String?
    var activeMode: String?
    var activeQuestion: String?
    var previousIntent: String?
    var previousUserMessage: String?

    static let empty = MealAssistantState()
}

struct MealAssistantMeal: Codable, Equatable {
    var items: [FoodItem]
    var totals: NutritionTotals
    var confidenceScore: Double

    enum CodingKeys: String, CodingKey {
        case items
        case totals
        case confidenceScore = "confidence_score"
    }
}

struct MealAssistantRequest: Codable {
    var message: String
    var state: MealAssistantState
    var context: MealAssistantContext?
    var conversationHistory: [ChatTranscriptMessage]
}

struct MealAssistantResponse: Codable {
    var intent: String
    var assistantReply: String
    var shouldLookupNutrition: Bool
    var shouldSaveMeal: Bool
    var shouldAskClarification: Bool
    var clarificationQuestion: String?
    var confidence: String
    var meal: MealAssistantMeal
    var nextState: MealAssistantState

    enum CodingKeys: String, CodingKey {
        case intent
        case assistantReply = "assistant_reply"
        case shouldLookupNutrition = "should_lookup_nutrition"
        case shouldSaveMeal = "should_save_meal"
        case shouldAskClarification = "should_ask_clarification"
        case clarificationQuestion = "clarification_question"
        case confidence
        case meal
        case nextState = "next_state"
    }
}

struct SaveMealRequest: Codable {
    var mealType: MealType
    var confidenceScore: Double
    var rawText: String?
    var notes: String?
    var date: String?
    var sourceReusableMealId: String?
    var pendingMealId: String? = nil
    var pendingMealVersion: Int? = nil
    var idempotencyKey: String? = nil
    var items: [FoodItem]

    enum CodingKeys: String, CodingKey {
        case mealType = "meal_type"
        case confidenceScore = "confidence_score"
        case rawText = "raw_text"
        case notes
        case date
        case sourceReusableMealId = "source_reusable_meal_id"
        case pendingMealId = "pending_meal_id"
        case pendingMealVersion = "pending_meal_version"
        case idempotencyKey = "idempotency_key"
        case items
    }
}

struct DashboardSnapshot: Codable {
    struct DashboardUser: Codable {
        var id: String
        var name: String
    }

    var user: DashboardUser?
    var date: String?
    var totals: NutritionTotals?
    var mealCount: Int?
    var remainingCalories: Double?
    var macroGoals: NutritionTargets?
}

struct NutritionTargets: Codable, Equatable {
    var calories: Double?
    var protein: Double?
    var carbs: Double?
    var fat: Double?
}

struct SessionResponse: Codable {
    struct User: Codable {
        var id: String
        var name: String
        var mode: String
    }

    var user: User?
}

struct ProfileSnapshot: Codable {
    var name: String?
    var dailyCalorieGoal: Double?
    var proteinGoal: Double?
    var nutritionPreferences: String?
}

struct ProfileUpdateRequest: Codable {
    var name: String?
    var age: Int?
    var heightCm: Int?
    var weightLbs: Double?
    var goal: String?
    var activityLevel: String?
    var dailyCalorieGoal: Int?
    var proteinGoal: Int?
    var nutritionPreferences: String?
}
