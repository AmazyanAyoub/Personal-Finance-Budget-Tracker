"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitOnboarding } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { AuthGuard } from "../auth-guard";

const INCOME_MODES = [
  {
    value: "fixed_only",
    title: "Fixed income",
    description: "A regular monthly salary or other predictable income.",
  },
  {
    value: "fixed_plus_freelance",
    title: "Fixed + freelance",
    description: "Regular income with additional variable earnings.",
  },
  {
    value: "freelance_only",
    title: "Freelance income",
    description: "Income that can change from month to month.",
  },
];


function formatMAD(amount: number) {
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MAD`;
}

function OnboardingForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [incomeMode, setIncomeMode] = useState("fixed_only");
  const [estimatedIncome, setEstimatedIncome] = useState("");
  const [freedomFundsPct, setFreedomFundsPct] = useState(20);
  const [essentialsPct, setEssentialsPct] = useState(50);
  const [lifestylePct, setLifestylePct] = useState(30);
  const [efMultiplier, setEfMultiplier] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fixedSalary, setFixedSalary] = useState("");

  const income = Number(estimatedIncome) || 0;
  const total = freedomFundsPct + essentialsPct + lifestylePct;
  const emergencyFundTarget =
    income * (essentialsPct / 100) * efMultiplier;

  const buckets = [
    {
      name: "Freedom Funds",
      description: "Emergency fund first, then investing.",
      color: "bg-brand",
      percentage: freedomFundsPct,
      setPercentage: setFreedomFundsPct,
    },
    {
      name: "Essentials",
      description: "Needs, bills, and debt payments.",
      color: "bg-brand-mid",
      percentage: essentialsPct,
      setPercentage: setEssentialsPct,
    },
    {
      name: "Lifestyle",
      description: "Spending you choose for yourself.",
      color: "bg-gold",
      percentage: lifestylePct,
      setPercentage: setLifestylePct,
    },
  ];

  function amountFor(percentage: number) {
    return ((income * percentage) / 100).toFixed(2);
  }

  function handleAmountChange(
    setPercentage: (value: number) => void,
    value: string
  ) {
    if (income <= 0) return;

    const percentage = Math.round((Number(value) / income) * 100);
    setPercentage(Math.max(0, Math.min(100, percentage)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError(null);

    if (!Number.isInteger(total) || total !== 100) {
      setError(`Your three percentages must add up to 100%. They currently add up to ${total}%.`);
      return;
    }

    if (
      buckets.some(
        (bucket) =>
          !Number.isInteger(bucket.percentage) ||
          bucket.percentage < 0 ||
          bucket.percentage > 100
      )
    ) {
      setError("Enter a whole percentage between 0 and 100 for each bucket.");
      return;
    }

    const estimatedIncomeCents = Math.round(income * 100);

    let fixedSalaryCents: number | null = null;

    if (incomeMode === "fixed_only") {
      fixedSalaryCents = estimatedIncomeCents;
    }

    if (incomeMode === "fixed_plus_freelance") {
      fixedSalaryCents = Math.round(Number(fixedSalary) * 100);

      if (!Number.isFinite(fixedSalaryCents) || fixedSalaryCents <= 0) {
        setError("Enter a valid fixed monthly salary.");
        return;
      }

      if (fixedSalaryCents > estimatedIncomeCents) {
        setError(
          "The fixed salary cannot be greater than the estimated total income."
        );
        return;
      }
    }

    if (!Number.isFinite(estimatedIncomeCents) || estimatedIncomeCents <= 0) {
      setError("Enter a valid estimated monthly income.");
      return;
    }

    if (!Number.isInteger(efMultiplier) || efMultiplier < 3 || efMultiplier > 6) {
      setError("Choose an emergency-fund target between 3 and 6 months.");
      return;
    }

    const token = getToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    setSubmitting(true);

    try {
      const savedOnboarding = await submitOnboarding(token, {
        income_mode: incomeMode,
        freedom_funds_pct: freedomFundsPct,
        essentials_pct: essentialsPct,
        lifestyle_pct: lifestylePct,
        ef_multiplier: efMultiplier,
        estimated_monthly_income_cents: estimatedIncomeCents,
        fixed_salary_cents: fixedSalaryCents,
      });

      queryClient.setQueryData(
        ["onboarding-status"],
        savedOnboarding
      );

      router.replace("/dashboard");

    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save your setup. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="font-serif text-2xl text-brand">
            Nisba
          </Link>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Your first plan
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-12 lg:grid-cols-[1fr_320px] lg:gap-16 lg:py-16">
        <form onSubmit={handleSubmit} className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Getting started
          </p>
          <h1 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">
            Build your first money plan.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Tell Nisba how your income works, choose your three buckets, and
            set a target for your emergency fund. You stay in control of every
            decision and transfer.
          </p>

          {/* Income mode */}
          <section className="mt-12">
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint font-mono text-xs text-brand">
                01
              </span>
              <div>
                <h2 className="font-serif text-2xl">How does income arrive?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose the option that best matches your situation.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {INCOME_MODES.map((mode) => (
                <label
                  key={mode.value}
                  className={`cursor-pointer rounded-[14px] border p-5 transition-colors ${
                    incomeMode === mode.value
                      ? "border-brand bg-brand-tint"
                      : "border-border bg-surface hover:border-brand/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="income_mode"
                    value={mode.value}
                    checked={incomeMode === mode.value}
                    onChange={() => setIncomeMode(mode.value)}
                    className="accent-brand"
                  />
                  <span className="mt-4 block text-sm font-medium">
                    {mode.title}
                  </span>
                  <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">
                    {mode.description}
                  </span>
                </label>
              ))}
            </div>
          </section>

          {/* Estimated income */}
          <section className="mt-12 border-t border-border pt-10">
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint font-mono text-xs text-brand">
                02
              </span>
              <div>
                <h2 className="font-serif text-2xl">Estimate your monthly income.</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This helps calculate your example split and emergency-fund
                  target. It does not create an income entry.
                </p>
              </div>
            </div>

            <label
              htmlFor="estimated-income"
              className="mt-6 block text-sm font-medium"
            >
              Estimated monthly income
            </label>
            <div className="mt-2 flex max-w-sm items-center rounded-[10px] border border-border bg-surface px-4 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
              <input
                id="estimated-income"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="e.g. 17000"
                value={estimatedIncome}
                onChange={(event) => setEstimatedIncome(event.target.value)}
                className="min-w-0 flex-1 bg-transparent py-3.5 font-mono text-base outline-none"
              />
              <span className="text-sm text-muted-foreground">MAD</span>
            </div>
            
          </section>

          {/* Budget split */}
          <section className="mt-12 border-t border-border pt-10">
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint font-mono text-xs text-brand">
                03
              </span>
              <div>
                <h2 className="font-serif text-2xl">Choose your three buckets.</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  You can edit a percentage or its MAD amount. The three
                  percentages must add up to 100%.
                </p>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-full bg-border">
              <div className="flex h-3">
                {buckets.map((bucket) => (
                  <div
                    key={bucket.name}
                    className={bucket.color}
                    style={{
                      width: `${
                        total > 0
                          ? (Math.max(0, bucket.percentage) / total) * 100
                          : 0
                      }%`,
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {buckets.map((bucket) => (
                <div
                  key={bucket.name}
                  className="grid gap-4 rounded-[14px] border border-border bg-surface p-5 sm:grid-cols-[1fr_100px_150px] sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${bucket.color}`}
                      />
                      <span className="text-sm font-medium">{bucket.name}</span>
                    </div>
                    <p className="mt-1 pl-5 text-xs text-muted-foreground">
                      {bucket.description}
                    </p>
                  </div>

                  <label className="text-xs text-muted-foreground">
                    Percent
                    <div className="mt-1 flex items-center rounded-[8px] border border-border px-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={bucket.percentage}
                        onChange={(event) =>
                          bucket.setPercentage(Number(event.target.value))
                        }
                        className="w-full min-w-0 bg-transparent py-2 font-mono text-sm outline-none"
                      />
                      <span>%</span>
                    </div>
                  </label>

                  <label className="text-xs text-muted-foreground">
                    Amount
                    <div className="mt-1 flex items-center rounded-[8px] border border-border px-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={income > 0 ? amountFor(bucket.percentage) : ""}
                        onChange={(event) =>
                          handleAmountChange(
                            bucket.setPercentage,
                            event.target.value
                          )
                        }
                        disabled={income <= 0}
                        placeholder="0.00"
                        className="w-full min-w-0 bg-transparent py-2 font-mono text-sm outline-none disabled:opacity-50"
                      />
                      <span>MAD</span>
                    </div>
                  </label>
                </div>
              ))}
            </div>

            <p
              className={`mt-4 text-sm ${
                total === 100 ? "text-success" : "text-danger"
              }`}
            >
              Total: {total}% {total === 100 ? "— ready to continue" : "— must equal 100%"}
            </p>
          </section>

          {/* Emergency fund */}
          <section className="mt-12 border-t border-border pt-10">
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint font-mono text-xs text-brand">
                04
              </span>
              <div>
                <h2 className="font-serif text-2xl">Set your safety cushion.</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pick a target equal to 3–6 months of estimated Essentials.
                  Debt payments are included in Essentials.
                </p>
              </div>
            </div>

            <label
              htmlFor="ef-months"
              className="mt-6 block text-sm font-medium"
            >
              Months of Essentials
            </label>
            <input
              id="ef-months"
              type="number"
              min="3"
              max="6"
              step="1"
              value={efMultiplier}
              onChange={(event) =>
                setEfMultiplier(Number(event.target.value))
              }
              className="mt-2 w-28 rounded-[10px] border border-border bg-surface px-4 py-3 font-mono outline-none focus:border-brand"
            />

            <div className="mt-6 rounded-[14px] border border-border bg-surface p-6">
              <p className="text-sm text-muted-foreground">
                Your estimated emergency-fund target
              </p>
              <p className="mt-2 font-serif text-3xl text-brand">
                {formatMAD(emergencyFundTarget)}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Based on your income estimate × Essentials percentage ×
                selected months.
              </p>
            </div>
          </section>

          {error && (
            <p
              role="alert"
              className="mt-8 rounded-[10px] border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-8 rounded-[10px] bg-brand px-7 py-3.5 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving your plan…" : "Finish setup"}
          </button>
        </form>

        {/* Side note */}
        <aside className="h-fit rounded-[18px] border border-border bg-surface p-6 lg:sticky lg:top-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            How Nisba helps
          </p>
          <h2 className="mt-4 font-serif text-2xl">
            A guide, not an autopilot.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Nisba tracks the numbers you enter and shows how they compare with
            your plan. It does not move money between accounts.
          </p>

          <div className="mt-7 space-y-5 border-t border-border pt-6 text-sm">
            <p>
              <span className="font-medium text-brand">01.</span>{" "}
              Choose a plan that fits your income.
            </p>
            <p>
              <span className="font-medium text-brand">02.</span>{" "}
              Build your emergency fund toward its target.
            </p>
            <p>
              <span className="font-medium text-brand">03.</span>{" "}
              Decide what to do with your money next.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <AuthGuard>
      <OnboardingForm />
    </AuthGuard>
  );
}