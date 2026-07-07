import OpenAI from 'openai';

import { getMockParsedMeal } from '@/lib/ai/mock';
import { parseMealText } from '@/lib/ai/openai';
import { openaiMealModel } from '@/lib/ai/openaiConfig';
import { mapFoodIntelligenceToMealAssistantDecision, runOpenAIFoodIntelligence } from '@/lib/ai/openaiFoodIntelligence';
import { getTrustedCatalogEstimate } from '@/lib/ai/trusted';
import {
  type MealAssistantAction,
  type MealAssistantContext,
  type MealAssistantItem,
  type MealAssistantMemoryMeal,
  type MealAssistantModelOutput,
  type MealAssistantOperation,
  type MealAssistantResponse,
  type MealAssistantState,
  type MealAssistantTranscriptMessage,
} from '@/lib/ai/mealAssistantSchema';
import {
  buildIrrelevantModifierReply,
  buildNoMealMacroReply,
  buildPendingMealMacroReply,
  buildPendingReviewReply,
  buildSavedMealMacroReply,
  buildStalePendingReply,
  createReadyPendingMeal,
  discardPendingMeal,
  extractMealTypeCorrection,
  getActivePendingMeal,
  hasActivePendingMeal,
  isIrrelevantModifierRemoval,
  isMacroRequestMessage,
  isPendingDiscardMessage,
  isPendingMealExpired,
  markPendingMealSaveFailed,
  markPendingMealSaved,
  markPendingMealStale,
  migratePendingMealState,
  syncPendingMealWithCurrentItems,
  updatePendingMealType,
} from '@/lib/ai/mealPendingState';
import type { ParsedFoodItem, ParsedMealResponse } from '@/lib/ai/types';
import { saveConfirmedMeal, updateSavedMeal } from '@/lib/meals';
import { resolveNutritionEstimate } from '@/lib/nutrition/resolver';

const model = openaiMealModel;
const greetingRegex = /^(?:hi|hello|hey|yo|sup|good morning|good afternoon|good evening)\b/i;
const continuationRegex = /^(?:and|also|plus|with|anyway|wait(?:\s+also)?|i also had|and i had|also add|throw in|add)\b/i;
const removeRegex = /^(?:(?:nvm|nevermind|never mind)\s+)?(?:remove|delete|drop|without|hold the|skip the)\s+(.+)$|^no\s+(?!i\b|actually\b|instead\b|make\b|change\b|update\b|that\b|this\b|it\b|just\b)(.+)$/i;
const startNewRegex = /^(?:start over|new meal|clear this|reset|fresh one|different meal)\b/i;
const saveRegex = /^(?:save(?: it| that| this)?|log(?: it| that| this)|confirm(?: it| that| this| meal| entry)?|looks good|done)\b|\b(?:save|log|confirm)\s+(?:it|that|this|meal|entry)\b/i;
const negatedSaveRegex = /\b(?:do not|don't|dont|never|not)\s+(?:save|log|confirm)(?:\s+(?:it|that|this|meal|entry))?\b/i;
const saveQuestionRegex = /^(?:should\s+(?:i|we)|do you think i should|think i should)\s+(?:save|log|confirm)(?:\s+(?:it|that|this|meal|entry))?[?.! ]*$/i;
const explicitQuantityUpdateRegex = /^(?:actually\s+)?(?:make|change|update)\s+(?:it|that|this)(?:\s+to)?\s+(\d+(?:\.\d+)?|\.\d+|a half|half|three quarters?|a quarter|quarter|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const editRegex = /^(?:edit(?: it| that| this)?|change(?: it| that| this)?|tweak(?: it| that| this)?|adjust(?: it| that| this)?)\b/i;
const reviewRegex = /\b(?:review (?:it|this|that)|show me (?:the )?(?:meal|review)|what do i have so far|show me what i have)\b/i;
const quantityOnlyRegex = /^(?:actually|make that|update that to|it was|that was|no|i meant|instead)\s+(?:only\s+)?(\d+(?:\.\d+)?|\.\d+|a half|half|three quarters?|a quarter|quarter|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const directQuantityRegex = /^(\d+(?:\.\d+)?|\.\d+|a half|half|three quarters?|a quarter|quarter|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const casualRegex = /^(?:hi|hello|hey|yo|sup|what(?:'|’)??s up|thanks|thank you|cool|okay|ok|nice|lol|how are you|how(?:'|’)??s your day)\b/i;
const offTopicRegex = /\b(?:weather|movie|music|homework|code|browser|news|sports|joke|workout|gym|training|lift|lifting|destroyed me)\b/i;
const repeatYesterdayRegex = /\b(?:repeat|log|use|same as|what(?: did)? i (?:have|eat|log))\s+yesterday(?:'?s)?\b|\byesterday(?:'?s)?\b/i;
const usualRegex = /\b(?:same as usual|my usual|the usual|usual)\b/i;
const repeatCueRegex = /\b(?:same|usual|again|repeat|yesterday|last time|last meal)\b/i;
const followUpMacroRegex = /\bwhat about (?:carbs?|protein|fat|calories?)\b|\bhow about (?:carbs?|protein|fat|calories?)\b/i;
const calorieLeftRegex = /\b(?:how many|how much|what(?:'s| is))\s+(?:calories?|cals?)\s+(?:do i have\s+)?(?:left|remaining)\b|\b(?:calories?|cals?|cal)\s+left\b/i;
const proteinLeftRegex = /\b(?:how many|how much|what(?:'s| is))\s+protein\s+(?:do i have\s+)?(?:left|remaining)\b|\bprotein\s+left\b/i;
const carbsQuestionRegex = /\b(?:carbs?|carbohydrates?)\b/i;
const fatQuestionRegex = /\b(?:fat|fats)\b/i;
const proteinQuestionRegex = /\bprotein\b/i;
const caloriesQuestionRegex = /\bcalories?\b/i;
const onTrackRegex = /\bam i on track\b|\bhow am i doing\b|\bdid i hit my goal\b|\bon track\b/i;
const dinnerSuggestionRegex = /\b(?:what should i eat tonight|what should i have tonight|what should i eat for dinner|what should i have for dinner|dinner idea|dinner ideas|dinner diea|dinner dieas|idea for dinner|ideas for dinner|good idea for dinner|good dinner idea|good dinner ideas|yummy dinner|tonight idea|tonight ideas)\b/i;
const snackSuggestionRegex = /\b(?:high protein snack|protein snack|sweet snack|healthy sweet snack|snack idea|snack ideas|what should i snack on|what's a good snack|what is a good snack)\b/i;
const snackRoomRegex = /\b(?:do i have room for a snack|room for a snack|can i have a snack|can i fit a snack|i(?: am|'m) in the snack room|in the snack room)\b/i;
const recommendationRegex = /\b(?:what should i eat|what should i have|what sounds good|give me (?:an?|some)?\s*(?:yummy\s+)?(?:dinner\s+)?(?:ideas?|dieas?)|any ideas?|recommend|suggest|something (?:sweet|lighter|healthy|healthier)|healthy snack|healthy dessert|dessert idea|quick meal|quick food|restaurant idea|healthier version|lighter version|good idea for dinner|good dinner idea|yummy dinner|high protein breakfast|breakfast idea|breakfast ideas|healthy breakfast|what should i eat for breakfast|what should i have for breakfast)\b/i;
const sweetHealthyRegex = /\b(?:sweet|dessert)\b.*\b(?:healthy|healthier|lighter|light)\b|\b(?:healthy|healthier|lighter|light)\b.*\b(?:sweet|dessert)\b/i;
const healthyTreatRegex = /\b(?:healthy treat|healthy snack|healthier treat|dessert|sweet snack)\b/i;
const lighterVersionRegex = /\b(?:lighter|healthier)\s+(?:version|option)\b|\bsomething lighter\b|\bhealthier version\b/i;
const recommendationFollowUpRegex = /^(?:something|anything|maybe|more|less|lower|higher|another|other|different|not that|not really|too heavy|too much|too many|sweeter|sweet|savory|lighter|healthier|quicker|quick|easy|easier|more protein|higher protein|high protein|lower carb|less carb|more filling|filling|dessert|snacky)\b/i;
const grilledSwapRegex = /\b(?:make it grilled|grilled instead|swap .* for grilled|make that grilled)\b/i;
const doubleThatRegex = /^(?:double that|double it|make it double|double this)\b/i;
const comparisonRegex = /\b(?:better than|vs\.?|versus|compare)\b/i;
const currentMealProteinRegex = /\b(?:how much|how many|what(?:'s| is)).*protein.*(?:this|that|meal|shake|bowl|burger)\b|\bhow much protein is (?:this|that)\b/i;
const currentMealCaloriesRegex = /\b(?:how many|how much|what(?:'s| is)).*calories?.*(?:this|that|meal|shake|bowl|burger)\b|\bhow many calories is (?:this|that)\b/i;
const enoughProteinRegex = /\b(?:was|is)\s+(?:that|this|it|the meal)\s+enough\s+protein\b|\benough protein\??$/i;
const mealTypeHintRegex = /\b(breakfast|lunch|dinner|snack)\b/i;
const weeklySummaryRegex = /\b(?:how(?:'s| is) (?:this|my) week|weekly summary|week so far|how am i doing this week|this week)\b/i;
const stopWordRegex = /\b(i|me|my|mine|had|have|ate|drank|log|repeat|again|same|usual|use|using|as|the|a|an|for|to|of|this|that|yesterday|today|tonight|please|my|last|meal|food)\b/g;
const laughRegex = /^(?:lol|lmao|haha+|hehe+|rofl|😂|🤣)+[!. ]*$/i;
const appreciationRegex = /^(?:thanks|thank you|thx|appreciate it)[!. ]*$/i;
const frustrationRegex = /\b(?:ugh|oops|my bad|sorry|whoops|damn|dang|wtf|fuck|fucking|shit|frustrat(?:ed|ing))\b/i;
const confusionComplaintRegex = /\b(?:makes no sense|make no sense|that is wrong|that's wrong|this is wrong|wrong item|not what i meant|confusing|messed that up|messed up|you messed that up|you messed up|fix that|fix this)\b/i;
const negativeFeedbackRegex = /^(?:no|nah|nope|wrong|try again|bro what|nvm|never mind|(?:no|nah|nope)\s+(?:that(?:'s| is)?\s+)?(?:not right|wrong|way off|not even close)|that(?:'s| is) not right|that(?:'s| is) way off|way off|not right|not even close)[!. ]*$/i;
const jokeRequestRegex = /\b(?:tell me a joke|say a joke|joke)\b/i;
const sizeUpRegex = /\b(?:huge|massive|giant|really big|extra big|super big)\b/i;
const sizeDownRegex = /\b(?:small|tiny|light|not that much|pretty small)\b/i;
const healthyCueRegex = /\b(?:healthy|balanced|pretty healthy|pretty balanced|not too bad|clean)\b/i;
const mealDescriptorReferenceRegex = /\b(?:that|this|it|meal|burger|bowl|shake|sandwich|breakfast|lunch|dinner|snack)\b/i;
const ambiguousFollowUpRegex = /^(?:what about that|what about it|how about that|how about it|is that okay|is it okay|does that work|which one|what do you mean|what does that mean|wdym|wym|huh|wait)\b/i;
const clarificationMetaQuestionRegex = /^(?:like what|what details?|what detail do you need|what do you need|what info|what information|what kind of details?|what do you mean|what does that mean|wdym|wym|huh|examples?\??|such as\??|like\??)$/i;
const nothingYetRegex = /^(?:nothing|nothing yet|not yet|haven't eaten yet|havent eaten yet|no food yet|none yet|nothing today)\b/i;
const alreadySentFoodRegex = /^(?:i did|i already did|i just did|already did|i told you|sent it|i sent it)\b/i;

const genericResolvedFoodRegex = /^(?:estimated\s+)?(?:mixed\s+)?meal(?:\s+estimate)?$|^food(?:\s+item)?$|^item$/i;
const pizzaNameRegex = /\bpizza\b/i;
const pizzaSliceUnitRegex = /\b(?:slice|slices)\b/i;
const genericFallbackNameRegex = /\b(?:estimated mixed meal|mixed meal|meal item|unknown food)\b/i;
const correctionCueRegex = /^(?:actually|no|nah|i meant|make that|change (?:it|that|this)|update (?:it|that|this)|(?:lets|let's) go back to|go back to|back to|instead|not )\b/i;
const discourseFoodBlockerRegex = /\b(?:actually|make that|instead(?: of)?|what should i eat|what should i have|tonight|add that|change it|change that|remove|keep|also|btw|wym|what do you mean)\b/i;
const strongFoodSignalRegex = /\b(?:sunflower seeds?|seeds?|cookie|cookies|oatmeal|oats?|blueberr(?:y|ies)|greek yogurt|cottage cheese|cheese|rice cakes?|rice|peanut butter|toast|eggs?|bacon|orange juice|hash browns?|pizza|little caesars?|chipotle|taco\s*bell|tacobell|wendy'?s|mcdouble|mc double|mcdonald'?s?|mc\s*donalds?|chic?k?[-\s]*fil[-\s]*a|starbucks|subway|white castle|arby'?s?|arbys|burger\s*king|burgerking|panda express|domino'?s?|dominos|pizza hut|raising canes?|canes|popeyes|panera|dunkin|kfc|five guys|jersey mikes?|trader joe'?s?|mcchicken|big mac|nuggets?|tacos?|sandwich|sandwhich|burgers?|fries|fry|latte|macchiato|footlong|slider|orange chicken|caniac|mac and cheese|fairlife|core power|quest|pop[-\s]*tarts?|cheez[-\s]*its?|cheezits?|beans?|pickles?|bananas?|apples?|corn|butter|protein bars?|protein shake|protein powder|whey|shakes?|grilled chicken|chicken breast|chicken tenders?|chicken|turkey sausage|sausage|coke zero|coke|soda|chips?|guac(?:amole)?|broccoli|cereal|cinnamon toast crunch|granola|milk|coffee|muffins?|steak|potatoes|salmon|avocado|salsa|sauce|ranch|pasta|gummy worms?|skittles?|snickers?|m&ms?|mms?|candy|candies|candy bars?)\b/i;

const emptyContext: MealAssistantContext = {
  favoriteMeals: [],
  recentMeals: [],
  assistantMemory: undefined,
  nutritionPreferences: null,
  proteinGoal: null,
  dailyCalorieGoal: null,
  todayProtein: null,
  todayCarbs: null,
  todayFat: null,
  todayCalories: null,
  remainingProtein: null,
  remainingCarbs: null,
  remainingFat: null,
  remainingCalories: null,
  todayMealCount: null,
};

const fallbackRecommendationOptions: FallbackRecommendationOption[] = [
  { label: 'Greek yogurt with berries', mealType: 'snack', calories: 180, protein: 17, carbs: 18, fat: 0, tags: ['sweet', 'healthy', 'quick', 'light', 'high_protein'] },
  { label: 'Fairlife shake and fruit', mealType: 'snack', calories: 230, protein: 30, carbs: 20, fat: 3, tags: ['sweet', 'healthy', 'quick', 'high_protein'] },
  { label: 'Cottage cheese with pineapple', mealType: 'snack', calories: 190, protein: 18, carbs: 16, fat: 4, tags: ['sweet', 'healthy', 'light', 'high_protein'] },
  { label: 'Protein pudding', mealType: 'snack', calories: 180, protein: 20, carbs: 14, fat: 4, tags: ['sweet', 'healthy', 'quick', 'light', 'high_protein'] },
  { label: 'Eggs, toast, and fruit', mealType: 'breakfast', calories: 410, protein: 26, carbs: 30, fat: 18, tags: ['healthy', 'high_protein', 'balanced'] },
  { label: 'Fairlife shake with oatmeal', mealType: 'breakfast', calories: 360, protein: 34, carbs: 34, fat: 7, tags: ['quick', 'high_protein', 'balanced'] },
  { label: 'Greek yogurt bowl with berries and granola', mealType: 'breakfast', calories: 320, protein: 24, carbs: 34, fat: 8, tags: ['sweet', 'healthy', 'high_protein'] },
  { label: 'Protein oatmeal with berries', mealType: 'breakfast', calories: 340, protein: 28, carbs: 38, fat: 7, tags: ['sweet', 'healthy', 'high_protein'] },
  { label: 'Chicken rice bowl', mealType: 'dinner', calories: 560, protein: 42, carbs: 48, fat: 16, tags: ['balanced', 'high_protein'] },
  { label: 'Chipotle bowl with extra chicken', mealType: 'dinner', calories: 670, protein: 48, carbs: 52, fat: 22, tags: ['restaurant', 'high_protein', 'balanced'] },
  { label: 'Turkey burger with potatoes', mealType: 'dinner', calories: 590, protein: 39, carbs: 44, fat: 24, tags: ['balanced', 'high_protein'] },
  { label: 'Salmon with potatoes', mealType: 'dinner', calories: 610, protein: 40, carbs: 36, fat: 28, tags: ['balanced', 'high_protein'] },
  { label: 'Turkey sandwich and fruit', mealType: 'lunch', calories: 460, protein: 32, carbs: 41, fat: 14, tags: ['quick', 'balanced', 'high_protein'] },
  { label: 'Chicken wrap with fruit', mealType: 'lunch', calories: 500, protein: 35, carbs: 42, fat: 16, tags: ['quick', 'balanced', 'high_protein'] },
];

type MealAssistantRunInput = {
  message: string;
  state: MealAssistantState;
  context?: MealAssistantContext;
  userPreferences?: string | null;
  conversationHistory?: MealAssistantTranscriptMessage[];
};

type NutritionResolver = (args: { item: MealAssistantItem; mealType: MealAssistantState['mealType'] }) => Promise<ParsedMealResponse | null>;
type ModelClassifier = (args: MealAssistantRunInput) => Promise<MealAssistantModelOutput>;
type SaveExecutor = (args: { state: MealAssistantState; items: ParsedFoodItem[] }) => Promise<void>;
type NormalizedMealAssistantOperation = {
  action: MealAssistantAction;
  target_item: string | null;
  target_item_id: string | null;
  target_item_index: number | null;
  items: MealAssistantItem[];
  should_lookup_nutrition: boolean;
  should_save_meal: boolean;
};

type OperationApplicationResult = {
  nextItems: ParsedFoodItem[];
  removedTargets: string[];
  summaryParts: string[];
  resolvedItems: ParsedFoodItem[];
  shouldSaveMeal: boolean;
  mutated: boolean;
};

type AssistantReplyGenerator = (args: {
  input: MealAssistantRunInput;
  decision: MealAssistantModelOutput;
  draftReply: string;
  nextState: MealAssistantState;
  mealItems: ParsedFoodItem[];
  context: MealAssistantContext;
  saved: boolean;
  clarificationQuestion: string | null;
  removedTargets: string[];
}) => Promise<string | null>;

type MealAssistantDependencies = {
  classify?: ModelClassifier;
  resolveItemNutrition?: NutritionResolver;
  saveMeal?: SaveExecutor;
  generateAssistantReply?: AssistantReplyGenerator;
};

type MemoryEntry = MealAssistantMemoryMeal & {
  source: 'favorite' | 'recent' | 'memory';
};

type MemoryMatch = {
  candidate: MemoryEntry;
  mode: 'yesterday' | 'usual' | 'recent';
  appendToCurrentMeal: boolean;
};

type RecommendationProfile = {
  mealType: MealAssistantState['mealType'] | null;
  wantsSweet: boolean;
  wantsHighProtein: boolean;
  wantsLight: boolean;
  wantsRestaurant: boolean;
  wantsQuick: boolean;
  wantsHealthy: boolean;
  wantsLowerCarb: boolean;
  prefersCurrentRecommendationThread: boolean;
  maxCalories: number | null;
  minProtein: number;
};

type FallbackRecommendationOption = {
  label: string;
  mealType: MealAssistantState['mealType'];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  tags: string[];
};

type MixedIntentSplit = {
  foodMessage: string | null;
  followUpMessage: string | null;
};

function sumTotals(items: ParsedFoodItem[]) {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + Number(item.calories || 0),
      protein: acc.protein + Number(item.protein || 0),
      carbs: acc.carbs + Number(item.carbs || 0),
      fat: acc.fat + Number(item.fat || 0),
      fiber: acc.fiber + Number(item.fiber || 0),
      sugar: acc.sugar + Number(item.sugar || 0),
      sodium: acc.sodium + Number(item.sodium || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
  );
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKnownFoodTypos(text: string) {
  return text
    .replace(/\bcotaage\b/g, 'cottage')
    .replace(/\bcotage\b/g, 'cottage')
    .replace(/\bcottagee\b/g, 'cottage')
    .replace(/\bburgre\b/g, 'burger')
    .replace(/\bsald\b/g, 'salad')
    .replace(/\bfris\b/g, 'fries')
    .replace(/\bpiza\b/g, 'pizza')
    .replace(/\bshaake\b/g, 'shake')
    .replace(/\bchis\b/g, 'chips')
    .replace(/\bsuub\b/g, 'sub')
    .replace(/\bpasa\b/g, 'pasta')
    .replace(/\bchkn\b/g, 'chicken')
    .replace(/\bchikn\b/g, 'chicken')
    .replace(/\bchic\s+fil\s+a\b/g, 'chick fil a')
    .replace(/\bchicfila\b/g, 'chickfila')
    .replace(/\bsandwhich\b/g, 'sandwich')
    .replace(/\bsandwhiches\b/g, 'sandwiches')
    .replace(/\bceasers\b/g, 'caesars')
    .replace(/\bcaesers\b/g, 'caesars')
    .replace(/\bdiet\s+cooe\b/g, 'diet coke')
    .replace(/\bcheetoos\b/g, 'cheetos')
    .replace(/\bdoritoos\b/g, 'doritos')
    .replace(/\blaays\b/g, 'lays')
    .replace(/\bpop\s+tats\b/g, 'pop tarts')
    .replace(/\bcoe\b/g, 'coke')
    .replace(/\bpeepsi\b/g, 'pepsi')
    .replace(/\bgaotrade\b/g, 'gatorade')
    .replace(/\bre\s+dbull\b/g, 'red bull')
    .replace(/\bclfi\b/g, 'clif')
    .replace(/\bkidn\b/g, 'kind')
    .replace(/\bgoldfsih\b/g, 'goldfish')
    .replace(/\bcheezi\s*t\b/g, 'cheez it')
    .replace(/\bnuggest\b/g, 'nuggets');
}

function normalizeFoodText(text: string) {
  return normalizeKnownFoodTypos(normalizeText(text));
}

function isLikelyNonsenseInput(message: string) {
  const normalized = normalizeFoodText(message);
  const compact = normalized.replace(/\s+/g, '');

  if (!compact || strongFoodSignalRegex.test(normalized)) {
    return false;
  }

  return /^(?:asdf+|asdfghjkl+|qwerty+|blah+|test+|[bcdfghjklmnpqrstvwxyz]{7,})$/.test(compact);
}

function sanitizeAssistantText(text: string) {
  return text
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac\u0153/g, '"')
    .replace(/\u00e2\u20ac\u009d/g, '"')
    .replace(/\u00e2\u20ac\u00a6/g, '...')
    .replace(/\u00e2\u20ac\u201c/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u2013\u2014]/g, '-');
}

function shorten(text: string, max = 72) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function tokenizeText(text: string) {
  return normalizeFoodText(text)
    .replace(stopWordRegex, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function parseCount(value: string) {
  const normalized = value.trim().toLowerCase();
  const fractionMap: Record<string, number> = {
    half: 0.5,
    'a half': 0.5,
    quarter: 0.25,
    'a quarter': 0.25,
    'three quarters': 0.75,
    'three quarter': 0.75,
  };
  const wordMap: Record<string, number> = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  if (fractionMap[normalized] !== undefined) {
    return fractionMap[normalized];
  }

  if (wordMap[normalized] !== undefined) {
    return wordMap[normalized];
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

function normalizeQuantityUnit(unit: string | null | undefined) {
  if (!unit) {
    return null;
  }

  const normalized = unit.toLowerCase().trim();
  if (/^(?:\d+(?:\.\d+)?\s+)?(?:g|gram|grams)$/.test(normalized)) {
    return 'g';
  }

  if (/^(?:\d+(?:\.\d+)?\s+)?(?:oz|ounce|ounces|onz|onzs)$/.test(normalized)) {
    return 'oz';
  }

  if (normalized === 'g' || normalized === 'gram' || normalized === 'grams') {
    return 'g';
  }

  if (normalized === 'oz' || normalized === 'ounce' || normalized === 'ounces') {
    return 'oz';
  }

  if (normalized === 'cup' || normalized === 'cups') {
    return 'cup';
  }

  if (normalized === 'tbsp' || normalized === 'tablespoon' || normalized === 'tablespoons') {
    return 'tbsp';
  }

  if (normalized === 'tsp' || normalized === 'teaspoon' || normalized === 'teaspoons') {
    return 'tsp';
  }

  if (normalized === 'slice' || normalized === 'slices') {
    return 'slice';
  }

  if (normalized === 'piece' || normalized === 'pieces') {
    return 'piece';
  }

  if (normalized === 'serving' || normalized === 'servings') {
    return 'serving';
  }

  if (normalized === 'cake' || normalized === 'cakes') {
    return 'cake';
  }

  if (normalized === 'egg' || normalized === 'eggs') {
    return 'egg';
  }

  if (normalized === 'bottle' || normalized === 'bottles') {
    return 'bottle';
  }

  if (normalized === 'can' || normalized === 'cans') {
    return 'can';
  }

  if (normalized === 'scoop' || normalized === 'scoops') {
    return 'scoop';
  }

  if (normalized === 'bowl' || normalized === 'bowls') {
    return 'bowl';
  }

  if (normalized === 'bar' || normalized === 'bars') {
    return 'bar';
  }

  if (normalized === 'muffin' || normalized === 'muffins') {
    return 'muffin';
  }

  if (normalized === 'burger' || normalized === 'burgers') {
    return 'burger';
  }

  if (normalized === 'pack' || normalized === 'packs' || normalized === 'packet' || normalized === 'packets') {
    return 'pack';
  }

  return normalized;
}

function parseCorrectedServing(message: string) {
  const normalized = stripCorrectionLeadIn(stripConversationalLeadIn(stripEmotionalPreface(message).toLowerCase()));
  const quantityWords = 'a|an|one|two|three|four|five|six|seven|eight|nine|ten';
  const quantityPattern = `a half|half|three quarters?|a quarter|quarter|\\d+(?:\\.\\d+)?|\\.\\d+|${quantityWords}`;
  const unitPattern = 'cups?|grams?|g|oz|ounces?|tbsp|tablespoons?|tsp|teaspoons?|slices?|pieces?|servings?|cakes?|eggs?|bottles?|cans?|scoops?|bowls?|bars?|muffins?|burgers?';
  const match = normalized.match(
    new RegExp(`^(?:(?:no|nah|actually|i meant|instead|it was|that was|make that|update that to|change that to|make it|change it to|update it to|lets go back to|let's go back to|go back to|back to|nvm|nevermind|never mind)\\s+)?(?:i\\s+)?(?:(?:only\\s+)?(?:had|ate|drank)\\s+)?(?:about\\s+|around\\s+)?(?:only\\s+)?(${quantityPattern})(?:\\s+whole)?\\s*(?:of\\s+)?(?:a\\s+|an\\s+)?(${unitPattern})?\\b`),
  );

  if (!match) {
    return null;
  }

  const rawQuantity = match[1] ?? '1';
  const unit = normalizeQuantityUnit(match[2]);
  if ((rawQuantity === 'a' || rawQuantity === 'an') && !unit) {
    return null;
  }

  return {
    quantity: parseCount(rawQuantity),
    unit,
  };
}

function parseLeadingServingFood(message: string) {
  const normalized = stripCorrectionLeadIn(stripConversationalLeadIn(stripEmotionalPreface(message).toLowerCase()));
  const quantityWords = 'a half|half|three quarters?|a quarter|quarter|a|an|one|two|three|four|five|six|seven|eight|nine|ten';
  const quantityPattern = `\\d+(?:\\.\\d+)?|\\.\\d+|${quantityWords}`;
  const unitPattern = 'cups?|grams?|g|oz|ounces?|tbsp|tablespoons?|tsp|teaspoons?|slices?|pieces?|servings?|cakes?|eggs?|bottles?|cans?|scoops?|bowls?|bars?|muffins?|burgers?';
  const match = normalized.match(
    new RegExp(`^(?:i\\s+)?(?:(?:just\\s+|only\\s+)?(?:had|ate|drank|logged)\\s+)?(?:about\\s+|around\\s+)?(${quantityPattern})(?:\\s+whole)?\\s*(?:of\\s+)?(?:a\\s+|an\\s+)?(${unitPattern})\\s+(?:of\\s+)?(.+)$`, 'i'),
  );

  if (!match) {
    return null;
  }

  const foodText = cleanMealMutationFoodText(match[3] ?? '');
  if (!foodText) {
    return null;
  }

  return {
    quantity: parseCount(match[1] ?? '1'),
    unit: normalizeQuantityUnit(match[2]),
    foodText,
  };
}

function buildItemLookupText(item: MealAssistantItem) {
  const prefix = item.quantity > 1 ? `${item.quantity} ` : item.quantity === 1 ? '1 ' : '';
  const brand = item.brand?.trim() ? `${item.brand.trim()} ` : '';
  const modifiers = item.modifiers.length ? `${item.modifiers.join(' ')} ` : '';
  const unit = item.unit?.trim() ? ` ${item.unit.trim()}` : '';
  return `${prefix}${brand}${modifiers}${item.name}${unit}`.replace(/\s+/g, ' ').trim();
}

function buildMealTextFromItems(items: ParsedFoodItem[]) {
  return items.map((item) => formatParsedItemLabel(item)).join(', ');
}

function buildHumanFoodNameFromAssistantItem(item: MealAssistantItem) {
  const brand = item.brand?.trim() ? `${item.brand.trim()} ` : '';
  const modifiers = item.modifiers.length ? `${item.modifiers.join(' ')} ` : '';
  return `${brand}${modifiers}${item.name}`
    .replace(/\bundefined\b/gi, '')
    .replace(/\bnull\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasStrongFoodSignal(text: string) {
  return strongFoodSignalRegex.test(normalizeKnownFoodTypos(text.toLowerCase()));
}

const broadReviewableFoodSignalRegex = /\b(?:applebee'?s?|bdubs|buffalo wild wings|ihop|jimmy john'?s?|olive garden|papa john'?s?|qdoba|texas roadhouse|waffle house|wingstop|cheetos?|doritos?|lays|lay s|oreo|oreos|pepsi|coke|gatorade|celsius|red bull|monster|nature valley|kind bar|clif|goldfish|ritz|crackers?|berries|asparagus|green beans|corn|beans|burrito|wrap|sub|wings?|breadsticks?|yogurt|smoothie|salad|breakfast sandwich|bagel|pancakes?|waffles?|omelettes?|omelets?|hash browns?|breadsticks?|spaghetti|marinara|ranch|dressing|ground beef|turkey|tuna)\b/i;

function hasReviewableFoodSignal(text: string) {
  const normalized = normalizeKnownFoodTypos(text.toLowerCase());
  return hasStrongFoodSignal(normalized) || messageHasRestaurantCue(normalized) || broadReviewableFoodSignalRegex.test(normalized);
}

function stripConversationalLeadIn(text: string) {
  return text
    .trim()
    .replace(/^(?:okay|ok|yep|yeah|alright|cool|nice|sure|so|wait|anyway)[\s,!.-]+/i, '')
    .trim();
}

function hasFoodAfterConversationalLeadIn(message: string) {
  const normalized = stripEmotionalPreface(message).toLowerCase();
  const stripped = stripConversationalLeadIn(normalized);
  return stripped !== normalized && hasStrongFoodSignal(stripped);
}

function isNonFoodDialogueMessage(message: string) {
  const normalized = stripEmotionalPreface(message).toLowerCase();
  if (hasFoodAfterConversationalLeadIn(message)) {
    return false;
  }

  if (/\b(?:barely ate|barely eaten|didn'?t eat much|haven'?t eaten much)\b/i.test(normalized)) {
    return true;
  }

  return (
    recommendationRegex.test(normalized) ||
    lighterVersionRegex.test(normalized) ||
    sweetHealthyRegex.test(normalized) ||
    healthyTreatRegex.test(normalized) ||
    followUpMacroRegex.test(normalized) ||
    calorieLeftRegex.test(normalized) ||
    proteinLeftRegex.test(normalized) ||
    onTrackRegex.test(normalized) ||
    comparisonRegex.test(normalized) ||
    weeklySummaryRegex.test(normalized) ||
    snackRoomRegex.test(normalized) ||
    nothingYetRegex.test(normalized) ||
    alreadySentFoodRegex.test(normalized) ||
    confusionComplaintRegex.test(normalized) ||
    negativeFeedbackRegex.test(normalized) ||
    casualRegex.test(normalized) ||
    offTopicRegex.test(normalized) ||
    jokeRequestRegex.test(normalized) ||
    (isQuestionLikeText(normalized) && !hasStrongFoodSignal(normalized))
  );
}

function isFoodReplacementClarification(message: string, state: MealAssistantState) {
  if (!state.currentMealItems.length) {
    return false;
  }

  const normalized = stripEmotionalPreface(message).toLowerCase();
  const hasReplacementCue =
    correctionCueRegex.test(normalized) ||
    /\b(?:meant|actually|instead)\b/i.test(normalized);

  if (!hasReplacementCue || !hasStrongFoodSignal(normalized)) {
    return false;
  }

  const currentText = itemTextForCoverage(state.currentMealItems);
  const relevantTokens = normalizeText(normalized)
    .split(' ')
    .filter((token) => token.length > 2)
    .filter((token) => !['actually', 'meant', 'instead', 'that', 'this', 'pack', 'packet', 'package'].includes(token));

  return relevantTokens.some((token) => !currentText.includes(token));
}

function hasAffirmativeSaveCommand(message: string) {
  const trimmed = message.trim();
  return !/\?$/.test(trimmed) && saveRegex.test(message) && !negatedSaveRegex.test(message) && !saveQuestionRegex.test(trimmed);
}

function isSaveReviewQuestion(message: string) {
  const trimmed = message.trim();
  const normalized = normalizeFoodText(stripEmotionalPreface(message));
  return saveQuestionRegex.test(normalized)
    || (/\?$/.test(trimmed) && saveRegex.test(normalized) && !negatedSaveRegex.test(normalized));
}

function isBareSaveCommand(message: string, hasMealState = false) {
  if (isSaveReviewQuestion(message)) {
    return false;
  }

  const normalized = normalizeFoodText(stripEmotionalPreface(message))
    .replace(/^please\s+/, '')
    .replace(/\s+please$/, '')
    .trim();

  if (hasMealState && /^(?:yes|yep|yeah)$/.test(normalized)) {
    return true;
  }

  if (!hasAffirmativeSaveCommand(normalized)) {
    return false;
  }

  return /^(?:save|log|confirm)(?:\s+(?:it|that|this|meal|entry|this meal|that meal))?$/.test(normalized)
    || /^(?:looks good|done)$/.test(normalized)
    || /^(?:yes|yep|yeah|ok|okay|sure)\s+(?:save|log|confirm)(?:\s+(?:it|that|this|meal|entry|this meal|that meal))?$/.test(normalized);
}

function isRecentSavedMealUndoCommand(message: string) {
  const normalized = normalizeFoodText(stripEmotionalPreface(message));
  return /^(?:delete|remove|discard|undo|clear)\s+(?:that|it|this|last|last meal)(?:\s+(?:nvm|nevermind|never mind))?$/.test(normalized)
    || /^(?:nvm|nevermind|never mind)\s+(?:delete|remove|discard|undo|clear)\s+(?:that|it|this|last|last meal)$/.test(normalized);
}

function isSoftCancelKeepMessage(message: string) {
  return /^(?:nvm|nevermind|never mind|undo(?: that| it)?|go back)[.! ]*$/i.test(message.trim());
}

function extractExplicitFoodLogCommand(message: string) {
  const trimmed = message.trim().replace(/[.?!]+$/g, '');
  const colonMatch = trimmed.match(/^(?:log|add|repeat)\s+(?:this|that|it|meal)?\s*(?:again)?\s*:\s*(.+)$/i);
  const inlineMatch = trimmed.match(/^(?:log|add)\s+(?:this|that|it|meal)?\s*(?:again)?\s+(.+)$/i);
  const foodText = (colonMatch?.[1] ?? inlineMatch?.[1] ?? '').trim();

  if (!foodText || /^(?:it|that|this|meal)$/i.test(foodText)) {
    return null;
  }

  return hasStrongFoodSignal(normalizeFoodText(foodText)) ? foodText : null;
}

function isRecommendationRequestMessage(message: string) {
  const normalized = stripEmotionalPreface(message).toLowerCase();
  return (
    recommendationRegex.test(normalized) ||
    dinnerSuggestionRegex.test(normalized) ||
    snackSuggestionRegex.test(normalized) ||
    lighterVersionRegex.test(normalized) ||
    sweetHealthyRegex.test(normalized) ||
    healthyTreatRegex.test(normalized)
  );
}

function isRecommendationFollowUpMessage(message: string, state: MealAssistantState) {
  const normalized = stripEmotionalPreface(message).toLowerCase().trim();

  if (state.activeTopic !== 'recommendation' && state.previousIntent !== 'recommendation_request') {
    return false;
  }

  if (hasStrongFoodSignal(normalized) || correctionCueRegex.test(normalized) || hasAffirmativeSaveCommand(normalized)) {
    return false;
  }

  return recommendationFollowUpRegex.test(normalized) || /^what about\b/i.test(normalized);
}

function shouldAppendToCurrentMeal(message: string, state: MealAssistantState) {
  if (!state.currentMealItems.length) {
    return false;
  }

  const normalized = stripCorrectionLeadIn(stripEmotionalPreface(message)).toLowerCase().trim();
  const savedMealAppend = state.saved && /^(?:wait|actually|oh|oops|also|and|plus|with|anyway)\b.*\b(?:add|also|with|plus|too|as well)\b/i.test(normalized);
  return (
    savedMealAppend
    ||
    continuationRegex.test(normalized)
    || /^(?:add|include|throw in|put in)\b/i.test(normalized)
    || /\b(?:too|as well)\b/i.test(normalized)
    || /\b(?:another|one more)\b/i.test(normalized)
  );
}

function inferActionFromIntent(intent: MealAssistantModelOutput['intent']): MealAssistantAction {
  switch (intent) {
    case 'new_food_item':
    case 'add_to_current_meal':
    case 'repeat_meal':
    case 'clarification_answer':
      return 'add_food';
    case 'quantity_change':
      return 'update_item_quantity';
    case 'correction':
    case 'edit_command':
      return 'update_item_name';
    case 'remove_item':
    case 'delete_command':
      return 'remove_item';
    case 'recommendation_request':
      return 'recommend_food';
    case 'save_meal':
      return 'save_meal';
    case 'greeting':
    case 'casual_message':
      return 'casual_reply';
    case 'complaint_repair':
      return 'complaint_repair';
    case 'nutrition_question':
    case 'nutrition_guidance':
    case 'macro_question':
    case 'meal_feedback':
    case 'meal_review':
    case 'comparison_question':
    case 'goal_question':
      return 'answer_question';
    default:
      return 'unclear';
  }
}

function buildActiveItemId(item: ParsedFoodItem, index: number) {
  return `${index}:${item.food_name.trim().toLowerCase()}`;
}

function resolveDecisionTargetIndex(decision: MealAssistantModelOutput, state: MealAssistantState, message?: string) {
  if (!state.currentMealItems.length) {
    return -1;
  }

  if (typeof decision.target_item_index === 'number' && state.currentMealItems[decision.target_item_index]) {
    return decision.target_item_index;
  }

  if (decision.target_item_id) {
    const idIndex = state.currentMealItems.findIndex((item, index) => buildActiveItemId(item, index) === decision.target_item_id);
    if (idIndex >= 0) {
      return idIndex;
    }
  }

  if (decision.target_item) {
    const namedIndex = findItemIndex(state.currentMealItems, decision.target_item);
    if (namedIndex >= 0) {
      return namedIndex;
    }
  }

  return message ? findContextualItemIndex(message, state.currentMealItems) : state.currentMealItems.length - 1;
}

function isMutatingOperationAction(action: MealAssistantAction) {
  return action === 'add_food' || action === 'update_item_quantity' || action === 'update_item_name' || action === 'remove_item';
}

function buildItemTargetHints(item: ParsedFoodItem) {
  const hints = new Set<string>();
  const normalizedName = normalizeText(item.food_name);
  const normalizedUnit = normalizeQuantityUnit(item.unit) ?? '';

  normalizedName.split(' ').filter(Boolean).forEach((token) => {
    if (token.length >= 3) {
      hints.add(token);
    }
  });

  if (normalizedUnit) {
    hints.add(normalizedUnit);
    if (!normalizedUnit.endsWith('s')) {
      hints.add(`${normalizedUnit}s`);
    }
  }

  if (/mcdouble|burger/i.test(item.food_name)) {
    hints.add('burger');
    hints.add('burgers');
  }

  if (/fr(?:y|ies)/i.test(item.food_name)) {
    hints.add('fry');
    hints.add('fries');
  }

  if (/egg/i.test(item.food_name)) {
    hints.add('egg');
    hints.add('eggs');
  }

  if (/shake|fairlife/i.test(item.food_name)) {
    hints.add('shake');
    hints.add('shakes');
    hints.add('bottle');
    hints.add('bottles');
  }

  if (/cereal|cinnamon toast crunch/i.test(item.food_name)) {
    hints.add('cereal');
    hints.add('bowls');
    hints.add('bowl');
  }

  if (/muffin/i.test(item.food_name)) {
    hints.add('muffin');
    hints.add('muffins');
  }

  if (/potatoes|potato/i.test(item.food_name)) {
    hints.add('potato');
    hints.add('potatoes');
  }

  if (/pizza/i.test(item.food_name)) {
    hints.add('pizza');
    hints.add('slice');
    hints.add('slices');
  }

  if (/guac|guacamole/i.test(item.food_name)) {
    hints.add('guac');
    hints.add('guacamole');
  }

  if (/chipotle|bowl/i.test(item.food_name)) {
    hints.add('chipotle');
    hints.add('bowl');
    hints.add('bowls');
  }

  return [...hints];
}

function findOperationTargetIndexByHint(text: string, items: ParsedFoodItem[]) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) {
    return -1;
  }

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item) {
      continue;
    }

    const normalizedName = normalizeText(item.food_name);
    if (normalizedText.includes(normalizedName)) {
      return index;
    }

    const hints = buildItemTargetHints(item);
    if (hints.some((hint) => normalizedText.includes(hint))) {
      return index;
    }
  }

  return -1;
}

function resolveOperationTargetIndex(operation: NormalizedMealAssistantOperation, items: ParsedFoodItem[], message?: string) {
  if (!items.length) {
    return -1;
  }

  if (typeof operation.target_item_index === 'number' && items[operation.target_item_index]) {
    return operation.target_item_index;
  }

  if (operation.target_item_id) {
    const byId = items.findIndex((item, index) => buildActiveItemId(item, index) === operation.target_item_id);
    if (byId >= 0) {
      return byId;
    }
  }

  if (operation.target_item) {
    const byTarget = findOperationTargetIndexByHint(operation.target_item, items);
    if (byTarget >= 0) {
      return byTarget;
    }
  }

  const firstItemName = operation.items[0] ? buildHumanFoodNameFromAssistantItem(operation.items[0]) : '';
  if (firstItemName) {
    const byItem = findOperationTargetIndexByHint(firstItemName, items);
    if (byItem >= 0) {
      return byItem;
    }
  }

  if (message) {
    const byMessage = findOperationTargetIndexByHint(message, items);
    if (byMessage >= 0) {
      return byMessage;
    }
  }

  return items.length - 1;
}

function normalizeAssistantOperation(args: {
  operation?: MealAssistantOperation | null;
  decision: MealAssistantModelOutput;
}): NormalizedMealAssistantOperation {
  const { operation, decision } = args;
  const fallbackAction = operation?.action ?? decision.action ?? inferActionFromIntent(decision.intent);
  const baseItems = operation?.items ?? decision.items ?? [];

  return {
    action: fallbackAction,
    target_item: operation?.target_item ?? decision.target_item ?? null,
    target_item_id: operation?.target_item_id ?? decision.target_item_id ?? null,
    target_item_index: operation?.target_item_index ?? decision.target_item_index ?? null,
    items: baseItems,
    should_lookup_nutrition: operation?.should_lookup_nutrition
      ?? (((fallbackAction === 'add_food' || fallbackAction === 'update_item_name') && baseItems.length > 0)),
    should_save_meal: operation?.should_save_meal ?? (fallbackAction === 'save_meal' || decision.should_save_meal),
  };
}

function normalizeDecisionOperations(decision: MealAssistantModelOutput) {
  const rawOperations = decision.operations?.length
    ? decision.operations
    : [null];

  const operations = rawOperations
    .map((operation) => normalizeAssistantOperation({ operation, decision }))
    .filter((operation) => operation.action !== 'unclear' || operation.items.length || operation.should_save_meal);

  return operations;
}

function splitCompoundEditClauses(message: string) {
  const cleaned = stripEmotionalPreface(message)
    .replace(/,/g, ' and ')
    .replace(/\s+\+\s+/g, ' and ')
    .replace(/\s+plus\s+/gi, ' and ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.split(/\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
}

function getNormalizedMutationClause(clause: string) {
  return stripCorrectionLeadIn(stripConversationalLeadIn(stripEmotionalPreface(clause).toLowerCase())).trim();
}

function extractQuantityTargetText(clause: string) {
  const normalized = getNormalizedMutationClause(clause);
  const match = normalized.match(/^(?:actually\s+)?(?:make|change|update)\s+(?:it|that|this)(?:\s+to)?\s+(?:\d+(?:\.\d+)?|\.\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+(.+)$/i);
  return cleanMealMutationFoodText(match?.[1] ?? '');
}

function parseTargetedQuantityChangeClause(clause: string) {
  const normalized = getNormalizedMutationClause(clause)
    .replace(/^the\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const quantityPattern = '\\d+(?:\\.\\d+)?|\\.\\d+|a half|half|three quarters?|a quarter|quarter|a|an|one|two|three|four|five|six|seven|eight|nine|ten';
  const unitPattern = 'cups?|grams?|g|oz|ounces?|tbsp|tablespoons?|tsp|teaspoons?|slices?|pieces?|servings?|cakes?|eggs?|bottles?|cans?|scoops?|bowls?|bars?|muffins?|burgers?';
  const patterns = [
    new RegExp(`^(?:make|change|update)\\s+(?:the\\s+)?(.+?)\\s+(?:to\\s+)?(${quantityPattern})(?:\\s+whole)?\\s*(?:of\\s+)?(?:a\\s+|an\\s+)?(${unitPattern})?\\b`, 'i'),
    new RegExp(`^(?:the\\s+)?(.+?)\\s+(?:to|was|is)\\s+(${quantityPattern})(?:\\s+whole)?\\s*(?:of\\s+)?(?:a\\s+|an\\s+)?(${unitPattern})?\\b`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }

    const targetText = cleanMealMutationFoodText(match[1] ?? '');
    const quantityText = match[2] ?? '';
    const unit = normalizeQuantityUnit(match[3]);
    if (!targetText || /^(?:it|that|this)$/i.test(targetText) || !quantityText) {
      continue;
    }

    return {
      targetText,
      quantity: parseCount(quantityText),
      unit,
    };
  }

  return null;
}

function parseTargetedDoubleClause(clause: string) {
  const normalized = getNormalizedMutationClause(clause)
    .replace(/^the\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const match =
    normalized.match(/^(?:make|change|update)\s+(?:the\s+)?(.+?)\s+(?:double|twice|2x)$/i)
    ?? normalized.match(/^(?:double)\s+(?:the\s+)?(.+)$/i);

  if (!match) {
    return null;
  }

  const targetText = cleanMealMutationFoodText(match[1] ?? '');
  return targetText && !/^(?:it|that|this)$/i.test(targetText) ? targetText : null;
}

function extractRemoveTargetFromMessage(message: string) {
  const normalized = stripEmotionalPreface(message).toLowerCase();
  const normalizedClause = getNormalizedMutationClause(message);
  const noRemoveMatch = normalized.match(/^no\s+remove\s+(?:the\s+)?(.+)$/i) ?? normalizedClause.match(/^no\s+remove\s+(?:the\s+)?(.+)$/i);
  if (noRemoveMatch) {
    return cleanMealMutationFoodText(noRemoveMatch[1] ?? '');
  }
  if (/\bnot\b/.test(normalizedClause) || /\b(?:go back|back to|lets go|let's go)\b/.test(normalizedClause)) {
    return null;
  }

  const removeMatch = normalized.match(removeRegex) ?? normalizedClause.match(removeRegex);
  const removeTarget = cleanMealMutationFoodText(removeMatch?.[1] ?? removeMatch?.[2] ?? '');

  if (removeTarget && hasStrongFoodSignal(removeTarget)) {
    return removeTarget;
  }

  const noTargetMatch = normalizedClause.match(/^no\s+(.+)$/i);
  const noTarget = cleanMealMutationFoodText(noTargetMatch?.[1] ?? '').replace(/\bguac\b/gi, 'guacamole');
  return noTarget && hasStrongFoodSignal(noTarget) ? noTarget : null;
}

function extractHeuristicMutationOperations(message: string, state: MealAssistantState): NormalizedMealAssistantOperation[] {
  if (!state.currentMealItems.length || state.saved) {
    return [];
  }

  const clauses = splitCompoundEditClauses(message);

  const operations: NormalizedMealAssistantOperation[] = [];

  for (const clause of clauses) {
    const normalizedClause = getNormalizedMutationClause(clause);

    if (hasAffirmativeSaveCommand(normalizedClause)) {
      operations.push({
        action: 'save_meal',
        target_item: null,
        target_item_id: null,
        target_item_index: null,
        items: [],
        should_lookup_nutrition: false,
        should_save_meal: true,
      });
      continue;
    }

    const removeTarget = extractRemoveTargetFromMessage(clause);
    if (removeTarget) {
      operations.push({
        action: 'remove_item',
        target_item: removeTarget,
        target_item_id: null,
        target_item_index: null,
        items: [{ name: removeTarget, brand: null, quantity: 1, unit: null, modifiers: [], action: 'remove' }],
        should_lookup_nutrition: false,
        should_save_meal: false,
      });
      continue;
    }

    const targetedDouble = parseTargetedDoubleClause(clause);
    if (targetedDouble) {
      const targetIndex = findOperationTargetIndexByHint(targetedDouble, state.currentMealItems);
      const targetItem = state.currentMealItems[targetIndex] ?? state.currentMealItems.at(-1) ?? null;
      if (targetItem) {
        if (/\bchicken\b/i.test(targetedDouble) && /chipotle|bowl/i.test(targetItem.food_name)) {
          operations.push({
            action: 'update_item_name',
            target_item: targetItem.food_name,
            target_item_id: buildActiveItemId(targetItem, targetIndex >= 0 ? targetIndex : state.currentMealItems.length - 1),
            target_item_index: targetIndex >= 0 ? targetIndex : state.currentMealItems.length - 1,
            items: [{ name: targetItem.food_name, brand: 'Chipotle', quantity: targetItem.quantity, unit: targetItem.unit ?? null, modifiers: ['double chicken'], action: 'replace' }],
            should_lookup_nutrition: false,
            should_save_meal: false,
          });
          continue;
        }

        operations.push({
          action: 'update_item_quantity',
          target_item: targetItem.food_name,
          target_item_id: buildActiveItemId(targetItem, targetIndex >= 0 ? targetIndex : state.currentMealItems.length - 1),
          target_item_index: targetIndex >= 0 ? targetIndex : state.currentMealItems.length - 1,
          items: [{
            name: targetItem.food_name,
            brand: null,
            quantity: targetItem.quantity * 2,
            unit: targetItem.unit ?? null,
            modifiers: [],
            action: 'update',
          }],
          should_lookup_nutrition: false,
          should_save_meal: false,
        });
        continue;
      }
    }

    const addFoodText = extractAddCommandFoodText(clause);
    if (addFoodText) {
      operations.push({
        action: 'add_food',
        target_item: null,
        target_item_id: null,
        target_item_index: null,
        items: [{ name: addFoodText, brand: null, quantity: 1, unit: null, modifiers: [], action: 'add' }],
        should_lookup_nutrition: true,
        should_save_meal: false,
      });
      continue;
    }

    const targetedQuantityChange = parseTargetedQuantityChangeClause(clause);
    if (targetedQuantityChange) {
      const targetIndex = findOperationTargetIndexByHint(targetedQuantityChange.targetText, state.currentMealItems);
      const targetItem = state.currentMealItems[targetIndex] ?? state.currentMealItems.at(-1) ?? null;
      if (targetItem) {
        operations.push({
          action: 'update_item_quantity',
          target_item: targetItem.food_name,
          target_item_id: buildActiveItemId(targetItem, targetIndex >= 0 ? targetIndex : state.currentMealItems.length - 1),
          target_item_index: targetIndex >= 0 ? targetIndex : state.currentMealItems.length - 1,
          items: [{
            name: targetItem.food_name,
            brand: null,
            quantity: targetedQuantityChange.quantity,
            unit: targetedQuantityChange.unit ?? targetItem.unit ?? null,
            modifiers: [],
            action: 'update',
          }],
          should_lookup_nutrition: false,
          should_save_meal: false,
        });
        continue;
      }
    }

    const correctedServing = parseCorrectedServing(clause);
    if (correctedServing) {
      const targetHint = extractQuantityTargetText(clause);
      const targetIndex = targetHint ? findOperationTargetIndexByHint(targetHint, state.currentMealItems) : state.currentMealItems.length - 1;
      const targetItem = state.currentMealItems[targetIndex] ?? state.currentMealItems.at(-1) ?? null;
      if (targetItem) {
        operations.push({
          action: 'update_item_quantity',
          target_item: targetItem.food_name,
          target_item_id: buildActiveItemId(targetItem, targetIndex >= 0 ? targetIndex : state.currentMealItems.length - 1),
          target_item_index: targetIndex >= 0 ? targetIndex : state.currentMealItems.length - 1,
          items: [{
            name: targetItem.food_name,
            brand: null,
            quantity: correctedServing.quantity,
            unit: correctedServing.unit ?? targetItem.unit ?? null,
            modifiers: [],
            action: 'update',
          }],
          should_lookup_nutrition: false,
          should_save_meal: false,
        });
        continue;
      }
    }

    if (/\b(?:make|change|update)\s+(?:the\s+)?chicken\s+(?:double|extra)\b/.test(normalizedClause) && state.currentMealItems.some((item) => /chipotle|bowl/i.test(item.food_name))) {
      const targetIndex = state.currentMealItems.findIndex((item) => /chipotle|bowl/i.test(item.food_name));
      const targetItem = state.currentMealItems[targetIndex] ?? state.currentMealItems.at(-1) ?? null;
      if (targetItem) {
        operations.push({
          action: 'update_item_name',
          target_item: targetItem.food_name,
          target_item_id: buildActiveItemId(targetItem, targetIndex >= 0 ? targetIndex : state.currentMealItems.length - 1),
          target_item_index: targetIndex >= 0 ? targetIndex : state.currentMealItems.length - 1,
          items: [{ name: targetItem.food_name, brand: 'Chipotle', quantity: targetItem.quantity, unit: targetItem.unit ?? null, modifiers: ['double chicken'], action: 'replace' }],
          should_lookup_nutrition: false,
          should_save_meal: false,
        });
        continue;
      }
    }

    if (/\b(?:regular chicken|chicken regular)\b/.test(normalizedClause) && state.currentMealItems.some((item) => /chipotle|bowl/i.test(item.food_name))) {
      const targetIndex = state.currentMealItems.findIndex((item) => /chipotle|bowl/i.test(item.food_name));
      const targetItem = state.currentMealItems[targetIndex] ?? state.currentMealItems.at(-1) ?? null;
      if (targetItem) {
        const replacementName = targetItem.food_name.replace(/\bdouble chicken\b/gi, 'chicken').replace(/\bextra chicken\b/gi, 'chicken');
        operations.push({
          action: 'update_item_name',
          target_item: targetItem.food_name,
          target_item_id: buildActiveItemId(targetItem, targetIndex >= 0 ? targetIndex : state.currentMealItems.length - 1),
          target_item_index: targetIndex >= 0 ? targetIndex : state.currentMealItems.length - 1,
          items: [{ name: replacementName, brand: 'Chipotle', quantity: targetItem.quantity, unit: targetItem.unit ?? null, modifiers: [], action: 'replace' }],
          should_lookup_nutrition: false,
          should_save_meal: false,
        });
        continue;
      }
    }

    const addMatch = normalizedClause.match(/^(?:add|also add)\s+(.+)$/i);
    if (addMatch) {
      const addText = cleanMealMutationFoodText(addMatch[1] ?? '');
      if (addText) {
        operations.push({
          action: 'add_food',
          target_item: null,
          target_item_id: null,
          target_item_index: null,
          items: [{ name: addText, brand: null, quantity: 1, unit: null, modifiers: [], action: 'add' }],
          should_lookup_nutrition: true,
          should_save_meal: false,
        });
        continue;
      }
    }
  }

  if (operations.length && hasAffirmativeSaveCommand(message) && !operations.some((operation) => operation.action === 'save_meal' || operation.should_save_meal)) {
    operations.push({
      action: 'save_meal',
      target_item: null,
      target_item_id: null,
      target_item_index: null,
      items: [],
      should_lookup_nutrition: false,
      should_save_meal: true,
    });
  }

  return operations.length ? operations : [];
}

function joinSummaryParts(parts: string[]) {
  if (!parts.length) {
    return '';
  }

  if (parts.length === 1) {
    return parts[0] ?? '';
  }

  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`;
  }

  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
}

function buildOperationLookupMessage(operation: NormalizedMealAssistantOperation, fallbackMessage: string) {
  const itemText = operation.items
    .map((item) => buildItemLookupText(item))
    .filter(Boolean)
    .join(', ')
    .trim();

  if (itemText) {
    return itemText;
  }

  return operation.target_item?.trim() || fallbackMessage;
}

function buildCompoundOperationReply(args: {
  summaryParts: string[];
  nextItems: ParsedFoodItem[];
  saved: boolean;
  repairTone?: boolean;
  previousReply?: string | null;
}) {
  const summary = joinSummaryParts(args.summaryParts);
  const calories = Math.round(sumTotals(args.nextItems).calories);
  const previousStartedUpdated = /^updated that\b/i.test(args.previousReply ?? '');
  const base = summary
    ? summary.startsWith('changed ')
      ? args.repairTone
        ? `${summary.replace(/^changed /, 'No worries, fixed that - updated that to ')}.`
        : previousStartedUpdated
          ? `${summary.replace(/^changed (.+)$/, '$1 is set now')}.`
          : `${summary.replace(/^changed /, 'Updated that to ')}.`
      : summary.startsWith('removed ')
        ? `${summary.replace(/^removed /, 'Removed ')}.`
        : summary.startsWith('added ')
          ? `${summary.replace(/^added /, 'Added ')}.`
          : `Updated - ${summary}.`
    : 'Updated.';
  const caloriesText = args.nextItems.length ? ` About ${calories} calories total.` : '';
  const savedText = args.saved ? ' Saved it too.' : '';
  return `${base}${caloriesText}${savedText}`.trim();
}

function isUntargetedWholeMealReplacement(message: string, operation: NormalizedMealAssistantOperation) {
  if (operation.target_item || operation.target_item_id || operation.target_item_index !== null) {
    return false;
  }

  const normalized = normalizeFoodText(stripEmotionalPreface(message));
  return /^(?:replace(?:\s+(?:it|that|this|meal|entry))?\s+(?:with|to)|change(?:\s+(?:it|that|this|meal|entry))?\s+to|switch(?:\s+(?:it|that|this|meal|entry))?\s+to)\b/.test(normalized);
}

async function applyDecisionOperations(args: {
  operations: NormalizedMealAssistantOperation[];
  state: MealAssistantState;
  message: string;
  resolveItemNutrition: NutritionResolver;
}): Promise<OperationApplicationResult> {
  const nextItems = cloneParsedItems(args.state.currentMealItems);
  const removedTargets: string[] = [];
  const summaryParts: string[] = [];
  let resolvedItems: ParsedFoodItem[] = [];
  let shouldSaveMeal = false;
  let mutated = false;

  for (const operation of args.operations) {
    if (operation.action === 'save_meal' || operation.should_save_meal) {
      shouldSaveMeal = true;
      continue;
    }

    if (operation.action === 'remove_item') {
      const targetText = [
        operation.target_item,
        buildHumanFoodNameFromAssistantItem(operation.items[0] ?? { name: '', brand: null, quantity: 1, unit: null, modifiers: [], action: 'remove' }),
      ].filter(Boolean).join(' ');
      const chipotleCheeseIndex = /\bcheese\b/i.test(targetText)
        ? nextItems.findIndex((item) => /chipotle|bowl/i.test(item.food_name) && /\bcheese\b/i.test(item.food_name))
        : -1;
      if (chipotleCheeseIndex >= 0) {
        nextItems[chipotleCheeseIndex] = removeChipotleCheese(nextItems[chipotleCheeseIndex]);
        summaryParts.push('removed cheese');
        mutated = true;
        continue;
      }

      const targetIndex = resolveOperationTargetIndex(operation, nextItems, args.message);

      if (targetIndex >= 0) {
        const targetItem = nextItems[targetIndex];
        if (targetItem && /\bcheese\b/i.test(targetText) && /chipotle|bowl/i.test(targetItem.food_name)) {
          nextItems[targetIndex] = removeChipotleCheese(targetItem);
          summaryParts.push('removed cheese');
          mutated = true;
          continue;
        }

        if (targetItem) {
          removedTargets.push(targetItem.food_name);
          summaryParts.push(`removed ${targetItem.food_name}`);
          nextItems.splice(targetIndex, 1);
          mutated = true;
        }
      }
      continue;
    }

    if (operation.action === 'update_item_quantity') {
      const targetIndex = resolveOperationTargetIndex(operation, nextItems, args.message);
      const targetItem = targetIndex >= 0 ? nextItems[targetIndex] : null;
      const nextQuantity = operation.items[0]?.quantity ?? targetItem?.quantity ?? null;

      if (targetItem && nextQuantity && nextQuantity > 0) {
        const updatedItem = scaleParsedItems([targetItem], nextQuantity)[0] ?? targetItem;
        nextItems[targetIndex] = {
          ...updatedItem,
          unit: operation.items[0]?.unit ?? updatedItem.unit,
        };
        summaryParts.push(`changed ${formatParsedItemLabel(nextItems[targetIndex])}`);
        resolvedItems = [nextItems[targetIndex]];
        mutated = true;
      }
      continue;
    }

    if (operation.action === 'update_item_name') {
      const targetIndex = resolveOperationTargetIndex(operation, nextItems, args.message);
      const targetItem = targetIndex >= 0 ? nextItems[targetIndex] : null;
      if (!targetItem) {
        continue;
      }

      let replacementItems: ParsedFoodItem[] = [];
      const replacementText = buildHumanFoodNameFromAssistantItem(operation.items[0] ?? { name: '', brand: null, quantity: 1, unit: null, modifiers: [], action: 'replace' });
      const operationLookupMessage = buildOperationLookupMessage(operation, args.message);
      const operationText = `${replacementText} ${operationLookupMessage} ${operation.items.flatMap((item) => item.modifiers).join(' ')} ${args.message}`;

      if (/chipotle|bowl/i.test(targetItem.food_name) && /\b(?:regular chicken|chicken regular)\b/i.test(operationText)) {
        replacementItems = [regularizeChipotleChicken(targetItem)];
      } else if (/chipotle|bowl/i.test(targetItem.food_name) && /\b(?:double|extra)\s+chicken\b|\bchicken\s+(?:double|extra)\b/i.test(operationText)) {
        replacementItems = [doubleChipotleChicken(targetItem)];
      } else if (operation.should_lookup_nutrition && operation.items.length) {
        replacementItems = await resolveAssistantItems(operation.items, args.state.mealType, args.resolveItemNutrition, operationLookupMessage);
      }

      if (replacementItems.length) {
        const displayReplacementItems = preserveFrySizeCorrectionLabel(replacementItems, args.message, targetItem);
        if (isUntargetedWholeMealReplacement(args.message, operation)) {
          nextItems.splice(0, nextItems.length, ...displayReplacementItems);
        } else {
          nextItems.splice(targetIndex, 1, ...displayReplacementItems);
        }
        resolvedItems = displayReplacementItems;
        summaryParts.push(`switched ${targetItem.food_name} to ${displayReplacementItems.map((item) => formatParsedItemLabel(item)).join(' and ')}`);
        mutated = true;
      }
      continue;
    }

    if (operation.action === 'add_food' && operation.items.length) {
      const operationLookupMessage = buildOperationLookupMessage(operation, args.message);
      const addedItems = operation.should_lookup_nutrition
        ? await resolveAssistantItems(operation.items, args.state.mealType, args.resolveItemNutrition, operationLookupMessage)
        : [];

      if (addedItems.length) {
        nextItems.push(...addedItems);
        resolvedItems = addedItems;
        summaryParts.push(`added ${addedItems.map((item) => item.food_name).join(' and ')}`);
        mutated = true;
      }
    }
  }

  return {
    nextItems,
    removedTargets,
    summaryParts,
    resolvedItems,
    shouldSaveMeal,
    mutated,
  };
}

function normalizeAssistantDecision(decision: MealAssistantModelOutput, input: MealAssistantRunInput): MealAssistantModelOutput {
  const state = input.state;
  const hasActiveMeal = state.currentMealItems.length > 0 && !state.saved;
  const rawNormalizedMessage = stripEmotionalPreface(input.message).toLowerCase();
  const normalizedMessage = stripCorrectionLeadIn(stripEmotionalPreface(input.message)).toLowerCase();
  const correctedServing = parseCorrectedServing(input.message);
  const fallbackAction = inferActionFromIntent(decision.intent);
  let nextDecision: MealAssistantModelOutput = {
    ...decision,
    action: decision.action ?? fallbackAction,
    target_item: decision.target_item ?? null,
    target_item_id: decision.target_item_id ?? null,
    target_item_index: decision.target_item_index ?? null,
  };

  const normalizedOperations = normalizeDecisionOperations(nextDecision);
  if ((decision.operations?.length ?? 0) > 0 || normalizedOperations.length > 1) {
    nextDecision.operations = normalizedOperations;
    if (normalizedOperations.length > 1 && normalizedOperations.some((operation) => isMutatingOperationAction(operation.action) || operation.should_save_meal)) {
      nextDecision.intent = 'correction';
      nextDecision.action = normalizedOperations[0]?.action ?? nextDecision.action;
      nextDecision.should_save_meal = normalizedOperations.some((operation) => operation.should_save_meal);
      nextDecision.should_lookup_nutrition = normalizedOperations.some((operation) => operation.should_lookup_nutrition);
      nextDecision.should_mutate_pending_meal = normalizedOperations.some((operation) => isMutatingOperationAction(operation.action));
    }
  }

  if (nextDecision.action === 'unclear') {
    nextDecision.action = fallbackAction;
  }

  if (hasActiveMeal && correctedServing && (correctionCueRegex.test(rawNormalizedMessage) || correctionCueRegex.test(normalizedMessage) || quantityOnlyRegex.test(normalizedMessage) || directQuantityRegex.test(normalizedMessage))) {
    const targetIndex = resolveDecisionTargetIndex(nextDecision, state, input.message);
    const targetItem = targetIndex >= 0 ? state.currentMealItems[targetIndex] : state.currentMealItems.at(-1) ?? null;

    if (targetItem) {
      nextDecision = {
        ...nextDecision,
        action: 'update_item_quantity',
        intent: 'quantity_change',
        target_item: targetItem.food_name,
        target_item_id: buildActiveItemId(targetItem, targetIndex >= 0 ? targetIndex : state.currentMealItems.length - 1),
        target_item_index: targetIndex >= 0 ? targetIndex : state.currentMealItems.length - 1,
        contains_food_to_log: false,
        contains_quantity_update: true,
        should_mutate_pending_meal: true,
        should_lookup_nutrition: false,
        should_ask_clarification: false,
        clarification_question: null,
        items: [
          {
            name: targetItem.food_name,
            brand: null,
            quantity: correctedServing.quantity,
            unit: correctedServing.unit ?? targetItem.unit ?? null,
            modifiers: [],
            action: 'update',
          },
        ],
        corrections: [{ target: targetItem.food_name, change: input.message }],
      };
    }
  }

  if (nextDecision.action === 'update_item_quantity') {
    return {
      ...nextDecision,
      intent: 'quantity_change',
      action: 'update_item_quantity',
      contains_food_to_log: false,
      contains_quantity_update: true,
      should_mutate_pending_meal: true,
      should_lookup_nutrition: false,
      should_ask_clarification: false,
      clarification_question: null,
    };
  }

  if (nextDecision.action === 'remove_item' && hasActiveMeal) {
    return {
      ...nextDecision,
      intent: 'correction',
      action: 'remove_item',
      contains_food_to_log: false,
      should_mutate_pending_meal: true,
      should_lookup_nutrition: false,
      should_ask_clarification: false,
      clarification_question: null,
    };
  }

  if (nextDecision.action === 'recommend_food') {
    return {
      ...nextDecision,
      intent: 'recommendation_request',
      items: [],
      contains_food_to_log: false,
      contains_quantity_update: false,
      should_mutate_pending_meal: false,
      should_lookup_nutrition: false,
      should_ask_clarification: false,
      clarification_question: null,
    };
  }

  if (nextDecision.action === 'answer_question') {
    return {
      ...nextDecision,
      items: [],
      contains_food_to_log: false,
      contains_quantity_update: false,
      should_mutate_pending_meal: false,
      should_lookup_nutrition: false,
      should_ask_clarification: false,
      clarification_question: null,
    };
  }

  if (nextDecision.action === 'complaint_repair') {
    return {
      ...nextDecision,
      intent: 'complaint_repair',
      items: [],
      operations: [],
      contains_food_to_log: false,
      contains_quantity_update: false,
      should_mutate_pending_meal: false,
      should_lookup_nutrition: false,
      should_ask_clarification: false,
      clarification_question: null,
    };
  }

  if (nextDecision.action === 'casual_reply') {
    return {
      ...nextDecision,
      intent: nextDecision.intent === 'greeting' ? 'greeting' : 'casual_message',
      items: [],
      contains_food_to_log: false,
      contains_quantity_update: false,
      should_mutate_pending_meal: false,
      should_lookup_nutrition: false,
      should_ask_clarification: false,
      clarification_question: null,
    };
  }

  if (nextDecision.action === 'save_meal' && isSaveReviewQuestion(input.message)) {
    return {
      ...nextDecision,
      intent: 'meal_review',
      action: 'answer_question',
      items: [],
      contains_food_to_log: false,
      contains_quantity_update: false,
      should_mutate_pending_meal: false,
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
    };
  }

  if (nextDecision.action === 'save_meal') {
    return {
      ...nextDecision,
      intent: 'save_meal',
      items: [],
      contains_food_to_log: false,
      contains_quantity_update: false,
      should_mutate_pending_meal: false,
      should_lookup_nutrition: false,
      should_save_meal: true,
      should_ask_clarification: false,
      clarification_question: null,
    };
  }

  if (nextDecision.action === 'add_food') {
    const nextIntent = shouldAppendToCurrentMeal(input.message, state) ? 'add_to_current_meal' : nextDecision.intent === 'repeat_meal' ? 'repeat_meal' : 'new_food_item';
    return {
      ...nextDecision,
      intent: nextIntent,
      contains_food_to_log: nextDecision.items.length > 0,
      contains_quantity_update: false,
      should_mutate_pending_meal: nextDecision.items.length > 0,
      should_lookup_nutrition: nextDecision.items.length > 0,
    };
  }

  return nextDecision;
}
function isNonMutatingIntent(intent: MealAssistantModelOutput['intent']) {
  return (
    intent === 'recommendation_request' ||
    intent === 'nutrition_guidance' ||
    intent === 'nutrition_question' ||
    intent === 'macro_question' ||
    intent === 'goal_question' ||
    intent === 'comparison_question' ||
    intent === 'meal_feedback' ||
    intent === 'complaint_repair' ||
    intent === 'meal_review' ||
    intent === 'casual_message' ||
    intent === 'greeting' ||
    intent === 'unknown'
  );
}

function shouldLookupNutritionForDecision(decision: MealAssistantModelOutput, message: string) {
  if (!decision.should_lookup_nutrition) {
    return false;
  }

  if (decision.contains_food_to_log === false || decision.should_mutate_pending_meal === false) {
    return false;
  }

  if (isNonMutatingIntent(decision.intent) || isNonFoodDialogueMessage(message)) {
    return false;
  }

  return decision.items.length > 0;
}

function looksLikeRawConversationalFoodText(foodText: string, message: string) {
  const normalizedFood = normalizeFoodText(foodText);
  const normalizedMessage = normalizeFoodText(message);

  if (!normalizedFood) {
    return true;
  }

  if (isNonFoodDialogueMessage(message)) {
    return true;
  }

  if (normalizedFood === normalizedMessage && discourseFoodBlockerRegex.test(message)) {
    return true;
  }

  if (correctionCueRegex.test(normalizedFood) || /^(?:what|how|why|when|where|who|should|would|can|do|did)\b/.test(normalizedFood)) {
    return true;
  }

  const tokenCount = normalizedFood.split(/\s+/).filter(Boolean).length;
  return tokenCount > 8 && discourseFoodBlockerRegex.test(normalizedFood);
}

function isUnsafeLookupItem(item: MealAssistantItem, message: string) {
  const foodText = buildHumanFoodNameFromAssistantItem(item);
  return looksLikeRawConversationalFoodText(foodText, message);
}
function buildPizzaSliceEstimate(item: MealAssistantItem): ParsedFoodItem {
  const quantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
  const perSlice = {
    calories: 285,
    protein: 12,
    carbs: 36,
    fat: 10,
    fiber: 2,
    sugar: 3,
    sodium: 640,
  };

  return {
    food_name: 'slices of pizza',
    quantity,
    unit: quantity === 1 ? 'slice' : 'slices',
    calories: Math.round(perSlice.calories * quantity),
    protein: Math.round(perSlice.protein * quantity),
    carbs: Math.round(perSlice.carbs * quantity),
    fat: Math.round(perSlice.fat * quantity),
    fiber: Math.round(perSlice.fiber * quantity),
    sugar: Math.round(perSlice.sugar * quantity),
    sodium: Math.round(perSlice.sodium * quantity),
    notes: 'Generic pizza estimate based on standard cheese/pepperoni-style slices; exact calories can vary by size, crust, and toppings.',
    is_trusted: false,
    source_type: 'AI_ESTIMATE',
    source_name: 'Calorie Compass generic pizza estimate',
    confidence_label: 'Estimated',
    matched_query: buildItemLookupText(item),
    original_user_text: buildItemLookupText(item),
    provider_used: null,
    used_ai_fallback: true,
    catalog_food_id: null,
  };
}

function buildCottageCheeseServingEstimate(item: MealAssistantItem, lookupText: string): ParsedFoodItem {
  const unit = normalizeQuantityUnit(item.unit) ?? 'cup';
  const quantity = item.quantity > 0 ? item.quantity : unit === 'g' ? 113 : 0.5;
  const multiplier = unit === 'g' ? quantity / 113 : unit === 'cup' ? quantity / 0.5 : quantity;

  return makeGenericEstimate(
    {
      key: 'cottage cheese',
      label: 'Cottage cheese',
      quantity,
      unit,
      calories: 90 * multiplier,
      protein: 13 * multiplier,
      carbs: 4 * multiplier,
      fat: 5 * multiplier,
      sugar: 3 * multiplier,
      sodium: 350 * multiplier,
      sourceName: 'Cottage cheese common serving estimate',
      sourceType: 'GENERIC_REFERENCE',
      notes: 'Kept the cottage cheese identity instead of accepting an unrelated provider match.',
    },
    lookupText,
  );
}


function buildCandyServingEstimate(item: MealAssistantItem, lookupText: string): ParsedFoodItem | null {
  const normalized = normalizeFoodText(lookupText);
  const quantity = item.quantity > 0 ? item.quantity : 1;

  if (/\bsnickers\b/.test(normalized)) {
    return makeGenericEstimate(
      {
        key: 'snickers bar',
        label: 'Snickers Bar',
        quantity,
        unit: quantity === 1 ? 'bar' : 'bars',
        calories: 250 * quantity,
        protein: 4 * quantity,
        carbs: 33 * quantity,
        fat: 12 * quantity,
        fiber: 1 * quantity,
        sugar: 28 * quantity,
        sodium: 120 * quantity,
        sourceName: 'Snickers standard bar nutrition reference',
        sourceType: 'GENERIC_REFERENCE',
        matchType: 'exact_branded',
        notes: 'Kept the natural bar serving instead of a gram-based provider serving.',
      },
      lookupText,
    );
  }

  if (/\bskittles\b/.test(normalized)) {
    return makeGenericEstimate(
      {
        key: 'skittles pack',
        label: 'Skittles Pack',
        quantity,
        unit: quantity === 1 ? 'pack' : 'packs',
        calories: 251 * quantity,
        protein: 0 * quantity,
        carbs: 56 * quantity,
        fat: 2.5 * quantity,
        fiber: 0 * quantity,
        sugar: 47 * quantity,
        sodium: 15 * quantity,
        sourceName: 'Skittles single-pack nutrition reference',
        sourceType: 'GENERIC_REFERENCE',
        matchType: 'exact_branded',
        notes: 'Used a natural single-pack serving for the candy pack.',
      },
      lookupText,
    );
  }

  return null;
}

function buildCandyMealResponse(item: MealAssistantItem, mealType: MealAssistantState['mealType']): ParsedMealResponse | null {
  const lookupText = buildItemLookupText(item);
  const candyItem = buildCandyServingEstimate(item, lookupText);
  if (!candyItem) {
    return null;
  }

  return {
    needs_clarification: false,
    clarifying_question: null,
    meal_type: mealType,
    confidence_score: 0.9,
    items: [candyItem],
    totals: {
      calories: candyItem.calories,
      protein: candyItem.protein,
      carbs: candyItem.carbs,
      fat: candyItem.fat,
      fiber: candyItem.fiber,
      sugar: candyItem.sugar,
      sodium: candyItem.sodium,
    },
  };
}

function repairResolvedNutritionItem(item: MealAssistantItem, resolvedItem: ParsedFoodItem): ParsedFoodItem {
  const lookupText = buildItemLookupText(item);
  const lookupNormalized = normalizeFoodText(lookupText);
  const isPizzaSlices = pizzaNameRegex.test(lookupText) && (pizzaSliceUnitRegex.test(lookupText) || item.quantity >= 2);

  if (isPizzaSlices) {
    const resolvedCalories = Number(resolvedItem.calories || 0);
    const caloriesLookTooLow = item.quantity >= 2 && resolvedCalories < item.quantity * 180;
    const genericName = genericResolvedFoodRegex.test(resolvedItem.food_name.trim());

    if (genericName || caloriesLookTooLow) {
      return buildPizzaSliceEstimate(item);
    }
  }

  const candyEstimate = buildCandyServingEstimate(item, lookupText);
  if (candyEstimate && (/\b(?:snickers|skittles)\b/.test(lookupNormalized) || /\b(?:100\s*g|gram|grams)\b/i.test(`${resolvedItem.quantity} ${resolvedItem.unit}`))) {
    return candyEstimate;
  }

  if (/\bcottage cheese\b/.test(lookupNormalized) && !/\bcottage cheese\b/i.test(resolvedItem.food_name.trim())) {
    return buildCottageCheeseServingEstimate(item, lookupText);
  }

  if (/\btoast\b/.test(lookupNormalized) && /\bbread\b/i.test(resolvedItem.food_name.trim())) {
    return {
      ...resolvedItem,
      food_name: 'Toast',
      quantity: item.quantity || resolvedItem.quantity,
      unit: item.unit?.trim() || (item.quantity === 1 ? 'slice' : 'slices'),
      matched_query: resolvedItem.matched_query ?? lookupText,
      original_user_text: resolvedItem.original_user_text ?? lookupText,
      source_type: resolvedItem.source_type === 'OFFICIAL_RESTAURANT' ? 'AI_ESTIMATE' : resolvedItem.source_type,
      source_name: resolvedItem.source_name ?? 'Toast common serving estimate',
      confidence_label: resolvedItem.confidence_label ?? 'Estimated',
      is_trusted: resolvedItem.source_type === 'OFFICIAL_RESTAURANT' ? false : resolvedItem.is_trusted,
      used_ai_fallback: resolvedItem.source_type === 'OFFICIAL_RESTAURANT' ? true : resolvedItem.used_ai_fallback,
    };
  }

  if (genericResolvedFoodRegex.test(resolvedItem.food_name.trim())) {
    const humanName = buildHumanFoodNameFromAssistantItem(item);
    if (humanName) {
      return {
        ...resolvedItem,
        food_name: humanName,
        quantity: item.quantity || resolvedItem.quantity,
        unit: item.unit?.trim() || resolvedItem.unit,
        matched_query: resolvedItem.matched_query ?? lookupText,
        original_user_text: resolvedItem.original_user_text ?? lookupText,
      };
    }
  }

  if (item.quantity > 1 && /^rice cake$/i.test(resolvedItem.food_name.trim())) {
    return {
      ...resolvedItem,
      food_name: 'rice cakes',
      quantity: item.quantity || resolvedItem.quantity,
      unit: item.unit?.trim() || resolvedItem.unit,
      matched_query: resolvedItem.matched_query ?? lookupText,
      original_user_text: resolvedItem.original_user_text ?? lookupText,
    };
  }

  const userFacingUnit = normalizeQuantityUnit(item.unit);
  const resolvedUnit = normalizeQuantityUnit(resolvedItem.unit);
  const hasUserFacingServing = item.quantity > 0 && Boolean(userFacingUnit);

  if (hasUserFacingServing && (resolvedItem.quantity !== item.quantity || resolvedUnit !== userFacingUnit)) {
    const shouldUseGrilledChickenName = /\bgrilled chicken\b/.test(lookupNormalized) && /\bchicken breast\b/i.test(resolvedItem.food_name.trim());
    const displayUnit = userFacingUnit ?? resolvedItem.unit;

    return repairSuspiciousExplicitGramItem(lookupText, {
      ...resolvedItem,
      food_name: shouldUseGrilledChickenName ? 'Grilled chicken breast' : resolvedItem.food_name,
      quantity: item.quantity,
      unit: displayUnit,
      matched_query: resolvedItem.matched_query ?? lookupText,
      original_user_text: resolvedItem.original_user_text ?? lookupText,
      notes: [
        resolvedItem.notes,
        `Serving display kept as ${formatDisplayQuantity(item.quantity)} ${formatUnitForQuantity(displayUnit, item.quantity)} from the user message.`,
      ].filter(Boolean).join(' '),
    });
  }

  return repairSuspiciousExplicitGramItem(lookupText, resolvedItem);
}

function scaleNumberSafely(value: number | null | undefined, divisor: number, precision = 1) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }

  const factor = 10 ** precision;
  return Math.round((numeric / divisor) * factor) / factor;
}

function repairSuspiciousExplicitGramItem(message: string, item: ParsedFoodItem): ParsedFoodItem {
  const gramMatch = normalizeFoodText(message).match(/\b(\d+(?:\.\d+)?)\s*(?:g|gram|grams)\b/);
  const gramQuantity = gramMatch ? Number(gramMatch[1]) : normalizeQuantityUnit(item.unit) === 'g' ? Number(item.quantity || 0) : 0;
  if (!Number.isFinite(gramQuantity) || gramQuantity < 20 || normalizeQuantityUnit(item.unit) !== 'g') {
    return item;
  }

  const calories = Number(item.calories || 0);
  const caloriesAreImplausiblyScaled = calories >= 5_000 || calories > gramQuantity * 15;
  if (!caloriesAreImplausiblyScaled) {
    return item;
  }

  const divisor = Math.max(1, gramQuantity);
  return {
    ...item,
    calories: Math.round(calories / divisor),
    protein: scaleNumberSafely(item.protein, divisor),
    carbs: scaleNumberSafely(item.carbs, divisor),
    fat: scaleNumberSafely(item.fat, divisor),
    fiber: scaleNumberSafely(item.fiber, divisor),
    sugar: scaleNumberSafely(item.sugar, divisor),
    sodium: Math.round(Number(item.sodium || 0) / divisor),
    is_trusted: false,
    confidence_label: item.confidence_label === 'Verified' ? 'Needs Review' : item.confidence_label ?? 'Needs Review',
    source_type: item.source_type === 'OFFICIAL_RESTAURANT' ? 'AI_ESTIMATE' : item.source_type,
    used_ai_fallback: item.used_ai_fallback || item.source_type === 'AI_ESTIMATE',
    notes: [
      item.notes,
      'Corrected suspicious gram-serving scaling; review the serving before saving.',
    ].filter(Boolean).join(' '),
  };
}

type GenericEstimateSpec = {
  key: string;
  label: string;
  unit: string;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  sourceName?: string;
  sourceType?: ParsedFoodItem['source_type'];
  matchType?: ParsedFoodItem['match_type'];
  notes?: string;
};

function formatDisplayQuantity(quantity: number) {
  if (Number.isInteger(quantity)) {
    return quantity.toString();
  }

  return Number(quantity.toFixed(2)).toString();
}

function formatUnitForQuantity(unit: string, quantity: number) {
  const normalized = unit.trim().toLowerCase();
  if (!normalized) {
    return '';
  }

  if (normalized === 'g' || normalized === 'gram' || normalized === 'grams') {
    return 'g';
  }

  if (normalized === 'slice' || normalized === 'slices') {
    return quantity === 1 ? 'slice' : 'slices';
  }

  if (normalized === 'piece' || normalized === 'pieces') {
    return quantity === 1 ? 'piece' : 'pieces';
  }

  if (normalized.endsWith('s') && quantity === 1) {
    return normalized.slice(0, -1);
  }

  if (!normalized.endsWith('s') && quantity !== 1 && !['oz', 'tbsp'].includes(normalized)) {
    return `${normalized}s`;
  }

  return normalized;
}

function formatParsedItemLabel(item: ParsedFoodItem) {
  const quantity = formatDisplayQuantity(item.quantity);
  const unit = item.unit?.trim() ?? '';
  const normalizedUnit = formatUnitForQuantity(unit, item.quantity);
  const normalizedFoodName = normalizeText(item.food_name);

  if (!normalizedUnit || ['serving', 'servings', 'meal', 'meals', 'count', 'counts'].includes(normalizedUnit)) {
    return `${quantity} ${item.food_name}`;
  }

  if (normalizedUnit === 'g') {
    return `${quantity}g ${item.food_name}`;
  }

  if (normalizedFoodName.includes(normalizeText(normalizedUnit)) || normalizedFoodName.includes(normalizeText(unit))) {
    return `${quantity} ${item.food_name}`;
  }

  if (['slice', 'slices', 'piece', 'pieces'].includes(normalizedUnit)) {
    return `${quantity} ${normalizedUnit} of ${item.food_name}`;
  }

  return `${quantity} ${normalizedUnit} ${item.food_name}`;
}

function estimateGramsPerUnit(item: ParsedFoodItem, normalizedUnit: string | null) {
  const name = normalizeText(item.food_name);

  if (!normalizedUnit) {
    return null;
  }

  if (normalizedUnit === 'g') {
    return 1;
  }

  if (normalizedUnit === 'oz') {
    return 28.3495;
  }

  if (normalizedUnit === 'tbsp') {
    if (/\bpeanut butter\b/.test(name) || /\bnut butter\b/.test(name)) {
      return 16;
    }

    if (/\bbutter\b/.test(name) || /\boil\b/.test(name)) {
      return 14;
    }

    return 15;
  }

  if (normalizedUnit === 'tsp') {
    return 5;
  }

  if (normalizedUnit === 'cup') {
    if (/\bchicken\b/.test(name)) {
      return 140;
    }

    if (/\bcottage cheese\b/.test(name)) {
      return 226;
    }

    if (/\b(?:rice|beans)\b/.test(name)) {
      return 160;
    }

    if (/\b(?:oatmeal|greek yogurt|yogurt)\b/.test(name)) {
      return 240;
    }

    if (/\bblueberr/.test(name)) {
      return 148;
    }

    return 240;
  }

  if (normalizedUnit === 'egg') {
    return 50;
  }

  if (normalizedUnit === 'slice') {
    if (/\b(?:toast|bread)\b/.test(name)) {
      return 28;
    }

    if (/\bpizza\b/.test(name)) {
      return 107;
    }
  }

  if (normalizedUnit === 'cake' && /\brice cake/.test(name)) {
    return 9;
  }

  if (normalizedUnit === 'can') {
    return 260;
  }

  if (normalizedUnit === 'bottle') {
    return 414;
  }

  return null;
}

function inferNormalizedGrams(item: ParsedFoodItem) {
  const normalizedUnit = normalizeQuantityUnit(item.unit);
  const gramsPerUnit = estimateGramsPerUnit(item, normalizedUnit);

  if (gramsPerUnit !== null) {
    return Number((item.quantity * gramsPerUnit).toFixed(1));
  }

  if (typeof item.normalizedGrams === 'number' && item.normalizedGrams > 0) {
    return Number(item.normalizedGrams.toFixed(1));
  }

  if (typeof item.normalizedOunces === 'number' && item.normalizedOunces > 0) {
    return Number((item.normalizedOunces * 28.3495).toFixed(1));
  }

  return null;
}

function inferSourceId(item: ParsedFoodItem) {
  return item.sourceId
    ?? item.catalog_food_id
    ?? item.provider_used
    ?? item.source_name
    ?? item.matched_query
    ?? null;
}

function inferItemConfidence(item: ParsedFoodItem) {
  if (typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 1) {
    return item.confidence;
  }

  if (item.source_type === 'OFFICIAL_RESTAURANT') {
    return 0.97;
  }

  if (item.source_type === 'GENERIC_REFERENCE' || item.is_trusted) {
    return 0.9;
  }

  if (item.source_type === 'AI_ESTIMATE' || item.used_ai_fallback) {
    return 0.72;
  }

  return 0.82;
}

function buildUserTextSpan(item: ParsedFoodItem) {
  const normalizedUnit = normalizeQuantityUnit(item.unit) ?? item.unit;
  const unitLabel = normalizedUnit ? formatUnitForQuantity(normalizedUnit, item.quantity) : item.unit;

  return [formatDisplayQuantity(item.quantity), unitLabel, item.food_name].filter(Boolean).join(' ');
}

function withServingMetadata(item: ParsedFoodItem): ParsedFoodItem {
  const normalizedUnit = normalizeQuantityUnit(item.unit) ?? item.unit;
  const userUnit = normalizedUnit || item.unit?.trim();
  const normalizedGrams = inferNormalizedGrams(item);
  const normalizedOunces = normalizedGrams !== null
    ? Number((normalizedGrams / 28.3495).toFixed(2))
    : typeof item.normalizedOunces === 'number'
      ? Number(item.normalizedOunces.toFixed(2))
      : null;

  return {
    ...item,
    unit: normalizedUnit,
    userQuantity: item.quantity,
    userUnit,
    userTextSpan: buildUserTextSpan(item),
    normalizedGrams,
    normalizedOunces,
    sourceId: inferSourceId(item),
    confidence: inferItemConfidence(item),
  };
}

function withServingMetadataForItems(items: ParsedFoodItem[]) {
  return items.map((item) => withServingMetadata(item));
}

function makeGenericEstimate(spec: GenericEstimateSpec, originalText: string): ParsedFoodItem {
  const sourceType = spec.sourceType ?? 'AI_ESTIMATE';
  const isTrusted = sourceType !== 'AI_ESTIMATE';

  return {
    food_name: spec.label,
    quantity: spec.quantity,
    unit: spec.unit,
    calories: Number(spec.calories.toFixed(1)),
    protein: Number(spec.protein.toFixed(1)),
    carbs: Number(spec.carbs.toFixed(1)),
    fat: Number(spec.fat.toFixed(1)),
    fiber: Number((spec.fiber ?? 0).toFixed(1)),
    sugar: Number((spec.sugar ?? 0).toFixed(1)),
    sodium: Number((spec.sodium ?? 0).toFixed(1)),
    notes: spec.notes ?? (isTrusted ? `Matched from ${spec.sourceName ?? 'trusted nutrition reference'}.` : 'Fallback estimate from common nutrition references. Confirm details if needed.'),
    is_trusted: isTrusted,
    source_type: sourceType,
    source_name: spec.sourceName ?? 'Calorie Compass common-food fallback',
    confidence_label: sourceType === 'OFFICIAL_RESTAURANT' ? 'Verified' : sourceType === 'GENERIC_REFERENCE' ? 'Matched' : 'Estimated',
    match_type: spec.matchType ?? (sourceType === 'OFFICIAL_RESTAURANT' ? 'exact_restaurant' : sourceType === 'GENERIC_REFERENCE' ? 'generic_estimate' : 'ai_estimate'),
    matched_query: spec.key,
    original_user_text: originalText,
    provider_used: sourceType === 'OFFICIAL_RESTAURANT' ? 'local-verified-catalog' : sourceType === 'GENERIC_REFERENCE' ? 'database-match' : null,
    used_ai_fallback: !isTrusted,
    catalog_food_id: null,
  };
}

function dedupeParsedItems(items: ParsedFoodItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeText(`${item.food_name}:${item.unit}`);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getKnownItemOrderIndex(item: ParsedFoodItem, normalizedMessage: string) {
  const candidates = [
    item.matched_query,
    item.food_name,
    /\bwendy/i.test(item.food_name) && /sandwich/i.test(item.food_name) ? 'spicy chicken sandwich' : null,
    /\bfries?\b/i.test(item.food_name) ? 'medium fries' : null,
    /\bfairlife|core power/i.test(item.food_name) ? 'fairlife core power elite' : null,
    /\bcoke zero/i.test(item.food_name) ? 'coke zero' : null,
    /\bchipotle/i.test(item.food_name) ? 'chipotle' : null,
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeFoodText);

  const found = candidates
    .map((candidate) => normalizedMessage.indexOf(candidate))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];

  return found ?? Number.MAX_SAFE_INTEGER;
}

function sortKnownEstimateItems(items: ParsedFoodItem[], message: string) {
  const normalizedMessage = normalizeFoodText(message);
  return [...items].sort((left, right) => getKnownItemOrderIndex(left, normalizedMessage) - getKnownItemOrderIndex(right, normalizedMessage));
}

function makeWholeMilkItem(message: string, quantity = 1) {
  return makeGenericEstimate(
    {
      key: 'whole milk',
      label: 'Whole milk',
      quantity,
      unit: quantity === 1 ? 'cup' : 'cups',
      calories: 150 * quantity,
      protein: 8 * quantity,
      carbs: 12 * quantity,
      fat: 8 * quantity,
      sugar: 12 * quantity,
      sodium: 120 * quantity,
      sourceName: 'Whole milk common serving estimate',
      sourceType: 'GENERIC_REFERENCE',
    },
    message,
  );
}

function detectKnownFoodEstimates(message: string): ParsedFoodItem[] {
  const normalized = normalizeFoodText(message);
  const lower = normalizeKnownFoodTypos(message.toLowerCase());
  const items: ParsedFoodItem[] = [];
  const countWordPattern = 'one|two|three|four|five|six|seven|eight|nine|ten';
  const readCountBefore = (pattern: string, fallback = 1) => {
    const match = normalized.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?|${countWordPattern})\\s+${pattern}\\b`));
    return match ? parseCount(match[1] ?? '1') : fallback;
  };
  const readPortionQuantity = (foodPattern: string, fallback = 1) => {
    const fractionMatch = lower.match(new RegExp(`\\b(\\d+)\\s*/\\s*(\\d+)\\s+(?:of\\s+)?(?:a\\s+|an\\s+)?${foodPattern}\\b`));
    if (fractionMatch) {
      const numerator = Number(fractionMatch[1]);
      const denominator = Number(fractionMatch[2]);
      if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
        return numerator / denominator;
      }
    }

    const halfMatch = normalized.match(new RegExp(`\\b(?:a\\s+)?half\\s+(?:of\\s+)?(?:a\\s+|an\\s+)?${foodPattern}\\b`));
    if (halfMatch) {
      return 0.5;
    }

    return readCountBefore(foodPattern, fallback);
  };

  const chipotleEstimate = detectChipotleBowlEstimate(message);
  if (chipotleEstimate) {
    items.push(chipotleEstimate);
  }

  const sliceMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s+(?:slices?|pieces?)\s+(?:of\s+)?(?:little caesars\s+)?(?:pizza|pepperoni pizza|cheese pizza)\b/);
  const wordSliceMatch = normalized.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:slices?|pieces?)\s+(?:of\s+)?(?:little caesars\s+)?(?:pizza|pepperoni pizza|cheese pizza)\b/);
  const pizzaQuantity = sliceMatch ? Number(sliceMatch[1]) : wordSliceMatch ? parseCount(wordSliceMatch[1] ?? '1') : null;

  if (pizzaQuantity) {
    const isLittleCaesars = /\blittle caesars?\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'pizza',
          label: isLittleCaesars ? 'Little Caesars pizza' : 'slices of pizza',
          quantity: pizzaQuantity,
          unit: pizzaQuantity === 1 ? 'slice' : 'slices',
          calories: pizzaQuantity * 285,
          protein: pizzaQuantity * 12,
          carbs: pizzaQuantity * 36,
          fat: pizzaQuantity * 10,
          fiber: pizzaQuantity * 2,
          sugar: pizzaQuantity * 4,
          sodium: pizzaQuantity * 640,
          sourceName: isLittleCaesars ? 'Little Caesars-style fallback estimate' : 'Generic pizza slice fallback estimate',
        },
        message,
      ),
    );
  }

  if (!pizzaQuantity && /\b(?:a\s+)?(?:whole|entire)\s+(?:little caesars\s+|cheese\s+|pepperoni\s+)?(?:pizza|pie)\b/.test(normalized)) {
    const isLittleCaesars = /\blittle caesars?\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'whole pizza',
          label: isLittleCaesars ? 'Little Caesars pizza' : 'Pizza',
          quantity: 1,
          unit: 'pizza',
          calories: 2280,
          protein: 96,
          carbs: 288,
          fat: 80,
          fiber: 16,
          sugar: 32,
          sodium: 5120,
          sourceName: isLittleCaesars ? 'Little Caesars-style fallback estimate' : 'Generic whole pizza fallback estimate',
        },
        message,
      ),
    );
  }

  if (!pizzaQuantity && !/\b(?:whole|entire|little caesars?)\b/.test(normalized) && /\bpizza\b/.test(normalized)) {
    items.push(
      makeGenericEstimate(
        {
          key: 'pizza',
          label: 'slices of pizza',
          quantity: 1,
          unit: 'slice',
          calories: 285,
          protein: 12,
          carbs: 36,
          fat: 10,
          fiber: 2,
          sugar: 4,
          sodium: 640,
          sourceName: 'Generic pizza slice fallback estimate',
        },
        message,
      ),
    );
  }

  if (/\bcinnamon toast crunch\b|\bcereal\b/.test(normalized)) {
    const bowlMatch = normalized.match(/\b(\d+(?:\.\d+)?|\.\d+|one|two|three|four|five|half|a half)\s+(?:bowls?|cups?)\b/);
    const quantity = bowlMatch ? parseCount(bowlMatch[1] ?? '1') : 1;
    const isCinnamonToastCrunch = /\bcinnamon toast crunch\b/.test(normalized);
    const hasWholeMilk = /\bwhole milk\b/.test(normalized);
    const hasMilk = hasWholeMilk || /\bmilk\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'cereal',
          label: isCinnamonToastCrunch ? 'Cinnamon Toast Crunch cereal' : 'Cereal',
          quantity,
          unit: quantity === 1 ? 'bowl' : 'bowls',
          calories: (isCinnamonToastCrunch ? 170 : 140) * quantity,
          protein: (isCinnamonToastCrunch ? 2 : 4) * quantity,
          carbs: (isCinnamonToastCrunch ? 33 : 28) * quantity,
          fat: (isCinnamonToastCrunch ? 4 : 2) * quantity,
          fiber: 2 * quantity,
          sugar: (isCinnamonToastCrunch ? 12 : 6) * quantity,
          sodium: (isCinnamonToastCrunch ? 230 : 180) * quantity,
          sourceName: isCinnamonToastCrunch ? 'Cinnamon Toast Crunch common serving estimate' : 'Cereal common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );

    if (hasMilk) {
      items.push(makeWholeMilkItem(message, quantity));
    }
  }

  if (/\b(?:oatmeal|oats?)\b/.test(normalized)) {
    const cupMatch = normalized.match(/\b(\d+(?:\.\d+)?|\.\d+|half|a half|one|two|three)\s+cups?\s+(?:of\s+)?(?:oatmeal|oats?)\b/);
    const packetMatch = normalized.match(/\b(\d+(?:\.\d+)?|one|two|three)\s+(?:packets?|servings?)\s+(?:of\s+)?(?:oatmeal|oats?)\b/);
    const quantity = cupMatch ? parseCount(cupMatch[1] ?? '1') : packetMatch ? parseCount(packetMatch[1] ?? '1') : 1;
    const unit = cupMatch ? 'cup' : packetMatch ? 'packet' : 'serving';

    items.push(
      makeGenericEstimate(
        {
          key: 'oatmeal',
          label: 'Oatmeal',
          quantity,
          unit,
          calories: quantity * 150,
          protein: quantity * 5,
          carbs: quantity * 27,
          fat: quantity * 3,
          fiber: quantity * 4,
          sugar: quantity * 1,
          sodium: quantity * 115,
          sourceName: 'Oatmeal common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\bblueberr(?:y|ies)\b/.test(normalized)) {
    const quantity = /\b(?:some|handful)\b/.test(normalized) ? 0.5 : 1;
    items.push(
      makeGenericEstimate(
        {
          key: 'blueberries',
          label: 'Blueberries',
          quantity,
          unit: 'cup',
          calories: quantity * 85,
          protein: quantity * 1,
          carbs: quantity * 21,
          fat: quantity * 0.5,
          fiber: quantity * 3.5,
          sugar: quantity * 15,
          sodium: quantity * 1,
          sourceName: 'Blueberry common serving reference',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\bgreek yogurt\b/.test(normalized)) {
    const isPlain = /\bplain\b/.test(normalized);
    const serving = parseLeadingServingFood(message);
    const quantity = serving?.unit === 'serving' ? serving.quantity : 1;
    items.push(
      makeGenericEstimate(
        {
          key: 'greek yogurt',
          label: isPlain ? 'Plain Greek yogurt' : 'Greek yogurt',
          quantity,
          unit: quantity === 1 ? 'serving' : 'servings',
          calories: 100 * quantity,
          protein: 17 * quantity,
          carbs: 6 * quantity,
          fat: 0.5 * quantity,
          sugar: 6 * quantity,
          sodium: 65 * quantity,
        },
        message,
      ),
    );
  }

  if (/\bgranola\b/.test(normalized)) {
    const quantity = readCountBefore('(?:cups?\\s+(?:of\\s+)?)?granola', 1);
    items.push(
      makeGenericEstimate(
        {
          key: 'granola',
          label: 'Granola',
          quantity,
          unit: quantity === 1 ? 'serving' : 'servings',
          calories: 140 * quantity,
          protein: 3 * quantity,
          carbs: 24 * quantity,
          fat: 5 * quantity,
          fiber: 3 * quantity,
          sugar: 7 * quantity,
          sodium: 35 * quantity,
          sourceName: 'Granola common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\beggs?\b/.test(normalized)) {
    const quantity = readCountBefore('(?:(?:scrambled|fried|hard boiled|large|small|medium)\\s+)?eggs?', 1);
    const isScrambled = /\bscrambled eggs?\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'eggs',
          label: isScrambled ? 'Scrambled eggs' : 'Eggs',
          quantity,
          unit: quantity === 1 ? 'egg' : 'eggs',
          calories: quantity * 70,
          protein: quantity * 6,
          carbs: quantity * 0.5,
          fat: quantity * 5,
          sodium: quantity * 70,
          sourceName: 'Egg common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\btoast\b/.test(normalized)) {
    const quantity = readCountBefore('(?:(?:slices?|pieces?)\\s+(?:of\\s+)?)?toast', 1);
    const isButtered = /\bbuttered toast\b|\btoast with butter\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'toast',
          label: isButtered ? 'Buttered toast' : 'Toast',
          quantity,
          unit: quantity === 1 ? 'slice' : 'slices',
          calories: quantity * (isButtered ? 150 : 100),
          protein: quantity * 4,
          carbs: quantity * 19,
          fat: quantity * (isButtered ? 6 : 1),
          fiber: quantity * 1.5,
          sugar: quantity * 2,
          sodium: quantity * (isButtered ? 190 : 150),
          sourceName: 'Toast common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bturkey sausage\b/.test(normalized)) {
    const quantity = readCountBefore('(?:turkey\\s+)?sausage(?:\\s+links?|\\s+patties?)?', 2);
    items.push(
      makeGenericEstimate(
        {
          key: 'turkey sausage',
          label: 'Turkey sausage',
          quantity,
          unit: quantity === 1 ? 'link' : 'links',
          calories: quantity * 70,
          protein: quantity * 6,
          carbs: quantity * 1,
          fat: quantity * 4.5,
          sodium: quantity * 260,
          sourceName: 'Turkey sausage common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bcoke zero\b|\bzero sugar coke\b|\bdiet coke\b/.test(normalized)) {
    items.push(
      makeGenericEstimate(
        {
          key: 'coke zero',
          label: 'Coke Zero',
          quantity: 1,
          unit: 'can',
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          sugar: 0,
          sodium: 40,
          sourceName: 'Coca-Cola nutrition reference',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\bcoke\b/.test(normalized) && !/\b(?:coke zero|zero sugar coke|diet coke)\b/.test(normalized)) {
    items.push(
      makeGenericEstimate(
        {
          key: 'coke',
          label: 'Coke',
          quantity: 1,
          unit: 'can',
          calories: 140,
          protein: 0,
          carbs: 39,
          fat: 0,
          sugar: 39,
          sodium: 45,
          sourceName: 'Coca-Cola common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\bmcdouble\b|\bmc double\b/.test(normalized)) {
    const quantity = readCountBefore('(?:mc\\s*double|mcdouble)s?', 1);
    items.push(
      makeGenericEstimate(
        {
          key: 'mcdonalds mcdouble',
          label: quantity === 1 ? 'McDouble' : 'McDoubles',
          quantity,
          unit: quantity === 1 ? 'burger' : 'burgers',
          calories: quantity * 390,
          protein: quantity * 22,
          carbs: quantity * 33,
          fat: quantity * 19,
          fiber: quantity * 2,
          sugar: quantity * 7,
          sodium: quantity * 920,
          sourceName: "McDonald's official nutrition",
          sourceType: 'OFFICIAL_RESTAURANT',
        },
        message,
      ),
    );
  }

  if (/\bbig mac\b|\bbigmac\b/.test(normalized)) {
    items.push(
      makeGenericEstimate(
        {
          key: 'big mac',
          label: "McDonald's Big Mac",
          quantity: 1,
          unit: 'burger',
          calories: 590,
          protein: 25,
          carbs: 46,
          fat: 34,
          fiber: 3,
          sugar: 9,
          sodium: 1050,
          sourceName: "McDonald's official nutrition",
          sourceType: 'OFFICIAL_RESTAURANT',
        },
        message,
      ),
    );
  }

  if (/\bburgers?\b/.test(normalized) && !/\b(?:mcdouble|mc double|big mac|bigmac|cheeseburger)\b/.test(normalized)) {
    const quantity = readPortionQuantity('burgers?', 1);
    const withoutBun = /\b(?:no|without|hold the)\s+bun\b|\bno bun\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'burger',
          label: withoutBun ? 'Burger without bun' : quantity === 1 ? 'Burger' : 'Burgers',
          quantity,
          unit: quantity === 1 ? 'burger' : 'burgers',
          calories: (withoutBun ? 320 : 430) * quantity,
          protein: 24 * quantity,
          carbs: (withoutBun ? 4 : 33) * quantity,
          fat: (withoutBun ? 24 : 23) * quantity,
          fiber: (withoutBun ? 0 : 2) * quantity,
          sugar: (withoutBun ? 1 : 6) * quantity,
          sodium: 640 * quantity,
          sourceName: withoutBun ? 'Bunless burger common serving estimate' : 'Burger common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bbeans?\b/.test(normalized) && /\b(?:can|cans|canned)\b/.test(normalized)) {
    const countMatch =
      normalized.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?|${countWordPattern})\\s+cans?\\s+(?:of\\s+)?beans?\\b`))
      ?? normalized.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?|${countWordPattern})\\s+canned\\s+beans?\\b`));
    const quantity = countMatch ? parseCount(countMatch[1] ?? '1') : 1;
    const beanLabel = /\bblack beans?\b/.test(normalized)
      ? 'Black beans'
      : /\bpinto beans?\b/.test(normalized)
        ? 'Pinto beans'
        : 'Beans';

    items.push(
      makeGenericEstimate(
        {
          key: 'canned beans',
          label: beanLabel,
          quantity,
          unit: quantity === 1 ? 'can' : 'cans',
          calories: quantity * 300,
          protein: quantity * 18,
          carbs: quantity * 54,
          fat: quantity * 2,
          fiber: quantity * 14,
          sugar: quantity * 3,
          sodium: quantity * 900,
          sourceName: 'Canned beans common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\bbacon\b/.test(normalized)) {
    const serving = parseLeadingServingFood(message);
    const quantity = serving?.unit && /^(?:slice|piece)$/.test(serving.unit)
      ? serving.quantity
      : readCountBefore('(?:slices?|pieces?)\\s+(?:of\\s+)?bacon|bacon', 2);
    const unit = serving?.unit === 'piece'
      ? quantity === 1 ? 'piece' : 'pieces'
      : quantity === 1 ? 'slice' : 'slices';
    items.push(
      makeGenericEstimate(
        {
          key: 'bacon',
          label: 'Bacon',
          quantity,
          unit,
          calories: quantity * 45,
          protein: quantity * 3,
          carbs: 0,
          fat: quantity * 3.5,
          sodium: quantity * 180,
          sourceName: 'Bacon common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\b(?:chicken\s+)?tacos?\b|\btacos?\s+(?:with\s+)?chicken\b/.test(normalized)) {
    const quantity = readPortionQuantity('(?:chicken\\s+)?tacos?', 1);
    items.push(
      makeGenericEstimate(
        {
          key: 'chicken tacos',
          label: /chicken/.test(normalized) ? 'Chicken tacos' : quantity === 1 ? 'Taco' : 'Tacos',
          quantity,
          unit: quantity === 1 ? 'taco' : 'tacos',
          calories: 210 * quantity,
          protein: (/chicken/.test(normalized) ? 14 : 8) * quantity,
          carbs: 22 * quantity,
          fat: 8 * quantity,
          fiber: 3 * quantity,
          sugar: 2 * quantity,
          sodium: 420 * quantity,
          sourceName: 'Taco common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bchicken tenders?\b/.test(normalized)) {
    const quantity = readCountBefore('(?:air\\s+fried\\s+|homemade\\s+)?chicken tenders?', 3);
    const isAirFried = /\bair fried\b/.test(normalized);
    const label = `${isAirFried ? 'Air fried ' : ''}${/\bhomemade\b/.test(normalized) ? 'homemade ' : ''}chicken tenders`
      .replace(/^./, (char) => char.toUpperCase())
      .replace(/\s+/g, ' ')
      .trim();
    items.push(
      makeGenericEstimate(
        {
          key: 'chicken tenders',
          label,
          quantity,
          unit: quantity === 1 ? 'tender' : 'tenders',
          calories: (isAirFried ? 70 : 95) * quantity,
          protein: 8 * quantity,
          carbs: (isAirFried ? 5 : 7) * quantity,
          fat: (isAirFried ? 3 : 5) * quantity,
          sodium: 230 * quantity,
          sourceName: 'Chicken tenders common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\b(?:fried|grilled)?\s*chicken sandwich\b|\bchicken sandwich\b/.test(normalized) && !/\b(?:wendy|mcdonald|chick[-\s]*fil[-\s]*a|popeyes)\b/.test(normalized)) {
    const isGrilled = /\bgrilled\b/.test(normalized);
    const isFried = /\bfried\b/.test(normalized) || !isGrilled;
    items.push(
      makeGenericEstimate(
        {
          key: isGrilled ? 'grilled chicken sandwich' : 'fried chicken sandwich',
          label: isGrilled ? 'Grilled chicken sandwich' : isFried ? 'Fried chicken sandwich' : 'Chicken sandwich',
          quantity: 1,
          unit: 'sandwich',
          calories: isGrilled ? 390 : 490,
          protein: isGrilled ? 29 : 26,
          carbs: isGrilled ? 44 : 46,
          fat: isGrilled ? 10 : 21,
          fiber: 2,
          sugar: 6,
          sodium: isGrilled ? 900 : 1080,
          sourceName: 'Chicken sandwich common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bchicken\b/.test(normalized) && !/\b(?:chipotle|wendy|sandwich|nuggets?|fried|grilled|chicken breast|tacos?|tenders?)\b/.test(normalized)) {
    items.push(
      makeGenericEstimate(
        {
          key: 'chicken',
          label: 'Chicken',
          quantity: 1,
          unit: 'serving',
          calories: 220,
          protein: 36,
          carbs: 0,
          fat: 8,
          sodium: 120,
          sourceName: 'Chicken common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\b(?:grilled chicken|chicken breast)\b/.test(normalized) && !/\bsandwich\b/.test(normalized)) {
    const cupMatch = normalized.match(/\b(\d+(?:\.\d+)?|\.\d+|one|two|three|four|five|half|a half)\s+cups?\s+(?:of\s+)?(?:grilled chicken|chicken breast)\b/);
    const ounceMatch = normalized.match(/\b(\d+(?:\.\d+)?|\.\d+|one|two|three|four|five|six|seven|eight)\s*(?:oz|ounces?)\s+(?:of\s+)?(?:grilled chicken|chicken breast)\b/);
    const gramMatch = normalized.match(/\b(\d+(?:\.\d+)?|\.\d+)\s*(?:g|grams?)\s+(?:of\s+)?(?:grilled chicken|chicken breast)\b/);
    const quantity = cupMatch ? parseCount(cupMatch[1] ?? '1') : ounceMatch ? parseCount(ounceMatch[1] ?? '4') : gramMatch ? Number(gramMatch[1]) : 1;
    const unit = cupMatch ? (quantity === 1 ? 'cup' : 'cups') : ounceMatch ? 'oz' : gramMatch ? 'g' : 'serving';
    const multiplier = cupMatch ? quantity : ounceMatch ? quantity / 4 : gramMatch ? quantity / 112 : quantity;

    items.push(
      makeGenericEstimate(
        {
          key: 'grilled chicken',
          label: 'Grilled chicken breast',
          quantity,
          unit,
          calories: 185 * multiplier,
          protein: 35 * multiplier,
          carbs: 0,
          fat: 4 * multiplier,
          sodium: 110 * multiplier,
          sourceName: 'Grilled chicken common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\bsalmon\b/.test(normalized)) {
    const ounceMatch = normalized.match(/\b(\d+(?:\.\d+)?|\.\d+|one|two|three|four|five|six|seven|eight)\s*(?:oz|ounces?)\s+(?:of\s+)?salmon\b/);
    const quantity = ounceMatch ? parseCount(ounceMatch[1] ?? '4') : 1;
    const multiplier = ounceMatch ? quantity / 4 : quantity;

    items.push(
      makeGenericEstimate(
        {
          key: 'salmon',
          label: 'Salmon',
          quantity,
          unit: ounceMatch ? 'oz' : 'serving',
          calories: 240 * multiplier,
          protein: 30 * multiplier,
          carbs: 0,
          fat: 13 * multiplier,
          sodium: 75 * multiplier,
          sourceName: 'Salmon common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\bturkey sandwich\b|\bsandwich\b.*\bturkey\b|\bturkey\b.*\bsandwich\b/.test(normalized)) {
    items.push(
      makeGenericEstimate(
        {
          key: 'turkey sandwich',
          label: 'Turkey sandwich',
          quantity: 1,
          unit: 'sandwich',
          calories: 360,
          protein: 28,
          carbs: 36,
          fat: 10,
          fiber: 4,
          sugar: 5,
          sodium: 900,
          sourceName: 'Turkey sandwich common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\bavocado\b/.test(normalized)) {
    const quantity = /\bhalf\s+(?:an?\s+)?avocado\b/.test(normalized) ? 0.5 : readCountBefore('avocados?', 1);
    items.push(
      makeGenericEstimate(
        {
          key: 'avocado',
          label: 'Avocado',
          quantity,
          unit: quantity === 1 ? 'avocado' : 'avocados',
          calories: 240 * quantity,
          protein: 3 * quantity,
          carbs: 13 * quantity,
          fat: 22 * quantity,
          fiber: 10 * quantity,
          sugar: 1 * quantity,
          sodium: 10 * quantity,
          sourceName: 'Avocado common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\bsalsa\b/.test(normalized) && !/\bchipotle\b/.test(normalized) && !/\bcorn salsa\b|\bgreen salsa\b/.test(normalized)) {
    items.push(
      makeGenericEstimate(
        {
          key: 'salsa',
          label: 'Salsa',
          quantity: 1,
          unit: 'serving',
          calories: 20,
          protein: 1,
          carbs: 4,
          fat: 0,
          fiber: 1,
          sugar: 2,
          sodium: 250,
          sourceName: 'Salsa common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\borange juice\b/.test(normalized)) {
    items.push(
      makeGenericEstimate(
        {
          key: 'orange juice',
          label: 'Orange juice',
          quantity: 1,
          unit: 'glass',
          calories: 110,
          protein: 2,
          carbs: 26,
          fat: 0,
          sugar: 21,
          sodium: 10,
          sourceName: 'Orange juice common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bstarbucks\b/.test(normalized) && /\blatte\b/.test(normalized)) {
    const size = /\bventi\b/.test(normalized) ? 'venti' : /\bgrande\b/.test(normalized) ? 'grande' : 'tall';
    const calories = size === 'venti' ? 250 : size === 'grande' ? 190 : 150;
    const protein = size === 'venti' ? 17 : size === 'grande' ? 13 : 10;
    const carbs = size === 'venti' ? 24 : size === 'grande' ? 18 : 14;
    const fat = size === 'venti' ? 9 : size === 'grande' ? 7 : 6;
    const sodium = size === 'venti' ? 200 : size === 'grande' ? 150 : 115;
    items.push(
      makeGenericEstimate(
        {
          key: `starbucks latte ${size}`,
          label: `Starbucks Caffe Latte ${size[0].toUpperCase()}${size.slice(1)}`,
          quantity: 1,
          unit: size,
          calories,
          protein,
          carbs,
          fat,
          sugar: carbs,
          sodium,
          sourceName: 'Starbucks official nutrition',
          sourceType: 'OFFICIAL_RESTAURANT',
          matchType: 'exact_restaurant',
        },
        message,
      ),
    );
  }

  if (/\bcoffee\b/.test(normalized) && !/\bstarbucks\b/.test(normalized)) {
    const hasCream = /\bcream|creamer|latte|milk\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'coffee',
          label: hasCream ? 'Coffee with cream' : 'Coffee',
          quantity: 1,
          unit: 'cup',
          calories: hasCream ? 60 : 5,
          protein: hasCream ? 1 : 0,
          carbs: hasCream ? 4 : 0,
          fat: hasCream ? 4 : 0,
          sugar: hasCream ? 3 : 0,
          sodium: 5,
          sourceName: 'Coffee common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\bwhole milk\b/.test(normalized) && !/\bcereal\b/.test(normalized)) {
    items.push(makeWholeMilkItem(message, 1));
  }

  if (/\bmilk\b/.test(normalized) && !/\bwhole milk\b/.test(normalized) && !/\bcereal\b/.test(normalized) && !/\bcoffee\b/.test(normalized)) {
    items.push(
      makeGenericEstimate(
        {
          key: 'milk',
          label: 'Milk',
          quantity: 1,
          unit: 'cup',
          calories: 120,
          protein: 8,
          carbs: 12,
          fat: 5,
          sugar: 12,
          sodium: 115,
          sourceName: 'Milk common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\b(?:broccoli|brocolli)\b/.test(normalized)) {
    const quantity = readCountBefore('(?:cups?\\s+(?:of\\s+)?)?(?:broccoli|brocolli)', 1);
    items.push(
      makeGenericEstimate(
        {
          key: 'broccoli',
          label: 'Broccoli',
          quantity,
          unit: 'cup',
          calories: 55 * quantity,
          protein: 4 * quantity,
          carbs: 11 * quantity,
          fat: 0.5 * quantity,
          fiber: 5 * quantity,
          sugar: 2 * quantity,
          sodium: 60 * quantity,
          sourceName: 'Broccoli common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\bhash browns?\b/.test(normalized)) {
    items.push(
      makeGenericEstimate(
        {
          key: 'hash browns',
          label: 'Hash browns',
          quantity: 1,
          unit: 'serving',
          calories: 180,
          protein: 2,
          carbs: 24,
          fat: 8,
          fiber: 2,
          sugar: 0,
          sodium: 320,
          sourceName: 'Hash browns common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\b(?:wendys|wendy s)\b/.test(normalized) && /\bspicy chicken sandwich\b/.test(normalized)) {
    items.push(
      makeGenericEstimate(
        {
          key: 'wendys spicy chicken sandwich',
          label: "Wendy's Spicy Chicken Sandwich",
          quantity: 1,
          unit: 'sandwich',
          calories: 490,
          protein: 28,
          carbs: 49,
          fat: 21,
          fiber: 2,
          sugar: 6,
          sodium: 1080,
          sourceName: "Wendy's official nutrition",
          sourceType: 'OFFICIAL_RESTAURANT',
        },
        message,
      ),
    );
  }

  if (/\b(?:wendys|wendy s)\b/.test(normalized) && /\b(?:fries|fry)\b/.test(normalized)) {
    const isMedium = /\bmedium\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'wendys fries',
          label: isMedium ? "Wendy's medium fries" : "Wendy's fries",
          quantity: 1,
          unit: isMedium ? 'medium order' : 'order',
          calories: isMedium ? 350 : 320,
          protein: isMedium ? 5 : 4,
          carbs: isMedium ? 48 : 43,
          fat: isMedium ? 16 : 15,
          fiber: 5,
          sugar: 0,
          sodium: isMedium ? 520 : 470,
          sourceName: "Wendy's fries common serving estimate",
        },
        message,
      ),
    );
  }

  if (/\bmcdonald'?s?\b/.test(normalized) && /\b(?:fries|fry)\b/.test(normalized)) {
    const isMedium = /\bmedium\b/.test(normalized);
    const isLarge = /\blarge\b/.test(normalized);
    const isSmall = /\bsmall\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'mcdonalds fries',
          label: isLarge ? 'McDonald\'s large fry' : isMedium ? 'McDonald\'s medium fries' : isSmall ? 'McDonald\'s small fries' : 'McDonald\'s fries',
          quantity: 1,
          unit: isLarge ? 'large order' : isMedium ? 'medium order' : isSmall ? 'small order' : 'order',
          calories: isLarge ? 480 : isMedium ? 340 : isSmall ? 230 : 320,
          protein: isLarge ? 6 : isMedium ? 4 : isSmall ? 3 : 4,
          carbs: isLarge ? 66 : isMedium ? 44 : isSmall ? 30 : 42,
          fat: isLarge ? 23 : isMedium ? 16 : isSmall ? 11 : 15,
          fiber: isLarge ? 6 : 4,
          sugar: 0,
          sodium: isLarge ? 560 : isMedium ? 420 : isSmall ? 290 : 390,
          sourceName: "McDonald's official nutrition",
          sourceType: 'OFFICIAL_RESTAURANT',
        },
        message,
      ),
    );
  }

  if (!/\b(?:wendys|wendy s|mcdonald'?s?)\b/.test(normalized) && /\b(?:fries|fry)\b/.test(normalized)) {
    const isMedium = /\bmedium\b/.test(normalized);
    const isLarge = /\blarge\b/.test(normalized);
    const isSmall = /\bsmall\b/.test(normalized);
    const quantity = readCountBefore('(?:medium\\s+|large\\s+|small\\s+)?(?:fries|fry)', 1);
    const orderCalories = isLarge ? 480 : isMedium ? 340 : isSmall ? 230 : 320;
    const orderProtein = isLarge ? 6 : isSmall ? 3 : 4;
    const orderCarbs = isLarge ? 66 : isMedium ? 44 : isSmall ? 30 : 42;
    const orderFat = isLarge ? 23 : isMedium ? 16 : isSmall ? 11 : 15;
    const orderSodium = isLarge ? 560 : isMedium ? 420 : isSmall ? 290 : 390;
    items.push(
      makeGenericEstimate(
        {
          key: 'fries',
          label: isLarge ? 'Large fry' : isMedium ? 'Medium fries' : isSmall ? 'Small fries' : 'Fries',
          quantity,
          unit: isLarge ? 'large order' : isMedium ? 'medium order' : isSmall ? 'small order' : quantity === 1 ? 'order' : 'orders',
          calories: quantity * orderCalories,
          protein: quantity * orderProtein,
          carbs: quantity * orderCarbs,
          fat: quantity * orderFat,
          fiber: quantity * 4,
          sugar: 0,
          sodium: quantity * orderSodium,
          sourceName: 'Fries common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bchips?\b/.test(normalized) && /\bguac(?:amole)?\b/.test(normalized)) {
    const isChipotle = /\bchipotle\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'chips with guacamole',
          label: isChipotle ? 'Chipotle chips with guacamole' : 'Chips with guacamole',
          quantity: 1,
          unit: 'order',
          calories: 770,
          protein: 8,
          carbs: 81,
          fat: 47,
          fiber: 12,
          sugar: 3,
          sodium: 1130,
          sourceName: isChipotle ? 'Chipotle chips and guacamole estimate' : 'Chips and guacamole common estimate',
        },
        message,
      ),
    );
  }

  if (!/\bchips?\b/.test(normalized) && /\bguac(?:amole)?\b/.test(normalized)) {
    const isChipotle = /\bchipotle\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: 'guacamole',
          label: isChipotle ? 'Chipotle guacamole' : 'Guacamole',
          quantity: 1,
          unit: 'serving',
          calories: 230,
          protein: 2,
          carbs: 8,
          fat: 22,
          fiber: 6,
          sugar: 1,
          sodium: 370,
          sourceName: isChipotle ? 'Chipotle guacamole estimate' : 'Guacamole common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bcottage cheese\b/.test(normalized)) {
    const serving = parseLeadingServingFood(message);
    const gramMatch = lower.match(/\b(\d+(?:\.\d+)?)\s*(?:g|grams?)\b/) ?? lower.match(/\b(?:about|around)\s+(\d+(?:\.\d+)?)\b/);
    const grams = gramMatch ? Number(gramMatch[1]) : null;
    const isLowFat = /\blow fat\b|\blowfat\b|\b2%\b/.test(normalized);
    const isDaisy = /\bdaisy\b/.test(normalized);
    const cupQuantity = serving?.unit === 'cup' && serving.quantity > 0 ? serving.quantity : 0.5;
    const quantity = grams && Number.isFinite(grams) && grams > 0 ? grams : cupQuantity;
    const unit = grams && Number.isFinite(grams) && grams > 0 ? 'g' : 'cup';
    const multiplier = grams && Number.isFinite(grams) && grams > 0 ? grams / 113 : cupQuantity / 0.5;
    const label = `${isDaisy ? 'Daisy ' : ''}${isLowFat ? 'Low fat ' : ''}cottage cheese`
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (char) => char.toUpperCase());

    items.push(
      makeGenericEstimate(
        {
          key: 'cottage cheese',
          label,
          quantity,
          unit,
          calories: 90 * multiplier,
          protein: 13 * multiplier,
          carbs: 4 * multiplier,
          fat: (isLowFat ? 2.5 : 5) * multiplier,
          sugar: 3 * multiplier,
          sodium: 350 * multiplier,
          sourceName: 'Cottage cheese common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bpickles?\b/.test(normalized)) {
    const countMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s+pickles?\b/) ?? normalized.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+pickles?\b/);
    const quantity = countMatch ? parseCount(countMatch[1] ?? '1') : 1;

    items.push(
      makeGenericEstimate(
        {
          key: 'pickles',
          label: 'Pickles',
          quantity,
          unit: quantity === 1 ? 'pickle' : 'pickles',
          calories: quantity * 5,
          protein: 0,
          carbs: quantity * 1,
          fat: 0,
          fiber: 0,
          sugar: 0,
          sodium: quantity * 280,
          sourceName: 'Pickle common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bbananas?\b/.test(normalized)) {
    const quantity = readPortionQuantity('bananas?', 1);
    items.push(
      makeGenericEstimate(
        {
          key: 'banana',
          label: quantity === 1 ? 'Banana' : 'Bananas',
          quantity,
          unit: quantity === 1 ? 'banana' : 'bananas',
          calories: quantity * 105,
          protein: quantity * 1.3,
          carbs: quantity * 27,
          fat: quantity * 0.4,
          fiber: quantity * 3,
          sugar: quantity * 14,
          sodium: quantity * 1,
          sourceName: 'Banana common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bapples?\b/.test(normalized)) {
    const quantity = readCountBefore('apples?', 1);
    items.push(
      makeGenericEstimate(
        {
          key: 'apple',
          label: quantity === 1 ? 'Apple' : 'Apples',
          quantity,
          unit: quantity === 1 ? 'apple' : 'apples',
          calories: quantity * 95,
          protein: quantity * 0.5,
          carbs: quantity * 25,
          fat: quantity * 0.3,
          fiber: quantity * 4,
          sugar: quantity * 19,
          sodium: quantity * 2,
          sourceName: 'Apple common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bpeanut butter\b/.test(normalized)) {
    const serving = parseLeadingServingFood(message);
    const spoonMatch = normalized.match(/\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+(tbsp|tablespoons?|tsp|teaspoons?)\s+(?:of\s+)?peanut butter\b/);
    const quantity = serving?.unit && /^(?:tbsp|tsp)$/.test(serving.unit)
      ? serving.quantity
      : spoonMatch ? parseCount(spoonMatch[1] ?? '1') : 1;
    const unit = serving?.unit && /^(?:tbsp|tsp)$/.test(serving.unit)
      ? serving.unit
      : normalizeQuantityUnit(spoonMatch?.[2]) ?? 'tbsp';
    const tablespoonEquivalent = unit === 'tsp' ? quantity / 3 : quantity;
    items.push(
      makeGenericEstimate(
        {
          key: 'peanut butter',
          label: 'Peanut butter',
          quantity,
          unit,
          calories: tablespoonEquivalent * 95,
          protein: tablespoonEquivalent * 4,
          carbs: tablespoonEquivalent * 3,
          fat: tablespoonEquivalent * 8,
          fiber: tablespoonEquivalent * 1,
          sugar: tablespoonEquivalent * 1,
          sodium: tablespoonEquivalent * 75,
          sourceName: 'Peanut butter common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\b(?:whey|protein powder)\b/.test(normalized)) {
    const serving = parseLeadingServingFood(message);
    const scoopMatch = normalized.match(/\b(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+scoops?\s+(?:of\s+)?(?:whey|protein powder)\b/);
    const quantity = serving?.unit === 'scoop'
      ? serving.quantity
      : scoopMatch ? parseCount(scoopMatch[1] ?? '1') : 1;
    const isWhey = /\bwhey\b/.test(normalized);

    items.push(
      makeGenericEstimate(
        {
          key: 'whey protein powder',
          label: isWhey ? 'Whey protein powder' : 'Protein powder',
          quantity,
          unit: quantity === 1 ? 'scoop' : 'scoops',
          calories: quantity * 120,
          protein: quantity * 24,
          carbs: quantity * 3,
          fat: quantity * 2,
          fiber: quantity * 1,
          sugar: quantity * 1,
          sodium: quantity * 160,
          sourceName: isWhey ? 'Whey protein common serving estimate' : 'Protein powder common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\brice cakes?\b/.test(normalized)) {
    const quantity = readCountBefore('rice cakes?', 1);
    const isQuaker = /\bquaker\b/.test(normalized);
    const isWhiteCheddar = /\bwhite cheddar\b/.test(normalized);
    const isCaramel = /\bcaramel\b/.test(normalized);
    const flavor = isWhiteCheddar ? 'White cheddar ' : isCaramel ? 'Caramel ' : '';
    items.push(
      makeGenericEstimate(
        {
          key: 'rice cakes',
          label: `${isQuaker ? 'Quaker ' : ''}${flavor}rice cakes`.replace(/^./, (char) => char.toUpperCase()),
          quantity,
          unit: quantity === 1 ? 'cake' : 'cakes',
          calories: quantity * (isWhiteCheddar ? 45 : 35),
          protein: quantity * 1,
          carbs: quantity * (isWhiteCheddar ? 9 : 7),
          fat: quantity * (isWhiteCheddar ? 1.5 : 0),
          fiber: quantity * 0.5,
          sodium: quantity * (isWhiteCheddar ? 100 : 15),
          sourceName: isQuaker ? 'Quaker-style rice cake estimate' : 'Rice cake common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\brice\b/.test(normalized) && !/\brice cakes?\b/.test(normalized) && !/\bchipotle\b/.test(normalized)) {
    const quantity = readCountBefore('cups?\\s+(?:of\\s+)?rice|rice', 1);
    items.push(
      makeGenericEstimate(
        {
          key: 'rice',
          label: 'Rice',
          quantity,
          unit: quantity === 1 ? 'cup' : 'cups',
          calories: 205 * quantity,
          protein: 4 * quantity,
          carbs: 45 * quantity,
          fat: 0.5 * quantity,
          sodium: 2 * quantity,
          sourceName: 'Rice common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\b(?:fairlife|core power|protein shake|shake)\b/.test(normalized) && /\b(?:shake|core power|fairlife)\b/.test(normalized)) {
    const isElite = /\belite\b|\b42g\b|\b42\s*(?:gram|grams|g)\b/.test(normalized);
    const isFairlife = /\bfairlife\b|\bcore power\b/.test(normalized);
    const isChocolate = /\bchocolate\b/.test(normalized);
    items.push(
      makeGenericEstimate(
        {
          key: isElite ? 'fairlife core power elite' : 'protein shake',
          label: isElite
            ? 'Fairlife Core Power Elite 42g Protein Shake'
            : isFairlife
              ? `Fairlife ${isChocolate ? 'chocolate ' : ''}protein shake`
              : 'Protein shake',
          quantity: 1,
          unit: 'bottle',
          calories: isElite ? 230 : 150,
          protein: isElite ? 42 : 30,
          carbs: isElite ? 8 : 4,
          fat: isElite ? 3.5 : 2.5,
          fiber: isElite ? 1 : 0,
          sugar: isElite ? 7 : 2,
          sodium: isElite ? 260 : 180,
          sourceName: isFairlife ? 'Fairlife nutrition reference' : 'Protein shake common serving estimate',
          sourceType: isFairlife ? 'GENERIC_REFERENCE' : 'AI_ESTIMATE',
          matchType: isFairlife ? 'exact_branded' : undefined,
        },
        message,
      ),
    );
  }

  if (/\bprotein bars?\b/.test(normalized) && !/\bquest\b/.test(normalized)) {
    const quantity = readCountBefore('protein bars?', 1);
    items.push(
      makeGenericEstimate(
        {
          key: 'protein bar',
          label: quantity === 1 ? 'Protein bar' : 'Protein bars',
          quantity,
          unit: quantity === 1 ? 'bar' : 'bars',
          calories: quantity * 200,
          protein: quantity * 20,
          carbs: quantity * 22,
          fat: quantity * 7,
          fiber: quantity * 5,
          sugar: quantity * 4,
          sodium: quantity * 180,
          sourceName: 'Protein bar common serving estimate',
        },
        message,
      ),
    );
  }

  if (/\bquest\b/.test(normalized) && /\bbar\b/.test(normalized)) {
    const quantity = readCountBefore('(?:quest\\s+)?protein bars?', 1);
    items.push(
      makeGenericEstimate(
        {
          key: 'quest protein bar',
          label: 'Quest protein bar',
          quantity,
          unit: quantity === 1 ? 'bar' : 'bars',
          calories: 200 * quantity,
          protein: 20 * quantity,
          carbs: 22 * quantity,
          fat: 8 * quantity,
          fiber: 13 * quantity,
          sugar: 1 * quantity,
          sodium: 210 * quantity,
          sourceName: 'Quest-style protein bar estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\bchick[- ]?fil[- ]?a\b/.test(normalized) && /\bnuggets?\b/.test(normalized)) {
    const quantity = readCountBefore('(?:count\\s+)?nuggets?', /\b8\b/.test(normalized) ? 8 : 1);
    const count = quantity > 1 ? quantity : 8;
    items.push(
      makeGenericEstimate(
        {
          key: 'chick-fil-a nuggets',
          label: 'Chick-fil-A Nuggets',
          quantity: count,
          unit: 'nuggets',
          calories: (250 / 8) * count,
          protein: (27 / 8) * count,
          carbs: (11 / 8) * count,
          fat: (11 / 8) * count,
          sodium: (1210 / 8) * count,
          sourceName: 'Chick-fil-A official nutrition',
          sourceType: 'OFFICIAL_RESTAURANT',
        },
        message,
      ),
    );
  }

  if (/\bsteak\b/.test(normalized)) {
    const quantity = readCountBefore('(?:oz\\s+(?:of\\s+)?)?steak', 1);
    const isOunceServing = /\b\d+(?:\.\d+)?\s*oz\b/.test(normalized);
    const multiplier = isOunceServing ? quantity / 4 : quantity;
    items.push(
      makeGenericEstimate(
        {
          key: 'steak',
          label: 'Steak',
          quantity: isOunceServing ? quantity : 1,
          unit: isOunceServing ? 'oz' : 'serving',
          calories: 280 * multiplier,
          protein: 28 * multiplier,
          carbs: 0,
          fat: 18 * multiplier,
          sodium: 75 * multiplier,
          sourceName: 'Steak common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\bbaked (?:potato|potatoes)\b/.test(normalized)) {
    const isLarge = /\blarge\b/.test(normalized);
    const multiplier = isLarge ? 1.75 : 1;
    items.push(
      makeGenericEstimate(
        {
          key: 'baked potato',
          label: 'Baked potato',
          quantity: 1,
          unit: isLarge ? 'large potato' : 'potato',
          calories: 160 * multiplier,
          protein: 4 * multiplier,
          carbs: 37 * multiplier,
          fat: 0.2 * multiplier,
          fiber: 4 * multiplier,
          sugar: 2 * multiplier,
          sodium: 20 * multiplier,
          sourceName: 'Baked potato common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  } else if (/\bpotatoes\b|\bpotato\b/.test(normalized)) {
    const cupMatch = normalized.match(/\b(\d+(?:\.\d+)?|\.\d+|one|two|three|four|half|a half)\s+cups?\s+(?:of\s+)?potatoes\b/);
    const quantity = cupMatch ? parseCount(cupMatch[1] ?? '1') : 1;
    items.push(
      makeGenericEstimate(
        {
          key: 'potatoes',
          label: 'Potatoes',
          quantity,
          unit: quantity === 1 ? 'cup' : 'cups',
          calories: 160 * quantity,
          protein: 4 * quantity,
          carbs: 37 * quantity,
          fat: 0.2 * quantity,
          fiber: 4 * quantity,
          sugar: 2 * quantity,
          sodium: 20 * quantity,
          sourceName: 'Potatoes common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\branch\b/.test(normalized)) {
    items.push(
      makeGenericEstimate(
        {
          key: 'ranch',
          label: 'Ranch',
          quantity: 1,
          unit: 'serving',
          calories: 130,
          protein: 0,
          carbs: 2,
          fat: 14,
          sodium: 260,
          sourceName: 'Ranch common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  if (/\bmuffins?\b/.test(normalized)) {
    const quantity = readCountBefore('muffins?', 1);
    items.push(
      makeGenericEstimate(
        {
          key: 'muffin',
          label: quantity === 1 ? 'Muffin' : 'Muffins',
          quantity,
          unit: quantity === 1 ? 'muffin' : 'muffins',
          calories: 330 * quantity,
          protein: 5 * quantity,
          carbs: 52 * quantity,
          fat: 12 * quantity,
          fiber: 2 * quantity,
          sugar: 28 * quantity,
          sodium: 340 * quantity,
          sourceName: 'Muffin common serving estimate',
          sourceType: 'GENERIC_REFERENCE',
        },
        message,
      ),
    );
  }

  return sortKnownEstimateItems(dedupeParsedItems(items), message);
}

function resolvePizzaClarificationEstimate(message: string, state: MealAssistantState): ParsedFoodItem[] {
  const pendingQuestion = `${state.pendingClarification ?? ''} ${state.lastAssistantQuestion ?? ''}`;
  const normalizedPendingQuestion = normalizeFoodText(pendingQuestion);
  if (!/\bpizza\b/.test(normalizedPendingQuestion)) {
    return [];
  }

  const normalized = normalizeFoodText(message);
  const isLittleCaesars = /\blittle caesars?\b/.test(normalizedPendingQuestion);

  if (
    /^(?:a |the )?(?:whole|entire) (?:little caesars |cheese |pepperoni )?(?:pizza|pie)$/.test(normalized) ||
    /\b(?:whole|entire) (?:little caesars |cheese |pepperoni )?(?:pizza|pie)\b/.test(normalized)
  ) {
    return [
      makeGenericEstimate(
        {
          key: 'whole pizza',
          label: isLittleCaesars ? 'Little Caesars pizza' : 'Pizza',
          quantity: 1,
          unit: 'pizza',
          calories: 2280,
          protein: 96,
          carbs: 288,
          fat: 80,
          fiber: 16,
          sugar: 32,
          sodium: 5120,
          sourceName: isLittleCaesars ? 'Little Caesars-style fallback estimate' : 'Generic whole pizza fallback estimate',
        },
        `${isLittleCaesars ? 'whole Little Caesars pizza' : 'whole pizza'}`,
      ),
    ];
  }

  const countMatch = normalized.match(/^(?:about |around )?(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten)(?: slices?| pieces?)?$/);
  if (!countMatch) {
    return [];
  }

  const quantity = parseCount(countMatch[1] ?? '1');

  return [
    makeGenericEstimate(
      {
        key: 'pizza',
        label: isLittleCaesars ? 'Little Caesars pizza' : 'Pizza',
        quantity,
        unit: quantity === 1 ? 'slice' : 'slices',
        calories: quantity * 285,
        protein: quantity * 12,
        carbs: quantity * 36,
        fat: quantity * 10,
        fiber: quantity * 2,
        sugar: quantity * 4,
        sodium: quantity * 640,
        sourceName: isLittleCaesars ? 'Little Caesars-style fallback estimate' : 'Generic pizza slice fallback estimate',
      },
      `${quantity} ${quantity === 1 ? 'slice' : 'slices'} of ${isLittleCaesars ? 'Little Caesars ' : ''}pizza`,
    ),
  ];
}

function detectChipotleBowlEstimate(message: string): ParsedFoodItem | null {
  const normalized = normalizeText(message);
  if (!/\bchipotle\b/.test(normalized)) {
    return null;
  }

  const hasBowl = /\bbowl\b/.test(normalized);
  const hasBaseComponent = /\b(?:white rice|brown rice|rice|black beans|pinto beans|beans|fajita(?: veggies| vegetables)?)\b/.test(normalized);
  const hasProteinComponent = /\b(?:double chicken|chicken)\b/.test(normalized);

  const components: string[] = [];
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;
  let sugar = 0;
  let sodium = 0;

  const add = (label: string, values: { calories: number; protein: number; carbs: number; fat: number; fiber?: number; sugar?: number; sodium?: number }) => {
    components.push(label);
    calories += values.calories;
    protein += values.protein;
    carbs += values.carbs;
    fat += values.fat;
    fiber += values.fiber ?? 0;
    sugar += values.sugar ?? 0;
    sodium += values.sodium ?? 0;
  };

  if (/\bwhite rice\b/.test(normalized)) add('white rice', { calories: 210, protein: 4, carbs: 40, fat: 4, fiber: 1, sodium: 350 });
  else if (/\bbrown rice\b/.test(normalized)) add('brown rice', { calories: 210, protein: 4, carbs: 36, fat: 6, fiber: 2, sodium: 190 });
  else if (/\brice\b/.test(normalized)) add('rice', { calories: 210, protein: 4, carbs: 40, fat: 4, fiber: 1, sodium: 350 });

  if (/\bdouble chicken\b/.test(normalized)) add('double chicken', { calories: 360, protein: 64, carbs: 0, fat: 14, sodium: 620 });
  else if (/\bchicken\b/.test(normalized)) add('chicken', { calories: 180, protein: 32, carbs: 0, fat: 7, sodium: 310 });

  if (hasBowl && hasProteinComponent && !hasBaseComponent) {
    add('white rice', { calories: 210, protein: 4, carbs: 40, fat: 4, fiber: 1, sodium: 350 });
    add('black beans', { calories: 130, protein: 8, carbs: 22, fat: 1.5, fiber: 8, sodium: 210 });
  }

  if (/\bcheese\b/.test(normalized)) add('cheese', { calories: 110, protein: 6, carbs: 1, fat: 8, sodium: 190 });
  if (/\bcorn(?: salsa)?\b/.test(normalized)) add('corn salsa', { calories: 80, protein: 3, carbs: 16, fat: 1.5, fiber: 3, sugar: 4, sodium: 330 });
  if (/\blettuce\b/.test(normalized)) add('lettuce', { calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 1, sodium: 0 });
  if (/\bgreen salsa\b|\btomatillo green\b/.test(normalized)) add('green salsa', { calories: 15, protein: 0, carbs: 4, fat: 0, fiber: 1, sugar: 2, sodium: 260 });
  if (/\bsalsa\b/.test(normalized) && !/\bcorn salsa\b|\bgreen salsa\b|\btomatillo green\b/.test(normalized)) add('salsa', { calories: 25, protein: 0, carbs: 4, fat: 0, fiber: 1, sugar: 2, sodium: 260 });
  if (/\bblack beans\b/.test(normalized)) add('black beans', { calories: 130, protein: 8, carbs: 22, fat: 1.5, fiber: 8, sodium: 210 });
  if (/\bpinto beans\b/.test(normalized)) add('pinto beans', { calories: 130, protein: 8, carbs: 21, fat: 1.5, fiber: 8, sodium: 210 });
  if (/\bfajita(?: veggies| vegetables)?\b/.test(normalized)) add('fajita veggies', { calories: 20, protein: 1, carbs: 5, fat: 0, fiber: 2, sodium: 170 });
  if (/\bsour cream\b/.test(normalized)) add('sour cream', { calories: 110, protein: 2, carbs: 2, fat: 9, sodium: 30 });
  if (/\bguac(?:amole)?\b/.test(normalized)) add('guacamole', { calories: 230, protein: 2, carbs: 8, fat: 22, fiber: 6, sodium: 370 });
  if (/\b(?:extra\s+)?sauce\b/.test(normalized)) add('sauce', { calories: 50, protein: 0, carbs: 6, fat: 2, sugar: 2, sodium: 220 });

  if (components.length < 1) {
    if (/\bchipotle\b/.test(normalized) && /\bbowl\b/.test(normalized)) {
      return makeGenericEstimate(
        {
          key: 'chipotle bowl',
          label: 'Chipotle bowl',
          quantity: 1,
          unit: 'bowl',
          calories: 670,
          protein: 43,
          carbs: 65,
          fat: 24,
          fiber: 9,
          sugar: 4,
          sodium: 1290,
          sourceName: 'Chipotle bowl fallback estimate',
          sourceType: 'OFFICIAL_RESTAURANT',
          notes: 'Fallback estimate for a typical Chipotle bowl when the exact ingredients were not specified.',
        },
        message,
      );
    }

    return null;
  }

  return makeGenericEstimate(
    {
      key: 'chipotle bowl',
      label: components.length === 1 ? `Chipotle ${components[0]} bowl` : `Chipotle bowl with ${components.join(', ')}`,
      quantity: 1,
      unit: 'bowl',
      calories,
      protein,
      carbs,
      fat,
      fiber,
      sugar,
      sodium,
      sourceName: 'Chipotle official nutrition',
      sourceType: 'OFFICIAL_RESTAURANT',
      notes: 'Built from Chipotle official component nutrition. Adjust if portions or toppings differ.',
    },
    message,
  );
}

function itemTextForCoverage(items: ParsedFoodItem[]) {
  return normalizeText(items.map((item) => [item.food_name, item.matched_query, item.notes].filter(Boolean).join(' ')).join(' '));
}

function itemCoversTerm(items: ParsedFoodItem[], term: string) {
  const haystack = itemTextForCoverage(items);
  return normalizeText(term)
    .split(' ')
    .every((token) => haystack.includes(token));
}

function shouldTryOnlineHydration(item: ParsedFoodItem) {
  if (process.env.NODE_ENV === 'test' && !process.env.USDA_FDC_API_KEY && !process.env.FDC_API_KEY) {
    return false;
  }

  return (
    item.source_type === 'AI_ESTIMATE' &&
    !/\b(?:pizza|little caesars|chipotle bowl|wendy|coke zero|rice cakes?|blueberries|greek yogurt|peanut butter|hash browns?|turkey sausage|fairlife|core power|guac(?:amole)?|chips with guac|chips with guacamole)\b/i.test(`${item.food_name} ${item.source_name ?? ''}`)
  );
}

function isNoisyHydrationMatch(originalItem: ParsedFoodItem, resolvedItem: ParsedFoodItem) {
  const original = normalizeFoodText(`${originalItem.food_name} ${originalItem.original_user_text ?? ''}`);
  const resolved = normalizeFoodText(`${resolvedItem.food_name} ${resolvedItem.matched_query ?? ''} ${resolvedItem.notes ?? ''}`);
  const addedQualifierTerms = ['oats', 'granola', 'strawberry', 'strawberries', 'banana', 'chocolate', 'honey', 'fruit', 'vegetable', 'vegetables'];

  if (!original || !resolved) {
    return false;
  }

  return addedQualifierTerms.some((term) => resolved.includes(term) && !original.includes(term));
}

function buildKnownEstimateLookupText(item: ParsedFoodItem) {
  const quantity = formatDisplayQuantity(item.quantity);
  const unit = item.unit?.trim() ?? '';

  if (unit && !/^(?:serving|servings|meal|meals|count|counts)$/i.test(unit)) {
    return `${quantity} ${unit} ${item.food_name}`.replace(/\s+/g, ' ').trim();
  }

  return `${quantity} ${item.food_name}`.replace(/\s+/g, ' ').trim();
}

async function hydrateKnownEstimatesWithProviders(items: ParsedFoodItem[], mealType: MealAssistantState['mealType']) {
  const hydrated: ParsedFoodItem[] = [];

  for (const item of items) {
    if (!shouldTryOnlineHydration(item)) {
      hydrated.push(item);
      continue;
    }

    const resolved = await resolveNutritionEstimate({
      text: buildKnownEstimateLookupText(item),
      mealType,
    });
    const resolvedItem = resolved?.items[0] ?? null;

    if (resolvedItem && itemCoversTerm([resolvedItem], item.food_name) && !isNoisyHydrationMatch(item, resolvedItem)) {
      hydrated.push(resolvedItem);
      continue;
    }

    hydrated.push(item);
  }

  return hydrated;
}

const restaurantIdentityCues = [
  { brand: "Applebee's", message: /\bapplebee'?s?\b|\bapplebees\b/, item: /\bapplebee\b/ },
  { brand: "Arby's", message: /\barby'?s?\b|\barbys\b|\barby\b/, item: /\barby\b|\broast beef\b|\bbeef and cheddar\b/ },
  { brand: 'Buffalo Wild Wings', message: /\bbuffalo\s*wild\s*wings\b|\bbdubs\b/, item: /\bbuffalo wild wings\b|\bbdubs\b/ },
  { brand: 'Burger King', message: /\bburger\s*king\b|\bburgerking\b|\bwhopper\b/, item: /\bburger\s*king\b|\bwhopper\b/ },
  { brand: 'Chick-fil-A', message: /\bchic?k\s*fil\s*a\b|\bchic?kfila\b/, item: /\bchick\s*fil\s*a\b|\bchickfila\b/ },
  { brand: 'Chipotle', message: /\bchipotle\b|\bchipolte\b/, item: /\bchipotle\b|\bbowl\b/ },
  { brand: "Domino's", message: /\bdomino'?s?\b|\bdominos\b|\bdomino\b/, item: /\bdomino\b/ },
  { brand: 'Dunkin', message: /\bdunkin\b/, item: /\bdunkin\b/ },
  { brand: 'Five Guys', message: /\bfive\s*guys\b|\bfiveguys\b/, item: /\bfive\s*guys\b/ },
  { brand: 'IHOP', message: /\bihop\b/, item: /\bihop\b/ },
  { brand: "Jersey Mike's", message: /\bjersey\s*mike'?s?\b|\bjerseymikes\b/, item: /\bjersey\s*mike\b/ },
  { brand: "Jimmy John's", message: /\bjimmy\s*john'?s?\b|\bjimmyjohns\b/, item: /\bjimmy\s*john\b/ },
  { brand: 'KFC', message: /\bkfc\b/, item: /\bkfc\b/ },
  { brand: "McDonald's", message: /\bmc\s*donald'?s?\b|\bmcdonalds?\b|\bmcdouble\b|\bmc\s*double\b|\bmcchicken\b|\bbig\s*mac\b/, item: /\bmcdonald\b|\bmcdouble\b|\bmcchicken\b|\bbig\s*mac\b/ },
  { brand: 'Olive Garden', message: /\bolive\s*garden\b|\bolivegarden\b/, item: /\bolive\s*garden\b/ },
  { brand: 'Panera', message: /\bpanera\b/, item: /\bpanera\b/ },
  { brand: 'Panda Express', message: /\bpanda\s*express\b|\bpandaexpress\b/, item: /\bpanda\s*express\b|\borange chicken\b|\bchow mein\b|\bbroccoli beef\b/ },
  { brand: "Papa John's", message: /\bpapa\s*john'?s?\b|\bpapajohns\b/, item: /\bpapa\s*john\b/ },
  { brand: 'Pizza Hut', message: /\bpizza\s*hut\b|\bpizzahut\b/, item: /\bpizza\s*hut\b/ },
  { brand: 'Popeyes', message: /\bpopeyes\b/, item: /\bpopeyes\b/ },
  { brand: 'Qdoba', message: /\bqdoba\b/, item: /\bqdoba\b/ },
  { brand: "Raising Cane's", message: /\braising\s*cane'?s?\b|\braisingcanes\b|\bcanes\b/, item: /\braising\s*cane\b|\bcane s\b|\bcaniac\b|\bbox combo\b/ },
  { brand: 'Starbucks', message: /\bstarbucks\b/, item: /\bstarbucks\b/ },
  { brand: 'Subway', message: /\bsubway\b/, item: /\bsubway\b|\bfootlong\b|\b6 inch\b|\bmeatball\b|\bbmt\b/ },
  { brand: 'Taco Bell', message: /\btaco\s*bell\b|\btacobell\b/, item: /\btaco\s*bell\b|\bcrunchwrap\b/ },
  { brand: 'Texas Roadhouse', message: /\btexas\s*roadhouse\b|\btexasroadhouse\b/, item: /\btexas\s*roadhouse\b/ },
  { brand: 'Waffle House', message: /\bwaffle\s*house\b|\bwafflehouse\b/, item: /\bwaffle\s*house\b/ },
  { brand: "Wendy's", message: /\bwendy'?s?\b|\bwendys\b|\bbacon+nator\b/, item: /\bwendy\b|\bbaconator\b|\bspicy chicken\b/ },
  { brand: 'White Castle', message: /\bwhite\s*castle\b|\bwhitecastle\b/, item: /\bwhite\s*castle\b|\bslider\b/ },
  { brand: 'Wingstop', message: /\bwingstop\b/, item: /\bwingstop\b/ },
] as const;

function detectRestaurantCue(message: string) {
  const normalized = normalizeFoodText(message);
  const compact = normalized.replace(/[^a-z0-9]+/g, '');
  return restaurantIdentityCues.find((cue) => cue.message.test(normalized) || cue.message.test(compact)) ?? null;
}

function messageHasRestaurantCue(message: string) {
  return Boolean(detectRestaurantCue(message));
}

function officialItemsMatchRestaurantCue(items: ParsedFoodItem[], cue: (typeof restaurantIdentityCues)[number]) {
  const officialItems = items.filter((item) => item.source_type === 'OFFICIAL_RESTAURANT');
  return officialItems.length > 0 && officialItems.every((item) => {
    const itemText = normalizeFoodText(`${item.food_name} ${item.source_name ?? ''} ${item.notes ?? ''} ${item.matched_query ?? ''}`);
    return cue.item.test(itemText);
  });
}

function hasHighPriorityBrandedCatalogMatch(items: ParsedFoodItem[]) {
  return items.some((item) => item.match_type === 'exact_branded' || item.match_type === 'fuzzy_branded');
}

function messageHasPackagedBrandCue(message: string) {
  return /\b(?:barebells?|celsius|cheez[-\s]?it|chobani|chobanni|clif|coke zero|coca cola|core power|david|doritos|dorittos|dr pepper|dr peper|fairlife|gatorade|goldfish|gold fish|kodiak|kodiac|legendary|legendairy|muscle milk|musclemilk|nature valley|oikos|pop[-\s]?tarts?|poptarts?|premier protein|pure protein|quest|quaker|rxbar|rx bar|trader joe'?s)\b/i.test(message);
}

function messageHasProtectedRestaurantCatalogCue(message: string) {
  return /\bmc\s*donald'?s?|\bmcdonalds?\b/i.test(message) && /\bfr(?:y|ies)\b/i.test(message);
}

function messageNeedsForcedTrustedCatalogMatch(message: string) {
  return messageHasProtectedRestaurantCatalogCue(message)
    || (/\bdavid\b/i.test(message) && /\branch\b/i.test(message) && /\b(?:flavou?r|sunflower|seeds?)\b/i.test(message))
    || (/\bquest\b/i.test(message) && /\bcookies?\b/i.test(message))
    || /\bskittles?\b/i.test(message);
}

function shouldUseDirectCorrectionReplacement(foodText: string, state: MealAssistantState) {
  return messageNeedsForcedTrustedCatalogMatch(foodText)
    || (/\brice cakes?\b/i.test(foodText) && state.currentMealItems.some((item) => /\brice cakes?\b/i.test(item.food_name)));
}

function knownItemsAlreadyHaveReliableBrandMatch(items: ParsedFoodItem[]) {
  return items.some((item) => item.match_type === 'exact_branded' || item.match_type === 'fuzzy_branded');
}

function shouldPreferTrustedRestaurantFallback(message: string) {
  const normalized = normalizeFoodText(message);
  if (/\bchipotle\b/.test(normalized)) return false;
  if (/\bmcdonalds?\b|\bmc donald\b/.test(normalized) && /\bfr(?:y|ies)\b/.test(normalized)) return false;
  return true;
}

const trustedFallbackCoverageStopWords = new Set([
  'and',
  'around',
  'classic',
  'from',
  'later',
  'large',
  'medium',
  'order',
  'serving',
  'small',
  'the',
  'with',
]);

function getFoodCoverageTokens(item: ParsedFoodItem) {
  return normalizeFoodText(item.food_name)
    .split(' ')
    .filter((token) => token.length > 2 && !trustedFallbackCoverageStopWords.has(token));
}

function trustedItemsCoverKnownItem(knownItem: ParsedFoodItem, trustedHaystack: string) {
  const tokens = getFoodCoverageTokens(knownItem);
  return tokens.length > 0 && tokens.every((token) => trustedHaystack.includes(token));
}

function trustedFallbackWouldDropKnownFood(knownItems: ParsedFoodItem[], trustedItems: ParsedFoodItem[]) {
  if (!knownItems.length || !trustedItems.length || knownItems.length <= trustedItems.length) {
    return false;
  }

  const trustedHaystack = normalizeFoodText(trustedItems.map((item) => item.food_name).join(' '));
  return knownItems.some((knownItem) => !trustedItemsCoverKnownItem(knownItem, trustedHaystack));
}

function detectKnownFoodEstimatesWithTrustedRestaurantFallback(message: string, mealType: MealAssistantState['mealType']) {
  const knownItems = detectKnownFoodEstimates(message);
  const trustedItems = getTrustedCatalogEstimate(message, mealType)?.items ?? [];
  const restaurantCue = detectRestaurantCue(message);
  const hasRestaurantCue = Boolean(restaurantCue);
  const trustedItemsMatchRestaurantCue = restaurantCue ? officialItemsMatchRestaurantCue(trustedItems, restaurantCue) : true;

  if (
    knownItems.length <= 1
    && messageHasPackagedBrandCue(message)
    && !knownItemsAlreadyHaveReliableBrandMatch(knownItems)
    && hasHighPriorityBrandedCatalogMatch(trustedItems)
  ) {
    return trustedItems;
  }

  if (hasRestaurantCue && knownItems.some((item) => item.source_type === 'OFFICIAL_RESTAURANT')) {
    if (!restaurantCue || officialItemsMatchRestaurantCue(knownItems, restaurantCue)) {
      return knownItems;
    }

    return trustedItemsMatchRestaurantCue ? trustedItems : [];
  }

  if (
    hasRestaurantCue
    && shouldPreferTrustedRestaurantFallback(message)
    && trustedItems.some((item) => item.source_type === 'OFFICIAL_RESTAURANT')
    && trustedItemsMatchRestaurantCue
    && !trustedFallbackWouldDropKnownFood(knownItems, trustedItems)
  ) {
    return trustedItems;
  }

  if (!knownItems.length || !hasRestaurantCue) {
    return knownItems;
  }

  return trustedItems.some((item) => item.source_type === 'OFFICIAL_RESTAURANT') && trustedItemsMatchRestaurantCue ? trustedItems : knownItems;
}

function shouldAskPizzaPortion(message: string, items: MealAssistantItem[]) {
  const normalized = normalizeFoodText(message);
  if (!/\bpizza\b/.test(normalized)) {
    return false;
  }
  if (/\b\d+(?:\.\d+)?\s+(?:slices?|pieces?)\b/.test(normalized)) {
    return false;
  }
  if (/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:slices?|pieces?)\b/.test(normalized)) {
    return false;
  }
  if (/\b(?:whole|entire)\s+(?:little caesars\s+|cheese\s+|pepperoni\s+)?(?:pizza|pie)\b/.test(normalized)) {
    return false;
  }
  return items.length <= 1;
}

function buildPizzaPortionQuestion(message: string) {
  const normalized = normalizeFoodText(message);
  if (/\blittle caesars?\b/.test(normalized)) {
    return 'For Little Caesars, was that one slice, a few slices, or a whole pizza?';
  }
  return 'How much pizza should I log, one slice, a few slices, or a whole pizza?';
}

function cleanOriginalFoodName(message: string) {
  return cleanMealReferenceText(stripEmotionalPreface(message)).replace(/^(?:log|add|track)\s+/i, '').replace(/\s+/g, ' ').trim() || 'Estimated food';
}

function isBadGenericResolvedItem(item: ParsedFoodItem) {
  return genericFallbackNameRegex.test(item.food_name) || (item.source_type === 'AI_ESTIMATE' && item.calories === 520 && item.protein === 30 && item.carbs === 45 && item.fat === 20);
}

function hardenResolvedItems(args: { message: string; resolvedItems: ParsedFoodItem[] }) {
  const { message, resolvedItems } = args;
  const chipotleEstimate = detectChipotleBowlEstimate(message);
  if (chipotleEstimate && (resolvedItems.length !== 1 || !/\bchipotle\b/i.test(resolvedItems[0]?.food_name ?? ''))) {
    return [chipotleEstimate];
  }

  let nextItems = [...resolvedItems];
  const knownEstimates = detectKnownFoodEstimates(message);

  if (nextItems.some(isBadGenericResolvedItem)) {
    nextItems = [];
  }

  if (knownEstimates.length && !messageHasRestaurantCue(message)) {
    nextItems = nextItems.filter(
      (item) =>
        item.source_type !== 'OFFICIAL_RESTAURANT' ||
        knownEstimates.some((estimate) => itemCoversTerm([item], estimate.food_name)),
    );
  }

  if (knownEstimates.some((estimate) => /\btoast\b/i.test(estimate.food_name))) {
    nextItems = nextItems.filter((item) => !/\bbread\b/i.test(item.food_name) || itemCoversTerm([item], 'toast'));
  }

  if (knownEstimates.some((estimate) => /\bpizza\b/i.test(estimate.food_name)) && !/\b(?:bread|breadsticks?|toast)\b/i.test(message)) {
    nextItems = nextItems.filter((item) => itemCoversTerm([item], 'pizza'));
  }

  if (knownEstimates.some((estimate) => /\bbaked potato\b/i.test(estimate.food_name))) {
    const hasSpecificBakedPotato = nextItems.some((item) => /\bpotato\b/i.test(item.food_name) && /\bbaked\b/i.test(item.food_name));
    if (hasSpecificBakedPotato) {
      nextItems = nextItems.filter((item) => (
        !/\b(?:potato|potatoes)\b/i.test(item.food_name) ||
        /\bbaked\b/i.test(item.food_name)
      ));
    }
  }

  for (const estimate of knownEstimates) {
    if (
      /\bchipotle\b/i.test(estimate.food_name)
      && /\bbowl\b/i.test(estimate.food_name)
      && nextItems.some((item) => /\bchipotle\b/i.test(item.food_name) && /\bbowl\b/i.test(item.food_name))
    ) {
      continue;
    }

    if (!itemCoversTerm(nextItems, estimate.food_name)) {
      nextItems.push(estimate);
    }
  }

  if (!nextItems.length && knownEstimates.length) {
    nextItems = knownEstimates;
  }

  if (nextItems.length === 1 && isBadGenericResolvedItem(nextItems[0])) {
    nextItems = [
      {
        ...nextItems[0],
        food_name: cleanOriginalFoodName(message),
        original_user_text: message,
        source_type: 'AI_ESTIMATE',
        source_name: 'Calorie Compass guarded fallback',
        confidence_label: 'Estimated',
        is_trusted: false,
        used_ai_fallback: true,
      },
    ];
  }

  if (
    nextItems.length === 1
    && !hasHighPriorityBrandedCatalogMatch(nextItems)
    && /\bwith\b|\band\b|,/.test(message)
    && !continuationRegex.test(message.trim())
    && !itemCoversTerm(nextItems, cleanOriginalFoodName(message))
  ) {
    const only = nextItems[0];
    if (!/\b(?:chipotle|pizza|bowl|meal|with)\b/i.test(only.food_name)) {
      nextItems = [
        {
          ...only,
          food_name: cleanOriginalFoodName(message),
          original_user_text: message,
          source_type: only.source_type === 'OFFICIAL_RESTAURANT' ? only.source_type : 'AI_ESTIMATE',
          source_name: only.source_name ?? 'Calorie Compass guarded fallback',
          confidence_label: only.confidence_label ?? 'Estimated',
        },
      ];
    }
  }

  nextItems = nextItems.map((item) => repairSuspiciousExplicitGramItem(message, item));

  return suppressNearDuplicateResolvedItems(dedupeParsedItems(nextItems), message);
}

function suppressNearDuplicateResolvedItems(items: ParsedFoodItem[], message: string) {
  const normalizedMessage = normalizeFoodText(message);
  let nextItems = [...items];

  if (/\bquest\b/.test(normalizedMessage) && /\bcookie\b/.test(normalizedMessage)) {
    const hasQuestCookie = nextItems.some((item) => /\bquest\b/i.test(item.food_name) && /\bcookie\b/i.test(item.food_name));
    if (hasQuestCookie) {
      nextItems = nextItems.filter((item) => !(/\bquest\b/i.test(item.food_name) && /\bbar\b/i.test(item.food_name)));
    }
  }

  if (/\bdavid\b/.test(normalizedMessage) && /\branch\b/.test(normalizedMessage) && /\bflavou?r\b/.test(normalizedMessage)) {
    const hasDavidSeeds = nextItems.some((item) => /\bdavid\b/i.test(item.food_name) && /\b(?:sunflower|seeds)\b/i.test(item.food_name));
    if (hasDavidSeeds) {
      nextItems = nextItems.filter((item) => !/^ranch$/i.test(item.food_name.trim()));
    }
  }

  if (/\bbaked (?:potato|potatoes)\b/.test(normalizedMessage)) {
    const hasSpecificBakedPotato = nextItems.some((item) => /\bpotato\b/i.test(item.food_name) && /\bbaked\b/i.test(item.food_name));
    if (hasSpecificBakedPotato) {
      nextItems = nextItems.filter((item) => (
        !/\b(?:potato|potatoes)\b/i.test(item.food_name) ||
        /\bbaked\b/i.test(item.food_name)
      ));
    }
  }

  return nextItems;
}

function buildFoodAwareFallbackReply(message: string, items: ParsedFoodItem[]) {
  const cleaned = cleanOriginalFoodName(message);

  if (!items.length) {
    if (/\bpizza\b/i.test(message)) {
      return buildPizzaPortionQuestion(message);
    }
    return `I can log ${cleaned}, but I need a little more detail for a reliable estimate.`;
  }

  const totalCalories = Math.round(sumTotals(items).calories);
  const foodLabel = items.length === 1 ? formatParsedItemLabel(items[0]) : items.map((item) => item.food_name).join(' and ');
  const sourceLabel = getCombinedSourceLabel(items);
  return `${foodLabel}, about ${totalCalories} calories total. ${sourceLabel}.`;
}

function getCombinedSourceLabel(items: ParsedFoodItem[]) {
  const labels = Array.from(new Set(items.map((item) => getSourceLabel(item))));
  if (labels.length === 1) {
    return labels[0] ?? 'Estimated';
  }
  return `Mixed sources: ${labels.join(' and ')}`;
}

function getConfidenceScore(items: ParsedFoodItem[]) {
  if (!items.length) {
    return 0.82;
  }

  if (items.every((item) => item.source_type === 'OFFICIAL_RESTAURANT')) {
    return 0.98;
  }

  if (items.every((item) => item.is_trusted && item.source_type !== 'AI_ESTIMATE')) {
    return 0.95;
  }

  if (items.some((item) => item.source_type === 'AI_ESTIMATE')) {
    return items.some((item) => item.is_trusted) ? 0.84 : 0.72;
  }

  return 0.9;
}

function getSourceLabel(item: ParsedFoodItem) {
  if (item.source_type === 'OFFICIAL_RESTAURANT') {
    return 'Restaurant verified';
  }

  const sourceName = item.source_name?.toLowerCase() ?? '';
  if (sourceName.includes('usda')) {
    return 'USDA match';
  }

  if (item.source_type === 'GENERIC_REFERENCE' && item.source_name && !sourceName.includes('generic')) {
    return 'Brand verified';
  }

  if (item.source_type === 'GENERIC_REFERENCE') {
    return 'Generic reference';
  }

  if (item.source_type === 'AI_ESTIMATE') {
    return 'Estimated';
  }

  return item.confidence_label ?? 'Estimated';
}

function scaleParsedItems(items: ParsedFoodItem[], nextQuantity: number) {
  if (!items.length) {
    return items;
  }

  const baseline = items[0]?.quantity && items[0].quantity > 0 ? items[0].quantity : 1;
  const factor = nextQuantity / baseline;

  return items.map((item) => ({
    ...item,
    quantity: Number((item.quantity * factor).toFixed(2)),
    calories: Number((item.calories * factor).toFixed(1)),
    protein: Number((item.protein * factor).toFixed(1)),
    carbs: Number((item.carbs * factor).toFixed(1)),
    fat: Number((item.fat * factor).toFixed(1)),
    fiber: Number((item.fiber * factor).toFixed(1)),
    sugar: Number((item.sugar * factor).toFixed(1)),
    sodium: Number((item.sodium * factor).toFixed(1)),
  }));
}

function cloneParsedItems(items: ParsedFoodItem[]) {
  return items.map((item) => ({ ...item }));
}

function findItemIndex(items: ParsedFoodItem[], target: string) {
  const normalizedTarget = normalizeText(target);
  if (!normalizedTarget) {
    return items.length ? items.length - 1 : -1;
  }

  if (/^(?:it|that|this)$/.test(normalizedTarget)) {
    return items.length ? items.length - 1 : -1;
  }

  return items.findIndex((item) => normalizeText(item.food_name).includes(normalizedTarget) || normalizedTarget.includes(normalizeText(item.food_name)));
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function choosePhrase(seed: string, variants: string[]) {
  return variants[hashText(seed) % variants.length] ?? variants[0] ?? '';
}

function cleanMealReferenceText(text: string | null | undefined) {
  const cleaned = (text ?? '')
    .trim()
    .replace(/^i\s+(?:had|ate|drank)\s+/i, '')
    .replace(/^for\s+(?:breakfast|lunch|dinner|a snack),?\s*/i, '')
    .replace(/^my\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.?!]+$/, '');

  return cleaned;
}

function stripEmotionalPreface(text: string) {
  return text.trim().replace(/^(?:ugh|oops|sorry|my bad|whoops|damn|dang|nvm|nevermind|never mind)[\s,!.-]+/i, '').trim();
}

function stripCorrectionLeadIn(text: string) {
  return text
    .trim()
    .replace(/^(?:oh|okay|ok|alright|well|yeah|yep|no|nah|nope|wait|hold on)[\s,!-]+/i, '')
    .replace(/^(?:actually|i meant|make that|change that to|change it to|update that to|update it to|instead)[\s,!-]+/i, '')
    .trim();
}

function buildMemoryReference(candidate: Pick<MemoryEntry, 'items' | 'title' | 'rawText'>) {
  const fallback = candidate.items.length === 1 ? candidate.items[0]?.food_name ?? candidate.title : candidate.title;
  return shorten(cleanMealReferenceText(candidate.rawText) || cleanMealReferenceText(candidate.title) || fallback || 'that meal');
}

function getRecentMealOccurredAt(meal: MealAssistantContext['recentMeals'][number]) {
  return meal.date ?? meal.createdAt ?? null;
}

function isQuestionLikeText(text: string) {
  return /^(?:how|what|why|when|where|who|am|is|are|can|should|would|did|do|wait|protein left|calories left|cals left|cal left|tonight idea|dinner idea)\b/i.test(text.trim());
}

function splitMixedIntentMessage(message: string): MixedIntentSplit {
  const trimmed = message.trim();
  const lines = trimmed
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1) {
    const firstQuestionIndex = lines.findIndex(isQuestionLikeText);
    const foodLines = firstQuestionIndex >= 0 ? lines.slice(0, firstQuestionIndex) : lines;
    const followUpLines = firstQuestionIndex >= 0 ? lines.slice(firstQuestionIndex) : [];
    const foodMessage = foodLines.join(' and ');
    const followUpMessage = followUpLines.join(' ');
    const leadTokens = tokenizeText(foodMessage);

    if (foodMessage && leadTokens.length && foodLines.every((line) => !isQuestionLikeText(line))) {
      if (!hasStrongFoodSignal(foodMessage) && followUpMessage && isNonFoodDialogueMessage(followUpMessage)) {
        return {
          foodMessage: null,
          followUpMessage: null,
        };
      }

      return {
        foodMessage,
        followUpMessage,
      };
    }
  }

  const match = trimmed.match(/^(.*?)(?:,?\s+(?:and\s+)?(?:also\s+)?)((?:how much|how many|what about|how about|what should|what's|what is|am i|did i|is that|would that|can i|protein left|calories left|cals left|cal left|tonight idea|dinner idea)\b.*)$/i);

  if (!match) {
    return { foodMessage: null, followUpMessage: null };
  }

  const foodMessage = match[1]?.trim() ?? '';
  const followUpMessage = match[2]?.trim() ?? '';

  const leadTokens = tokenizeText(foodMessage);
  if (!leadTokens.length || leadTokens.every((token) => ['how', 'what', 'why', 'when', 'where', 'who', 'am', 'is', 'are', 'can', 'should', 'would', 'did', 'do', 'wait'].includes(token))) {
    return { foodMessage: null, followUpMessage: null };
  }

  if (!foodMessage || !followUpMessage) {
    return { foodMessage: null, followUpMessage: null };
  }

  if (!hasStrongFoodSignal(foodMessage) && isNonFoodDialogueMessage(followUpMessage)) {
    return { foodMessage: null, followUpMessage: null };
  }

  return {
    foodMessage,
    followUpMessage,
  };
}

function isGenericReply(reply: string) {
  return /^(?:got it|okay|alright|makes sense|tell me what you ate|what did you have|send the meal whenever you’re ready|saved\.?)/i.test(reply.trim());
}

function getReplyOpening(reply: string) {
  return normalizeText(reply).split(' ').slice(0, 2).join(' ');
}

function isWeakStandaloneReply(reply: string) {
  return /^(?:got it|okay|ok|alright|makes sense|sounds good|sure|yep|yes)[.!]*$/i.test(reply.trim());
}

function startsWithWeakAcknowledgment(reply: string) {
  return /^(?:got it|okay|ok|alright|makes sense|sounds good|sure|yep)[,!. ]/i.test(reply.trim());
}

function buildContextualContinuityReply(state: MealAssistantState) {
  const lastItem = state.currentMealItems.at(-1);

  if (lastItem) {
    return `I have ${shorten(lastItem.food_name, 48)} in this meal. Send another item, a correction, or save it when you’re ready.`;
  }

  if (state.pendingClarification) {
    return `I just need one detail: ${state.pendingClarification}`;
  }

  return 'Tell me what you ate and I’ll break it down.';
}

function polishRepeatedOpening(reply: string, state: MealAssistantState) {
  if (!state.lastAssistantReply) {
    return reply;
  }

  const previousOpening = getReplyOpening(state.lastAssistantReply);
  const nextOpening = getReplyOpening(reply);

  if (!previousOpening || previousOpening !== nextOpening) {
    return reply;
  }

  if (isWeakStandaloneReply(reply)) {
    return buildContextualContinuityReply(state);
  }

  if (startsWithWeakAcknowledgment(reply)) {
    return reply.replace(/^(?:got it|okay|ok|alright|makes sense|sounds good|sure|yep)[,!. ]+/i, '');
  }

  const withoutIveGot = reply.replace(/^I(?:'|’)ve got\s+/i, '');
  if (withoutIveGot !== reply) {
    return `Logged ${withoutIveGot}`;
  }

  const withoutLooksLike = reply.replace(/^That looks like\s+/i, '');
  if (withoutLooksLike !== reply) {
    return `Logged ${withoutLooksLike}`;
  }

  const withoutAlrightIveGot = reply.replace(/^Alright,\s*I(?:'|’)ve got\s+/i, '');
  if (withoutAlrightIveGot !== reply) {
    return `Logged ${withoutAlrightIveGot}`;
  }

  return reply;
}

function buildCurrentMealMacroReply(message: string, state: MealAssistantState) {
  if (!state.currentMealItems.length) {
    return null;
  }

  const totals = sumTotals(state.currentMealItems);
  const normalized = message.trim().toLowerCase();

  if (carbsQuestionRegex.test(normalized) && (followUpMacroRegex.test(normalized) || /\bhow much|what(?:'s| is)|carbs?\?/i.test(normalized))) {
    return `That meal is sitting around ${Math.round(totals.carbs)}g carbs.`;
  }

  if (fatQuestionRegex.test(normalized) && (followUpMacroRegex.test(normalized) || /\bhow much|what(?:'s| is)|fat\?/i.test(normalized))) {
    return `That meal is around ${Math.round(totals.fat)}g fat.`;
  }

  if (proteinQuestionRegex.test(normalized) && followUpMacroRegex.test(normalized)) {
    return `That meal is around ${Math.round(totals.protein)}g protein.`;
  }

  if (caloriesQuestionRegex.test(normalized) && followUpMacroRegex.test(normalized)) {
    return `That meal is about ${Math.round(totals.calories)} calories.`;
  }

  return null;
}

function getRecommendationPreferenceTokens(context: MealAssistantContext) {
  return tokenizeText(context.nutritionPreferences ?? '').filter((token) => token.length > 2);
}

function inferRecommendationMealType(message: string, state: MealAssistantState): MealAssistantState['mealType'] | null {
  const normalized = stripEmotionalPreface(message).toLowerCase();
  const explicit = extractMealTypeHint(message);

  if (explicit) {
    return explicit;
  }

  if (dinnerSuggestionRegex.test(normalized)) {
    return 'dinner';
  }

  if (snackSuggestionRegex.test(normalized) || snackRoomRegex.test(normalized) || healthyTreatRegex.test(normalized) || sweetHealthyRegex.test(normalized)) {
    return 'snack';
  }

  if (/\b(?:sweet|dessert|treat)\b/.test(normalized)) {
    return 'snack';
  }

  if (/\bbreakfast\b/.test(normalized)) {
    return 'breakfast';
  }

  if (/\blunch\b/.test(normalized)) {
    return 'lunch';
  }

  if (isRecommendationFollowUpMessage(message, state) && state.previousUserMessage) {
    return inferRecommendationMealType(state.previousUserMessage, {
      ...state,
      previousUserMessage: null,
    });
  }

  return null;
}

function buildRecommendationProfile(input: MealAssistantRunInput, context: MealAssistantContext): RecommendationProfile | null {
  const normalized = stripEmotionalPreface(input.message).toLowerCase();
  const remainingCalories = getRemainingCalories(context);
  const remainingProtein = getRemainingProtein(context);
  const preferenceText = `${context.nutritionPreferences ?? ''} ${input.userPreferences ?? ''}`.toLowerCase();

  if (!isRecommendationRequestMessage(normalized) && !isRecommendationFollowUpMessage(input.message, input.state)) {
    return null;
  }

  const mealType = inferRecommendationMealType(input.message, input.state);
  const wantsSweet = sweetHealthyRegex.test(normalized) || /\b(?:sweet|dessert|treat)\b/.test(normalized);
  const wantsHighProtein = /\b(?:protein|high protein)\b/.test(normalized) || /\bhigh protein\b/.test(preferenceText);
  const wantsLight = lighterVersionRegex.test(normalized) || /\b(?:light|lighter|lean|lower calorie|low calorie)\b/.test(normalized);
  const wantsRestaurant = /\brestaurant\b/.test(normalized);
  const wantsQuick = /\b(?:quick|easy|fast|grab and go|on the go)\b/.test(normalized);
  const wantsHealthy = /\b(?:healthy|healthier|balanced|clean)\b/.test(normalized) || /\bhigh protein\b/.test(preferenceText);
  const wantsLowerCarb = /\b(?:lower carb|low carb|less carbs?|fewer carbs?)\b/.test(normalized) || /\blow carb\b/.test(preferenceText);
  const prefersCurrentRecommendationThread = isRecommendationFollowUpMessage(input.message, input.state);
  const maxCalories = remainingCalories !== null && remainingCalories > 0
    ? Math.max(180, Math.min(remainingCalories, mealType === 'dinner' ? 900 : mealType === 'breakfast' ? 550 : 400))
    : mealType === 'dinner'
      ? 900
      : mealType === 'breakfast'
        ? 550
        : 400;
  const minProtein = wantsHighProtein || (remainingProtein !== null && remainingProtein >= 35)
    ? mealType === 'breakfast'
      ? 24
      : mealType === 'snack'
        ? 16
        : 30
    : mealType === 'snack'
      ? 10
      : 18;

  return {
    mealType,
    wantsSweet,
    wantsHighProtein,
    wantsLight,
    wantsRestaurant,
    wantsQuick,
    wantsHealthy,
    wantsLowerCarb,
    prefersCurrentRecommendationThread,
    maxCalories,
    minProtein,
  };
}

function getHabitSignals(context: MealAssistantContext) {
  const recurringFoods = (context.assistantMemory?.recurringFoods ?? []).map((entry) => normalizeText(entry.name));
  const commonBrands = (context.assistantMemory?.commonBrands ?? []).map((entry) => normalizeText(entry.name));
  const commonRestaurants = (context.assistantMemory?.commonRestaurants ?? []).map((entry) => normalizeText(entry.name));
  const preferenceTokens = getRecommendationPreferenceTokens(context);

  return {
    recurringFoods,
    commonBrands,
    commonRestaurants,
    preferenceTokens,
  };
}

function countTokenMatches(haystack: string, tokens: string[]) {
  return tokens.filter((token) => haystack.includes(token)).length;
}

function buildRecentDuplicationPenalty(label: string, context: MealAssistantContext) {
  const normalizedLabel = normalizeText(label);
  const recent = (context.recentMeals ?? [])
    .slice(0, 4)
    .map((meal) => normalizeText([meal.title, meal.rawText ?? '', ...meal.items.map((item) => item.food_name)].join(' ')));

  return recent.reduce((penalty, mealText, index) => {
    if (!mealText || !normalizedLabel) {
      return penalty;
    }

    if (mealText.includes(normalizedLabel) || normalizedLabel.includes(mealText)) {
      return penalty + (index === 0 ? 7 : 4);
    }

    return penalty;
  }, 0);
}

function isFastFoodLikeRecommendation(label: string) {
  return /burger|mcdouble|big mac|fries|fry|pizza|nuggets?|taco bell|wendy|mcdonald|little caesars/i.test(label);
}

function matchesCurrentMealRecommendation(label: string, state: MealAssistantState) {
  const normalizedLabel = normalizeText(label);
  const normalizedMealText = normalizeText(state.currentMealText ?? '');

  if (!normalizedLabel) {
    return false;
  }

  if (normalizedMealText && (normalizedLabel.includes(normalizedMealText) || normalizedMealText.includes(normalizedLabel))) {
    return true;
  }

  return state.currentMealItems.some((item) => {
    const normalizedItem = normalizeText(item.food_name);
    return normalizedItem && (normalizedLabel.includes(normalizedItem) || normalizedItem.includes(normalizedLabel));
  });
}

function scoreRecommendationLabel(args: {
  label: string;
  mealType: MealAssistantState['mealType'];
  calories: number;
  protein: number;
  carbs: number;
  tags: string[];
  context: MealAssistantContext;
  profile: RecommendationProfile;
  sourceBonus?: number;
}) {
  const { label, mealType, calories, protein, carbs, tags, context, profile, sourceBonus = 0 } = args;
  const normalizedLabel = normalizeText(label);
  const signals = getHabitSignals(context);

  let score = sourceBonus;

  if (profile.mealType) {
    score += mealType === profile.mealType ? 10 : -3;
  }

  score += Math.min(protein, 45) * (profile.wantsHighProtein ? 0.9 : 0.35);

  if (profile.maxCalories !== null) {
    score += calories <= profile.maxCalories ? 5 : -((calories - profile.maxCalories) / 35);
  }

  if (profile.wantsSweet) {
    score += tags.includes('sweet') ? 6 : -4;
  }

  if (profile.wantsLight) {
    score += calories <= 350 ? 5 : calories <= 500 ? 2 : -4;
  }

  if (profile.wantsRestaurant) {
    score += tags.includes('restaurant') ? 6 : -2;
  }

  if (!profile.wantsRestaurant && isFastFoodLikeRecommendation(label)) {
    score -= profile.mealType === 'dinner' || profile.wantsHealthy ? 10 : 6;
  }

  if (profile.wantsQuick) {
    score += tags.includes('quick') ? 4 : 0;
  }

  if (profile.wantsHealthy) {
    score += tags.includes('healthy') || tags.includes('balanced') ? 4 : 0;
  }

  if (profile.wantsLowerCarb) {
    score += carbs <= 30 ? 4 : carbs <= 40 ? 1 : -3;
  }

  if (protein < profile.minProtein) {
    score -= (profile.minProtein - protein) * 0.8;
  }

  score += countTokenMatches(normalizedLabel, signals.recurringFoods) * 2.5;
  score += countTokenMatches(normalizedLabel, signals.commonBrands) * 2;
  score += countTokenMatches(normalizedLabel, signals.commonRestaurants) * 2;
  score += countTokenMatches(normalizedLabel, signals.preferenceTokens) * 1.4;
  score -= buildRecentDuplicationPenalty(label, context);

  return score;
}

function findPersonalizedRecommendationCandidate(input: MealAssistantRunInput, context: MealAssistantContext, profile: RecommendationProfile) {
  const allowCurrentMealEcho = /\b(?:same|usual|again|repeat|my usual)\b/i.test(input.message);
  const entries = getMemoryEntries(context).filter((entry) => entry.items.length > 0);

  const ranked = entries
    .map((entry) => {
      const totals = sumTotals(entry.items);
      const label = buildMemoryReference(entry);
      return {
        entry,
        label,
        totals,
        score: scoreRecommendationLabel({
          label,
          mealType: entry.mealType,
          calories: totals.calories,
          protein: totals.protein,
          carbs: totals.carbs,
          tags: [
            /shake|yogurt|berries|fruit|pudding|bar/i.test(label) ? 'sweet' : '',
            /chipotle|mcdonald|taco bell|starbucks|wendy|panera|subway/i.test(label) ? 'restaurant' : '',
            /shake|yogurt|wrap|sandwich|cottage cheese/i.test(label) ? 'quick' : '',
            totals.protein >= 20 ? 'high_protein' : '',
            totals.calories <= 350 ? 'light' : '',
            'balanced',
          ].filter(Boolean),
          context,
          profile,
          sourceBonus: entry.source === 'favorite' ? 4 : entry.source === 'memory' ? 2 : 0,
        }),
      };
    })
    .filter((entry) => allowCurrentMealEcho || !matchesCurrentMealRecommendation(entry.label, input.state))
    .filter((entry) => entry.totals.protein >= Math.max(8, profile.minProtein - 8))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  return best && best.score >= 12 ? best : null;
}

function findFallbackRecommendationOptions(context: MealAssistantContext, profile: RecommendationProfile) {
  return fallbackRecommendationOptions
    .map((option) => ({
      ...option,
      score: scoreRecommendationLabel({
        label: option.label,
        mealType: option.mealType,
        calories: option.calories,
        protein: option.protein,
        carbs: option.carbs,
        tags: option.tags,
        context,
        profile,
      }),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function buildRecommendationLead(context: MealAssistantContext, profile: RecommendationProfile) {
  const remainingCalories = getRemainingCalories(context);
  const remainingProtein = getRemainingProtein(context);

  if (remainingCalories !== null && remainingProtein !== null && (profile.mealType === 'dinner' || profile.wantsHighProtein)) {
    return `You’ve got about ${remainingCalories} calories and ${remainingProtein}g protein left, so `;
  }

  if (remainingProtein !== null && profile.wantsHighProtein) {
    return `Protein-wise, `;
  }

  if (remainingCalories !== null && (profile.mealType === 'snack' || profile.wantsLight)) {
    return `You’ve got about ${remainingCalories} calories left, so `;
  }

  return '';
}

function avoidRepeatedRecommendationLead(lead: string, state: MealAssistantState, profile: RecommendationProfile) {
  if (!lead || !state.lastAssistantReply) {
    return lead;
  }

  const previousOpening = getReplyOpening(state.lastAssistantReply);
  const nextOpening = getReplyOpening(lead.trim());

  if (!previousOpening || previousOpening !== nextOpening) {
    return lead;
  }

  if (profile.mealType === 'dinner') {
    return 'For tonight, ';
  }

  if (profile.wantsSweet || profile.mealType === 'snack') {
    return 'Snack-wise, ';
  }

  if (profile.wantsHighProtein) {
    return 'Protein-wise, ';
  }

  return '';
}

function buildRecommendationReply(input: MealAssistantRunInput, context: MealAssistantContext) {
  const normalized = input.message.trim().toLowerCase();
  const profile = buildRecommendationProfile(input, context);

  if (!profile) {
    return null;
  }

  if (lighterVersionRegex.test(normalized) && input.state.currentMealItems.length) {
    const mealLabel = input.state.currentMealItems.at(-1)?.food_name ?? 'that meal';
    return `For a lighter version of ${mealLabel}, I’d lean grilled instead of fried, skip heavy extras like cheese or mayo, and keep the side simpler.`;
  }

  const lead = avoidRepeatedRecommendationLead(buildRecommendationLead(context, profile), input.state, profile);
  const personalized = findPersonalizedRecommendationCandidate(input, context, profile);

  if (personalized) {
    const usualPrefix = personalized.entry.source === 'favorite' || personalized.entry.source === 'memory' ? 'your usual ' : '';

    if (profile.wantsSweet) {
      return `${lead}${usualPrefix}${personalized.label} would be a good sweet option here.`;
    }

    if (profile.mealType === 'dinner') {
      return `${lead}${usualPrefix}${personalized.label} would fit pretty well tonight.`;
    }

    if (profile.mealType === 'breakfast') {
      return `${lead}${usualPrefix}${personalized.label} would be a strong breakfast move.`;
    }

    return `${lead}${usualPrefix}${personalized.label} would fit well here.`;
  }

  const fallback = findFallbackRecommendationOptions(context, profile);
  const [first, second] = fallback;

  if (!first) {
    return null;
  }

  if (profile.wantsSweet) {
    return second
      ? `${lead}${first.label} or ${second.label} would both work and keep it on the lighter side.`
      : `${lead}${first.label} would be a good sweet option.`;
  }

  if (profile.mealType === 'dinner') {
    return second
      ? `${lead}${first.label} or ${second.label} would both fit pretty well tonight.`
      : `${lead}${first.label} would fit pretty well tonight.`;
  }

  if (profile.mealType === 'breakfast') {
    return second
      ? `${lead}${first.label} or ${second.label} would both be strong breakfast options.`
      : `${lead}${first.label} would be a strong breakfast option.`;
  }

  return second
    ? `${lead}${first.label} or ${second.label} would both work well.`
    : `${lead}${first.label} would work well.`;
}

function buildComparisonReply(input: MealAssistantRunInput) {
  const normalized = input.message.trim().toLowerCase();

  if (!comparisonRegex.test(normalized)) {
    return null;
  }

  if (/grilled/.test(normalized) && /fried/.test(normalized)) {
    return 'Usually grilled is the lighter move because it tends to cut calories and fat while keeping protein similar.';
  }

  if (/rice/.test(normalized) && /fries|fry/.test(normalized)) {
    return 'Rice is usually the steadier option, while fries are heavier on calories and fat.';
  }

  return 'Usually the better call is the option with more protein and less fried or heavy add-ons.';
}

function updateConversationState(
  nextState: MealAssistantState,
  args: { intent: MealAssistantModelOutput['intent']; message: string; activeQuestion?: string | null },
) {
  let activeTopic: MealAssistantState['activeTopic'] = nextState.activeTopic ?? null;
  let activeMode: MealAssistantState['activeMode'] = nextState.activeMode ?? null;

  if (args.intent === 'new_food_item' || args.intent === 'add_to_current_meal' || args.intent === 'repeat_meal') {
    activeTopic = 'meal';
    activeMode = nextState.currentMealItems.length > 1 ? 'meal_building' : 'logging_mode';
  } else if (args.intent === 'correction' || args.intent === 'quantity_change' || args.intent === 'remove_item' || args.intent === 'edit_command' || args.intent === 'delete_command') {
    activeTopic = 'meal';
    activeMode = 'correction_mode';
  } else if (args.intent === 'nutrition_guidance' || args.intent === 'nutrition_question' || args.intent === 'macro_question' || args.intent === 'goal_question' || args.intent === 'comparison_question') {
    activeTopic = 'nutrition';
    activeMode = args.intent === 'macro_question' ? 'macro_discussion' : 'nutrition_coaching';
  } else if (args.intent === 'recommendation_request') {
    activeTopic = 'recommendation';
    activeMode = 'recommendation_mode';
  } else if (args.intent === 'complaint_repair') {
    activeTopic = nextState.currentMealItems.length ? 'meal' : 'review';
    activeMode = nextState.currentMealItems.length ? 'correction_mode' : 'review_save';
  } else if (args.intent === 'clarification_meta_question' || args.intent === 'clarification_answer') {
    activeTopic = 'clarification';
    activeMode = 'logging_mode';
  } else if (args.intent === 'save_meal' || args.intent === 'meal_review' || args.intent === 'meal_feedback') {
    activeTopic = 'review';
    activeMode = 'review_save';
  } else if (args.intent === 'casual_message' || args.intent === 'greeting') {
    activeTopic = offTopicRegex.test(args.message) ? 'off_topic' : 'casual';
    activeMode = 'casual_conversation';
  } else if (nextState.pendingClarification) {
    activeTopic = 'clarification';
    activeMode = 'logging_mode';
  }

  return {
    ...nextState,
    activeTopic,
    activeMode,
    activeQuestion: args.activeQuestion ?? nextState.activeQuestion ?? null,
    previousIntent: args.intent,
    previousUserMessage: args.message,
  };
}

function validateAssistantReply(args: {
  message: string;
  assistantReply: string;
  intent: MealAssistantModelOutput['intent'];
  state: MealAssistantState;
  context: MealAssistantContext;
}) {
  const macroReply = buildCurrentMealMacroReply(args.message, args.state);
  const nutritionReply = buildNutritionGuidanceReply({ message: args.message, state: args.state, context: args.context }, args.context);
  const recommendationReply = buildRecommendationReply({ message: args.message, state: args.state, context: args.context }, args.context);
  const comparisonReply = buildComparisonReply({ message: args.message, state: args.state, context: args.context });

  if ((args.intent === 'macro_question' || followUpMacroRegex.test(args.message)) && macroReply) {
    return macroReply;
  }

  if ((args.intent === 'macro_question' || args.intent === 'nutrition_guidance' || args.intent === 'nutrition_question' || followUpMacroRegex.test(args.message)) && nutritionReply) {
    return nutritionReply;
  }

  if ((args.intent === 'recommendation_request' || isRecommendationRequestMessage(args.message)) && recommendationReply) {
    return recommendationReply;
  }

  if ((args.intent === 'comparison_question' || comparisonRegex.test(args.message)) && comparisonReply) {
    return comparisonReply;
  }

  if ((args.intent === 'casual_message' || args.intent === 'greeting') && isGenericReply(args.assistantReply)) {
    return buildFallbackReply(args.message, args.state, args.context);
  }

  return args.assistantReply;
}

function postProcessAssistantReply(reply: string, state: MealAssistantState, message?: string) {
  let nextReply = sanitizeAssistantText(reply)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+([?.!,])/g, '$1');

  if (!nextReply || isWeakStandaloneReply(nextReply)) {
    if (message && /\bpizza\b/i.test(message) && !state.currentMealItems.length) {
      nextReply = buildPizzaPortionQuestion(message);
    } else if (state.currentMealItems.length) {
      nextReply = buildFoodAwareFallbackReply(message ?? state.currentMealText ?? 'this meal', state.currentMealItems);
    } else {
      nextReply = message ? `Tell me the amount for ${cleanOriginalFoodName(message)}.` : 'Tell me what you ate.';
    }
  }

  nextReply = polishRepeatedOpening(nextReply, state);

  if (!/[.!?]$/.test(nextReply)) {
    nextReply = `${nextReply}.`;
  }

  if (nextReply.length > 260) {
    nextReply = `${nextReply.slice(0, 257).trimEnd()}…`;
  }

  if (state.lastAssistantReply && normalizeText(state.lastAssistantReply) === normalizeText(nextReply)) {
    if (/^already saved\b/i.test(nextReply)) {
      return sanitizeAssistantText(nextReply);
    }

    if (/^saved\b/i.test(nextReply)) {
      nextReply = 'Saved. Ready for the next one?';
    } else {
      nextReply = buildContextualContinuityReply(state);
    }
  }

  return sanitizeAssistantText(nextReply);
}

function getMemoryEntries(context: MealAssistantContext) {
  const favoriteEntries: MemoryEntry[] = (context.favoriteMeals ?? []).map((meal) => ({
    ...meal,
    source: 'favorite',
  }));
  const recentEntries: MemoryEntry[] = (context.recentMeals ?? []).map((meal) => ({
    ...meal,
    source: 'recent',
  }));
  const localMemoryEntries: MemoryEntry[] = (context.assistantMemory?.recurringMeals ?? []).map((meal) => ({
    ...meal,
    source: 'memory',
    sourceReusableMealId: meal.source === 'favorite' ? meal.id : null,
  }));

  return [...favoriteEntries, ...recentEntries, ...localMemoryEntries];
}

function tokenizeMealIdentity(items: ParsedFoodItem[]) {
  return Array.from(
    new Set(
      items
        .flatMap((item) => normalizeText(item.food_name).split(' '))
        .filter((token) => token && token.length > 2 && !['with', 'and', 'the', 'meal', 'food'].includes(token)),
    ),
  );
}

function scoreMealSimilarity(items: ParsedFoodItem[], entry: MealAssistantMemoryMeal) {
  const targetTokens = tokenizeMealIdentity(items);
  const candidateTokens = tokenizeMealIdentity(entry.items);

  if (!targetTokens.length || !candidateTokens.length) {
    return 0;
  }

  const overlap = targetTokens.filter((token) => candidateTokens.includes(token)).length;
  if (!overlap) {
    return 0;
  }

  return overlap / Math.max(targetTokens.length, candidateTokens.length);
}

function findSimilarMealPattern(items: ParsedFoodItem[], entries: MealAssistantMemoryMeal[]) {
  const ranked = entries
    .map((entry) => ({
      entry,
      score: scoreMealSimilarity(items, entry),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  return best && best.score >= 0.5 ? best : null;
}

function buildWeeklySummaryReply(context: MealAssistantContext) {
  const recentWeek = (context.recentMeals ?? []).filter((meal) => {
    const occurredAt = parseIsoTime(getRecentMealOccurredAt(meal));
    return occurredAt !== null && Date.now() - occurredAt <= 7 * 86400000;
  });

  if (!recentWeek.length) {
    return 'This week is still pretty open. Give me a couple meals and I can start calling out the pattern without turning it into a dashboard.';
  }

  const proteinForwardCount = recentWeek.filter((meal) => sumTotals(meal.items).protein >= 25).length;
  const repeatedMealCounts = recentWeek.reduce<Record<string, { title: string; count: number }>>((acc, meal) => {
    const key = normalizeText(meal.rawText ?? meal.title);
    acc[key] = {
      title: meal.rawText ?? meal.title,
      count: (acc[key]?.count ?? 0) + 1,
    };
    return acc;
  }, {});

  const repeatedMeal = Object.values(repeatedMealCounts).sort((left, right) => right.count - left.count)[0] ?? null;
  const mealTypeCounts = recentWeek.reduce<Record<string, number>>((acc, meal) => {
    acc[meal.mealType] = (acc[meal.mealType] ?? 0) + 1;
    return acc;
  }, {});
  const topMealType = Object.entries(mealTypeCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;

  const intro = recentWeek.length >= 5
    ? `This week looks pretty steady so far with ${recentWeek.length} logged meals.`
    : `This week is starting to take shape with ${recentWeek.length} logged meals.`;

  if (repeatedMeal && repeatedMeal.count >= 2) {
    return `${intro} ${repeatedMeal.title} keeps showing up as one of your go-tos.`;
  }

  if (proteinForwardCount >= Math.ceil(recentWeek.length / 2)) {
    return `${intro} You’ve been leaning pretty protein-forward more often than not.`;
  }

  if (topMealType) {
    return `${intro} ${topMealType.charAt(0).toUpperCase()}${topMealType.slice(1)} has been your most consistent check-in.`;
  }

  return intro;
}

function getMealPatternSample(context: MealAssistantContext, mealType: MealAssistantState['mealType']) {
  const recentSample = (context.recentMeals ?? [])
    .filter((meal) => meal.mealType === mealType && meal.items.length > 0)
    .slice(0, 6)
    .map((meal) => sumTotals(meal.items));

  if (recentSample.length >= 3) {
    return recentSample;
  }

  const memorySample = (context.assistantMemory?.recurringMeals ?? [])
    .filter((meal) => meal.mealType === mealType && meal.items.length > 0)
    .slice(0, 6)
    .map((meal) => sumTotals(meal.items));

  return [...recentSample, ...memorySample].slice(0, 6);
}

function averageMealTotals(sample: ReturnType<typeof sumTotals>[]) {
  if (!sample.length) {
    return null;
  }

  const combined = sample.reduce(
    (acc, totals) => ({
      calories: acc.calories + totals.calories,
      protein: acc.protein + totals.protein,
      carbs: acc.carbs + totals.carbs,
      fat: acc.fat + totals.fat,
      fiber: acc.fiber + totals.fiber,
      sugar: acc.sugar + totals.sugar,
      sodium: acc.sodium + totals.sodium,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
  );

  return {
    calories: combined.calories / sample.length,
    protein: combined.protein / sample.length,
    carbs: combined.carbs / sample.length,
    fat: combined.fat / sample.length,
  };
}

function buildMealPatternInsight(response: MealAssistantResponse, context: MealAssistantContext) {
  const mealType = response.next_state.mealType;
  const sample = getMealPatternSample(context, mealType);

  if (sample.length < 3) {
    return null;
  }

  const average = averageMealTotals(sample);
  if (!average) {
    return null;
  }

  const { calories, protein, carbs } = response.meal.totals;
  const mealLabel = mealType === 'snack' ? 'snack' : mealType;

  if (carbs >= average.carbs + 12 && carbs >= average.carbs * 1.15) {
    return `That’s a little higher carb than your normal ${mealLabel}.`;
  }

  if (protein >= average.protein + 12 && protein >= average.protein * 1.2) {
    return `That’s more protein than your usual ${mealLabel}.`;
  }

  if (calories <= average.calories - 180 && calories <= average.calories * 0.75) {
    return `That’s lighter than your usual ${mealLabel}.`;
  }

  return null;
}

function buildConversationRecoveryReply(input: MealAssistantRunInput, context: MealAssistantContext) {
  const normalized = input.message.trim().toLowerCase();
  const hasActiveMeal = input.state.currentMealItems.length > 0;
  const hasDailyContext = [context.todayProtein, context.todayCalories, context.remainingProtein, context.remainingCalories, context.remainingCarbs, context.remainingFat].some(
    (value) => value !== null && value !== undefined,
  );

  if (isLikelyNonsenseInput(input.message)) {
    if (hasActiveMeal) {
      return 'I did not catch that as a meal change, so I kept the current meal the same. Send the food or correction again and I will adjust it.';
    }

    return 'I did not catch a food there. Send the meal naturally when you are ready.';
  }

  if (input.state.pendingClarification && isClarificationMetaQuestion(input.message)) {
    return buildClarificationMetaReply(input.state);
  }

  if (hasActiveMeal && /^(?:does\s+that\s+)?look(?:s)?\s+(?:good|right|ok|okay)\??$/i.test(normalized)) {
    return 'It looks ready to save if this is right. Say "save it" to log it, or send a correction and I will adjust it.';
  }

  if (/\bmedical advice\b|\bdoctor\b|\bdietitian\b|\bhealth professional\b/i.test(normalized)) {
    return 'No, these are nutrition estimates for tracking, not medical advice. For medical or diet decisions, check with a doctor or dietitian.';
  }

  if (/\b(?:what|which)\s+(?:detail|details|info|information)\b|\bwhat do you need\b|\bwhat detail do you need\b/i.test(normalized)) {
    if (input.state.pendingClarification) {
      return `I just need one detail to keep going: ${input.state.pendingClarification}`;
    }

    if (hasActiveMeal) {
      return 'For this meal, the useful details are amount, brand, or prep style. You can also just send a correction like "make it half a cup."';
    }

    return 'Usually amount, brand, or prep style helps most. You can still log it naturally and I will ask only if something truly matters.';
  }

  if (ambiguousFollowUpRegex.test(normalized) || (/\?$/.test(normalized) && /\b(?:it|that|this|those|them)\b/.test(normalized))) {
    if (!hasActiveMeal && (input.state.previousIntent || input.state.activeTopic)) {
      if (input.state.activeTopic === 'nutrition' || input.state.previousIntent === 'nutrition_guidance' || input.state.previousIntent === 'macro_question') {
        return 'We were talking about your day overall. If you mean the meal instead, send the meal or ask about this meal once it’s in front of me.';
      }

      return 'We were between the meal thread and the day-level view. If you mean the meal, send it again or ask about this meal. If you mean today, ask what you have left.';
    }

    if (!hasActiveMeal) {
      return null;
    }

    if (hasDailyContext) {
      return 'I think I lost track of whether we were editing the meal or talking about today overall. If you mean the meal, ask about this meal. If you mean today, ask what you have left.';
    }

    return 'I think I lost track of whether we were still editing the meal or starting a new question. Tell me the meal change or the macro question and I’ll stay on it.';
  }

  return null;
}

function isClarificationMetaQuestion(message: string) {
  return clarificationMetaQuestionRegex.test(message.trim().toLowerCase().replace(/[.!]+$/g, ''));
}

function buildClarificationMetaReply(state: MealAssistantState) {
  const pending = state.pendingClarification ?? state.lastAssistantQuestion ?? '';
  const contextText = `${state.currentMealText ?? ''} ${pending}`.toLowerCase();

  if (/\bomelette|omelet|hash\s*browns?|hashbrowns?\b/.test(contextText)) {
    return 'For the omelette, the main things are how many eggs, any cheese/meat/veggies, and roughly how much hashbrowns. A simple estimate like "2 eggs with cheese and a cup of hashbrowns" works.';
  }

  if (/\bcottage cheese\b/.test(contextText)) {
    return 'For cottage cheese, the most useful detail is the amount. Something like "half a cup," "1 cup," or "150 grams" is enough; brand or low-fat helps if you know it.';
  }

  if (/\bsandwich\b/.test(contextText)) {
    return 'For a sandwich, the useful details are bread, main filling, cheese or sauces, and rough size. Something like "turkey sandwich on wheat with cheese" works.';
  }

  if (/\bsalad\b/.test(contextText)) {
    return 'For a salad, the biggest helpers are protein, dressing amount, and calorie-dense toppings like cheese, nuts, or croutons. A rough bowl size is fine.';
  }

  if (/\bsmoothie\b/.test(contextText)) {
    return 'For a smoothie, the useful details are size and what went in it: fruit, milk or yogurt, protein powder, nut butter, or juice. A rough estimate is fine.';
  }

  if (/\bcereal\b/.test(contextText)) {
    return 'For cereal, the useful details are the cereal type, rough amount, and whether you had milk. Something like "Cinnamon Toast Crunch, about 2 bowls with whole milk" works.';
  }

  return `I just need enough detail to estimate it fairly: amount, main ingredients, and any calorie-heavy add-ons. ${pending}`;
}

function buildInitialClarificationQuestion(message: string) {
  const normalized = normalizeFoodText(stripEmotionalPreface(message));
  const bareSandwich = /\bsandwich\b/.test(normalized)
    && !/\b(?:turkey|ham|chicken|tuna|egg|pbj|peanut butter|grilled|fried|spicy|mcdouble|wendy|mcdonald|subway|panera|chick\s*fil\s*a|chickfila|popeyes|kfc|cheese|breakfast)\b/.test(normalized);

  if (/\bomelettes?\b|\bomelets?\b/.test(normalized) && /\bhash\s*browns?|hashbrowns?\b/.test(normalized) && !/\b\d+\s*(?:eggs?)\b/.test(normalized)) {
    return 'For the omelette, how many eggs, any cheese/meat/veggies, and roughly how much hashbrowns?';
  }

  if (/\bcereal\b/.test(normalized) && !/\b(?:cinnamon toast crunch|cheerios|wheaties|frosted flakes|raisin bran|granola|milk|bowls?|cups?)\b/.test(normalized)) {
    return 'For the cereal, what kind was it and about how much? Milk details help too if you had any.';
  }

  if (/^(?:i had |had |ate )?(?:a |one )?(?:whole |entire )?bag$/.test(normalized)) {
    return 'What food was in the bag, and what size or ounces was the bag if you know it?';
  }

  if (/^(?:i had |had |ate )?(?:some )?chips$/.test(normalized)) {
    return 'Which chips did you mean, and about how much did you have?';
  }

  if (/^(?:i had |had |drank )?(?:a |one )?protein shake$/.test(normalized)) {
    return 'Which protein shake was it? Brand or bottle size is enough.';
  }

  if (/^(?:i had |had |ate )?(?:some )?fries$/.test(normalized)) {
    return 'Which restaurant or serving size were the fries?';
  }

  if (bareSandwich) {
    return 'For the sandwich, what bread, meat or main filling, cheese/condiments, and rough size should I use?';
  }

  if (/\bsmoothie\b/.test(normalized) && !/\b(?:protein|yogurt|milk|banana|berry|berries|strawberry|blueberry|peanut butter|almond|cup|oz|ounces?|small|medium|large)\b/.test(normalized)) {
    return 'For the smoothie, what ingredients went in it and roughly what size was it?';
  }

  if (/\bsalad\b/.test(normalized) && !/\b(?:chicken|turkey|salmon|tuna|egg|beans?|dressing|cheese|nuts?|croutons?|avocado|bowl)\b/.test(normalized)) {
    return 'For the salad, what protein or toppings were in it, how much dressing, and about how big was it?';
  }

  if (/^(?:i had |had |ate |a |one )?(?:a |one )?bowl$/.test(normalized)) {
    return 'What kind of bowl?';
  }

  return null;
}

function buildInitialClarificationResponse(input: MealAssistantRunInput, question: string): MealAssistantResponse {
  const currentMealText = cleanOriginalFoodName(input.message);
  const nextState = updateConversationState({
    ...input.state,
    currentMealItems: [],
    currentMealText,
    confidenceScore: input.state.confidenceScore ?? 0.82,
    pendingClarification: question,
    lastAssistantQuestion: question,
    saved: false,
  }, {
    intent: 'new_food_item',
    message: input.message,
    activeQuestion: question,
  });

  return {
    intent: 'new_food_item',
    action: 'unclear',
    operations: [],
    assistant_reply: question,
    contains_food_to_log: true,
    contains_quantity_update: false,
    target_item: null,
    target_item_id: null,
    target_item_index: null,
    should_mutate_pending_meal: false,
    assistant_reply_goal: 'Ask for the smallest useful food details before nutrition lookup.',
    items: [],
    corrections: [],
    should_lookup_nutrition: false,
    should_save_meal: false,
    should_ask_clarification: true,
    clarification_question: question,
    confidence: 'medium',
    meal: {
      items: [],
      totals: sumTotals([]),
      confidence_score: nextState.confidenceScore ?? 0.82,
    },
    next_state: {
      ...nextState,
      lastAssistantReply: question,
    },
  };
}

function getClarificationContextText(state: MealAssistantState) {
  return `${state.currentMealText ?? ''} ${state.pendingClarification ?? ''} ${state.lastAssistantQuestion ?? ''}`;
}

function buildOmeletteClarificationItems(message: string): ParsedFoodItem[] {
  const normalized = normalizeFoodText(message);
  if (!/\beggs?\b/.test(normalized) || !/\bhash\s*browns?|hashbrowns?\b/.test(normalized)) {
    return [];
  }

  const eggMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s+eggs?\b/)
    ?? normalized.match(/\b(one|two|three|four|five|six)\s+eggs?\b/);
  const eggCount = eggMatch ? parseCount(eggMatch[1] ?? '2') : 2;
  const hasCheese = /\bcheese\b/.test(normalized);
  const hasMeat = /\b(?:ham|bacon|sausage|turkey|chorizo)\b/.test(normalized);
  const hasVeggies = /\b(?:peppers?|onions?|spinach|mushrooms?|tomatoes?|veggies?|vegetables?)\b/.test(normalized);
  const cupMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s+cups?\s+(?:of\s+)?hash\s*browns?\b/)
    ?? normalized.match(/\b(a|one|two|three|half|a half)\s+cups?\s+(?:of\s+)?hash\s*browns?\b/);
  const hashBrownCups = cupMatch ? parseCount(cupMatch[1] ?? '1') : 1;
  const modifiers = [
    hasCheese ? 'cheese' : null,
    hasMeat ? 'meat' : null,
    hasVeggies ? 'veggies' : null,
  ].filter(Boolean).join(', ');
  const omeletteLabel = modifiers ? `${modifiers[0]?.toUpperCase()}${modifiers.slice(1)} omelette` : 'Omelette';
  const omeletteCalories = eggCount * 70 + (hasCheese ? 110 : 0) + (hasMeat ? 90 : 0) + (hasVeggies ? 20 : 0);
  const omeletteProtein = eggCount * 6 + (hasCheese ? 6 : 0) + (hasMeat ? 8 : 0) + (hasVeggies ? 1 : 0);
  const omeletteFat = eggCount * 5 + (hasCheese ? 8 : 0) + (hasMeat ? 6 : 0);

  return [
    makeGenericEstimate(
      {
        key: 'omelette',
        label: omeletteLabel,
        quantity: 1,
        unit: 'omelette',
        calories: omeletteCalories,
        protein: omeletteProtein,
        carbs: hasVeggies ? 3 : 1,
        fat: omeletteFat,
        sodium: 220 + (hasCheese ? 190 : 0) + (hasMeat ? 320 : 0),
        sourceName: 'Omelette common serving estimate',
        sourceType: 'GENERIC_REFERENCE',
      },
      message,
    ),
    makeGenericEstimate(
      {
        key: 'hash browns',
        label: 'Hash browns',
        quantity: hashBrownCups,
        unit: hashBrownCups === 1 ? 'cup' : 'cups',
        calories: 180 * hashBrownCups,
        protein: 2 * hashBrownCups,
        carbs: 24 * hashBrownCups,
        fat: 8 * hashBrownCups,
        fiber: 2 * hashBrownCups,
        sodium: 320 * hashBrownCups,
        sourceName: 'Hash browns common serving estimate',
        sourceType: 'GENERIC_REFERENCE',
      },
      message,
    ),
  ];
}

function buildSmoothieClarificationItems(message: string, state: MealAssistantState): ParsedFoodItem[] {
  if (!/\bsmoothie\b/i.test(getClarificationContextText(state))) {
    return [];
  }

  const normalized = normalizeFoodText(message);
  if (!/\b(?:banana|berries|blueberr(?:y|ies)|strawberr(?:y|ies)|peanut butter|milk|yogurt|protein(?: powder)?|whey|almond)\b/.test(normalized)) {
    return [];
  }

  const ounceMatch = normalized.match(/\b(\d+(?:\.\d+)?)\s*(?:oz|ounces?)\b/);
  const sizeOz = ounceMatch ? parseCount(ounceMatch[1] ?? '16') : 16;
  const hasBanana = /\bbananas?\b/.test(normalized);
  const hasBerries = /\b(?:berries|blueberr(?:y|ies)|strawberr(?:y|ies))\b/.test(normalized);
  const hasPeanutButter = /\bpeanut butter\b/.test(normalized);
  const hasProtein = /\b(?:protein(?: powder)?|whey)\b/.test(normalized);
  const hasMilk = /\bmilk\b/.test(normalized);
  const hasYogurt = /\byogurt\b/.test(normalized);
  const parts = [
    hasBanana ? 'banana' : null,
    hasBerries ? 'berries' : null,
    hasPeanutButter ? 'peanut butter' : null,
    hasProtein ? 'protein powder' : null,
    hasMilk ? 'milk' : null,
    hasYogurt ? 'yogurt' : null,
  ].filter(Boolean) as string[];

  const calories =
    (hasBanana ? 105 : 0) +
    (hasBerries ? 70 : 0) +
    (hasPeanutButter ? 95 : 0) +
    (hasProtein ? 120 : 0) +
    (hasMilk ? 100 : 0) +
    (hasYogurt ? 100 : 0) +
    Math.max(0, sizeOz - 16) * 4;
  const protein =
    (hasProtein ? 24 : 0) +
    (hasMilk ? 8 : 0) +
    (hasYogurt ? 10 : 0) +
    (hasPeanutButter ? 4 : 0) +
    (hasBanana ? 1 : 0) +
    (hasBerries ? 1 : 0);
  const carbs =
    (hasBanana ? 27 : 0) +
    (hasBerries ? 17 : 0) +
    (hasPeanutButter ? 3 : 0) +
    (hasMilk ? 12 : 0) +
    (hasYogurt ? 8 : 0) +
    (hasProtein ? 4 : 0);
  const fat =
    (hasPeanutButter ? 8 : 0) +
    (hasMilk ? 3 : 0) +
    (hasYogurt ? 2 : 0) +
    (hasProtein ? 2 : 0);

  const label = parts.length ? `Smoothie with ${joinSummaryParts(parts)}` : 'Smoothie';
  return [
    makeGenericEstimate(
      {
        key: 'smoothie',
        label,
        quantity: 1,
        unit: 'smoothie',
        calories: Math.max(180, calories),
        protein,
        carbs,
        fat,
        fiber: (hasBanana ? 3 : 0) + (hasBerries ? 4 : 0) + (hasPeanutButter ? 1 : 0),
        sugar: (hasBanana ? 14 : 0) + (hasBerries ? 10 : 0) + (hasMilk ? 12 : 0) + (hasYogurt ? 6 : 0),
        sodium: (hasProtein ? 180 : 0) + (hasMilk ? 120 : 0) + (hasYogurt ? 80 : 0),
        sourceName: 'Smoothie common serving estimate',
        sourceType: 'GENERIC_REFERENCE',
      },
      message,
    ),
  ];
}

function buildSaladClarificationItems(message: string, state: MealAssistantState): ParsedFoodItem[] {
  if (!/\bsalad\b/i.test(getClarificationContextText(state))) {
    return [];
  }

  const normalized = normalizeFoodText(message);
  if (!/\b(?:salad|chicken|caesar|croutons?|dressing|cheese|avocado|tuna|salmon|turkey)\b/.test(normalized)) {
    return [];
  }

  const hasChicken = /\bchicken\b/.test(normalized);
  const hasCaesar = /\bcaesar\b/.test(normalized);
  const hasCroutons = /\bcroutons?\b/.test(normalized);
  const hasCheese = /\bcheese|parmesan\b/.test(normalized);
  const hasAvocado = /\bavocado\b/.test(normalized);
  const isBig = /\b(?:big|large|huge)\b/.test(normalized);
  const calories =
    120 +
    (hasChicken ? 180 : 0) +
    (hasCaesar ? 170 : 0) +
    (hasCroutons ? 80 : 0) +
    (hasCheese ? 70 : 0) +
    (hasAvocado ? 120 : 0) +
    (isBig ? 80 : 0);
  const protein = (hasChicken ? 32 : 4) + (hasCheese ? 5 : 0);
  const label = [
    hasChicken ? 'Chicken' : null,
    hasCaesar ? 'Caesar' : null,
    'salad',
    hasCroutons ? 'with croutons' : null,
  ].filter(Boolean).join(' ');

  return [
    makeGenericEstimate(
      {
        key: 'salad',
        label,
        quantity: 1,
        unit: isBig ? 'large salad' : 'salad',
        calories,
        protein,
        carbs: 12 + (hasCroutons ? 14 : 0) + (hasAvocado ? 6 : 0),
        fat: 8 + (hasCaesar ? 16 : 0) + (hasCheese ? 6 : 0) + (hasAvocado ? 11 : 0),
        fiber: 4 + (hasAvocado ? 5 : 0),
        sodium: 360 + (hasCaesar ? 380 : 0) + (hasCroutons ? 120 : 0),
        sourceName: 'Salad common serving estimate',
        sourceType: 'GENERIC_REFERENCE',
      },
      message,
    ),
  ];
}

function buildSandwichClarificationItems(message: string, state: MealAssistantState): ParsedFoodItem[] {
  if (!/\bsandwich\b/i.test(getClarificationContextText(state))) {
    return [];
  }

  const normalized = normalizeFoodText(message);
  if (!/\b(?:sandwich|turkey|ham|chicken|tuna|wheat|white|sourdough|cheese|mayo|mustard)\b/.test(normalized)) {
    return [];
  }

  const proteinLabel = normalized.match(/\b(turkey|ham|chicken|tuna|egg)\b/)?.[1] ?? 'deli';
  const breadLabel = normalized.match(/\b(wheat|white|sourdough|rye)\b/)?.[1] ?? null;
  const hasCheese = /\bcheese\b/.test(normalized);
  const hasMayo = /\bmayo|mayonnaise\b/.test(normalized);
  const hasMustard = /\bmustard\b/.test(normalized);
  const calories =
    220 +
    (proteinLabel === 'turkey' ? 110 : proteinLabel === 'chicken' ? 150 : proteinLabel === 'tuna' ? 180 : 130) +
    (hasCheese ? 90 : 0) +
    (hasMayo ? 100 : 0);
  const protein = (proteinLabel === 'turkey' ? 24 : proteinLabel === 'chicken' ? 28 : proteinLabel === 'tuna' ? 25 : 18) + (hasCheese ? 6 : 0);
  const label = [
    `${proteinLabel[0]?.toUpperCase()}${proteinLabel.slice(1)} sandwich`,
    breadLabel ? `on ${breadLabel}` : null,
    hasCheese ? 'with cheese' : null,
    hasMayo ? 'and mayo' : hasMustard ? 'with mustard' : null,
  ].filter(Boolean).join(' ');

  return [
    makeGenericEstimate(
      {
        key: 'sandwich',
        label,
        quantity: 1,
        unit: 'sandwich',
        calories,
        protein,
        carbs: 38,
        fat: 8 + (hasCheese ? 7 : 0) + (hasMayo ? 11 : 0),
        fiber: breadLabel === 'wheat' ? 5 : 2,
        sugar: 5,
        sodium: 720 + (hasCheese ? 180 : 0) + (hasMayo ? 80 : 0),
        sourceName: 'Sandwich common serving estimate',
        sourceType: 'GENERIC_REFERENCE',
      },
      message,
    ),
  ];
}

function buildCerealClarificationItems(message: string, state: MealAssistantState): ParsedFoodItem[] {
  if (!/\bcereal\b/i.test(getClarificationContextText(state))) {
    return [];
  }

  const normalized = normalizeFoodText(message);
  if (!/\b(?:cereal|cinnamon toast crunch|cheerios|frosted flakes|raisin bran|granola|bowls?|cups?|milk)\b/.test(normalized)) {
    return [];
  }

  const quantityMatch = normalized.match(/\b(\d+(?:\.\d+)?|\.\d+|one|two|three|four|five|half|a half)\s+(?:bowls?|cups?)\b/);
  const quantity = quantityMatch ? parseCount(quantityMatch[1] ?? '1') : 1;
  const isCinnamonToastCrunch = /\bcinnamon toast crunch\b/.test(normalized) || /\bcinnamon\b/.test(normalized);
  const hasWholeMilk = /\bwhole milk\b/.test(normalized);
  const hasMilk = hasWholeMilk || /\bmilk\b/.test(normalized);
  const cerealCalories = isCinnamonToastCrunch ? 170 : 140;
  const cerealProtein = isCinnamonToastCrunch ? 2 : 4;
  const label = isCinnamonToastCrunch ? 'Cinnamon Toast Crunch cereal' : 'Cereal';
  const items = [
    makeGenericEstimate(
      {
        key: 'cereal',
        label,
        quantity,
        unit: quantity === 1 ? 'bowl' : 'bowls',
        calories: cerealCalories * quantity,
        protein: cerealProtein * quantity,
        carbs: (isCinnamonToastCrunch ? 33 : 28) * quantity,
        fat: (isCinnamonToastCrunch ? 4 : 2) * quantity,
        fiber: quantity * 2,
        sugar: (isCinnamonToastCrunch ? 12 : 6) * quantity,
        sodium: (isCinnamonToastCrunch ? 230 : 180) * quantity,
        sourceName: `${label} common serving estimate`,
        sourceType: 'GENERIC_REFERENCE',
      },
      message,
    ),
  ];

  if (hasMilk) {
    items.push(makeWholeMilkItem(message, quantity));
  }

  return items;
}

function buildStructuredClarificationAnswerItems(message: string, state: MealAssistantState): ParsedFoodItem[] {
  return [
    ...buildOmeletteClarificationItems(message),
    ...buildSmoothieClarificationItems(message, state),
    ...buildSaladClarificationItems(message, state),
    ...buildSandwichClarificationItems(message, state),
    ...buildCerealClarificationItems(message, state),
  ];
}

function buildCompanionInsight(args: { response: MealAssistantResponse; input: MealAssistantRunInput; context: MealAssistantContext }) {
  const { response, input, context } = args;
  const normalized = input.message.trim().toLowerCase();
  const remainingProtein = getRemainingProtein(context);
  const remainingCalories = getRemainingCalories(context);

  if (['recommendation_request', 'correction', 'quantity_change', 'remove_item', 'complaint_repair'].includes(response.intent)) {
    return null;
  }

  if (response.should_ask_clarification || response.next_state.saved || weeklySummaryRegex.test(normalized)) {
    return null;
  }

  if (!response.meal.items.length) {
    return null;
  }

  if (['new_food_item', 'add_to_current_meal', 'clarification_answer'].includes(response.intent)) {
    const patternInsight = buildMealPatternInsight(response, context);
    if (patternInsight) {
      return patternInsight;
    }
  }

  const yesterdayMatch = findSimilarMealPattern(
    response.meal.items,
    (context.recentMeals ?? []).filter((meal) => isYesterday(getRecentMealOccurredAt(meal))),
  );

  if (yesterdayMatch && response.intent !== 'repeat_meal' && !repeatCueRegex.test(normalized)) {
    return `That’s pretty close to yesterday’s ${yesterdayMatch.entry.mealType}`;
  }

  const usualMatch = findSimilarMealPattern(
    response.meal.items,
    getMemoryEntries(context).filter((entry) => entry.source !== 'recent'),
  );

  if (usualMatch && response.intent === 'new_food_item' && !repeatCueRegex.test(normalized)) {
    return `That’s close to one of your usual ${usualMatch.entry.mealType} picks`;
  }

  if (remainingProtein !== null && remainingProtein >= 40 && response.meal.totals.protein < 20) {
    return 'Still light on protein for today, so a protein-heavy add-on would fit well later.';
  }

  if (response.next_state.mealType === 'dinner' && remainingCalories !== null && remainingCalories >= 200 && response.meal.totals.calories <= 750) {
    return 'You’ve still got room for a snack tonight';
  }

  return null;
}

function finalizeResponse(response: MealAssistantResponse, input: MealAssistantRunInput, context: MealAssistantContext) {
  const insight = buildCompanionInsight({ response, input, context });

  if (!insight || normalizeText(response.assistant_reply).includes(normalizeText(insight))) {
    return response;
  }

  const combinedReply = postProcessAssistantReply(
    `${response.assistant_reply.replace(/[.!?]+$/, '')}. ${insight}`,
    response.next_state,
    input.message,
  );

  return {
    ...response,
    assistant_reply: combinedReply,
    next_state: {
      ...response.next_state,
      lastAssistantReply: combinedReply,
    },
  };
}

function parseIsoTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isYesterday(value: string | null | undefined) {
  const timestamp = parseIsoTime(value);
  if (timestamp === null) {
    return false;
  }

  const now = new Date();
  const candidate = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const candidateDay = new Date(candidate.getFullYear(), candidate.getMonth(), candidate.getDate()).getTime();
  const diffDays = Math.round((today - candidateDay) / 86400000);
  return diffDays === 1;
}

function extractMealTypeHint(message: string) {
  const match = message.match(mealTypeHintRegex)?.[1]?.toLowerCase();
  if (match === 'breakfast' || match === 'lunch' || match === 'dinner' || match === 'snack') {
    return match;
  }

  return null;
}

function buildMemoryTarget(message: string) {
  return message
    .toLowerCase()
    .replace(/^(?:and|also|plus|with)\s+/i, '')
    .replace(/\b(?:same as usual|my usual|the usual)\b/gi, ' ')
    .replace(/\b(?:same|usual|repeat|again|yesterday|last time|last meal|last|log|use|for|please|my|meal)\b/gi, ' ')
    .replace(mealTypeHintRegex, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildMemorySearchText(entry: MemoryEntry) {
  return normalizeText([
    entry.title,
    entry.rawText ?? '',
    ...entry.items.map((item) => item.food_name),
    ...entry.items.map((item) => item.source_name ?? ''),
  ].join(' '));
}

function getEntrySortTimestamp(entry: MemoryEntry) {
  return parseIsoTime(entry.lastUsedAt) ?? parseIsoTime(entry.createdAt) ?? 0;
}

function scoreMemoryEntry(entry: MemoryEntry, options: { targetText: string; mealTypeHint: string | null; preferFavorite: boolean; requireYesterday: boolean }) {
  if (!entry.items.length) {
    return Number.NEGATIVE_INFINITY;
  }

  if (options.requireYesterday && !isYesterday(entry.createdAt)) {
    return Number.NEGATIVE_INFINITY;
  }

  const searchText = buildMemorySearchText(entry);
  const targetTokens = tokenizeText(options.targetText);
  const phrase = normalizeText(options.targetText);
  const mealTypeMatches = options.mealTypeHint ? entry.mealType === options.mealTypeHint : false;

  let score = 0;

  if (options.preferFavorite && entry.source === 'favorite') {
    score += 6;
  }

  if (options.requireYesterday && isYesterday(entry.createdAt)) {
    score += 8;
  }

  if (mealTypeMatches) {
    score += 3;
  }

  if (targetTokens.length) {
    const overlap = targetTokens.filter((token) => searchText.includes(token)).length;
    if (!overlap) {
      return Number.NEGATIVE_INFINITY;
    }

    score += overlap * 2.5;

    if (phrase && (searchText.includes(phrase) || phrase.includes(searchText))) {
      score += 8;
    }
  } else {
    score += entry.source === 'recent' ? 1 : 0;
  }

  score += getEntrySortTimestamp(entry) / 1_000_000_000_000;
  return score;
}

function findMatchingMemoryMeal(input: MealAssistantRunInput, context: MealAssistantContext): MemoryMatch | null {
  const normalized = input.message.trim().toLowerCase();
  const entries = getMemoryEntries(context);

  if (!entries.length || !repeatCueRegex.test(normalized)) {
    return null;
  }

  const mealTypeHint = extractMealTypeHint(input.message) ?? null;
  const appendToCurrentMeal = input.state.currentMealItems.length > 0 && continuationRegex.test(normalized);
  const requireYesterday = repeatYesterdayRegex.test(normalized);
  const preferFavorite = usualRegex.test(normalized) || /\bmy usual\b/i.test(normalized);
  const targetText = buildMemoryTarget(input.message);

  const ranked = entries
    .map((entry) => ({
      entry,
      score: scoreMemoryEntry(entry, {
        targetText,
        mealTypeHint,
        preferFavorite,
        requireYesterday,
      }),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best) {
    return null;
  }

  const minimumScore = targetText ? 3 : requireYesterday ? 6 : preferFavorite ? 4 : 2;
  if (best.score < minimumScore) {
    return null;
  }

  return {
    candidate: best.entry,
    mode: requireYesterday ? 'yesterday' : best.entry.source === 'favorite' || best.entry.source === 'memory' || preferFavorite ? 'usual' : 'recent',
    appendToCurrentMeal,
  };
}

function getCurrentMealRepeatItems(message: string, state: MealAssistantState) {
  const normalized = message.trim().toLowerCase();
  const savedItems = state.pendingMeal?.status === 'saved' && state.pendingMeal.items.length
    ? state.pendingMeal.items
    : state.currentMealItems;
  const hasSavedMeal = state.saved || state.pendingMeal?.status === 'saved';
  if (!hasSavedMeal || !savedItems.length || !repeatCueRegex.test(normalized) || repeatYesterdayRegex.test(normalized)) {
    return null;
  }

  const target = buildMemoryTarget(message);
  if (target) {
    const targetTokens = tokenizeText(target);
    const currentText = normalizeText([
      state.currentMealText ?? '',
      state.pendingMeal?.displayTitle ?? '',
      ...savedItems.map((item) => item.food_name),
      ...savedItems.map((item) => item.source_name ?? ''),
    ].join(' '));

    if (targetTokens.length && !targetTokens.some((token) => currentText.includes(token))) {
      return null;
    }
  }

  return cloneParsedItems(savedItems);
}

function buildMemoryLoadReply(match: MemoryMatch, message: string) {
  const reference = buildMemoryReference(match.candidate);
  const seed = `${message}:${match.candidate.id}:${match.mode}:${match.appendToCurrentMeal ? 'append' : 'replace'}`;

  if (match.appendToCurrentMeal) {
    if (match.mode === 'usual') {
      return choosePhrase(seed, [`Added your usual ${reference}`, `Added that usual ${reference}`]);
    }

    if (match.mode === 'yesterday') {
      return choosePhrase(seed, [`Added yesterday's ${reference}`, `Pulled in yesterday's ${reference}`]);
    }

    return choosePhrase(seed, [`Added ${reference} again`, `Brought ${reference} back in`]);
  }

  if (match.mode === 'usual') {
    return choosePhrase(seed, [`Using your usual ${reference}`, `I've got your usual ${reference}`]);
  }

  if (match.mode === 'yesterday') {
    return choosePhrase(seed, [`I pulled in yesterday's ${reference}`, `Using yesterday's ${reference}`]);
  }

  return choosePhrase(seed, [`I loaded ${reference} again`, `Pulled back ${reference}`]);
}

function findYesterdayMemoryEntry(context: MealAssistantContext, mealTypeHint?: string | null) {
  const recentEntries = (context.recentMeals ?? [])
    .filter((entry) => entry.items.length > 0 && isYesterday(getRecentMealOccurredAt(entry)))
    .filter((entry) => !mealTypeHint || entry.mealType === mealTypeHint)
    .sort((left, right) => (parseIsoTime(getRecentMealOccurredAt(right)) ?? 0) - (parseIsoTime(getRecentMealOccurredAt(left)) ?? 0));

  return recentEntries[0] ?? null;
}

function findRepeatMealEntry(context: MealAssistantContext, mealTypeHint?: string | null) {
  const yesterdayEntry = findYesterdayMemoryEntry(context, mealTypeHint);
  if (yesterdayEntry) {
    return yesterdayEntry;
  }

  const recentEntries = (context.recentMeals ?? [])
    .filter((entry) => entry.items.length > 0)
    .filter((entry) => !mealTypeHint || entry.mealType === mealTypeHint)
    .sort((left, right) => (parseIsoTime(getRecentMealOccurredAt(right)) ?? 0) - (parseIsoTime(getRecentMealOccurredAt(left)) ?? 0));

  return recentEntries[0] ?? null;
}

function buildCasualReply(message: string, state: MealAssistantState) {
  const normalized = stripEmotionalPreface(message).toLowerCase();
  const hasActiveMeal = state.currentMealItems.length > 0;

  if (hasFoodAfterConversationalLeadIn(message)) {
    return null;
  }

  if (/how(?:'|’)??s your day|how are you/.test(normalized)) {
    return hasActiveMeal
      ? choosePhrase(normalized, [
          'Doing good, I’m still with this meal if you want to keep going.',
          'I’m good, and I still have this meal in front of me if you want to keep building it.',
          'Doing alright. I can keep working on this meal, or you can send the next food.',
        ])
      : choosePhrase(normalized, [
          'Doing good. What did you eat?',
          'I’m good, ready when you are. What’d you have?',
          'I’m here and ready. What did you eat?',
        ]);
  }

  if (nothingYetRegex.test(normalized)) {
    return hasActiveMeal
      ? 'No problem, I still have this meal here if you want to adjust it later.'
      : 'No worries. Send the first meal whenever you are ready.';
  }

  if (/\b(?:barely ate|barely eaten|didn'?t eat much|haven'?t eaten much)\b/i.test(normalized)) {
    return hasActiveMeal
      ? 'No worries, I still have this meal here. Send anything else you remember and I will add it.'
      : 'No worries. Send whatever you did have, even if it was just a small thing.';
  }

  if (alreadySentFoodRegex.test(normalized)) {
    return hasActiveMeal
      ? 'You did - I have the meal here now. Tell me what to change or save it when it looks right.'
      : 'You did. I missed that turn, so send the food one more time and I will log it instead of treating this as a meal.';
  }

  if (negatedSaveRegex.test(normalized)) {
    if (!hasActiveMeal) {
      return 'No problem - there is no active meal to finish yet.';
    }

    return /\blog\b/i.test(normalized)
      ? 'Got it - I will keep this meal open and wait for your next change.'
      : 'No problem - I will leave this meal open so you can keep editing it.';
  }

  if (isSaveReviewQuestion(normalized)) {
    return hasActiveMeal
      ? 'If the meal looks right, you can save it. I still have it open for edits.'
      : 'There is not a meal ready yet. Send what you ate first, then I can save it.';
  }

  if (negativeFeedbackRegex.test(normalized)) {
    return hasActiveMeal
      ? `You're right to flag it. I currently have ${buildMealTextFromItems(state.currentMealItems)}. What should I change?`
      : 'You are right to flag it. Send the food again in your own words and I will keep the logging simple.';
  }

  if (confusionComplaintRegex.test(normalized)) {
    return hasActiveMeal
      ? 'You are right to flag it. I still have the meal open, so tell me what should change and I will fix the item instead of starting over.'
      : 'You are right to flag it. Send the food again in your own words and I will keep the logging simple.';
  }

  if (jokeRequestRegex.test(normalized)) {
    return hasActiveMeal
      ? choosePhrase(normalized, [
          'I’m better at calories than stand-up, but I’m still holding this meal if you want to keep going.',
          'Best joke I’ve got is that sauces count less than people think. I’ve still got this meal if you want to keep going.',
          'My jokes are mid, but the meal is still here. Want to keep going?',
        ])
      : choosePhrase(normalized, [
          'I’m better at logging than stand-up, so give me a meal and I’ll do my best work.',
          'My nutrition jokes are pretty average, but I can absolutely log your food. What’d you have?',
          'I’ll spare you the bad joke and help with the meal instead. What did you eat?',
        ]);
  }

  if (laughRegex.test(normalized)) {
    return hasActiveMeal
      ? choosePhrase(normalized, ['😂 fair, what else went with it?', '😂 alright, what else did you eat?', '😂 got you, anything else in this meal?'])
      : choosePhrase(normalized, ['😂 alright, what did you have?', '😂 fair, what’d you eat?', '😂 okay, send the meal whenever you want.']);
  }

  if (appreciationRegex.test(normalized)) {
    return hasActiveMeal
      ? choosePhrase(normalized, ['Anytime. Want to add anything else to this meal?', 'Of course. Want to keep building this one?', 'Yep, I’ve got you. Anything else for this meal?'])
      : choosePhrase(normalized, ['Anytime. Send the meal whenever you’re ready.', 'Of course. What did you have?', 'Yep, anytime. What are we logging?']);
  }

  if (frustrationRegex.test(normalized) && !/\b(?:no|actually|i meant|instead|make that|update that to|it was|that was)\b/i.test(normalized)) {
    return hasActiveMeal
      ? choosePhrase(normalized, ['No worries, I can fix it. Tell me what needs to change.', 'All good, we can clean it up. What should I change?', 'No stress, I’ve got the meal. Tell me what to fix.'])
      : choosePhrase(normalized, ['No worries, start with what you had and I’ll keep it simple.', 'All good. Just send the meal naturally and I’ll handle it.', 'No stress. Tell me what you ate and we’ll sort it out.']);
  }

  if (greetingRegex.test(normalized)) {
    return hasActiveMeal ? 'Hey, I’m with you. Want to keep going on this meal?' : choosePhrase(normalized, ['Hey, what did you eat?', 'Hey, what are we logging?', 'I’m here. What’d you have?']);
  }

  if (casualRegex.test(normalized)) {
    return hasActiveMeal
      ? buildContextualContinuityReply(state)
      : choosePhrase(normalized, ['All good. What did you eat?', 'Yep, send the meal whenever you’re ready.']);
  }

  if (offTopicRegex.test(normalized) && !hasStrongFoodSignal(normalized)) {
    return hasActiveMeal
      ? choosePhrase(normalized, ['I’m still holding this meal if you want to keep going.', 'I can keep working on this meal, or you can send the next food.', 'I’ve still got this meal here if you want to keep building it.'])
      : choosePhrase(normalized, ['I’m here for the food side. What did you eat?', 'I can help most on the nutrition side. What’d you have?', 'I’m best at the food part. What are we logging?']);
  }

  return null;
}

function scaleMealAtIndex(items: ParsedFoodItem[], index: number, factor: number) {
  return items.map((item, itemIndex) => {
    if (itemIndex !== index) {
      return item;
    }

    return {
      ...item,
      quantity: Number((item.quantity * factor).toFixed(2)),
      calories: Number((item.calories * factor).toFixed(1)),
      protein: Number((item.protein * factor).toFixed(1)),
      carbs: Number((item.carbs * factor).toFixed(1)),
      fat: Number((item.fat * factor).toFixed(1)),
      fiber: Number((item.fiber * factor).toFixed(1)),
      sugar: Number((item.sugar * factor).toFixed(1)),
      sodium: Number((item.sodium * factor).toFixed(1)),
      notes: item.notes ?? 'Adjusted from conversational sizing cue.',
    };
  });
}

function findContextualItemIndex(message: string, items: ParsedFoodItem[]) {
  const normalizedMessage = normalizeText(message);

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (!item) {
      continue;
    }

    if (normalizedMessage.includes(normalizeText(item.food_name))) {
      return index;
    }

    if (buildItemTargetHints(item).some((hint) => normalizedMessage.includes(hint))) {
      return index;
    }
  }

  return items.length ? items.length - 1 : -1;
}

function buildMealDescriptorReply(input: MealAssistantRunInput, context: MealAssistantContext): MealAssistantResponse | null {
  if (!input.state.currentMealItems.length) {
    return null;
  }

  const normalized = input.message.trim().toLowerCase();
  const targetIndex = findContextualItemIndex(input.message, input.state.currentMealItems);
  if (targetIndex < 0) {
    return null;
  }

  const currentItems = cloneParsedItems(input.state.currentMealItems);
  const targetItem = currentItems[targetIndex];
  if (!targetItem) {
    return null;
  }

  if ((sizeUpRegex.test(normalized) || sizeDownRegex.test(normalized)) && mealDescriptorReferenceRegex.test(normalized)) {
    const factor = sizeUpRegex.test(normalized) ? 1.2 : 0.85;
    const nextItems = scaleMealAtIndex(currentItems, targetIndex, factor);
    const nextState: MealAssistantState = {
      ...input.state,
      currentMealItems: nextItems,
      currentMealText: buildMealTextFromItems(nextItems),
      confidenceScore: getConfidenceScore(nextItems),
      saved: false,
      pendingClarification: null,
      lastAssistantQuestion: null,
    };

    const reply = sizeUpRegex.test(normalized)
      ? choosePhrase(`${normalized}:${targetItem.food_name}`, [
          `Got you, I’ll lean bigger on ${targetItem.food_name}.`,
          `Okay, I bumped ${targetItem.food_name} up a bit.`,
          `Makes sense, I’m treating ${targetItem.food_name} as a larger serving.`,
        ])
      : choosePhrase(`${normalized}:${targetItem.food_name}`, [
          `Got it, I’ll keep ${targetItem.food_name} a little lighter.`,
          `Okay, I trimmed ${targetItem.food_name} down a bit.`,
          `Makes sense, I’m leaning smaller on ${targetItem.food_name}.`,
        ]);

    return buildDirectResponse({
      intent: 'correction',
      assistantReply: reply,
      nextState,
      message: input.message,
    });
  }

  if (healthyCueRegex.test(normalized) && mealDescriptorReferenceRegex.test(normalized)) {
    const totals = sumTotals(currentItems);
    const proteinLeft = getRemainingProtein(context);
    const reply = totals.protein >= 25
      ? choosePhrase(`${normalized}:${totals.protein}`, [
          'Yeah, that looks pretty balanced overall, especially with the protein.',
          'Honestly, that looks fairly solid, especially on the protein side.',
        ])
      : proteinLeft !== null && proteinLeft > 0
        ? 'Yeah, that sounds pretty balanced. You could still use a little more protein later.'
        : 'Yeah, that sounds pretty balanced overall.';

    return buildDirectResponse({
      intent: 'casual_message',
      assistantReply: reply,
      nextState: {
        ...input.state,
        currentMealItems: currentItems,
        currentMealText: input.state.currentMealText ?? buildMealTextFromItems(currentItems),
        confidenceScore: input.state.confidenceScore ?? getConfidenceScore(currentItems),
      },
      message: input.message,
    });
  }

  return null;
}

function subtractNutrition(item: ParsedFoodItem, values: Partial<Pick<ParsedFoodItem, 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'sugar' | 'sodium'>>) {
  return {
    ...item,
    calories: Number(Math.max(0, item.calories - (values.calories ?? 0)).toFixed(1)),
    protein: Number(Math.max(0, item.protein - (values.protein ?? 0)).toFixed(1)),
    carbs: Number(Math.max(0, item.carbs - (values.carbs ?? 0)).toFixed(1)),
    fat: Number(Math.max(0, item.fat - (values.fat ?? 0)).toFixed(1)),
    fiber: Number(Math.max(0, item.fiber - (values.fiber ?? 0)).toFixed(1)),
    sugar: Number(Math.max(0, item.sugar - (values.sugar ?? 0)).toFixed(1)),
    sodium: Number(Math.max(0, item.sodium - (values.sodium ?? 0)).toFixed(1)),
  };
}

function regularizeChipotleChicken(item: ParsedFoodItem) {
  const nextName = /\bdouble chicken\b/i.test(item.food_name)
    ? item.food_name.replace(/\bdouble chicken\b/gi, 'chicken')
    : item.food_name.replace(/\bextra chicken\b/gi, 'chicken');
  const adjusted = subtractNutrition(item, {
    calories: 180,
    protein: 32,
    fat: 7,
    sodium: 310,
  });

  return {
    ...adjusted,
    food_name: nextName === item.food_name ? item.food_name : nextName,
    notes: [item.notes, 'Adjusted from double chicken to regular chicken.'].filter(Boolean).join(' '),
    original_user_text: item.original_user_text ?? item.food_name,
  };
}

function doubleChipotleChicken(item: ParsedFoodItem) {
  if (/\bdouble chicken\b/i.test(item.food_name)) {
    return item;
  }

  const nextName = /\bchicken\b/i.test(item.food_name)
    ? item.food_name.replace(/\bchicken\b/i, 'double chicken')
    : `${item.food_name}, double chicken`;

  return {
    ...item,
    food_name: nextName,
    calories: Number((item.calories + 180).toFixed(1)),
    protein: Number((item.protein + 32).toFixed(1)),
    fat: Number((item.fat + 7).toFixed(1)),
    sodium: Number((item.sodium + 310).toFixed(1)),
    notes: [item.notes, 'Adjusted from regular chicken to double chicken.'].filter(Boolean).join(' '),
    original_user_text: item.original_user_text ?? item.food_name,
  };
}

function removeChipotleCheese(item: ParsedFoodItem) {
  const nextName = item.food_name
    .replace(/\s*,?\s*cheese\b/gi, '')
    .replace(/\bwith\s*,?\s*/i, 'with ')
    .replace(/\bwith\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const adjusted = subtractNutrition(item, {
    calories: 110,
    protein: 6,
    carbs: 1,
    fat: 8,
    sodium: 190,
  });

  return {
    ...adjusted,
    food_name: nextName || item.food_name,
    notes: [item.notes, 'Removed cheese from the Chipotle bowl estimate.'].filter(Boolean).join(' '),
    original_user_text: item.original_user_text ?? item.food_name,
  };
}

function buildChipotleChipsGuacItem(message: string) {
  return makeGenericEstimate(
    {
      key: 'chipotle chips with guacamole',
      label: 'Chipotle chips with guacamole',
      quantity: 1,
      unit: 'order',
      calories: 770,
      protein: 8,
      carbs: 81,
      fat: 47,
      fiber: 12,
      sugar: 3,
      sodium: 1130,
      sourceName: 'Chipotle chips and guacamole estimate',
    },
    message,
  );
}

function cleanMealMutationFoodText(text: string) {
  return text
    .replace(/[.?!]+$/g, '')
    .replace(/\b(?:please|pls|too|also|okay|ok|well|yeah|yep|alright)\b/gi, ' ')
    .replace(/\b(?:to|with)\s+(?:this|that|the)?\s*(?:meal|order)\b.*$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractAddCommandFoodText(message: string) {
  const normalized = getNormalizedMutationClause(message);
  const match =
    normalized.match(/^(?:i\s+also\s+had|and\s+i\s+had|also\s+add|throw\s+in|also\s+had|also\s+ate|also\s+drank)\s+(.+)$/i)
    ?? normalized.match(/^(?:also\s+)?add\s+(.+)$/i)
    ?? normalized.match(/^(?:and|plus|with)\s+(.+)$/i);
  const foodText = match
    ? cleanMealMutationFoodText(match[1] ?? '').replace(/\bguac\b/gi, 'guacamole')
    : null;

  if (!foodText || !hasStrongFoodSignal(foodText) || isNonFoodDialogueMessage(foodText)) {
    return null;
  }

  return foodText;
}

function parseReplacementCorrection(message: string) {
  const normalized = stripEmotionalPreface(message)
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const match =
    normalized.match(/^no\s+(.+?)\s+not\s+(.+)$/i)
    ?? normalized.match(/^i meant\s+(.+?)\s+not\s+(.+)$/i)
    ?? normalized.match(/^not\s+(.+?)\s+(?:it was|i meant|instead)\s+(.+)$/i);

  if (!match) {
    return null;
  }

  const replacement = cleanMealMutationFoodText(match[1] ?? '');
  const rejected = cleanMealMutationFoodText(match[2] ?? '');

  if (!replacement || !rejected || !hasStrongFoodSignal(replacement)) {
    return null;
  }

  return { replacement, rejected };
}


function parseSwapReplacement(message: string) {
  const normalized = stripEmotionalPreface(message)
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const match =
    normalized.match(/^(?:swap|replace)\s+(?:the\s+)?(.+?)\s+(?:for|with|to)\s+(.+)$/i)
    ?? normalized.match(/^instead\s+of\s+(.+?)\s+(?:make it|use|do|add|log)?\s*(.+)$/i);

  if (!match) {
    return null;
  }

  const target = cleanMealMutationFoodText(match[1] ?? '').replace(/\bfries\b/gi, 'fry');
  const replacement = cleanMealMutationFoodText(match[2] ?? '').replace(/\bguac\b/gi, 'guacamole');

  if (!target || !replacement || !hasStrongFoodSignal(target) || !hasStrongFoodSignal(replacement)) {
    return null;
  }

  return { target, replacement };
}

function parseCorrectionFoodReplacement(message: string) {
  const normalized = stripEmotionalPreface(message)
    .toLowerCase()
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const hasCorrectionCue = /^(?:it was|that was|actually|i meant|no|nah|nvm|nevermind|never mind)\b/.test(normalized)
    || /\b(?:i meant|instead)$/i.test(normalized);
  if (!hasCorrectionCue) {
    return null;
  }

  const quantityPattern = '\\d+(?:\\.\\d+)?|\\.\\d+|a half|half|three quarters?|a quarter|quarter|a|an|one|two|three|four|five|six|seven|eight|nine|ten';
  const cleaned = normalized
    .replace(/\s+(?:i meant|instead)$/i, '')
    .replace(/^(?:okay|ok|well|yeah|yep|alright|so)\s+/i, '')
    .trim();
  const match = cleaned.match(new RegExp(`^(?:(?:it was|that was|actually|i meant|no|nah|nvm|nevermind|never mind)\\s+)*(?:actually\\s+)?(${quantityPattern})\\s+(.+)$`, 'i'));
  const cueOnlyMatch = cleaned.match(/^(?:(?:it was|that was|actually|i meant|no|nah|nvm|nevermind|never mind)\s+)+(?:the\s+)?(.+)$/i);

  if (!match && !cueOnlyMatch) {
    return null;
  }

  const rawFoodText = match ? (match[2] ?? '') : (cueOnlyMatch?.[1] ?? '');
  if (!match && /^i\s+(?:had|ate|drank)\b/i.test(rawFoodText)) {
    return null;
  }

  const quantity = match ? parseCount(match[1] ?? '1') : 1;
  const foodText = cleanMealMutationFoodText(rawFoodText);
  if (!foodText || !hasStrongFoodSignal(foodText)) {
    return null;
  }

  const unit = /\brice cakes?\b/i.test(foodText)
    ? quantity === 1 ? 'cake' : 'cakes'
    : normalizeQuantityUnit(parseLeadingServingFood(`${quantity} ${foodText}`)?.unit) ?? null;

  return {
    foodText,
    quantity,
    unit,
  };
}

async function resolveFoodTextForMealMutation(args: {
  foodText: string;
  state: MealAssistantState;
  resolveItemNutrition: NutritionResolver;
  action: MealAssistantItem['action'];
  quantity?: number;
  unit?: string | null;
}) {
  const candyItem = buildCandyServingEstimate(
    {
      name: args.foodText,
      brand: null,
      quantity: args.quantity ?? 1,
      unit: args.unit ?? null,
      modifiers: [],
      action: args.action,
    },
    args.foodText,
  );
  if (candyItem) {
    return [candyItem];
  }

  const hasTrustedSignal = /\b(?:chipotle|taco\s*bell|tacobell|mcdonald'?s?|mc\s*donalds?|chick\s*fil\s*a|starbucks|subway|wendy'?s|burger\s*king|burgerking|panda express|domino'?s?|dominos|pizza hut|raising canes?|canes|popeyes|panera|dunkin|kfc|five guys|jersey mikes?|quest|david|fairlife|core power|premier protein|quaker|daisy|oikos|chobani|kodiak|doritos|goldfish)\b/i.test(args.foodText);
  const trustedEstimate = hasTrustedSignal ? getTrustedCatalogEstimate(args.foodText, args.state.mealType) : null;
  if (trustedEstimate?.items.length) {
    return trustedEstimate.items;
  }

  const knownItems = /\bapple slices\b/i.test(args.foodText) ? [] : detectKnownFoodEstimates(args.foodText);
  if (knownItems.length) {
    return knownItems.map((item) => {
      const nextQuantity = args.quantity && args.quantity > 0 ? args.quantity : item.quantity;
      const scaled = scaleParsedItems([item], nextQuantity)[0] ?? item;
      return {
        ...scaled,
        unit: args.unit ?? scaled.unit,
      };
    });
  }

  return resolveAssistantItems(
    [
      {
        name: args.foodText,
        brand: null,
        quantity: args.quantity ?? 1,
        unit: args.unit ?? null,
        modifiers: [],
        action: args.action,
      },
    ],
    args.state.mealType,
    args.resolveItemNutrition,
    args.foodText,
  );
}

function preserveFrySizeCorrectionLabel(items: ParsedFoodItem[], message: string, targetItem: ParsedFoodItem | null) {
  if (!targetItem || !/\bfr(?:y|ies)\b/i.test(targetItem.food_name) || !/\bmedium\b/i.test(message) || !/\blarge\b/i.test(message)) {
    return items;
  }

  return items.map((item) => /\bfr(?:y|ies)\b/i.test(item.food_name) ? { ...item, food_name: 'Medium Fry' } : item);
}

type SubwayServingLength = 'six-inch' | 'footlong';

function parseSubwayLengthCorrection(message: string): SubwayServingLength | null {
  const normalized = normalizeFoodText(stripEmotionalPreface(message));
  const hasCorrectionCue = /^(?:no|nah|actually|i meant|it was|that was|make it|make that|change it|change that|update it|update that)\b/.test(normalized);

  if (!hasCorrectionCue) {
    return null;
  }

  if (/\bfoot\s*long\b|\bfootlong\b/.test(normalized)) {
    return 'footlong';
  }

  if (/\b6\s*(?:inch|in)\b|\bsix\s*(?:inch|in)\b/.test(normalized)) {
    return 'six-inch';
  }

  return null;
}

function subwayServingLengthForItem(item: ParsedFoodItem): SubwayServingLength {
  const text = normalizeFoodText(`${item.food_name} ${item.unit}`);
  return /\bfoot\s*long\b|\bfootlong\b/.test(text) ? 'footlong' : 'six-inch';
}

function isSubwaySandwichItem(item: ParsedFoodItem) {
  const text = normalizeFoodText(`${item.food_name} ${item.source_name ?? ''} ${item.unit}`);
  return /\bsubway\b/.test(text) && /\b(?:sub|sandwich|meatball|bmt|club|turkey|footlong|inch)\b/.test(text);
}

function roundNutrition(value: number) {
  return Number(value.toFixed(1));
}

function renameSubwayServing(foodName: string, target: SubwayServingLength) {
  const label = target === 'footlong' ? 'Footlong' : '6-Inch';
  let nextName = foodName
    .replace(/\bfoot\s*long\b/gi, label)
    .replace(/\bfootlong\b/gi, label)
    .replace(/\b6\s*(?:inch|in)\b/gi, label)
    .replace(/\bsix\s*(?:inch|in)\b/gi, label);

  if (!new RegExp(`\\b${target === 'footlong' ? 'footlong' : '6 inch|6-inch'}\\b`, 'i').test(normalizeFoodText(nextName))) {
    nextName = /^subway,?\s+/i.test(nextName)
      ? nextName.replace(/^subway,?\s+/i, `SUBWAY, ${label} `)
      : `${label} ${nextName}`;
  }

  return nextName.replace(/\s+/g, ' ').trim();
}

function applySubwayLengthCorrection(items: ParsedFoodItem[], target: SubwayServingLength) {
  const targetIndex = items.findIndex(isSubwaySandwichItem);
  if (targetIndex < 0) {
    return null;
  }

  const currentItem = items[targetIndex];
  if (!currentItem) {
    return null;
  }

  const currentLength = subwayServingLengthForItem(currentItem);
  if (currentLength === target) {
    return items;
  }

  const currentMultiplier = currentLength === 'footlong' ? 2 : 1;
  const targetMultiplier = target === 'footlong' ? 2 : 1;
  const factor = targetMultiplier / currentMultiplier;
  const nextItem: ParsedFoodItem = {
    ...currentItem,
    food_name: renameSubwayServing(currentItem.food_name, target),
    quantity: 1,
    unit: target === 'footlong' ? 'footlong' : '6-inch sub',
    calories: roundNutrition(currentItem.calories * factor),
    protein: roundNutrition(currentItem.protein * factor),
    carbs: roundNutrition(currentItem.carbs * factor),
    fat: roundNutrition(currentItem.fat * factor),
    fiber: roundNutrition(currentItem.fiber * factor),
    sugar: roundNutrition(currentItem.sugar * factor),
    sodium: roundNutrition(currentItem.sodium * factor),
    notes: [currentItem.notes, `Adjusted serving from ${currentLength} to ${target}.`].filter(Boolean).join(' '),
  };

  return [
    ...items.slice(0, targetIndex),
    nextItem,
    ...items.slice(targetIndex + 1),
  ];
}

async function buildAdaptiveMealMutationReply(
  input: MealAssistantRunInput,
  resolveItemNutrition: NutritionResolver,
  saveMeal: SaveExecutor = defaultSaveMeal,
): Promise<MealAssistantResponse | null> {
  if (!input.state.currentMealItems.length || input.state.saved) {
    return null;
  }

  const normalized = stripEmotionalPreface(input.message).toLowerCase();
  const currentItems = cloneParsedItems(input.state.currentMealItems);

  if (/\b(?:remove|clear|delete)\s+(?:everything|all|the whole meal|this meal)\b/i.test(normalized)) {
    const nextState: MealAssistantState = {
      ...input.state,
      currentMealItems: [],
      userCorrections: [...input.state.userCorrections, input.message],
      currentMealText: null,
      confidenceScore: 0.82,
      saved: false,
      pendingClarification: null,
      lastAssistantQuestion: null,
    };

    return buildDirectResponse({
      intent: 'remove_item',
      assistantReply: 'Cleared the meal. We can start fresh whenever you are ready.',
      nextState,
      message: input.message,
    });
  }

  const targetIndex = findContextualItemIndex(input.message, currentItems);
  const targetItem = targetIndex >= 0 ? currentItems[targetIndex] : currentItems.at(-1) ?? null;

  if (!targetItem) {
    return null;
  }

  const subwayServingTarget = parseSubwayLengthCorrection(input.message);
  if (subwayServingTarget) {
    const nextItems = applySubwayLengthCorrection(currentItems, subwayServingTarget);
    if (nextItems) {
      const nextState: MealAssistantState = {
        ...input.state,
        currentMealItems: nextItems,
        userCorrections: [...input.state.userCorrections, input.message],
        currentMealText: buildMealTextFromItems(nextItems),
        confidenceScore: getConfidenceScore(nextItems),
        saved: false,
        pendingClarification: null,
        lastAssistantQuestion: null,
      };

      return buildDirectResponse({
        intent: 'correction',
        assistantReply: `Got it, I changed that to a ${subwayServingTarget}. About ${Math.round(sumTotals(nextItems).calories)} calories total.`,
        nextState,
        message: input.message,
      });
    }
  }

  const swapReplacement = parseSwapReplacement(input.message);
  if (swapReplacement) {
    const swapTargetIndex = findOperationTargetIndexByHint(swapReplacement.target, currentItems);
    const swapTargetItem = currentItems[swapTargetIndex] ?? targetItem;
    const resolvedSwapIndex = swapTargetIndex >= 0 ? swapTargetIndex : targetIndex;
    const replacementItems = await resolveFoodTextForMealMutation({
      foodText: swapReplacement.replacement,
      state: input.state,
      resolveItemNutrition,
      action: 'replace',
      quantity: swapTargetItem.quantity,
      unit: swapTargetItem.unit,
    });

    if (replacementItems.length) {
      const nextItems = [
        ...currentItems.slice(0, resolvedSwapIndex),
        ...replacementItems,
        ...currentItems.slice(resolvedSwapIndex + 1),
      ];
      const nextState: MealAssistantState = {
        ...input.state,
        currentMealItems: nextItems,
        userCorrections: [...input.state.userCorrections, input.message],
        currentMealText: buildMealTextFromItems(nextItems),
        confidenceScore: getConfidenceScore(nextItems),
        saved: false,
        pendingClarification: null,
        lastAssistantQuestion: null,
      };
      const replacementLabel = replacementItems.map((item) => formatParsedItemLabel(item)).join(' and ');

      return buildDirectResponse({
        intent: 'correction',
        assistantReply: `Swapped ${swapTargetItem.food_name} for ${replacementLabel}. About ${Math.round(sumTotals(nextItems).calories)} calories total.`,
        nextState,
        message: input.message,
      });
    }
  }

  const additiveFoodText = /^(?:i\s+also\s+had|and\s+i\s+had|also\s+had|also\s+ate|also\s+drank|throw\s+in|plus)\b/i.test(normalized)
    ? extractAddCommandFoodText(input.message)
    : null;
  if (additiveFoodText) {
    const addedItems = await resolveFoodTextForMealMutation({
      foodText: additiveFoodText,
      state: input.state,
      resolveItemNutrition,
      action: 'add',
    });

    if (addedItems.length) {
      const nextItems = [...currentItems, ...addedItems];
      const nextState: MealAssistantState = {
        ...input.state,
        currentMealItems: nextItems,
        userCorrections: [...input.state.userCorrections, input.message],
        currentMealText: buildMealTextFromItems(nextItems),
        confidenceScore: getConfidenceScore(nextItems),
        saved: false,
        pendingClarification: null,
        lastAssistantQuestion: null,
      };

      return buildDirectResponse({
        intent: 'add_to_current_meal',
        assistantReply: `Added ${addedItems.map((item) => formatParsedItemLabel(item)).join(' and ')}. About ${Math.round(sumTotals(nextItems).calories)} calories total.`,
        nextState,
        message: input.message,
      });
    }
  }

  const heuristicOperations = extractHeuristicMutationOperations(input.message, input.state);
  if (heuristicOperations.length) {
    const applied = await applyDecisionOperations({
      operations: heuristicOperations,
      state: input.state,
      message: input.message,
      resolveItemNutrition,
    });

    let nextState: MealAssistantState = {
      ...input.state,
      currentMealItems: applied.nextItems,
      userCorrections: [...input.state.userCorrections, input.message],
      currentMealText: buildMealTextFromItems(applied.nextItems),
      confidenceScore: getConfidenceScore(applied.nextItems),
      saved: false,
      pendingClarification: null,
      lastAssistantQuestion: null,
    };

    if (applied.shouldSaveMeal && applied.nextItems.length) {
      const saveAttempt = await attemptPendingMealSave({ state: nextState, items: applied.nextItems, saveMeal });
      nextState = saveAttempt.nextState;
      if (!saveAttempt.saved) {
        return buildDirectResponse({
          intent: 'save_meal',
          assistantReply: saveAttempt.assistantReply,
          nextState,
          message: input.message,
          shouldSaveMeal: false,
        });
      }
    }

    const responseIntent = heuristicOperations.every((operation) => operation.action === 'update_item_quantity')
      ? 'quantity_change'
      : 'correction';

    return buildDirectResponse({
      intent: responseIntent,
      assistantReply: buildCompoundOperationReply({
        summaryParts: applied.summaryParts,
        nextItems: applied.nextItems,
        saved: nextState.saved,
        repairTone: frustrationRegex.test(input.message),
        previousReply: input.state.lastAssistantReply,
      }),
      nextState,
      message: input.message,
    });
  }

  const removeTarget = extractRemoveTargetFromMessage(input.message);
  const chipotleCheeseIndex = currentItems.findIndex((item) => /\bchipotle\b/i.test(item.food_name) && /\bcheese\b/i.test(item.food_name));
  if (removeTarget && /\bcheese\b/i.test(removeTarget) && chipotleCheeseIndex >= 0) {
    const nextItems = currentItems.map((item, index) => (index === chipotleCheeseIndex ? removeChipotleCheese(item) : item));
    const nextState: MealAssistantState = {
      ...input.state,
      currentMealItems: nextItems,
      userCorrections: [...input.state.userCorrections, input.message],
      currentMealText: buildMealTextFromItems(nextItems),
      confidenceScore: getConfidenceScore(nextItems),
      saved: false,
      pendingClarification: null,
      lastAssistantQuestion: null,
    };

    return buildDirectResponse({
      intent: 'remove_item',
      assistantReply: `Removed cheese from the Chipotle bowl. This meal is about ${Math.round(sumTotals(nextItems).calories)} calories now.`,
      nextState,
      message: input.message,
    });
  }
  const replacementCorrection = parseReplacementCorrection(input.message);
  if (replacementCorrection) {
    const replacementFoodText =
      /\bsandwich\b/i.test(targetItem.food_name) && /\bgrilled chicken\b/i.test(replacementCorrection.replacement) && !/\bsandwich\b/i.test(replacementCorrection.replacement)
        ? `${replacementCorrection.replacement} sandwich`
        : replacementCorrection.replacement;
    const replacementItems = await resolveFoodTextForMealMutation({
      foodText: replacementFoodText,
      state: input.state,
      resolveItemNutrition,
      action: 'replace',
      quantity: targetItem.quantity,
      unit: targetItem.unit,
    });

    if (replacementItems.length) {
      const displayReplacementItems = preserveFrySizeCorrectionLabel(replacementItems, input.message, targetItem);
      const nextItems = [
        ...currentItems.slice(0, targetIndex),
        ...displayReplacementItems,
        ...currentItems.slice(targetIndex + 1),
      ];
      const nextState: MealAssistantState = {
        ...input.state,
        currentMealItems: nextItems,
        userCorrections: [...input.state.userCorrections, input.message],
        currentMealText: buildMealTextFromItems(nextItems),
        confidenceScore: getConfidenceScore(nextItems),
        saved: false,
        pendingClarification: null,
        lastAssistantQuestion: null,
      };
      const replacementLabel = displayReplacementItems.map((item) => item.food_name).join(' and ');

      return buildDirectResponse({
        intent: 'correction',
        assistantReply: `Fixed it - switched ${targetItem.food_name} to ${replacementLabel}. This meal is about ${Math.round(sumTotals(nextItems).calories)} calories now.`,
        nextState,
        message: input.message,
      });
    }
  }

  const correctionFoodReplacement = parseCorrectionFoodReplacement(input.message);
  if (correctionFoodReplacement) {
    if (!shouldUseDirectCorrectionReplacement(correctionFoodReplacement.foodText, input.state)) {
      return null;
    }

    const replacementItems = await resolveFoodTextForMealMutation({
      foodText: correctionFoodReplacement.foodText,
      state: input.state,
      resolveItemNutrition,
      action: 'replace',
      quantity: correctionFoodReplacement.quantity,
      unit: correctionFoodReplacement.unit,
    });

    if (replacementItems.length) {
      const nextItems = [
        ...currentItems.slice(0, targetIndex),
        ...replacementItems,
        ...currentItems.slice(targetIndex + 1),
      ];
      const nextState: MealAssistantState = {
        ...input.state,
        currentMealItems: nextItems,
        userCorrections: [...input.state.userCorrections, input.message],
        currentMealText: buildMealTextFromItems(nextItems),
        confidenceScore: getConfidenceScore(nextItems),
        saved: false,
        pendingClarification: null,
        lastAssistantQuestion: null,
      };
      const replacementLabel = replacementItems.map((item) => formatParsedItemLabel(item)).join(' and ');

      return buildDirectResponse({
        intent: 'correction',
        assistantReply: `Fixed it - changed that to ${replacementLabel}. About ${Math.round(sumTotals(nextItems).calories)} calories total.`,
        nextState,
        message: input.message,
      });
    }
  }

  const addCommandFoodText = extractAddCommandFoodText(input.message);
  if (addCommandFoodText) {
    const addedItems = await resolveFoodTextForMealMutation({
      foodText: addCommandFoodText,
      state: input.state,
      resolveItemNutrition,
      action: 'add',
    });

    if (addedItems.length) {
      const nextItems = [...currentItems, ...addedItems];
      const nextState: MealAssistantState = {
        ...input.state,
        currentMealItems: nextItems,
        userCorrections: [...input.state.userCorrections, input.message],
        currentMealText: buildMealTextFromItems(nextItems),
        confidenceScore: getConfidenceScore(nextItems),
        saved: false,
        pendingClarification: null,
        lastAssistantQuestion: null,
      };
      const addedLabel = addedItems.map((item) => item.food_name).join(' and ');

      return buildDirectResponse({
        intent: 'add_to_current_meal',
        assistantReply: `Added ${addedLabel}. This meal is about ${Math.round(sumTotals(nextItems).calories)} calories now.`,
        nextState,
        message: input.message,
      });
    }
  }

  if (/\b(?:no|without|hold the)\s+bun\b|\bno bun\b/.test(normalized) && /\bburger\b/i.test(targetItem.food_name)) {
    const replacementIndex = targetIndex >= 0 ? targetIndex : currentItems.length - 1;
    const bunlessItem = {
      ...targetItem,
      food_name: /without bun/i.test(targetItem.food_name) ? targetItem.food_name : `${targetItem.food_name} without bun`,
      calories: Math.max(0, Number((targetItem.calories - 110).toFixed(1))),
      carbs: Math.max(0, Number((targetItem.carbs - 24).toFixed(1))),
      protein: targetItem.protein,
      fat: targetItem.fat,
      notes: [targetItem.notes, 'Adjusted to remove the bun from the burger estimate.'].filter(Boolean).join(' '),
      source_type: 'AI_ESTIMATE' as const,
      source_name: 'Adjusted burger estimate',
      confidence_label: 'Estimated' as const,
      is_trusted: false,
      used_ai_fallback: true,
    };
    const nextItems = currentItems.map((item, index) => (index === replacementIndex ? bunlessItem : item));
    const nextState: MealAssistantState = {
      ...input.state,
      currentMealItems: nextItems,
      userCorrections: [...input.state.userCorrections, input.message],
      currentMealText: buildMealTextFromItems(nextItems),
      confidenceScore: getConfidenceScore(nextItems),
      saved: false,
      pendingClarification: null,
      lastAssistantQuestion: null,
    };

    return buildDirectResponse({
      intent: 'correction',
      assistantReply: `Updated the burger to no bun. About ${Math.round(sumTotals(nextItems).calories)} calories total.`,
      nextState,
      message: input.message,
    });
  }

  const correctedServing = parseCorrectedServing(input.message);
  if (correctedServing) {
    const targetUnit = normalizeQuantityUnit(targetItem.unit);
    const nextUnit = correctedServing.unit ?? targetUnit;
    const canScaleDirectly = !correctedServing.unit || !targetUnit || correctedServing.unit === targetUnit;

    if (canScaleDirectly) {
      const nextItems = currentItems.map((item, index) => {
        if (index !== targetIndex) {
          return item;
        }

        const scaled = scaleParsedItems([item], correctedServing.quantity)[0] ?? item;
        return {
          ...scaled,
          unit: nextUnit ?? scaled.unit,
          notes: [
            scaled.notes,
            `Adjusted to ${formatDisplayQuantity(correctedServing.quantity)}${nextUnit ? ` ${formatUnitForQuantity(nextUnit, correctedServing.quantity)}` : ''} from conversational correction.`,
          ].filter(Boolean).join(' '),
        };
      });
      const adjustedItem = nextItems[targetIndex] ?? targetItem;
      const nextState: MealAssistantState = {
        ...input.state,
        currentMealItems: nextItems,
        userCorrections: [...input.state.userCorrections, input.message],
        currentMealText: buildMealTextFromItems(nextItems),
        confidenceScore: getConfidenceScore(nextItems),
        saved: false,
        pendingClarification: null,
        lastAssistantQuestion: null,
      };
      const portionLabel = [formatDisplayQuantity(correctedServing.quantity), nextUnit ? formatUnitForQuantity(nextUnit, correctedServing.quantity) : null]
        .filter(Boolean)
        .join(' ');
      const previousReplyStartedUpdated = /^updated that\b/i.test(input.state.lastAssistantReply ?? '');
      const replyPrefix = frustrationRegex.test(input.message)
        ? 'No worries, fixed that'
        : previousReplyStartedUpdated || /^\s*(?:no|actually|i meant|instead)\b/i.test(input.message)
          ? `${portionLabel || formatDisplayQuantity(correctedServing.quantity)} is set now`
          : `Updated that to ${portionLabel || formatDisplayQuantity(correctedServing.quantity)}`;

      return buildDirectResponse({
        intent: 'quantity_change',
        assistantReply: `${replyPrefix} for ${adjustedItem.food_name}. About ${Math.round(sumTotals(nextItems).calories)} calories total.`,
        nextState,
        message: input.message,
      });
    }
  }

  const chipotleIndex = currentItems.findIndex((item) => /\bchipotle\b/i.test(item.food_name));
  const wantsRegularChicken = /\b(?:regular chicken|chicken regular)\b/.test(normalized) && /\b(?:double|extra|not double|not extra)\b/.test(normalized);
  const wantsChipsGuac = /\bchips?\b/.test(normalized) && /\bguac(?:amole)?\b/.test(normalized);

  if (chipotleIndex >= 0 && (wantsRegularChicken || wantsChipsGuac) && correctionCueRegex.test(normalized)) {
    const nextItems = currentItems.map((item, index) => {
      if (index !== chipotleIndex || !wantsRegularChicken) {
        return item;
      }

      return regularizeChipotleChicken(item);
    });

    if (wantsChipsGuac && !nextItems.some((item) => /\bchips?\b/i.test(item.food_name) && /\bguac/i.test(item.food_name))) {
      nextItems.push(buildChipotleChipsGuacItem(input.message));
    }

    const nextState: MealAssistantState = {
      ...input.state,
      currentMealItems: nextItems,
      currentMealText: buildMealTextFromItems(nextItems),
      confidenceScore: getConfidenceScore(nextItems),
      saved: false,
      pendingClarification: null,
      lastAssistantQuestion: null,
      userCorrections: [...input.state.userCorrections, input.message],
    };
    const totalCalories = Math.round(sumTotals(nextItems).calories);
    const changeSummary = [
      wantsRegularChicken ? 'switched it to regular chicken' : null,
      wantsChipsGuac ? 'added chips with guac' : null,
    ].filter(Boolean).join(' and ');

    return buildDirectResponse({
      intent: 'correction',
      assistantReply: `Yep, ${changeSummary}. That brings this meal to about ${totalCalories} calories.`,
      nextState,
      message: input.message,
    });
  }

  const explicitQuantityMatch = normalized.match(explicitQuantityUpdateRegex);
  if (explicitQuantityMatch) {
    const nextQuantity = parseCount(explicitQuantityMatch[1] ?? '');
    if (nextQuantity > 0) {
      const nextItems = scaleMealAtIndex(currentItems, targetIndex >= 0 ? targetIndex : currentItems.length - 1, nextQuantity / Math.max(targetItem.quantity, 1));
      const nextState: MealAssistantState = {
        ...input.state,
        currentMealItems: nextItems,
        currentMealText: buildMealTextFromItems(nextItems),
        confidenceScore: getConfidenceScore(nextItems),
        saved: false,
        pendingClarification: null,
        lastAssistantQuestion: null,
      };

      return buildDirectResponse({
        intent: 'quantity_change',
        assistantReply: choosePhrase(`${normalized}:${targetItem.food_name}:${nextQuantity}`, [
          `Done, I changed that to ${nextQuantity} ${targetItem.food_name}.`,
          `Okay, I updated that to ${nextQuantity} ${targetItem.food_name}.`,
          `Got you, that’s ${nextQuantity} ${targetItem.food_name} now.`,
        ]),
        nextState,
        message: input.message,
      });
    }
  }

  if (doubleThatRegex.test(normalized)) {
    const nextItems = scaleMealAtIndex(currentItems, targetIndex >= 0 ? targetIndex : currentItems.length - 1, 2);
    const nextState: MealAssistantState = {
      ...input.state,
      currentMealItems: nextItems,
      currentMealText: buildMealTextFromItems(nextItems),
      confidenceScore: getConfidenceScore(nextItems),
      saved: false,
      pendingClarification: null,
      lastAssistantQuestion: null,
    };

    return buildDirectResponse({
      intent: 'quantity_change',
      assistantReply: choosePhrase(`${normalized}:${targetItem.food_name}`, [
        `Done, I doubled ${targetItem.food_name}.`,
        `Got you, I doubled ${targetItem.food_name}.`,
        `${targetItem.food_name} is doubled now.`,
      ]),
      nextState,
      message: input.message,
    });
  }

  if (grilledSwapRegex.test(normalized)) {
    const replacementName = /fried/i.test(targetItem.food_name)
      ? targetItem.food_name.replace(/fried/gi, 'Grilled')
      : `Grilled ${targetItem.food_name}`.replace(/Grilled Grilled/gi, 'Grilled');

    const lookedUp = await resolveItemNutrition({
      item: {
        name: replacementName,
        brand: null,
        quantity: targetItem.quantity,
        unit: targetItem.unit ?? null,
        modifiers: [],
        action: 'replace',
      },
      mealType: input.state.mealType,
    });

    const replacement = lookedUp?.items?.[0]
      ? lookedUp.items[0]
      : {
          ...targetItem,
          food_name: replacementName,
          calories: Number((targetItem.calories * 0.82).toFixed(1)),
          fat: Number((targetItem.fat * 0.62).toFixed(1)),
          notes: 'Adjusted toward a grilled version.',
        };

    const nextItems = currentItems.map((item, index) => (index === (targetIndex >= 0 ? targetIndex : currentItems.length - 1) ? replacement : item));
    const nextState: MealAssistantState = {
      ...input.state,
      currentMealItems: nextItems,
      currentMealText: buildMealTextFromItems(nextItems),
      confidenceScore: getConfidenceScore(nextItems),
      saved: false,
      pendingClarification: null,
      lastAssistantQuestion: null,
    };

    return buildDirectResponse({
      intent: 'correction',
      assistantReply: choosePhrase(`${normalized}:${targetItem.food_name}`, [
        `Yep, I switched that to grilled.`,
        `Got it, I changed that to a grilled version.`,
        `Okay, I’m treating that as grilled now.`,
      ]),
      nextState,
      message: input.message,
    });
  }

  return null;
}

function buildDirectResponse(args: {
  intent: MealAssistantModelOutput['intent'];
  assistantReply: string;
  nextState: MealAssistantState;
  message?: string;
  activeQuestion?: string | null;
  shouldSaveMeal?: boolean;
}) {
  const updatedState = args.message
    ? updateConversationState(args.nextState, {
        intent: args.intent,
        message: args.message,
        activeQuestion: args.activeQuestion,
      })
    : args.nextState;
  const stateMealItems = withServingMetadataForItems(updatedState.currentMealItems);
  let nextState: MealAssistantState = {
    ...updatedState,
    currentMealItems: stateMealItems,
    currentMealText: stateMealItems.length ? buildMealTextFromItems(stateMealItems) : updatedState.currentMealText,
    confidenceScore: getConfidenceScore(stateMealItems),
  };
  nextState = syncPendingMealWithCurrentItems(nextState);
  const assistantReply = postProcessAssistantReply(args.assistantReply, nextState, args.message);
  const showMealItems = !(args.intent === 'recommendation_request' && nextState.saved);
  const mealItems = showMealItems ? stateMealItems : [];
  const totals = sumTotals(mealItems);

  return {
    intent: args.intent,
    assistant_reply: assistantReply,
    items: [],
    corrections: [],
    should_lookup_nutrition: false,
    should_save_meal: Boolean(args.shouldSaveMeal),
    should_ask_clarification: false,
    clarification_question: null,
    confidence: 'high',
    meal: {
      items: mealItems,
      totals,
      confidence_score: nextState.confidenceScore,
    },
    next_state: {
      ...nextState,
      lastAssistantReply: assistantReply,
    },
  } satisfies MealAssistantResponse;
}

function buildDirectFoodEstimateResponse(args: {
  input: MealAssistantRunInput;
  state: MealAssistantState;
  items: ParsedFoodItem[];
  intent?: MealAssistantModelOutput['intent'];
  followUpMessage?: string | null;
  context?: MealAssistantContext;
}) {
  const normalized = stripEmotionalPreface(args.input.message).toLowerCase();
  const mealTypeHint = extractMealTypeHint(args.input.message);
  const startsNewMealType = Boolean(mealTypeHint && mealTypeHint !== args.state.mealType && !continuationRegex.test(normalized));
  const intent = args.intent ?? (!startsNewMealType && shouldAppendToCurrentMeal(args.input.message, args.state) ? 'add_to_current_meal' : 'new_food_item');
  const currentMealItems = intent === 'add_to_current_meal'
    ? [...args.state.currentMealItems, ...args.items]
    : args.items;
  const baseNextState: MealAssistantState = {
    ...args.state,
    currentMealItems,
    userCorrections: intent === 'clarification_answer' ? [...args.state.userCorrections, args.input.message] : [...args.state.userCorrections],
    currentMealText: buildMealTextFromItems(currentMealItems),
    confidenceScore: getConfidenceScore(currentMealItems),
    pendingClarification: null,
    lastAssistantQuestion: null,
    saved: false,
    mealType: mealTypeHint ?? args.state.mealType,
    sourceReusableMealId: intent === 'new_food_item' ? null : args.state.sourceReusableMealId,
    editingMealId: intent === 'new_food_item' ? null : args.state.editingMealId,
  };
  const nextState = createReadyPendingMeal({
    state: baseNextState,
    items: currentMealItems,
    rawText: intent === 'add_to_current_meal'
      ? buildMealTextFromItems(currentMealItems)
      : args.input.message,
    mealType: mealTypeHint ?? args.state.mealType,
    replace: intent !== 'add_to_current_meal',
  });

  const pendingReviewReply = buildPendingReviewReply(nextState);
  const addedLead = intent === 'add_to_current_meal'
    ? `Added ${args.items.map((item) => formatParsedItemLabel(item)).join(' and ')}. `
    : '';
  const primaryReply = pendingReviewReply ? `${addedLead}${pendingReviewReply}` : buildReplyFromItems({
    intent,
    decisionReply: 'Got it.',
    resolvedItems: intent === 'add_to_current_meal' ? currentMealItems : args.items,
    message: args.input.message,
  });
  const followUpReply = args.followUpMessage && args.context ? buildInlineFollowUpReply(args.followUpMessage, nextState, args.context) : null;

  return buildDirectResponse({
    intent,
    assistantReply: [primaryReply, followUpReply].filter(Boolean).join(' '),
    nextState,
    message: args.input.message,
  });
}

async function buildDeterministicDialogueResponse(
  input: MealAssistantRunInput,
  context: MealAssistantContext,
  resolveItemNutrition: NutritionResolver,
  saveMeal: SaveExecutor,
) {
  const state = input.state;
  const normalized = stripEmotionalPreface(input.message).toLowerCase();

  const explicitFoodLogText = extractExplicitFoodLogCommand(input.message);
  if (explicitFoodLogText) {
    const directItems = detectKnownFoodEstimatesWithTrustedRestaurantFallback(explicitFoodLogText, state.mealType);
    if (directItems.length) {
      const hydratedItems = await hydrateKnownEstimatesWithProviders(directItems, state.mealType);
      return buildDirectFoodEstimateResponse({
        input: { ...input, message: explicitFoodLogText },
        state,
        items: hydratedItems,
        intent: 'new_food_item',
        context,
      });
    }
  }

  if (!state.currentMealItems.length && isRecentSavedMealUndoCommand(input.message)) {
    return buildDirectResponse({
      intent: 'delete_command',
      assistantReply: state.saved
        ? 'I will not log that as food. If that meal was just saved, I can remove the saved entry from the app.'
        : 'I will not log that as food. There is no active meal here to delete.',
      nextState: {
        ...state,
        currentMealItems: [],
        currentMealText: null,
        confidenceScore: 0.82,
        pendingClarification: null,
        lastAssistantQuestion: null,
      },
      message: input.message,
    });
  }

  if (/^(?:nvm|nevermind|never mind|undo(?: that| it)?|go back)$/i.test(normalized)) {
    return buildDirectResponse({
      intent: 'casual_message',
      assistantReply: state.currentMealItems.length
        ? (/^(?:undo|go back)/i.test(normalized)
          ? 'Nothing changed — this meal is still here. Tell me what to remove or change, or save it when it looks right.'
          : 'No problem — I still have this meal here. Tell me what to remove or change, or save it when it looks right.')
        : 'No problem. Send the meal whenever you’re ready.',
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        pendingClarification: null,
        lastAssistantQuestion: null,
      },
      message: input.message,
    });
  }

  if (state.pendingClarification && isClarificationMetaQuestion(input.message)) {
    return buildDirectResponse({
      intent: 'clarification_meta_question',
      assistantReply: buildClarificationMetaReply(state),
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        pendingClarification: state.pendingClarification,
        lastAssistantQuestion: state.lastAssistantQuestion ?? state.pendingClarification,
        saved: false,
      },
      message: input.message,
      activeQuestion: state.pendingClarification,
    });
  }

  const hasSaveAndMutation = hasAffirmativeSaveCommand(normalized)
    && /\b(?:add|remove|delete|make|change|update|actually|instead|no\s+\w+|without)\b/i.test(normalized);
  if (hasAffirmativeSaveCommand(normalized) && !hasSaveAndMutation) {
    if ((state.saved && state.currentMealItems.length) || state.pendingMeal?.status === 'saved') {
      const savedItems = state.currentMealItems.length ? state.currentMealItems : state.pendingMeal?.items ?? [];
      return buildDirectResponse({
        intent: 'save_meal',
        assistantReply: 'Already saved. Send the next meal whenever you’re ready.',
        nextState: {
          ...state,
          currentMealItems: [...savedItems],
          currentMealText: state.currentMealText ?? (savedItems.length ? buildMealTextFromItems(savedItems) : null),
          confidenceScore: state.confidenceScore ?? getConfidenceScore(savedItems),
          saved: true,
          pendingClarification: null,
          lastAssistantQuestion: null,
        },
        message: input.message,
      });
    }

    const activePendingMeal = getActivePendingMeal(state);
    const saveItems = activePendingMeal?.items.length ? activePendingMeal.items : state.currentMealItems;
    const saveAttempt = saveItems.length
      ? await attemptPendingMealSave({ state, items: saveItems, saveMeal })
      : null;
    const savedState = saveAttempt?.nextState ?? state;

    return buildDirectResponse({
      intent: 'save_meal',
      assistantReply: saveItems.length
        ? saveAttempt?.assistantReply ?? 'Saved. Ready for the next one?'
        : 'There is not a meal to save yet. Send the meal whenever you are ready.',
      nextState: {
        ...savedState,
        currentMealItems: [...savedState.currentMealItems],
        currentMealText: savedState.currentMealText ?? (savedState.currentMealItems.length ? buildMealTextFromItems(savedState.currentMealItems) : null),
        confidenceScore: savedState.confidenceScore ?? getConfidenceScore(savedState.currentMealItems),
        saved: Boolean(saveAttempt?.saved),
        pendingClarification: saveAttempt?.saved === false ? savedState.pendingClarification : null,
        lastAssistantQuestion: saveAttempt?.saved === false ? savedState.lastAssistantQuestion : null,
      },
      message: input.message,
      shouldSaveMeal: Boolean(saveAttempt?.saved),
    });
  }

  const reviewableFallbackResponse = buildReviewableFallbackFoodResponse(input, context);
  if (reviewableFallbackResponse) {
    return reviewableFallbackResponse;
  }

  if (repeatYesterdayRegex.test(input.message.trim().toLowerCase())) {
    const yesterdayMeal = findRepeatMealEntry(context, extractMealTypeHint(input.message) ?? null);
    if (yesterdayMeal) {
      const loadedItems = cloneParsedItems(yesterdayMeal.items);
      return buildDirectResponse({
        intent: 'repeat_meal',
        assistantReply: choosePhrase(input.message, [
          `Using yesterday's ${buildMemoryReference(yesterdayMeal)}.`,
          `I pulled in yesterday's ${buildMemoryReference(yesterdayMeal)}.`,
          `Got you, I've got yesterday's ${buildMemoryReference(yesterdayMeal)} loaded.`,
        ]),
        nextState: {
          ...state,
          currentMealItems: loadedItems,
          pendingClarification: null,
          lastAssistantQuestion: null,
          saved: false,
          mealType: yesterdayMeal.mealType,
          currentMealText: cleanMealReferenceText(yesterdayMeal.rawText) || cleanMealReferenceText(yesterdayMeal.title) || buildMealTextFromItems(loadedItems),
          confidenceScore: yesterdayMeal.confidenceScore ?? getConfidenceScore(loadedItems),
          sourceReusableMealId: null,
          editingMealId: null,
        },
        message: input.message,
      });
    }
  }

  const recommendationReply = buildRecommendationReply(input, context);
  if (recommendationReply) {
    return buildDirectResponse({
      intent: 'recommendation_request',
      assistantReply: recommendationReply,
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
      },
      message: input.message,
      activeQuestion: input.message,
    });
  }

  const adaptiveMealMutationReply = await buildAdaptiveMealMutationReply(input, resolveItemNutrition, saveMeal);
  if (adaptiveMealMutationReply) {
    return adaptiveMealMutationReply;
  }

  const descriptorReply = buildMealDescriptorReply(input, context);
  if (descriptorReply) {
    return descriptorReply;
  }

  const macroReply = buildCurrentMealMacroReply(input.message, state);
  if (macroReply) {
    return buildDirectResponse({
      intent: 'macro_question',
      assistantReply: macroReply,
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
      },
      message: input.message,
      activeQuestion: input.message,
    });
  }

  const comparisonReply = buildComparisonReply(input);
  if (comparisonReply) {
    return buildDirectResponse({
      intent: 'comparison_question',
      assistantReply: comparisonReply,
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
      },
      message: input.message,
      activeQuestion: input.message,
    });
  }

  if (weeklySummaryRegex.test(input.message.trim().toLowerCase())) {
    return buildDirectResponse({
      intent: 'nutrition_guidance',
      assistantReply: buildWeeklySummaryReply(context),
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        userCorrections: [...state.userCorrections],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
      },
      message: input.message,
      activeQuestion: input.message,
    });
  }

  const casualReply = buildCasualReply(input.message, state);
  if (casualReply) {
    const isRepairTurn = negativeFeedbackRegex.test(normalized) || confusionComplaintRegex.test(normalized);
    return buildDirectResponse({
      intent: isRepairTurn
        ? 'complaint_repair'
        : greetingRegex.test(input.message) && !state.currentMealItems.length ? 'greeting' : 'casual_message',
      assistantReply: casualReply,
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        userCorrections: [...state.userCorrections],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
      },
      message: input.message,
    });
  }

  if (repeatYesterdayRegex.test(input.message.trim().toLowerCase())) {
    const yesterdayMeal = findRepeatMealEntry(context, extractMealTypeHint(input.message) ?? null);
    if (yesterdayMeal) {
      const loadedItems = cloneParsedItems(yesterdayMeal.items);
      return buildDirectResponse({
        intent: 'repeat_meal',
        assistantReply: choosePhrase(input.message, [
          `Using yesterday's ${buildMemoryReference(yesterdayMeal)}.`,
          `I pulled in yesterday's ${buildMemoryReference(yesterdayMeal)}.`,
          `Got you, I've got yesterday's ${buildMemoryReference(yesterdayMeal)} loaded.`,
        ]),
        nextState: {
          ...state,
          currentMealItems: loadedItems,
          pendingClarification: null,
          lastAssistantQuestion: null,
          saved: false,
          mealType: yesterdayMeal.mealType,
          currentMealText: cleanMealReferenceText(yesterdayMeal.rawText) || cleanMealReferenceText(yesterdayMeal.title) || buildMealTextFromItems(loadedItems),
          confidenceScore: yesterdayMeal.confidenceScore ?? getConfidenceScore(loadedItems),
          sourceReusableMealId: null,
          editingMealId: null,
        },
        message: input.message,
      });
    }
  }

  const memoryMatch = findMatchingMemoryMeal(input, context);
  if (memoryMatch) {
    const loadedItems = cloneParsedItems(memoryMatch.candidate.items);
    const nextItems = memoryMatch.appendToCurrentMeal ? [...state.currentMealItems, ...loadedItems] : loadedItems;

    return buildDirectResponse({
      intent: memoryMatch.appendToCurrentMeal ? 'add_to_current_meal' : 'repeat_meal',
      assistantReply: buildMemoryLoadReply(memoryMatch, input.message),
      nextState: {
        ...state,
        currentMealItems: nextItems,
        pendingClarification: null,
        lastAssistantQuestion: null,
        saved: false,
        mealType: memoryMatch.appendToCurrentMeal ? state.mealType : memoryMatch.candidate.mealType,
        currentMealText: memoryMatch.appendToCurrentMeal
          ? buildMealTextFromItems(nextItems)
          : cleanMealReferenceText(memoryMatch.candidate.rawText) || cleanMealReferenceText(memoryMatch.candidate.title) || buildMealTextFromItems(nextItems),
        confidenceScore: memoryMatch.appendToCurrentMeal ? getConfidenceScore(nextItems) : memoryMatch.candidate.confidenceScore ?? getConfidenceScore(nextItems),
        sourceReusableMealId: memoryMatch.appendToCurrentMeal ? null : memoryMatch.candidate.source === 'favorite' ? memoryMatch.candidate.sourceReusableMealId ?? memoryMatch.candidate.id : null,
        editingMealId: null,
      },
      message: input.message,
    });
  }

  const nutritionReply = buildNutritionGuidanceReply(input, context);
  if (nutritionReply) {
    return buildDirectResponse({
      intent: 'nutrition_guidance',
      assistantReply: nutritionReply,
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        userCorrections: [...state.userCorrections],
        pendingClarification: state.pendingClarification ?? null,
        lastAssistantQuestion: state.lastAssistantQuestion ?? null,
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
      },
      message: input.message,
      activeQuestion: input.message,
    });
  }

  const recoveryReply = buildConversationRecoveryReply(input, context);
  if (recoveryReply) {
    return buildDirectResponse({
      intent: 'casual_message',
      assistantReply: recoveryReply,
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        userCorrections: [...state.userCorrections],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
      },
      message: input.message,
      activeQuestion: input.message,
    });
  }

  return null;
}

function buildInlineFollowUpReply(message: string, state: MealAssistantState, context: MealAssistantContext) {
  const replies: string[] = [];
  const seen = new Set<string>();
  const segments = message
    .split(/\r?\n+|(?<=[?.!])\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  const candidates = segments.length ? segments : [message];

  for (const candidate of candidates) {
    const macroReply = buildNutritionGuidanceReply({ message: candidate, state, context }, context);
    const key = macroReply ? normalizeText(macroReply) : null;
    if (macroReply && key && !seen.has(key)) {
      replies.push(macroReply);
      seen.add(key);
    }
  }

  if (dinnerSuggestionRegex.test(message) && !replies.some((reply) => /tonight|dinner|protein-forward|burrito bowl|grilled chicken/i.test(reply))) {
    const dinnerReply = buildNutritionGuidanceReply({ message: 'tonight idea', state, context }, context);
    const key = dinnerReply ? normalizeText(dinnerReply) : null;
    if (dinnerReply && key && !seen.has(key)) {
      replies.push(dinnerReply);
    }
  }

  return replies.length ? replies.join(' ') : null;
}

function getRemainingProtein(context: MealAssistantContext) {
  if (context.remainingProtein !== null && context.remainingProtein !== undefined) {
    return Math.max(0, Math.round(context.remainingProtein));
  }

  if (context.proteinGoal !== null && context.proteinGoal !== undefined && context.todayProtein !== null && context.todayProtein !== undefined) {
    return Math.max(0, Math.round(context.proteinGoal - context.todayProtein));
  }

  return null;
}

function getRemainingCalories(context: MealAssistantContext) {
  if (context.remainingCalories !== null && context.remainingCalories !== undefined) {
    return Math.round(context.remainingCalories);
  }

  if (context.dailyCalorieGoal !== null && context.dailyCalorieGoal !== undefined && context.todayCalories !== null && context.todayCalories !== undefined) {
    return Math.round(context.dailyCalorieGoal - context.todayCalories);
  }

  return null;
}

function getRemainingCarbs(context: MealAssistantContext) {
  if (context.remainingCarbs !== null && context.remainingCarbs !== undefined) {
    return Math.max(0, Math.round(context.remainingCarbs));
  }

  if (context.dailyCalorieGoal !== null && context.dailyCalorieGoal !== undefined && context.todayCarbs !== null && context.todayCarbs !== undefined) {
    const carbGoal = Math.round((context.dailyCalorieGoal * 0.4) / 4);
    return Math.max(0, Math.round(carbGoal - context.todayCarbs));
  }

  return null;
}

function getRemainingFat(context: MealAssistantContext) {
  if (context.remainingFat !== null && context.remainingFat !== undefined) {
    return Math.max(0, Math.round(context.remainingFat));
  }

  if (context.dailyCalorieGoal !== null && context.dailyCalorieGoal !== undefined && context.todayFat !== null && context.todayFat !== undefined) {
    const fatGoal = Math.round((context.dailyCalorieGoal * 0.3) / 9);
    return Math.max(0, Math.round(fatGoal - context.todayFat));
  }

  return null;
}

function findSuggestionCandidate(context: MealAssistantContext, options?: { mealType?: MealAssistantState['mealType'] | null; maxCalories?: number | null; minProtein?: number }) {
  const minProtein = options?.minProtein ?? 20;
  const entries = getMemoryEntries(context).filter((entry) => entry.items.length > 0);

  const ranked = entries
    .map((entry) => {
      const totals = sumTotals(entry.items);
      const mealTypeBonus = options?.mealType && entry.mealType === options.mealType ? 4 : 0;
      const proteinBonus = totals.protein >= minProtein ? totals.protein : -10;
      const caloriesPenalty = options?.maxCalories && totals.calories > options.maxCalories ? (totals.calories - options.maxCalories) / 40 : 0;
      const sourceBonus = entry.source === 'favorite' ? 3 : 0;
      const snackSignal = /shake|yogurt|cottage cheese|protein|bar|snack/i.test(buildMemoryReference(entry)) ? 2 : 0;

      return {
        entry,
        totals,
        score: mealTypeBonus + proteinBonus + sourceBonus + snackSignal - caloriesPenalty,
      };
    })
    .filter((entry) => entry.totals.protein >= minProtein)
    .sort((a, b) => b.score - a.score);

  return ranked[0] ?? null;
}

function buildNutritionGuidanceReply(input: MealAssistantRunInput, context: MealAssistantContext) {
  const normalized = input.message.trim().toLowerCase();
  const currentTotals = sumTotals(input.state.currentMealItems);
  const remainingProtein = getRemainingProtein(context);
  const remainingCarbs = getRemainingCarbs(context);
  const remainingFat = getRemainingFat(context);
  const remainingCalories = getRemainingCalories(context);

  if (weeklySummaryRegex.test(normalized)) {
    return buildWeeklySummaryReply(context);
  }

  if (currentMealProteinRegex.test(normalized) && input.state.currentMealItems.length) {
    return `This looks like about ${Math.round(currentTotals.protein)}g of protein.`;
  }

  if (enoughProteinRegex.test(normalized) && input.state.currentMealItems.length) {
    const currentProtein = Math.round(currentTotals.protein);
    const proteinGoal = context.proteinGoal ?? null;

    if (proteinGoal && proteinGoal > 0) {
      const mealShare = currentProtein / proteinGoal;
      if (mealShare >= 0.3) {
        return `Yeah, this is a strong protein hit — about ${currentProtein}g, roughly a third of your day.`;
      }
      if (mealShare >= 0.18) {
        return `It helps. This is about ${currentProtein}g protein, so you’ll probably want another protein-forward meal later.`;
      }
      return `Not really by itself — about ${currentProtein}g protein. I’d pair the rest of the day with something protein-forward.`;
    }

    return currentProtein >= 30
      ? `Yeah, about ${currentProtein}g protein is a solid meal-level hit.`
      : `It’s about ${currentProtein}g protein, so I’d add something protein-forward if that’s a priority.`;
  }

  if (currentMealCaloriesRegex.test(normalized) && input.state.currentMealItems.length) {
    return `This looks like about ${Math.round(currentTotals.calories)} calories.`;
  }

  if (proteinLeftRegex.test(normalized)) {
    return remainingProtein !== null ? `You've got about ${remainingProtein}g of protein left today.` : 'I can estimate that once your daily goal is set.';
  }

  if (followUpMacroRegex.test(normalized) || /\bcarbs? left\b/i.test(normalized)) {
    if (carbsQuestionRegex.test(normalized) && remainingCarbs !== null) {
      return `You've got about ${remainingCarbs}g of carbs left today.`;
    }

    if (fatQuestionRegex.test(normalized) && remainingFat !== null) {
      return `You've got about ${remainingFat}g of fat left today.`;
    }

    if (proteinQuestionRegex.test(normalized) && remainingProtein !== null) {
      return `You've got about ${remainingProtein}g of protein left today.`;
    }

    if (caloriesQuestionRegex.test(normalized) && remainingCalories !== null) {
      return remainingCalories >= 0
        ? `You've got about ${remainingCalories} calories left today.`
        : `You're about ${Math.abs(remainingCalories)} calories over right now.`;
    }

    return 'I can answer that once your daily goals are set.';
  }

  if (calorieLeftRegex.test(normalized)) {
    if (remainingCalories === null) {
      return 'I can estimate that once your daily calorie goal is set.';
    }

    return remainingCalories >= 0
      ? `You've got about ${remainingCalories} calories left today.`
      : `You're about ${Math.abs(remainingCalories)} calories over right now.`;
  }

  if (onTrackRegex.test(normalized)) {
    if (remainingCalories === null && remainingProtein === null) {
      return 'You look steady so far. I can be more specific once your daily goals are set.';
    }

    if (remainingCalories !== null && remainingCalories < 0) {
      return remainingProtein !== null && remainingProtein > 0
        ? `A little over on calories, and you still have about ${remainingProtein}g of protein left. Keep the rest lighter.`
        : 'A little over on calories, so keep the rest of the day lighter and simple.';
    }

    if (remainingProtein !== null && remainingProtein > 35) {
      return remainingCalories !== null
        ? `Pretty solid on calories. You're still about ${remainingProtein}g short on protein, with ${remainingCalories} calories left.`
        : `Pretty solid overall, but you're still about ${remainingProtein}g short on protein.`;
    }

    if (remainingCalories !== null && remainingProtein !== null) {
      return `Yeah, you're in a good spot. About ${remainingCalories} calories and ${remainingProtein}g protein left.`;
    }

    if (remainingCalories !== null) {
      return `Yeah, you're in a good spot. About ${remainingCalories} calories left.`;
    }

    return `Yeah, you're in a good spot. About ${remainingProtein ?? 0}g of protein left.`;
  }

  if (snackSuggestionRegex.test(normalized)) {
    const suggestion = findSuggestionCandidate(context, {
      mealType: 'snack',
      maxCalories: remainingCalories !== null && remainingCalories > 0 ? Math.min(remainingCalories, 350) : 350,
      minProtein: remainingProtein !== null && remainingProtein > 20 ? 20 : 12,
    });

    if (suggestion) {
      return `A good easy one would be ${suggestion.entry.source === 'favorite' ? 'your usual ' : ''}${buildMemoryReference(suggestion.entry)}.`;
    }

    return remainingProtein !== null && remainingProtein > 20
      ? 'A shake, Greek yogurt, cottage cheese, or turkey jerky would be an easy high-protein snack.'
      : 'Greek yogurt, cottage cheese, fruit with yogurt, or a shake would all work well.';
  }

  if (snackRoomRegex.test(normalized)) {
    if (remainingCalories === null && remainingProtein === null) {
      return 'Probably, but I can answer that more cleanly once your daily goals are set.';
    }

    if (remainingCalories !== null && remainingCalories <= 120) {
      return remainingProtein !== null && remainingProtein > 0
        ? `You still could, but keep it light. You’ve got about ${remainingCalories} calories and ${remainingProtein}g protein left.`
        : `You still could, but keep it pretty light. You’ve got about ${remainingCalories} calories left.`;
    }

    if (remainingCalories !== null && remainingCalories > 120) {
      return remainingProtein !== null && remainingProtein > 20
        ? `Yeah, you’ve got room. About ${remainingCalories} calories left, and you could still use roughly ${remainingProtein}g protein.`
        : `Yeah, you’ve got room for one. About ${remainingCalories} calories left today.`;
    }

    return remainingProtein !== null && remainingProtein > 20
      ? `Yeah, you’ve still got room, especially if you make it protein-forward. You’re about ${remainingProtein}g short on protein.`
      : 'Yeah, you should still have room for a snack.';
  }

  if (dinnerSuggestionRegex.test(normalized)) {
    const suggestion = findSuggestionCandidate(context, {
      mealType: 'dinner',
      maxCalories: remainingCalories !== null && remainingCalories > 0 ? Math.min(remainingCalories, 900) : 900,
      minProtein: remainingProtein !== null && remainingProtein > 30 ? 25 : 18,
    });

    if (suggestion) {
      return `Tonight, ${suggestion.entry.source === 'favorite' ? 'your usual ' : ''}${buildMemoryReference(suggestion.entry)} would fit pretty well.`;
    }

    if (remainingCalories !== null && remainingCalories < 350) {
      return 'Keep dinner light and protein-forward, like grilled chicken, Greek yogurt, or cottage cheese.';
    }

    return remainingProtein !== null && remainingProtein > 30
      ? 'Go protein-forward tonight. Grilled chicken, a burrito bowl with extra protein, or rice with lean meat would make sense.'
      : 'Keep dinner simple and steady, something like chicken, rice, potatoes, or a burrito bowl.';
  }

  return null;
}

async function defaultResolveItemNutrition({ item, mealType }: { item: MealAssistantItem; mealType: MealAssistantState['mealType'] }) {
  const candyResponse = buildCandyMealResponse(item, mealType);
  if (candyResponse) {
    return candyResponse;
  }

  const query = buildItemLookupText(item);
  const resolved = await resolveNutritionEstimate({ text: query, mealType });

  if (resolved?.items.length) {
    return resolved;
  }

  const parsed = await parseMealText(query, mealType);
  if (!parsed.needs_clarification && parsed.items.length) {
    return parsed;
  }

  return getMockParsedMeal(query, mealType);
}

async function attemptPendingMealSave(args: {
  state: MealAssistantState;
  items: ParsedFoodItem[];
  saveMeal: SaveExecutor;
}): Promise<{ saved: boolean; nextState: MealAssistantState; assistantReply: string }> {
  const stateForSave: MealAssistantState = {
    ...args.state,
    currentMealItems: args.items,
    currentMealText: args.state.currentMealText ?? buildMealTextFromItems(args.items),
  };

  try {
    await args.saveMeal({ state: stateForSave, items: args.items });
    return {
      saved: true,
      nextState: markPendingMealSaved(stateForSave),
      assistantReply: 'Saved. Ready for the next one?',
    };
  } catch {
    return {
      saved: false,
      nextState: markPendingMealSaveFailed(stateForSave),
      assistantReply: 'I could not save that meal yet. The review is still here, so you can try saving again.',
    };
  }
}

async function defaultSaveMeal({ state, items }: { state: MealAssistantState; items: ParsedFoodItem[] }) {
  if (state.editingMealId) {
    await updateSavedMeal(state.editingMealId, {
      meal_type: state.mealType,
      confidence_score: getConfidenceScore(items),
      raw_text: state.currentMealText,
      source_reusable_meal_id: state.sourceReusableMealId ?? null,
      items,
    });
    return;
  }

  await saveConfirmedMeal({
    meal_type: state.mealType,
    confidence_score: getConfidenceScore(items),
    raw_text: state.currentMealText,
    source_reusable_meal_id: state.sourceReusableMealId ?? null,
    pending_meal_id: state.pendingMeal?.id ?? null,
    pending_meal_version: state.pendingMeal?.version ?? null,
    idempotency_key: state.pendingMeal?.idempotencyKey ?? (state.pendingMeal ? `${state.pendingMeal.id}:v${state.pendingMeal.version}` : null),
    items,
  });
}

function buildFallbackReply(input: string, state: MealAssistantState, context?: MealAssistantContext) {
  const recoveryReply = context ? buildConversationRecoveryReply({ message: input, state, context }, context) : null;
  if (recoveryReply) {
    return recoveryReply;
  }

  if (context && weeklySummaryRegex.test(stripEmotionalPreface(input).toLowerCase())) {
    return buildWeeklySummaryReply(context);
  }

  const casualReply = buildCasualReply(input, state);
  if (casualReply) {
    return casualReply;
  }

  return state.currentMealItems.length
    ? buildContextualContinuityReply(state)
    : choosePhrase(input, ['Tell me what you ate.', 'What did you have?', 'Send the meal whenever you’re ready.']);
}

function extractFallbackItems(input: string, state: MealAssistantState): MealAssistantItem[] {
  const normalized = stripConversationalLeadIn(stripEmotionalPreface(input).toLowerCase());

  const noRemoveMatch = normalized.match(/^no\s+remove\s+(?:the\s+)?(.+)$/i);
  if (removeRegex.test(normalized) || noRemoveMatch) {
    const removeMatch = normalized.match(removeRegex);
    const target = noRemoveMatch?.[1] ?? removeMatch?.[1] ?? removeMatch?.[2] ?? '';
    return [
      {
        name: target,
        brand: null,
        quantity: 1,
        unit: null,
        modifiers: [],
        action: 'remove',
      },
    ];
  }

  const compact = normalized.replace(/[^a-z0-9]+/g, '');
  const restaurantCue = detectRestaurantCue(normalized);
  const brand = /\bquaker\b/.test(normalized)
    ? 'Quaker'
    : /\bdaisy\b/.test(normalized)
      ? 'Daisy'
      : /\barby'?s?\b|\barbys\b|\barby\b/.test(normalized)
        ? "Arby's"
        : /\bmcdouble\b|\bmcdonald|\bmc donald|\bmcd\b/.test(normalized) || compact.includes('mcdonalds')
        ? "McDonald's"
        : /\btaco bell\b/.test(normalized) || compact.includes('tacobell')
          ? 'Taco Bell'
          : /\bchick-fil-a\b|\bchick fil a\b|\bchic fil a\b/.test(normalized) || compact.includes('chicfila')
            ? 'Chick-fil-A'
            : /\bchipotle\b/.test(normalized)
              ? 'Chipotle'
              : /\bstarbucks\b/.test(normalized)
                ? 'Starbucks'
                : /\bsubway\b/.test(normalized)
                  ? 'Subway'
                  : /\bwhite castle\b/.test(normalized) || compact.includes('whitecastle')
                    ? 'White Castle'
                    : /\bpanda express\b/.test(normalized)
                      ? 'Panda Express'
                      : /\bpanera\b/.test(normalized)
                        ? 'Panera'
                        : /\bburger king\b/.test(normalized) || compact.includes('burgerking')
                          ? 'Burger King'
                          : /\bfairlife\b/.test(normalized)
                            ? 'Fairlife'
                            : restaurantCue?.brand ?? null;

  const leadingServing = parseLeadingServingFood(input);
  const quantityMatch = normalized.match(quantityOnlyRegex) ?? normalized.match(directQuantityRegex);
  const quantity = leadingServing?.quantity ?? (quantityMatch ? parseCount(quantityMatch[1] ?? quantityMatch[0]) : 1);

  const knownListItems = buildKnownFallbackListItems(normalized, state);
  if (!leadingServing && knownListItems.length > 1) {
    return knownListItems;
  }

  const stripped = leadingServing?.foodText
    ?? normalized
      .replace(/^(?:actually|make that|update that to|it was|that was|no,?|i meant|instead|and|also|plus|with)\s+/i, '')
      .replace(/^(?:i\s+had|i\s+ate|had|ate)\s+/i, '')
      .replace(/^(?:\d+(?:\.\d+)?|a half|half|three quarters?|a quarter|quarter|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+/i, '')
      .trim();

  const namedFallback = state.currentMealItems.at(-1)?.food_name ?? 'meal item';

  if (!stripped && state.currentMealItems.length) {
    return [
      {
        name: namedFallback,
        brand: null,
        quantity,
        unit: state.currentMealItems.at(-1)?.unit ?? null,
        modifiers: [],
        action: 'update',
      },
    ];
  }

  const name = stripped
    .replace(/\blow fat\b/g, 'cottage cheese')
    .replace(/\bwhite cheddar rice cakes?\b/g, 'rice cakes')
    .replace(/\s+/g, ' ')
    .trim() || namedFallback;

  if (looksLikeRawConversationalFoodText(name, input) && !hasReviewableFoodSignal(name)) {
    return [];
  }

  const modifiers = [
    /white cheddar/.test(normalized) ? 'white cheddar' : null,
    /low fat/.test(normalized) ? 'low fat' : null,
    /double chicken/.test(normalized) ? 'double chicken' : null,
    /white rice/.test(normalized) ? 'white rice' : null,
  ].filter((value): value is string => Boolean(value));

  return [
    {
      name,
      brand,
      quantity,
      unit: leadingServing?.unit ?? (/eggs?/.test(normalized) ? 'egg' : /rice cakes?/.test(normalized) ? 'cake' : /shake/.test(normalized) ? 'bottle' : null),
      modifiers,
      action: state.pendingClarification || /^(?:no|actually|i meant|instead)\b/i.test(normalized) ? 'replace' : 'add',
    },
  ];
}

function buildKnownFallbackListItems(normalized: string, state: MealAssistantState): MealAssistantItem[] {
  const specs: Array<{ pattern: RegExp; name: string; unit: string | null; quantity?: number }> = [
    { pattern: /\bchicken\b/, name: 'chicken', unit: 'serving' },
    { pattern: /\brice\b/, name: 'rice', unit: 'cup' },
    { pattern: /\bavocado\b/, name: 'avocado', unit: 'avocado', quantity: /\bhalf\s+(?:an?\s+)?avocado\b/.test(normalized) ? 0.5 : 1 },
    { pattern: /\bsalsa\b/, name: 'salsa', unit: 'serving' },
    { pattern: /\bsalmon\b/, name: 'salmon', unit: 'serving' },
    { pattern: /\bpotatoes?\b/, name: 'potatoes', unit: 'cup', quantity: readCountBeforeFromText(normalized, 'cups?\\s+(?:of\\s+)?potatoes?', /\b2\s+cups?\b.*\bpotatoes?\b|\bpotatoes?\b.*\b2\s+cups?\b/.test(normalized) ? 2 : 1) },
    { pattern: /\bcoke zero\b/, name: 'Coke Zero', unit: 'can' },
    { pattern: /\beggs?\b/, name: 'eggs', unit: 'egg', quantity: readCountBeforeFromText(normalized, 'eggs?', 2) },
    { pattern: /\btoast\b/, name: 'toast', unit: 'slice' },
  ];

  return specs
    .filter((spec) => spec.pattern.test(normalized))
    .map((spec) => ({
      name: spec.name,
      brand: null,
      quantity: spec.quantity ?? 1,
      unit: spec.unit,
      modifiers: [],
      action: state.pendingClarification || /^(?:no|actually|i meant|instead)\b/i.test(normalized)
        ? 'replace'
        : (/\b(?:make|update|change)\b/i.test(normalized) && state.currentMealItems.some((current) => normalizeText(current.food_name).includes(normalizeText(spec.name))))
          ? 'update'
          : 'add',
    }));
}

function readCountBeforeFromText(text: string, pattern: string, fallback: number) {
  const match = text.match(new RegExp(`\\b(\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|a|an)\\s+${pattern}\\b`, 'i'));
  return match ? parseCount(match[1] ?? String(fallback)) : fallback;
}

function classifyFallback({ message, state }: MealAssistantRunInput): MealAssistantModelOutput {
  const normalized = stripEmotionalPreface(message).toLowerCase();
  const hasActiveMeal = state.currentMealItems.length > 0;

  if (greetingRegex.test(normalized) && !hasActiveMeal) {
    return {
      intent: 'greeting',
      assistant_reply: choosePhrase(normalized, ['Hey, what are we logging?', 'Hey, what did you eat?', 'I’m here. What did you have?']),
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (reviewRegex.test(normalized) && hasActiveMeal) {
    return {
      intent: 'meal_review',
      assistant_reply: 'Here’s what I have so far.',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (!hasActiveMeal && isRecentSavedMealUndoCommand(message)) {
    return {
      intent: 'delete_command',
      assistant_reply: state.saved
        ? 'I will not log that as food. If that meal was just saved, I can remove the saved entry from the app.'
        : 'I will not log that as food. There is no active meal here to delete.',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (editRegex.test(normalized) && hasActiveMeal) {
    return {
      intent: 'edit_command',
      assistant_reply: 'Sure, tell me what you want to change.',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (negatedSaveRegex.test(normalized) || isSaveReviewQuestion(message)) {
    const negatedLog = /\b(?:do not|don't|dont|never|not)\s+log\b/i.test(normalized);
    return {
      intent: 'meal_review',
      assistant_reply: negatedSaveRegex.test(normalized)
        ? (negatedLog
          ? 'Got it — I won’t log it. The current review stays unchanged.'
          : 'No problem — I won’t save it. The review stays here if you want to adjust it.')
        : 'You can save it after the serving sizes look right. Want me to adjust anything first?',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (hasAffirmativeSaveCommand(normalized)) {
    return {
      intent: 'save_meal',
      assistant_reply: 'Saved.',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: true,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (startNewRegex.test(normalized)) {
    return {
      intent: 'start_new_meal',
      assistant_reply: 'Okay, starting fresh.',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (comparisonRegex.test(normalized)) {
    return {
      intent: 'comparison_question',
      assistant_reply: 'Let me compare that.',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'medium',
    };
  }

  if (followUpMacroRegex.test(normalized) || (hasActiveMeal && /\b(?:carbs?|fat|protein|calories?)\b/i.test(normalized) && /\?/.test(normalized))) {
    return {
      intent: 'macro_question',
      assistant_reply: 'Let me check that.',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (isRecommendationRequestMessage(normalized) || isRecommendationFollowUpMessage(message, state)) {
    return {
      intent: 'recommendation_request',
      assistant_reply: 'I’ve got a few ideas.',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'medium',
    };
  }

  if (clarificationMetaQuestionRegex.test(normalized.trim().replace(/[.!]+$/g, ''))) {
    return {
      intent: 'clarification_meta_question',
      assistant_reply: 'Useful details are amount, serving size, brand or restaurant, and ingredients. For example: “1 cup cottage cheese” or “Quest BBQ protein chips.”',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if ((casualRegex.test(normalized) && !hasFoodAfterConversationalLeadIn(message)) || (offTopicRegex.test(normalized) && !hasStrongFoodSignal(normalized))) {
    return {
      intent: 'casual_message',
      assistant_reply: buildFallbackReply(message, state),
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'medium',
    };
  }


  if (negativeFeedbackRegex.test(normalized) || confusionComplaintRegex.test(normalized)) {
    return {
      intent: 'complaint_repair',
      action: 'complaint_repair',
      assistant_reply: buildFallbackReply(message, state),
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (removeRegex.test(normalized)) {
    return {
      intent: 'remove_item',
      assistant_reply: 'Got it.',
      items: extractFallbackItems(message, state),
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (state.pendingClarification && /^(?:no|actually|i meant|instead|they were|it was)\b/i.test(normalized)) {
    const items = extractFallbackItems(message, state);
    return {
      intent: 'correction',
      assistant_reply: 'Got it.',
      items,
      corrections: [{ target: state.pendingClarification, change: message }],
      should_lookup_nutrition: true,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (state.pendingClarification) {
    return {
      intent: 'clarification_answer',
      assistant_reply: 'Got it.',
      items: extractFallbackItems(message, state),
      corrections: [],
      should_lookup_nutrition: true,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (/\b(?:from|at)\s+chipotle\b/i.test(normalized) && hasActiveMeal) {
    const currentItem = state.currentMealItems.at(-1);
    const currentName = currentItem?.food_name ?? 'meal item';
    return {
      intent: 'correction',
      assistant_reply: 'That helps — I’ll treat it like Chipotle.',
      items: [{
        name: currentName,
        brand: 'Chipotle',
        quantity: currentItem?.quantity ?? 1,
        unit: currentItem?.unit ?? null,
        modifiers: ['restaurant source'],
        action: 'replace',
      }],
      corrections: [{ target: currentName, change: message }],
      should_lookup_nutrition: true,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (quantityOnlyRegex.test(normalized) && hasActiveMeal) {
    const items = extractFallbackItems(message, state);
    return {
      intent: 'quantity_change',
      assistant_reply: 'Updated.',
      items,
      corrections: [{ target: state.currentMealItems.at(-1)?.food_name ?? 'current item', change: message }],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (/^(?:no|actually|i meant|instead|not )\b/i.test(normalized)) {
    const items = extractFallbackItems(message, state);
    return {
      intent: 'correction',
      assistant_reply: 'Got it.',
      items,
      corrections: [{ target: state.currentMealItems.at(-1)?.food_name ?? 'current item', change: message }],
      should_lookup_nutrition: true,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'high',
    };
  }

  if (!hasReviewableFoodSignal(normalized) && !quantityOnlyRegex.test(normalized) && !directQuantityRegex.test(normalized)) {
    return {
      intent: 'unknown',
      assistant_reply: hasActiveMeal
        ? choosePhrase(`${normalized}:${state.currentMealItems.length}`, [
          buildContextualContinuityReply(state),
          'I couldn’t read that as a food change, so I kept the current meal as-is.',
          'No food change made — your current review is still intact.',
        ])
        : 'I need a recognizable food and amount before I can estimate that.',
      items: [],
      corrections: [],
      should_lookup_nutrition: false,
      should_save_meal: false,
      should_ask_clarification: false,
      clarification_question: null,
      confidence: 'low',
    };
  }

  const items = extractFallbackItems(message, state);

  return {
    intent: hasActiveMeal && continuationRegex.test(normalized) ? 'add_to_current_meal' : 'new_food_item',
    assistant_reply: 'Got it.',
    items,
    corrections: [],
    should_lookup_nutrition: true,
    should_save_meal: false,
    should_ask_clarification: false,
    clarification_question: null,
    confidence: 'medium',
  };
}

async function classifyWithModel(input: MealAssistantRunInput): Promise<MealAssistantModelOutput> {
  const intelligence = await runOpenAIFoodIntelligence(input);
  if (intelligence.ok) {
    return mapFoodIntelligenceToMealAssistantDecision(intelligence.value, input.message);
  }

  return classifyFallback(input);
}

async function generateAssistantReplyWithModel(args: Parameters<AssistantReplyGenerator>[0]) {
  if (!process.env.OPENAI_API_KEY || typeof window !== 'undefined') {
    return null;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const totals = sumTotals(args.mealItems);

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.35,
      messages: [
        {
          role: 'system',
          content: [
            'You are Calorie Compass, a calm premium food logging assistant.',
            'Rewrite the draft into one concise, natural user-facing reply.',
            'Use the final app action exactly as truth. Do not invent foods, calories, or edits.',
            'Do not log anything new for recommendation, nutrition, clarification, rejection, casual, or unknown intents.',
            'For quantity-change actions, keep the reply focused on the correction itself. Do not mention source labels, USDA, restaurant databases, or that a lookup happened.',
            'Recommendation and proactive replies should sound calm, personalized, and low-pressure, never naggy or influencer-style.',
            'Never say only "Got it" or "Okay". Never mention internal JSON, lookups, routing, or guardrails.',
            'Keep it mobile-friendly: usually one sentence, two short sentences max.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            latest_user_message: args.input.message,
            intent: args.decision.intent,
            assistant_reply_goal: args.decision.assistant_reply_goal ?? null,
            draft_reply: args.draftReply,
            action: {
              saved: args.saved,
              clarification_question: args.clarificationQuestion,
              removed_targets: args.removedTargets,
              should_lookup_nutrition: args.decision.should_lookup_nutrition,
              should_mutate_pending_meal: args.decision.should_mutate_pending_meal ?? null,
            },
            final_meal_items: args.mealItems.map((item) => ({
              food_name: item.food_name,
              quantity: item.quantity,
              unit: item.unit,
              calories: Math.round(item.calories),
              protein: Math.round(item.protein),
              source_label: getSourceLabel(item),
            })),
            meal_totals: {
              calories: Math.round(totals.calories),
              protein: Math.round(totals.protein),
              carbs: Math.round(totals.carbs),
              fat: Math.round(totals.fat),
            },
            daily_context: {
              remaining_calories: getRemainingCalories(args.context),
              remaining_protein: getRemainingProtein(args.context),
              today_meal_count: args.context.todayMealCount ?? null,
              nutrition_preferences: args.context.nutritionPreferences ?? null,
            },
            conversation_state: {
              last_assistant_reply: args.input.state.lastAssistantReply ?? null,
              pending_clarification: args.input.state.pendingClarification ?? null,
              previous_intent: args.input.state.previousIntent ?? null,
              active_topic: args.input.state.activeTopic ?? null,
            },
          }),
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim();
    return text ? sanitizeAssistantText(text) : null;
  } catch {
    return null;
  }
}

function applyRemovedItems(currentItems: ParsedFoodItem[], itemsToRemove: MealAssistantItem[]) {
  const removedTargets: string[] = [];
  const nextItems = [...currentItems];

  for (const removal of itemsToRemove) {
    const target = removal.brand ? `${removal.brand} ${removal.name}` : removal.name;
    const index = findItemIndex(nextItems, target);
    if (index >= 0) {
      removedTargets.push(nextItems[index].food_name);
      nextItems.splice(index, 1);
    }
  }

  return { nextItems, removedTargets };
}

function titleCaseFoodLabel(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.length <= 3 && part === part.toUpperCase() ? part : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function inferFallbackNutrition(normalized: string) {
  if (/\bdiet\s+coke\b|\bcoke\s+zero\b|\bzero\s+sugar\b/.test(normalized)) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 45 };
  }
  if (/\byogurt\b/.test(normalized)) {
    return { calories: 150, protein: 12, carbs: 18, fat: 3, fiber: 0, sugar: 12, sodium: 90 };
  }
  if (/\bsmoothie\b/.test(normalized)) {
    return { calories: 300, protein: 12, carbs: 48, fat: 6, fiber: 5, sugar: 32, sodium: 120 };
  }
  if (/\bbacon\b/.test(normalized)) {
    return { calories: 90, protein: 6, carbs: 0, fat: 7, fiber: 0, sugar: 0, sodium: 340 };
  }
  if (/\bsalad\b/.test(normalized)) {
    const dressingCalories = /\branch|dressing\b/.test(normalized) ? 140 : 0;
    return { calories: 320 + dressingCalories, protein: 18, carbs: 18, fat: 18 + (dressingCalories ? 14 : 0), fiber: 5, sugar: 6, sodium: 620 };
  }
  if (/\bsub\b|\bfootlong\b|\b6\s*inch\b/.test(normalized)) {
    const isFootlong = /\bfootlong\b/.test(normalized);
    return { calories: isFootlong ? 800 : 430, protein: isFootlong ? 36 : 19, carbs: isFootlong ? 92 : 48, fat: isFootlong ? 32 : 16, fiber: isFootlong ? 8 : 4, sugar: isFootlong ? 12 : 6, sodium: isFootlong ? 1700 : 900 };
  }
  if (/\bwings?\b/.test(normalized)) {
    return { calories: 650, protein: 42, carbs: 18, fat: 44, fiber: 1, sugar: 2, sodium: 1450 };
  }
  if (/\bbreadsticks?\b/.test(normalized)) {
    return { calories: 300, protein: 8, carbs: 48, fat: 8, fiber: 2, sugar: 4, sodium: 680 };
  }
  if (/\bspaghetti\b|\bpasta\b|\bmarinara\b/.test(normalized)) {
    return { calories: 460, protein: 14, carbs: 78, fat: 10, fiber: 5, sugar: 10, sodium: 720 };
  }
  if (/\bburrito\b|\bwrap\b/.test(normalized)) {
    return { calories: 540, protein: 28, carbs: 58, fat: 22, fiber: 6, sugar: 5, sodium: 1050 };
  }
  if (/\bburger\b|\bwhopper\b/.test(normalized)) {
    return { calories: 560, protein: 28, carbs: 42, fat: 30, fiber: 3, sugar: 8, sodium: 950 };
  }
  if (/\bbreakfast sandwich\b/.test(normalized)) {
    return { calories: 430, protein: 22, carbs: 36, fat: 22, fiber: 2, sugar: 5, sodium: 900 };
  }
  if (/\bsandwich\b/.test(normalized)) {
    return { calories: 460, protein: 26, carbs: 42, fat: 18, fiber: 3, sugar: 6, sodium: 850 };
  }
  if (/\bfries?\b|\bfry\b/.test(normalized)) {
    return { calories: 320, protein: 4, carbs: 43, fat: 15, fiber: 5, sugar: 0, sodium: 470 };
  }
  if (/\bpizza\b/.test(normalized)) {
    return { calories: 285, protein: 12, carbs: 36, fat: 10, fiber: 2, sugar: 3, sodium: 640 };
  }
  if (/\bchips?\b/.test(normalized)) {
    return { calories: 160, protein: 2, carbs: 15, fat: 10, fiber: 1, sugar: 1, sodium: 170 };
  }
  if (/\bbowl\b/.test(normalized)) {
    return { calories: 620, protein: 32, carbs: 64, fat: 22, fiber: 8, sugar: 6, sodium: 980 };
  }
  return { calories: 520, protein: 28, carbs: 45, fat: 20, fiber: 4, sugar: 6, sodium: 780 };
}

function quantityFactorForFallback(item: MealAssistantItem | undefined) {
  const quantity = item?.quantity && item.quantity > 0 ? item.quantity : 1;
  const unit = item?.unit?.toLowerCase() ?? '';
  if (/^(?:g|gram|grams)$/.test(unit)) {
    return Math.max(0.1, quantity / 100);
  }
  if (/^(?:oz|ounce|ounces)$/.test(unit)) {
    return Math.max(0.1, quantity / 4);
  }
  if (/^(?:cup|cups|serving|servings|count|counts|sandwich|burger|sub|wrap|bowl|order|slice|slices)$/.test(unit)) {
    return Math.min(quantity, 8);
  }
  return quantity > 1 && quantity <= 8 ? quantity : 1;
}

function scaleFallbackNutrition(nutrition: ReturnType<typeof inferFallbackNutrition>, factor: number) {
  return {
    calories: Math.round(nutrition.calories * factor),
    protein: Math.round(nutrition.protein * factor * 10) / 10,
    carbs: Math.round(nutrition.carbs * factor * 10) / 10,
    fat: Math.round(nutrition.fat * factor * 10) / 10,
    fiber: Math.round(nutrition.fiber * factor * 10) / 10,
    sugar: Math.round(nutrition.sugar * factor * 10) / 10,
    sodium: Math.round(nutrition.sodium * factor),
  };
}

function buildReviewableFallbackEstimate(message: string, items: MealAssistantItem[]): ParsedFoodItem | null {
  const normalized = normalizeFoodText(message);
  if (!hasReviewableFoodSignal(normalized) || correctionCueRegex.test(normalized) || removeRegex.test(normalized)) {
    return null;
  }

  const primaryItem = items[0];
  const rawLabel = cleanOriginalFoodName(message)
    .replace(/^(?:log|add|track)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const itemLabel = primaryItem ? buildHumanFoodNameFromAssistantItem(primaryItem) : rawLabel;
  const displayName = titleCaseFoodLabel(rawLabel || itemLabel || 'Food estimate');
  const quantity = primaryItem?.quantity && primaryItem.quantity > 0 ? primaryItem.quantity : 1;
  const unit = primaryItem?.unit?.trim() || (/restaurant|wendy|mcdonald|subway|jimmy|wingstop|olive garden|qdoba|papa john/i.test(normalized) ? 'serving' : 'serving');
  const nutrition = scaleFallbackNutrition(inferFallbackNutrition(normalized), quantityFactorForFallback(primaryItem));

  return {
    food_name: displayName,
    quantity,
    unit,
    ...nutrition,
    notes: 'Reviewable fallback estimate because no source-backed nutrition match was available. Confirm restaurant, serving, and modifiers before saving.',
    is_trusted: false,
    source_type: 'AI_ESTIMATE',
    source_name: 'AI estimate',
    confidence_label: 'Estimated',
    match_type: 'ai_estimate',
    matched_query: itemLabel || rawLabel || message,
    original_user_text: message,
    provider_used: null,
    used_ai_fallback: true,
    catalog_food_id: null,
    confidence: 0.55,
  };
}

function shouldCreateReviewableFallbackForMessage(message: string, state: MealAssistantState) {
  const normalized = normalizeFoodText(stripEmotionalPreface(message));
  if (!normalized || !hasReviewableFoodSignal(normalized)) {
    return false;
  }

  if (
    state.pendingClarification ||
    isQuestionLikeText(normalized) ||
    hasAffirmativeSaveCommand(normalized) ||
    isSaveReviewQuestion(normalized) ||
    removeRegex.test(normalized) ||
    isNonFoodDialogueMessage(message)
  ) {
    return false;
  }

  return !state.currentMealItems.length || state.saved || continuationRegex.test(normalized);
}

function buildReviewableFallbackFoodResponse(
  input: MealAssistantRunInput,
  context: MealAssistantContext,
  intent?: MealAssistantModelOutput['intent'],
) {
  if (!shouldCreateReviewableFallbackForMessage(input.message, input.state)) {
    return null;
  }

  const normalizedMessage = normalizeFoodText(input.message);
  if (
    shouldAskPizzaPortion(input.message, extractFallbackItems(input.message, input.state)) ||
    /\b(?:snickers|skittles|m&ms?|mms?|candy|candies|candy bars?)\b/i.test(normalizedMessage) ||
    detectKnownFoodEstimatesWithTrustedRestaurantFallback(input.message, input.state.mealType).length ||
    (
      messageHasRestaurantCue(normalizedMessage) &&
      normalizedMessage !== normalizeText(input.message) &&
      detectKnownFoodEstimatesWithTrustedRestaurantFallback(normalizedMessage, input.state.mealType).length
    )
  ) {
    return null;
  }

  const fallbackItems = extractFallbackItems(input.message, input.state);
  const fallbackEstimate = buildReviewableFallbackEstimate(input.message, fallbackItems);
  if (!fallbackEstimate) {
    return null;
  }

  return buildDirectFoodEstimateResponse({
    input,
    state: input.state,
    items: [fallbackEstimate],
    intent: intent ?? (input.state.currentMealItems.length && !input.state.saved ? 'add_to_current_meal' : 'new_food_item'),
    context,
  });
}

type ResolveAssistantItemsResult = {
  items: ParsedFoodItem[];
  clarificationQuestion: string | null;
};

async function resolveAssistantItemsWithClarification(
  items: MealAssistantItem[],
  mealType: MealAssistantState['mealType'],
  resolveItemNutrition: NutritionResolver,
  message = '',
): Promise<ResolveAssistantItemsResult> {
  const resolved: ParsedFoodItem[] = [];
  const safeItems = isNonFoodDialogueMessage(message)
    ? []
    : items.filter((item) => !isUnsafeLookupItem(item, message));

  const trustedMessageResponse = messageNeedsForcedTrustedCatalogMatch(message)
    ? getTrustedCatalogEstimate(message, mealType)
    : null;
  if (trustedMessageResponse?.items.length && hasHighPriorityBrandedCatalogMatch(trustedMessageResponse.items)) {
    return {
      items: hardenResolvedItems({
        message,
        resolvedItems: trustedMessageResponse.items,
      }),
      clarificationQuestion: null,
    };
  }

  for (const item of safeItems) {
    const lookupText = [item.brand ?? '', ...item.modifiers, item.name].filter(Boolean).join(' ');
    const trustedResponse = (messageNeedsForcedTrustedCatalogMatch(lookupText) || messageNeedsForcedTrustedCatalogMatch(message))
      ? getTrustedCatalogEstimate(lookupText || message, mealType)
      : null;
    const response = trustedResponse?.items.length ? trustedResponse : await resolveItemNutrition({ item, mealType });
    if (response?.needs_clarification) {
      return {
        items: [],
        clarificationQuestion: response.clarifying_question ?? 'Which exact item and serving size should I use?',
      };
    }

    if (response?.items.length) {
      resolved.push(...response.items.map((resolvedItem) => repairResolvedNutritionItem(item, resolvedItem)));
    }
  }

  return {
    items: hardenResolvedItems({
      message,
      resolvedItems: resolved.length ? resolved : [
        buildReviewableFallbackEstimate(message, safeItems),
      ].filter((item): item is ParsedFoodItem => Boolean(item)),
    }),
    clarificationQuestion: null,
  };
}

async function resolveAssistantItems(
  items: MealAssistantItem[],
  mealType: MealAssistantState['mealType'],
  resolveItemNutrition: NutritionResolver,
  message = '',
) {
  return (await resolveAssistantItemsWithClarification(items, mealType, resolveItemNutrition, message)).items;
}

function buildReplyFromItems(args: {
  intent: MealAssistantModelOutput['intent'];
  decisionReply: string;
  resolvedItems: ParsedFoodItem[];
  removedTargets?: string[];
  saved?: boolean;
  clarificationQuestion?: string | null;
  mealAlreadySaved?: boolean;
  message?: string;
}) {
  const { intent, decisionReply, resolvedItems, removedTargets = [], saved = false, clarificationQuestion = null, mealAlreadySaved = false, message = '' } = args;
  const normalizedMessage = message.trim().toLowerCase();

  if (clarificationQuestion) {
    return clarificationQuestion;
  }

  if (saved) {
    return choosePhrase(`${normalizedMessage}:${intent}:${mealAlreadySaved ? 'saved' : 'fresh'}`, [
      'Saved. Anything else?',
      'All set, that one is logged.',
      'Got it saved. Want to keep going?',
      'That one is in. Anything else?',
    ]);
  }

  if (intent === 'start_new_meal') {
    return choosePhrase(decisionReply, ['Okay, starting fresh. What did you eat?', 'Alright, new meal. What’d you have?', 'Fresh start. What did you eat?']);
  }

  if (
    intent === 'casual_message' ||
    intent === 'greeting' ||
    intent === 'unknown' ||
    intent === 'nutrition_guidance' ||
    intent === 'nutrition_question' ||
    intent === 'macro_question' ||
    intent === 'recommendation_request' ||
    intent === 'meal_feedback' ||
    intent === 'complaint_repair' ||
    intent === 'comparison_question' ||
    intent === 'goal_question' ||
    intent === 'meal_review' ||
    intent === 'clarification_meta_question' ||
    intent === 'edit_command' ||
    intent === 'delete_command'
  ) {
    return decisionReply;
  }

  if ((intent === 'remove_item' || intent === 'correction') && removedTargets.length) {
    return choosePhrase(removedTargets.join(','), [`Removed ${removedTargets.join(', ')}.`, `Okay, I took out ${removedTargets.join(', ')}.`, `${removedTargets.join(', ')} is out now.`]);
  }

  if (!resolvedItems.length) {
    if (/checking that again/i.test(decisionReply)) {
      return decisionReply;
    }

    return isGenericReply(decisionReply) || isWeakStandaloneReply(decisionReply)
      ? buildFoodAwareFallbackReply(message, [])
      : decisionReply;
  }

  const mainItem = resolvedItems[0];
  const mainItemLabel = formatParsedItemLabel(mainItem);
  const totalCalories = Math.round(sumTotals(resolvedItems).calories);
  const sourceLabel = getSourceLabel(mainItem);
  const seed = `${intent}:${mainItem.food_name}:${totalCalories}:${sourceLabel}`;

  if (intent === 'new_food_item' && resolvedItems.length > 1) {
    return buildFoodAwareFallbackReply(message, resolvedItems);
  }

  if (intent === 'quantity_change') {
    const quantityLead = frustrationRegex.test(normalizedMessage)
      ? choosePhrase(normalizedMessage, ['No worries, I fixed that', 'All good, I updated it', 'Yep, I cleaned that up'])
      : choosePhrase(seed, ['Updated that', 'Okay, I changed it', 'Got you, I updated it']);

    return choosePhrase(seed, [
      `${quantityLead} to ${mainItemLabel}.`,
      `${quantityLead}. I’ve got it as ${mainItemLabel} now.`,
      `${quantityLead}. That’s now ${mainItemLabel}.`,
    ]);
  }

  if (intent === 'correction') {
    const correctionLead = frustrationRegex.test(normalizedMessage)
      ? choosePhrase(normalizedMessage, ['No worries, I fixed that.', 'All good, I cleaned that up.', 'Yep, I corrected it.'])
      : choosePhrase(normalizedMessage || seed, ['Got you.', 'Okay, updating it.', 'That makes sense.']);

    return choosePhrase(seed, [
      `${correctionLead} I've got it as ${mainItemLabel}, about ${totalCalories} calories total.`,
      `${correctionLead} That's now ${mainItemLabel}, roughly ${totalCalories} calories.`,
      `${correctionLead} I switched it to ${mainItemLabel}. About ${totalCalories} calories total.`,
    ]);
  }

  if (intent === 'add_to_current_meal') {
    const addedItem = resolvedItems.at(-1) ?? mainItem;
    const addedSeed = `${seed}:${addedItem.food_name}`;
    return choosePhrase(addedSeed, [
      `Added ${addedItem.food_name}${resolvedItems.length > 1 ? ' to this meal' : ''}. ${getSourceLabel(addedItem)}.`,
      `Got you, I added ${addedItem.food_name}. ${getSourceLabel(addedItem)}.`,
      `Added ${addedItem.food_name} in there too. ${getSourceLabel(addedItem)}.`,
      `Okay, added ${addedItem.food_name} too. ${getSourceLabel(addedItem)}.`,
      `Nice, added ${addedItem.food_name} in there now. ${getSourceLabel(addedItem)}.`,
    ]);
  }

  if (intent === 'new_food_item' && mealAlreadySaved) {
    return choosePhrase(seed, [
      `Got it, starting a new meal with ${mainItem.food_name}. ${sourceLabel}.`,
      `Alright, new meal. I’ve got ${mainItem.food_name}. ${sourceLabel}.`,
      `Starting fresh with ${mainItem.food_name}. ${sourceLabel}.`,
    ]);
  }

  if (intent === 'repeat_meal') {
    return decisionReply;
  }

  return choosePhrase(seed, [
    `${mainItemLabel}, about ${totalCalories} calories total. ${sourceLabel}.`,
    `I've got ${mainItemLabel}, roughly ${totalCalories} calories. ${sourceLabel}.`,
    `That looks like ${mainItemLabel}, around ${totalCalories} calories total. ${sourceLabel}.`,
    `Alright, I've got ${mainItemLabel}. That comes out to about ${totalCalories} calories. ${sourceLabel}.`,
  ]);
}

function guardAssistantDecision(decision: MealAssistantModelOutput, input: MealAssistantRunInput): MealAssistantModelOutput {
  const safeItems = decision.items.filter((item) => !isUnsafeLookupItem(item, input.message));
  const sanitizedOperations = decision.operations?.map((operation) => ({
    ...operation,
    items: operation.items.filter((item) => !isUnsafeLookupItem(item, input.message)),
  })) ?? [];
  const safeOperations = sanitizedOperations.filter((operation) =>
    operation.should_save_meal ||
    operation.action === 'save_meal' ||
    !['add_food', 'update_item_name'].includes(operation.action) ||
    operation.items.length > 0,
  );
  const droppedItems = safeItems.length !== decision.items.length;
  const droppedOperationItems =
    (decision.operations?.length ?? 0) !== safeOperations.length ||
    (decision.operations ?? []).some((operation, index) => operation.items.length !== (sanitizedOperations[index]?.items.length ?? 0));
  const isExplicitMealMutation =
    decision.should_mutate_pending_meal === true ||
    decision.contains_quantity_update === true ||
    decision.action === 'remove_item';
  const isReplacementClarification = isFoodReplacementClarification(input.message, input.state);
  const isNonFoodDialogue = isNonFoodDialogueMessage(input.message) && !isReplacementClarification;

  if (
    decision.should_ask_clarification &&
    decision.clarification_question &&
    !isNonFoodDialogue
  ) {
    return {
      ...decision,
      action: 'unclear',
      operations: [],
      items: safeItems,
      should_lookup_nutrition: false,
      should_mutate_pending_meal: false,
    };
  }

  if (
    isNonFoodDialogue ||
    isNonMutatingIntent(decision.intent) ||
    ((!isExplicitMealMutation && decision.contains_food_to_log === false) || (!isExplicitMealMutation && decision.should_mutate_pending_meal === false))
  ) {
    const recommendationReply = isRecommendationRequestMessage(input.message)
      ? buildRecommendationReply(input, input.context ?? emptyContext)
      : null;
    return {
      ...decision,
      intent: isRecommendationRequestMessage(input.message) ? 'recommendation_request' : decision.intent,
      assistant_reply: recommendationReply ?? decision.assistant_reply,
      operations: [],
      items: [],
      should_lookup_nutrition: false,
      should_ask_clarification: false,
      clarification_question: null,
      contains_food_to_log: false,
      should_mutate_pending_meal: false,
    };
  }

  if (!droppedItems && !droppedOperationItems) {
    return decision;
  }

  if (!safeItems.length && correctionCueRegex.test(input.message) && input.state.currentMealItems.length) {
    return {
      ...decision,
      intent: 'edit_command',
      assistant_reply: buildContextualContinuityReply(input.state),
      items: [],
      should_lookup_nutrition: false,
      should_ask_clarification: false,
      clarification_question: null,
      contains_food_to_log: false,
      should_mutate_pending_meal: false,
    };
  }

  return {
    ...decision,
    operations: safeOperations,
    items: safeItems,
    should_lookup_nutrition: (
      safeItems.length > 0 ||
      safeOperations.some((operation) => operation.should_lookup_nutrition && operation.items.length > 0)
    ) && shouldLookupNutritionForDecision({ ...decision, items: safeItems }, input.message),
    should_ask_clarification: safeItems.length || safeOperations.some((operation) => operation.items.length)
      ? decision.should_ask_clarification
      : false,
    clarification_question: safeItems.length || safeOperations.some((operation) => operation.items.length)
      ? decision.clarification_question
      : null,
  };
}

export async function runMealAssistant(
  input: MealAssistantRunInput,
  dependencies: MealAssistantDependencies = {},
): Promise<MealAssistantResponse> {
  const classify = dependencies.classify ?? classifyWithModel;
  const resolveItemNutrition = dependencies.resolveItemNutrition ?? defaultResolveItemNutrition;
  const saveMeal = dependencies.saveMeal ?? defaultSaveMeal;
  const generateAssistantReply = dependencies.generateAssistantReply ?? generateAssistantReplyWithModel;
  const context = input.context ?? emptyContext;
  const mixedIntent = splitMixedIntentMessage(input.message);
  const workingInput: MealAssistantRunInput = mixedIntent.foodMessage
    ? {
        ...input,
        message: mixedIntent.foodMessage,
      }
    : input;
  const state = migratePendingMealState({ ...workingInput.state });
  const statefulWorkingInput: MealAssistantRunInput = { ...workingInput, state };
  const shouldUseModelIntentFirst = Boolean(process.env.OPENAI_API_KEY) && !dependencies.classify;
  const normalizedWorkingMessage = stripEmotionalPreface(workingInput.message).toLowerCase();

  if (state.pendingMeal && isPendingMealExpired(state.pendingMeal)) {
    return finalizeResponse(buildDirectResponse({
      intent: 'meal_review',
      assistantReply: buildStalePendingReply(),
      nextState: markPendingMealStale(state),
      message: workingInput.message,
    }), workingInput, context);
  }

  if (isPendingDiscardMessage(workingInput.message) && hasActivePendingMeal(state)) {
    return finalizeResponse(buildDirectResponse({
      intent: 'delete_command',
      assistantReply: 'Discarded that pending meal. Send the food again when you are ready.',
      nextState: discardPendingMeal(state),
      message: workingInput.message,
    }), workingInput, context);
  }

  if (isSoftCancelKeepMessage(workingInput.message) && (hasActivePendingMeal(state) || state.currentMealItems.length)) {
    return finalizeResponse(buildDirectResponse({
      intent: 'casual_message',
      assistantReply: /^(?:undo|go back)/i.test(workingInput.message.trim())
        ? 'Nothing changed - this meal is still here. Tell me what to remove or change, or save it when it looks right.'
        : 'No problem - I still have this meal here. Tell me what to remove or change, or save it when it looks right.',
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        pendingClarification: null,
        lastAssistantQuestion: null,
      },
      message: workingInput.message,
    }), workingInput, context);
  }

  const alreadySavedSaveCommand = isBareSaveCommand(workingInput.message, true)
    && (state.saved || state.pendingMeal?.status === 'saved' || /\balready saved\b/i.test(state.lastAssistantReply ?? ''));
  if (alreadySavedSaveCommand) {
    const savedItems = state.currentMealItems.length ? state.currentMealItems : state.pendingMeal?.items ?? [];
    return finalizeResponse(buildDirectResponse({
      intent: 'save_meal',
      assistantReply: 'Already saved. Send the next meal whenever you are ready.',
      nextState: {
        ...state,
        currentMealItems: [...savedItems],
        currentMealText: state.currentMealText ?? (savedItems.length ? buildMealTextFromItems(savedItems) : null),
        saved: true,
        pendingClarification: null,
        lastAssistantQuestion: null,
      },
      message: workingInput.message,
    }), workingInput, context);
  }

  const saveOnlyCommand = isBareSaveCommand(
    workingInput.message,
    hasActivePendingMeal(state) || state.saved || state.pendingMeal?.status === 'saved',
  )
    && !extractExplicitFoodLogCommand(workingInput.message)
    && !/\b(?:add|remove|delete|make|change|update|actually|instead|no\s+\w+|without)\b/i.test(normalizedWorkingMessage);
  if (saveOnlyCommand) {
    if ((state.saved && state.currentMealItems.length) || state.pendingMeal?.status === 'saved') {
      const savedItems = state.currentMealItems.length ? state.currentMealItems : state.pendingMeal?.items ?? [];
      return finalizeResponse(buildDirectResponse({
        intent: 'save_meal',
        assistantReply: 'Already saved. Send the next meal whenever you are ready.',
        nextState: {
          ...state,
          currentMealItems: [...savedItems],
          currentMealText: state.currentMealText ?? (savedItems.length ? buildMealTextFromItems(savedItems) : null),
          saved: true,
          pendingClarification: null,
          lastAssistantQuestion: null,
        },
        message: workingInput.message,
      }), workingInput, context);
    }

    const activePendingMeal = getActivePendingMeal(state);
    const saveItems = activePendingMeal?.items.length ? activePendingMeal.items : state.currentMealItems;
    const saveAttempt = saveItems.length
      ? await attemptPendingMealSave({ state, items: saveItems, saveMeal })
      : null;

    return finalizeResponse(buildDirectResponse({
      intent: 'save_meal',
      assistantReply: saveItems.length
        ? saveAttempt?.assistantReply ?? 'Saved. Ready for the next one?'
        : 'There is not a meal to save yet. Send the meal whenever you are ready.',
      nextState: saveAttempt?.nextState ?? state,
      message: workingInput.message,
      shouldSaveMeal: Boolean(saveAttempt?.saved),
    }), workingInput, context);
  }

  const earlyRecommendationReply = !dependencies.classify && !extractExplicitFoodLogCommand(workingInput.message)
    ? buildRecommendationReply({ ...workingInput, state }, context)
    : null;
  if (earlyRecommendationReply) {
    return finalizeResponse(buildDirectResponse({
      intent: 'recommendation_request',
      assistantReply: earlyRecommendationReply,
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
      },
      message: workingInput.message,
      activeQuestion: workingInput.message,
    }), workingInput, context);
  }

  const mealTypeCorrection = extractMealTypeCorrection(workingInput.message);
  if (
    mealTypeCorrection
    && !recommendationRegex.test(normalizedWorkingMessage)
    && !dinnerSuggestionRegex.test(normalizedWorkingMessage)
    && !snackSuggestionRegex.test(normalizedWorkingMessage)
    && (
      hasActivePendingMeal(state)
      || (state.currentMealItems.length && !state.saved)
      || /^(?:actually|make that|change that|switch|it was|that was|for)?\s*(?:breakfast|lunch|dinner|snack)[.! ]*$/i.test(workingInput.message.trim())
    )
  ) {
    if (hasActivePendingMeal(state) || (state.currentMealItems.length && !state.saved)) {
      const nextState = updatePendingMealType(state, mealTypeCorrection);
      const pendingReply = buildPendingMealMacroReply(nextState);
      return finalizeResponse(buildDirectResponse({
        intent: 'correction',
        assistantReply: pendingReply
          ? `I updated that to ${mealTypeCorrection}. ${pendingReply}`
          : `I updated that to ${mealTypeCorrection}.`,
        nextState,
        message: workingInput.message,
      }), workingInput, context);
    }

    return finalizeResponse(buildDirectResponse({
      intent: 'correction',
      assistantReply: `I do not have a meal to update yet. What food should I log for ${mealTypeCorrection}?`,
      nextState: {
        ...state,
        mealType: mealTypeCorrection,
        currentMealItems: [],
        currentMealText: null,
        saved: false,
      },
      message: workingInput.message,
    }), workingInput, context);
  }

  const hasMealStateForMacro = hasActivePendingMeal(state)
    || state.pendingMeal?.status === 'saved'
    || (state.saved && state.currentMealItems.length > 0);
  if (isMacroRequestMessage(workingInput.message, hasMealStateForMacro)) {
    const pendingReply = buildPendingMealMacroReply(state);
    const savedReply = pendingReply ? null : buildSavedMealMacroReply(state);
    return finalizeResponse(buildDirectResponse({
      intent: 'macro_question',
      assistantReply: pendingReply ?? savedReply ?? buildNoMealMacroReply(),
      nextState: state,
      message: workingInput.message,
      activeQuestion: workingInput.message,
    }), workingInput, context);
  }

  if (isIrrelevantModifierRemoval(workingInput.message, state)) {
    return finalizeResponse(buildDirectResponse({
      intent: 'correction',
      assistantReply: buildIrrelevantModifierReply(workingInput.message, state),
      nextState: state,
      message: workingInput.message,
    }), workingInput, context);
  }

  if (state.pendingClarification && isClarificationMetaQuestion(workingInput.message)) {
    return finalizeResponse(buildDirectResponse({
      intent: 'clarification_meta_question',
      assistantReply: buildClarificationMetaReply(state),
      nextState: {
        ...state,
        currentMealItems: [...state.currentMealItems],
        currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
        confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        pendingClarification: state.pendingClarification,
        lastAssistantQuestion: state.lastAssistantQuestion ?? state.pendingClarification,
        saved: false,
      },
      message: workingInput.message,
      activeQuestion: state.pendingClarification,
    }), workingInput, context);
  }

  if (state.pendingClarification) {
    const clarificationAnswerItems = buildStructuredClarificationAnswerItems(workingInput.message, state);
    if (clarificationAnswerItems.length) {
      return finalizeResponse(buildDirectFoodEstimateResponse({
        input: workingInput,
        state,
        items: clarificationAnswerItems,
        intent: 'clarification_answer',
        followUpMessage: mixedIntent.followUpMessage,
        context,
      }), workingInput, context);
    }

    const trustedClarificationItems = messageNeedsForcedTrustedCatalogMatch(workingInput.message)
      ? detectKnownFoodEstimatesWithTrustedRestaurantFallback(workingInput.message, state.mealType)
      : [];
    if (trustedClarificationItems.length && trustedClarificationItems.some((item) => item.is_trusted && item.source_type !== 'AI_ESTIMATE')) {
      const hydratedItems = await hydrateKnownEstimatesWithProviders(trustedClarificationItems, state.mealType);
      return finalizeResponse(buildDirectFoodEstimateResponse({
        input: workingInput,
        state,
        items: hydratedItems,
        intent: 'clarification_answer',
        followUpMessage: mixedIntent.followUpMessage,
        context,
      }), workingInput, context);
    }
  }

  if (state.currentMealItems.length && !state.saved) {
    const correctionReplacement = parseCorrectionFoodReplacement(workingInput.message);
    if (correctionReplacement && shouldUseDirectCorrectionReplacement(correctionReplacement.foodText, state)) {
      const replacementItems = await resolveFoodTextForMealMutation({
        foodText: correctionReplacement.foodText,
        state,
        resolveItemNutrition,
        action: 'replace',
        quantity: correctionReplacement.quantity,
        unit: correctionReplacement.unit,
      });
      if (replacementItems.length && hasHighPriorityBrandedCatalogMatch(replacementItems)) {
        const targetIndex = findContextualItemIndex(workingInput.message, state.currentMealItems);
        const resolvedIndex = targetIndex >= 0 ? targetIndex : Math.max(0, state.currentMealItems.length - 1);
        const currentItems = cloneParsedItems(state.currentMealItems);
        const nextItems = [
          ...currentItems.slice(0, resolvedIndex),
          ...replacementItems,
          ...currentItems.slice(resolvedIndex + 1),
        ];
        return finalizeResponse(buildDirectResponse({
          intent: 'correction',
          assistantReply: `Fixed it - changed that to ${replacementItems.map((item) => formatParsedItemLabel(item)).join(' and ')}. About ${Math.round(sumTotals(nextItems).calories)} calories total.`,
          nextState: {
            ...state,
            currentMealItems: nextItems,
            userCorrections: [...state.userCorrections, workingInput.message],
            currentMealText: buildMealTextFromItems(nextItems),
            confidenceScore: getConfidenceScore(nextItems),
            saved: false,
            pendingClarification: null,
            lastAssistantQuestion: null,
          },
          message: workingInput.message,
        }), workingInput, context);
      }
    }
  }

  if (
    state.currentMealItems.length &&
    !state.saved &&
    (parseSwapReplacement(workingInput.message) || parseCorrectionFoodReplacement(workingInput.message) || /\b(?:make|change|update|remove|delete)\b/i.test(workingInput.message))
  ) {
      const deterministicSwapReply = await buildAdaptiveMealMutationReply(statefulWorkingInput, resolveItemNutrition, saveMeal);
    if (deterministicSwapReply) {
      return finalizeResponse(deterministicSwapReply, workingInput, context);
    }
  }

  const initialClarificationQuestion = !state.pendingClarification && !state.currentMealItems.length
    ? buildInitialClarificationQuestion(workingInput.message)
    : null;
  const trustedInitialRestaurantItems = !dependencies.classify && !state.pendingClarification && !state.currentMealItems.length
    ? detectKnownFoodEstimatesWithTrustedRestaurantFallback(workingInput.message, state.mealType)
    : [];
  if (trustedInitialRestaurantItems.some((item) => item.source_type === 'OFFICIAL_RESTAURANT')) {
    const hydratedItems = await hydrateKnownEstimatesWithProviders(trustedInitialRestaurantItems, state.mealType);
    return finalizeResponse(buildDirectFoodEstimateResponse({
      input: workingInput,
      state,
      items: hydratedItems,
      intent: 'new_food_item',
      followUpMessage: mixedIntent.followUpMessage,
      context,
    }), workingInput, context);
  }

  if (initialClarificationQuestion) {
    return finalizeResponse(buildInitialClarificationResponse(workingInput, initialClarificationQuestion), workingInput, context);
  }

  const currentRepeatItems = getCurrentMealRepeatItems(workingInput.message, state);
  if (currentRepeatItems) {
    return finalizeResponse(buildDirectResponse({
      intent: 'repeat_meal',
      assistantReply: choosePhrase(workingInput.message, [
        `Using the same ${buildMealTextFromItems(currentRepeatItems)} again.`,
        `I loaded that same ${buildMealTextFromItems(currentRepeatItems)} again.`,
        `Yep, repeating ${buildMealTextFromItems(currentRepeatItems)}.`,
      ]),
      nextState: {
        ...state,
        currentMealItems: currentRepeatItems,
        currentMealText: buildMealTextFromItems(currentRepeatItems),
        confidenceScore: getConfidenceScore(currentRepeatItems),
        pendingClarification: null,
        lastAssistantQuestion: null,
        saved: false,
        sourceReusableMealId: null,
        editingMealId: null,
      },
      message: workingInput.message,
    }), workingInput, context);
  }

  if (!shouldUseModelIntentFirst && !dependencies.classify) {
    const pizzaClarificationItems = resolvePizzaClarificationEstimate(workingInput.message, state);
    if (pizzaClarificationItems.length) {
      return finalizeResponse(buildDirectFoodEstimateResponse({
        input: workingInput,
        state,
        items: pizzaClarificationItems,
        intent: 'clarification_answer',
        followUpMessage: mixedIntent.followUpMessage,
        context,
      }), workingInput, context);
    }

    if (!hasAffirmativeSaveCommand(workingInput.message) && !correctionCueRegex.test(workingInput.message) && shouldAppendToCurrentMeal(workingInput.message, state)) {
      const appendItems = detectKnownFoodEstimatesWithTrustedRestaurantFallback(workingInput.message, state.mealType);
      if (appendItems.length) {
        const hydratedItems = await hydrateKnownEstimatesWithProviders(appendItems, state.mealType);
        return finalizeResponse(buildDirectFoodEstimateResponse({
          input: workingInput,
          state,
          items: hydratedItems,
          intent: 'add_to_current_meal',
          followUpMessage: mixedIntent.followUpMessage,
          context,
        }), workingInput, context);
      }
    }

    const deterministicDialogueResponse = await buildDeterministicDialogueResponse(statefulWorkingInput, context, resolveItemNutrition, saveMeal);
    if (deterministicDialogueResponse) {
      return finalizeResponse(deterministicDialogueResponse, workingInput, context);
    }

    const canUseDirectKnownFood =
      !dependencies.classify
      && !process.env.OPENAI_API_KEY
      && !state.pendingClarification
      && (
        !state.currentMealItems.length
        || state.saved
        || continuationRegex.test(stripEmotionalPreface(workingInput.message).toLowerCase())
        || Boolean(extractMealTypeHint(workingInput.message))
      );
    const directKnownItems = canUseDirectKnownFood ? detectKnownFoodEstimatesWithTrustedRestaurantFallback(workingInput.message, state.mealType) : [];
    if (directKnownItems.length) {
      const hydratedItems = await hydrateKnownEstimatesWithProviders(directKnownItems, state.mealType);
      return finalizeResponse(buildDirectFoodEstimateResponse({
        input: workingInput,
        state,
        items: hydratedItems,
        followUpMessage: mixedIntent.followUpMessage,
        context,
      }), workingInput, context);
    }

    if (!dependencies.classify) {
    const recommendationReply = buildRecommendationReply(workingInput, context);
    if (recommendationReply) {
      return finalizeResponse(buildDirectResponse({
        intent: 'recommendation_request',
        assistantReply: recommendationReply,
        nextState: {
          ...state,
          currentMealItems: [...state.currentMealItems],
          currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
          confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        },
        message: workingInput.message,
        activeQuestion: workingInput.message,
      }), workingInput, context);
    }

    const adaptiveMealMutationReply = await buildAdaptiveMealMutationReply(statefulWorkingInput, resolveItemNutrition, saveMeal);
    if (adaptiveMealMutationReply) {
      return finalizeResponse(adaptiveMealMutationReply, workingInput, context);
    }

    const descriptorReply = buildMealDescriptorReply(workingInput, context);
    if (descriptorReply) {
      return finalizeResponse(descriptorReply, workingInput, context);
    }

    const macroReply = buildCurrentMealMacroReply(workingInput.message, state);
    if (macroReply) {
      return finalizeResponse(buildDirectResponse({
        intent: 'macro_question',
        assistantReply: macroReply,
        nextState: {
          ...state,
          currentMealItems: [...state.currentMealItems],
          currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
          confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        },
        message: workingInput.message,
        activeQuestion: workingInput.message,
      }), workingInput, context);
    }

    const comparisonReply = buildComparisonReply(workingInput);
    if (comparisonReply) {
      return finalizeResponse(buildDirectResponse({
        intent: 'comparison_question',
        assistantReply: comparisonReply,
        nextState: {
          ...state,
          currentMealItems: [...state.currentMealItems],
          currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
          confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        },
        message: workingInput.message,
        activeQuestion: workingInput.message,
      }), workingInput, context);
    }

    if (weeklySummaryRegex.test(workingInput.message.trim().toLowerCase())) {
      return finalizeResponse(buildDirectResponse({
        intent: 'nutrition_guidance',
        assistantReply: buildWeeklySummaryReply(context),
        nextState: {
          ...state,
          currentMealItems: [...state.currentMealItems],
          userCorrections: [...state.userCorrections],
          currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
          confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        },
        message: workingInput.message,
        activeQuestion: workingInput.message,
      }), workingInput, context);
    }

    const casualReply = buildCasualReply(workingInput.message, state);
    if (casualReply) {
      const isRepairTurn = negativeFeedbackRegex.test(workingInput.message.trim().toLowerCase()) || confusionComplaintRegex.test(workingInput.message.trim().toLowerCase());
      return finalizeResponse(buildDirectResponse({
        intent: isRepairTurn
          ? 'complaint_repair'
          : greetingRegex.test(workingInput.message) && !state.currentMealItems.length ? 'greeting' : 'casual_message',
        assistantReply: casualReply,
        nextState: {
          ...state,
          currentMealItems: [...state.currentMealItems],
          userCorrections: [...state.userCorrections],
          currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
          confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        },
        message: workingInput.message,
      }), workingInput, context);
    }

    if (repeatYesterdayRegex.test(workingInput.message.trim().toLowerCase())) {
      const yesterdayMeal = findRepeatMealEntry(context, extractMealTypeHint(workingInput.message) ?? null);
      if (yesterdayMeal) {
        const loadedItems = cloneParsedItems(yesterdayMeal.items);
        const nextState: MealAssistantState = {
          ...state,
          currentMealItems: loadedItems,
          pendingClarification: null,
          lastAssistantQuestion: null,
          saved: false,
          mealType: yesterdayMeal.mealType,
          currentMealText: cleanMealReferenceText(yesterdayMeal.rawText) || cleanMealReferenceText(yesterdayMeal.title) || buildMealTextFromItems(loadedItems),
          confidenceScore: yesterdayMeal.confidenceScore ?? getConfidenceScore(loadedItems),
          sourceReusableMealId: null,
          editingMealId: null,
        };

        return finalizeResponse(buildDirectResponse({
          intent: 'repeat_meal',
          assistantReply: choosePhrase(workingInput.message, [
            `Using yesterday's ${buildMemoryReference(yesterdayMeal)}.`,
            `I pulled in yesterday's ${buildMemoryReference(yesterdayMeal)}.`,
            `Got you, I've got yesterday's ${buildMemoryReference(yesterdayMeal)} loaded.`,
          ]),
          nextState,
          message: workingInput.message,
        }), workingInput, context);
      }
    }

    const memoryMatch = findMatchingMemoryMeal(workingInput, context);
    if (memoryMatch) {
      const loadedItems = cloneParsedItems(memoryMatch.candidate.items);
      const nextItems = memoryMatch.appendToCurrentMeal ? [...state.currentMealItems, ...loadedItems] : loadedItems;
      const nextState: MealAssistantState = {
        ...state,
        currentMealItems: nextItems,
        pendingClarification: null,
        lastAssistantQuestion: null,
        saved: false,
        mealType: memoryMatch.appendToCurrentMeal ? state.mealType : memoryMatch.candidate.mealType,
        currentMealText: memoryMatch.appendToCurrentMeal
          ? buildMealTextFromItems(nextItems)
          : cleanMealReferenceText(memoryMatch.candidate.rawText) || cleanMealReferenceText(memoryMatch.candidate.title) || buildMealTextFromItems(nextItems),
        confidenceScore: memoryMatch.appendToCurrentMeal ? getConfidenceScore(nextItems) : memoryMatch.candidate.confidenceScore ?? getConfidenceScore(nextItems),
        sourceReusableMealId: memoryMatch.appendToCurrentMeal ? null : memoryMatch.candidate.source === 'favorite' ? memoryMatch.candidate.sourceReusableMealId ?? memoryMatch.candidate.id : null,
        editingMealId: null,
      };

      return finalizeResponse(buildDirectResponse({
        intent: memoryMatch.appendToCurrentMeal ? 'add_to_current_meal' : 'repeat_meal',
        assistantReply: buildMemoryLoadReply(memoryMatch, workingInput.message),
        nextState,
        message: workingInput.message,
      }), workingInput, context);
    }

    const nutritionReply = buildNutritionGuidanceReply(workingInput, context);
    if (nutritionReply) {
      return finalizeResponse(buildDirectResponse({
        intent: 'nutrition_guidance',
        assistantReply: nutritionReply,
        nextState: {
          ...state,
          currentMealItems: [...state.currentMealItems],
          userCorrections: [...state.userCorrections],
          pendingClarification: state.pendingClarification ?? null,
          lastAssistantQuestion: state.lastAssistantQuestion ?? null,
          currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
          confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        },
        message: workingInput.message,
        activeQuestion: workingInput.message,
      }), workingInput, context);
    }

    const recoveryReply = buildConversationRecoveryReply(workingInput, context);
    if (recoveryReply) {
      return finalizeResponse(buildDirectResponse({
        intent: 'casual_message',
        assistantReply: recoveryReply,
        nextState: {
          ...state,
          currentMealItems: [...state.currentMealItems],
          userCorrections: [...state.userCorrections],
          currentMealText: state.currentMealText ?? (state.currentMealItems.length ? buildMealTextFromItems(state.currentMealItems) : null),
          confidenceScore: state.confidenceScore ?? getConfidenceScore(state.currentMealItems),
        },
        message: workingInput.message,
        activeQuestion: workingInput.message,
      }), workingInput, context);
    }
    }
  }

  let decision = await classify({
    ...statefulWorkingInput,
    context,
  });
  decision = normalizeAssistantDecision(decision, workingInput);
  decision = guardAssistantDecision(decision, workingInput);
  if (state.pendingClarification && decision.intent === 'new_food_item' && decision.should_lookup_nutrition) {
    decision = {
      ...decision,
      intent: 'clarification_answer',
      action: decision.action ?? 'add_food',
      should_mutate_pending_meal: true,
    };
  }
  const normalizedOperations = normalizeDecisionOperations(decision);
  const hasCompoundOperations = Boolean(decision.operations?.length)
    || normalizedOperations.length > 1
    || (
      state.currentMealItems.length > 0
      && normalizedOperations.some((operation) => (
        operation.action === 'remove_item'
        || operation.action === 'update_item_quantity'
        || operation.action === 'update_item_name'
      ))
    );
  if (hasCompoundOperations && normalizedOperations.some((operation) => isMutatingOperationAction(operation.action) || operation.should_save_meal)) {
    decision = {
      ...decision,
      intent: 'correction',
      action: normalizedOperations[0]?.action ?? decision.action,
      operations: normalizedOperations,
      should_save_meal: normalizedOperations.some((operation) => operation.should_save_meal),
      should_lookup_nutrition: normalizedOperations.some((operation) => operation.should_lookup_nutrition),
      should_mutate_pending_meal: normalizedOperations.some((operation) => isMutatingOperationAction(operation.action)),
    };
  }

  const classifiedKnownItems = detectKnownFoodEstimatesWithTrustedRestaurantFallback(workingInput.message, state.mealType);
  if (
    classifiedKnownItems.length
    && (hasFoodAfterConversationalLeadIn(workingInput.message) || decision.intent === 'new_food_item' || decision.intent === 'add_to_current_meal')
    && (decision.should_ask_clarification || !decision.items.length || !decision.should_lookup_nutrition)
  ) {
    const hydratedItems = await hydrateKnownEstimatesWithProviders(classifiedKnownItems, state.mealType);
    return finalizeResponse(buildDirectFoodEstimateResponse({
      input: workingInput,
      state,
      items: hydratedItems,
      intent: state.currentMealItems.length && !state.saved ? 'add_to_current_meal' : 'new_food_item',
      followUpMessage: mixedIntent.followUpMessage,
      context,
    }), workingInput, context);
  }

  let nextState: MealAssistantState = {
    ...state,
    userCorrections: [...state.userCorrections],
    currentMealItems: [...state.currentMealItems],
  };

  let resolvedItems = [...nextState.currentMealItems];
  let removedTargets: string[] = [];
  let clarificationQuestion: string | null = null;
  let saved = false;
  let suppressedClarification = false;

  if ((decision.intent === 'new_food_item' || decision.intent === 'add_to_current_meal') && shouldAskPizzaPortion(workingInput.message, decision.items)) {
    decision.should_ask_clarification = true;
    decision.clarification_question = buildPizzaPortionQuestion(workingInput.message);
    decision.should_lookup_nutrition = false;
    decision.items = [];
    clarificationQuestion = decision.clarification_question;
    nextState.pendingClarification = decision.clarification_question;
    nextState.lastAssistantQuestion = decision.clarification_question;
    nextState.saved = false;
  }

  if (decision.intent === 'start_new_meal') {
    nextState = {
      ...nextState,
      currentMealItems: [],
      pendingClarification: null,
      lastAssistantQuestion: null,
      currentMealText: null,
      confidenceScore: 0.82,
      saved: false,
      userCorrections: [],
      sourceReusableMealId: null,
      editingMealId: null,
    };
  } else if (
    (decision.intent === 'save_meal' || decision.should_save_meal) &&
    !hasCompoundOperations &&
    !(decision.items.length && decision.should_lookup_nutrition)
  ) {
    const activePendingMeal = getActivePendingMeal(nextState);
    const saveItems = activePendingMeal?.items.length ? activePendingMeal.items : nextState.currentMealItems;
    if (nextState.pendingMeal?.status === 'saved') {
      saved = false;
    } else if (saveItems.length) {
      const saveAttempt = await attemptPendingMealSave({ state: nextState, items: saveItems, saveMeal });
      nextState = saveAttempt.nextState;
      nextState.pendingClarification = null;
      nextState.lastAssistantQuestion = null;
      saved = saveAttempt.saved;
      if (!saveAttempt.saved) {
        (decision as MealAssistantModelOutput & { compound_reply?: string }).compound_reply = saveAttempt.assistantReply;
      }
    }
  } else if (hasCompoundOperations) {
    const applied = await applyDecisionOperations({
      operations: normalizedOperations,
      state: nextState,
      message: workingInput.message,
      resolveItemNutrition,
    });

    if (applied.mutated) {
      nextState.currentMealItems = applied.nextItems;
      nextState.currentMealText = buildMealTextFromItems(nextState.currentMealItems);
      nextState.pendingClarification = null;
      nextState.lastAssistantQuestion = null;
      nextState.saved = false;
      nextState.confidenceScore = getConfidenceScore(nextState.currentMealItems);
      resolvedItems = applied.resolvedItems.length ? applied.resolvedItems : nextState.currentMealItems;
      removedTargets = applied.removedTargets;
      if (normalizedOperations.every((operation) => operation.action === 'update_item_quantity')) {
        decision.intent = 'quantity_change';
      } else if (decision.intent === 'new_food_item') {
        decision.intent = 'correction';
      }
      if (decision.intent === 'quantity_change' && normalizedOperations.length > 1) {
        decision.intent = 'correction';
      }
      (decision as MealAssistantModelOutput & { compound_reply?: string }).compound_reply = buildCompoundOperationReply({
        summaryParts: applied.summaryParts,
        nextItems: nextState.currentMealItems,
        saved: false,
        previousReply: state.lastAssistantReply,
      });
    }

    if (applied.shouldSaveMeal && nextState.currentMealItems.length) {
      const saveAttempt = await attemptPendingMealSave({ state: nextState, items: nextState.currentMealItems, saveMeal });
      nextState = saveAttempt.nextState;
      nextState.pendingClarification = null;
      nextState.lastAssistantQuestion = null;
      saved = saveAttempt.saved;
      (decision as MealAssistantModelOutput & { compound_reply?: string }).compound_reply = buildCompoundOperationReply({
        summaryParts: applied.summaryParts,
        nextItems: nextState.currentMealItems,
        saved: saveAttempt.saved,
        previousReply: state.lastAssistantReply,
      });
      if (!saveAttempt.saved) {
        (decision as MealAssistantModelOutput & { compound_reply?: string }).compound_reply = saveAttempt.assistantReply;
      }
    }
  } else if (decision.should_ask_clarification && decision.clarification_question && decision.clarification_question !== state.lastAssistantQuestion) {
    clarificationQuestion = decision.clarification_question;
    nextState.pendingClarification = decision.clarification_question;
    nextState.lastAssistantQuestion = decision.clarification_question;
    nextState.saved = false;
    if (isFoodReplacementClarification(workingInput.message, nextState)) {
      nextState.currentMealItems = [];
      nextState.currentMealText = null;
      nextState.confidenceScore = 0.82;
      resolvedItems = [];
    }
  } else if (decision.should_ask_clarification && decision.clarification_question === state.lastAssistantQuestion) {
    suppressedClarification = true;
    nextState.pendingClarification = state.pendingClarification;
    nextState.lastAssistantQuestion = state.lastAssistantQuestion;
    nextState.saved = false;
  } else if (decision.intent === 'remove_item' || decision.action === 'remove_item') {
    const removalResult = applyRemovedItems(nextState.currentMealItems, decision.items);
    nextState.currentMealItems = removalResult.nextItems;
    nextState.currentMealText = buildMealTextFromItems(nextState.currentMealItems);
    nextState.pendingClarification = null;
    nextState.lastAssistantQuestion = null;
    nextState.saved = false;
    nextState.confidenceScore = getConfidenceScore(nextState.currentMealItems);
    resolvedItems = nextState.currentMealItems;
    removedTargets = removalResult.removedTargets;
  } else if (decision.items.length) {
    const shouldResetForNewMeal = decision.intent === 'new_food_item' && (!state.currentMealItems.length || state.saved);
    if (shouldResetForNewMeal) {
      nextState.currentMealItems = [];
      nextState.currentMealText = null;
      nextState.userCorrections = [];
      nextState.sourceReusableMealId = null;
      nextState.editingMealId = null;
    }

    if (decision.intent === 'quantity_change' && state.currentMealItems.length) {
      const updateItem = decision.items[0];
      const targetIndex = resolveDecisionTargetIndex(decision, nextState, input.message);
      const nextQuantity = updateItem.quantity;
      if (targetIndex >= 0) {
        const target = nextState.currentMealItems[targetIndex];
        const updatedItems = scaleParsedItems([target], nextQuantity);
        const updatedItem = updatedItems[0] ?? target;
        nextState.currentMealItems = nextState.currentMealItems.map((item, index) => (
          index === targetIndex
            ? {
                ...updatedItem,
                unit: updateItem.unit ?? updatedItem.unit,
              }
            : item
        ));
      }
      nextState.userCorrections.push(input.message);
      nextState.pendingClarification = null;
      nextState.lastAssistantQuestion = null;
      nextState.saved = false;
      nextState.currentMealText = buildMealTextFromItems(nextState.currentMealItems);
      nextState.confidenceScore = getConfidenceScore(nextState.currentMealItems);
      resolvedItems = nextState.currentMealItems;
    } else {
      const lookupResult = shouldLookupNutritionForDecision(decision, workingInput.message)
        ? await resolveAssistantItemsWithClarification(decision.items, nextState.mealType, resolveItemNutrition, workingInput.message)
        : { items: [], clarificationQuestion: null };
      const lookedUpItems = lookupResult.items;

      if (lookupResult.clarificationQuestion) {
        clarificationQuestion = lookupResult.clarificationQuestion;
        nextState.pendingClarification = lookupResult.clarificationQuestion;
        nextState.lastAssistantQuestion = lookupResult.clarificationQuestion;
        nextState.saved = false;
        nextState.currentMealItems = [];
        nextState.currentMealText = null;
        nextState.confidenceScore = 0.82;
        resolvedItems = [];
      } else if (decision.intent === 'correction' || decision.intent === 'clarification_answer') {
        nextState.userCorrections.push(input.message);
        if (lookedUpItems.length) {
          nextState.currentMealItems = lookedUpItems;
        }
      } else if (decision.intent === 'new_food_item') {
        nextState.currentMealItems = lookedUpItems;
      } else if (decision.intent === 'add_to_current_meal') {
        nextState.currentMealItems = [...nextState.currentMealItems, ...lookedUpItems];
      } else {
        nextState.currentMealItems = lookedUpItems.length ? lookedUpItems : nextState.currentMealItems;
      }

      if (!lookupResult.clarificationQuestion) {
        nextState.pendingClarification = null;
        nextState.lastAssistantQuestion = null;
        nextState.saved = false;
        nextState.currentMealText = buildMealTextFromItems(nextState.currentMealItems);
        nextState.confidenceScore = getConfidenceScore(nextState.currentMealItems);
        resolvedItems = nextState.currentMealItems;
      }
    }
  }

  const mealItems = withServingMetadataForItems(suppressNearDuplicateResolvedItems(nextState.currentMealItems, workingInput.message));
  nextState = {
    ...nextState,
    currentMealItems: mealItems,
    currentMealText: mealItems.length ? buildMealTextFromItems(mealItems) : null,
    confidenceScore: getConfidenceScore(mealItems),
  };
  if (mealItems.length && !saved && !clarificationQuestion) {
    const shouldReplacePendingMeal = decision.intent === 'new_food_item' && !getActivePendingMeal(state);
    nextState = createReadyPendingMeal({
      state: nextState,
      items: mealItems,
      rawText: shouldReplacePendingMeal ? workingInput.message : nextState.currentMealText ?? workingInput.message,
      mealType: nextState.mealType,
      replace: shouldReplacePendingMeal,
    });
  }
  const totals = sumTotals(mealItems);
  const compoundReply = (decision as MealAssistantModelOutput & { compound_reply?: string }).compound_reply ?? null;
  const reviewCopyIntent = decision.intent === 'new_food_item'
    || decision.intent === 'add_to_current_meal'
    || decision.intent === 'clarification_answer'
    || decision.intent === 'correction'
    || decision.intent === 'quantity_change'
    || decision.intent === 'remove_item';
  const pendingReviewReply = reviewCopyIntent && mealItems.length && !saved && !clarificationQuestion
    ? buildPendingReviewReply(nextState)
    : null;
  const pendingReviewAssistantReply = pendingReviewReply && decision.intent === 'add_to_current_meal' && resolvedItems.length
    ? `Added ${resolvedItems.map((item) => formatParsedItemLabel(item)).join(' and ')}. ${pendingReviewReply}`
    : pendingReviewReply;
  const primaryReply = validateAssistantReply({
    message: workingInput.message,
    assistantReply: compoundReply || pendingReviewAssistantReply || buildReplyFromItems({
      intent: decision.intent,
      decisionReply: suppressedClarification
        ? 'Got it, I’m checking that again.'
        : decision.assistant_reply || buildFallbackReply(workingInput.message, state, context),
      resolvedItems: resolvedItems.length ? resolvedItems : mealItems,
      removedTargets,
      saved,
      clarificationQuestion,
      mealAlreadySaved: state.saved,
      message: workingInput.message,
    }),
    intent: decision.intent,
    state: {
      ...nextState,
      currentMealItems: mealItems,
    },
    context,
  });

  const followUpReply = mixedIntent.followUpMessage
    ? validateAssistantReply({
        message: mixedIntent.followUpMessage,
        assistantReply:
          buildCurrentMealMacroReply(mixedIntent.followUpMessage, {
            ...nextState,
            currentMealItems: mealItems,
          }) ||
          buildNutritionGuidanceReply(
            {
              ...workingInput,
              message: mixedIntent.followUpMessage,
              state: {
                ...nextState,
                currentMealItems: mealItems,
              },
            },
            context,
          ) ||
          buildRecommendationReply(
            {
              ...workingInput,
              message: mixedIntent.followUpMessage,
              state: {
                ...nextState,
                currentMealItems: mealItems,
              },
            },
            context,
          ) ||
          buildComparisonReply({
            ...workingInput,
            message: mixedIntent.followUpMessage,
            state: {
              ...nextState,
              currentMealItems: mealItems,
            },
          }) ||
          '',
        intent: /recommend|idea|suggest|something/.test(mixedIntent.followUpMessage.toLowerCase())
          ? 'recommendation_request'
          : followUpMacroRegex.test(mixedIntent.followUpMessage.toLowerCase()) || /\b(?:carbs?|fat|protein|calories?)\b/i.test(mixedIntent.followUpMessage)
            ? 'macro_question'
            : comparisonRegex.test(mixedIntent.followUpMessage.toLowerCase())
              ? 'comparison_question'
              : 'nutrition_guidance',
        state: {
          ...nextState,
          currentMealItems: mealItems,
        },
        context,
      })
    : null;

  const draftAssistantReply = postProcessAssistantReply(
    [primaryReply, followUpReply].filter(Boolean).join(' '),
    {
      ...nextState,
      currentMealItems: mealItems,
    },
    workingInput.message,
  );
  const generatedAssistantReply = await generateAssistantReply({
    input: workingInput,
    decision,
    draftReply: draftAssistantReply,
    nextState,
    mealItems,
    context,
    saved,
    clarificationQuestion,
    removedTargets,
  });
  const assistantReply = generatedAssistantReply
    ? postProcessAssistantReply(generatedAssistantReply, { ...nextState, currentMealItems: mealItems }, workingInput.message)
    : draftAssistantReply;

  nextState = updateConversationState(nextState, {
    intent: decision.intent,
    message: input.message,
    activeQuestion: clarificationQuestion ?? mixedIntent.followUpMessage ?? null,
  });

  return finalizeResponse({
    ...decision,
    assistant_reply: assistantReply,
    should_ask_clarification: Boolean(clarificationQuestion),
    clarification_question: clarificationQuestion,
    meal: {
      items: mealItems,
      totals,
      confidence_score: nextState.confidenceScore,
    },
    next_state: {
      ...nextState,
      currentMealItems: mealItems,
      currentMealText: mealItems.length ? nextState.currentMealText ?? buildMealTextFromItems(mealItems) : null,
      confidenceScore: nextState.confidenceScore,
      pendingClarification: suppressedClarification ? nextState.pendingClarification : clarificationQuestion,
      lastAssistantQuestion: suppressedClarification ? nextState.lastAssistantQuestion : clarificationQuestion,
      saved,
      lastAssistantReply: assistantReply,
    },
  }, workingInput, context);
}

export type { MealAssistantDependencies, MealAssistantRunInput };
