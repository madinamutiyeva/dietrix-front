import { useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import '../styles/auth.css';
import { forgotPassword, verifyResetCode, resetPassword } from '../api/client';
import axios from 'axios';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type Step = 'email' | 'code' | 'password';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep]               = useState<Step>('email');
  const [email, setEmail]             = useState('');
  const [code, setCode]               = useState('');
  const [loading, setLoading]         = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess]         = useState(false);

  // ── Step 1: Email ──────────────────────────
  const emailForm = useForm<{ email: string }>({ defaultValues: { email: '' } });

  const handleEmailSubmit = async (data: { email: string }) => {
    setLoading(true);
    setServerError('');
    try {
      await forgotPassword({ email: data.email });
      setEmail(data.email);
      setStep('code');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setServerError(err.response.data.message);
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: 6-digit code ───────────────────
  const CODE_LENGTH = 6;
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));

  const handleDigitChange = useCallback((index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    setServerError('');
    const next = [...digits];
    next[index] = value;
    setDigits(next);


    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [digits]);

  const handleDigitKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [digits]);

  const handleDigitPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const focusIdx = Math.min(pasted.length, CODE_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  }, [digits]);

  const handleCodeSubmit = async () => {
    const fullCode = digits.join('');
    if (fullCode.length < CODE_LENGTH) {
      setServerError('Please enter the full 6-digit code.');
      return;
    }
    setLoading(true);
    setServerError('');
    try {
      await verifyResetCode({ email, code: fullCode });
      setCode(fullCode);
      setStep('password');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setServerError(err.response.data.message);
      } else {
        setServerError('Invalid or expired code.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setServerError('');
    try {
      await forgotPassword({ email });
      setDigits(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } catch {
      setServerError('Could not resend code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: New password ───────────────────
  const passwordForm = useForm<{ newPassword: string; confirmPassword: string }>({
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const [showPw, setShowPw]       = useState(false);
  const [showCpw, setShowCpw]     = useState(false);
  const newPwValue = passwordForm.watch('newPassword');

  const handlePasswordSubmit = async (data: { newPassword: string }) => {
    setLoading(true);
    setServerError('');
    try {
      await resetPassword({ email, code, newPassword: data.newPassword });
      setSuccess(true);
      setTimeout(() => navigate('/sign-in'), 2000);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setServerError(err.response.data.message);
      } else {
        setServerError('Failed to reset password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Step indicator ─────────────────────────
  const stepNumber = step === 'email' ? 1 : step === 'code' ? 2 : 3;

  return (
    <>
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

          {/* Step indicator */}
          <div className="step-indicator">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`step-dot${n <= stepNumber ? ' active' : ''}`} />
            ))}
          </div>

          {/* Error */}
          {serverError && (
            <div className="alert alert-error">
              <i className="fas fa-exclamation-circle" />
              {serverError}
            </div>
          )}

          {/* ═══════ STEP 1: Email ═══════ */}
          {step === 'email' && (
            <>
              <h1 className="auth-title">Reset Password</h1>
              <p className="auth-subtitle">Enter your email to receive a reset code</p>

              <div className="info-message">
                <i className="fas fa-info-circle" />
                <span>We'll send a 6-digit code to your email address.</span>
              </div>

              <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">Email Address</label>
                  <div className="input-wrapper">
                    <i className="fas fa-envelope input-icon" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="Enter your email"
                      className={`form-input${emailForm.formState.errors.email ? ' input-error' : ''}`}
                      {...emailForm.register('email', {
                        required: 'Email is required',
                        pattern: { value: EMAIL_REGEX, message: 'Enter a valid email' },
                      })}
                    />
                  </div>
                  <span className="field-error">{emailForm.formState.errors.email?.message}</span>
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? (<><span className="spinner" /> Sending…</>) : 'Send Code'}
                </button>
              </form>
            </>
          )}

          {/* ═══════ STEP 2: Code ═══════ */}
          {step === 'code' && (
            <>
              <h1 className="auth-title">Enter Code</h1>
              <p className="auth-subtitle">We sent a 6-digit code to <strong>{email}</strong></p>

              <div className="code-inputs" onPaste={handleDigitPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    className={`code-digit${serverError ? ' input-error' : ''}`}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(i, e)}
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              <button
                type="button"
                className="btn btn-primary"
                disabled={loading || digits.join('').length < CODE_LENGTH}
                onClick={handleCodeSubmit}
                style={{ marginTop: 24 }}
              >
                {loading ? (<><span className="spinner" /> Verifying…</>) : 'Verify Code'}
              </button>

              <p className="auth-footer" style={{ marginTop: 20 }}>
                Didn't receive the code?
                <button type="button" className="text-link" onClick={handleResend} disabled={loading} style={{ marginLeft: 4 }}>
                  Resend
                </button>
              </p>
            </>
          )}

          {/* ═══════ STEP 3: New password ═══════ */}
          {step === 'password' && !success && (
            <>
              <h1 className="auth-title">New Password</h1>
              <p className="auth-subtitle">Create a strong password for your account</p>

              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} noValidate>
                <div className="form-group">
                  <label className="form-label" htmlFor="newPassword">New Password</label>
                  <div className="input-wrapper">
                    <i className="fas fa-lock input-icon" />
                    <input
                      id="newPassword"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Min 6 characters"
                      className={`form-input${passwordForm.formState.errors.newPassword ? ' input-error' : ''}`}
                      {...passwordForm.register('newPassword', {
                        required: 'Password is required',
                        minLength: { value: 6, message: 'At least 6 characters' },
                        maxLength: { value: 100, message: 'Max 100 characters' },
                      })}
                    />
                    <button type="button" className="input-toggle" onClick={() => setShowPw((p: boolean) => !p)}>
                      <i className={`fas ${showPw ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                  <span className="field-error">{passwordForm.formState.errors.newPassword?.message}</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
                  <div className="input-wrapper">
                    <i className="fas fa-lock input-icon" />
                    <input
                      id="confirmPassword"
                      type={showCpw ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Repeat your password"
                      className={`form-input${passwordForm.formState.errors.confirmPassword ? ' input-error' : ''}`}
                      {...passwordForm.register('confirmPassword', {
                        required: 'Please confirm your password',
                        validate: (v) => v === newPwValue || 'Passwords do not match',
                      })}
                    />
                    <button type="button" className="input-toggle" onClick={() => setShowCpw((p: boolean) => !p)}>
                      <i className={`fas ${showCpw ? 'fa-eye-slash' : 'fa-eye'}`} />
                    </button>
                  </div>
                  <span className="field-error">{passwordForm.formState.errors.confirmPassword?.message}</span>
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? (<><span className="spinner" /> Resetting…</>) : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          {/* ═══════ Success ═══════ */}
          {success && (
            <div className="alert alert-success" style={{ flexDirection: 'column', padding: '24px 16px', lineHeight: 1.6 }}>
              <strong>Password reset successful!</strong>
              <span>Redirecting to sign in…</span>
            </div>
          )}

          {/* Back links */}
          <div className="back-link" style={{ marginTop: 24 }}>
            <Link to="/sign-in" style={{ color: 'var(--primary)', fontWeight: 500 }}>
              <i className="fas fa-arrow-left" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
