"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDebt,
  deleteDebt,
  listDebts,
  listDebtPayments,
  logDebtPayment,
  type Debt,
  type DebtPaymentFundingSource,
  type DebtPaymentType,
} from "@/lib/api";
import { getToken } from "@/lib/auth";

function toCents(amount: number) {
  return Math.round(amount * 100);
}

function formatMAD(cents: number) {
  return `${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} MAD`;
}

function localDateInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function DebtCard({ debt }: { debt: Debt }) {
  const token = getToken()!;
  const queryClient = useQueryClient();

  const [paymentType, setPaymentType] = useState<DebtPaymentType>("regular");
  const [fundingSource, setFundingSource] = useState<DebtPaymentFundingSource | "">("");
  const [showHistory, setShowHistory] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(localDateInputValue());
  const [paymentNote, setPaymentNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    data: payments,
    isPending: paymentsPending,
    error: paymentsError,
  } = useQuery({
    queryKey: ["debt-payments", debt.id],
    queryFn: () => listDebtPayments(token, debt.id),
    enabled: showHistory,
    retry: false,
  });

  const progress = Math.max(0, Math.min(debt.progress_pct, 100));

  async function handleLogPayment(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (isPaying) return;

    setActionError(null);

    const paymentCents = toCents(Number(paymentAmount));

    if (!paymentCents || paymentCents <= 0) {
      setActionError("Enter a valid payment amount.");
      return;
    }

    if (paymentCents > debt.current_balance_cents) {
      setActionError(
        `The payment cannot exceed the remaining balance of ${formatMAD(
          debt.current_balance_cents
        )}.`
      );
      return;
    }

    setIsPaying(true);

    try {
      await logDebtPayment(token, debt.id, {
        amount_cents: paymentCents,
        date: paymentDate,
        payment_type: paymentType,
        funding_source:
          paymentType === "extra"
            ? fundingSource || null
            : null,
        note: paymentNote.trim() || undefined,
      });

      setPaymentAmount("");
      setPaymentNote("");
      setPaymentType("regular");
      setFundingSource("");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["debts"] }),
        queryClient.invalidateQueries({
          queryKey: ["debt-payments", debt.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not record the payment."
      );
    } finally {
      setIsPaying(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete “${debt.name}”? Its entire payment history will also be deleted.`
    );

    if (!confirmed || isDeleting) return;

    setActionError(null);
    setIsDeleting(true);

    try {
      await deleteDebt(token, debt.id);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["debts"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not delete this debt."
      );
      setIsDeleting(false);
    }
  }

  return (
    <article className="overflow-hidden rounded-[20px] border border-border bg-surface">
      {/* Debt overview */}
      <div className="p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-serif text-2xl">{debt.name}</h2>

              <span
                className={`rounded-full px-3 py-1 text-xs ${
                  debt.is_paid_off
                    ? "bg-success-tint text-success"
                    : "bg-brand-tint text-brand"
                }`}
              >
                {debt.is_paid_off ? "Paid off" : "Active"}
              </span>
            </div>

            {debt.payoff_target_date && (
              <p className="mt-2 text-sm text-muted-foreground">
                Target payoff: {formatDate(debt.payoff_target_date)}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-fit text-sm text-danger transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? "Deleting…" : "Delete debt"}
          </button>
        </div>

        <div className="mt-7">
          <div className="mb-3 flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Repayment progress</span>
            <span className="font-mono text-brand">{progress}%</span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-border">
            <div
              className={`h-full rounded-full ${
                debt.is_paid_off ? "bg-success" : "bg-brand"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-7 grid gap-px overflow-hidden rounded-[14px] border border-border bg-border sm:grid-cols-3">
          <div className="bg-background p-5">
            <p className="text-xs text-muted-foreground">Starting balance</p>
            <p className="mt-2 font-mono text-sm tabular-nums">
              {formatMAD(debt.starting_balance_cents)}
            </p>
          </div>

          <div className="bg-background p-5">
            <p className="text-xs text-muted-foreground">Total paid</p>
            <p className="mt-2 font-mono text-sm tabular-nums text-success">
              {formatMAD(debt.total_paid_cents)}
            </p>
          </div>

          <div className="bg-background p-5">
            <p className="text-xs text-muted-foreground">Remaining balance</p>
            <p className="mt-2 font-mono text-sm tabular-nums text-brand">
              {formatMAD(debt.current_balance_cents)}
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          Planned monthly payment:{" "}
          <span className="font-mono text-foreground">
            {formatMAD(debt.monthly_payment_cents)}
          </span>
        </p>
      </div>

      {/* Record an actual payment */}
      {!debt.is_paid_off && (
        <div className="border-t border-border bg-surface-alt p-6 md:p-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Existing debt
          </p>
          <h3 className="mt-2 font-serif text-xl">
            Record a payment you made
          </h3>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A regular payment counts under monthly Essentials. An extra
            payment reduces your debt but appears separately from normal
            monthly expenses.
          </p>

          <form
            onSubmit={handleLogPayment}
            className="mt-6 grid gap-4 sm:grid-cols-2"
          >
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium">
                What kind of payment is this?
              </legend>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label
                  className={`cursor-pointer rounded-[12px] border p-4 transition-colors ${
                    paymentType === "regular"
                      ? "border-brand bg-brand-tint"
                      : "border-border bg-surface"
                  }`}
                >
                  <input
                    type="radio"
                    name={`payment-type-${debt.id}`}
                    value="regular"
                    checked={paymentType === "regular"}
                    onChange={() => {
                      setPaymentType("regular");
                      setFundingSource("");
                    }}
                    className="mr-2"
                  />

                  <span className="text-sm font-medium">
                    Regular payment
                  </span>

                  <span className="mt-1 block pl-6 text-xs leading-relaxed text-muted-foreground">
                    Your normal installment. It counts under monthly
                    Essentials.
                  </span>
                </label>

                <label
                  className={`cursor-pointer rounded-[12px] border p-4 transition-colors ${
                    paymentType === "extra"
                      ? "border-gold bg-gold/10"
                      : "border-border bg-surface"
                  }`}
                >
                  <input
                    type="radio"
                    name={`payment-type-${debt.id}`}
                    value="extra"
                    checked={paymentType === "extra"}
                    onChange={() => setPaymentType("extra")}
                    className="mr-2"
                  />

                  <span className="text-sm font-medium">
                    Extra payment
                  </span>

                  <span className="mt-1 block pl-6 text-xs leading-relaxed text-muted-foreground">
                    An advance or exceptional payment. It is shown
                    separately from regular expenses.
                  </span>
                </label>
              </div>
            </fieldset>

            {paymentType === "extra" && (
              <label className="text-sm font-medium sm:col-span-2">
                Where did this extra payment come from?{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>

                <select
                  value={fundingSource}
                  onChange={(event) =>
                    setFundingSource(
                      event.target.value as
                        | DebtPaymentFundingSource
                        | ""
                    )
                  }
                  className="mt-2 w-full rounded-[10px] border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-brand"
                >
                  <option value="">Prefer not to say</option>
                  <option value="current_income">
                    This month&apos;s income
                  </option>
                  <option value="existing_savings">
                    Existing savings
                  </option>
                </select>

                <span className="mt-2 block text-xs font-normal leading-relaxed text-muted-foreground">
                  This provides context only. Nisba will not
                  automatically subtract the payment from your
                  reported savings.
                </span>
              </label>
            )}

            <label className="text-sm font-medium">
              Actual amount paid
              <div className="mt-2 flex items-center rounded-[10px] border border-border bg-surface px-4 focus-within:border-brand">
                <input
                  type="number"
                  min="0.01"
                  max={debt.current_balance_cents / 100}
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(event) =>
                    setPaymentAmount(event.target.value)
                  }
                  placeholder="0.00"
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
                />
                <span className="text-xs text-muted-foreground">MAD</span>
              </div>
            </label>

            <label className="text-sm font-medium">
              Payment date
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
                className="mt-2 w-full rounded-[10px] border border-border bg-surface px-4 py-3 text-sm outline-none focus:border-brand"
              />
            </label>

            <label className="text-sm font-medium sm:col-span-2">
              Note
              <input
                type="text"
                maxLength={255}
                value={paymentNote}
                onChange={(event) => setPaymentNote(event.target.value)}
                placeholder="Optional note about this payment"
                className="mt-2 w-full rounded-[10px] border border-border bg-surface px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-brand"
              />
            </label>

            {actionError && (
              <p
                role="alert"
                className="rounded-[10px] border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger sm:col-span-2"
              >
                {actionError}
              </p>
            )}

            <button
              type="submit"
              disabled={isPaying}
              className="w-fit rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
            >
              {isPaying ? "Recording payment…" : "Record payment"}
            </button>
          </form>
        </div>
      )}

      {debt.is_paid_off && actionError && (
        <p
          role="alert"
          className="mx-6 mb-6 rounded-[10px] border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger md:mx-8"
        >
          {actionError}
        </p>
      )}

      {/* Payment history */}
      <div className="border-t border-border p-6 md:px-8">
        <button
          type="button"
          onClick={() => setShowHistory((current) => !current)}
          className="text-sm font-medium text-brand underline decoration-brand/30 underline-offset-4"
        >
          {showHistory ? "Hide payment history" : "Show payment history"}
        </button>

        {showHistory && (
          <div className="mt-5">
            {paymentsPending ? (
              <p className="text-sm text-muted-foreground">
                Loading payment history…
              </p>
            ) : paymentsError ? (
              <p className="text-sm text-danger">
                Could not load payment history.
              </p>
            ) : payments?.length ? (
              <div className="overflow-hidden rounded-[12px] border border-border">
                {[...payments]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((payment) => (
                    <div
                      key={payment.id}
                      className="flex flex-col gap-2 border-b border-border px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm">
                          {formatDate(payment.date)}
                        </p>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                            payment.payment_type === "extra"
                              ? "bg-gold/10 text-gold"
                              : "bg-brand-tint text-brand"
                          }`}
                        >
                          {payment.payment_type === "extra"
                            ? "Extra payment"
                            : "Regular payment"}
                        </span>
                      </div>

                      {payment.payment_type === "extra" && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Funding:{" "}
                          {payment.funding_source === "current_income"
                            ? "this month’s income"
                            : payment.funding_source === "existing_savings"
                              ? "existing savings"
                              : "not disclosed"}
                        </p>
                      )}

                      {payment.note && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {payment.note}
                        </p>
                      )}
                    </div>
                      <span className="font-mono text-sm tabular-nums text-success">
                        {formatMAD(payment.amount_cents)}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No payments recorded yet.
              </p>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default function DebtsPage() {
  const token = getToken()!;
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [startingBalance, setStartingBalance] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const {
    data: debts,
    isPending,
    error: debtsError,
    refetch,
  } = useQuery({
    queryKey: ["debts"],
    queryFn: () => listDebts(token),
    retry: false,
  });

  const totalRemaining =
    debts?.reduce(
      (total, debt) => total + debt.current_balance_cents,
      0
    ) ?? 0;

  const totalPaid =
    debts?.reduce((total, debt) => total + debt.total_paid_cents, 0) ?? 0;

  const activeDebts = debts?.filter((debt) => !debt.is_paid_off).length ?? 0;

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) return;

    setCreateError(null);

    const startingBalanceCents = toCents(Number(startingBalance));
    const monthlyPaymentCents = toCents(Number(monthlyPayment));

    if (!name.trim()) {
      setCreateError("Enter a name for this debt.");
      return;
    }

    if (!startingBalanceCents || startingBalanceCents <= 0) {
      setCreateError("Enter a valid starting balance.");
      return;
    }

    if (!monthlyPaymentCents || monthlyPaymentCents <= 0) {
      setCreateError("Enter a valid planned monthly payment.");
      return;
    }

    setIsCreating(true);

    try {
      await createDebt(token, {
        name: name.trim(),
        balance_cents: startingBalanceCents,
        monthly_payment_cents: monthlyPaymentCents,
        payoff_target_date: targetDate || undefined,
      });

      setName("");
      setStartingBalance("");
      setMonthlyPayment("");
      setTargetDate("");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["debts"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    } catch (caughtError) {
      setCreateError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not add this debt."
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
      {/* Heading */}
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
          Essentials
        </p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">Debts</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Add each debt once, then record the payments you actually make.
          Recorded payments reduce the remaining balance and appear under
          Essentials on your dashboard.
        </p>
      </div>

      {/* Summary */}
      <section className="grid gap-px overflow-hidden rounded-[18px] border border-border bg-border sm:grid-cols-3">
        <div className="bg-surface p-6">
          <p className="text-sm text-muted-foreground">Active debts</p>
          <p className="mt-3 font-serif text-3xl text-brand">
            {activeDebts}
          </p>
        </div>

        <div className="bg-surface p-6">
          <p className="text-sm text-muted-foreground">Total remaining</p>
          <p className="mt-3 font-serif text-2xl">
            {formatMAD(totalRemaining)}
          </p>
        </div>

        <div className="bg-surface p-6">
          <p className="text-sm text-muted-foreground">Total paid</p>
          <p className="mt-3 font-serif text-2xl text-success">
            {formatMAD(totalPaid)}
          </p>
        </div>
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-[340px_1fr]">
        {/* Add a new debt */}
        <aside className="rounded-[20px] border border-border bg-surface p-6 lg:sticky lg:top-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            New debt
          </p>
          <h2 className="mt-3 font-serif text-2xl">Add a debt</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Use this form only when registering a new debt. It does not record
            a payment.
          </p>

          <form onSubmit={handleCreate} className="mt-7 space-y-5">
            <label className="block text-sm font-medium">
              Debt name
              <input
                type="text"
                required
                maxLength={255}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Car loan"
                className="mt-2 w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-brand"
              />
            </label>

            <label className="block text-sm font-medium">
              Starting balance
              <div className="mt-2 flex items-center rounded-[10px] border border-border bg-background px-4 focus-within:border-brand">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={startingBalance}
                  onChange={(event) =>
                    setStartingBalance(event.target.value)
                  }
                  placeholder="Total amount owed"
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
                />
                <span className="text-xs text-muted-foreground">MAD</span>
              </div>
              <span className="mt-2 block text-xs font-normal leading-relaxed text-muted-foreground">
                The total amount owed when you add the debt.
              </span>
            </label>

            <label className="block text-sm font-medium">
              Planned monthly payment
              <div className="mt-2 flex items-center rounded-[10px] border border-border bg-background px-4 focus-within:border-brand">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={monthlyPayment}
                  onChange={(event) =>
                    setMonthlyPayment(event.target.value)
                  }
                  placeholder="Expected each month"
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
                />
                <span className="text-xs text-muted-foreground">MAD</span>
              </div>
              <span className="mt-2 block text-xs font-normal leading-relaxed text-muted-foreground">
                This is your plan. It does not create a payment.
              </span>
            </label>

            <label className="block text-sm font-medium">
              Target payoff date
              <input
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                className="mt-2 w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brand"
              />
              <span className="mt-2 block text-xs font-normal text-muted-foreground">
                Optional
              </span>
            </label>

            {createError && (
              <p
                role="alert"
                className="rounded-[10px] border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger"
              >
                {createError}
              </p>
            )}

            <button
              type="submit"
              disabled={isCreating}
              className="w-full rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? "Adding debt…" : "Add new debt"}
            </button>
          </form>
        </aside>

        {/* Existing debts */}
        <section className="min-w-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              Existing debts
            </p>
            <h2 className="mt-3 font-serif text-2xl">
              Manage payments
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Record money you have actually paid and review your progress.
            </p>
          </div>

          {isPending ? (
            <p className="mt-8 text-sm text-muted-foreground">
              Loading your debts…
            </p>
          ) : debtsError ? (
            <div className="mt-8 rounded-[16px] border border-border bg-surface p-6">
              <p className="text-sm">
                Could not load your debts. Check that the backend is running.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-4 text-sm font-medium text-brand underline"
              >
                Try again
              </button>
            </div>
          ) : debts?.length ? (
            <div className="mt-7 space-y-6">
              {debts.map((debt) => (
                <DebtCard key={debt.id} debt={debt} />
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-[18px] border border-dashed border-border bg-surface-alt p-8">
              <h3 className="font-serif text-xl">No debts added yet</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                When you add a debt using the form, it will appear here for
                payment tracking.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}