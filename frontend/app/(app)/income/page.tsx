"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createIncomeEntry,
  deleteIncomeEntry,
  getFixedSalary,
  getMonthlyIncomeSummary,
  getOnboardingStatus,
  listIncomeEntries,
  setFixedSalary,
  updateIncomeEntry,
  type IncomeEntry,
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

const SOURCE_LABEL = {
  fixed: "Fixed salary",
  freelance: "Freelance",
};

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

function defaultDateForMonth(year: number, month: number) {
  const today = new Date();

  if (
    year === today.getFullYear() &&
    month === today.getMonth() + 1
  ) {
    return currentLocalDate();
  }

  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function IncomeManager() {
  const token = getToken()!;
  const queryClient = useQueryClient();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [source, setSource] =
    useState<IncomeEntry["source"]>("freelance");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(
    defaultDateForMonth(today.getFullYear(), today.getMonth() + 1)
  );
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [entryError, setEntryError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [isSavingEntry, setIsSavingEntry] = useState(false);

  const [salaryInput, setSalaryInput] = useState("");
  const [salaryError, setSalaryError] = useState<string | null>(null);
  const [isSavingSalary, setIsSavingSalary] = useState(false);

  const {
    data: onboarding,
    isPending: onboardingPending,
    error: onboardingError,
  } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => getOnboardingStatus(token),
    retry: false,
  });

  const {
    data: entries,
    isPending: entriesPending,
    error: entriesError,
    refetch: refetchEntries,
  } = useQuery({
    queryKey: ["income-entries", year, month],
    queryFn: () => listIncomeEntries(token, year, month),
    retry: false,
  });

  const {
    data: summary,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["income-summary", year, month],
    queryFn: () => getMonthlyIncomeSummary(token, year, month),
    retry: false,
  });

  const hasFixedIncome =
    onboarding?.income_mode === "fixed_only" ||
    onboarding?.income_mode === "fixed_plus_freelance";

  const canAddFreelance =
    onboarding?.income_mode === "freelance_only" ||
    onboarding?.income_mode === "fixed_plus_freelance";

  const {
    data: fixedSalary,
    isPending: fixedSalaryPending,
    error: fixedSalaryError,
  } = useQuery({
    queryKey: ["fixed-salary"],
    queryFn: () => getFixedSalary(token),
    enabled: hasFixedIncome,
    retry: false,
  });

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(
    lastDay
  ).padStart(2, "0")}`;


  function resetEntryForm() {
    setEditingId(null);
    setSource("freelance");
    setAmount("");
    setDate(defaultDateForMonth(year, month));
    setNote("");
    setEntryError(null);
  }

  function changeMonth(direction: number) {
    let nextMonth = month + direction;
    let nextYear = year;

    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    }

    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }

    setEditingId(null);
    setSource("freelance");
    setAmount("");
    setDate(defaultDateForMonth(nextYear, nextMonth));
    setNote("");
    setEntryError(null);
    setMonth(nextMonth);
    setYear(nextYear);
  }

  function handleEdit(entry: IncomeEntry) {
    setEditingId(entry.id);
    setSource(entry.source);
    setAmount((entry.amount_cents / 100).toFixed(2));
    setDate(entry.date);
    setNote(entry.note ?? "");
    setEntryError(null);
  }

  async function refreshIncomeData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["income-entries"] }),
      queryClient.invalidateQueries({ queryKey: ["income-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["budget-engine-status"] }),
    ]);
  }

  async function handleSaveSalary(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (isSavingSalary) return;

    setSalaryError(null);

    const salaryCents = toCents(Number(salaryInput));

    if (!salaryCents || salaryCents <= 0) {
      setSalaryError("Enter a valid monthly salary.");
      return;
    }

    setIsSavingSalary(true);

    try {
      await setFixedSalary(token, salaryCents);
      setSalaryInput("");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["fixed-salary"] }),
        refreshIncomeData(),
      ]);
    } catch (caughtError) {
      setSalaryError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save the fixed salary."
      );
    } finally {
      setIsSavingSalary(false);
    }
  }

  async function handleEntrySubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (isSavingEntry) return;

    setEntryError(null);

    const amountCents = toCents(Number(amount));

    if (!amountCents || amountCents <= 0) {
      setEntryError("Enter a valid income amount.");
      return;
    }

    if (editingId === null && !canAddFreelance) {
      setEntryError(
        "Your income mode does not allow manual freelance entries."
      );
      return;
    }

    setIsSavingEntry(true);

    try {
      const entryData = {
        source,
        amount_cents: amountCents,
        date,
        note: note.trim() || undefined,
      };

      if (editingId !== null) {
        await updateIncomeEntry(token, editingId, entryData);
      } else {
        await createIncomeEntry(token, entryData);
      }

      resetEntryForm();
      await refreshIncomeData();
    } catch (caughtError) {
      setEntryError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save this income entry."
      );
    } finally {
      setIsSavingEntry(false);
    }
  }

  async function handleDelete(entry: IncomeEntry) {
    if (entry.source === "fixed") return;

    const confirmed = window.confirm(
      `Delete this ${formatMAD(entry.amount_cents)} freelance entry?`
    );

    if (!confirmed) return;

    setListError(null);

    try {
      await deleteIncomeEntry(token, entry.id);

      if (editingId === entry.id) {
        resetEntryForm();
      }

      await refreshIncomeData();
    } catch (caughtError) {
      setListError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not delete this income entry."
      );
    }
  }

  const loading = onboardingPending || entriesPending;
  const loadingError =
    onboardingError || entriesError || summaryError;

  const showEntryForm = canAddFreelance || editingId !== null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      {/* Heading */}
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
          Money coming in
        </p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">
          Income
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Fixed salary is generated automatically for the current month.
          Freelance income is recorded manually whenever you receive it.
        </p>
      </div>

      {/* Fixed salary configuration */}
      {hasFixedIncome && (
        <section className="grid gap-7 rounded-[20px] border border-border bg-surface p-6 md:grid-cols-[1fr_360px] md:items-center md:p-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              Automatic income
            </p>
            <h2 className="mt-3 font-serif text-2xl">
              Fixed monthly salary
            </h2>

            {fixedSalaryPending ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Loading salary configuration…
              </p>
            ) : fixedSalaryError ? (
              <p className="mt-4 text-sm text-danger">
                Could not load the fixed salary.
              </p>
            ) : fixedSalary?.fixed_salary_cents ? (
              <div className="mt-5">
                <p className="font-serif text-3xl text-brand">
                  {formatMAD(fixedSalary.fixed_salary_cents)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Configured monthly amount
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No fixed salary is configured yet.
              </p>
            )}

            <p className="mt-5 max-w-xl text-xs leading-relaxed text-muted-foreground">
              Nisba creates one fixed-income entry when the current month is
              loaded. Changing this amount does not rewrite income entries
              that were already created.
            </p>
          </div>

          <form
            onSubmit={handleSaveSalary}
            className="rounded-[16px] bg-background p-5"
          >
            <label className="block text-sm font-medium">
              New monthly salary
              <div className="mt-2 flex items-center rounded-[10px] border border-border bg-surface px-4 focus-within:border-brand">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={salaryInput}
                  onChange={(event) =>
                    setSalaryInput(event.target.value)
                  }
                  placeholder={
                    fixedSalary?.fixed_salary_cents
                      ? String(fixedSalary.fixed_salary_cents / 100)
                      : "0.00"
                  }
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
                />
                <span className="text-xs text-muted-foreground">MAD</span>
              </div>
            </label>

            {salaryError && (
              <p
                role="alert"
                className="mt-4 rounded-[10px] border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger"
              >
                {salaryError}
              </p>
            )}

            <button
              type="submit"
              disabled={isSavingSalary}
              className="mt-4 rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingSalary
                ? "Saving salary…"
                : fixedSalary?.fixed_salary_cents
                  ? "Update salary"
                  : "Set salary"}
            </button>
          </form>
        </section>
      )}

      {/* Month navigation */}
      <section className="flex items-center justify-between rounded-[16px] border border-border bg-surface p-4">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          aria-label="Previous month"
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border text-brand transition-colors hover:bg-brand-tint"
        >
          ←
        </button>

        <div className="text-center">
          <p className="font-serif text-xl">
            {MONTHS[month - 1]} {year}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Monthly income
          </p>
        </div>

        <button
          type="button"
          onClick={() => changeMonth(1)}
          aria-label="Next month"
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border text-brand transition-colors hover:bg-brand-tint"
        >
          →
        </button>
      </section>

      {/* Monthly summary */}
      <section className="grid gap-px overflow-hidden rounded-[18px] border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
        <div className="bg-surface p-6">
          <p className="text-sm text-muted-foreground">Total income</p>
          <p className="mt-3 font-serif text-2xl">
            {summary ? formatMAD(summary.total_cents) : "—"}
          </p>
        </div>

        <div className="bg-surface p-6">
          <div className="mb-4 h-1 w-9 rounded-full bg-brand" />
          <p className="text-sm text-muted-foreground">Fixed salary</p>
          <p className="mt-3 font-serif text-2xl">
            {summary ? formatMAD(summary.fixed_cents) : "—"}
          </p>
        </div>

        <div className="bg-surface p-6">
          <div className="mb-4 h-1 w-9 rounded-full bg-success" />
          <p className="text-sm text-muted-foreground">Freelance</p>
          <p className="mt-3 font-serif text-2xl">
            {summary ? formatMAD(summary.freelance_cents) : "—"}
          </p>
        </div>

        <div className="bg-surface p-6">
          <p className="text-sm text-muted-foreground">Entries</p>
          <p className="mt-3 font-serif text-3xl text-brand">
            {summary?.entry_count ?? "—"}
          </p>
        </div>
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-[350px_1fr]">
        {/* Manual entry form */}
        <aside className="rounded-[20px] border border-border bg-surface p-6 lg:sticky lg:top-8">
          {showEntryForm ? (
            <>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                {editingId !== null ? "Editing entry" : "Manual income"}
              </p>
              <h2 className="mt-3 font-serif text-2xl">
                {editingId !== null
                  ? `Edit ${SOURCE_LABEL[source]}`
                  : "Add freelance income"}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {editingId !== null
                  ? "Correct the selected income record."
                  : "Record freelance or variable income when you receive it."}
              </p>

              <form
                onSubmit={handleEntrySubmit}
                className="mt-7 space-y-5"
              >
                <div className="rounded-[10px] bg-background px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    Income source
                  </p>
                  <p className="mt-1 text-sm font-medium">
                    {editingId !== null
                      ? SOURCE_LABEL[source]
                      : "Freelance"}
                  </p>
                </div>

                <label className="block text-sm font-medium">
                  Amount received
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
                  Date received
                  <input
                    type="date"
                    min={monthStart}
                    max={monthEnd}
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
                    placeholder="e.g. Design project"
                    className="mt-2 w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-brand"
                  />
                  <span className="mt-2 block text-xs font-normal text-muted-foreground">
                    Optional
                  </span>
                </label>

                {entryError && (
                  <p
                    role="alert"
                    className="rounded-[10px] border border-danger/20 bg-danger-tint px-4 py-3 text-sm text-danger"
                  >
                    {entryError}
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={isSavingEntry}
                    className="rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingEntry
                      ? "Saving…"
                      : editingId !== null
                        ? "Save changes"
                        : "Add income"}
                  </button>

                  {editingId !== null && (
                    <button
                      type="button"
                      onClick={resetEntryForm}
                      disabled={isSavingEntry}
                      className="rounded-[10px] border border-border px-5 py-3 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
                Automatic income
              </p>
              <h2 className="mt-3 font-serif text-2xl">
                Nothing to enter manually
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Your income mode is fixed salary only. Nisba creates the
                current month’s fixed entry automatically.
              </p>
              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                If an existing fixed entry is incorrect, choose Edit beside
                that entry to correct it.
              </p>
            </>
          )}
        </aside>

        {/* Income history */}
        <section className="min-w-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              Monthly history
            </p>
            <h2 className="mt-3 font-serif text-2xl">
              Income entries
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Review the income recorded for this month.
            </p>
          </div>

          {loading ? (
            <p className="mt-8 text-sm text-muted-foreground">
              Loading income…
            </p>
          ) : loadingError ? (
            <div className="mt-7 rounded-[16px] border border-border bg-surface p-6">
              <p className="text-sm">
                Could not load the income for this month.
              </p>
              <button
                type="button"
                onClick={() => {
                  refetchEntries();
                  refetchSummary();
                }}
                className="mt-4 text-sm font-medium text-brand underline"
              >
                Try again
              </button>
            </div>
          ) : entries?.length ? (
            <div className="mt-7 overflow-hidden rounded-[18px] border border-border bg-surface">
              {entries.map((entry) => (
                <article
                  key={entry.id}
                  className="border-b border-border p-5 last:border-b-0 md:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium">
                          {SOURCE_LABEL[entry.source]}
                        </h3>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${
                            entry.source === "fixed"
                              ? "bg-brand-tint text-brand"
                              : "bg-success-tint text-success"
                          }`}
                        >
                          {entry.source === "fixed"
                            ? "Automatic"
                            : "Manual"}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-muted-foreground">
                        {formatDate(entry.date)}
                        {entry.note ? ` · ${entry.note}` : ""}
                      </p>
                    </div>

                    <p className="font-mono text-sm tabular-nums">
                      {formatMAD(entry.amount_cents)}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4">
                    <button
                      type="button"
                      onClick={() => handleEdit(entry)}
                      className="text-sm font-medium text-brand underline decoration-brand/30 underline-offset-4"
                    >
                      Edit
                    </button>

                    {entry.source === "freelance" && (
                      <button
                        type="button"
                        onClick={() => handleDelete(entry)}
                        className="text-sm text-danger"
                      >
                        Delete
                      </button>
                    )}

                    {entry.source === "fixed" && (
                      <span className="text-xs text-muted-foreground">
                        Automatic fixed entries cannot be deleted.
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-[18px] border border-dashed border-border bg-surface-alt p-8">
              <h3 className="font-serif text-xl">
                No income recorded
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                No income entries were found for {MONTHS[month - 1]}{" "}
                {year}.
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
    </div>
  );
}

export default function IncomePage() {
  return (
    <AuthGuard>
      <IncomeManager />
    </AuthGuard>
  );
}