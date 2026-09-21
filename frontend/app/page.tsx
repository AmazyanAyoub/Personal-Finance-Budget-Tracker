"use client";

import { useState } from "react";
import Link from "next/link";

function formatMAD(amount: number) {
  return `${Math.round(amount).toLocaleString("en-US")} MAD`;
}

function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="24" r="20" fill="none" stroke="#E6E1D6" strokeWidth="6" />
      <path
        d="M24 4a20 20 0 0 1 19 14"
        fill="none"
        stroke="#232C5C"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M44 24a20 20 0 0 1-27 19"
        fill="none"
        stroke="#8891C4"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M8 37A20 20 0 0 1 5 20"
        fill="none"
        stroke="#B8863A"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function LandingPage() {
  const [income, setIncome] = useState(10000);
  const [fundComplete, setFundComplete] = useState(false);

  const freedomFunds = income * 0.3;
  const essentials = income * 0.55;
  const lifestyle = income * 0.15;

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <nav className="mx-auto flex h-18 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="Nisba home">
            <LogoMark />
            <span className="font-serif text-2xl tracking-tight">Nisba</span>
          </Link>

          <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#how-it-works" className="transition-colors hover:text-foreground">
              How it works
            </a>
            <a href="#emergency-fund" className="transition-colors hover:text-foreground">
              Emergency fund
            </a>
            <a href="#dashboard-preview" className="transition-colors hover:text-foreground">
              Dashboard
            </a>
          </div>

          <Link
            href="/login"
            className="rounded-[10px] bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Log in
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="pointer-events-none absolute -right-32 -top-52 h-[650px] w-[650px] rounded-full border border-brand/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -right-12 -top-28 h-[490px] w-[490px] rounded-full border border-brand/10"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-16 top-2 h-[330px] w-[330px] rounded-full border border-brand/10"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-6xl gap-16 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-28">
          <div className="max-w-xl">
            <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs tracking-wide text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              A clearer view of your money
            </span>

            <h1 className="font-serif text-5xl leading-[1.08] tracking-tight sm:text-6xl">
              Give every dirham <span className="italic text-brand">a job.</span>
            </h1>

            <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Build a plan for your income, follow your spending, and see what
              your money can do next. Nisba gives you the picture. You make
              the decisions.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-5">
              <Link
                href="/login"
                className="rounded-[10px] bg-brand px-6 py-3.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
              >
                Log in to Nisba
              </Link>
              <a
                href="#how-it-works"
                className="text-sm font-medium text-brand underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
              >
                See how it works
              </a>
            </div>

            <p className="mt-8 text-sm text-muted-foreground">
              Private preview · No bank connection required
            </p>
          </div>

          {/* Interactive example */}
          <div className="relative">
            <div className="absolute -left-5 -top-5 h-full w-full rounded-[24px] border border-gold/30 bg-gold-tint/40" />

            <div className="relative rounded-[24px] border border-border bg-surface p-6 shadow-[0_20px_60px_-25px_rgba(35,44,92,0.25)] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                    Try the plan
                  </p>
                  <h2 className="mt-2 font-serif text-2xl">A place for every dirham</h2>
                </div>
                <span className="rounded-full bg-brand-tint px-3 py-1 text-xs text-brand">
                  Example
                </span>
              </div>

              <label
                htmlFor="income-input"
                className="mt-8 block text-sm text-muted-foreground"
              >
                Monthly income
              </label>
              <div className="mt-2 flex items-center rounded-[10px] border border-border bg-background px-4 focus-within:border-brand">
                <input
                  id="income-input"
                  type="number"
                  min="0"
                  value={income}
                  onChange={(event) =>
                    setIncome(Math.max(0, Number(event.target.value) || 0))
                  }
                  className="min-w-0 flex-1 bg-transparent py-3 font-mono text-xl outline-none"
                />
                <span className="text-sm text-muted-foreground">MAD</span>
              </div>

              <div className="mt-8 flex items-center gap-6">
                <div
                  className="relative h-32 w-32 shrink-0 rounded-full"
                  style={{
                    background:
                      "conic-gradient(#232C5C 0% 30%, #8891C4 30% 85%, #B8863A 85% 100%)",
                  }}
                  aria-hidden="true"
                >
                  <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-surface">
                    <span className="font-serif text-2xl">3</span>
                    <span className="text-xs text-muted-foreground">buckets</span>
                  </div>
                </div>

                <div className="min-w-0 flex-1 space-y-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-brand" />
                      Freedom Funds
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatMAD(freedomFunds)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-brand-mid" />
                      Essentials
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatMAD(essentials)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-gold" />
                      Lifestyle
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatMAD(lifestyle)}
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-8 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
                This is an illustrative 30/55/15 split. You can choose your own
                percentages during setup. No money is moved automatically.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Three buckets */}
      <section id="how-it-works" className="bg-surface-alt">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              The idea
            </p>
            <h2 className="mt-4 font-serif text-4xl tracking-tight">
              One plan. Three clear purposes.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
              Log your income and spending. Nisba compares them with your plan
              so you can see what needs attention.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <div className="rounded-[18px] border border-border bg-surface p-7">
              <div className="mb-8 flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-tint font-serif text-lg text-brand">
                  01
                </span>
                <span className="h-2.5 w-2.5 rounded-full bg-brand" />
              </div>
              <h3 className="font-serif text-2xl">Freedom Funds</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                First, build your emergency fund. Once it reaches its target,
                Nisba recommends putting this part of your plan toward investing.
              </p>
            </div>

            <div className="rounded-[18px] border border-border bg-surface p-7">
              <div className="mb-8 flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-tint font-serif text-lg text-brand">
                  02
                </span>
                <span className="h-2.5 w-2.5 rounded-full bg-brand-mid" />
              </div>
              <h3 className="font-serif text-2xl">Essentials</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                The commitments you need to cover: housing, groceries, bills,
                transport, and debt payments.
              </p>
            </div>

            <div className="rounded-[18px] border border-border bg-surface p-7">
              <div className="mb-8 flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-tint font-serif text-lg text-gold">
                  03
                </span>
                <span className="h-2.5 w-2.5 rounded-full bg-gold" />
              </div>
              <h3 className="font-serif text-2xl">Lifestyle</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                The things you enjoy. Give them space in the plan, then keep
                track of what you actually spend.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Emergency fund */}
      <section id="emergency-fund" className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              The safety cushion
            </p>
            <h2 className="mt-4 font-serif text-4xl tracking-tight">
              Know what comes next.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Nisba compares your emergency fund with its target. Below the
              target, it recommends prioritising the fund. When the target is
              met, the recommendation shifts to investing.
            </p>
            <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
              These are recommendations, not restrictions or automatic
              transfers. Debt payments remain part of Essentials.
            </p>
          </div>

          <div className="rounded-[20px] border border-border bg-background p-6 sm:p-8">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={!fundComplete}
                onClick={() => setFundComplete(false)}
                className={`rounded-[10px] px-4 py-2 text-sm transition-colors ${
                  !fundComplete
                    ? "bg-brand text-white"
                    : "border border-border bg-surface text-muted-foreground"
                }`}
              >
                Building the fund
              </button>
              <button
                type="button"
                aria-pressed={fundComplete}
                onClick={() => setFundComplete(true)}
                className={`rounded-[10px] px-4 py-2 text-sm transition-colors ${
                  fundComplete
                    ? "bg-brand text-white"
                    : "border border-border bg-surface text-muted-foreground"
                }`}
              >
                Target met
              </button>
            </div>

            <div className="mt-8 rounded-[16px] border border-border bg-surface p-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">
                  Emergency fund
                </span>
                <span className="font-mono text-sm text-brand">
                  {fundComplete ? "100%" : "45%"}
                </span>
              </div>

              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: fundComplete ? "100%" : "45%" }}
                />
              </div>

              <div className="mt-7 border-t border-border pt-6">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Nisba recommends
                </p>
                <p className="mt-2 font-serif text-xl text-brand">
                  {fundComplete
                    ? "Consider investing your Freedom Funds."
                    : "Keep building your emergency fund."}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Illustration only — you choose what to do with your money.
            </p>
          </div>
        </div>
      </section>

      {/* Dashboard preview */}
      <section id="dashboard-preview" className="bg-surface-alt">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                The bigger picture
              </p>
              <h2 className="mt-4 font-serif text-4xl tracking-tight">
                Less guessing. More clarity.
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
                See your emergency fund, spending, investments, and debts in
                one place.
              </p>
            </div>
            <span className="text-sm text-muted-foreground">
              Illustrative dashboard preview
            </span>
          </div>

          <div className="mt-12 overflow-hidden rounded-[20px] border border-border bg-surface shadow-[0_20px_60px_-35px_rgba(35,44,92,0.2)]">
            <div className="flex items-center justify-between border-b border-border px-6 py-5 sm:px-8">
              <span className="font-serif text-xl">Your overview</span>
              <span className="rounded-full bg-success-tint px-3 py-1 text-xs text-success">
                On track
              </span>
            </div>

            <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Emergency fund", value: "56%", detail: "of target" },
                { label: "Available this month", value: "2,150 MAD", detail: "of your plan" },
                { label: "Investments", value: "3,200 MAD", detail: "logged" },
                { label: "Debt", value: "4,000 MAD", detail: "remaining" },
              ].map((item) => (
                <div key={item.label} className="bg-surface p-6 sm:p-8">
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-4 font-serif text-2xl text-brand">
                    {item.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-10 border-t border-border p-6 sm:p-8 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium">Spending by category</h3>
                <div className="mt-6 space-y-5">
                  {[
                    { name: "Housing", width: "80%" },
                    { name: "Groceries", width: "52%" },
                    { name: "Transport", width: "30%" },
                  ].map((category) => (
                    <div
                      key={category.name}
                      className="grid grid-cols-[90px_1fr] items-center gap-4"
                    >
                      <span className="text-sm text-muted-foreground">
                        {category.name}
                      </span>
                      <div className="h-2 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-brand-mid"
                          style={{ width: category.width }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium">Income vs expenses</h3>
                <div className="mt-6 space-y-5">
                  <div>
                    <div className="mb-2 flex justify-between gap-4 text-sm">
                      <span>Income</span>
                      <span className="font-mono">10,000 MAD</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-border">
                      <div className="h-full w-full rounded-full bg-success" />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between gap-4 text-sm">
                      <span>Expenses</span>
                      <span className="font-mono">6,400 MAD</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-border">
                      <div className="h-full w-[64%] rounded-full bg-gold" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Closing */}
      <section className="bg-brand text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-20 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">
              Your money, your decisions
            </p>
            <h2 className="mt-4 max-w-xl font-serif text-3xl tracking-tight sm:text-4xl">
              Start with a clearer picture.
            </h2>
          </div>
          <Link
            href="/login"
            className="w-fit rounded-[10px] bg-white px-6 py-3.5 text-sm font-medium text-brand transition-colors hover:bg-white/90"
          >
            Log in to Nisba
          </Link>
        </div>
      </section>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-serif text-lg text-foreground">Nisba</span>
            <p className="mt-1">Give every dirham a job.</p>
          </div>
          <span>Built by Ayoub Amazyan</span>
        </div>
      </footer>
    </main>
  );
}