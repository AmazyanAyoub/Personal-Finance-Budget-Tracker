"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { register } from "@/lib/api";
import { saveToken } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmation) {
      setError("The two passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await register(email, password);
      saveToken(result.access_token);
      router.replace("/onboarding");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not create your account."
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
            Start your wealth path
          </p>

          <h1 className="mt-6 font-serif text-5xl leading-[1.1] tracking-tight">
            Give every dirham a clear purpose.
          </h1>

          <p className="mt-7 max-w-md text-lg leading-relaxed text-white/70">
            Track your complete balance, build your emergency fund, control
            spending, reduce debt, and invest consistently.
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
            href="/login"
            className="ml-auto text-sm text-muted-foreground hover:text-brand"
          >
            Already registered? Log in
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-md">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              Create your account
            </p>

            <h2 className="mt-4 font-serif text-4xl tracking-tight">
              Welcome to Nisba
            </h2>

            <p className="mt-3 text-muted-foreground">
              Create your private account to begin building your financial
              plan.
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
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
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

                <span className="mt-2 block text-xs text-muted-foreground">
                  Use between 8 and 72 characters.
                </span>
              </label>

              <label className="block">
                <span className="text-sm font-medium">Confirm password</span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  required
                  className="mt-2 w-full rounded-[12px] border border-border bg-surface px-4 py-3 outline-none focus:border-brand"
                />
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
                {isSubmitting ? "Creating account…" : "Create account"}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-brand">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}