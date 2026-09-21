"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { saveToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const { access_token } = await login(email, password);
      saveToken(access_token);
      router.push("/dashboard");
    } catch {
      setError("Could not log in. Check your email and password, then try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-brand px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -right-48 -top-48 h-[700px] w-[700px] rounded-full border border-white/15"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-[470px] w-[470px] rounded-full border border-white/15"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-4 top-4 h-[230px] w-[230px] rounded-full border border-white/15"
          aria-hidden="true"
        />

        <Link href="/" className="relative flex w-fit items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40">
            <span className="h-3 w-3 rounded-full bg-gold" />
          </span>
          <span className="font-serif text-2xl">Nisba</span>
        </Link>

        <div className="relative max-w-lg">
          <p className="mb-6 text-xs font-medium uppercase tracking-[0.25em] text-white/60">
            Your money, made clearer
          </p>
          <h1 className="font-serif text-5xl leading-[1.1] tracking-tight xl:text-6xl">
            A clearer picture starts here.
          </h1>
          <p className="mt-7 max-w-md text-lg leading-relaxed text-white/70">
            See your plan, follow your spending, and know what needs your
            attention next.
          </p>

          <div className="mt-12 grid max-w-md grid-cols-3 gap-2">
            <div className="h-2 rounded-full bg-white" />
            <div className="h-2 rounded-full bg-brand-mid" />
            <div className="h-2 rounded-full bg-gold" />
          </div>
          <div className="mt-4 flex max-w-md justify-between text-xs text-white/60">
            <span>Freedom Funds</span>
            <span>Essentials</span>
            <span>Lifestyle</span>
          </div>
        </div>

        <p className="relative text-sm text-white/50">
          Give every dirham a job.
        </p>
      </section>

      {/* Login form */}
      <section className="flex min-h-screen flex-col px-6 py-8 sm:px-12 lg:px-16">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-serif text-xl text-brand lg:hidden">
            Nisba
          </Link>
          <Link
            href="/"
            className="ml-auto text-sm text-muted-foreground transition-colors hover:text-brand"
          >
            ← Back to home
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-16">
          <div className="w-full max-w-md">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              Welcome back
            </p>
            <h2 className="mt-4 font-serif text-4xl tracking-tight text-foreground">
              Log in to Nisba
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Pick up where you left off with your money.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-[10px] border border-border bg-surface px-4 py-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Password
                </label>
                <div className="flex items-center rounded-[10px] border border-border bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm outline-none placeholder:text-muted-foreground/60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="px-4 text-sm text-muted-foreground transition-colors hover:text-brand"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-[10px] border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-[10px] bg-brand px-5 py-3.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Logging in…" : "Log in"}
              </button>
            </form>

            <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
              Nisba is currently a private, single-user app. Account creation
              is not open yet.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Built by Ayoub Amazyan
        </p>
      </section>
    </main>
  );
}