import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import '../styles/auth.css';
import type { SignupRequest } from '../api/contracts';
import { signup, saveTokens } from '../api/client';
import axios from 'axios';

// ─── helpers ────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

function getPasswordStrength(password: string): { level: PasswordStrength; score: number } {
  let score = 0;
  if (password.length >= 6)           score++;
  if (/[A-Z]/.test(password))         score++;
  if (/[0-9]/.test(password))         score++;
  if (/[^A-Za-z0-9]/.test(password))  score++;

  const levels: PasswordStrength[] = ['weak', 'fair', 'good', 'strong'];
  return { level: levels[score - 1] ?? 'weak', score };
}

const STRENGTH_LABELS: Record<number, string> = {
  0: '',
  1: 'Weak',
  2: 'Fair',
  3: 'Good',
  4: 'Strong',
};

// ─── form type (extends backend request with frontend-only fields) ──
interface SignUpForm extends SignupRequest {
  confirmPassword: string;
}

// ─── component ──────────────────────────────
export default function SignUp() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [loading, setLoading]           = useState(false);
  const [serverError, setServerError]   = useState('');
  const [success, setSuccess]           = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SignUpForm>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = useWatch({ control, name: 'password', defaultValue: '' });
  const strength = passwordValue ? getPasswordStrength(passwordValue) : null;

  const onSubmit = async (data: SignUpForm) => {
    setLoading(true);
    setServerError('');

    try {
      const res = await signup({
        name: data.name,
        email: data.email,
        password: data.password,
      });
      saveTokens(res.data.accessToken, res.data.refreshToken);
      setSuccess(true);
      setTimeout(() => navigate('/onboarding'), 1000);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setServerError(err.response.data.message);
      } else {
        setServerError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Background orbs */}
      <div className="bg-orb">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
      </div>

      <div className="auth-container">
        <div className="auth-card">

          {/* Logo */}
          <Link to="/" className="logo">
            <i className="fas fa-leaf" />
            <span className="logo-text">DIETRIX</span>
          </Link>

          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">Start your personalized wellness journey today</p>

          {/* Alerts */}
          {success && (
            <div className="alert alert-success">
              <i className="fas fa-check-circle" />
              Account created successfully!
            </div>
          )}
          {serverError && (
            <div className="alert alert-error">
              <i className="fas fa-exclamation-circle" />
              {serverError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate>

            {/* Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="name">Full Name</label>
              <div className="input-wrapper">
                <i className="fas fa-user input-icon" />
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Enter your name"
                  className={`form-input${errors.name ? ' input-error' : ''}`}
                  {...register('name', {
                    required: 'Name is required',
                    minLength: { value: 2, message: 'Min 2 characters' },
                    maxLength: { value: 100, message: 'Max 100 characters' },
                  })}
                />
              </div>
              <span className="field-error">{errors.name?.message}</span>
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <div className="input-wrapper">
                <i className="fas fa-envelope input-icon" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email"
                  className={`form-input${errors.email ? ' input-error' : ''}`}
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: EMAIL_REGEX, message: 'Enter a valid email' },
                  })}
                />
              </div>
              <span className="field-error">{errors.email?.message}</span>
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div className="input-wrapper">
                <i className="fas fa-lock input-icon" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min 6 characters"
                  className={`form-input${errors.password ? ' input-error' : ''}`}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'At least 6 characters' },
                    maxLength: { value: 100, message: 'Max 100 characters' },
                  })}
                />
                <button
                  type="button"
                  className="input-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((prev: boolean) => !prev)}
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>
              <span className="field-error">{errors.password?.message}</span>

              {/* Strength bar */}
              {passwordValue && strength && (
                <>
                  <div className="strength-bar">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`strength-segment${i <= strength.score ? ` ${strength.level}` : ''}`}
                      />
                    ))}
                  </div>
                  <p className="strength-label">{STRENGTH_LABELS[strength.score]}</p>
                </>
              )}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-wrapper">
                <i className="fas fa-lock input-icon" />
                <input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  className={`form-input${errors.confirmPassword ? ' input-error' : ''}`}
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (v: string) => v === passwordValue || 'Passwords do not match',
                  })}
                />
                <button
                  type="button"
                  className="input-toggle"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  onClick={() => setShowConfirm((prev: boolean) => !prev)}
                >
                  <i className={`fas ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`} />
                </button>
              </div>
              <span className="field-error">{errors.confirmPassword?.message}</span>
            </div>

            {/* Submit */}
            <button type="submit" className="btn btn-primary" disabled={loading || success}>
              {loading ? (
                <>
                  <span className="spinner" />
                  Creating account…
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>


          {/* Sign in link */}
          <p className="auth-footer">
            Already have an account?
            <Link to="/sign-in">Sign In</Link>
          </p>

          {/* Back */}
          <div className="back-link">
            <Link to="/">
              <i className="fas fa-arrow-left" />
              Back to Home
            </Link>
          </div>

          {/* Back */}
          <div className="back-link">
            <Link to="/">
              <i className="fas fa-arrow-left" />
              Back to Home
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
