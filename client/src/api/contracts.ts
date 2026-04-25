/**
 * ============================================================
 *  DIETRIX — Backend API Contracts
 *  Base URL: /api   (proxied to localhost:8080)
 * ============================================================
 */

// ─────────────────────────────────────────────
//  GENERIC WRAPPER
// ─────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Paginated wrapper (used by GET /api/recipes etc.) */
export interface PaginatedData<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// ─────────────────────────────────────────────
//  ENUMS
// ─────────────────────────────────────────────

export type Gender        = 'MALE' | 'FEMALE';
export type Goal          = 'LOSE_WEIGHT' | 'MAINTAIN' | 'GAIN_MUSCLE' | 'GAIN_WEIGHT';
export type ActivityLevel = 'SEDENTARY' | 'LIGHTLY_ACTIVE' | 'MODERATELY_ACTIVE' | 'VERY_ACTIVE' | 'EXTRA_ACTIVE';
export type DietType      = 'NONE' | 'VEGETARIAN' | 'VEGAN' | 'KETO' | 'PALEO' | 'MEDITERRANEAN' | 'LOW_CARB' | 'HIGH_PROTEIN' | 'GLUTEN_FREE';
export type Allergy       = 'GLUTEN' | 'DAIRY' | 'EGGS' | 'NUTS' | 'PEANUTS' | 'SOY' | 'FISH' | 'SHELLFISH' | 'WHEAT' | 'SESAME' | 'SULFITES' | 'LACTOSE' | 'FRUCTOSE';
export type MealType      = 'BREAKFAST' | 'MAIN' | 'SNACK' | 'DESSERT';
export type Cuisine       = 'ITALIAN' | 'JAPANESE' | 'MEXICAN' | 'INDIAN' | 'KOREAN' | 'FRENCH' | 'TURKISH' | 'AMERICAN' | 'KAZAKH' | 'RUSSIAN' | 'THAI' | 'CHINESE' | 'GEORGIAN' | 'UZBEK' | 'GREEK' | 'SPANISH' | 'INTERNATIONAL';
export type MealPlanStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

// ─────────────────────────────────────────────
//  AUTH  —  /api/auth
// ─────────────────────────────────────────────

/** POST /api/auth/signup */
export interface SignupRequest {
  name: string;       // 2–100 chars
  email: string;      // valid email
  password: string;   // 6–100 chars
}

/** POST /api/auth/signin */
export interface SigninRequest {
  email: string;
  password: string;
}

/** Response for signup / signin / refresh */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;   // "Bearer"
  userId: number;
  email: string;
  name: string;
}

/** POST /api/auth/refresh */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/** POST /api/auth/forgot-password */
export interface ForgotPasswordRequest {
  email: string;
}

/** POST /api/auth/verify-reset-code */
export interface VerifyResetCodeRequest {
  email: string;
  code: string;        // 6-digit code
}

/** POST /api/auth/reset-password */
export interface ResetPasswordRequest {
  email: string;
  code: string;        // 6-digit code
  newPassword: string; // 6–100 chars
}

// ─────────────────────────────────────────────
//  USER PROFILE  —  /api/users/me
// ─────────────────────────────────────────────

/** GET /api/users/me */
export interface UserProfileDto {
  id: number;
  userId: number;
  name: string;
  email: string;
  gender: Gender | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  goal: Goal | null;
  activityLevel: ActivityLevel | null;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
}

/** PATCH /api/users/me  — all fields optional */
export interface UpdateProfileRequest {
  name?: string;
  gender?: Gender;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  goal?: Goal;
  activityLevel?: ActivityLevel;
  avatarUrl?: string;
}

/** GET /api/users/me/targets */
export interface UserTargetsDto {
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  bmr: number;
  tdee: number;
  formula: string;
  bmi: number;
  bmiCategory: string;
  waterMl: number;
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;
  gender: string;
  age: number;
  weightKg: number;
  heightCm: number;
  activityLevel: string;
  goal: string;
}

/** POST /api/users/me/avatar — multipart/form-data */
export interface AvatarUploadResponse {
  avatarUrl: string;
}

// ─────────────────────────────────────────────
//  USER PREFERENCES  —  /api/users/me/preferences
// ─────────────────────────────────────────────

export interface UserPreferenceDto {
  dietType: DietType | null;
  allergies: Allergy[] | null;
  likedFoods: string[] | null;
  dislikedFoods: string[] | null;
  cuisinePreferences: string[] | null;
}

/** PUT /api/users/me/preferences */
export interface UpdatePreferencesRequest {
  dietType?: DietType;
  allergies?: Allergy[];
  likedFoods?: string[];
  dislikedFoods?: string[];
  cuisinePreferences?: string[];
}

// ─────────────────────────────────────────────
//  ONBOARDING  —  /api/onboarding
// ─────────────────────────────────────────────

export interface OnboardingStatus {
  currentStep: number;
  completed: boolean;
}

/** PUT /api/onboarding/basic-info  — Step 1 */
export interface BasicInfoRequest {
  gender: Gender;        // required
  age: number;           // 10–120
  heightCm: number;      // 50–300
  weightKg: number;      // 20–500
}

/** PUT /api/onboarding/activity-goal  — Step 2 */
export interface ActivityGoalRequest {
  activityLevel: ActivityLevel;  // required
  goal: Goal;                    // required
}

/** PUT /api/onboarding/preferences  — Step 3 */
export interface PreferencesRequest {
  dietType?: DietType;
  allergies?: Allergy[];
  likedFoods?: string[];
  dislikedFoods?: string[];
  cuisinePreferences?: string[];
}

// ─────────────────────────────────────────────
//  RECIPES  —  /api/recipes
// ─────────────────────────────────────────────

export interface RecipeIngredientDto {
  id: number;
  name: string;
  amount: string;
  unit: string;
}

/** Short DTO used in lists (recommended, recent-generated) */
export interface RecipeDto {
  id: number;
  title: string;
  description: string;
  calories: number;
  cookTimeMinutes: number;
  cuisine: string | null;
  imageUrl: string | null;
  mealType: string;          // breakfast | lunch | dinner | snack
  dietType: DietType | null;
  favorite: boolean;
}

/** Full DTO for GET /api/recipes/:id */
export interface RecipeDetailDto extends RecipeDto {
  instructions: string;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: RecipeIngredientDto[];
}

/** POST /api/recipes/generate */
export interface GenerateRecipeRequest {
  mealType?: string;           // breakfast | lunch | dinner | snack
  cuisine?: string;
  maxCalories?: number;
  usePantry?: boolean;
  additionalNotes?: string;
}

// ─────────────────────────────────────────────
//  PANTRY  —  /api/pantry
// ─────────────────────────────────────────────

export interface PantryItemDto {
  id: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  expirationDate: string | null;   // ISO date, null если не указано
}

/** POST /api/pantry/items */
export interface AddPantryItemRequest {
  name: string;               // required
  quantity?: number;
  unit?: string;
  category?: string;
  expirationDate?: string;    // ISO date
}

/** POST /api/pantry/items/bulk */
export interface BulkAddPantryRequest {
  items: AddPantryItemRequest[];
}

// ─────────────────────────────────────────────
//  CALORIE CALCULATOR  —  POST /api/reference/calculate-calories
//  (public, no auth required)
// ─────────────────────────────────────────────

export interface CalorieCalculatorRequest {
  gender: Gender;
  age: number;              // 10–120
  weightKg: number;         // 20–500
  heightCm: number;         // 50–300
  activityLevel: ActivityLevel;
  goal: Goal;
}

export interface CalorieCalculatorResponse {
  // Input echo
  gender: string;
  age: number;
  weightKg: number;
  heightCm: number;
  activityLevel: string;
  goal: string;

  // BMR
  bmrMifflinStJeor: number;
  bmrHarrisBenedict: number;

  // TDEE
  tdee: number;

  // Target calories
  dailyCalories: number;

  // Macros (grams)
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;

  // Macros (percent)
  proteinPercent: number;
  carbsPercent: number;
  fatPercent: number;

  // BMI
  bmi: number;
  bmiCategory: string;

  // Water
  waterMl: number;

  // Explanations
  calorieExplanation: string;
  proteinExplanation: string;
}

// ─────────────────────────────────────────────
//  MEAL PLANS (daily)  —  /api/meal-plans
// ─────────────────────────────────────────────

export interface MealPlanMealDto {
  id: number;
  mealType: MealType;
  recipeId: number;
  recipeTitle: string;
  calories: number;
  protein?: number;        // ← NEW (V12)
  carbs?: number;          // ← NEW (V12)
  fat?: number;            // ← NEW (V12)
  completed: boolean;
}

/** Daily meal plan — one day, 3 meals */
export interface MealPlanDto {
  id: number;
  date: string;            // ISO date e.g. "2026-04-11"
  status: MealPlanStatus;
  totalMeals: number;
  completedMeals: number;
  totalCalories: number;
  meals: MealPlanMealDto[] | null;
}

/** POST /api/meal-plans/generate */
export interface GenerateMealPlanRequest {
  cuisine?: string;
  usePantry?: boolean;
  additionalNotes?: string;
}

export interface ShoppingListItemDto {
  id: number;
  name: string;
  amount: string;
  unit: string;
  purchased: boolean;
}

// ─────────────────────────────────────────────
//  AI ASSISTANT  —  /api/assistant
// ─────────────────────────────────────────────

/** POST /api/assistant/chat */
export interface AssistantChatRequest {
  message: string;
}

export interface AssistantChatResponse {
  message: string;
  role: string;        // "assistant"
}

/** GET /api/assistant/faq */
export interface FaqItemDto {
  id: number;
  question: string;
  answer: string;
  category: string;    // "nutrition" | "diet" | "recipes" | "general"
}

// ─────────────────────────────────────────────
//  NOTIFICATIONS  —  /api/notifications
//  ⚠️  NOT YET IMPLEMENTED ON BACKEND — see TZ
// ─────────────────────────────────────────────

export type NotificationType =
  | 'MEAL_REMINDER'
  | 'PANTRY_EXPIRY'
  | 'RECIPE_READY'
  | 'WEEKLY_REPORT'
  | 'SYSTEM';

export interface NotificationDto {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;         // ISO datetime
}

export interface NotificationsResponse {
  items: NotificationDto[];
  unreadCount: number;
}

// ─────────────────────────────────────────────
//  DASHBOARD  —  /api/dashboard  (V12 updated)
// ─────────────────────────────────────────────

export interface DashboardDto {
  userName: string;
  dailyCalorieTarget: number;
  todayCaloriesConsumed: number;
  todayProtein: number;
  todayCarbs: number;
  todayFat: number;
  pantryItemsCount: number;
  expiringItemsCount: number;
  hasMealPlan: boolean;
  mealPlanTotalMeals: number;
  mealPlanCompletedMeals: number;
  mealPlanProgressPercent: number;
  favoriteRecipesCount: number;
  onboardingCompleted: boolean;
  bmi: number;
  bmiCategory: string;
  // V12 new fields
  waterConsumedMl: number;
  waterTargetMl: number;
  currentWeightKg: number | null;
  streakDays: number;
}

// ─────────────────────────────────────────────
//  TRACKING  —  /api/users/me  (V12)
// ─────────────────────────────────────────────

export interface WeightLogDto {
  id: number;
  weightKg: number;
  loggedAt: string;            // ISO date
  deltaFromPrevious?: number;
  deltaFromStart?: number;
}

export interface CreateWeightLogRequest {
  weightKg: number;
  loggedAt?: string;           // ISO date, default = today
}

export interface WeightLogsResponse {
  logs: WeightLogDto[];
  currentWeight: number | null;
  startWeight: number | null;
  totalChange: number;
  averageWeeklyChange: number;
}

export interface WaterLogDto {
  id: number;
  amountMl: number;
  loggedAt: string;            // ISO datetime
}

export interface CreateWaterLogRequest {
  amountMl: number;
}

export interface WaterTodayResponse {
  logs: WaterLogDto[];
  totalMl: number;
  targetMl: number;
  progressPercent: number;
}

export interface FreeMealLogDto {
  id: number;
  name: string;
  calories: number;
  mealType?: MealType;
  loggedAt: string;            // ISO datetime
  notes?: string;
}

export interface CreateFreeMealRequest {
  name: string;
  calories: number;
  mealType?: MealType;
  loggedAt?: string;
  notes?: string;
}

// ─────────────────────────────────────────────
//  MEAL PLAN HISTORY / CALENDAR  (V12)
// ─────────────────────────────────────────────

export type CalendarDayStatus = 'COMPLETED' | 'PARTIAL' | 'MISSED' | 'EMPTY';

export interface CalendarDayDto {
  date: string;                // ISO date
  status: CalendarDayStatus;
  emoji: string;               // ✅ ⚠️ ❌ ·
  completedMeals?: number;
  totalMeals?: number;
}

export interface MealPlanCalendarResponse {
  month: string;               // "2026-04"
  days: CalendarDayDto[];
  streakDays: number;
}

// ─────────────────────────────────────────────
//  USER SETTINGS  —  /api/users/me/settings  (V12)
// ─────────────────────────────────────────────

export type ThemeMode = 'LIGHT' | 'DARK' | 'SYSTEM';
export type LocaleCode = 'en' | 'ru' | 'kk';
export type WeightUnit = 'KG' | 'LB';
export type HeightUnit = 'CM' | 'INCH';

export interface UserSettingsDto {
  theme: ThemeMode;
  locale: LocaleCode;
  units: {
    weight: WeightUnit;
    height: HeightUnit;
  };
}

export interface UpdateUserSettingsRequest {
  theme?: ThemeMode;
  locale?: LocaleCode;
  units?: Partial<UserSettingsDto['units']>;
}

// ─────────────────────────────────────────────
//  AUTH ACCOUNT  —  /api/auth  (V12)
// ─────────────────────────────────────────────

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface DeleteAccountRequest {
  password: string;
  reason?: string;
}

// ─────────────────────────────────────────────
//  PUSH NOTIFICATIONS / PREFERENCES  (V12)
// ─────────────────────────────────────────────

export type DevicePlatform = 'WEB' | 'IOS' | 'ANDROID';

export interface DeviceTokenDto {
  token: string;
  platform: DevicePlatform;
  userAgent?: string;
  registeredAt?: string;
}

export interface RegisterDeviceRequest {
  token: string;
  platform: DevicePlatform;
  userAgent?: string;
}

export interface NotificationPreferenceDto {
  pushEnabled: boolean;
  emailEnabled: boolean;
  mealReminders: boolean;
  expiryAlerts: boolean;
  weeklyReport: boolean;
  quietHoursStart?: string | null;   // "HH:mm"
  quietHoursEnd?: string | null;     // "HH:mm"
  breakfastTime?: string | null;     // "HH:mm"
  lunchTime?: string | null;
  dinnerTime?: string | null;
}

export type UpdateNotificationPreferenceRequest = Partial<NotificationPreferenceDto>;

// ─────────────────────────────────────────────
//  PANTRY SEARCH  (V12)
// ─────────────────────────────────────────────

export interface PantrySearchParams {
  q?: string;
  category?: string;
  expiringInDays?: number;
}
