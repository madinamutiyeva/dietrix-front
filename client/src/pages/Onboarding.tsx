import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/auth.css';
import '../styles/onboarding.css';
import type { Gender, Goal, ActivityLevel, DietType, Allergy } from '../api/contracts';
import { saveBasicInfo, saveActivityGoal, savePreferences } from '../api/client';
import axios from 'axios';

type Step = 1 | 2 | 3;

// ── Label maps ───────────────────────────────

const GOAL_OPTIONS: { value: Goal; icon: string; label: string; desc: string }[] = [
  { value: 'LOSE_WEIGHT',  icon: 'fas fa-arrow-down',     label: 'Lose Weight',    desc: 'Burn fat & get lean' },
  { value: 'MAINTAIN',     icon: 'fas fa-equals',         label: 'Maintain',       desc: 'Keep current weight' },
  { value: 'GAIN_MUSCLE',  icon: 'fas fa-dumbbell',       label: 'Gain Muscle',    desc: 'Build strength' },
  { value: 'GAIN_WEIGHT',  icon: 'fas fa-arrow-up',       label: 'Gain Weight',    desc: 'Healthy weight gain' },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; desc: string }[] = [
  { value: 'SEDENTARY',          label: 'Sedentary',          desc: 'Little or no exercise' },
  { value: 'LIGHTLY_ACTIVE',     label: 'Lightly Active',     desc: '1–3 days / week' },
  { value: 'MODERATELY_ACTIVE',  label: 'Moderately Active',  desc: '3–5 days / week' },
  { value: 'VERY_ACTIVE',        label: 'Very Active',        desc: '6–7 days / week' },
  { value: 'EXTRA_ACTIVE',       label: 'Extra Active',       desc: 'Very hard exercise' },
];

const DIET_OPTIONS: { value: DietType; label: string }[] = [
  { value: 'NONE',          label: 'No specific diet' },
  { value: 'VEGETARIAN',    label: 'Vegetarian' },
  { value: 'VEGAN',         label: 'Vegan' },
  { value: 'KETO',          label: 'Keto' },
  { value: 'PALEO',         label: 'Paleo' },
  { value: 'MEDITERRANEAN', label: 'Mediterranean' },
  { value: 'LOW_CARB',      label: 'Low Carb' },
  { value: 'HIGH_PROTEIN',  label: 'High Protein' },
  { value: 'GLUTEN_FREE',   label: 'Gluten Free' },
];

const ALLERGY_OPTIONS: { value: Allergy; label: string }[] = [
  { value: 'GLUTEN',    label: 'Gluten' },
  { value: 'DAIRY',     label: 'Dairy' },
  { value: 'EGGS',      label: 'Eggs' },
  { value: 'NUTS',      label: 'Nuts' },
  { value: 'PEANUTS',   label: 'Peanuts' },
  { value: 'SOY',       label: 'Soy' },
  { value: 'FISH',      label: 'Fish' },
  { value: 'SHELLFISH', label: 'Shellfish' },
  { value: 'WHEAT',     label: 'Wheat' },
  { value: 'SESAME',    label: 'Sesame' },
  { value: 'SULFITES',  label: 'Sulfites' },
  { value: 'LACTOSE',   label: 'Lactose' },
  { value: 'FRUCTOSE',  label: 'Fructose' },
];

// ── Component ────────────────────────────────

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep]               = useState<Step>(1);
  const [loading, setLoading]         = useState(false);
  const [serverError, setServerError] = useState('');

  // Step 1 state
  const [gender, setGender]     = useState<Gender | ''>('');
  const [age, setAge]           = useState('');
  const [height, setHeight]     = useState('');
  const [weight, setWeight]     = useState('');

  // Step 2 state
  const [activity, setActivity] = useState<ActivityLevel | ''>('');
  const [goal, setGoal]         = useState<Goal | ''>('');

  // Step 3 state
  const [dietType, setDietType]       = useState<DietType>('NONE');
  const [allergies, setAllergies]     = useState<Allergy[]>([]);
  const [likedInput, setLikedInput]   = useState('');
  const [liked, setLiked]             = useState<string[]>([]);
  const [dislikedInput, setDislikedInput] = useState('');
  const [disliked, setDisliked]       = useState<string[]>([]);

  // ── Validation helpers ─────────────────────
  const step1Valid = gender && age && height && weight
    && Number(age) >= 10 && Number(age) <= 120
    && Number(height) >= 50 && Number(height) <= 300
    && Number(weight) >= 20 && Number(weight) <= 500;

  const step2Valid = activity && goal;

  // ── Handlers ───────────────────────────────

  const handleStep1 = async () => {
    if (!step1Valid) return;
    setLoading(true);
    setServerError('');
    try {
      await saveBasicInfo({
        gender: gender as Gender,
        age: Number(age),
        heightCm: Number(height),
        weightKg: Number(weight),
      });
      setStep(2);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setServerError(err.response.data.message);
      } else {
        setServerError('Failed to save. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async () => {
    if (!step2Valid) return;
    setLoading(true);
    setServerError('');
    try {
      await saveActivityGoal({
        activityLevel: activity as ActivityLevel,
        goal: goal as Goal,
      });
      setStep(3);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setServerError(err.response.data.message);
      } else {
        setServerError('Failed to save. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async () => {
    setLoading(true);
    setServerError('');
    try {
      await savePreferences({
        dietType,
        allergies: allergies.length > 0 ? allergies : undefined,
        likedFoods: liked.length > 0 ? liked : undefined,
        dislikedFoods: disliked.length > 0 ? disliked : undefined,
      });
      navigate('/dashboard');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setServerError(err.response.data.message);
      } else {
        setServerError('Failed to save. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleAllergy = (a: Allergy) => {
    setAllergies((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  };

  const addTag = (input: string, setInput: (v: string) => void, list: string[], setList: (v: string[]) => void) => {
    const val = input.trim();
    if (val && !list.includes(val)) {
      setList([...list, val]);
    }
    setInput('');
  };

  const removeTag = (tag: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.filter((t) => t !== tag));
  };

  // ── Render ─────────────────────────────────

  const STEP_TITLES: Record<Step, { title: string; subtitle: string }> = {
    1: { title: 'About You',           subtitle: 'Tell us a bit about yourself' },
    2: { title: 'Activity & Goal',     subtitle: 'Help us personalize your plan' },
    3: { title: 'Food Preferences',    subtitle: 'Almost done! Customize your diet' },
  };

  return (
    <>
      <div className="bg-orb">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      <div className="auth-container" style={{ maxWidth: 540 }}>
        <div className="auth-card">

          {/* Logo */}
          <div className="logo">
            <i className="fas fa-leaf" />
            <span className="logo-text">DIETRIX</span>
          </div>

          {/* Step indicator */}
          <div className="step-indicator">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`step-dot${n <= step ? ' active' : ''}`} />
            ))}
          </div>
          <p className="step-label">Step {step} of 3</p>

          <h1 className="auth-title">{STEP_TITLES[step].title}</h1>
          <p className="auth-subtitle">{STEP_TITLES[step].subtitle}</p>

          {/* Error */}
          {serverError && (
            <div className="alert alert-error">
              <i className="fas fa-exclamation-circle" />
              {serverError}
            </div>
          )}

          {/* ═══════ STEP 1: Basic Info ═══════ */}
          {step === 1 && (
            <div className="ob-section">
              {/* Gender */}
              <label className="form-label">Gender</label>
              <div className="ob-gender-row">
                <button
                  type="button"
                  className={`ob-gender-btn${gender === 'MALE' ? ' selected' : ''}`}
                  onClick={() => setGender('MALE')}
                >
                  <i className="fas fa-mars" />
                  Male
                </button>
                <button
                  type="button"
                  className={`ob-gender-btn${gender === 'FEMALE' ? ' selected' : ''}`}
                  onClick={() => setGender('FEMALE')}
                >
                  <i className="fas fa-venus" />
                  Female
                </button>
              </div>

              {/* Age */}
              <div className="form-group">
                <label className="form-label" htmlFor="age">Age</label>
                <div className="input-wrapper">
                  <i className="fas fa-calendar input-icon" />
                  <input
                    id="age"
                    type="number"
                    min={10} max={120}
                    placeholder="e.g. 25"
                    className="form-input"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>
              </div>

              {/* Height & Weight */}
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="height">Height (cm)</label>
                  <div className="input-wrapper">
                    <i className="fas fa-ruler-vertical input-icon" />
                    <input
                      id="height"
                      type="number"
                      min={50} max={300}
                      placeholder="e.g. 175"
                      className="form-input"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="weight">Weight (kg)</label>
                  <div className="input-wrapper">
                    <i className="fas fa-weight-scale input-icon" />
                    <input
                      id="weight"
                      type="number"
                      min={20} max={500}
                      placeholder="e.g. 70"
                      className="form-input"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                disabled={!step1Valid || loading}
                onClick={handleStep1}
              >
                {loading ? (<><span className="spinner" /> Saving…</>) : (<>Continue <i className="fas fa-arrow-right" /></>)}
              </button>
            </div>
          )}

          {/* ═══════ STEP 2: Activity & Goal ═══════ */}
          {step === 2 && (
            <div className="ob-section">
              {/* Activity Level */}
              <label className="form-label">Activity Level</label>
              <div className="ob-option-list">
                {ACTIVITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`ob-option-btn${activity === opt.value ? ' selected' : ''}`}
                    onClick={() => setActivity(opt.value)}
                  >
                    <span className="ob-option-label">{opt.label}</span>
                    <span className="ob-option-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>

              {/* Goal */}
              <label className="form-label" style={{ marginTop: 20 }}>Goal</label>
              <div className="ob-goal-grid">
                {GOAL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`ob-goal-btn${goal === opt.value ? ' selected' : ''}`}
                    onClick={() => setGoal(opt.value)}
                  >
                    <i className={opt.icon} />
                    <span className="ob-goal-label">{opt.label}</span>
                    <span className="ob-goal-desc">{opt.desc}</span>
                  </button>
                ))}
              </div>

              <div className="ob-nav-row">
                <button type="button" className="btn ob-back-btn" onClick={() => setStep(1)}>
                  <i className="fas fa-arrow-left" /> Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary ob-next-btn"
                  disabled={!step2Valid || loading}
                  onClick={handleStep2}
                >
                  {loading ? (<><span className="spinner" /> Saving…</>) : (<>Continue <i className="fas fa-arrow-right" /></>)}
                </button>
              </div>
            </div>
          )}

          {/* ═══════ STEP 3: Preferences ═══════ */}
          {step === 3 && (
            <div className="ob-section">
              {/* Diet Type */}
              <label className="form-label">Diet Type</label>
              <div className="ob-chip-grid">
                {DIET_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`ob-chip${dietType === opt.value ? ' selected' : ''}`}
                    onClick={() => setDietType(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Allergies */}
              <label className="form-label" style={{ marginTop: 20 }}>Allergies</label>
              <div className="ob-chip-grid">
                {ALLERGY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`ob-chip warn${allergies.includes(opt.value) ? ' selected' : ''}`}
                    onClick={() => toggleAllergy(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Liked Foods */}
              <div className="form-group" style={{ marginTop: 20 }}>
                <label className="form-label">Liked Foods</label>
                <div className="ob-tag-input-wrapper">
                  <div className="ob-tags">
                    {liked.map((t) => (
                      <span key={t} className="ob-tag">
                        {t} <button type="button" onClick={() => removeTag(t, liked, setLiked)}>&times;</button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="ob-tag-input"
                    placeholder="Type and press Enter"
                    value={likedInput}
                    onChange={(e) => setLikedInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(likedInput, setLikedInput, liked, setLiked); } }}
                  />
                </div>
              </div>

              {/* Disliked Foods */}
              <div className="form-group">
                <label className="form-label">Disliked Foods</label>
                <div className="ob-tag-input-wrapper">
                  <div className="ob-tags">
                    {disliked.map((t) => (
                      <span key={t} className="ob-tag dislike">
                        {t} <button type="button" onClick={() => removeTag(t, disliked, setDisliked)}>&times;</button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="ob-tag-input"
                    placeholder="Type and press Enter"
                    value={dislikedInput}
                    onChange={(e) => setDislikedInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(dislikedInput, setDislikedInput, disliked, setDisliked); } }}
                  />
                </div>
              </div>

              <div className="ob-nav-row">
                <button type="button" className="btn ob-back-btn" onClick={() => setStep(2)}>
                  <i className="fas fa-arrow-left" /> Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary ob-next-btn"
                  disabled={loading}
                  onClick={handleStep3}
                >
                  {loading ? (<><span className="spinner" /> Finishing…</>) : (<>Finish <i className="fas fa-check" /></>)}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

