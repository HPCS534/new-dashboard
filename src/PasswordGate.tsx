import { useState } from "react";
import type { FormEvent, ReactNode } from "react";

const SESSION_KEY = "record-checking-access-granted";
const configuredPassword = import.meta.env.VITE_DASHBOARD_PASSWORD?.trim();

/**
 * Temporary, client-side access gate. A VITE_ variable is compiled into the
 * browser bundle, so this is only a visual/access-control layer—not security.
 * Replace it with server validation before exposing sensitive data publicly.
 */
export function PasswordGate({ children }: { children: ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    try {
      return Boolean(configuredPassword) && window.sessionStorage.getItem(SESSION_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!configuredPassword) {
      setError("Password protection has not been configured yet.");
      return;
    }

    if (password !== configuredPassword) {
      setError("Incorrect password. Please try again.");
      setPassword("");
      return;
    }

    try {
      window.sessionStorage.setItem(SESSION_KEY, "true");
    } catch {
      // The session still works when browser storage is unavailable.
    }

    setIsUnlocked(true);
  };

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <main className="password-screen">
      <section className="password-card" aria-labelledby="password-title">
        <div className="password-mark" aria-hidden="true">⌁</div>
        <p className="password-eyebrow">Restricted access</p>
        <h1 id="password-title">Record checking</h1>
        <p>Enter the shared password to view the dashboard.</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="dashboard-password">Password</label>
          <input
            id="dashboard-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError("");
            }}
            aria-describedby={error ? "password-error" : undefined}
          />
          {error && <p id="password-error" className="password-error" role="alert">{error}</p>}
          <button type="submit">Continue</button>
        </form>
        {!configuredPassword}
      </section>
    </main>
  );
}
