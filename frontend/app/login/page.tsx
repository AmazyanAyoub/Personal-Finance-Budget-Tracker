"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { login } from "@/lib/api";
import { saveToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      saveToken(result.access_token);
      router.replace("/dashboard");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not log in."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-brand px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -right-48 -top-48 h-[700px] w-[700px] rounded-full border border-white/15"
          aria-hidden="true"
        />

        <Link href="/" className="relative flex w-fit items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/40">
            <span className="h-3 w-3 rounded-full bg-gold" />
          </span>
          <span className="font-serif text-2xl">Nisba</span>
        </Link>

        <div className="relative max-w-lg">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-white/60">
            Welcome back
          </p>

          <h1 className="mt-6 font-serif text-5xl leading-[1.1] tracking-tight">
            Continue building your financial future.
          </h1>

          <p className="mt-7 max-w-md text-lg leading-relaxed text-white/70">
            See your complete balance, follow your plan, and keep moving toward
            your goals.
          </p>

          <div className="mt-12 grid max-w-md grid-cols-3 gap-2">
            <div className="h-2 rounded-full bg-white" />
            <div className="h-2 rounded-full bg-brand-mid" />
            <div className="h-2 rounded-full bg-gold" />
          </div>

          <div className="mt-4 flex max-w-md justify-between text-xs text-white/60">
            <span>Essentials</span>
            <span>Lifestyle</span>
            <span>Investments</span>
          </div>
        </div>

        <p className="relative text-sm text-white/50">
          Your money. Your plan. Your progress.
        </p>
      </section>

      <section className="flex min-h-screen flex-col px-6 py-8 sm:px-12 lg:px-16">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-serif text-xl text-brand lg:hidden">
            Nisba
          </Link>

          <Link
            href="/register"
            className="ml-auto text-sm text-muted-foreground hover:text-brand"
          >
            Need an account? Register
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-md">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              Welcome back
            </p>

            <h2 className="mt-4 font-serif text-4xl tracking-tight">
              Log in to Nisba
            </h2>

            <p className="mt-3 text-muted-foreground">
              Continue from where you left your financial plan.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 space-y-6">
              <label className="block">
                <span className="text-sm font-medium">Email address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  className="mt-2 w-full rounded-[12px] border border-border bg-surface px-4 py-3 outline-none focus:border-brand"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">Password</span>

                <div className="mt-2 flex rounded-[12px] border border-border bg-surface focus-within:border-brand">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    className="min-w-0 flex-1 rounded-l-[12px] bg-transparent px-4 py-3 outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="px-4 text-sm text-muted-foreground"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>

              {error && (
                <p
                  role="alert"
                  className="rounded-[12px] border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-[12px] bg-brand px-5 py-3.5 font-medium text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Logging in…" : "Log in"}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              New to Nisba?{" "}
              <Link href="/register" className="font-medium text-brand">
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}