import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import ForgotPassword from './pages/ForgotPassword';
import Onboarding from './pages/Onboarding';
import Home from './pages/Home';
import Profile from './pages/Profile';
import MyPlan from './pages/MyPlan';
import Pantry from './pages/Pantry';
import AiGenerate from './pages/AiGenerate';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import { NotificationsProvider } from './lib/notifications';

// ── Error Boundary ───────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', color: '#e53e3e' }}>
          <h2>⚠️ Render error</h2>
          <pre style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
            {(this.state.error as Error).message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── App ──────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <NotificationsProvider>
          <Routes>
          <Route path="/sign-in"          element={<SignIn />} />
          <Route path="/sign-up"          element={<SignUp />} />
          <Route path="/forgot-password"  element={<ForgotPassword />} />
          <Route path="/onboarding"       element={<Onboarding />} />
          <Route path="/home"             element={<Home />} />
          <Route path="/my-plan"          element={<MyPlan />} />
          <Route path="/pantry"           element={<Pantry />} />
          <Route path="/ai-generate"      element={<AiGenerate />} />
          <Route path="/chat"             element={<Chat />} />
          <Route path="/settings"         element={<Settings />} />
          <Route path="/profile"          element={<Profile />} />
          <Route path="/"                 element={<Navigate to="/sign-in" replace />} />
          <Route path="*"                 element={<Navigate to="/sign-in" replace />} />
        </Routes>
        </NotificationsProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
