import {useEffect, useState} from "react";
import type {FormEvent, ReactNode} from "react";
import type {Session} from "@supabase/supabase-js";
import {supabase} from "./supabase";

export function AuthGate({children}: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const {data} = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
            setLoading(false);
        });
        return () => data.subscription.unsubscribe();
    }, []);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSubmitting(true);
        setError("");
        const {error} = await supabase.auth.signInWithPassword({email, password});
        if (error) {
            setError(error.message);
            setPassword("");
        }
        setSubmitting(false);
    };

    if (loading) return null;
    if (session) return <>{children}</>;

    return (
        <main className="password-screen">
            <section className="password-card" aria-labelledby="password-title">
                <div className="password-mark" aria-hidden="true">⌁</div>
                <p className="password-eyebrow">Restricted access</p>
                <h1 id="password-title">Record checking</h1>
                <p>Sign in to view the dashboard.</p>
                <form onSubmit={handleSubmit}>
                    <label htmlFor="auth-email">Email</label>
                    <input
                        id="auth-email"
                        type="email"
                        autoComplete="email"
                        autoFocus
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <label htmlFor="auth-password">Password</label>
                    <input
                        id="auth-password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    {error && <p className="password-error" role="alert">{error}</p>}
                    <button type="submit" disabled={submitting}>
                        {submitting ? "Signing in…" : "Sign in"}
                    </button>
                </form>
            </section>
        </main>
    );
}