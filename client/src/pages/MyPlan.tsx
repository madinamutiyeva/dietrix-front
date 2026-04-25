import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../styles/myplan.css';
import NotificationBell from '../components/NotificationBell';
import type {
  UserProfileDto,
  UserTargetsDto,
  MealPlanDto,
  MealPlanMealDto,
  RecipeDetailDto,
  RecipeDto,
  MealType,
  MealPlanCalendarResponse,
} from '../api/contracts';
import {
  getProfile,
  getTargets,
  getAccessToken,
  clearTokens,
  getCurrentMealPlan,
  generateMealPlan,
  completeMeal,
  uncompleteMeal,
  replaceMealRecipe,
  addMealToPlan,
  deleteMealFromPlan,
  getRecipeById,
  getRecipes,
  // V12
  getMealPlanByDate,
  getMealPlanCalendar,
  duplicateYesterdayMealPlan,
} from '../api/client';

// ── helpers ──────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const MEAL_EMOJI: Record<string, string> = {
  BREAKFAST: '🍳',
  MAIN: '🍽️',
  SNACK: '🍎',
  DESSERT: '🍰',
};

const MEAL_TYPE_LABELS: Record<string, string> = {
  BREAKFAST: 'Breakfast',
  MAIN: 'Main course',
  SNACK: 'Snack',
  DESSERT: 'Dessert',
};

const MEAL_ORDER: MealType[] = ['BREAKFAST', 'MAIN', 'SNACK', 'DESSERT'];

const CUISINES = [
  'Italian', 'Japanese', 'Mexican', 'Indian', 'Korean', 'French',
  'Turkish', 'American', 'Kazakh', 'Russian', 'Thai', 'Chinese',
  'Georgian', 'Uzbek', 'Greek', 'Spanish', 'International',
] as const;

function sortMeals(meals: MealPlanMealDto[]): MealPlanMealDto[] {
  return [...meals].sort(
    (a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType),
  );
}

function formatPlanDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Local-time YYYY-MM-DD (avoids UTC shift bugs) */
function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local-time YYYY-MM */
function toLocalISOMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function todayLocalISO(): string {
  return toLocalISODate(new Date());
}

function isToday(iso: string): boolean {
  return iso === todayLocalISO();
}

// ── component ────────────────────────────────

export default function MyPlan() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [targets, setTargets] = useState<UserTargetsDto | null>(null);
  const [plan, setPlan] = useState<MealPlanDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // generate form
  const [cuisine, setCuisine] = useState('');
  const [notes, setNotes] = useState('');
  const [usePantry, setUsePantry] = useState(true);


  // completing a meal
  const [completingMealId, setCompletingMealId] = useState<number | null>(null);

  // recipe modal
  const [showRecipe, setShowRecipe] = useState(false);
  const [recipe, setRecipe] = useState<RecipeDetailDto | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);

  // replace-recipe modal
  const [replacingMeal, setReplacingMeal] = useState<MealPlanMealDto | null>(null);
  const [recipeList, setRecipeList] = useState<RecipeDto[]>([]);
  const [recipeListLoading, setRecipeListLoading] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');
  const [replacingId, setReplacingId] = useState<number | null>(null);

  // add-meal modal
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [addMealType, setAddMealType] = useState<MealType | ''>('');
  const [addCuisine, setAddCuisine] = useState('');
  const [addMaxCalories, setAddMaxCalories] = useState('');
  const [addMealList, setAddMealList] = useState<RecipeDto[]>([]);
  const [addMealLoading, setAddMealLoading] = useState(false);
  const [addMealSearch, setAddMealSearch] = useState('');
  const [addingMealId, setAddingMealId] = useState<number | null>(null);
  const [deletingMealId, setDeletingMealId] = useState<number | null>(null);
  const [mealToDelete, setMealToDelete] = useState<MealPlanMealDto | null>(null);

  // V12 — date navigation & calendar
  const [currentDate, setCurrentDate] = useState<string>(() => todayLocalISO());
  const [calendar, setCalendar] = useState<MealPlanCalendarResponse | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<string>(() => toLocalISOMonth(new Date()));
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      navigate('/sign-in', { replace: true });
      return;
    }
    loadData();
  }, []);

  // reload plan when navigating between dates
  useEffect(() => {
    if (!getAccessToken()) return;
    loadPlanForDate(currentDate);
  }, [currentDate]);

  // load calendar for current month on mount + when month changes (for yesterday-disabled check)
  useEffect(() => {
    if (!getAccessToken()) return;
    loadCalendar(toLocalISOMonth(new Date(currentDate + 'T00:00:00')));
  }, [currentDate.slice(0, 7)]);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [profileRes, targetsRes, planRes] = await Promise.allSettled([
        getProfile(),
        getTargets(),
        getCurrentMealPlan(),
      ]);

      if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
      if (targetsRes.status === 'fulfilled') setTargets(targetsRes.value.data);

      if (planRes.status === 'fulfilled') {
        const loaded = planRes.value.data;
        // Only show the plan if it's for today — fresh start each new day
        if (loaded && loaded.date === todayLocalISO()) {
          setPlan(loaded);
        } else {
          setPlan(null);
        }
      } else {
        setPlan(null);
      }
    } catch {
      // show what we can
    } finally {
      setLoading(false);
    }
  }

  async function loadPlanForDate(date: string) {
    try {
      const res = await getMealPlanByDate(date);
      const loaded = res.data;
      // safety: only show plan if its date actually matches the requested date
      setPlan(loaded && loaded.date === date ? loaded : null);
    } catch {
      setPlan(null);
    }
  }

  async function loadCalendar(month: string) {
    try {
      const res = await getMealPlanCalendar(month);
      setCalendar(res.data);
    } catch {
      setCalendar(null);
    }
  }


  function goToToday() {
    setCurrentDate(todayLocalISO());
  }

  async function handleDuplicateYesterday() {
    setDuplicating(true);
    setError('');
    try {
      const res = await duplicateYesterdayMealPlan();
      setPlan(res.data);
      goToToday();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No yesterday plan to duplicate');
    } finally {
      setDuplicating(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const req: Record<string, unknown> = { usePantry };
      if (cuisine.trim()) req.cuisine = cuisine.trim();
      if (notes.trim()) req.additionalNotes = notes.trim();

      const res = await generateMealPlan(req);
      setPlan(res.data);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        'Failed to generate meal plan. Please try again.',
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate() {
    if (!plan) return;

    const completedMeals = meals.filter((m) => m.completed);
    const uncompletedMeals = meals.filter((m) => !m.completed);

    // no meals at all (e.g. user deleted them) → just generate fresh
    if (meals.length === 0) {
      return handleGenerate();
    }

    // all completed → show notification
    if (uncompletedMeals.length === 0) {
      setError('All meals are already completed! Uncomplete the ones you want to regenerate.');
      return;
    }

    // no completed → normal full regenerate
    if (completedMeals.length === 0) {
      return handleGenerate();
    }

    // partial → regenerate and restore completed meals
    setGenerating(true);
    setError('');
    try {
      const req: Record<string, unknown> = { usePantry };
      if (cuisine.trim()) req.cuisine = cuisine.trim();
      if (notes.trim()) req.additionalNotes = notes.trim();

      const res = await generateMealPlan(req);
      const newPlan = res.data;
      const newMeals = [...(newPlan.meals ?? [])];

      // restore each completed meal into the new plan
      for (const oldMeal of completedMeals) {
        // find a generated meal of the same type to replace
        const matchIdx = newMeals.findIndex((m) => m.mealType === oldMeal.mealType && !m.completed);
        if (matchIdx >= 0) {
          try { await deleteMealFromPlan(newPlan.id, newMeals[matchIdx].id); } catch { /* ok */ }
          newMeals.splice(matchIdx, 1);
        }
        // add old recipe back and mark complete
        const addedRes = await addMealToPlan(newPlan.id, oldMeal.recipeId, oldMeal.mealType);
        const addedMeal = addedRes.data;
        try {
          await completeMeal(newPlan.id, addedMeal.id);
          addedMeal.completed = true;
        } catch { /* ok */ }
        newMeals.push(addedMeal);
      }

      setPlan({
        ...newPlan,
        meals: newMeals,
        totalMeals: newMeals.length,
        completedMeals: newMeals.filter((m) => m.completed).length,
        totalCalories: newMeals.reduce((sum, m) => sum + m.calories, 0),
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        'Failed to regenerate meal plan. Please try again.',
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggleMeal(meal: MealPlanMealDto) {
    if (!plan) return;
    setCompletingMealId(meal.id);
    try {
      if (meal.completed) {
        await uncompleteMeal(plan.id, meal.id);
        setPlan((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            completedMeals: Math.max(0, prev.completedMeals - 1),
            meals: (prev.meals ?? []).map((m) =>
              m.id === meal.id ? { ...m, completed: false } : m,
            ),
          };
        });
      } else {
        await completeMeal(plan.id, meal.id);
        setPlan((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            completedMeals: prev.completedMeals + 1,
            meals: (prev.meals ?? []).map((m) =>
              m.id === meal.id ? { ...m, completed: true } : m,
            ),
          };
        });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update meal status.');
    } finally {
      setCompletingMealId(null);
    }
  }


  async function handleViewRecipe(recipeId: number) {
    setShowRecipe(true);
    setRecipeLoading(true);
    setRecipe(null);
    try {
      const res = await getRecipeById(recipeId);
      setRecipe(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load recipe.');
      setShowRecipe(false);
    } finally {
      setRecipeLoading(false);
    }
  }

  async function handleOpenReplace(meal: MealPlanMealDto) {
    setReplacingMeal(meal);
    setRecipeSearch('');
    setRecipeListLoading(true);
    setRecipeList([]);
    try {
      const res = await getRecipes({ size: 50 });
      setRecipeList(res.data.content ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load recipes.');
      setReplacingMeal(null);
    } finally {
      setRecipeListLoading(false);
    }
  }

  async function handleReplace(newRecipeId: number) {
    if (!plan || !replacingMeal) return;
    setReplacingId(newRecipeId);
    try {
      const res = await replaceMealRecipe(plan.id, replacingMeal.id, newRecipeId);
      const updated = res.data;
      setPlan((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          meals: (prev.meals ?? []).map((m) =>
            m.id === replacingMeal.id ? updated : m,
          ),
        };
      });
      setReplacingMeal(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to replace recipe.');
    } finally {
      setReplacingId(null);
    }
  }

  async function handleOpenAddMeal() {
    setShowAddMeal(true);
    setAddMealSearch('');
    setAddMealType('');
    setAddCuisine('');
    setAddMaxCalories('');
    await fetchAddMealRecipes('', '', '');
  }

  async function fetchAddMealRecipes(mealType: string, cuisineFilter: string, maxCal: string) {
    setAddMealLoading(true);
    setAddMealList([]);
    try {
      const params: Record<string, unknown> = { size: 50 };
      if (mealType) params.mealType = mealType.toLowerCase();
      if (cuisineFilter) params.cuisine = cuisineFilter;
      const cal = parseInt(maxCal, 10);
      if (cal > 0) params.maxCalories = cal;
      const res = await getRecipes(params as any);
      setAddMealList(res.data.content ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load recipes.');
      setShowAddMeal(false);
    } finally {
      setAddMealLoading(false);
    }
  }

  function handleAddMealFilterChange(newMealType: MealType | '', newCuisine: string, newMaxCal?: string) {
    setAddMealType(newMealType);
    setAddCuisine(newCuisine);
    if (newMaxCal !== undefined) setAddMaxCalories(newMaxCal);
    fetchAddMealRecipes(newMealType, newCuisine, newMaxCal ?? addMaxCalories);
  }

  async function handleAddMeal(recipeId: number, recipe: RecipeDto) {
    if (!plan) return;
    setAddingMealId(recipeId);
    // determine meal type: use selected filter, or fallback to recipe's mealType
    const mealType = addMealType || recipe.mealType?.toUpperCase() || 'SNACK';
    try {
      const res = await addMealToPlan(plan.id, recipeId, mealType);
      const newMeal = res.data;
      setPlan((prev) => {
        if (!prev) return prev;
        const updatedMeals = [...(prev.meals ?? []), newMeal];
        return {
          ...prev,
          totalMeals: prev.totalMeals + 1,
          totalCalories: prev.totalCalories + newMeal.calories,
          meals: updatedMeals,
        };
      });
      setShowAddMeal(false);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to add meal.');
    } finally {
      setAddingMealId(null);
    }
  }

  async function handleDeleteMeal(meal: MealPlanMealDto) {
    // open the styled confirmation modal instead of window.confirm
    setMealToDelete(meal);
  }

  async function confirmDeleteMeal() {
    const meal = mealToDelete;
    if (!plan || !meal) return;
    setDeletingMealId(meal.id);
    try {
      await deleteMealFromPlan(plan.id, meal.id);
      setPlan((prev) => {
        if (!prev) return prev;
        const updatedMeals = (prev.meals ?? []).filter((m) => m.id !== meal.id);
        return {
          ...prev,
          totalMeals: Math.max(0, prev.totalMeals - 1),
          completedMeals: meal.completed
            ? Math.max(0, prev.completedMeals - 1)
            : prev.completedMeals,
          totalCalories: Math.max(0, prev.totalCalories - meal.calories),
          meals: updatedMeals,
        };
      });
      setMealToDelete(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to remove meal.');
    } finally {
      setDeletingMealId(null);
    }
  }

  function handleLogout() {
    clearTokens();
    navigate('/sign-in', { replace: true });
  }

  // ── derived data ──────────────────────────
  const meals = plan?.meals ?? [];
  const progressPercent = plan
    ? plan.totalMeals > 0
      ? Math.round((plan.completedMeals / plan.totalMeals) * 100)
      : 0
    : 0;

  // calorie tracking
  const dailyTarget = targets?.dailyCalories ?? 0;
  const planTotal = plan?.totalCalories ?? 0;
  const consumedCalories = meals
    .filter((m) => m.completed)
    .reduce((sum, m) => sum + m.calories, 0);
  const remainingCalories = dailyTarget - consumedCalories;

  // warnings (show only if difference >= 200 kcal)
  type Warning = { type: 'over' | 'under' | 'info'; icon: string; text: string };
  const warnings: Warning[] = [];

  if (dailyTarget > 0 && plan) {
    const diff = planTotal - dailyTarget;

    if (diff >= 200) {
      warnings.push({
        type: 'over',
        icon: '⚠️',
        text: `Your meal plan (${planTotal} kcal) exceeds your daily goal (${dailyTarget} kcal) by ${diff} kcal. Consider replacing a meal with a lighter option.`,
      });
    } else if (diff <= -200) {
      warnings.push({
        type: 'under',
        icon: '📉',
        text: `Your meal plan (${planTotal} kcal) is ${Math.abs(diff)} kcal below your daily goal (${dailyTarget} kcal). You may not be getting enough nutrition.`,
      });
    }

    if (consumedCalories > 0 && consumedCalories - dailyTarget >= 200) {
      warnings.push({
        type: 'over',
        icon: '🔴',
        text: `You've already consumed ${consumedCalories} kcal — that's ${consumedCalories - dailyTarget} kcal over your ${dailyTarget} kcal goal.`,
      });
    }
  }

  // ── skeleton / loading ────────────────────
  if (loading) {
    return (
      <>
        <div className="bg-orb"><div className="orb orb-1" /><div className="orb orb-2" /></div>
        <div className="myplan-page">
          <div className="myplan-container">
            <nav className="navbar">
              <Link to="/home" className="logo"><i className="fas fa-leaf" /><span className="logo-text">DIETRIX</span></Link>
              <div style={{ flex: 1 }} />
              <div className="skeleton skeleton-text" style={{ width: 120 }} />
            </nav>
            <div style={{ marginTop: 40 }}>
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-text" style={{ width: '40%' }} />
            </div>
            <div className="skeleton skeleton-card" style={{ marginTop: 30 }} />
            <div className="meals-grid" style={{ marginTop: 30 }}>
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-card" />
              <div className="skeleton skeleton-card" />
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── main render ───────────────────────────
  return (
    <>
      <div className="bg-orb"><div className="orb orb-1" /><div className="orb orb-2" /></div>

      <div className="myplan-page">
        <div className="myplan-container">

          {/* ═══ Navbar ═══════════════════════ */}
          <nav className="navbar">
            <Link to="/home" className="logo">
              <i className="fas fa-leaf" />
              <span className="logo-text">DIETRIX</span>
            </Link>

            <div className="nav-links">
              <Link to="/home">Home</Link>
              <Link to="/my-plan" className="active">My Plan</Link>
              <Link to="/pantry">Pantry</Link>
              <Link to="/ai-generate">AI Generator</Link>
              <Link to="/chat">Chat</Link>
            </div>

            <div className="user-menu">
              <NotificationBell />


              <Link to="/settings" className="logout-btn" title="Settings" style={{ textDecoration: 'none' }}>
                <i className="fas fa-gear" />
              </Link>
              <button className="logout-btn" onClick={handleLogout} title="Sign out">
                <i className="fas fa-sign-out-alt" />
              </button>

              <Link to="/profile" className="user-avatar" title="My Profile">
                {profile?.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt="Avatar"
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <span>{profile ? getInitials(profile.name) : '?'}</span>
                )}
              </Link>
            </div>
          </nav>

          {/* ═══ Page header ═════════════════ */}
          <div className="page-header">
            <h1 className="page-title">
              {plan ? "Meal Plan" : 'My Meal Plan'}
            </h1>
            {plan ? (
              <p className="page-subtitle">
                {isToday(plan.date) ? '📅 Today — ' : ''}
                {formatPlanDate(plan.date)}
              </p>
            ) : (
              <p className="page-subtitle">Generate a daily meal plan to get started</p>
            )}
          </div>

          {/* ═══ Date / History bar (V12) ═════ */}
          <div className="date-nav">
            <div className="date-nav-current">
              <i className="fas fa-calendar-day" />
              <span>{formatPlanDate(currentDate)}</span>
              {!isToday(currentDate) && (
                <span className="date-nav-archived">
                  <i className="fas fa-clock-rotate-left" /> archived
                </span>
              )}
            </div>

            {!isToday(currentDate) && (
              <button className="date-nav-btn date-nav-today" onClick={goToToday}>
                <i className="fas fa-arrow-left" /> Back to today
              </button>
            )}

            <button
              className="date-nav-btn date-nav-calendar"
              onClick={() => {
                setShowCalendar(true);
                loadCalendar(calendarMonth);
              }}
              title="View meal plan history"
            >
              <i className="fas fa-list" /> History
            </button>

            {!plan && isToday(currentDate) && (
              <button
                className="date-nav-btn date-nav-duplicate"
                onClick={handleDuplicateYesterday}
                disabled={duplicating}
                title="Copy yesterday's plan to today"
              >
                <i className="fas fa-copy" />
                {duplicating ? ' Copying…' : ' Duplicate yesterday'}
              </button>
            )}
          </div>

          {/* ═══ Error ═══════════════════════ */}
          {error && (
            <div className="error-banner">
              <i className="fas fa-exclamation-circle" />
              <span>{error}</span>
            </div>
          )}

          {/* ═══ Generating state ════════════ */}
          {generating && (
            <div className="empty-plan">
              <div className="generating-overlay">
                <div className="spinner" />
                <p>AI is generating your personalized meal plan…<br />This usually takes 5–10 seconds.</p>
              </div>
            </div>
          )}

          {/* ═══ No plan — generate form ═════ */}
          {!generating && !plan && (
            <div className="empty-plan">
              <i className="fas fa-calendar-plus" />
              <h3>No active meal plan</h3>
              <p>
                Let our AI create a personalized daily plan based on your profile,
                preferences, and pantry.
              </p>

              <div className="generate-form">
                <div className="form-row">
                  <div className="form-field">
                    <label htmlFor="cuisine">
                      <i className="fas fa-earth-americas" /> Cuisine preference
                    </label>
                    <select
                      id="cuisine"
                      value={cuisine}
                      onChange={(e) => setCuisine(e.target.value)}
                    >
                      <option value="">Any cuisine</option>
                      {CUISINES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label htmlFor="notes">
                      <i className="fas fa-comment" /> Additional notes
                    </label>
                    <input
                      id="notes"
                      type="text"
                      placeholder="e.g. something light, high protein…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={usePantry}
                    onChange={(e) => setUsePantry(e.target.checked)}
                  />
                  <span>Use my pantry items</span>
                </label>
              </div>

              <button className="btn-plan btn-plan-primary" onClick={handleGenerate}>
                <i className="fas fa-wand-magic-sparkles" />
                Generate Today's Plan
              </button>
            </div>
          )}

          {/* ═══ Plan exists ═════════════════ */}
          {!generating && plan && (
            <>
              {/* ── Progress ── */}
              <div className="plan-progress">
                <div className="progress-info">
                  <span>
                    <strong>{plan.completedMeals}</strong> of{' '}
                    <strong>{plan.totalMeals}</strong> meals completed
                  </span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* ── Calorie warnings ── */}
              {warnings.map((w, i) => (
                <div key={i} className={`calorie-warning warning-${w.type}`}>
                  <span className="warning-icon">{w.icon}</span>
                  <span>{w.text}</span>
                </div>
              ))}

              {/* ── Calorie tracker ── */}
              {dailyTarget > 0 && (
                <div className="calorie-tracker">
                  <div className="tracker-row">
                    <div className="tracker-item">
                      <span className="tracker-label">Daily goal</span>
                      <span className="tracker-value">{dailyTarget}</span>
                      <span className="tracker-unit">kcal</span>
                    </div>
                    <div className="tracker-divider" />
                    <div className="tracker-item">
                      <span className="tracker-label">Plan total</span>
                      <span className={`tracker-value${planTotal > dailyTarget * 1.1 ? ' tracker-over' : ''}`}>
                        {planTotal}
                      </span>
                      <span className="tracker-unit">kcal</span>
                    </div>
                    <div className="tracker-divider" />
                    <div className="tracker-item">
                      <span className="tracker-label">Consumed</span>
                      <span className={`tracker-value${consumedCalories > dailyTarget ? ' tracker-over' : ' tracker-ok'}`}>
                        {consumedCalories}
                      </span>
                      <span className="tracker-unit">kcal</span>
                    </div>
                    <div className="tracker-divider" />
                    <div className="tracker-item">
                      <span className="tracker-label">Remaining</span>
                      <span className={`tracker-value${remainingCalories < 0 ? ' tracker-over' : ''}`}>
                        {remainingCalories}
                      </span>
                      <span className="tracker-unit">kcal</span>
                    </div>
                  </div>
                  <div className="tracker-bar-track">
                    <div
                      className={`tracker-bar-fill${consumedCalories > dailyTarget ? ' tracker-bar-over' : ''}`}
                      style={{ width: `${Math.min(100, dailyTarget > 0 ? (consumedCalories / dailyTarget) * 100 : 0)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* ── Daily calories banner (fallback if no targets) ── */}
              {!dailyTarget && (
                <div className="daily-calories-banner">
                  <i className="fas fa-fire" />
                  <span>
                    Daily total: <strong>{plan.totalCalories} kcal</strong>
                    {' · '}
                    {meals.filter((m) => m.completed).length} of{' '}
                    {meals.length} meals done
                  </span>
                </div>
              )}

              {/* ── Meals grid ── */}
              <div className="meals-grid">
                {sortMeals(meals).map((meal) => (
                  <div
                    key={meal.id}
                    className={`meal-card${meal.completed ? ' completed' : ''}${
                      meal.mealType === 'SNACK' ? ' snack-card' : ''
                    }`}
                  >
                    <span className="meal-type-badge">
                      {MEAL_EMOJI[meal.mealType] || '🍽️'}{' '}
                      {MEAL_TYPE_LABELS[meal.mealType] || meal.mealType}
                    </span>

                    <h3 className="meal-name">{meal.recipeTitle}</h3>

                    <div className="meal-meta">
                      <span className="meta-item">
                        <i className="fas fa-fire" /> {meal.calories} kcal
                      </span>
                    </div>

                    <div className="meal-actions">
                      <button
                        className={`meal-checkbox${meal.completed ? ' checked' : ''}`}
                        onClick={() => handleToggleMeal(meal)}
                        disabled={completingMealId === meal.id}
                        title={meal.completed ? 'Mark as not done' : 'Mark as done'}
                      >
                        <i className="fas fa-check" />
                      </button>

                      <div className="meal-btns-right">
                        <button
                          className="btn-replace"
                          onClick={() => handleOpenReplace(meal)}
                          title="Replace recipe"
                        >
                          <i className="fas fa-arrows-rotate" />
                        </button>
                        <button
                          className="btn-delete"
                          onClick={() => handleDeleteMeal(meal)}
                          disabled={deletingMealId === meal.id}
                          title="Remove from plan"
                        >
                          <i className="fas fa-trash-can" />
                        </button>
                        <button
                          className="btn-recipe"
                          onClick={() => handleViewRecipe(meal.recipeId)}
                        >
                          View recipe
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Action buttons ── */}
              <div className="plan-actions">

                <button
                  className="btn-plan btn-plan-outline"
                  onClick={handleOpenAddMeal}
                >
                  <i className="fas fa-plus-circle" />
                  Add meal
                </button>

                <button
                  className="btn-plan btn-plan-primary"
                  onClick={handleRegenerate}
                  disabled={generating}
                >
                  <i className="fas fa-arrows-rotate" />
                  Regenerate plan
                </button>
              </div>
            </>
          )}
        </div>
      </div>


      {/* ═══ Recipe detail modal ═════════════ */}
      {showRecipe && (
        <div className="modal-overlay" onClick={() => setShowRecipe(false)}>
          <div className="modal-content modal-recipe" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{recipeLoading ? 'Loading…' : recipe?.title ?? 'Recipe'}</h2>
              <button className="modal-close" onClick={() => setShowRecipe(false)}>
                <i className="fas fa-times" />
              </button>
            </div>

            {recipeLoading ? (
              <div className="generating-overlay" style={{ padding: '30px 0' }}>
                <div className="spinner" />
                <p>Loading recipe…</p>
              </div>
            ) : recipe ? (
              <div className="recipe-detail">
                {/* description */}
                {recipe.description && (
                  <p className="recipe-detail-desc">{recipe.description}</p>
                )}

                {/* macro badges */}
                <div className="recipe-macros">
                  <span className="macro-badge macro-cal">
                    <i className="fas fa-fire" /> {recipe.calories} kcal
                  </span>
                  <span className="macro-badge macro-p">
                    <i className="fas fa-drumstick-bite" /> {recipe.protein}g protein
                  </span>
                  <span className="macro-badge macro-c">
                    <i className="fas fa-wheat-awn" /> {recipe.carbs}g carbs
                  </span>
                  <span className="macro-badge macro-f">
                    <i className="fas fa-droplet" /> {recipe.fat}g fat
                  </span>
                  {recipe.cookTimeMinutes > 0 && (
                    <span className="macro-badge">
                      <i className="fas fa-clock" /> {recipe.cookTimeMinutes} min
                    </span>
                  )}
                  {recipe.cuisine && (
                    <span className="macro-badge">
                      <i className="fas fa-earth-americas" /> {recipe.cuisine}
                    </span>
                  )}
                </div>

                {/* ingredients */}
                {(recipe.ingredients ?? []).length > 0 && (
                  <div className="recipe-section">
                    <h3><i className="fas fa-list" /> Ingredients</h3>
                    <ul className="recipe-ingredients">
                      {recipe.ingredients.map((ing) => (
                        <li key={ing.id}>
                          <span className="ing-name">{ing.name}</span>
                          <span className="ing-amount">{ing.amount} {ing.unit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* instructions */}
                {recipe.instructions && (
                  <div className="recipe-section">
                    <h3><i className="fas fa-utensils" /> Instructions</h3>
                    <div className="recipe-instructions">
                      {recipe.instructions.split('\n').map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--text-soft)', padding: 20 }}>
                Recipe not found.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ═══ Replace recipe modal ════════════ */}
      {replacingMeal && (
        <div className="modal-overlay" onClick={() => setReplacingMeal(null)}>
          <div className="modal-content modal-replace" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                🔄 Replace{' '}
                {MEAL_TYPE_LABELS[replacingMeal.mealType] || replacingMeal.mealType}
              </h2>
              <button className="modal-close" onClick={() => setReplacingMeal(null)}>
                <i className="fas fa-times" />
              </button>
            </div>

            <p className="replace-current">
              Current: <strong>{replacingMeal.recipeTitle}</strong> ({replacingMeal.calories} kcal)
            </p>

            <div className="replace-search">
              <i className="fas fa-search" />
              <input
                type="text"
                placeholder="Search recipes…"
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                autoFocus
              />
            </div>

            {recipeListLoading ? (
              <div className="generating-overlay" style={{ padding: '30px 0' }}>
                <div className="spinner" />
                <p>Loading recipes…</p>
              </div>
            ) : (
              <ul className="replace-list">
                {recipeList
                  .filter((r) =>
                    r.title.toLowerCase().includes(recipeSearch.toLowerCase()),
                  )
                  .map((r) => (
                    <li key={r.id} className="replace-item">
                      <div className="replace-item-info">
                        <span className="replace-item-title">{r.title}</span>
                        <span className="replace-item-meta">
                          {r.calories} kcal · {r.cookTimeMinutes} min
                          {r.cuisine ? ` · ${r.cuisine}` : ''}
                        </span>
                      </div>
                      <button
                        className="btn-select"
                        onClick={() => handleReplace(r.id)}
                        disabled={replacingId === r.id}
                      >
                        {replacingId === r.id ? (
                          <i className="fas fa-spinner fa-spin" />
                        ) : (
                          'Select'
                        )}
                      </button>
                    </li>
                  ))}
                {recipeList.filter((r) =>
                  r.title.toLowerCase().includes(recipeSearch.toLowerCase()),
                ).length === 0 && !recipeListLoading && (
                  <li className="replace-empty">No recipes found</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ═══ Add meal modal ═════════════════ */}
      {showAddMeal && (
        <div className="modal-overlay" onClick={() => setShowAddMeal(false)}>
          <div className="modal-content modal-replace" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Add Meal</h2>
              <button className="modal-close" onClick={() => setShowAddMeal(false)}>
                <i className="fas fa-times" />
              </button>
            </div>

            {/* ── Filters ── */}
            <div className="add-meal-filters">
              <div className="filter-pills">
                <button
                  className={`filter-pill${addMealType === '' ? ' active' : ''}`}
                  onClick={() => handleAddMealFilterChange('', addCuisine)}
                >
                  All
                </button>
                {MEAL_ORDER.map((mt) => (
                  <button
                    key={mt}
                    className={`filter-pill${addMealType === mt ? ' active' : ''}`}
                    onClick={() => handleAddMealFilterChange(mt, addCuisine)}
                  >
                    {MEAL_EMOJI[mt]} {MEAL_TYPE_LABELS[mt]}
                  </button>
                ))}
              </div>

              <div className="filter-cuisine">
                <select
                  value={addCuisine}
                  onChange={(e) => handleAddMealFilterChange(addMealType, e.target.value)}
                >
                  <option value="">All cuisines</option>
                  {CUISINES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="filter-row">
                <div className="filter-calories">
                  <i className="fas fa-fire" />
                  <input
                    type="number"
                    placeholder="Max kcal"
                    value={addMaxCalories}
                    min={0}
                    onChange={(e) => {
                      setAddMaxCalories(e.target.value);
                    }}
                    onBlur={() => handleAddMealFilterChange(addMealType, addCuisine, addMaxCalories)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddMealFilterChange(addMealType, addCuisine, addMaxCalories);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="replace-search">
              <i className="fas fa-search" />
              <input
                type="text"
                placeholder="Search recipes…"
                value={addMealSearch}
                onChange={(e) => setAddMealSearch(e.target.value)}
              />
            </div>

            {addMealLoading ? (
              <div className="generating-overlay" style={{ padding: '30px 0' }}>
                <div className="spinner" />
                <p>Loading recipes…</p>
              </div>
            ) : (
              <ul className="replace-list">
                {addMealList
                  .filter((r) =>
                    r.title.toLowerCase().includes(addMealSearch.toLowerCase()),
                  )
                  .map((r) => (
                    <li key={r.id} className="replace-item">
                      <div className="replace-item-info">
                        <span className="replace-item-title">{r.title}</span>
                        <span className="replace-item-meta">
                          {r.calories} kcal · {r.cookTimeMinutes} min
                          {r.cuisine ? ` · ${r.cuisine}` : ''}
                        </span>
                      </div>
                      <button
                        className="btn-select"
                        onClick={() => handleAddMeal(r.id, r)}
                        disabled={addingMealId === r.id}
                      >
                        {addingMealId === r.id ? (
                          <i className="fas fa-spinner fa-spin" />
                        ) : (
                          'Add'
                        )}
                      </button>
                    </li>
                  ))}
                {addMealList.filter((r) =>
                  r.title.toLowerCase().includes(addMealSearch.toLowerCase()),
                ).length === 0 && !addMealLoading && (
                  <li className="replace-empty">No recipes found</li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ═══ Delete-meal confirmation modal ═══ */}
      {mealToDelete && (
        <div className="modal-overlay" onClick={() => deletingMealId == null && setMealToDelete(null)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">
              <i className="fas fa-trash" />
            </div>
            <h2 className="confirm-title">Remove meal?</h2>
            <p className="confirm-message">
              Are you sure you want to remove <strong>"{mealToDelete.recipeTitle}"</strong> from today's plan?
              <br />
              <small style={{ color: 'var(--text-soft)' }}>This action cannot be undone.</small>
            </p>
            <div className="confirm-actions">
              <button
                className="confirm-btn confirm-btn-cancel"
                onClick={() => setMealToDelete(null)}
                disabled={deletingMealId != null}
              >
                Cancel
              </button>
              <button
                className="confirm-btn confirm-btn-danger"
                onClick={confirmDeleteMeal}
                disabled={deletingMealId != null}
              >
                {deletingMealId != null ? (
                  <><i className="fas fa-spinner fa-spin" /> Removing…</>
                ) : (
                  <><i className="fas fa-trash" /> Remove</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ History table modal (V12) ═══════ */}
      {showCalendar && (
        <div className="cal-overlay" onClick={() => setShowCalendar(false)}>
          <div className="hist-modal" onClick={(e) => e.stopPropagation()}>
            <button className="cal-close" onClick={() => setShowCalendar(false)} aria-label="Close">
              <i className="fas fa-times" />
            </button>

            <div className="hist-header">
              <h2 className="hist-title">
                <i className="fas fa-clock-rotate-left" /> Meal plan history
              </h2>
              <div className="hist-month-switch">
                <button
                  className="cal-month-btn"
                  onClick={() => {
                    const d = new Date(calendarMonth + '-01');
                    d.setMonth(d.getMonth() - 1);
                    const m = toLocalISOMonth(d);
                    setCalendarMonth(m);
                    loadCalendar(m);
                  }}
                  title="Previous month"
                >
                  <i className="fas fa-chevron-left" />
                </button>
                <span className="hist-month-label">
                  {new Date(calendarMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  className="cal-month-btn"
                  onClick={() => {
                    const d = new Date(calendarMonth + '-01');
                    d.setMonth(d.getMonth() + 1);
                    const m = toLocalISOMonth(d);
                    setCalendarMonth(m);
                    loadCalendar(m);
                  }}
                  title="Next month"
                >
                  <i className="fas fa-chevron-right" />
                </button>
              </div>
            </div>

            {calendar?.streakDays != null && calendar.streakDays > 0 && (
              <div className="cal-streak">
                🔥 Current streak: <strong>{calendar.streakDays}</strong> {calendar.streakDays === 1 ? 'day' : 'days'}
              </div>
            )}

            {(() => {
              const today = todayLocalISO();
              // only past days + today (no future), with a plan, sorted desc
              const rows = (calendar?.days ?? [])
                .filter((d) => d.date <= today && d.status !== 'EMPTY')
                .sort((a, b) => b.date.localeCompare(a.date));

              if (rows.length === 0) {
                return (
                  <div className="hist-empty">
                    <i className="fas fa-inbox" />
                    <p>No meal plans for this month yet.</p>
                  </div>
                );
              }

              return (
                <div className="hist-table-wrapper">
                  <table className="hist-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Progress</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((d) => {
                        const isCurr = d.date === currentDate;
                        const isToday_ = d.date === today;
                        const total = d.totalMeals ?? 0;
                        const done = d.completedMeals ?? 0;
                        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                        const statusLabel = ({
                          COMPLETED: 'Completed',
                          PARTIAL:   'Partial',
                          MISSED:    'Missed',
                          EMPTY:     'No plan',
                        } as const)[d.status];
                        return (
                          <tr key={d.date} className={isCurr ? 'hist-row-active' : ''}>
                            <td>
                              <div className="hist-date">
                                <strong>{new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}</strong>
                                <small>{new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}{isToday_ ? ' · Today' : ''}</small>
                              </div>
                            </td>
                            <td>
                              <span className={`hist-status hist-status-${d.status.toLowerCase()}`}>
                                {d.emoji} {statusLabel}
                              </span>
                            </td>
                            <td>
                              <div className="hist-progress-cell">
                                <div className="hist-progress-bar">
                                  <div className="hist-progress-fill" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="hist-progress-text">{done}/{total}</span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                className="hist-view-btn"
                                onClick={() => {
                                  setCurrentDate(d.date);
                                  setShowCalendar(false);
                                }}
                                disabled={isCurr}
                              >
                                {isCurr ? 'Viewing' : (<>View <i className="fas fa-arrow-right" /></>)}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );
}

