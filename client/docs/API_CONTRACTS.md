# Dietrix — API Contracts для фронтенда

**Base URL:** `http://localhost:8080`  
**Content-Type:** `application/json`  
**Auth header:** `Authorization: Bearer <accessToken>` (для 🔒 эндпоинтов)

---

## Общий формат ответов

### Успех
```json
{
  "success": true,
  "message": "Optional message",
  "data": { ... },
  "timestamp": "2026-04-11T10:00:00"
}
```

### Ошибка
```json
{
  "status": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "must be a well-formed email address" }
  ],
  "timestamp": "2026-04-11T10:00:00"
}
```

### Пагинация (`data`)
```json
{
  "content": [...],
  "page": 0,
  "size": 20,
  "totalElements": 100,
  "totalPages": 5,
  "last": false
}
```

---

## Справочники Enum

```
Gender:         MALE | FEMALE

Goal:           LOSE_WEIGHT | MAINTAIN | GAIN_MUSCLE | GAIN_WEIGHT

ActivityLevel:  SEDENTARY | LIGHTLY_ACTIVE | MODERATELY_ACTIVE | VERY_ACTIVE | EXTRA_ACTIVE

DietType:       NONE | VEGETARIAN | VEGAN | KETO | PALEO
                MEDITERRANEAN | LOW_CARB | HIGH_PROTEIN | GLUTEN_FREE

Allergy:        GLUTEN | DAIRY | EGGS | NUTS | PEANUTS | SOY
                FISH | SHELLFISH | WHEAT | SESAME | SULFITES | LACTOSE | FRUCTOSE

MealType:       BREAKFAST | LUNCH | DINNER | SNACK

MealPlanStatus: ACTIVE | COMPLETED | ARCHIVED
```

---

## 1. AUTH `/api/auth` — публичные

### POST `/api/auth/signup`
**Request:**
```json
{
  "name": "Иван Иванов",       // required
  "email": "ivan@example.com", // required, valid email
  "password": "secret123"      // required, min 6 chars
}
```
**Response `200`:**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "uuid-...",
    "tokenType": "Bearer",
    "userId": 1,
    "email": "ivan@example.com",
    "name": "Иван Иванов"
  }
}
```
**Errors:** `409` email already registered

---

### POST `/api/auth/signin`
**Request:**
```json
{
  "email": "ivan@example.com",
  "password": "secret123"
}
```
**Response `200`:** — то же что signup  
**Errors:** `401` invalid credentials

---

### POST `/api/auth/refresh`
**Request:**
```json
{ "refreshToken": "uuid-..." }
```
**Response `200`:** — то же что signup (новая пара токенов)

---

### POST `/api/auth/logout`
**Request:**
```json
{ "refreshToken": "uuid-..." }
```
**Response `200`:**
```json
{ "success": true, "message": "Logged out successfully" }
```

---

### POST `/api/auth/forgot-password`
**Request:**
```json
{ "email": "ivan@example.com" }
```
**Response `200`:** — всегда успех (защита от перебора email)
```json
{ "success": true, "message": "If the email exists, a 6-digit code has been sent" }
```
> На почту придёт письмо с 6-значным кодом, действителен **15 минут**

---

### POST `/api/auth/verify-reset-code`
**Request:**
```json
{
  "email": "ivan@example.com",
  "code": "482913"             // exactly 6 digits
}
```
**Response `200`:**
```json
{ "success": true, "message": "Code is valid" }
```
**Errors:** `400` invalid code / `400` code expired

---

### POST `/api/auth/reset-password`
**Request:**
```json
{
  "email": "ivan@example.com",
  "code": "482913",            // exactly 6 digits
  "newPassword": "newPass123"  // min 6 chars
}
```
**Response `200`:**
```json
{ "success": true, "message": "Password reset successful" }
```
**Errors:** `400` invalid code / `400` code expired

---

## 2. ONBOARDING `/api/onboarding` 🔒

### GET `/api/onboarding`
**Response `200`:**
```json
{
  "data": {
    "currentStep": 1,       // 0 = не начат, 1-3 = текущий шаг
    "totalSteps": 3,
    "completed": false,
    "nextStep": "activity-goal"  // "basic-info" | "activity-goal" | "preferences" | "completed"
  }
}
```

---

### PUT `/api/onboarding/basic-info` — Шаг 1
**Request:**
```json
{
  "gender": "MALE",         // required: MALE | FEMALE
  "age": 25,                // required, 10–120
  "heightCm": 180.0,        // required, 50–300
  "weightKg": 75.0          // required, 20–500
}
```
**Response `200`:** → `OnboardingStatusDto` (currentStep: 1)

---

### PUT `/api/onboarding/activity-goal` — Шаг 2
**Request:**
```json
{
  "activityLevel": "MODERATELY_ACTIVE",  // required
  "goal": "LOSE_WEIGHT"                  // required
}
```
**Response `200`:** → `OnboardingStatusDto` (currentStep: 2)

---

### PUT `/api/onboarding/preferences` — Шаг 3
**Request:**
```json
{
  "dietType": "MEDITERRANEAN",           // optional, DietType enum
  "allergies": ["GLUTEN", "DAIRY"],      // optional, Allergy enum[]
  "likedFoods": ["chicken", "quinoa"],   // optional, string[]
  "dislikedFoods": ["liver"],            // optional, string[]
  "cuisinePreferences": ["Italian"]      // optional, string[]
}
```
**Response `200`:** → `OnboardingStatusDto` (currentStep: 3, completed: true)

---

## 3. USER PROFILE `/api/users/me` 🔒

### GET `/api/users/me`
**Response `200`:**
```json
{
  "data": {
    "id": 1,
    "userId": 1,
    "name": "Иван",
    "email": "ivan@example.com",
    "gender": "MALE",
    "age": 25,
    "heightCm": 180.0,
    "weightKg": 75.0,
    "goal": "LOSE_WEIGHT",
    "activityLevel": "MODERATELY_ACTIVE",
    "avatarUrl": null,
    "onboardingCompleted": true
  }
}
```

---

### PATCH `/api/users/me`
> Все поля необязательные, передаёт только то что нужно изменить

**Request:**
```json
{
  "name": "Иван",
  "gender": "MALE",
  "age": 25,
  "heightCm": 180.0,
  "weightKg": 74.5,
  "goal": "MAINTAIN",
  "activityLevel": "VERY_ACTIVE",
  "avatarUrl": "https://..."
}
```
**Response `200`:** → `UserProfileDto`

---

### GET `/api/users/me/preferences`
**Response `200`:**
```json
{
  "data": {
    "dietType": "MEDITERRANEAN",
    "allergies": ["GLUTEN"],
    "likedFoods": ["chicken", "quinoa"],
    "dislikedFoods": ["liver"],
    "cuisinePreferences": ["Italian", "Japanese"]
  }
}
```

---

### PUT `/api/users/me/preferences`
**Request:** — то же что ответ выше  
**Response `200`:** → `UserPreferenceDto`

---

### GET `/api/users/me/targets`
**Response `200`:**
```json
{
  "data": {
    "dailyCalories": 1920,
    "proteinGrams": 150,
    "carbsGrams": 176,
    "fatGrams": 64,
    "bmr": 1820,
    "tdee": 2400,
    "formula": "Mifflin-St Jeor",
    "bmi": 23.1,
    "bmiCategory": "Normal weight",
    "waterMl": 2970,
    "proteinPercent": 31,
    "carbsPercent": 37,
    "fatPercent": 30,
    "gender": "MALE",
    "age": 25,
    "weightKg": 75.0,
    "heightCm": 180.0,
    "activityLevel": "MODERATELY_ACTIVE",
    "goal": "LOSE_WEIGHT"
  }
}
```

---

### GET `/api/users/me/favorites`
**Response `200`:**
```json
{
  "data": [ ...RecipeDto[] ]
}
```

---

### POST `/api/users/me/favorites/{recipeId}`
**Response `200`:**
```json
{ "success": true, "message": "Recipe added to favorites" }
```

---

### DELETE `/api/users/me/favorites/{recipeId}`
**Response `200`:**
```json
{ "success": true, "message": "Recipe removed from favorites" }
```

---

## 4. PANTRY `/api/pantry` 🔒

### GET `/api/pantry/items`
**Response `200`:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Куриная грудка",
      "quantity": 500.0,
      "unit": "г",
      "category": "Мясо",
      "expirationDate": "2026-04-15"  // null если не указано
    }
  ]
}
```

---

### POST `/api/pantry/items`
**Request:**
```json
{
  "name": "Рис",              // required
  "quantity": 1000.0,         // optional
  "unit": "г",                // optional
  "category": "Крупы",        // optional
  "expirationDate": "2026-12-01"  // optional, ISO date
}
```
**Response `200`:** → `PantryItemDto`

---

### POST `/api/pantry/items/bulk`
**Request:**
```json
{
  "items": [
    { "name": "Яйца", "quantity": 10, "unit": "шт", "category": "Молочное" },
    { "name": "Молоко", "quantity": 1, "unit": "л", "expirationDate": "2026-04-20" }
  ]
}
```
**Response `200`:** → `PantryItemDto[]`

---

### PATCH `/api/pantry/items/{id}`
> Все поля необязательные

**Request:**
```json
{
  "quantity": 800.0,
  "expirationDate": "2026-05-01"
}
```
**Response `200`:** → `PantryItemDto`  
**Errors:** `404` item not found

---

### DELETE `/api/pantry/items/{id}`
**Response `200`:**
```json
{ "success": true, "message": "Item deleted" }
```

---

### GET `/api/pantry/summary`
**Response `200`:**
```json
{
  "data": {
    "totalItems": 15,
    "expiringItems": 2,
    "categories": ["Мясо", "Крупы", "Овощи"],
    "itemsByCategory": {
      "Мясо": 3,
      "Крупы": 5,
      "Овощи": 7
    }
  }
}
```

---

## 5. RECIPES `/api/recipes` 🔒

### GET `/api/recipes`
**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `cuisine` | string | — | фильтр по кухне |
| `maxCalories` | int | — | макс. калорий |
| `page` | int | `0` | номер страницы |
| `size` | int | `20` | размер страницы |

**Response `200`:**
```json
{
  "data": {
    "content": [ ...RecipeDto[] ],
    "page": 0,
    "size": 20,
    "totalElements": 42,
    "totalPages": 3,
    "last": false
  }
}
```

**RecipeDto:**
```json
{
  "id": 1,
  "title": "Греческий салат",
  "description": "Свежий средиземноморский салат",
  "calories": 320,
  "protein": 12,
  "carbs": 18,
  "fat": 22,
  "cookTimeMinutes": 15,
  "cuisine": "Mediterranean",
  "imageUrl": "https://...",
  "mealType": "lunch",
  "favorite": false
}
```

---

### GET `/api/recipes/recommended`
**Response `200`:**
```json
{ "data": [ ...RecipeDto[] ] }  // max 10
```

---

### GET `/api/recipes/recent-generated`
**Response `200`:**
```json
{ "data": [ ...RecipeDto[] ] }  // max 10, AI-рецепты пользователя
```

---

### GET `/api/recipes/{id}`
**Response `200`:**
```json
{
  "data": {
    "id": 1,
    "title": "Греческий салат",
    "description": "...",
    "instructions": "1. Нарезать помидоры...",
    "calories": 320,
    "protein": 12,
    "carbs": 18,
    "fat": 22,
    "cookTimeMinutes": 15,
    "cuisine": "Mediterranean",
    "imageUrl": "https://...",
    "mealType": "lunch",
    "dietType": "MEDITERRANEAN",
    "favorite": false,
    "ingredients": [
      { "id": 1, "name": "Помидоры", "amount": "200", "unit": "г" },
      { "id": 2, "name": "Огурцы", "amount": "150", "unit": "г" },
      { "id": 3, "name": "Сыр фета", "amount": "80", "unit": "г" }
    ]
  }
}
```
**Errors:** `404` recipe not found

---

### POST `/api/recipes/generate`
> AI генерирует рецепт с учётом профиля пользователя

**Request:**
```json
{
  "mealType": "lunch",                    // optional: breakfast|lunch|dinner|snack
  "cuisine": "Mediterranean",             // optional
  "maxCalories": 600,                     // optional (default = dailyCalories / 3)
  "usePantry": true,                      // optional (использовать продукты из кладовой)
  "additionalNotes": "без молочного"      // optional, свободный текст
}
```
**Response `200`:** → `RecipeDetailDto`  
**Errors:** `500` AI generation failed

---

## 6. MEAL PLANS `/api/meal-plans` 🔒

### GET `/api/meal-plans/current`
**Response `200`:**
```json
{
  "data": {
    "id": 1,
    "weekStartDate": "2026-04-14",
    "weekEndDate": "2026-04-20",
    "status": "ACTIVE",
    "totalMeals": 21,
    "completedMeals": 5,
    "days": [
      {
        "id": 1,
        "date": "2026-04-14",
        "dayOfWeek": "MONDAY",
        "totalCalories": 1920,
        "meals": [
          {
            "id": 1,
            "mealType": "BREAKFAST",
            "recipeId": 10,
            "recipeTitle": "Овсяная каша с ягодами",
            "calories": 380,
            "completed": false
          },
          {
            "id": 2,
            "mealType": "LUNCH",
            "recipeId": 11,
            "recipeTitle": "Куриный суп",
            "calories": 450,
            "completed": true
          }
        ]
      }
    ]
  }
}
```
**Errors:** `404` no active meal plan

---

### POST `/api/meal-plans/generate`
> Создаёт новый план на неделю через AI. Предыдущий архивируется.

**Request:** (всё необязательно, можно передать `{}` или пустое тело)
```json
{
  "usePantry": true,
  "additionalNotes": "больше рыбы, без глютена"
}
```
**Response `200`:** → `MealPlanDto`

---

### GET `/api/meal-plans/{id}`
**Response `200`:** → `MealPlanDto`  
**Errors:** `404` plan not found or not yours

---

### POST `/api/meal-plans/{planId}/days/{day}/meals/{mealId}/complete`
> Отмечает приём пищи как выполненный

**Response `200`:**
```json
{
  "data": {
    "id": 2,
    "mealType": "LUNCH",
    "recipeId": 11,
    "recipeTitle": "Куриный суп",
    "calories": 450,
    "completed": true
  }
}
```

---

### GET `/api/meal-plans/{planId}/shopping-list`
**Response `200`:**
```json
{
  "data": [
    { "id": 1, "name": "Куриная грудка", "amount": "600", "unit": "г", "purchased": false },
    { "id": 2, "name": "Рис", "amount": "400", "unit": "г", "purchased": true }
  ]
}
```

---

## 7. AI ASSISTANT `/api/assistant` 🔒

### POST `/api/assistant/chat`
**Request:**
```json
{
  "message": "Сколько белка мне нужно при наборе мышц?"
}
```
**Response `200`:**
```json
{
  "data": {
    "message": "При наборе мышечной массы рекомендуется 1.6–2.2 г белка на кг веса...",
    "role": "assistant"
  }
}
```

---

### GET `/api/assistant/faq`
**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `category` | string | optional: nutrition \| diet \| recipes \| general |

**Response `200`:**
```json
{
  "data": [
    {
      "id": 1,
      "question": "Сколько воды нужно пить в день?",
      "answer": "Рекомендуется 30–35 мл на кг веса тела...",
      "category": "nutrition"
    }
  ]
}
```

---

## 8. DASHBOARD `/api/dashboard` 🔒

### GET `/api/dashboard`
**Response `200`:**
```json
{
  "data": {
    "userName": "Иван",
    "dailyCalorieTarget": 1920,
    "todayCaloriesConsumed": 830,
    "todayProtein": 0,
    "todayCarbs": 0,
    "todayFat": 0,
    "pantryItemsCount": 15,
    "expiringItemsCount": 2,
    "hasMealPlan": true,
    "mealPlanTotalMeals": 21,
    "mealPlanCompletedMeals": 5,
    "mealPlanProgressPercent": 23.8,
    "favoriteRecipesCount": 7,
    "onboardingCompleted": true,
    "bmi": 23.1,
    "bmiCategory": "Normal weight"
  }
}
```

---

## 9. REFERENCE `/api/reference` — публичные

### GET `/api/reference/allergies`
```json
{
  "data": [
    { "code": "GLUTEN", "name": "Gluten" },
    { "code": "DAIRY", "name": "Dairy" }
  ]
}
```

### GET `/api/reference/goals`
```json
{
  "data": [
    { "code": "LOSE_WEIGHT", "name": "Lose weight" },
    { "code": "MAINTAIN", "name": "Maintain weight" },
    { "code": "GAIN_MUSCLE", "name": "Gain muscle" },
    { "code": "GAIN_WEIGHT", "name": "Gain weight" }
  ]
}
```

### GET `/api/reference/activity-levels`
```json
{
  "data": [
    { "code": "SEDENTARY", "description": "Sedentary (little or no exercise)" },
    { "code": "LIGHTLY_ACTIVE", "description": "Lightly active (1-3 days/week)" },
    { "code": "MODERATELY_ACTIVE", "description": "Moderately active (3-5 days/week)" },
    { "code": "VERY_ACTIVE", "description": "Very active (6-7 days/week)" },
    { "code": "EXTRA_ACTIVE", "description": "Extra active (very hard exercise)" }
  ]
}
```

### GET `/api/reference/diet-types`
```json
{
  "data": [
    { "code": "NONE", "name": "No specific diet" },
    { "code": "VEGETARIAN", "name": "Vegetarian" },
    { "code": "VEGAN", "name": "Vegan" },
    { "code": "KETO", "name": "Keto" },
    { "code": "PALEO", "name": "Paleo" },
    { "code": "MEDITERRANEAN", "name": "Mediterranean" },
    { "code": "LOW_CARB", "name": "Low carb" },
    { "code": "HIGH_PROTEIN", "name": "High protein" },
    { "code": "GLUTEN_FREE", "name": "Gluten free" }
  ]
}
```

### GET `/api/reference/genders`
```json
{
  "data": [
    { "code": "MALE", "name": "Male" },
    { "code": "FEMALE", "name": "Female" }
  ]
}
```

---

### POST `/api/reference/calculate-calories` — публичный калькулятор
**Request:**
```json
{
  "gender": "MALE",                   // required
  "age": 25,                          // required, 10–120
  "weightKg": 75.0,                   // required, 20–500
  "heightCm": 180.0,                  // required, 50–300
  "activityLevel": "MODERATELY_ACTIVE",  // required
  "goal": "LOSE_WEIGHT"               // required
}
```
**Response `200`:**
```json
{
  "data": {
    "gender": "Male",
    "age": 25,
    "weightKg": 75.0,
    "heightCm": 180.0,
    "activityLevel": "Moderately active (3-5 days/week)",
    "goal": "Lose weight",
    "bmrMifflinStJeor": 1820,
    "bmrHarrisBenedict": 1851,
    "tdee": 2400,
    "dailyCalories": 1920,
    "proteinGrams": 150,
    "carbsGrams": 176,
    "fatGrams": 64,
    "proteinPercent": 31,
    "carbsPercent": 37,
    "fatPercent": 30,
    "bmi": 23.1,
    "bmiCategory": "Normal weight",
    "waterMl": 2970,
    "calorieExplanation": "Your BMR is 1820 kcal. With your activity level, your TDEE is 2400 kcal. Your target is 1920 kcal/day (20% caloric deficit applied for weight loss).",
    "proteinExplanation": "Recommended protein: 150g/day (2.0g per kg of body weight). This is optimized for your goal: Lose weight."
  }
}
```

---

## HTTP коды ошибок

| Код | Когда |
|-----|-------|
| `400` | Неверные данные / просроченный код |
| `401` | Не авторизован / неверный пароль |
| `403` | Нет доступа к ресурсу |
| `404` | Ресурс не найден |
| `409` | Конфликт (email уже занят) |
| `500` | Ошибка сервера / AI недоступен |

---

## Типичный флоу

```
1. Регистрация:   POST /api/auth/signup
2. Онбординг:     GET  /api/onboarding  →  PUT /api/onboarding/basic-info
                  →  PUT /api/onboarding/activity-goal
                  →  PUT /api/onboarding/preferences
3. Главная:       GET  /api/dashboard
4. Профиль:       GET  /api/users/me  +  GET /api/users/me/targets
5. Рецепты:       GET  /api/recipes?page=0&size=20
                  POST /api/recipes/generate
6. План питания:  POST /api/meal-plans/generate
                  GET  /api/meal-plans/current
                  POST /api/meal-plans/{id}/days/{day}/meals/{mealId}/complete
7. Кладовая:      GET  /api/pantry/items
8. AI чат:        POST /api/assistant/chat

Сброс пароля:
  POST /api/auth/forgot-password  →  email с 6-значным кодом
  POST /api/auth/verify-reset-code  →  проверка кода
  POST /api/auth/reset-password   →  новый пароль
```

