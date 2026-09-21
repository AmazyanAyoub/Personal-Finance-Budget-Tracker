"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBudgetEngineStatus,
  updateEfBalance,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import { AuthGuard } from "../../auth-guard";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function formatMAD(cents: number) {
  return `${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MAD`;
}

function EmergencyFundManager() {
  const token = getToken()!;
  const queryClient = useQueryClient();

  const [balanceInput, setBalanceInput] = useState("");
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const {
    data: status,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ["budget-engine-status"],
    queryFn: () => getBudgetEngineStatus(token),
    retry: false,
  });

  async function handleUpdateBalance(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (isUpdating) return;

    setUpdateError(null);

    if (balanceInput.trim() === "") {
      setUpdateError("Enter your current emergency-fund balance.");
      return;
    }

    const balance = Number(balanceInput);
    const balanceCents = toCents(balance);

    if (!Number.isFinite(balance) || balance < 0) {
      setUpdateError("Enter a valid balance of zero or more.");
      return;
    }

    setIsUpdating(true);

    try {
      await updateEfBalance(token, balanceCents);
      setBalanceInput("");

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["budget-engine-status"],
        }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    } catch (caughtError) {
      setUpdateError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not update the emergency-fund balance."
      );
    } finally {
      setIsUpdating(false);
    }
  }

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <p className="text-sm text-muted-foreground">
          Loading your emergency fund…
        </p>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="mx-auto w-full max-w-6xl rounded-[18px] border border-border bg-surface p-8">
        <h1 className="font-serif text-2xl">
          Could not load your emergency fund
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Check that the backend is running, then try again.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-6 rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-brand-hover"
        >
          Try again
        </button>
      </div>
    );
  }

  const progress =
    status.ef_target_cents > 0
      ? Math.min(
          (status.ef_current_balance_cents /
            status.ef_target_cents) *
            100,
          100
        )
      : 0;

  const roundedProgress = Math.round(progress * 10) / 10;

  const amountAboveTarget = Math.max(
    status.ef_current_balance_cents - status.ef_target_cents,
    0
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      {/* Heading */}
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
          Freedom Funds · First priority
        </p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">
          Emergency Fund
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Track your safety cushion against its target. Nisba recommends what
          to prioritise, but it never transfers or restricts your money.
        </p>
      </div>

      {/* Main progress */}
      <section className="grid gap-10 rounded-[22px] border border-border bg-surface p-6 md:grid-cols-[260px_1fr] md:items-center md:p-10">
        <div className="flex justify-center">
          <div
            className="relative h-52 w-52 rounded-full"
            style={{
              background: `conic-gradient(#232C5C ${progress}%, #E6E1D6 ${progress}% 100%)`,
            }}
          >
            <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-surface">
              <span className="font-serif text-4xl text-brand">
                {roundedProgress}%
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                of target
              </span>
            </div>
          </div>
        </div>

        <div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs ${
              status.ef_is_met
                ? "bg-success-tint text-success"
                : "bg-brand-tint text-brand"
            }`}
          >
            {status.ef_is_met ? "Target met" : "Building your cushion"}
          </span>

          <h2 className="mt-5 font-serif text-3xl">
            {status.ef_is_met
              ? "Your safety cushion is ready."
              : `${formatMAD(status.ef_gap_cents)} left to reach your target.`}
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {status.ef_is_met
              ? "Your emergency fund has reached its target. Nisba now recommends considering investments for this month’s Freedom Funds."
              : "Until the target is reached, Nisba recommends directing this month’s Freedom Funds toward your emergency fund."}
          </p>

          {status.ef_is_met && amountAboveTarget > 0 && (
            <p className="mt-3 text-sm text-success">
              Your balance is {formatMAD(amountAboveTarget)} above the target.
            </p>
          )}
        </div>
      </section>

      {/* Fund numbers */}
      <section className="grid gap-px overflow-hidden rounded-[18px] border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-surface p-6">
          <p className="text-sm text-muted-foreground">
            Current balance
          </p>
          <p className="mt-3 font-serif text-2xl text-brand">
            {formatMAD(status.ef_current_balance_cents)}
          </p>
        </div>

        <div className="bg-surface p-6">
          <p className="text-sm text-muted-foreground">Target</p>
          <p className="mt-3 font-serif text-2xl">
            {formatMAD(status.ef_target_cents)}
          </p>
        </div>

        <div className="bg-surface p-6">
          <p className="text-sm text-muted-foreground">
            Remaining gap
          </p>
          <p className="mt-3 font-serif text-2xl">
            {formatMAD(status.ef_gap_cents)}
          </p>
        </div>

        <div className="bg-surface p-6">
          <p className="text-sm text-muted-foreground">
            Estimated time
          </p>
          <p className="mt-3 font-serif text-2xl">
            {status.ef_is_met
              ? "Complete"
              : status.projected_months_to_target !== null
                ? `${status.projected_months_to_target} months`
                : "Not available"}
          </p>
        </div>
      </section>

      {/* Recommendation */}
      <section
        className={`rounded-[20px] border p-6 md:p-8 ${
          status.ef_is_met
            ? "border-success/20 bg-success-tint"
            : "border-brand/20 bg-brand-tint"
        }`}
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Nisba’s recommendation for{" "}
          {MONTHS[status.month - 1]} {status.year}
        </p>

        <div className="mt-5 grid gap-7 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h2
              className={`font-serif text-2xl ${
                status.ef_is_met ? "text-success" : "text-brand"
              }`}
            >
              {status.ef_is_met
                ? "Consider investing your Freedom Funds."
                : "Prioritise your emergency fund."}
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {status.ef_is_met
                ? `${formatMAD(
                    status.recommended_investments_cents
                  )} is currently recommended for investments.`
                : `${formatMAD(
                    status.recommended_ef_cents
                  )} is currently recommended for your emergency fund.`}
            </p>

            {status.monthly_income_cents === 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                No income is recorded for this month, so the current
                recommendation is zero.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {status.ef_is_met ? (
              <Link
                href="/investments"
                className="rounded-[10px] bg-success px-5 py-3 text-sm font-medium text-white"
              >
                View investments
              </Link>
            ) : (
              <span className="rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white">
                Build the fund first
              </span>
            )}
          </div>
        </div>

        <p className="mt-6 border-t border-current/10 pt-5 text-xs leading-relaxed text-muted-foreground">
          This is guidance only. Nisba does not move money, block investing,
          or connect to your bank account.
        </p>
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px]">
        {/* Current month context */}
        <section className="rounded-[20px] border border-border bg-surface p-6 md:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Monthly context
          </p>
          <h2 className="mt-3 font-serif text-2xl">
            Your three-bucket plan
          </h2>

          <div className="mt-7 space-y-6">
            <div>
              <div className="mb-2 flex flex-wrap justify-between gap-3 text-sm">
                <span>Freedom Funds</span>
                <span className="font-mono tabular-nums">
                  {formatMAD(status.freedom_funds_cents)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-brand" />
            </div>

            <div>
              <div className="mb-2 flex flex-wrap justify-between gap-3 text-sm">
                <span>Essentials</span>
                <span className="font-mono tabular-nums">
                  {formatMAD(status.essentials_cents)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-brand-mid" />
            </div>

            <div>
              <div className="mb-2 flex flex-wrap justify-between gap-3 text-sm">
                <span>Lifestyle</span>
                <span className="font-mono tabular-nums">
                  {formatMAD(status.lifestyle_cents)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-gold" />
            </div>
          </div>

          <p className="mt-7 text-sm text-muted-foreground">
            Based on {formatMAD(status.monthly_income_cents)} of income
            recorded this month.
          </p>
        </section>

        {/* Update balance */}
        <aside className="rounded-[20px] border border-border bg-surface p-6 lg:sticky lg:top-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Balance snapshot
          </p>
          <h2 className="mt-3 font-serif text-2xl">
            Update current balance
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Enter the total amount currently held in your emergency fund.
            This replaces the previous balance.
          </p>

          <form onSubmit={handleUpdateBalance} className="mt-7">
            <label className="block text-sm font-medium">
              New total balance
              <div className="mt-2 flex items-center rounded-[10px] border border-border bg-background px-4 focus-within:border-brand">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={balanceInput}
                  onChange={(event) =>
                    setBalanceInput(event.target.value)
                  }
                  placeholder={String(
                    status.ef_current_balance_cents / 100
                  )}
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
                />
                <span className="text-xs text-muted-foreground">
                  MAD
                </span>
              </div>
            </label>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Do not enter only the latest deposit. Enter the complete
              emergency-fund balance after that deposit.
            </p>

            {updateError && (
              <p
                role="alert"
                className="mt-4 rounded-[10px] border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger"
              >
                {updateError}
              </p>
            )}

            <button
              type="submit"
              disabled={isUpdating}
              className="mt-5 w-full rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUpdating ? "Updating balance…" : "Update balance"}
            </button>
          </form>

          <p className="mt-5 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
            Your target was calculated during onboarding and does not change
            automatically when monthly income changes.
          </p>
        </aside>
      </div>
    </div>
  );
}

export default function EmergencyFundPage() {
  return (
    <AuthGuard>
      <EmergencyFundManager />
    </AuthGuard>
  );
}