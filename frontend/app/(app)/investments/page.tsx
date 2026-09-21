"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createInvestment,
  deleteInvestment,
  getBudgetEngineStatus,
  getInvestmentSummary,
  listInvestments,
  listInvestmentTypes,
  type Investment,
} from "@/lib/api";
import { getToken } from "@/lib/auth";
import { AuthGuard } from "../../auth-guard";

const TYPE_COLORS = [
  "bg-brand",
  "bg-success",
  "bg-gold",
  "bg-brand-mid",
  "bg-danger",
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

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function currentLocalDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function InvestmentsManager() {
  const token = getToken()!;
  const queryClient = useQueryClient();

  const [typeId, setTypeId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(currentLocalDate());
  const [note, setNote] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    data: types,
    isPending: typesPending,
    error: typesError,
  } = useQuery({
    queryKey: ["investment-types"],
    queryFn: () => listInvestmentTypes(token),
    retry: false,
  });

  const {
    data: investments,
    isPending: investmentsPending,
    error: investmentsError,
    refetch: refetchInvestments,
  } = useQuery({
    queryKey: ["investments"],
    queryFn: () => listInvestments(token),
    retry: false,
  });

  const {
    data: summary,
    isPending: summaryPending,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["investment-summary"],
    queryFn: () => getInvestmentSummary(token),
    retry: false,
  });

  const { data: budgetStatus } = useQuery({
    queryKey: ["budget-engine-status"],
    queryFn: () => getBudgetEngineStatus(token),
    retry: false,
  });

  const selectedTypeId = typeId ?? types?.[0]?.id ?? null;

  function typeName(investmentTypeId: number) {
    return (
      types?.find((type) => type.id === investmentTypeId)?.name ??
      "Unknown type"
    );
  }

  async function refreshInvestmentData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["investments"] }),
      queryClient.invalidateQueries({
        queryKey: ["investment-summary"],
      }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (isSaving) return;

    setFormError(null);

    const amountCents = toCents(Number(amount));

    if (!amountCents || amountCents <= 0) {
      setFormError("Enter a valid investment amount.");
      return;
    }

    if (!selectedTypeId) {
      setFormError("Choose an investment type.");
      return;
    }

    setIsSaving(true);

    try {
      await createInvestment(token, {
        investment_type_id: selectedTypeId,
        amount_cents: amountCents,
        date,
        note: note.trim() || undefined,
      });

      setAmount("");
      setNote("");
      setDate(currentLocalDate());

      await refreshInvestmentData();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not record this investment."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(investment: Investment) {
    const confirmed = window.confirm(
      `Delete this ${formatMAD(investment.amount_cents)} investment record?`
    );

    if (!confirmed) return;

    setListError(null);

    try {
      await deleteInvestment(token, investment.id);
      await refreshInvestmentData();
    } catch (caughtError) {
      setListError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not delete this investment."
      );
    }
  }

  const loading =
    typesPending || investmentsPending || summaryPending;

  const loadingError =
    typesError || investmentsError || summaryError;

  const sortedTypes = [...(summary?.by_type ?? [])].sort(
    (a, b) => b.amount_cents - a.amount_cents
  );

  const largestType = sortedTypes[0];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      {/* Heading */}
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
          Freedom Funds · Long-term growth
        </p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">
          Investments
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Record money you contribute to investments and see how those
          contributions are distributed. Nisba does not connect to a broker
          or track live market prices.
        </p>
      </div>

      {/* Emergency fund guidance */}
      {budgetStatus && (
        <section
          className={`rounded-[18px] border p-6 ${
            budgetStatus.ef_is_met
              ? "border-success/20 bg-success-tint"
              : "border-gold/20 bg-gold-tint"
          }`}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Before investing
              </p>
              <h2
                className={`mt-2 font-serif text-xl ${
                  budgetStatus.ef_is_met
                    ? "text-success"
                    : "text-gold"
                }`}
              >
                {budgetStatus.ef_is_met
                  ? "Your emergency-fund target is met."
                  : "Your emergency fund is still below its target."}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {budgetStatus.ef_is_met
                  ? `Nisba currently recommends considering ${formatMAD(
                      budgetStatus.recommended_investments_cents
                    )} of this month’s Freedom Funds for investments.`
                  : `Nisba currently recommends putting ${formatMAD(
                      budgetStatus.recommended_ef_cents
                    )} toward your emergency fund first. You can still record investments if you choose.`}
              </p>
            </div>

            <Link
              href="/emergency-fund"
              className="w-fit text-sm font-medium text-brand underline decoration-brand/30 underline-offset-4"
            >
              View emergency fund →
            </Link>
          </div>
        </section>
      )}

      {/* Investment summary */}
      <section className="grid gap-px overflow-hidden rounded-[18px] border border-border bg-border sm:grid-cols-3">
        <div className="bg-surface p-6">
          <p className="text-sm text-muted-foreground">
            Total contributed
          </p>
          <p className="mt-3 font-serif text-3xl text-brand">
            {summary
              ? formatMAD(summary.total_invested_cents)
              : "—"}
          </p>
        </div>

        <div className="bg-surface p-6">
          <p className="text-sm text-muted-foreground">
            Investment records
          </p>
          <p className="mt-3 font-serif text-3xl">
            {investments?.length ?? "—"}
          </p>
        </div>

        <div className="bg-surface p-6">
          <p className="text-sm text-muted-foreground">
            Largest contribution type
          </p>
          <p className="mt-3 font-serif text-2xl">
            {largestType?.type ?? "No data yet"}
          </p>
          {largestType && (
            <p className="mt-2 text-xs text-muted-foreground">
              {formatMAD(largestType.amount_cents)}
            </p>
          )}
        </div>
      </section>

      {/* Distribution */}
      <section className="rounded-[20px] border border-border bg-surface p-6 md:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
          Contribution mix
        </p>
        <h2 className="mt-3 font-serif text-2xl">
          Contributions by investment type
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This shows recorded contributions, not current market value.
        </p>

        {sortedTypes.length === 0 ? (
          <p className="mt-7 text-sm text-muted-foreground">
            No investment contributions have been recorded yet.
          </p>
        ) : (
          <div className="mt-8 space-y-6">
            {sortedTypes.map((item, index) => {
              const percentage =
                summary && summary.total_invested_cents > 0
                  ? (item.amount_cents /
                      summary.total_invested_cents) *
                    100
                  : 0;

              const color =
                TYPE_COLORS[index % TYPE_COLORS.length];

              return (
                <div key={item.type}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${color}`}
                      />
                      <span>{item.type}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">
                        {percentage.toFixed(1)}%
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatMAD(item.amount_cents)}
                      </span>
                    </div>
                  </div>

                  <div className="h-2.5 overflow-hidden rounded-full bg-border">
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-[350px_1fr]">
        {/* Add investment */}
        <aside className="rounded-[20px] border border-border bg-surface p-6 lg:sticky lg:top-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            New contribution
          </p>
          <h2 className="mt-3 font-serif text-2xl">
            Record an investment
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Enter an amount you actually contributed. This does not buy an
            asset or transfer money.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <label className="block text-sm font-medium">
              Investment type
              <select
                required
                value={selectedTypeId ?? ""}
                onChange={(event) =>
                  setTypeId(Number(event.target.value))
                }
                disabled={typesPending || !types?.length}
                className="mt-2 w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brand disabled:opacity-50"
              >
                <option value="" disabled>
                  Choose a type
                </option>
                {types?.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium">
              Amount contributed
              <div className="mt-2 flex items-center rounded-[10px] border border-border bg-background px-4 focus-within:border-brand">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
                />
                <span className="text-xs text-muted-foreground">
                  MAD
                </span>
              </div>
            </label>

            <label className="block text-sm font-medium">
              Contribution date
              <input
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-2 w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brand"
              />
            </label>

            <label className="block text-sm font-medium">
              Note
              <input
                type="text"
                maxLength={255}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. Monthly ETF contribution"
                className="mt-2 w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-brand"
              />
              <span className="mt-2 block text-xs font-normal text-muted-foreground">
                Optional
              </span>
            </label>

            {typesError && (
              <p className="text-sm text-danger">
                Could not load investment types.
              </p>
            )}

            {formError && (
              <p
                role="alert"
                className="rounded-[10px] border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger"
              >
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSaving || typesPending || !types?.length}
              className="w-full rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving
                ? "Recording investment…"
                : "Record investment"}
            </button>
          </form>
        </aside>

        {/* Investment history */}
        <section className="min-w-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              Contribution history
            </p>
            <h2 className="mt-3 font-serif text-2xl">
              Investment records
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Review the investment contributions you have logged.
            </p>
          </div>

          {loading ? (
            <p className="mt-8 text-sm text-muted-foreground">
              Loading investments…
            </p>
          ) : loadingError ? (
            <div className="mt-7 rounded-[16px] border border-border bg-surface p-6">
              <p className="text-sm">
                Could not load your investment records.
              </p>
              <button
                type="button"
                onClick={() => {
                  refetchInvestments();
                  refetchSummary();
                }}
                className="mt-4 text-sm font-medium text-brand underline"
              >
                Try again
              </button>
            </div>
          ) : investments?.length ? (
            <div className="mt-7 overflow-hidden rounded-[18px] border border-border bg-surface">
              {investments.map((investment) => (
                <article
                  key={investment.id}
                  className="border-b border-border p-5 last:border-b-0 md:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">
                          {typeName(investment.investment_type_id)}
                        </h3>
                        <span className="rounded-full bg-success-tint px-2.5 py-1 text-xs text-success">
                          Contribution
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-muted-foreground">
                        {formatDate(investment.date)}
                        {investment.note
                          ? ` · ${investment.note}`
                          : ""}
                      </p>
                    </div>

                    <p className="font-mono text-sm tabular-nums text-success">
                      {formatMAD(investment.amount_cents)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(investment)}
                    className="mt-4 text-sm text-danger"
                  >
                    Delete
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-[18px] border border-dashed border-border bg-surface-alt p-8">
              <h3 className="font-serif text-xl">
                No investments recorded
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Record your first investment contribution using the form.
              </p>
            </div>
          )}

          {listError && (
            <p
              role="alert"
              className="mt-5 rounded-[10px] border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger"
            >
              {listError}
            </p>
          )}
        </section>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Nisba tracks contributions only. It does not calculate investment
        returns, current market value, fees, dividends, or taxes.
      </p>
    </div>
  );
}

export default function InvestmentsPage() {
  return (
    <AuthGuard>
      <InvestmentsManager />
    </AuthGuard>
  );
}