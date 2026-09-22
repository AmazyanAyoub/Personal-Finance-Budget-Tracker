"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { submitOnboarding } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { AuthGuard } from "../auth-guard";

function formatMAD(amount: number) {
  return `${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MAD`;
}

function OnboardingForm() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [availableSavings, setAvailableSavings] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [freedomFundsPct, setFreedomFundsPct] = useState(20);
  const [essentialsPct, setEssentialsPct] = useState(50);
  const [lifestylePct, setLifestylePct] = useState(30);
  const [efMultiplier, setEfMultiplier] = useState(3);
  const [currentEfBalance, setCurrentEfBalance] =
    useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const income = Number(monthlyIncome) || 0;
  const currentEf = Number(currentEfBalance) || 0;

  const total =
    freedomFundsPct + essentialsPct + lifestylePct;

  const emergencyFundTarget =
    income * (essentialsPct / 100) * efMultiplier;

  const emergencyFundGap = Math.max(
    emergencyFundTarget - currentEf,
    0
  );

  const emergencyFundProgress =
    emergencyFundTarget > 0
      ? Math.min(
          (currentEf / emergencyFundTarget) * 100,
          100
        )
      : 0;

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

    const percentage = Math.round(
      (Number(value) / income) * 100
    );

    setPercentage(
      Math.max(0, Math.min(100, percentage))
    );
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting) return;

    setError(null);

    const monthlyIncomeCents = Math.round(
      Number(monthlyIncome) * 100
    );

    if (
      !Number.isFinite(monthlyIncomeCents) ||
      monthlyIncomeCents <= 0
    ) {
      setError("Enter a valid monthly income.");
      return;
    }

    if (
      !Number.isInteger(total) ||
      total !== 100
    ) {
      setError(
        `Your three percentages must add up to 100%. ` +
          `They currently add up to ${total}%.`
      );
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
      setError(
        "Enter a whole percentage between 0 and 100 " +
          "for each bucket."
      );
      return;
    }

    if (
      !Number.isInteger(efMultiplier) ||
      efMultiplier < 3 ||
      efMultiplier > 6
    ) {
      setError(
        "Choose an emergency-fund target between " +
          "3 and 6 months."
      );
      return;
    }

    if (currentEfBalance.trim() === "") {
      setError(
        "Enter your current emergency-fund balance. " +
          "Use 0 if you have not started yet."
      );
      return;
    }

    const currentEfBalanceCents = Math.round(
      Number(currentEfBalance) * 100
    );

    if (
      !Number.isFinite(currentEfBalanceCents) ||
      currentEfBalanceCents < 0
    ) {
      setError(
        "Enter a valid emergency-fund balance."
      );
      return;
    }

    let availableSavingsCents: number | null = null;

    if (availableSavings.trim() !== "") {
      availableSavingsCents = Math.round(
        Number(availableSavings) * 100
      );

      if (
        !Number.isFinite(availableSavingsCents) ||
        availableSavingsCents < 0
      ) {
        setError(
          "Enter a valid savings amount or leave it blank."
        );
        return;
      }
    }

    const token = getToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    setSubmitting(true);

    try {
      const savedOnboarding = await submitOnboarding(
        token,
        {
          monthly_income_cents: monthlyIncomeCents,
          freedom_funds_pct: freedomFundsPct,
          essentials_pct: essentialsPct,
          lifestyle_pct: lifestylePct,
          ef_multiplier: efMultiplier,
          current_ef_balance_cents: currentEfBalanceCents,
          available_savings_cents: availableSavingsCents
        }
      );

      queryClient.setQueryData(
        ["onboarding-status"],
        savedOnboarding
      );

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["dashboard"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["income-entries"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["income-summary"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["monthly-income"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["budget-engine-status"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["available-savings"],
        }),
      ]);

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
          <Link
            href="/"
            className="font-serif text-2xl text-brand"
          >
            Nisba
          </Link>

          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Your first plan
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-12 lg:grid-cols-[1fr_320px] lg:gap-16 lg:py-16">
        <form
          onSubmit={handleSubmit}
          className="min-w-0"
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Getting started
          </p>

          <h1 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">
            Build your first money plan.
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Add the income you normally count on, choose how
            you want to divide it, and tell Nisba where your
            emergency fund stands today.
          </p>

          {/* Monthly income */}
          <section className="mt-12">
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint font-mono text-xs text-brand">
                01
              </span>

              <div>
                <h2 className="font-serif text-2xl">
                  What income can you count on monthly?
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Nisba records this as your base income once
                  each current month. You can add bonuses,
                  freelancing, trading, or any other income
                  separately later.
                </p>
              </div>
            </div>

            <label
              htmlFor="monthly-income"
              className="mt-6 block text-sm font-medium"
            >
              Base monthly income
            </label>

            <div className="mt-2 flex max-w-sm items-center rounded-[10px] border border-border bg-surface px-4 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
              <input
                id="monthly-income"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="e.g. 17000"
                value={monthlyIncome}
                onChange={(event) =>
                  setMonthlyIncome(event.target.value)
                }
                className="min-w-0 flex-1 bg-transparent py-3.5 font-mono text-base outline-none"
              />

              <span className="text-sm text-muted-foreground">
                MAD
              </span>
            </div>
          </section>

          {/* Budget split */}
          <section className="mt-12 border-t border-border pt-10">
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint font-mono text-xs text-brand">
                02
              </span>

              <div>
                <h2 className="font-serif text-2xl">
                  Choose your three buckets.
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Edit a percentage or its MAD amount. The
                  three percentages must add up to 100%.
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
                          ? (Math.max(
                              0,
                              bucket.percentage
                            ) /
                              total) *
                            100
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

                      <span className="text-sm font-medium">
                        {bucket.name}
                      </span>
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
                          bucket.setPercentage(
                            Number(event.target.value)
                          )
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
                        value={
                          income > 0
                            ? amountFor(
                                bucket.percentage
                              )
                            : ""
                        }
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
                total === 100
                  ? "text-success"
                  : "text-danger"
              }`}
            >
              Total: {total}%{" "}
              {total === 100
                ? "— ready to continue"
                : "— must equal 100%"}
            </p>
          </section>

          {/* Emergency fund */}
          <section className="mt-12 border-t border-border pt-10">
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint font-mono text-xs text-brand">
                03
              </span>

              <div>
                <h2 className="font-serif text-2xl">
                  Set your safety cushion.
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a target of 3–6 months of Essentials,
                  then enter what you already have saved.
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
                setEfMultiplier(
                  Number(event.target.value)
                )
              }
              className="mt-2 w-28 rounded-[10px] border border-border bg-surface px-4 py-3 font-mono outline-none focus:border-brand"
            />

            <div className="mt-6 rounded-[14px] border border-border bg-surface p-6">
              <p className="text-sm text-muted-foreground">
                Your emergency-fund target
              </p>

              <p className="mt-2 font-serif text-3xl text-brand">
                {formatMAD(emergencyFundTarget)}
              </p>

              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Monthly income × Essentials percentage ×
                selected months.
              </p>
            </div>

            <label
              htmlFor="current-ef-balance"
              className="mt-7 block text-sm font-medium"
            >
              How much is currently in your emergency fund?
            </label>

            <div className="mt-2 flex max-w-sm items-center rounded-[10px] border border-border bg-surface px-4 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
              <input
                id="current-ef-balance"
                type="number"
                min="0"
                step="0.01"
                required
                value={currentEfBalance}
                onChange={(event) =>
                  setCurrentEfBalance(event.target.value)
                }
                className="min-w-0 flex-1 bg-transparent py-3.5 font-mono text-base outline-none"
              />

              <span className="text-sm text-muted-foreground">
                MAD
              </span>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Enter 0 if you have not started building it yet.
            </p>

            {emergencyFundTarget > 0 && (
              <div className="mt-6 rounded-[14px] bg-brand-tint p-5">
                <div className="flex items-end justify-between gap-4">
                  <span className="text-sm text-muted-foreground">
                    Current progress
                  </span>

                  <span className="font-serif text-2xl text-brand">
                    {emergencyFundProgress.toFixed(1)}%
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{
                      width: `${emergencyFundProgress}%`,
                    }}
                  />
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  {emergencyFundGap > 0
                    ? `${formatMAD(
                        emergencyFundGap
                      )} remaining to reach your target.`
                    : "Your emergency-fund target is already met."}
                </p>
              </div>
            )}

            <div className="mt-8 border-t border-border pt-7">
            <label
              htmlFor="available-savings"
              className="block text-sm font-medium"
            >
              Other available savings{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>

            <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
              Money outside your emergency fund that could be used for
              large financial moves, such as an extra debt payment.
              Leave this blank if you prefer to keep it private.
            </p>

            <div className="mt-3 flex max-w-sm items-center rounded-[10px] border border-border bg-surface px-4 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
              <input
                id="available-savings"
                type="number"
                min="0"
                step="0.01"
                value={availableSavings}
                onChange={(event) =>
                  setAvailableSavings(event.target.value)
                }
                placeholder="Leave blank to keep private"
                className="min-w-0 flex-1 bg-transparent py-3.5 font-mono text-base outline-none"
              />

              <span className="text-sm text-muted-foreground">
                MAD
              </span>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Blank means private. Enter 0 only if you want to declare
              that you currently have no other savings.
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
            {submitting
              ? "Saving your plan…"
              : "Finish setup"}
          </button>
        </form>

        <aside className="h-fit rounded-[18px] border border-border bg-surface p-6 lg:sticky lg:top-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            How Nisba helps
          </p>

          <h2 className="mt-4 font-serif text-2xl">
            Simple income, flexible additions.
          </h2>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Your base income is recorded automatically once
            per current month. Everything else can be added
            later using any name you choose.
          </p>

          <div className="mt-7 space-y-5 border-t border-border pt-6 text-sm">
            <p>
              <span className="font-medium text-brand">
                01.
              </span>{" "}
              Start with the income you normally expect.
            </p>

            <p>
              <span className="font-medium text-brand">
                02.
              </span>{" "}
              Add side income whenever it arrives.
            </p>

            <p>
              <span className="font-medium text-brand">
                03.
              </span>{" "}
              Keep building your emergency fund toward its
              target.
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