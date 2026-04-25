import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import '../styles/auth.css';
import type { SigninRequest } from '../api/contracts';
import { signin, saveTokens } from '../api/client';
import axios from 'axios';

// ─── helpers ────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── component ──────────────────────────────
export default function SignIn() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [serverError, setServerError]   = useState('');
  const [success, setSuccess]           = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SigninRequest>({
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: SigninRequest) => {
    setLoading(true);
    setServerError('');

    try {
      const res = await signin(data);
      saveTokens(res.data.accessToken, res.data.refreshToken);
      setSuccess(true);
      setTimeout(() => navigate('/home'), 800);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setServerError(err.response.data.message);
      } else {
        setServerError('Invalid email or password. Please try again.');
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

          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">Sign in to continue your wellness journey</p>

          {/* Alerts */}
          {success && (
            <div className="alert alert-success">
              <i className="fas fa-check-circle" />
              Successfully signed in!
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
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className={`form-input${errors.password ? ' input-error' : ''}`}
                  {...register('password', { required: 'Password is required' })}
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
            </div>

            {/* Forgot */}
            <div className="auth-row">
              <span />
              <Link to="/forgot-password" className="text-link">Forgot password?</Link>
            </div>

            {/* Submit */}
            <button type="submit" className="btn btn-primary" disabled={loading || success}>
              {loading ? (
                <>
                  <span className="spinner" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>


          {/* Sign up link */}
          <p className="auth-footer">
            Don't have an account?
            <Link to="/sign-up">Sign Up</Link>
          </p>

        </div>
      </div>
    </>
  );
}
