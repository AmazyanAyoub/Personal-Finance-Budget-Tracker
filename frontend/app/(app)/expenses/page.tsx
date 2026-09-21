"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createExpense,
  deleteExpense,
  getMonthlyExpenseSummary,
  listCategories,
  listExpenses,
  updateExpense,
  type Expense,
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

function ExpenseManager() {
  const token = getToken()!;
  const queryClient = useQueryClient();
  const today = new Date();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(
    defaultDateForMonth(today.getFullYear(), today.getMonth() + 1)
  );
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const {
    data: categories,
    isPending: categoriesPending,
    error: categoriesError,
  } = useQuery({
    queryKey: ["categories"],
    queryFn: () => listCategories(token),
    retry: false,
  });

  const {
    data: expenses,
    isPending: expensesPending,
    error: expensesError,
    refetch: refetchExpenses,
  } = useQuery({
    queryKey: ["expenses", year, month],
    queryFn: () => listExpenses(token, year, month),
    retry: false,
  });

  const {
    data: summary,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["expense-summary", year, month],
    queryFn: () => getMonthlyExpenseSummary(token, year, month),
    retry: false,
  });

  const essentialCategories =
    categories?.filter((category) => category.bucket === "essentials") ?? [];

  const lifestyleCategories =
    categories?.filter((category) => category.bucket === "lifestyle") ?? [];

  const selectedCategoryId =
    categoryId ?? categories?.[0]?.id ?? null;

  // useEffect(() => {
  //   if (categoryId === null && categories?.length) {
  //     setCategoryId(categories[0].id);
  //   }
  // }, [categories, categoryId]);

  // useEffect(() => {
  //   if (editingId === null) {
  //     setDate(defaultDateForMonth(year, month));
  //   }
  // }, [year, month, editingId]);

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(
    lastDay
  ).padStart(2, "0")}`;

  function findCategory(categoryIdToFind: number) {
    return categories?.find(
      (category) => category.id === categoryIdToFind
    );
  }

  function resetForm() {
    setEditingId(null);
    setAmount("");
    setNote("");
    setDate(defaultDateForMonth(year, month));
    setCategoryId(categories?.[0]?.id ?? null);
    setFormError(null);
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
    setAmount("");
    setNote("");
    setFormError(null);
    setMonth(nextMonth);
    setYear(nextYear);

    setDate(defaultDateForMonth(nextYear, nextMonth));
    setCategoryId(categories?.[0]?.id ?? null);
  }

  function handleEdit(expense: Expense) {
    setEditingId(expense.id);
    setAmount((expense.amount_cents / 100).toFixed(2));
    setNote(expense.note);
    setDate(expense.date);
    setCategoryId(expense.category_id);
    setFormError(null);
  }

  async function refreshExpenseData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["expenses"] }),
      queryClient.invalidateQueries({ queryKey: ["expense-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    setFormError(null);

    const amountCents = toCents(Number(amount));

    if (!amountCents || amountCents <= 0) {
      setFormError("Enter a valid expense amount.");
      return;
    }

    if (!note.trim()) {
      setFormError("Enter a short description for the expense.");
      return;
    }

    if (!selectedCategoryId) {
      setFormError("Choose a category.");
      return;
    }

    setIsSaving(true);

    try {
      const expenseData = {
        amount_cents: amountCents,
        note: note.trim(),
        date,
        category_id: selectedCategoryId,
      };

      if (editingId !== null) {
        await updateExpense(token, editingId, expenseData);
      } else {
        await createExpense(token, expenseData);
      }

      resetForm();
      await refreshExpenseData();
    } catch (caughtError) {
      setFormError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save this expense."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(expense: Expense) {
    const confirmed = window.confirm(
      `Delete “${expense.note}” for ${formatMAD(expense.amount_cents)}?`
    );

    if (!confirmed) return;

    setListError(null);

    try {
      await deleteExpense(token, expense.id);

      if (editingId === expense.id) {
        resetForm();
      }

      await refreshExpenseData();
    } catch (caughtError) {
      setListError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not delete this expense."
      );
    }
  }

  const loading = categoriesPending || expensesPending;
  const loadingError =
    categoriesError || expensesError || summaryError;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      {/* Heading */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            Monthly spending
          </p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight">
            Expenses
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Record your spending and assign every expense to Essentials or
            Lifestyle. Debt payments are recorded separately on the Debts
            page but still count under Essentials on the dashboard.
          </p>
        </div>

        <Link
          href="/debts"
          className="w-fit text-sm font-medium text-brand underline decoration-brand/30 underline-offset-4"
        >
          Manage debt payments →
        </Link>
      </div>

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
            Monthly expense entries
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
          <p className="text-sm text-muted-foreground">Total expenses</p>
          <p className="mt-3 font-serif text-2xl">
            {summary ? formatMAD(summary.total_cents) : "—"}
          </p>
        </div>

        <div className="bg-surface p-6">
          <div className="mb-4 h-1 w-9 rounded-full bg-brand-mid" />
          <p className="text-sm text-muted-foreground">
            Essential expenses
          </p>
          <p className="mt-3 font-serif text-2xl">
            {summary ? formatMAD(summary.essentials_cents) : "—"}
          </p>
        </div>

        <div className="bg-surface p-6">
          <div className="mb-4 h-1 w-9 rounded-full bg-gold" />
          <p className="text-sm text-muted-foreground">
            Lifestyle expenses
          </p>
          <p className="mt-3 font-serif text-2xl">
            {summary ? formatMAD(summary.lifestyle_cents) : "—"}
          </p>
        </div>

        <div className="bg-surface p-6">
          <p className="text-sm text-muted-foreground">Entries</p>
          <p className="mt-3 font-serif text-3xl text-brand">
            {summary?.entry_count ?? "—"}
          </p>
        </div>
      </section>

      <p className="-mt-4 text-xs leading-relaxed text-muted-foreground">
        These totals contain expense entries only. Debt payments are managed
        separately and included in the dashboard’s complete Essentials total.
      </p>

      <div className="grid items-start gap-8 lg:grid-cols-[350px_1fr]">
        {/* Expense form */}
        <aside className="rounded-[20px] border border-border bg-surface p-6 lg:sticky lg:top-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
            {editingId !== null ? "Editing entry" : "New entry"}
          </p>
          <h2 className="mt-3 font-serif text-2xl">
            {editingId !== null ? "Edit expense" : "Add an expense"}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {editingId !== null
              ? "Update the selected expense, then save your changes."
              : "Record money you actually spent during this month."}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-5">
            <label className="block text-sm font-medium">
              Amount
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
                <span className="text-xs text-muted-foreground">MAD</span>
              </div>
            </label>

            <label className="block text-sm font-medium">
              Description
              <input
                type="text"
                required
                maxLength={255}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. Weekly groceries"
                className="mt-2 w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:border-brand"
              />
            </label>

            <label className="block text-sm font-medium">
              Date
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
              Category
              <select
                required
                value={selectedCategoryId ?? ""}
                onChange={(event) =>
                  setCategoryId(Number(event.target.value))
                }
                disabled={categoriesPending || !categories?.length}
                className="mt-2 w-full rounded-[10px] border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brand disabled:opacity-50"
              >
                <option value="" disabled>
                  Choose a category
                </option>

                {essentialCategories.length > 0 && (
                  <optgroup label="Essentials">
                    {essentialCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </optgroup>
                )}

                {lifestyleCategories.length > 0 && (
                  <optgroup label="Lifestyle">
                    {lifestyleCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>

            {categoriesError && (
              <p className="text-sm text-danger">
                Could not load expense categories.
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

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSaving || categoriesPending}
                className="rounded-[10px] bg-brand px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving
                  ? "Saving…"
                  : editingId !== null
                    ? "Save changes"
                    : "Add expense"}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSaving}
                  className="rounded-[10px] border border-border px-5 py-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </aside>

        {/* Expense history */}
        <section className="min-w-0">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
              Monthly history
            </p>
            <h2 className="mt-3 font-serif text-2xl">
              Expense entries
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Review, edit, or remove expenses recorded for this month.
            </p>
          </div>

          {loading ? (
            <p className="mt-8 text-sm text-muted-foreground">
              Loading expenses…
            </p>
          ) : loadingError ? (
            <div className="mt-7 rounded-[16px] border border-border bg-surface p-6">
              <p className="text-sm">
                Could not load the expenses for this month.
              </p>
              <button
                type="button"
                onClick={() => {
                  refetchExpenses();
                  refetchSummary();
                }}
                className="mt-4 text-sm font-medium text-brand underline"
              >
                Try again
              </button>
            </div>
          ) : expenses?.length ? (
            <div className="mt-7 overflow-hidden rounded-[18px] border border-border bg-surface">
              {expenses.map((expense) => {
                const category = findCategory(expense.category_id);
                const isEssential = category?.bucket === "essentials";

                return (
                  <article
                    key={expense.id}
                    className="border-b border-border p-5 last:border-b-0 md:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium">{expense.note}</h3>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs ${
                              isEssential
                                ? "bg-brand-tint text-brand"
                                : "bg-gold-tint text-gold"
                            }`}
                          >
                            {isEssential ? "Essentials" : "Lifestyle"}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-muted-foreground">
                          {category?.name ?? "Unknown category"} ·{" "}
                          {formatDate(expense.date)}
                        </p>
                      </div>

                      <p className="font-mono text-sm tabular-nums">
                        {formatMAD(expense.amount_cents)}
                      </p>
                    </div>

                    <div className="mt-4 flex gap-4">
                      <button
                        type="button"
                        onClick={() => handleEdit(expense)}
                        className="text-sm font-medium text-brand underline decoration-brand/30 underline-offset-4"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(expense)}
                        className="text-sm text-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-7 rounded-[18px] border border-dashed border-border bg-surface-alt p-8">
              <h3 className="font-serif text-xl">
                No expenses recorded
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Add your first expense for {MONTHS[month - 1]} using the
                form.
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

export default function ExpensesPage() {
  return (
    <AuthGuard>
      <ExpenseManager />
    </AuthGuard>
  );
}