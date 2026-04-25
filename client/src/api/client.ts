import axios from 'axios';
import type {
  ApiResponse,
  PaginatedData,
  AuthResponse,
  SignupRequest,
  SigninRequest,
  RefreshTokenRequest,
  ForgotPasswordRequest,
  VerifyResetCodeRequest,
  ResetPasswordRequest,
  OnboardingStatus,
  BasicInfoRequest,
  ActivityGoalRequest,
  PreferencesRequest,
  UserProfileDto,
  UpdateProfileRequest,
  UserPreferenceDto,
  UpdatePreferencesRequest,
  UserTargetsDto,
  RecipeDto,
  RecipeDetailDto,
  GenerateRecipeRequest,
  PantryItemDto,
  AddPantryItemRequest,
  NotificationsResponse,
  CalorieCalculatorRequest,
  CalorieCalculatorResponse,
  MealPlanDto,
  MealPlanMealDto,
  GenerateMealPlanRequest,
  ShoppingListItemDto,
  AssistantChatRequest,
  AssistantChatResponse,
  FaqItemDto,
  // V12 new
  DashboardDto,
  WeightLogDto,
  CreateWeightLogRequest,
  WeightLogsResponse,
  WaterLogDto,
  CreateWaterLogRequest,
  WaterTodayResponse,
  FreeMealLogDto,
  CreateFreeMealRequest,
  MealPlanCalendarResponse,
  UserSettingsDto,
  UpdateUserSettingsRequest,
  ChangePasswordRequest,
  DeleteAccountRequest,
  DeviceTokenDto,
  RegisterDeviceRequest,
  NotificationPreferenceDto,
  UpdateNotificationPreferenceRequest,
  PantrySearchParams,
} from './contracts';

// ── Axios instances ──────────────────────────

/**
 * Backend origin. In dev this is empty → all calls go to /api/* and the
 * Vite proxy forwards them. In prod set VITE_API_URL to e.g.
 * https://api.dietrix.app and every request gets prefixed automatically.
 */
export const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const API_BASE = `${API_ORIGIN}/api`;

const authApi = axios.create({
  baseURL: `${API_BASE}/auth`,
  headers: { 'Content-Type': 'application/json' },
});

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// ── JWT helpers ──────────────────────────────

/** Returns Unix-seconds expiration timestamp from a JWT, or 0 if invalid */
function getTokenExp(token: string | null): number {
  if (!token) return 0;
  try {
    const payload = token.split('.')[1];
    // base64url → base64
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    const obj = JSON.parse(json);
    return typeof obj.exp === 'number' ? obj.exp : 0;
  } catch {
    return 0;
  }
}

/** True if token expired or expires within `leewaySec` seconds */
function isTokenExpiringSoon(token: string | null, leewaySec = 30): boolean {
  const exp = getTokenExp(token);
  if (!exp) return true; // unknown → assume bad
  return Date.now() / 1000 + leewaySec >= exp;
}

// ── Auto-refresh state ───────────────────────

let refreshPromise: Promise<string> | null = null;

/**
 * Calls /refresh exactly once even if many requests need it simultaneously.
 * Returns the fresh access token, or rejects (and forces logout).
 */
function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  const rt = getRefreshToken();
  if (!rt) {
    clearTokens();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/sign-')) {
      window.location.href = '/sign-in';
    }
    return Promise.reject(new Error('No refresh token'));
  }

  refreshPromise = authApi
    .post<ApiResponse<AuthResponse>>('/refresh', { refreshToken: rt })
    .then((res) => {
      const { accessToken, refreshToken: newRt } = res.data.data;
      saveTokens(accessToken, newRt);
      return accessToken;
    })
    .catch((err) => {
      // refresh itself failed → refresh token also dead → kill session
      clearTokens();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/sign-')) {
        window.location.href = '/sign-in';
      }
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

// ── Request interceptor: proactive refresh ──

api.interceptors.request.use(async (config) => {
  // skip auth header for explicitly public endpoints if needed (none right now)
  let token = getAccessToken();

  // proactive refresh: if access token will expire in <30s, refresh BEFORE sending
  if (token && isTokenExpiringSoon(token, 30)) {
    try {
      token = await refreshAccessToken();
    } catch {
      // refresh failed; let the request go without auth → backend returns 401 → caller handles
      token = null;
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: reactive 401 fallback ──
// (covers the case where backend rejected before our proactive check, e.g. server-side clock drift)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest?._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const newToken = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

// ── Background watchdog: refresh ~1 min before expiry ──
//
// Runs every 30s while a tab is open. Cheap (no API calls unless needed).
// Survives long idle tabs that would otherwise wake up to expired tokens.

if (typeof window !== 'undefined') {
  setInterval(() => {
    const token = getAccessToken();
    if (!token) return;
    if (isTokenExpiringSoon(token, 60) && !refreshPromise) {
      refreshAccessToken().catch(() => { /* logged out by helper */ });
    }
  }, 30_000);

  // Also refresh immediately when tab regains focus (handles laptop sleep)
  window.addEventListener('focus', () => {
    const token = getAccessToken();
    if (token && isTokenExpiringSoon(token, 60) && !refreshPromise) {
      refreshAccessToken().catch(() => { /* logged out by helper */ });
    }
  });
}

// ── Auth endpoints ───────────────────────────

export async function signup(data: SignupRequest): Promise<ApiResponse<AuthResponse>> {
  const res = await authApi.post<ApiResponse<AuthResponse>>('/signup', data);
  return res.data;
}

export async function signin(data: SigninRequest): Promise<ApiResponse<AuthResponse>> {
  const res = await authApi.post<ApiResponse<AuthResponse>>('/signin', data);
  return res.data;
}

export async function refreshToken(data: RefreshTokenRequest): Promise<ApiResponse<AuthResponse>> {
  const res = await authApi.post<ApiResponse<AuthResponse>>('/refresh', data);
  return res.data;
}

export async function forgotPassword(data: ForgotPasswordRequest): Promise<ApiResponse<void>> {
  const res = await authApi.post<ApiResponse<void>>('/forgot-password', data);
  return res.data;
}

export async function verifyResetCode(data: VerifyResetCodeRequest): Promise<ApiResponse<void>> {
  const res = await authApi.post<ApiResponse<void>>('/verify-reset-code', data);
  return res.data;
}

export async function resetPassword(data: ResetPasswordRequest): Promise<ApiResponse<void>> {
  const res = await authApi.post<ApiResponse<void>>('/reset-password', data);
  return res.data;
}

/** POST /api/reference/calculate-calories — public, no auth */
export async function calculateCalories(data: CalorieCalculatorRequest): Promise<ApiResponse<CalorieCalculatorResponse>> {
  const res = await api.post<ApiResponse<CalorieCalculatorResponse>>('/reference/calculate-calories', data);
  return res.data;
}

// ── User Profile endpoints ───────────────────

export async function getProfile(): Promise<ApiResponse<UserProfileDto>> {
  const res = await api.get<ApiResponse<UserProfileDto>>('/users/me');
  return res.data;
}

export async function updateProfile(data: UpdateProfileRequest): Promise<ApiResponse<UserProfileDto>> {
  const res = await api.patch<ApiResponse<UserProfileDto>>('/users/me', data);
  return res.data;
}

export async function getPreferences(): Promise<ApiResponse<UserPreferenceDto>> {
  const res = await api.get<ApiResponse<UserPreferenceDto>>('/users/me/preferences');
  return res.data;
}

export async function updatePreferences(data: UpdatePreferencesRequest): Promise<ApiResponse<UserPreferenceDto>> {
  const res = await api.put<ApiResponse<UserPreferenceDto>>('/users/me/preferences', data);
  return res.data;
}

/** GET /api/users/me/targets */
export async function getTargets(): Promise<ApiResponse<UserTargetsDto>> {
  const res = await api.get<ApiResponse<UserTargetsDto>>('/users/me/targets');
  return res.data;
}


// ── Onboarding endpoints ─────────────────────

export async function getOnboardingStatus(): Promise<ApiResponse<OnboardingStatus>> {
  const res = await api.get<ApiResponse<OnboardingStatus>>('/onboarding');
  return res.data;
}

export async function saveBasicInfo(data: BasicInfoRequest): Promise<ApiResponse<OnboardingStatus>> {
  const res = await api.put<ApiResponse<OnboardingStatus>>('/onboarding/basic-info', data);
  return res.data;
}

export async function saveActivityGoal(data: ActivityGoalRequest): Promise<ApiResponse<OnboardingStatus>> {
  const res = await api.put<ApiResponse<OnboardingStatus>>('/onboarding/activity-goal', data);
  return res.data;
}

export async function savePreferences(data: PreferencesRequest): Promise<ApiResponse<OnboardingStatus>> {
  const res = await api.put<ApiResponse<OnboardingStatus>>('/onboarding/preferences', data);
  return res.data;
}

// ── Recipe endpoints ─────────────────────────

/** GET /api/recipes/recommended — max 10 */
export async function getRecommendedRecipes(): Promise<ApiResponse<RecipeDto[]>> {
  const res = await api.get<ApiResponse<RecipeDto[]>>('/recipes/recommended');
  return res.data;
}

/** GET /api/recipes/recent-generated — max 10, AI-рецепты пользователя */
export async function getRecentGeneratedRecipes(): Promise<ApiResponse<RecipeDto[]>> {
  const res = await api.get<ApiResponse<RecipeDto[]>>('/recipes/recent-generated');
  return res.data;
}

/** GET /api/recipes/:id */
export async function getRecipeById(id: number): Promise<ApiResponse<RecipeDetailDto>> {
  const res = await api.get<ApiResponse<RecipeDetailDto>>(`/recipes/${id}`);
  return res.data;
}

/** POST /api/recipes/generate — AI генерация */
export async function generateRecipe(data: GenerateRecipeRequest): Promise<ApiResponse<RecipeDetailDto>> {
  const res = await api.post<ApiResponse<RecipeDetailDto>>('/recipes/generate', data);
  return res.data;
}

/** GET /api/recipes — paginated list with filters */
export async function getRecipes(params?: {
  mealType?: string;
  cuisine?: string;
  maxCalories?: number;
  page?: number;
  size?: number;
}): Promise<ApiResponse<PaginatedData<RecipeDto>>> {
  const res = await api.get<ApiResponse<PaginatedData<RecipeDto>>>('/recipes', { params });
  return res.data;
}

// ── Meal Plan endpoints (daily) ───────────────

/** GET /api/meal-plans/current */
export async function getCurrentMealPlan(): Promise<ApiResponse<MealPlanDto>> {
  const res = await api.get<ApiResponse<MealPlanDto>>('/meal-plans/current');
  return res.data;
}

/** POST /api/meal-plans/generate */
export async function generateMealPlan(data?: GenerateMealPlanRequest): Promise<ApiResponse<MealPlanDto>> {
  const res = await api.post<ApiResponse<MealPlanDto>>('/meal-plans/generate', data ?? {});
  return res.data;
}

/** POST /api/meal-plans/:planId/meals/:mealId/complete */
export async function completeMeal(planId: number, mealId: number): Promise<ApiResponse<MealPlanMealDto>> {
  const res = await api.post<ApiResponse<MealPlanMealDto>>(`/meal-plans/${planId}/meals/${mealId}/complete`);
  return res.data;
}

/** DELETE /api/meal-plans/:planId/meals/:mealId/complete — uncomplete */
export async function uncompleteMeal(planId: number, mealId: number): Promise<ApiResponse<MealPlanMealDto>> {
  const res = await api.delete<ApiResponse<MealPlanMealDto>>(`/meal-plans/${planId}/meals/${mealId}/complete`);
  return res.data;
}

/** PATCH /api/meal-plans/:planId/meals/:mealId — replace recipe */
export async function replaceMealRecipe(planId: number, mealId: number, recipeId: number): Promise<ApiResponse<MealPlanMealDto>> {
  const res = await api.patch<ApiResponse<MealPlanMealDto>>(`/meal-plans/${planId}/meals/${mealId}`, { recipeId });
  return res.data;
}

/** POST /api/meal-plans/:planId/meals — add a meal (snack) */
export async function addMealToPlan(planId: number, recipeId: number, mealType: string = 'SNACK'): Promise<ApiResponse<MealPlanMealDto>> {
  const res = await api.post<ApiResponse<MealPlanMealDto>>(`/meal-plans/${planId}/meals`, { recipeId, mealType });
  return res.data;
}

/** DELETE /api/meal-plans/:planId/meals/:mealId — remove meal from plan */
export async function deleteMealFromPlan(planId: number, mealId: number): Promise<ApiResponse<void>> {
  const res = await api.delete<ApiResponse<void>>(`/meal-plans/${planId}/meals/${mealId}`);
  return res.data;
}

/** GET /api/meal-plans/:planId/shopping-list */
export async function getShoppingList(planId: number): Promise<ApiResponse<ShoppingListItemDto[]>> {
  const res = await api.get<ApiResponse<ShoppingListItemDto[]>>(`/meal-plans/${planId}/shopping-list`);
  return res.data;
}

// ── Pantry endpoints ─────────────────────────

/** GET /api/pantry/items */
export async function getPantryItems(): Promise<ApiResponse<PantryItemDto[]>> {
  const res = await api.get<ApiResponse<PantryItemDto[]>>('/pantry/items');
  return res.data;
}

/** POST /api/pantry/items */
export async function addPantryItem(data: AddPantryItemRequest): Promise<ApiResponse<PantryItemDto>> {
  const res = await api.post<ApiResponse<PantryItemDto>>('/pantry/items', data);
  return res.data;
}

/** POST /api/pantry/items/bulk */
export async function addPantryItemsBulk(items: AddPantryItemRequest[]): Promise<ApiResponse<PantryItemDto[]>> {
  const res = await api.post<ApiResponse<PantryItemDto[]>>('/pantry/items/bulk', { items });
  return res.data;
}

/** DELETE /api/pantry/items/:id */
export async function deletePantryItem(id: number): Promise<ApiResponse<void>> {
  const res = await api.delete<ApiResponse<void>>(`/pantry/items/${id}`);
  return res.data;
}

// ── AI Assistant endpoints ────────────────────

/** POST /api/assistant/chat */
export async function chatWithAssistant(data: AssistantChatRequest): Promise<ApiResponse<AssistantChatResponse>> {
  const res = await api.post<ApiResponse<AssistantChatResponse>>('/assistant/chat', data);
  return res.data;
}

/** GET /api/assistant/faq?category=... */
export async function getFaq(category?: string): Promise<ApiResponse<FaqItemDto[]>> {
  const res = await api.get<ApiResponse<FaqItemDto[]>>('/assistant/faq', {
    params: category ? { category } : undefined,
  });
  return res.data;
}

// ── Notification endpoints (⚠️ backend TBD) ─

export async function getNotifications(
  params: { size?: number; unreadOnly?: boolean } = {},
): Promise<ApiResponse<NotificationsResponse>> {
  const res = await api.get<ApiResponse<NotificationsResponse>>('/notifications', {
    params,
  });
  return res.data;
}

export async function markNotificationRead(id: number): Promise<ApiResponse<void>> {
  const res = await api.patch<ApiResponse<void>>(`/notifications/${id}/read`);
  return res.data;
}

export async function markAllNotificationsRead(): Promise<ApiResponse<void>> {
  const res = await api.patch<ApiResponse<void>>('/notifications/read-all');
  return res.data;
}

// ── Auth account (V12) ───────────────────────

/** POST /api/auth/change-password */
export async function changePassword(data: ChangePasswordRequest): Promise<ApiResponse<void>> {
  const res = await api.post<ApiResponse<void>>('/auth/change-password', data);
  return res.data;
}

/** DELETE /api/auth/account — GDPR */
export async function deleteAccount(data: DeleteAccountRequest): Promise<ApiResponse<void>> {
  const res = await api.delete<ApiResponse<void>>('/auth/account', { data });
  return res.data;
}

// ── User Settings (V12) ──────────────────────

/** GET /api/users/me/settings */
export async function getUserSettings(): Promise<ApiResponse<UserSettingsDto>> {
  const res = await api.get<ApiResponse<UserSettingsDto>>('/users/me/settings');
  return res.data;
}

/** PATCH /api/users/me/settings */
export async function updateUserSettings(data: UpdateUserSettingsRequest): Promise<ApiResponse<UserSettingsDto>> {
  const res = await api.patch<ApiResponse<UserSettingsDto>>('/users/me/settings', data);
  return res.data;
}

// ── Dashboard (V12) ──────────────────────────

/** GET /api/dashboard */
export async function getDashboard(): Promise<ApiResponse<DashboardDto>> {
  const res = await api.get<ApiResponse<DashboardDto>>('/dashboard');
  return res.data;
}

// ── Tracking — Weight (V12) ───────────────────

/** POST /api/users/me/weight-logs */
export async function addWeightLog(data: CreateWeightLogRequest): Promise<ApiResponse<WeightLogDto>> {
  const res = await api.post<ApiResponse<WeightLogDto>>('/users/me/weight-logs', data);
  return res.data;
}

/** GET /api/users/me/weight-logs?from&to */
export async function getWeightLogs(params?: { from?: string; to?: string }): Promise<ApiResponse<WeightLogsResponse>> {
  const res = await api.get<ApiResponse<WeightLogsResponse>>('/users/me/weight-logs', { params });
  return res.data;
}

/** DELETE /api/users/me/weight-logs/:id */
export async function deleteWeightLog(id: number): Promise<ApiResponse<void>> {
  const res = await api.delete<ApiResponse<void>>(`/users/me/weight-logs/${id}`);
  return res.data;
}

// ── Tracking — Water (V12) ────────────────────

/** POST /api/users/me/water-logs */
export async function addWaterLog(data: CreateWaterLogRequest): Promise<ApiResponse<WaterLogDto>> {
  const res = await api.post<ApiResponse<WaterLogDto>>('/users/me/water-logs', data);
  return res.data;
}

/** GET /api/users/me/water-logs/today */
export async function getWaterToday(): Promise<ApiResponse<WaterTodayResponse>> {
  const res = await api.get<ApiResponse<WaterTodayResponse>>('/users/me/water-logs/today');
  return res.data;
}

/** DELETE /api/users/me/water-logs/:id */
export async function deleteWaterLog(id: number): Promise<ApiResponse<void>> {
  const res = await api.delete<ApiResponse<void>>(`/users/me/water-logs/${id}`);
  return res.data;
}

// ── Tracking — Free meals (V12) ───────────────

/** POST /api/users/me/free-meals */
export async function addFreeMeal(data: CreateFreeMealRequest): Promise<ApiResponse<FreeMealLogDto>> {
  const res = await api.post<ApiResponse<FreeMealLogDto>>('/users/me/free-meals', data);
  return res.data;
}

/** GET /api/users/me/free-meals?date= */
export async function getFreeMeals(date?: string): Promise<ApiResponse<FreeMealLogDto[]>> {
  const res = await api.get<ApiResponse<FreeMealLogDto[]>>('/users/me/free-meals', {
    params: date ? { date } : undefined,
  });
  return res.data;
}

/** DELETE /api/users/me/free-meals/:id */
export async function deleteFreeMeal(id: number): Promise<ApiResponse<void>> {
  const res = await api.delete<ApiResponse<void>>(`/users/me/free-meals/${id}`);
  return res.data;
}

// ── Meal Plan history & calendar (V12) ────────

/** GET /api/meal-plans/history?from&to */
export async function getMealPlanHistory(params?: { from?: string; to?: string }): Promise<ApiResponse<MealPlanDto[]>> {
  const res = await api.get<ApiResponse<MealPlanDto[]>>('/meal-plans/history', { params });
  return res.data;
}

/** GET /api/meal-plans/calendar?month=YYYY-MM */
export async function getMealPlanCalendar(month?: string): Promise<ApiResponse<MealPlanCalendarResponse>> {
  const res = await api.get<ApiResponse<MealPlanCalendarResponse>>('/meal-plans/calendar', {
    params: month ? { month } : undefined,
  });
  return res.data;
}

/** GET /api/meal-plans/by-date/:date */
export async function getMealPlanByDate(date: string): Promise<ApiResponse<MealPlanDto>> {
  const res = await api.get<ApiResponse<MealPlanDto>>(`/meal-plans/by-date/${date}`);
  return res.data;
}

/** POST /api/meal-plans/duplicate-yesterday */
export async function duplicateYesterdayMealPlan(): Promise<ApiResponse<MealPlanDto>> {
  const res = await api.post<ApiResponse<MealPlanDto>>('/meal-plans/duplicate-yesterday');
  return res.data;
}

// ── Pantry search (V12) ───────────────────────

/** GET /api/pantry/items/search?q=&category=&expiringInDays= */
export async function searchPantry(params: PantrySearchParams): Promise<ApiResponse<PantryItemDto[]>> {
  const res = await api.get<ApiResponse<PantryItemDto[]>>('/pantry/items/search', { params });
  return res.data;
}

// ── Notifications: devices & preferences (V12) ─

/** POST /api/notifications/devices */
export async function registerDevice(data: RegisterDeviceRequest): Promise<ApiResponse<DeviceTokenDto>> {
  const res = await api.post<ApiResponse<DeviceTokenDto>>('/notifications/devices', data);
  return res.data;
}

/** DELETE /api/notifications/devices/:token */
export async function unregisterDevice(token: string): Promise<ApiResponse<void>> {
  const res = await api.delete<ApiResponse<void>>(`/notifications/devices/${encodeURIComponent(token)}`);
  return res.data;
}

/** GET /api/notifications/preferences */
export async function getNotificationPreferences(): Promise<ApiResponse<NotificationPreferenceDto>> {
  const res = await api.get<ApiResponse<NotificationPreferenceDto>>('/notifications/preferences');
  return res.data;
}

/** PATCH /api/notifications/preferences */
export async function updateNotificationPreferences(data: UpdateNotificationPreferenceRequest): Promise<ApiResponse<NotificationPreferenceDto>> {
  const res = await api.patch<ApiResponse<NotificationPreferenceDto>>('/notifications/preferences', data);
  return res.data;
}

/** POST /api/notifications/test */
export async function sendTestNotification(channel: 'PUSH' | 'EMAIL' = 'PUSH'): Promise<ApiResponse<void>> {
  const res = await api.post<ApiResponse<void>>('/notifications/test', { channel });
  return res.data;
}

// ── Token helpers ────────────────────────────

const ACCESS_KEY = 'dietrix_access_token';
const REFRESH_KEY = 'dietrix_refresh_token';

export function saveTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}
