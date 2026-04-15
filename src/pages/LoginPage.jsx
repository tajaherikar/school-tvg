import { useState } from 'react';
import { DUMMY_PASSWORD, DUMMY_USERNAME, loginWithDummy } from '../lib/auth';

export default function LoginPage({ onLoginSuccess }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const result = loginWithDummy(form.username.trim(), form.password);
    if (!result.success) {
      setError(result.message);
      return;
    }

    setError('');
    onLoginSuccess(result.user.username);
  }

  return (
    <div className="login-shell-v2">
      <main className="login-layout-v2">
        <section className="login-left-pane-v2" aria-hidden="true">
          <div className="login-left-image-v2" />
          <div className="login-left-content-v2">
            <span className="login-logo-v2">ScholarSync</span>
            <h1>The Academic Curator.</h1>
            <p>Empowering educators with curated data workflows and classroom insight.</p>

            <div className="login-metric-v2">
              <div>
                <p>Today's Attendance</p>
                <h3>98.4% Average</h3>
              </div>
              <div className="login-progress-v2">
                <span style={{ width: '84%' }} />
              </div>
            </div>
          </div>
        </section>

        <section className="login-form-pane-v2">
          <div className="login-mobile-brand-v2">
            <span className="material-symbols-outlined">shield_person</span>
            <strong>ScholarSync</strong>
          </div>

          <header className="login-header-v2">
            <h2>Welcome Back</h2>
            <p>Access your academic workstation.</p>
          </header>

          <form onSubmit={handleSubmit} className="login-form-v2">
            <label>
              Username
              <div className="login-input-wrap-v2">
                <span className="material-symbols-outlined">person</span>
                <input
                  type="text"
                  value={form.username}
                  onChange={(event) => updateField('username', event.target.value)}
                  placeholder="teacher username"
                  autoComplete="username"
                />
              </div>
            </label>

            <label>
              Password
              <div className="login-input-wrap-v2">
                <span className="material-symbols-outlined">lock</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>
            </label>

            <div className="login-options-v2">
              <label>
                <input type="checkbox" />
                <span>Remember Me</span>
              </label>
              <a href="#" onClick={(event) => event.preventDefault()}>Forgot Password?</a>
            </div>

            {error ? <p className="login-error">{error}</p> : null}

            <button type="submit" className="login-submit-v2">Sign In</button>
          </form>

          <div className="login-hint-v2">
            <p>Demo credentials</p>
            <small>Username: {DUMMY_USERNAME}</small>
            <small>Password: {DUMMY_PASSWORD}</small>
          </div>

          <footer className="login-footer-v2">
            <p>
              Need access? <a href="#" onClick={(event) => event.preventDefault()}>Contact Institution Support</a>
            </p>
          </footer>
        </section>
      </main>
    </div>
  );
}
